import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as path from 'path';
import { NodeLambda } from '../constructs/node-lambda';
import type { AppConfig } from '../config/env';

export interface MarketDataStackProps extends cdk.StackProps {
  config: AppConfig;
  pricesTable: dynamodb.Table;
  eventBus: events.IEventBus;
}

/**
 * MarketDataStack — simulates live market price streaming + read API.
 *
 * EventBridge Scheduler invokes the tick Lambda every 1 minute (the
 * minimum supported by AWS Scheduler rate expressions). The tick:
 *   1. Generates bounded random-walk prices for 20 equities.
 *   2. Writes latest prices to DynamoDB.
 *   3. Publishes a PriceUpdated event to EventBridge.
 *
 * Also exposes a read API (GET /prices) wired in ApiStack.
 */
export class MarketDataStack extends cdk.Stack {
  public readonly getPricesFn: lambda.IFunction;

  constructor(scope: Construct, id: string, props: MarketDataStackProps) {
    super(scope, id, props);

    const { config, pricesTable, eventBus } = props;

    const commonEnv: Record<string, string> = {
      TABLE_PRICES: pricesTable.tableName,
      EVENT_BUS_NAME: eventBus.eventBusName,
      LOG_LEVEL: config.logLevel,
    };

    const servicesRoot = path.join(__dirname, '../../../services/market-data-service/src/handlers');

    // ─── Tick Handler Lambda (Scheduler triggered) ────────────────
    const tickFn = new NodeLambda(this, 'TickHandler', {
      entry: path.join(servicesRoot, 'tickHandler.ts'),
      functionName: `${config.prefix}-market-tick`,
      description: 'Generate mock price updates and publish PriceUpdated event',
      timeout: cdk.Duration.seconds(10),
      environment: commonEnv,
    });
    pricesTable.grantReadWriteData(tickFn.function);
    eventBus.grantPutEventsTo(tickFn.function);

    // ─── Get Prices Lambda (API read) ─────────────────────────────
    const getPricesFn = new NodeLambda(this, 'GetPrices', {
      entry: path.join(servicesRoot, 'getPrices.ts'),
      functionName: `${config.prefix}-get-prices`,
      description: 'Return latest prices for all symbols',
      environment: commonEnv,
    });
    pricesTable.grantReadData(getPricesFn.function);
    this.getPricesFn = getPricesFn.function;

    // ─── EventBridge Scheduler ────────────────────────────────────
    const schedulerRole = new iam.Role(this, 'SchedulerRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
      description: 'Role for EventBridge Scheduler to invoke market-tick Lambda',
    });
    tickFn.function.grantInvoke(schedulerRole);

    new scheduler.CfnSchedule(this, 'MarketTickSchedule', {
      name: `${config.prefix}-market-tick-schedule`,
      description: `Triggers market price simulation every ${config.tickIntervalMinutes} minute(s)`,
      scheduleExpression: `rate(${config.tickIntervalMinutes} minutes)`,
      flexibleTimeWindow: { mode: 'OFF' },
      state: 'ENABLED',
      target: {
        arn: tickFn.function.functionArn,
        roleArn: schedulerRole.roleArn,
        retryPolicy: { maximumRetryAttempts: 0 },
      },
    });
  }
}
