import axios from "axios";
import type { ArenaMarketSnapshot, ArenaAssetPrice, ArenaMacroIndicator } from "../types";
import { getMarketSnapshot, setMarketSnapshot } from "./kv";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const FINNHUB_KEY = process.env.FINNHUB_API_KEY ?? "";

if (!FINNHUB_KEY) {
  console.warn("[marketData] FINNHUB_API_KEY is not set. All live market fetches will fail.");
}

// ── Fallback snapshot (timestamp refreshed at return time) ───────────────

function makeFallbackSnapshot(): ArenaMarketSnapshot {
  return {
    timestamp: new Date().toISOString(),
    assets: [
      { symbol: "SPY", name: "SPDR S&P 500", price: 595.42, change24h: 1.85, changePercent24h: 0.31, assetClass: "stock" },
      { symbol: "AAPL", name: "Apple Inc", price: 233.85, change24h: 2.12, changePercent24h: 0.92, assetClass: "stock" },
      { symbol: "MSFT", name: "Microsoft Corp", price: 445.20, change24h: -1.85, changePercent24h: -0.41, assetClass: "stock" },
      { symbol: "NVDA", name: "NVIDIA Corp", price: 132.78, change24h: 3.45, changePercent24h: 2.67, assetClass: "stock" },
      { symbol: "TSLA", name: "Tesla Inc", price: 335.50, change24h: -4.20, changePercent24h: -1.24, assetClass: "stock" },
      { symbol: "EURUSD", name: "EUR/USD", price: 1.0825, change24h: -0.0015, changePercent24h: -0.14, assetClass: "forex" },
      { symbol: "GBPUSD", name: "GBP/USD", price: 1.2980, change24h: 0.0020, changePercent24h: 0.15, assetClass: "forex" },
      { symbol: "USDJPY", name: "USD/JPY", price: 144.35, change24h: 0.28, changePercent24h: 0.19, assetClass: "forex" },
      { symbol: "USDCHF", name: "USD/CHF", price: 0.8930, change24h: -0.0008, changePercent24h: -0.09, assetClass: "forex" },
      { symbol: "BTCUSD", name: "Bitcoin", price: 108420.0, change24h: 1245.0, changePercent24h: 1.16, assetClass: "crypto" },
      { symbol: "ETHUSD", name: "Ethereum", price: 3950.0, change24h: 52.0, changePercent24h: 1.33, assetClass: "crypto" },
      { symbol: "XAUUSD", name: "Gold", price: 3385.0, change24h: 18.5, changePercent24h: 0.55, assetClass: "commodity" },
      { symbol: "XAGUSD", name: "Silver", price: 36.80, change24h: 0.35, changePercent24h: 0.96, assetClass: "commodity" },
      { symbol: "WTICOUSD", name: "WTI Crude Oil", price: 68.45, change24h: -1.20, changePercent24h: -1.72, assetClass: "commodity" },
      { symbol: "NATGAS", name: "Natural Gas", price: 3.15, change24h: 0.08, changePercent24h: 2.61, assetClass: "commodity" },
    ],
    macroIndicators: [
      { name: "GDP Growth", value: "2.4%", lastUpdated: new Date().toISOString() },
      { name: "Inflation Rate", value: "2.9%", lastUpdated: new Date().toISOString() },
      { name: "Unemployment Rate", value: "4.2%", lastUpdated: new Date().toISOString() },
      { name: "Fed Funds Rate", value: "4.25%", lastUpdated: new Date().toISOString() },
      { name: "10 Year Note Yield", value: "4.32%", lastUpdated: new Date().toISOString() },
      { name: "Stock Market", value: "5945.12", lastUpdated: new Date().toISOString() },
    ],
    newsHeadlines: [
      "Fed holds rates steady at 4.25%, signals potential cut in Q3",
      "NVIDIA announces next-gen Blackwell Ultra chips, shares climb",
      "Gold hits record highs above $3,400 on geopolitical hedging",
      "Bitcoin ETF inflows surpass $2B month-to-date",
      "Eurozone inflation ticks lower, ECB eyes September easing",
    ],
  };
}

