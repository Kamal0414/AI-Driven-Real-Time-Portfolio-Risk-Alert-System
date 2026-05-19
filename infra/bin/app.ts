#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { getConfig } from '../lib/config/env';
import { DataStack } from '../lib/stacks/data-stack';
import { EventsStack } from '../lib/stacks/events-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { PortfolioStack } from '../lib/stacks/portfolio-stack';
import { MarketDataStack } from '../lib/stacks/market-data-stack';
import { RiskStack } from '../lib/stacks/risk-stack';
import { AiInsightStack } from '../lib/stacks/ai-insight-stack';

const app = new cdk.App();
const config = getConfig();

const env: cdk.Environment = {
  region: config.region,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

// --- Foundation stacks (no Lambda dependencies) ---

const dataStack = new DataStack(app, `${config.prefix}-data`, {
  env,
  config,
});

const eventsStack = new EventsStack(app, `${config.prefix}-events`, {
  env,
  config,
});

// --- Service stacks (Lambdas only — no API routes) ---

const portfolioStack = new PortfolioStack(app, `${config.prefix}-portfolio`, {
  env,
  config,
  portfoliosTable: dataStack.portfoliosTable,
  eventBus: eventsStack.eventBus,
});
portfolioStack.addDependency(dataStack);
portfolioStack.addDependency(eventsStack);

const marketDataStack = new MarketDataStack(app, `${config.prefix}-market-data`, {
  env,
  config,
  pricesTable: dataStack.pricesTable,
  eventBus: eventsStack.eventBus,
});
marketDataStack.addDependency(dataStack);
marketDataStack.addDependency(eventsStack);

const riskStack = new RiskStack(app, `${config.prefix}-risk`, {
  env,
  config,
  portfoliosTable: dataStack.portfoliosTable,
  pricesTable: dataStack.pricesTable,
  valuationsTable: dataStack.valuationsTable,
  alertsTable: dataStack.alertsTable,
  eventBus: eventsStack.eventBus,
});
riskStack.addDependency(dataStack);
riskStack.addDependency(eventsStack);

const aiInsightStack = new AiInsightStack(app, `${config.prefix}-ai-insight`, {
  env,
  config,
  insightsTable: dataStack.insightsTable,
  alertsTable: dataStack.alertsTable,
  eventBus: eventsStack.eventBus,
  aiQueue: eventsStack.aiQueue,
});
aiInsightStack.addDependency(dataStack);
aiInsightStack.addDependency(eventsStack);

// --- API stack (depends on service stacks for Lambda refs) ---

const apiStack = new ApiStack(app, `${config.prefix}-api`, {
  env,
  config,
  listPortfoliosFn: portfolioStack.listPortfoliosFn,
  getPortfolioFn: portfolioStack.getPortfolioFn,
  createPortfolioFn: portfolioStack.createPortfolioFn,
  updateHoldingsFn: portfolioStack.updateHoldingsFn,
  getInsightsFn: aiInsightStack.getInsightsFn,
  getLatestInsightsFn: aiInsightStack.getLatestInsightsFn,
  getPricesFn: marketDataStack.getPricesFn,
  listValuationsFn: riskStack.listValuationsFn,
  getValuationFn: riskStack.getValuationFn,
});
apiStack.addDependency(portfolioStack);
apiStack.addDependency(aiInsightStack);
apiStack.addDependency(marketDataStack);
apiStack.addDependency(riskStack);

app.synth();
