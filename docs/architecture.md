# Architecture

## High-Level Diagram

```
                                +--------------------------------+
                                |         React Dashboard        |
                                |   (Vite + React 18 + Polling)  |
                                +-----------+--------------------+
                                            | REST + 5s polling
                                            v
                              +--------------------------+
                              |    Amazon API Gateway    |
                              |     (HTTP API v2)        |
                              +-----+-------------+------+
                                    |             |
                        +-----------v---+    +----v-------------+
                        | Portfolio Svc |    | Insights Read API|
                        | (4 Lambdas)   |    | (2 Lambdas)      |
                        +--+----------+-+    +-------+----------+
                           |          |              |
                           | writes   | publishes    | reads
                           v          v              v
                  +-------------+  +--------------------------+
                  | DynamoDB    |  |  Amazon EventBridge Bus  |
                  | Portfolios  |  |   (portfolio-risk-bus)   |
                  +-------------+  +--+---------+---------+---+
                                      |         |         |
                          PriceUpdated| Portfolio Risk    |AIInsight
                                      | Updated  Breach   |Generated
                                      v         v         v
   +------------------+    +------------------+    +---------+
   | Market Data Svc  |    |   Risk Service   |    | SQS     |
   | (Scheduler 7s)   |--->|   (2 Lambdas)    |--->| ai-queue|
   +--------+---------+    +--------+---------+    +----+----+
            | writes                | writes            |
            v                       v                   v
   +-----------------+    +-----------------+  +------------------+
   | DynamoDB Prices |    | DynamoDB        |  | AI Insight Svc   |
   | (latest price)  |    | Valuations,     |  | (Lambda + LLM)   |
   +-----------------+    | Alerts          |  +--------+---------+
                          +-----------------+           |
                                                        v
                                                +-----------------+
                                                | DynamoDB        |
                                                | Insights        |
                                                +-----------------+
```

## Microservices

| Service | Responsibility | Trigger | Outputs |
|---------|---------------|---------|---------|
| **Portfolio Service** | CRUD client portfolios, allocation breakdown | API Gateway HTTP | DynamoDB writes, PortfolioUpdated event |
| **Market Data Service** | Simulate live equity prices | EventBridge Scheduler (7s) | DynamoDB writes, PriceUpdated event |
| **Risk Service** | Compute valuations, detect breaches | EventBridge (PriceUpdated, PortfolioUpdated) | DynamoDB writes, RiskThresholdBreached event |
| **AI Insight Service** | LLM commentary on breaches | SQS (consumes RiskThresholdBreached) | DynamoDB writes, AIInsightGenerated event |

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Compute** | AWS Lambda (Node 20, ARM64, ESM) | Free Tier, auto-scaling, no idle cost |
| **Pub/Sub** | Amazon EventBridge | Native rule-based routing, schema-aware |
| **Buffer** | Amazon SQS (only in front of AI) | Backpressure for slow LLM calls, DLQ for failures |
| **State** | Amazon DynamoDB (on-demand) | 25 GB free, single-digit ms latency |
| **API** | API Gateway HTTP API | $1/M requests, 1M free for 12 months |
| **IaC** | AWS CDK (TypeScript) | Type-safe infrastructure, easy teardown |
| **Frontend** | React 18 + Vite + TS | Fast dev loop, tiny bundle, zero runtime deps |
| **AI** | Pluggable provider interface (mock default) | Bedrock/OpenAI/Gemini swappable via env var |

## Risk Rules Engine

Three deterministic rules run on every revaluation:

1. **Allocation Drift** - `|actualWeight - targetWeight| > 5%`
2. **Single Stock Exposure** - `weight > 20%`
3. **Daily Portfolio Drop** - `dayChangePct < -3%`

Each rule independently classifies severity:

| Rule | LOW | MEDIUM | HIGH |
|------|-----|--------|------|
| Allocation Drift | 5-8% | 8-12% | >12% |
| Single Stock | 20-25% | 25-35% | >35% |
| Daily Drop | 3-5% | 5-8% | >8% |

The LLM **never** performs financial calculations - it only converts
deterministic breach data into human-readable commentary.

## Data Model

| Table | PK | SK | TTL | GSI |
|-------|-----|-----|-----|-----|
| `prr-portfolios` | portfolioId | - | - | clientId-index |
| `prr-prices` | symbol | - | - | - |
| `prr-valuations` | portfolioId | asOf | 24h | - |
| `prr-alerts` | portfolioId | breachKey | 7d | - |
| `prr-insights` | portfolioId | generatedAt | 7d | - |

## Stack Dependencies

```
DataStack -----+
               |
EventsStack ---+--> PortfolioStack ---> ApiStack
               +--> MarketDataStack
               +--> RiskStack
               +--> AiInsightStack ---> ApiStack
ApiStack
```

CDK enforces this dependency order; `cdk deploy --all` deploys them in sequence.

## Architectural Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| EventBridge over SNS | + Filtering and schema awareness, - Slightly higher latency |
| SQS only for AI path | + Hot path stays fast, - Extra hop for AI |
| Polling instead of WebSockets | + Simpler MVP, - Higher API request count |
| Single-table-per-concern | + Easier to reason about, - Less elegant queries |
| Mock LLM by default | + Zero cost, deterministic, - Same output every time |
| All 100 portfolios per tick | + Simple O(n*m), - Slow at 10k+ portfolios (would shard) |

## Scaling Strategy

The current architecture scales to roughly **1,000 portfolios** without changes.
Beyond that:

1. **Risk Lambda fan-out**: Replace single Lambda with SNS fan-out -> N Lambdas, each handling a portfolioId range
2. **DynamoDB GSI**: Add `lastEvaluated-index` so Risk can query stale portfolios only
3. **EventBridge Pipes**: Replace single PriceUpdated with per-symbol events for fine-grained subscribers
4. **Multi-region**: Replicate DynamoDB tables (Global Tables) for read locality
5. **WebSockets**: Replace polling with API Gateway WebSocket API for sub-second UI updates

## Security

- **IAM least-privilege** - every Lambda has only the table actions it needs
- **No hard-coded secrets** - LLM API keys come from SSM Parameter Store
- **Environment variables** - config separated from code
- **CORS** - wide open for MVP (`*`); tighten to CloudFront origin in production
- **No public DB access** - all DynamoDB I/O via Lambda-attached IAM roles

## Observability

- **Structured JSON logs** - every Lambda logs in CloudWatch Logs Insights queryable format
- **Correlation IDs** - propagate end-to-end across all 4 services
- **Metrics** - duration, breach count, fallback rate logged in INFO lines
- **Log retention** - 1 week (Free Tier friendly, plenty for demo)
