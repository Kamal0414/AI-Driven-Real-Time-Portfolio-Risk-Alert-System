import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { withErrorHandling, ok, getDynamoClient, resolveTableName, ENV, TABLE_NAMES } from '@prr/shared';
import type { Insight } from '@prr/shared';

const tableName = (): string => resolveTableName(ENV.TABLE_INSIGHTS, TABLE_NAMES.INSIGHTS);

/**
 * GET /insights/latest
 *
 * Returns the most recent insights across ALL portfolios for the dashboard feed.
 */
export const handler = withErrorHandling(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const limitParam = event.queryStringParameters?.limit;
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 50) : 20;

    const client = getDynamoClient();
    const result = await client.send(
      new ScanCommand({ TableName: tableName(), Limit: 200 }),
    );

    const allInsights = (result.Items ?? []) as Insight[];
    const sorted = allInsights
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
      .slice(0, limit);

    return ok({ insights: sorted, count: sorted.length });
  },
);
