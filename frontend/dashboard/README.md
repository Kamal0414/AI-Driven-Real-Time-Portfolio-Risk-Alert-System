# Portfolio Risk Dashboard

React + Vite + TypeScript dashboard for the AI-Driven Real-Time Portfolio Risk Alert System.

## Features

- **Portfolio list** — all 100 client portfolios at a glance with risk badges
- **Portfolio detail** — holdings, target allocations, latest AI commentary
- **Live AI alerts feed** — most recent risk insights across all portfolios
- **Color-coded severity** — LOW (green), MEDIUM (amber), HIGH (red)
- **Live polling** — auto-refresh every 5 seconds
- **Graceful error / loading / empty states**

## Local development

```bash
# 1. Install dependencies (run once at the repo root)
cd ../..
npm install

# 2. Configure API URL
cd frontend/dashboard
cp .env.example .env.local
# edit .env.local and set VITE_API_URL to your deployed API Gateway URL

# 3. Start the dev server
npm run dev -w @prr/dashboard
```

Then open http://localhost:5173

## Build for deployment

```bash
npm run build -w @prr/dashboard
```

Outputs static assets to `frontend/dashboard/dist/`. Upload to an S3 bucket
fronted by CloudFront for production hosting (free-tier friendly).

## Type checking

```bash
npm run typecheck -w @prr/dashboard
```

## Configuration

Environment variables (loaded from `.env.local` at build/dev time):

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | Base URL for the backend HTTP API | `http://localhost:3000` |

## Architecture

```
src/
├── api/client.ts           Typed fetch wrapper with consistent error handling
├── hooks/usePolling.ts     Generic polling hook (no overlapping requests)
├── components/
│   ├── RiskBadge.tsx       Color-coded severity badge
│   ├── AlertCard.tsx       Individual AI insight display
│   ├── InsightPanel.tsx    List of insights with loading/error/empty states
│   └── LiveIndicator.tsx   Pulsing dot showing live polling
├── pages/
│   ├── PortfolioListPage.tsx     Landing page (grid + global feed)
│   └── PortfolioDetailPage.tsx   Single portfolio view
├── styles/index.css        Dark theme, dependency-free
├── types.ts                Frontend-local domain types
├── utils/format.ts         Currency/percent/relative time helpers
├── App.tsx                 Root + tiny in-memory routing
└── main.tsx                React entry point
```

The frontend is intentionally **decoupled from `@prr/shared`** — it defines
its own domain types so the bundle stays lean and the build is independent
from the backend service builds.