// ── Symbol-specific sanity ranges ───────────────────────────────────────

const STOCK_RANGES: Record<string, [number, number]> = {
  SPY: [400, 650],
  AAPL: [150, 280],
  MSFT: [350, 500],
  NVDA: [100, 200],
  TSLA: [150, 450],
};

function isValidStock(symbol: string, price: number): boolean {
  if (price <= 0 || price >= 100_000) return false;
  const range = STOCK_RANGES[symbol];
  if (range && (price < range[0] || price > range[1])) {
    console.warn(`[marketData] Stock ${symbol} price $${price} outside sanity range [${range[0]}-${range[1]}]`);
    return false;
  }
  return true;
}
function isValidForex(price: number): boolean {
  return price > 0.001 && price < 1_000;
}
function isValidCrypto(price: number): boolean {
  return price > 0 && price < 2_000_000;
}
function isValidChange(pct: number): boolean {
  return !isNaN(pct) && pct > -100 && pct < 100;
}

function validateAsset(a: ArenaAssetPrice): ArenaAssetPrice | null {
  switch (a.assetClass) {
    case "stock":
      if (!isValidStock(a.symbol, a.price)) {
        console.warn(`[marketData] Rejected stock ${a.symbol}: price=${a.price}`);
        return null;
      }
      break;
    case "forex":
      if (!isValidForex(a.price)) {
        console.warn(`[marketData] Rejected forex ${a.symbol}: price=${a.price}`);
        return null;
      }
      break;
    case "crypto":
      if (!isValidCrypto(a.price)) {
        console.warn(`[marketData] Rejected crypto ${a.symbol}: price=${a.price}`);
        return null;
      }
      break;
    case "commodity":
      if (a.price <= 0) {
        console.warn(`[marketData] Rejected commodity ${a.symbol}: price=${a.price}`);
        return null;
      }
      break;
  }
  if (!isValidChange(a.changePercent24h)) {
    a.changePercent24h = 0; // neutral instead of garbage
  }
  return a;
}

// ── Stocks ────────────────────────────────────────────────────────────────

interface StockDef { symbol: string; name: string; }

const STOCKS: StockDef[] = [
  { symbol: "SPY", name: "SPDR S&P 500" },
  { symbol: "AAPL", name: "Apple Inc" },
  { symbol: "MSFT", name: "Microsoft Corp" },
  { symbol: "NVDA", name: "NVIDIA Corp" },
  { symbol: "TSLA", name: "Tesla Inc" },
];

