import { v4 as uuid } from 'uuid';
import {
  publishEvent,
  createLogger,
  EVENT_SOURCE,
  EVENT_TYPE,
  PortfolioSchema,
  NotFoundError,
  ConflictError,
} from '@prr/shared';
import type { Portfolio, Holding, TargetAllocation, PortfolioUpdatedData } from '@prr/shared';
import * as repo from '../repo/portfolio.repo.js';

const log = createLogger({ service: 'portfolio-service' });

/**
 * Portfolio Domain Service — orchestrates validation, persistence, and event publishing.
 *
 * The thin layer between Lambda handlers and the repo/event system.
 * Handlers call these functions; this service decides what to persist and emit.
 */

export interface CreatePortfolioInput {
  clientId: string;
  name: string;
  holdings: Holding[];
  targetAllocation: TargetAllocation[];
  cash?: number;
}

export interface UpdateHoldingsInput {
  holdings: Holding[];
  targetAllocation: TargetAllocation[];
  cash?: number;
}

/** Create a new portfolio, persist to DynamoDB, and emit PortfolioUpdated. */
export const create = async (input: CreatePortfolioInput): Promise<Portfolio> => {
  const now = new Date().toISOString();
  const portfolio: Portfolio = {
    portfolioId: `p-${uuid().slice(0, 8)}`,
    clientId: input.clientId,
    name: input.name,
    cash: input.cash ?? 0,
    holdings: input.holdings,
    targetAllocation: input.targetAllocation,
    createdAt: now,
    updatedAt: now,
  };

  // Validate with Zod (catches weight sum != 1, etc.)
  PortfolioSchema.parse(portfolio);

  try {
    await repo.createPortfolio(portfolio);
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      throw new ConflictError(`Portfolio ${portfolio.portfolioId} already exists`);
    }
    throw err;
  }

  log.info('portfolio created', { portfolioId: portfolio.portfolioId, clientId: portfolio.clientId });

  // Emit event (fire-and-forget — don't fail the API call if EventBridge is slow)
  await emitPortfolioUpdated(portfolio, 'CREATED');

  return portfolio;
};

/** Get a single portfolio by ID. Throws NotFoundError if missing. */
export const getById = async (portfolioId: string): Promise<Portfolio> => {
  const portfolio = await repo.getPortfolioById(portfolioId);
  if (!portfolio) {
    throw new NotFoundError(`Portfolio ${portfolioId} not found`);
  }
  return portfolio;
};

/** List all portfolios. */
export const listAll = async (): Promise<Portfolio[]> => {
  return repo.listAllPortfolios();
};

/** Update holdings + target allocation, persist, emit event. */
export const updateHoldings = async (
  portfolioId: string,
  input: UpdateHoldingsInput,
): Promise<Portfolio> => {
  // Validate target allocation weights sum to 1
  const weightSum = input.targetAllocation.reduce((s, a) => s + a.weight, 0);
  if (Math.abs(weightSum - 1) > 1e-6) {
    throw new Error(`targetAllocation weights must sum to 1.0 (got ${weightSum.toFixed(6)})`);
  }

  const updated = await repo.updatePortfolioHoldings(
    portfolioId,
    input.holdings,
    input.targetAllocation,
    input.cash ?? 0,
  );

  if (!updated) {
    throw new NotFoundError(`Portfolio ${portfolioId} not found`);
  }

  log.info('portfolio holdings updated', { portfolioId });

  await emitPortfolioUpdated(updated, 'UPDATED');

  return updated;
};

/** Publish a PortfolioUpdated event to EventBridge. */
const emitPortfolioUpdated = async (
  portfolio: Portfolio,
  changeType: 'CREATED' | 'UPDATED' | 'DELETED',
): Promise<void> => {
  try {
    const data: PortfolioUpdatedData = {
      portfolioId: portfolio.portfolioId,
      clientId: portfolio.clientId,
      changeType,
      holdings: portfolio.holdings,
      targetAllocation: portfolio.targetAllocation,
      cash: portfolio.cash,
    };

    const envelope = await publishEvent({
      eventType: EVENT_TYPE.PORTFOLIO_UPDATED,
      source: EVENT_SOURCE.PORTFOLIO,
      data,
    });

    log.info('PortfolioUpdated event published', {
      eventId: envelope.eventId,
      portfolioId: portfolio.portfolioId,
      changeType,
    });
  } catch (err) {
    // Log but don't fail the API call — the portfolio is already persisted.
    // A reconciliation process or retry can pick this up later.
    log.error('Failed to publish PortfolioUpdated event', { err, portfolioId: portfolio.portfolioId });
  }
};
