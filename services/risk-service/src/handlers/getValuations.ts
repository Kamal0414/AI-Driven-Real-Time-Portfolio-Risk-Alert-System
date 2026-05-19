import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  withErrorHandling,
  ok,
  BadRequestError,
  getDynamoClient,
  resolveTableName,
  ENV,
  TABLE_NAMES,
} from '@prr/shared';
import type { Valuation } from '@prr/shared';

const tableName = (): string => resolveTableName(ENV.TABLE_VALUATIONS, TABLE_NAMES.VALUATIONS);

/**
 * GET /valuations/latest
 *
 * Returns the latest valuation for every portfolio. Scans the table
 * (capped at 1000 rows due to TTL of 24h) and groups by portfolioId,
 * keeping the most recent asOf for each.
 */
export const listLatest = withErrorHandling(
  async (_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const client = getDynamoClient();
    const items: Valuation[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await client.send(
        new ScanCommand({
          TableName: tableName(),
          ExclusiveStartKey: lastKey,
          Limit: 500,
        }),
      );
      if (result.Items) items.push(...(result.Items as Valuation[]));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey && items.length < 2000);

    // Keep only the most recent valuation per portfolioId
    const latestByPortfolio = new Map<string, Valuation>();
    for (const v of items) {
      const existing = latestByPortfolio.get(v.portfolioId);
      if (!existing || v.asOf > existing.asOf) {
        latestByPortfolio.set(v.portfolioId, v);
      }
    }

    const valuations = Array.from(latestByPortfolio.values());
    return ok({ valuations, count: valuations.length });
  },
);

/**
 * GET /portfolios/{portfolioId}/valuation
 *
 * Returns the most recent valuation for a single portfolio.
 */
export const getOne = withErrorHandling(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const portfolioId = event.pathParameters?.portfolioId;
    if (!portfolioId) {
      throw new BadRequestError('portfolioId path parameter is required');
    }

    const client = getDynamoClient();
    const result = await client.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: 'portfolioId = :pk',
        ExpressionAttributeValues: { ':pk': portfolioId },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );

    const valuation = (result.Items?.[0] ?? null) as Valuation | null;
    return ok({ valuation });
  },
);
