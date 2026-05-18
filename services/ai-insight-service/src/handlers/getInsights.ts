import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { withErrorHandling, ok, BadRequestError } from '@prr/shared';
import * as insightRepo from '../repo/insight.repo.js';

/**
 * GET /portfolios/{portfolioId}/insights
 *
 * Returns the most recent AI-generated insights for a specific portfolio.
 */
export const handler = withErrorHandling(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const portfolioId = event.pathParameters?.portfolioId;
    if (!portfolioId) {
      throw new BadRequestError('portfolioId path parameter is required');
    }

    const limitParam = event.queryStringParameters?.limit;
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 10, 50) : 10;

    const insights = await insightRepo.getInsightsByPortfolio(portfolioId, limit);
    return ok({ insights, count: insights.length });
  },
);
