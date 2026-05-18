# Event Flow

## End-to-End Sequence

```
+------------------------------------------------------------------+
| 1. EventBridge Scheduler fires every 7 seconds                   |
|    -> Invokes prr-market-tick Lambda                             |
+------------------------------------------------------------------+
                              v
+------------------------------------------------------------------+
| 2. Market Data Lambda                                            |
|    - Loads previous 20 prices from DynamoDB.Prices               |
|    - Applies bounded random walk (Box-Muller, +/-1.5%)           |
|    - BatchWrites all 20 new prices                               |
|    - Publishes PriceUpdated event with all 20 prices             |
+------------------------------------------------------------------+
                              v
+------------------------------------------------------------------+
| 3. EventBridge routes by source + detailType                     |
|    Rule: prr-price-to-risk                                       |
|    -> Invokes prr-risk-on-price Lambda                           |
+------------------------------------------------------------------+
                              v
+------------------------------------------------------------------+
| 4. Risk Service Lambda                                           |
|    - Extracts prices from event payload                          |
|    - Loads all 100 portfolios (DynamoDB Scan)                    |
|    - For each portfolio:                                         |
|        - computeValuation(portfolio, priceMap)                   |
|        - evaluateRules(valuation):                               |
|            - checkAllocationDrift > 5%?                          |
|            - checkSingleStockExposure > 20%?                     |
|            - checkDailyDrop > 3%?                                |
|        - If new breaches:                                        |
|            - Save Alert (idempotent: portfolioId#breachKey)      |
|            - Publish RiskThresholdBreached event                 |
|    - Save Valuation snapshot (TTL 24h)                           |
+------------------------------------------------------------------+
                              v
+------------------------------------------------------------------+
| 5. EventBridge routes RiskThresholdBreached                      |
|    Rule: prr-risk-breach-to-ai                                   |
|    -> Sends to SQS queue: prr-ai-insight-queue                   |
+------------------------------------------------------------------+
                              v
+------------------------------------------------------------------+
| 6. AI Insight Lambda (SQS-triggered, batch size 1)               |
|    - Builds prompt from breach data                              |
|    - Calls LLM provider (mock by default)                        |
|    - Validates JSON output with Zod schema                       |
|    - If invalid -> uses deterministic fallback                   |
|    - Saves Insight to DynamoDB.Insights (TTL 7d)                 |
|    - Publishes AIInsightGenerated event                          |
|    - On 3 failures -> message moves to DLQ                       |
+------------------------------------------------------------------+
                              v
+------------------------------------------------------------------+
| 7. Dashboard polls every 5 seconds                               |
|    - GET /portfolios -> list of 100 clients                      |
|    - GET /insights/latest -> latest 20 AI alerts                 |
|    - GET /portfolios/{id} -> drill-down                          |
|    - GET /portfolios/{id}/insights -> portfolio-specific feed    |
+------------------------------------------------------------------+
```

## Correlation IDs

Every event carries a `correlationId` that propagates through the entire flow:

```
PriceUpdated (corr=A1B2)
  -> RiskThresholdBreached (corr=A1B2)
    -> AIInsightGenerated (corr=A1B2)
```

This means you can run a single CloudWatch Logs Insights query and trace
one business event end-to-end across all 4 services.

## Idempotency

The Risk Service uses `buildBreachKey(type, symbol, minuteBucket)` to
create idempotent alert keys. A burst of price ticks during a volatile
minute cannot fire multiple alerts for the same breach - only the first
write succeeds (DynamoDB conditional put), subsequent writes are no-ops.

This prevents the AI Lambda from being invoked 60x/minute during a
market move, controlling cost.
