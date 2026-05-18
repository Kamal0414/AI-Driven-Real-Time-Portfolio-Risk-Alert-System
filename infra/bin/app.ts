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

// --- Foundation stacks ---

const dataStack = new DataStack(app, `${config.prefix}-data`, {
  env,
  config,
});

const eventsStack = new EventsStack(app, `${config.prefix}-events`, {
  env,
  config,
});

const apiStack = new ApiStack(app, `${config.prefix}-api`, {
  env,
  config,
});

// --- Service stacks (depend on foundation) ---

const portfolioStack = new PortfolioStack(app, `${config.prefix}-portfolio`, {
  env,
  config,
  portfoliosTable: dataStack.portfoliosTable,
  eventBus: eventsStack.eventBus,
  httpApi: apiStack.httpApi,
});
portfolioStack.addDependency(dataStack);
portfolioStack.addDependency(eventsStack);
portfolioStack.addDependency(apiStack);

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
  httpApi: apiStack.httpApi,
});
aiInsightStack.addDependency(dataStack);
aiInsightStack.addDependency(eventsStack);
aiInsightStack.addDependency(apiStack);

app.synth();
