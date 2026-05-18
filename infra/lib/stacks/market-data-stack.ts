import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as iam from 'aws-cdk-lib/aws-iam';
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
 * MarketDataStack — simulates live market price streaming.
 *
 * Uses EventBridge Scheduler to invoke the tick Lambda on a fixed rate
 * (default 7s). The Lambda:
 * 1. Generates bounded random-walk prices for 20 equities.
 * 2. Writes latest prices to DynamoDB (Prices table).
 * 3. Publishes a PriceUpdated event to EventBridge.
 *
 * Why EventBridge Scheduler over CloudWatch Events rule?
 * - Native rate(Xs) granularity down to 1 second.
 * - 14M free invocations/month (far more than we need).
 * - Built-in retry + DLQ support.
 */
export class MarketDataStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MarketDataStackProps) {
    super(scope, id, props);

    const { config, pricesTable, eventBus } = props;

    const commonEnv: Record<string, string> = {
      TABLE_PRICES: pricesTable.tableName,
      EVENT_BUS_NAME: eventBus.eventBusName,
      LOG_LEVEL: config.logLevel,
    };

    const servicesRoot = path.join(__dirname, '../../../services/market-data-service/src/handlers');

    // ─── Tick Handler Lambda ──────────────────────────────────────
    const tickFn = new NodeLambda(this, 'TickHandler', {
      entry: path.join(servicesRoot, 'tickHandler.ts'),
      functionName: `${config.prefix}-market-tick`,
      description: 'Generate mock price updates and publish PriceUpdated event',
      timeout: cdk.Duration.seconds(10),
      environment: commonEnv,
    });
    pricesTable.grantReadWriteData(tickFn.function);
    eventBus.grantPutEventsTo(tickFn.function);

    // ─── EventBridge Scheduler (rate-based) ───────────────────────
    // Scheduler needs an IAM role to invoke the Lambda target.
    const schedulerRole = new iam.Role(this, 'SchedulerRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
      description: 'Role for EventBridge Scheduler to invoke market-tick Lambda',
    });
    tickFn.function.grantInvoke(schedulerRole);

    new scheduler.CfnSchedule(this, 'MarketTickSchedule', {
      name: `${config.prefix}-market-tick-schedule`,
      description: `Triggers market price simulation every ${config.tickIntervalSeconds}s`,
      scheduleExpression: `rate(${config.tickIntervalSeconds} seconds)`,
      flexibleTimeWindow: { mode: 'OFF' },
      state: 'ENABLED',
      target: {
        arn: tickFn.function.functionArn,
        roleArn: schedulerRole.roleArn,
        retryPolicy: {
          maximumRetryAttempts: 0, // Don't retry missed ticks — next one comes in 7s
        },
      },
    });
  }
}
