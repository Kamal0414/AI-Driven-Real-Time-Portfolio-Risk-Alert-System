import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import {
  withErrorHandling,
  ok,
  getDynamoClient,
  resolveTableName,
  ENV,
  TABLE_NAMES,
} from '@prr/shared';
import type { Price } from '@prr/shared';

const tableName = (): string => resolveTableName(ENV.TABLE_PRICES, TABLE_NAMES.PRICES);

/**
 * GET /prices
 *
 * Returns current price + previousClose for all 20 equities.
 * Used by the dashboard to render the live market prices section.
 */
export const handler = withErrorHandling(
  async (_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const client = getDynamoClient();
    const result = await client.send(
      new ScanCommand({ TableName: tableName(), Limit: 50 }),
    );

    const prices = ((result.Items ?? []) as Price[]).sort((a, b) =>
      a.symbol.localeCompare(b.symbol),
    );

    return ok({ prices, count: prices.length });
  },
);
