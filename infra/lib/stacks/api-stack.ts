import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import type { AppConfig } from '../config/env';

export interface ApiStackProps extends cdk.StackProps {
  config: AppConfig;
  /** Lambdas exposed by PortfolioStack. */
  listPortfoliosFn: lambda.IFunction;
  getPortfolioFn: lambda.IFunction;
  createPortfolioFn: lambda.IFunction;
  updateHoldingsFn: lambda.IFunction;
  /** Lambdas exposed by AiInsightStack. */
  getInsightsFn: lambda.IFunction;
  getLatestInsightsFn: lambda.IFunction;
}

/**
 * ApiStack — HTTP API (API Gateway v2) + ALL routes for the system.
 *
 * Why all routes here? When a route in stack A targets a Lambda in stack B,
 * CDK creates a Lambda permission resource that references both. Putting
 * the API + routes in the same stack and importing Lambda refs from
 * service stacks avoids the cross-stack permission cycle.
 *
 * Dependency direction: ApiStack -> PortfolioStack, ApiStack -> AiInsightStack
 *
 * Why a single HTTP API with multiple route integrations?
 * - Cheaper than REST API ($1/M vs $3.50/M requests).
 * - 1M requests/month free tier (12 months).
 * - Single base URL for the React dashboard to target.
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

    // ─── Outputs ──────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'Base URL for the HTTP API (use as VITE_API_URL in frontend)',
    });
    new cdk.CfnOutput(this, 'ApiId', { value: this.httpApi.apiId });
  }
}
