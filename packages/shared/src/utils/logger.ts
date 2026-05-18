/**
 * Minimal zero-dependency structured JSON logger.
 *
 * Why not pino/winston? Lambda already streams stdout to CloudWatch;
 * a 60-line logger keeps cold starts tiny and bundles small.
 *
 * Each log line is a single JSON object so CloudWatch Logs Insights can
 * query on any field (e.g. `fields @timestamp, level, msg, correlationId`).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const envLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as LogLevel;
const MIN_LEVEL = LEVEL_RANK[envLevel] ?? LEVEL_RANK.info;

export interface LogContext {
  service?: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug: (msg: string, fields?: Record<string, unknown>) => void;
  info: (msg: string, fields?: Record<string, unknown>) => void;
  warn: (msg: string, fields?: Record<string, unknown>) => void;
  error: (msg: string, fields?: Record<string, unknown>) => void;
  child: (extra: LogContext) => Logger;
}

const safeJsonStringify = (obj: unknown): string => {
  try {
    return JSON.stringify(obj);
  } catch {
    return JSON.stringify({ msg: '[unserializable log payload]' });
  }
};

const serializeError = (e: unknown): Record<string, unknown> => {
  if (e instanceof Error) {
    return { name: e.name, message: e.message, stack: e.stack };
  }
  return { value: String(e) };
};

const write = (level: LogLevel, base: LogContext, msg: string, fields?: Record<string, unknown>): void => {
  if (LEVEL_RANK[level] < MIN_LEVEL) return;

  const enriched = fields
    ? Object.fromEntries(
        Object.entries(fields).map(([k, v]) =>
          v instanceof Error ? [k, serializeError(v)] : [k, v],
        ),
      )
    : {};

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    msg,
    ...base,
    ...enriched,
  };

  // stdout for info/debug, stderr for warn/error -> nicer in CloudWatch.
  const line = safeJsonStringify(payload);
  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
};

export const createLogger = (context: LogContext = {}): Logger => {
  const base: LogContext = { ...context };
  return {
    debug: (msg, fields) => write('debug', base, msg, fields),
    info: (msg, fields) => write('info', base, msg, fields),
    warn: (msg, fields) => write('warn', base, msg, fields),
    error: (msg, fields) => write('error', base, msg, fields),
    child: (extra) => createLogger({ ...base, ...extra }),
  };
};

/** Default logger instance — services typically create their own with `service`. */
export const logger = createLogger();
