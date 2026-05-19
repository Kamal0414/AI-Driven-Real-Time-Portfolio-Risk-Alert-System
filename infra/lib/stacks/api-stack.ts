import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import type { AppConfig } from '../config/env';

export interface ApiStackProps extends cdk.StackProps {
  config: AppConfig;
  /** Portfolio Service Lambdas. */
  listPortfoliosFn: lambda.IFunction;
  getPortfolioFn: lambda.IFunction;
  createPortfolioFn: lambda.IFunction;
  updateHoldingsFn: lambda.IFunction;
  /** AI Insight Service Lambdas. */
  getInsightsFn: lambda.IFunction;
  getLatestInsightsFn: lambda.IFunction;
  /** Market Data Service Lambdas. */
  getPricesFn: lambda.IFunction;
  /** Risk Service Lambdas. */
  listValuationsFn: lambda.IFunction;
  getValuationFn: lambda.IFunction;
}

/**
 * ApiStack — HTTP API (API Gateway v2) + ALL routes for the system.
 *
 * All routes live here to avoid cross-stack permission cycles.
 * Dependency direction: ApiStack -> all service stacks (one-way).
 */
export class ApiStack extends cdk.Stack {
  public readonly httpApi: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { config } = props;

    this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `${config.prefix}-api`,
      description: 'Portfolio Risk Alert System — HTTP API',
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge: cdk.Duration.hours(1),
      },
      disableExecuteApiEndpoint: false,
    });

    // ─── Portfolio routes ─────────────────────────────────────────
    this.httpApi.addRoutes({
      path: '/portfolios',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('ListInt', props.listPortfoliosFn),
    });
    this.httpApi.addRoutes({
      path: '/portfolios/{portfolioId}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetInt', props.getPortfolioFn),
    });
    this.httpApi.addRoutes({
      path: '/portfolios',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('CreateInt', props.createPortfolioFn),
    });
    this.httpApi.addRoutes({
      path: '/portfolios/{portfolioId}/holdings',
      methods: [apigatewayv2.HttpMethod.PUT],
      integration: new integrations.HttpLambdaIntegration('UpdateInt', props.updateHoldingsFn),
    });

    // ─── Insight routes ───────────────────────────────────────────
    this.httpApi.addRoutes({
      path: '/portfolios/{portfolioId}/insights',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetInsightsInt', props.getInsightsFn),
    });
    this.httpApi.addRoutes({
      path: '/insights/latest',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetLatestInt', props.getLatestInsightsFn),
    });

    // ─── Prices route ─────────────────────────────────────────────
    this.httpApi.addRoutes({
      path: '/prices',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetPricesInt', props.getPricesFn),
    });

    // ─── Valuation routes ─────────────────────────────────────────
    this.httpApi.addRoutes({
      path: '/valuations/latest',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('ListValInt', props.listValuationsFn),
    });
    this.httpApi.addRoutes({
      path: '/portfolios/{portfolioId}/valuation',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetValInt', props.getValuationFn),
    });

    // ─── Outputs ──────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'Base URL for the HTTP API (use as VITE_API_URL in frontend)',
    });
    new cdk.CfnOutput(this, 'ApiId', { value: this.httpApi.apiId });
  }
}
