import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, resolveTableName, ENV, TABLE_NAMES } from '@prr/shared';
import type { Portfolio } from '@prr/shared';

const tableName = (): string => resolveTableName(ENV.TABLE_PORTFOLIOS, TABLE_NAMES.PORTFOLIOS);

/**
 * Read-only portfolio access for the Risk Service.
 * Scans all portfolios (100 items — fine for demo scale).
 */
export const loadAllPortfolios = async (): Promise<Portfolio[]> => {
  const client = getDynamoClient();
  const items: Portfolio[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await client.send(
      new ScanCommand({
        TableName: tableName(),
        ExclusiveStartKey: lastKey,
      }),
    );
    if (result.Items) {
      items.push(...(result.Items as Portfolio[]));
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
};
