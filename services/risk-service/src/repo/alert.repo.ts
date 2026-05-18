import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, resolveTableName, ENV, TABLE_NAMES } from '@prr/shared';
import type { Alert } from '@prr/shared';

const tableName = (): string => resolveTableName(ENV.TABLE_ALERTS, TABLE_NAMES.ALERTS);

/**
 * Alert Repository — persists risk breach alerts.
 *
 * Table: PK=portfolioId, SK=breachKey
 * breachKey = type#symbol#minuteBucket → idempotent within same minute.
 * TTL auto-purges after 7 days.
 *
 * Uses conditional put so duplicate alerts within the same minute are a no-op.
 */

/** Save an alert. Returns true if new, false if duplicate (already existed). */
export const saveAlert = async (alert: Alert): Promise<boolean> => {
  const client = getDynamoClient();
  const ttl = Math.floor(Date.now() / 1000) + 7 * 86400; // 7 days

  try {
    await client.send(
      new PutCommand({
        TableName: tableName(),
        Item: { ...alert, ttl },
        // Idempotency: only write if this exact breachKey doesn't exist yet
        ConditionExpression: 'attribute_not_exists(breachKey)',
      }),
    );
    return true; // New alert
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      return false; // Duplicate — already alerted for this breach this minute
    }
    throw err;
  }
};
