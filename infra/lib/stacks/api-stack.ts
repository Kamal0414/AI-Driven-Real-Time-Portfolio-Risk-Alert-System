import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import type { Construct } from 'constructs';
import type { AppConfig } from '../config/env';

export interface ApiStackProps extends cdk.StackProps {
  config: AppConfig;
}

/**
 * ApiStack — HTTP API (API Gateway v2) shared by all services.
 *
 * Why a single HTTP API with multiple route integrations?
 * - Cheaper than REST API ($1/M vs $3.50/M requests).
 * - 1M requests/month free tier (12 months).
 * - Single base URL for the React dashboard to target.
 * - Routes are added by each service stack via `addRoutes()`.
 *
 * CORS is wide open for the MVP dashboard — tighten in production
 * by setting allowOrigins to the CloudFront distribution domain.
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

    // ─── Outputs ──────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'Base URL for the HTTP API (use as VITE_API_URL in frontend)',
    });
    new cdk.CfnOutput(this, 'ApiId', { value: this.httpApi.apiId });
  }
}
