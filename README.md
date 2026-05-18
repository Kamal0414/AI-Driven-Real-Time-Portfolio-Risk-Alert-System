# AI-Driven Real-Time Portfolio Risk Alert System

A simplified portfolio risk intelligence platform built as an event-driven, AWS-native MVP.

## What It Does

- Tracks **100 client portfolios** in near real-time
- Simulates **20 equity prices** updated every 7 seconds
- Detects **3 risk breach types** with deterministic rules:
  - Allocation drift > 5% from target
  - Single stock exposure > 20%
  - Daily portfolio drop > 3%
- Generates **AI-backed commentary** for every breach (LLM provider-agnostic)
- Surfaces alerts on a **live React dashboard**

## Architecture

```
React Dashboard (Vite + TS)
   v REST polling
API Gateway HTTP API
   v
4 Microservices (Lambda, Node 20, ARM64)
   |- Portfolio Service       - CRUD + REST API
   |- Market Data Service     - Bounded random walk simulator (7s ticks)
   |- Risk Service            - Valuation engine + 3 deterministic rules
   |- AI Insight Service      - LLM commentary (mock | openai | gemini | bedrock)
   v
EventBridge Bus (pub/sub) + SQS (AI buffer with DLQ)
   v
DynamoDB (5 tables, on-demand, with TTL)
```

See [docs/architecture.md](docs/architecture.md) for the full diagram, decisions, and tradeoffs.

## Repository Structure

```
.
|- packages/shared/         @prr/shared - event schemas, types, utilities (Zod-validated)
|- services/
|  |- portfolio-service/    CRUD client portfolios + PortfolioUpdated event
|  |- market-data-service/  Price simulation + PriceUpdated event
|  |- risk-service/         Valuation engine + breach detection rules
|  |- ai-insight-service/   LLM commentary generation
|- infra/                   AWS CDK (TypeScript) - 7 stacks
|- frontend/dashboard/      React 18 + Vite + TS dashboard
|- docs/                    architecture, event flow, schemas, deployment
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Type-check + test everything
npm run typecheck
npm test -w @prr/shared

# 3. Deploy to AWS (see docs/deployment.md for prerequisites)
cd infra
npx cdk bootstrap   # one-time per AWS account/region
npx cdk deploy --all --require-approval never

# 4. Seed 100 demo portfolios
npm run seed -w @prr/portfolio-service

# 5. Run the dashboard locally
cd frontend/dashboard
cp .env.example .env.local
# edit .env.local with the deployed API URL (from CDK output)
npm run dev
```

For first-time AWS users, **see [docs/deployment.md](docs/deployment.md)** - it covers AWS CLI setup, IAM credentials, and CDK bootstrap step-by-step.

## Design Decisions

### 1. Rule + AI Hybrid (not pure-AI)

**Risk detection is deterministic.** The LLM never performs financial calculations.
It only converts already-detected breaches into human-readable commentary.

- Reproducible - same breach data always triggers the same alert
- Auditable - rules are 30 lines of pure TS, easy to review
- Fast - no LLM latency on the hot path
- Safe - AI cannot hallucinate financial numbers

### 2. EventBridge over SNS

EventBridge gives schema-aware filtering, multi-target routing, and a
schema registry for forward compatibility. SNS would be cheaper but
forces all consumers to receive every message and filter client-side.

### 3. SQS only in front of AI Lambda

The hot path (Market -> Risk) uses direct EventBridge -> Lambda for
low latency. SQS sits only in front of the AI Lambda where slow LLM
calls and retry semantics matter. DLQ catches poisonous messages.

### 4. Frontend decoupled from `@prr/shared`

The React app defines its own local types instead of importing the
shared backend package. Keeps the bundle lean and avoids module
resolution conflicts between Vite (Bundler) and Node (NodeNext).

### 5. Idempotent alerts via minute buckets

`buildBreachKey(type, symbol, minuteBucket)` ensures that a burst of
price ticks during a volatile minute collapses into one logical alert.
Without this, a 30-second sell-off would trigger ~4 AI Lambda invocations
for the same breach. With it: exactly 1.

### 6. Mock LLM by default

`LLM_PROVIDER=mock` produces realistic, contextual commentary in <100ms
at zero cost. Real providers (OpenAI, Bedrock, Gemini) plug into the
same interface - flip one env var.

## AI Prompt Approach

The AI Insight Service builds prompts in two parts:

1. **System prompt** - defines output schema (JSON), forbids financial
   guarantees, requires advisory disclaimers, sets the analyst persona
2. **User prompt** - structured breach metadata (no free-form text from
   user input)

Output is parsed and **validated with Zod** against the same schema used
in `AIInsightGenerated` events. If validation fails or the LLM call
errors out, a deterministic fallback is generated and persisted with
`fallback: true` so dashboards can label it accordingly.

The system **never stops working** because of AI failure.

## Scaling Strategy

The current design comfortably handles **1,000 portfolios**. Beyond that:

| Bottleneck | Mitigation |
|------------|------------|
| Risk Lambda processes all portfolios per tick | Shard by `portfolioId` range across N parallel Lambdas |
| DynamoDB Scan on every tick | Add `GSI` on `lastEvaluatedAt` and query stale only |
| Single PriceUpdated event for 20 symbols | Split into per-symbol events; subscribers filter |
| Polling-based dashboard | Switch to API Gateway WebSocket API |
| Single region | Add Global Tables for read locality |

## Event Schemas

All 5 events use a versioned envelope with `schemaVersion`, `eventId`,
`correlationId`, `occurredAt`, `sourceService`, and `eventType`.

See [docs/event-schemas.md](docs/event-schemas.md) for the full schema definitions.

## Cost (Monthly, Free Tier)

Running 24/7 with default 7-second tick: **~$1-3/month**.
Disable the Scheduler between demos to drop to **$0**.

| Service | Cost |
|---------|------|
| Lambda | $0 (free tier) |
| EventBridge | <$1 |
| DynamoDB on-demand | $1-3 |
| API Gateway HTTP API | $0 (free tier) |
| CloudWatch | $0 (1-week retention) |
| LLM (default mock) | $0 |

## Documentation

- [docs/architecture.md](docs/architecture.md) - System architecture, components, decisions
- [docs/event-flow.md](docs/event-flow.md) - End-to-end event sequence + correlation IDs
- [docs/event-schemas.md](docs/event-schemas.md) - Full JSON schemas for all 5 events
- [docs/deployment.md](docs/deployment.md) - Step-by-step AWS deployment for first-time users
- [frontend/dashboard/README.md](frontend/dashboard/README.md) - Dashboard architecture + dev setup

## Status

MVP complete. All deliverables ready:
- Architecture diagram (docs/architecture.md)
- Source code (this repo)
- Event schema definitions (docs/event-schemas.md)
- README with design decisions, tradeoffs, scaling strategy, AI prompt approach (this file)
- Deployment guide (docs/deployment.md)

Ready for demo and submission.
