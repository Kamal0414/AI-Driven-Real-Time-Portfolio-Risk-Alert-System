import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import type { Construct } from 'constructs';
import * as path from 'path';
import { NodeLambda } from '../constructs/node-lambda';
import type { AppConfig } from '../config/env';

export interface RiskStackProps extends cdk.StackProps {
  config: AppConfig;
  portfoliosTable: dynamodb.Table;
  pricesTable: dynamodb.Table;
  valuationsTable: dynamodb.Table;
  alertsTable: dynamodb.Table;
  eventBus: events.IEventBus;
}

/**
 * RiskStack — subscribes to events, computes valuations, detects breaches.
 *
 * Event subscriptions:
 * - PriceUpdated → revalue all portfolios, run rules engine.
 * - PortfolioUpdated → invalidate cached portfolio data.
 *
 * On breach → publishes RiskThresholdBreached event.
 *
 * Design notes:
 * - Direct EventBridge→Lambda (no SQS) for low latency on the hot path.
 * - Timeout 30s to handle 100 portfolios × 20 symbols per tick.
 * - Memory 512MB for heavier computation.
 */
export class RiskStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RiskStackProps) {
    super(scope, id, props);

    const { config, portfoliosTable, pricesTable, valuationsTable, alertsTable, eventBus } = props;

    const commonEnv: Record<string, string> = {
      TABLE_PORTFOLIOS: portfoliosTable.tableName,
      TABLE_PRICES: pricesTable.tableName,
      TABLE_VALUATIONS: valuationsTable.tableName,
      TABLE_ALERTS: alertsTable.tableName,
      EVENT_BUS_NAME: eventBus.eventBusName,
      LOG_LEVEL: config.logLevel,
    };

    const servicesRoot = path.join(__dirname, '../../../services/risk-service/src/handlers');

    // ─── On Price Updated ─────────────────────────────────────────
    const onPriceFn = new NodeLambda(this, 'OnPriceUpdated', {
      entry: path.join(servicesRoot, 'onPriceUpdated.ts'),
      functionName: `${config.prefix}-risk-on-price`,
      description: 'Revalue portfolios and detect risk breaches on price update',
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
    });
    portfoliosTable.grantReadData(onPriceFn.function);
    pricesTable.grantReadData(onPriceFn.function);
    valuationsTable.grantReadWriteData(onPriceFn.function);
    alertsTable.grantReadWriteData(onPriceFn.function);
    eventBus.grantPutEventsTo(onPriceFn.function);

    // EventBridge Rule: PriceUpdated → Risk Lambda
    new events.Rule(this, 'PriceUpdatedRule', {
      eventBus,
      ruleName: `${config.prefix}-price-to-risk`,
      description: 'Routes PriceUpdated events to the Risk Service',
      eventPattern: {
        source: ['prr.market-data-service'],
        detailType: ['PriceUpdated'],
      },
      targets: [new targets.LambdaFunction(onPriceFn.function, {
        retryAttempts: 2,
        maxEventAge: cdk.Duration.minutes(1),
      })],
    });

    // ─── On Portfolio Updated ─────────────────────────────────────
    const onPortfolioFn = new NodeLambda(this, 'OnPortfolioUpdated', {
      entry: path.join(servicesRoot, 'onPortfolioUpdated.ts'),
      functionName: `${config.prefix}-risk-on-portfolio`,
      description: 'Handle portfolio changes (cache invalidation, immediate revaluation)',
      timeout: cdk.Duration.seconds(15),
      environment: commonEnv,
    });
    portfoliosTable.grantReadData(onPortfolioFn.function);
    pricesTable.grantReadData(onPortfolioFn.function);
    valuationsTable.grantReadWriteData(onPortfolioFn.function);
    alertsTable.grantReadWriteData(onPortfolioFn.function);
    eventBus.grantPutEventsTo(onPortfolioFn.function);

    // EventBridge Rule: PortfolioUpdated → Risk Lambda
    new events.Rule(this, 'PortfolioUpdatedRule', {
      eventBus,
      ruleName: `${config.prefix}-portfolio-to-risk`,
      description: 'Routes PortfolioUpdated events to the Risk Service',
      eventPattern: {
        source: ['prr.portfolio-service'],
        detailType: ['PortfolioUpdated'],
      },
      targets: [new targets.LambdaFunction(onPortfolioFn.function, {
        retryAttempts: 2,
        maxEventAge: cdk.Duration.minutes(1),
      })],
    });
  }
}
