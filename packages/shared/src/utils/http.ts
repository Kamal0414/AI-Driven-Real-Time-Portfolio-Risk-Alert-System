import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { ZodError, type ZodSchema } from 'zod';
import { logger } from './logger.js';

/** Standard JSON envelope for all REST responses. */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}
export interface ApiError {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}

const baseHeaders = {
  'Content-Type': 'application/json',
  // Permissive CORS for the React dashboard. Tighten in CDK if you front
  // this with CloudFront + a fixed origin.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
} as const;

export const ok = <T>(data: T, statusCode = 200): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: baseHeaders,
  body: JSON.stringify({ ok: true, data } satisfies ApiSuccess<T>),
});

export const created = <T>(data: T): APIGatewayProxyResultV2 => ok(data, 201);

export const noContent = (): APIGatewayProxyResultV2 => ({
  statusCode: 204,
  headers: baseHeaders,
  body: '',
});

export const error = (
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: baseHeaders,
  body: JSON.stringify({ ok: false, error: { code, message, details } } satisfies ApiError),
});

export const badRequest = (message: string, details?: unknown) =>
  error(400, 'BAD_REQUEST', message, details);
export const notFound = (message = 'Resource not found') =>
  error(404, 'NOT_FOUND', message);
export const conflict = (message: string) => error(409, 'CONFLICT', message);
export const internalError = (message = 'Internal server error') =>
  error(500, 'INTERNAL_ERROR', message);

/** Parse and validate a JSON body; throws an ApiError-mapped error on failure. */
export const parseBody = <T>(schema: ZodSchema<T>, body: string | null | undefined): T => {
  if (!body) throw new BadRequestError('Request body is required');
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new BadRequestError('Request body is not valid JSON');
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new BadRequestError('Request body failed validation', result.error.flatten());
  }
  return result.data;
};

/** Custom error type so handlers can throw and let `withErrorHandling` map it. */
export class BadRequestError extends Error {
  public readonly details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'BadRequestError';
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * Wraps an API Gateway handler with consistent error mapping + logging.
 * Domain errors -> 4xx; everything else -> 500 with the stack hidden.
 */
export const withErrorHandling = <TEvent>(
  handler: (event: TEvent) => Promise<APIGatewayProxyResultV2>,
): ((event: TEvent) => Promise<APIGatewayProxyResultV2>) => {
  return async (event) => {
    try {
      return await handler(event);
    } catch (err) {
      if (err instanceof BadRequestError) {
        return badRequest(err.message, err.details);
      }
      if (err instanceof NotFoundError) {
        return notFound(err.message);
      }
      if (err instanceof ConflictError) {
        return conflict(err.message);
      }
      if (err instanceof ZodError) {
        return badRequest('Validation failed', err.flatten());
      }
      logger.error('unhandled error in API handler', { err });
      return internalError();
    }
  };
};
