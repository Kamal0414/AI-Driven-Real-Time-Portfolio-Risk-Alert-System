import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, resolveTableName, ENV, TABLE_NAMES } from '@prr/shared';
import type { Insight } from '@prr/shared';

const tableName = (): string => resolveTableName(ENV.TABLE_INSIGHTS, TABLE_NAMES.INSIGHTS);

/** Save a new insight. TTL = 7 days. */
export const saveInsight = async (insight: Insight): Promise<void> => {
  const client = getDynamoClient();
  const ttl = Math.floor(Date.now() / 1000) + 7 * 86400;
  await client.send(
    new PutCommand({ TableName: tableName(), Item: { ...insight, ttl } }),
  );
};

/** Get insights for a portfolio, most recent first. */
export const getInsightsByPortfolio = async (
  portfolioId: string,
  limit = 10,
): Promise<Insight[]> => {
  const client = getDynamoClient();
  const result = await client.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: 'portfolioId = :pk',
      ExpressionAttributeValues: { ':pk': portfolioId },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (result.Items ?? []) as Insight[];
};
