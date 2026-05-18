import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { withErrorHandling, ok, BadRequestError } from '@prr/shared';
import * as portfolioService from '../domain/portfolio.service.js';

/**
 * GET /portfolios/{portfolioId}
 *
 * Returns a single portfolio by ID. 404 if not found.
 */
export const handler = withErrorHandling(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const portfolioId = event.pathParameters?.portfolioId;
    if (!portfolioId) {
      throw new BadRequestError('portfolioId path parameter is required');
    }

    const portfolio = await portfolioService.getById(portfolioId);
    return ok(portfolio);
  },
);
