import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, resolveTableName, ENV, TABLE_NAMES } from '@prr/shared';
import type { Valuation } from '@prr/shared';

const tableName = (): string => resolveTableName(ENV.TABLE_VALUATIONS, TABLE_NAMES.VALUATIONS);

/**
 * Valuation Repository — persists point-in-time valuation snapshots.
 *
 * Table: PK=portfolioId, SK=asOf
 * TTL auto-purges after 24h to keep storage minimal.
 */

/** Save a valuation snapshot. TTL = 24 hours from now. */
export const saveValuation = async (valuation: Valuation): Promise<void> => {
  const client = getDynamoClient();
  const ttl = Math.floor(Date.now() / 1000) + 86400; // 24h from now

  await client.send(
    new PutCommand({
      TableName: tableName(),
      Item: { ...valuation, ttl },
    }),
  );
};