async function fetchStocks(): Promise<ArenaAssetPrice[]> {
  const out: ArenaAssetPrice[] = [];
  await Promise.all(
    STOCKS.map(async (s) => {
      try {
        const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(s.symbol)}&token=${FINNHUB_KEY}`;
        const res = await axios.get(url, { timeout: 10000 });
        const data = res.data;
        if (!data || typeof data.c !== "number") {
          console.warn(`[marketData] Stock ${s.symbol}: no price in response`);
          return;
        }
        const asset = validateAsset({
          symbol: s.symbol,
          name: s.name,
          price: data.c,
          change24h: typeof data.d === "number" ? data.d : 0,
          changePercent24h: typeof data.dp === "number" ? data.dp : 0,
          assetClass: "stock",
        });
        if (asset) {
          console.log(`[marketData] Stock ${s.symbol}: $${asset.price.toFixed(2)} (${asset.changePercent24h.toFixed(2)}%)`);
          out.push(asset);
        }
      } catch (err) {
        console.error(`[marketData] Stock ${s.symbol} fetch failed:`, (err as Error).message);
      }
    })
  );
  return out;
}

// ── Forex ─────────────────────────────────────────────────────────────────

// Finnhub /forex/rates?base=USD returns: { base: "USD", date: "...", rates: { EUR: 0.84, ... } }
// rates.X = how many X per 1 USD.
// EUR/USD = 1 / rates.EUR,  USD/JPY = rates.JPY,  USD/CHF = rates.CHF

interface FxDef { code: string; display: string; name: string; invert: boolean; }

const FX_PAIRS: FxDef[] = [
  { code: "EUR", display: "EURUSD", name: "EUR/USD", invert: true },
  { code: "GBP", display: "GBPUSD", name: "GBP/USD", invert: true },
  { code: "JPY", display: "USDJPY", name: "USD/JPY", invert: false },
  { code: "CHF", display: "USDCHF", name: "USD/CHF", invert: false },
];

async function fetchForex(): Promise<ArenaAssetPrice[]> {
  try {
    const url = `${FINNHUB_BASE}/forex/rates?base=USD&token=${FINNHUB_KEY}`;
    const res = await axios.get(url, { timeout: 10000 });
    const rates: Record<string, number> = res.data?.rates ?? {};
    console.log(`[marketData] Forex rates received:`, Object.keys(rates).slice(0, 10).join(", "));

    const out: ArenaAssetPrice[] = [];
    for (const pair of FX_PAIRS) {
      const raw = rates[pair.code];
      if (typeof raw !== "number" || raw <= 0) {
        console.warn(`[marketData] Forex ${pair.display}: missing rate for ${pair.code}`);
        continue;
      }
      const price = pair.invert ? 1 / raw : raw;
      const asset = validateAsset({
        symbol: pair.display,
        name: pair.name,
        price,
        change24h: 0,
        changePercent24h: 0,
        assetClass: "forex",
      });
      if (asset) {
        console.log(`[marketData] Forex ${pair.display}: ${price.toFixed(4)}`);
        out.push(asset);
      }
    }
    return out;
  } catch (err) {
    console.error("[marketData] Forex rates fetch failed:", (err as Error).message);
    return [];
  }
}

// ── Crypto ────────────────────────────────────────────────────────────────

// Finnhub free-tier crypto quote support is spotty. Try BINANCE format first,
// then COINBASE, then fall back to hardcoded values with a current timestamp.
const CRYPTO_FORMATS = [
  { symbol: "BINANCE:BTCUSDT", display: "BTCUSD", name: "Bitcoin" },
  { symbol: "BINANCE:ETHUSDT", display: "ETHUSD", name: "Ethereum" },
];

async function fetchCrypto(): Promise<ArenaAssetPrice[]> {
  const out: ArenaAssetPrice[] = [];

  for (const fmt of CRYPTO_FORMATS) {
    let success = false;
    // Try BINANCE format
    try {
      const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(fmt.symbol)}&token=${FINNHUB_KEY}`;
      const res = await axios.get(url, { timeout: 10000 });
      const data = res.data;
      if (data && typeof data.c === "number" && data.c > 0) {
        const asset = validateAsset({
          symbol: fmt.display,
          name: fmt.name,
          price: data.c,
          change24h: typeof data.d === "number" ? data.d : 0,
          changePercent24h: typeof data.dp === "number" ? data.dp : 0,
          assetClass: "crypto",
        });
        if (asset) {
          console.log(`[marketData] Crypto ${fmt.display}: $${asset.price.toFixed(2)}`);
          out.push(asset);
          success = true;
        }
      }
    } catch {
      // try next format
    }

    if (!success) {
      console.warn(`[marketData] Crypto ${fmt.display}: Finnhub quote unavailable, using fallback`);
      const fb = makeFallbackSnapshot().assets.find((a) => a.symbol === fmt.display);
      if (fb) out.push(fb);
    }
  }

  return out;
}

// ── Commodities ───────────────────────────────────────────────────────────

// Finnhub free tier has no reliable commodity quotes. Always use fallback
// but with a current timestamp so they don't look years old.
function fetchCommodities(): ArenaAssetPrice[] {
  const fb = makeFallbackSnapshot().assets.filter(
    (a) => a.assetClass === "commodity"
  );
  console.log(`[marketData] Commodities: using ${fb.length} fallback values`);
  return fb;
}

// ── News ──────────────────────────────────────────────────────────────────

async function fetchFinnhubNews(): Promise<string[]> {
  try {
    const url = `${FINNHUB_BASE}/news?category=general&token=${FINNHUB_KEY}`;
    const res = await axios.get(url, { timeout: 10000 });
    const data = Array.isArray(res.data) ? res.data : [];
    const headlines = data
      .slice(0, 5)
      .map((n: { headline?: string }) => n.headline ?? "")
      .filter(Boolean);
    console.log(`[marketData] News: ${headlines.length} headlines`);
    return headlines;
  } catch (err) {
    console.error("[marketData] News fetch failed:", (err as Error).message);
    return [];
  }
}

// ── Macro ─────────────────────────────────────────────────────────────────

async function fetchMacroIndicators(): Promise<ArenaMacroIndicator[]> {
  const out: ArenaMacroIndicator[] = [];

  async function wb(indicator: string, label: string) {
    try {
      const url = `https://api.worldbank.org/v2/country/USA/indicator/${indicator}?format=json&date=2020:2024&per_page=1`;
      const res = await axios.get(url, { timeout: 10000 });
      const payload = res.data;
      if (Array.isArray(payload) && payload.length >= 2 && Array.isArray(payload[1]) && payload[1].length > 0) {
        const entry = payload[1][0];
        out.push({ name: label, value: String(entry.value ?? "N/A"), lastUpdated: entry.date ?? new Date().toISOString() });
      }
    } catch (err) {
      console.error(`[marketData] World Bank ${label} failed:`, (err as Error).message);
    }
  }

  await wb("NY.GDP.MKTP.KD.ZG", "GDP Growth");
  await wb("FP.CPI.TOTL.ZG", "Inflation Rate");
  await wb("SL.UEM.TOTL.ZS", "Unemployment Rate");

  return out;
}

// ── Main export ─────────────────────────────────────────────────────────

export default async function fetchMarketSnapshot(): Promise<ArenaMarketSnapshot> {
  const [stocks, forex, crypto] = await Promise.all([
    fetchStocks(),
    fetchForex(),
    fetchCrypto(),
  ]);

  const commodities = fetchCommodities();

  const assets: ArenaAssetPrice[] = [];
  assets.push(...stocks);
  assets.push(...forex);
  assets.push(...crypto);
  assets.push(...commodities);

  const [macroIndicators, newsHeadlines] = await Promise.all([
    fetchMacroIndicators(),
    fetchFinnhubNews(),
  ]);

  // If we got zero live assets, something is very wrong — use cache or fallback
  const liveCount = stocks.length + forex.length + crypto.length;
  if (liveCount === 0) {
    console.warn("[marketData] All live fetches failed, checking cache...");
    const cached = await getMarketSnapshot();
    if (cached) {
      const ageMs = Date.now() - new Date(cached.timestamp).getTime();
      const ageMin = Math.floor(ageMs / 60_000);
      console.warn(`[marketData] Using cached snapshot (${ageMin}m old)`);
      if (ageMin < 60) {
        return cached;
      }
      console.warn("[marketData] Cache is >1h old, using fallback");
    }
    const fb = makeFallbackSnapshot();
    console.warn("[marketData] Returning hardcoded fallback");
    return fb;
  }

  const snapshot: ArenaMarketSnapshot = {
    timestamp: new Date().toISOString(),
    assets,
    macroIndicators: macroIndicators.length > 0 ? macroIndicators : makeFallbackSnapshot().macroIndicators,
    newsHeadlines: newsHeadlines.length > 0 ? newsHeadlines : makeFallbackSnapshot().newsHeadlines,
  };

  await setMarketSnapshot(snapshot);
  console.log(`[marketData] Snapshot saved: ${assets.length} assets, timestamp ${snapshot.timestamp}`);
  return snapshot;
}
