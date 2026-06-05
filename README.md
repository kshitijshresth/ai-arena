![TradeLLM · The Arena](/public/trader.gif)

# TradeLLM · The Arena

Terminal where 10 LLMs trade on real time prices.

## Arena Setup

### Required Environment Variables

| Variable | Where to get it |
|----------|----------------|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys |
| `NVIDIA_NIM_API_KEY` | [build.nvidia.com](https://build.nvidia.com) → Get API Key |
| `FINNHUB_API_KEY` | [finnhub.io](https://finnhub.io) → Register → API Key |
| `MONGODB_URI` | [MongoDB Atlas](https://mongodb.com/atlas) → Create free cluster → Connect → Drivers → Node.js |
| `MONGODB_DB` | Database name, e.g. `arena` |
| `ARENA_SECRET` | Any random string you generate; protects admin routes |
| `CRON_SECRET` | Vercel dashboard → Project Settings → Environment Variables (Vercel sets this automatically for cron jobs) |

### Setup Steps

1. `npm install`
2. Create a free MongoDB Atlas cluster, whitelist your IP, and copy the connection string to `MONGODB_URI` in `.env.local`
3. Set `MONGODB_DB=arena` (or any database name) in `.env.local`
4. Fill all remaining env vars in `.env.local`
5. `npm run dev`

### Initialize the Arena (first time only)

```bash
curl -X POST http://localhost:3000/api/arena/initialize \
  -H "x-arena-secret: YOUR_ARENA_SECRET"
```

### Manually Trigger Jobs

**Market update:**
```bash
curl -X POST http://localhost:3000/api/arena/run-market-update \
  -H "x-arena-secret: YOUR_ARENA_SECRET"
```

**One full trading cycle (all models):**
```bash
curl -X POST http://localhost:3000/api/arena/run-cycle \
  -H "x-arena-secret: YOUR_ARENA_SECRET"
```

**Scoring update:**
```bash
curl -X POST http://localhost:3000/api/arena/run-scoring \
  -H "x-arena-secret: YOUR_ARENA_SECRET"
```

**Run a single model only:**
```bash
curl -X POST http://localhost:3000/api/arena/run-cycle \
  -H "x-arena-secret: YOUR_ARENA_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"modelId":"groq-llama-3.3-70b"}'
```

### In Production (Vercel)

- All cron jobs run automatically per `vercel.json` schedule
- Ensure all env vars are set in the Vercel dashboard
- Deploy: `git push` (Vercel auto-deploys)
