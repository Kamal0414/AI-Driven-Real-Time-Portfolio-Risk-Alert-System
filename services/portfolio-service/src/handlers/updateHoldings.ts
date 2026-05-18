import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { withErrorHandling, parseBody, ok, BadRequestError } from '@prr/shared';
import { HoldingSchema, TargetAllocationSchema } from '@prr/shared';
import * as portfolioService from '../domain/portfolio.service.js';

/**
 * PUT /portfolios/{portfolioId}/holdings
 *
 * Updates the holdings and target allocation of an existing portfolio.
 * Validates input, persists, publishes PortfolioUpdated event.
 */

const UpdateHoldingsBodySchema = z.object({
  holdings: z.array(HoldingSchema).min(1),
  targetAllocation: z.array(TargetAllocationSchema).min(1),
  cash: z.number().nonnegative().optional(),
});

export const handler = withErrorHandling(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const portfolioId = event.pathParameters?.portfolioId;
    if (!portfolioId) {
      throw new BadRequestError('portfolioId path parameter is required');
    }

    const body = parseBody(UpdateHoldingsBodySchema, event.body);

    const updated = await portfolioService.updateHoldings(portfolioId, {
      holdings: body.holdings,
      targetAllocation: body.targetAllocation,
      ...(body.cash !== undefined && { cash: body.cash }),
    });

    return ok(updated);
  },
);
