import {
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, resolveTableName } from '@prr/shared';
import { ENV, TABLE_NAMES } from '@prr/shared';
import type { Portfolio } from '@prr/shared';

const tableName = (): string => resolveTableName(ENV.TABLE_PORTFOLIOS, TABLE_NAMES.PORTFOLIOS);

/**
 * Portfolio Repository — DynamoDB CRUD operations.
 *
 * Keeps all Dynamo-specific logic isolated from the domain service.
 * Each function operates on the raw Portfolio type from @prr/shared.
 */

/** Create a new portfolio. Fails if portfolioId already exists. */
export const createPortfolio = async (portfolio: Portfolio): Promise<void> => {
  const client = getDynamoClient();
  await client.send(
    new PutCommand({
      TableName: tableName(),
      Item: portfolio,
      ConditionExpression: 'attribute_not_exists(portfolioId)',
    }),
  );
};

/** Get a single portfolio by ID. Returns undefined if not found. */
export const getPortfolioById = async (portfolioId: string): Promise<Portfolio | undefined> => {
  const client = getDynamoClient();
  const result = await client.send(
    new GetCommand({
      TableName: tableName(),
      Key: { portfolioId },
    }),
  );
  return result.Item as Portfolio | undefined;
};

/**
 * List all portfolios. Uses Scan (fine for 100 items in a demo).
 * For production scale, paginate or use a GSI query.
 */
export const listAllPortfolios = async (): Promise<Portfolio[]> => {
  const client = getDynamoClient();
  const items: Portfolio[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await client.send(
      new ScanCommand({
        TableName: tableName(),
        ExclusiveStartKey: lastKey,
        Limit: 100,
      }),
    );
    if (result.Items) {
      items.push(...(result.Items as Portfolio[]));
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
};

/** Update holdings and target allocation for an existing portfolio. */
export const updatePortfolioHoldings = async (
  portfolioId: string,
  holdings: Portfolio['holdings'],
  targetAllocation: Portfolio['targetAllocation'],
  cash: number,
): Promise<Portfolio | undefined> => {
  const client = getDynamoClient();
  const now = new Date().toISOString();

  const result = await client.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { portfolioId },
      UpdateExpression:
        'SET holdings = :h, targetAllocation = :t, cash = :c, updatedAt = :u',
      ExpressionAttributeValues: {
        ':h': holdings,
        ':t': targetAllocation,
        ':c': cash,
        ':u': now,
      },
      ConditionExpression: 'attribute_exists(portfolioId)',
      ReturnValues: 'ALL_NEW',
    }),
  );
  return result.Attributes as Portfolio | undefined;
};

/** Batch write portfolios (for seeding). Handles 25-item batch limit. */
export const batchCreatePortfolios = async (portfolios: Portfolio[]): Promise<void> => {
  const client = getDynamoClient();
  const table = tableName();
  const BATCH_SIZE = 25;

  for (let i = 0; i < portfolios.length; i += BATCH_SIZE) {
    const batch = portfolios.slice(i, i + BATCH_SIZE);
    // Use individual PutCommands (simpler error handling for a seed script)
    await Promise.all(
      batch.map((p) =>
        client.send(
          new PutCommand({
            TableName: table,
            Item: p,
          }),
        ),
      ),
    );
  }
};
