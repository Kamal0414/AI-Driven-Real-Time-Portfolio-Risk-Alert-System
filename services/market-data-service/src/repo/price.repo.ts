import {
  BatchWriteCommand,
  ScanCommand,
  type BatchWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, resolveTableName, ENV, TABLE_NAMES } from '@prr/shared';
import type { Price } from '@prr/shared';
import type { PreviousPriceData } from '../domain/priceSimulator.js';

const tableName = (): string => resolveTableName(ENV.TABLE_PRICES, TABLE_NAMES.PRICES);

/**
 * Price Repository — DynamoDB operations for the Prices table.
 *
 * Table schema:
 *   PK: symbol (string)
 *   Attributes: price, previousClose, asOf, lastCloseDate
 *
 * Each symbol has exactly one row (latest price). This is an overwrite pattern.
 */

/**
 * Load all current prices from DynamoDB.
 * Returns undefined if the table is empty (first run).
 */
export const loadAllPrices = async (): Promise<PreviousPriceData[] | undefined> => {
  const client = getDynamoClient();
  const result = await client.send(
    new ScanCommand({
      TableName: tableName(),
      Limit: 25, // We only have 20 symbols
    }),
  );

  if (!result.Items || result.Items.length === 0) {
    return undefined;
  }

  return result.Items.map((item) => ({
    symbol: item['symbol'] as string,
    price: item['price'] as number,
    previousClose: item['previousClose'] as number,
    lastCloseDate: item['lastCloseDate'] as string | undefined,
  }));
};

/**
 * Persist all 20 prices to DynamoDB in a single batch write.
 * DynamoDB BatchWrite supports up to 25 items — we have exactly 20.
 *
 * Each item overwrites the existing row for that symbol (PutRequest).
 */
export const saveAllPrices = async (prices: Price[]): Promise<void> => {
  const client = getDynamoClient();
  const table = tableName();
  const today = prices[0]?.asOf.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  const params: BatchWriteCommandInput = {
    RequestItems: {
      [table]: prices.map((p) => ({
        PutRequest: {
          Item: {
            symbol: p.symbol,
            price: p.price,
            previousClose: p.previousClose,
            asOf: p.asOf,
            lastCloseDate: today,
          },
        },
      })),
    },
  };

  const result = await client.send(new BatchWriteCommand(params));

  // Handle unprocessed items (rare, but possible under throttling)
  if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
    // Simple retry — in production you'd use exponential backoff
    await client.send(
      new BatchWriteCommand({ RequestItems: result.UnprocessedItems }),
    );
  }
};
