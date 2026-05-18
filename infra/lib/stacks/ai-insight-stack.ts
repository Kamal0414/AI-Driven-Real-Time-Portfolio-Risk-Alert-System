import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { Construct } from 'constructs';
import * as path from 'path';
import { NodeLambda } from '../constructs/node-lambda';
import type { AppConfig } from '../config/env';

export interface AiInsightStackProps extends cdk.StackProps {
  config: AppConfig;
  insightsTable: dynamodb.Table;
  alertsTable: dynamodb.Table;
  eventBus: events.IEventBus;
  aiQueue: sqs.Queue;
  httpApi: apigatewayv2.HttpApi;
}

/**
 * AiInsightStack — consumes risk breaches, generates AI commentary.
 *
 * Flow:
 * 1. EventBridge rule routes RiskThresholdBreached → SQS AI queue.
 * 2. AI Lambda is triggered from SQS (batch size 1).
 * 3. Lambda calls LLM provider (mock by default).
 * 4. Writes Insight to DynamoDB.
 * 5. Publishes AIInsightGenerated event.
 *
 * Also exposes a read API:
 * - GET /portfolios/{portfolioId}/insights
 * - GET /insights/latest (dashboard aggregation)
 *
 * Why SQS between EventBridge and AI Lambda?
 * - LLM calls are slow (2-30s) and unreliable.
 * - SQS provides automatic retries with exponential backoff.
 * - DLQ captures permanent failures for investigation.
 * - Decouples the Risk Service from AI availability.
 */
export class AiInsightStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AiInsightStackProps) {
    super(scope, id, props);

    const { config, insightsTable, alertsTable, eventBus, aiQueue, httpApi } = props;

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

    // ─── EventBridge Rule: RiskThresholdBreached → SQS ────────────
    new events.Rule(this, 'RiskBreachToSqs', {
      eventBus,
      ruleName: `${config.prefix}-risk-breach-to-ai`,
      description: 'Routes RiskThresholdBreached events to the AI SQS queue',
      eventPattern: {
        source: ['prr.risk-service'],
        detailType: ['RiskThresholdBreached'],
      },
      targets: [new targets.SqsQueue(aiQueue)],
    });

    // ─── AI Processing Lambda (SQS triggered) ─────────────────────
    const onRiskBreachedFn = new NodeLambda(this, 'OnRiskBreached', {
      entry: path.join(servicesRoot, 'onRiskBreached.ts'),
      functionName: `${config.prefix}-ai-on-breach`,
      description: 'Generate AI insight from risk breach event',
      memorySize: 256,
      timeout: cdk.Duration.seconds(45), // LLM calls can be slow
      environment: commonEnv,
    });
    insightsTable.grantReadWriteData(onRiskBreachedFn.function);
    alertsTable.grantReadData(onRiskBreachedFn.function);
    eventBus.grantPutEventsTo(onRiskBreachedFn.function);
    aiQueue.grantConsumeMessages(onRiskBreachedFn.function);

    // Wire SQS → Lambda with batch size 1 (one breach = one insight)
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

    // ─── API Routes ───────────────────────────────────────────────
    httpApi.addRoutes({
      path: '/portfolios/{portfolioId}/insights',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetInsightsInt', getInsightsFn.function),
    });
    httpApi.addRoutes({
      path: '/insights/latest',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetLatestInt', getLatestFn.function),
    });
  }
}
