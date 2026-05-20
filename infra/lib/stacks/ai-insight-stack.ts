import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import * as path from 'path';
import { NodeLambda } from '../constructs/node-lambda';
import type { AppConfig } from '../config/env';

export interface AiInsightStackProps extends cdk.StackProps {
  config: AppConfig;
  insightsTable: dynamodb.Table;
  alertsTable: dynamodb.Table;
  eventBus: events.IEventBus;
  aiQueue: sqs.Queue;
}

/**
 * AiInsightStack — consumes risk breaches, generates AI commentary,
 * and exposes read APIs.
 *
 * Lambdas are created here; the read API routes are wired in ApiStack
 * to keep all HTTP routes in one place (avoids cross-stack cycles).
 *
 * Flow:
 * 1. EventBridge rule (in EventsStack) routes RiskThresholdBreached -> SQS.
 * 2. AI Lambda is triggered from SQS (batch size 1).
 * 3. Lambda calls LLM provider (mock by default).
 * 4. Writes Insight to DynamoDB.
 * 5. Publishes AIInsightGenerated event.
 */
export class AiInsightStack extends cdk.Stack {
  public readonly getInsightsFn: lambda.IFunction;
  public readonly getLatestInsightsFn: lambda.IFunction;

  constructor(scope: Construct, id: string, props: AiInsightStackProps) {
    super(scope, id, props);

    const { config, insightsTable, alertsTable, eventBus, aiQueue } = props;

    const commonEnv: Record<string, string> = {
      TABLE_INSIGHTS: insightsTable.tableName,
      TABLE_ALERTS: alertsTable.tableName,
      EVENT_BUS_NAME: eventBus.eventBusName,
      LLM_PROVIDER: config.llmProvider,
      LLM_API_KEY_PARAM: config.llmApiKeyParam,
      LLM_MODEL: config.llmModel,
      LOG_LEVEL: config.logLevel,
    };

    const servicesRoot = path.join(__dirname, '../../../services/ai-insight-service/src/handlers');

    // ─── AI Processing Lambda (SQS triggered) ─────────────────────
    const onRiskBreachedFn = new NodeLambda(this, 'OnRiskBreached', {
      entry: path.join(servicesRoot, 'onRiskBreached.ts'),
      functionName: `${config.prefix}-ai-on-breach`,
      description: 'Generate AI insight from risk breach event',
      memorySize: 256,
      timeout: cdk.Duration.seconds(45),
      environment: commonEnv,
    });
    insightsTable.grantReadWriteData(onRiskBreachedFn.function);
    alertsTable.grantReadData(onRiskBreachedFn.function);
    eventBus.grantPutEventsTo(onRiskBreachedFn.function);
    aiQueue.grantConsumeMessages(onRiskBreachedFn.function);

    // Grant SSM read for the LLM API key
    onRiskBreachedFn.function.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [`arn:aws:ssm:*:*:parameter${config.llmApiKeyParam}`],
      }),
    );

    onRiskBreachedFn.function.addEventSource(
      new lambdaEventSources.SqsEventSource(aiQueue, {
        batchSize: 1,
        maxBatchingWindow: cdk.Duration.seconds(0),
        reportBatchItemFailures: true,
      }),
    );

    // ─── Get Insights by Portfolio (read API) ─────────────────────
    const getInsightsFn = new NodeLambda(this, 'GetInsights', {
      entry: path.join(servicesRoot, 'getInsights.ts'),
      functionName: `${config.prefix}-get-insights`,
      description: 'Get AI insights for a portfolio',
      environment: commonEnv,
    });
    insightsTable.grantReadData(getInsightsFn.function);

    // ─── Get Latest Insights (dashboard) ──────────────────────────
    const getLatestFn = new NodeLambda(this, 'GetLatestInsights', {
      entry: path.join(servicesRoot, 'getLatestInsights.ts'),
      functionName: `${config.prefix}-get-latest-insights`,
      description: 'Get most recent insights across all portfolios',
      environment: commonEnv,
    });
    insightsTable.grantReadData(getLatestFn.function);

    // Expose read Lambdas for ApiStack to wire routes
    this.getInsightsFn = getInsightsFn.function;
    this.getLatestInsightsFn = getLatestFn.function;
  }
}
