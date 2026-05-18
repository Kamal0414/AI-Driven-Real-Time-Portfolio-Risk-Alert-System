import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { withErrorHandling, ok } from '@prr/shared';
import * as portfolioService from '../domain/portfolio.service.js';

/**
 * GET /portfolios
 *
 * Returns all portfolios (paginated scan, fine for 100-item demo).
 * Response includes count for the dashboard.
 */
export const handler = withErrorHandling(
  async (_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const portfolios = await portfolioService.listAll();
    return ok({ portfolios, count: portfolios.length });
  },
);
