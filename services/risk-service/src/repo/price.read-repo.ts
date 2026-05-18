import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, resolveTableName, ENV, TABLE_NAMES } from '@prr/shared';
import type { Price } from '@prr/shared';

const tableName = (): string => resolveTableName(ENV.TABLE_PRICES, TABLE_NAMES.PRICES);

/**
 * Read-only price access for the Risk Service.
 * Loads all 20 prices from DynamoDB.
 */
export const loadAllPrices = async (): Promise<Price[]> => {
  const client = getDynamoClient();
  const result = await client.send(
    new ScanCommand({
      TableName: tableName(),
      Limit: 25,
    }),
  );
  return (result.Items ?? []) as Price[];
};
