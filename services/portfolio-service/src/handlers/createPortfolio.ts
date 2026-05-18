import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { withErrorHandling, parseBody, created } from '@prr/shared';
import { HoldingSchema, TargetAllocationSchema } from '@prr/shared';
import * as portfolioService from '../domain/portfolio.service.js';

/**
 * POST /portfolios
 *
 * Creates a new client portfolio with holdings and target allocation.
 * Validates input, persists to DynamoDB, publishes PortfolioUpdated event.
 */

const CreatePortfolioBodySchema = z.object({
  clientId: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  holdings: z.array(HoldingSchema).min(1),
  targetAllocation: z.array(TargetAllocationSchema).min(1),
  cash: z.number().nonnegative().optional(),
});

export const handler = withErrorHandling(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const body = parseBody(CreatePortfolioBodySchema, event.body);

    const portfolio = await portfolioService.create({
      clientId: body.clientId,
      name: body.name,
      holdings: body.holdings,
      targetAllocation: body.targetAllocation,
      cash: body.cash,
    });

    return created(portfolio);
  },
);
