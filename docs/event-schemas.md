# Event Schemas (v1.0)

All events use a common envelope and are published to the
`portfolio-risk-bus` EventBridge bus.

## Common Envelope

Every event payload follows this contract:

```json
{
  "schemaVersion": "1.0",
  "eventId": "uuid",
  "eventType": "PriceUpdated | PortfolioUpdated | PortfolioRevalued | RiskThresholdBreached | AIInsightGenerated",
  "occurredAt": "ISO 8601 UTC timestamp",
  "correlationId": "uuid (propagates end-to-end)",
  "sourceService": "prr.market-data-service | prr.portfolio-service | prr.risk-service | prr.ai-insight-service",
  "data": { }
}
```

The Zod schemas live in `packages/shared/src/events/` and are validated
at both publish and consume time.

## 1. PriceUpdated

**Source:** `prr.market-data-service`
**Published every:** 7 seconds (EventBridge Scheduler)
**Consumed by:** Risk Service

```json
{
  "schemaVersion": "1.0",
  "eventType": "PriceUpdated",
  "data": {
    "prices": [
      {
        "symbol": "AAPL",
        "price": 187.42,
        "previousClose": 185.10,
        "asOf": "2026-05-18T10:00:00.000Z"
      }
    ]
  }
}
```

## 2. PortfolioUpdated

**Source:** `prr.portfolio-service`
**Published when:** A portfolio is created or holdings/allocation change
**Consumed by:** Risk Service

```json
{
  "schemaVersion": "1.0",
  "eventType": "PortfolioUpdated",
  "data": {
    "portfolioId": "p-0001",
    "clientId": "c-0001",
    "changeType": "CREATED | UPDATED | DELETED",
    "holdings": [{ "symbol": "AAPL", "quantity": 50 }],
    "targetAllocation": [{ "symbol": "AAPL", "weight": 0.10 }],
    "cash": 1000
  }
}
```

## 3. PortfolioRevalued (internal/optional)

**Source:** `prr.risk-service`
**Published when:** Each tick (currently disabled, reserved for future analytics)

```json
{
  "schemaVersion": "1.0",
  "eventType": "PortfolioRevalued",
  "data": {
    "portfolioId": "p-0001",
    "clientId": "c-0001",
    "totalValue": 152340.55,
    "cash": 1000,
    "asOf": "2026-05-18T10:00:00Z",
    "allocations": [
      {
        "symbol": "AAPL",
        "quantity": 50,
        "price": 187.42,
        "value": 9371.00,
        "weight": 0.0615,
        "targetWeight": 0.10,
        "drift": -0.0385
      }
    ],
    "dayChangePct": -0.012,
    "previousCloseValue": 154184.40
  }
}
```

## 4. RiskThresholdBreached

**Source:** `prr.risk-service`
**Published when:** A breach is detected (idempotent - once per minute per breach)
**Consumed by:** AI Insight Service (via SQS)

```json
{
  "schemaVersion": "1.0",
  "eventType": "RiskThresholdBreached",
  "data": {
    "portfolioId": "p-0001",
    "clientId": "c-0001",
    "breaches": [
      {
        "type": "ALLOCATION_DRIFT | SINGLE_STOCK_EXPOSURE | DAILY_PORTFOLIO_DROP",
        "severity": "LOW | MEDIUM | HIGH",
        "metrics": {
          "symbol": "AAPL",
          "actualValue": 0.235,
          "targetValue": 0.20,
          "deviation": 0.035
        },
        "thresholdRule": "single_stock>20%",
        "message": "AAPL is 23.5% of portfolio, exceeding 20% limit by 3.5%"
      }
    ],
    "overallSeverity": "MEDIUM",
    "portfolioValue": 152340.55,
    "asOf": "2026-05-18T10:00:00.000Z"
  }
}
```

## 5. AIInsightGenerated

**Source:** `prr.ai-insight-service`
**Published when:** AI commentary is generated (or fallback used)
**Consumed by:** Future notification service / dashboard websockets

```json
{
  "schemaVersion": "1.0",
  "eventType": "AIInsightGenerated",
  "data": {
    "portfolioId": "p-0001",
    "generatedAt": "2026-05-18T10:00:01.234Z",
    "generatedBy": "mock | openai | gemini | bedrock",
    "modelVersion": "mock-v1",
    "fallback": false,
    "headline": "Concentration risk in AAPL",
    "explanation": "Recent appreciation pushed AAPL to 23.5% of the portfolio...",
    "suggestedAction": "Consider trimming AAPL by ~3.5 percentage points...",
    "severity": "MEDIUM",
    "disclaimer": "This is informational and not financial advice."
  }
}
```

## Versioning

Schema version is `1.0`. Breaking changes will bump to `2.0` and run
both versions in parallel during rollout. Consumers ignore unknown event
types and log a warning.
