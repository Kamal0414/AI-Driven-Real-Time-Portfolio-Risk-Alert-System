import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { Construct } from 'constructs';
import * as path from 'path';
import { NodeLambda } from '../constructs/node-lambda';
import type { AppConfig } from '../config/env';

export interface PortfolioStackProps extends cdk.StackProps {
  config: AppConfig;
  portfoliosTable: dynamodb.Table;
  eventBus: events.IEventBus;
  httpApi: apigatewayv2.HttpApi;
}

/**
 * PortfolioStack — CRUD service for client portfolios.
 *
 * Lambdas:
 * - listPortfolios  GET  /portfolios
 * - getPortfolio    GET  /portfolios/{portfolioId}
 * - createPortfolio POST /portfolios
 * - updateHoldings  PUT  /portfolios/{portfolioId}/holdings
 *
 * On create/update → publishes PortfolioUpdated event.
 */
export class PortfolioStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PortfolioStackProps) {
    super(scope, id, props);

    const { config, portfoliosTable, eventBus, httpApi } = props;

    const commonEnv: Record<string, string> = {
      TABLE_PORTFOLIOS: portfoliosTable.tableName,
      EVENT_BUS_NAME: eventBus.eventBusName,
      LOG_LEVEL: config.logLevel,
    };

    const servicesRoot = path.join(__dirname, '../../../services/portfolio-service/src/handlers');

    // ─── List Portfolios ──────────────────────────────────────────
    const listFn = new NodeLambda(this, 'ListPortfolios', {
      entry: path.join(servicesRoot, 'listPortfolios.ts'),
      functionName: `${config.prefix}-list-portfolios`,
      description: 'List all client portfolios',
      environment: commonEnv,
    });
    portfoliosTable.grantReadData(listFn.function);

    // ─── Get Portfolio ────────────────────────────────────────────
    const getFn = new NodeLambda(this, 'GetPortfolio', {
      entry: path.join(servicesRoot, 'getPortfolio.ts'),
      functionName: `${config.prefix}-get-portfolio`,
      description: 'Get a single portfolio by ID',
      environment: commonEnv,
    });
    portfoliosTable.grantReadData(getFn.function);

    // ─── Create Portfolio ─────────────────────────────────────────
    const createFn = new NodeLambda(this, 'CreatePortfolio', {
      entry: path.join(servicesRoot, 'createPortfolio.ts'),
      functionName: `${config.prefix}-create-portfolio`,
      description: 'Create a new client portfolio',
      environment: commonEnv,
    });
    portfoliosTable.grantWriteData(createFn.function);
    eventBus.grantPutEventsTo(createFn.function);

    // ─── Update Holdings ──────────────────────────────────────────
    const updateFn = new NodeLambda(this, 'UpdateHoldings', {
      entry: path.join(servicesRoot, 'updateHoldings.ts'),
      functionName: `${config.prefix}-update-holdings`,
      description: 'Update portfolio holdings and target allocation',
      environment: commonEnv,
    });
    portfoliosTable.grantReadWriteData(updateFn.function);
    eventBus.grantPutEventsTo(updateFn.function);

    // ─── API Routes ───────────────────────────────────────────────
    httpApi.addRoutes({
      path: '/portfolios',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('ListInt', listFn.function),
    });
    httpApi.addRoutes({
      path: '/portfolios/{portfolioId}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetInt', getFn.function),
    });
    httpApi.addRoutes({
      path: '/portfolios',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('CreateInt', createFn.function),
    });
    httpApi.addRoutes({
      path: '/portfolios/{portfolioId}/holdings',
      methods: [apigatewayv2.HttpMethod.PUT],
      integration: new integrations.HttpLambdaIntegration('UpdateInt', updateFn.function),
    });
  }
}
