import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import type { AppConfig } from '../config/env';

export interface EventsStackProps extends cdk.StackProps {
  config: AppConfig;
}

/**
 * EventsStack — the pub/sub backbone of the system.
 *
 * Components:
 * 1. Custom EventBridge bus — all domain events flow through here.
 * 2. SQS Dead Letter Queue — catches poison messages from the AI queue.
 * 3. SQS AI Queue — buffers RiskThresholdBreached events before the AI Lambda.
 *    - Visibility timeout 60s (LLM calls can be slow).
 *    - Max receives 3 → then DLQ.
 *    - Delivery delay 0s (we want near-real-time).
 * 4. EventBridge Rule → SQS target wiring is done in the AiInsightStack
 *    (keeps this stack generic and reusable).
 *
 * Why SQS only in front of AI?
 * - LLM calls are inherently slow and unreliable.
 * - SQS gives us automatic retries, backpressure, and a DLQ.
 * - The hot path (Risk Service) stays low-latency via direct EventBridge→Lambda.
 */
export class EventsStack extends cdk.Stack {
  public readonly eventBus: events.IEventBus;
  public readonly aiQueue: sqs.Queue;
  public readonly aiDlq: sqs.Queue;

  constructor(scope: Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ─── Custom EventBridge Bus ───────────────────────────────────
    this.eventBus = new events.EventBus(this, 'PortfolioRiskBus', {
      eventBusName: config.eventBusName,
    });

    // ─── AI Dead Letter Queue ─────────────────────────────────────
    this.aiDlq = new sqs.Queue(this, 'AiInsightDLQ', {
      queueName: `${config.prefix}-ai-insight-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─── AI Processing Queue ──────────────────────────────────────
    this.aiQueue = new sqs.Queue(this, 'AiInsightQueue', {
      queueName: `${config.prefix}-ai-insight-queue`,
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: this.aiDlq,
        maxReceiveCount: 3,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─── EventBridge Rule: RiskThresholdBreached -> SQS ───────────
    // Kept in this stack (not AiInsightStack) so CDK doesn't create a
    // circular dependency between the rule, the queue and the bus.
    new events.Rule(this, 'RiskBreachToSqs', {
      eventBus: this.eventBus,
      ruleName: `${config.prefix}-risk-breach-to-ai`,
      description: 'Routes RiskThresholdBreached events to the AI SQS queue',
      eventPattern: {
        source: ['prr.risk-service'],
        detailType: ['RiskThresholdBreached'],
      },
      targets: [new targets.SqsQueue(this.aiQueue)],
    });

    // ─── Outputs ──────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'EventBusName', { value: this.eventBus.eventBusName });
    new cdk.CfnOutput(this, 'EventBusArn', { value: this.eventBus.eventBusArn });
    new cdk.CfnOutput(this, 'AiQueueUrl', { value: this.aiQueue.queueUrl });
    new cdk.CfnOutput(this, 'AiQueueArn', { value: this.aiQueue.queueArn });
    new cdk.CfnOutput(this, 'AiDlqUrl', { value: this.aiDlq.queueUrl });
  }
}
