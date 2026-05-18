import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ENV } from '../constants.js';

/**
 * Shared DynamoDB Document client. Keeping it as a lazy singleton means each
 * Lambda warm container reuses one TCP/TLS connection to the DDB endpoint.
 */
let _doc: DynamoDBDocumentClient | null = null;

export const getDynamoClient = (): DynamoDBDocumentClient => {
  if (_doc) return _doc;
  const region = process.env[ENV.AWS_REGION] ?? process.env.AWS_REGION;
  const base = new DynamoDBClient(region ? { region } : {});
  _doc = DynamoDBDocumentClient.from(base, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: false,
    },
    unmarshallOptions: {
      // Numbers fit safely in JS for our domain (USD values, weights);
      // wrap in BigInt only if you need >2^53 precision.
      wrapNumbers: false,
    },
  });
  return _doc;
};

/** Resolve a table name from env with an explicit fallback for local/dev. */
export const resolveTableName = (envKey: string, fallback: string): string => {
  return process.env[envKey] ?? fallback;
};
