import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';
import type { AppConfig } from '../config/env';

export interface DataStackProps extends cdk.StackProps {
  config: AppConfig;
}

/**
 * DataStack — all DynamoDB tables used by the system.
 *
 * Design decisions:
 * - PAY_PER_REQUEST (on-demand) → zero cost when idle, Free Tier friendly.
 * - RemovalPolicy.DESTROY → easy teardown for student/demo usage.
 * - TTL enabled on Valuations, Alerts, Insights to keep storage tiny.
 * - Single-table-per-concern (not single-table design) for clarity in a 24h build.
 */
export class DataStack extends cdk.Stack {
  public readonly portfoliosTable: dynamodb.Table;
  public readonly pricesTable: dynamodb.Table;
  public readonly valuationsTable: dynamodb.Table;
  public readonly alertsTable: dynamodb.Table;
  public readonly insightsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { config } = props;
    const billing = dynamodb.BillingMode.PAY_PER_REQUEST;
    const removal = cdk.RemovalPolicy.DESTROY;

    // ─── Portfolios ───────────────────────────────────────────────
    // PK: portfolioId
    // Stores holdings, target allocations, client metadata.
    this.portfoliosTable = new dynamodb.Table(this, 'PortfoliosTable', {
      tableName: `${config.prefix}-portfolios`,
      partitionKey: { name: 'portfolioId', type: dynamodb.AttributeType.STRING },
      billingMode: billing,
      removalPolicy: removal,
      pointInTimeRecovery: false,
    });

    // GSI: query portfolios by clientId
    this.portfoliosTable.addGlobalSecondaryIndex({
      indexName: 'clientId-index',
      partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ─── Prices ───────────────────────────────────────────────────
    // PK: symbol
    // Stores latest price + previousClose per equity.
    this.pricesTable = new dynamodb.Table(this, 'PricesTable', {
      tableName: `${config.prefix}-prices`,
      partitionKey: { name: 'symbol', type: dynamodb.AttributeType.STRING },
      billingMode: billing,
      removalPolicy: removal,
    });

    // ─── Valuations ───────────────────────────────────────────────
    // PK: portfolioId, SK: asOf (ISO timestamp)
    // Stores point-in-time revaluation snapshots.
    // TTL auto-purges after configured hours to keep storage minimal.
    this.valuationsTable = new dynamodb.Table(this, 'ValuationsTable', {
      tableName: `${config.prefix}-valuations`,
      partitionKey: { name: 'portfolioId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'asOf', type: dynamodb.AttributeType.STRING },
      billingMode: billing,
      removalPolicy: removal,
      timeToLiveAttribute: 'ttl',
    });

    // ─── Alerts ───────────────────────────────────────────────────
    // PK: portfolioId, SK: breachKey (type#symbol#minuteBucket)
    // Idempotent — same breach in the same minute = one row.
    this.alertsTable = new dynamodb.Table(this, 'AlertsTable', {
      tableName: `${config.prefix}-alerts`,
      partitionKey: { name: 'portfolioId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'breachKey', type: dynamodb.AttributeType.STRING },
      billingMode: billing,
      removalPolicy: removal,
      timeToLiveAttribute: 'ttl',
    });

    // ─── Insights ─────────────────────────────────────────────────
    // PK: portfolioId, SK: generatedAt (ISO timestamp)
    // AI-generated commentary persisted for dashboard display.
    this.insightsTable = new dynamodb.Table(this, 'InsightsTable', {
      tableName: `${config.prefix}-insights`,
      partitionKey: { name: 'portfolioId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'generatedAt', type: dynamodb.AttributeType.STRING },
      billingMode: billing,
      removalPolicy: removal,
      timeToLiveAttribute: 'ttl',
    });

    // ─── Outputs ──────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'PortfoliosTableName', { value: this.portfoliosTable.tableName });
    new cdk.CfnOutput(this, 'PricesTableName', { value: this.pricesTable.tableName });
    new cdk.CfnOutput(this, 'ValuationsTableName', { value: this.valuationsTable.tableName });
    new cdk.CfnOutput(this, 'AlertsTableName', { value: this.alertsTable.tableName });
    new cdk.CfnOutput(this, 'InsightsTableName', { value: this.insightsTable.tableName });
  }
}
