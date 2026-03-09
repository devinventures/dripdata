const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface YahooBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
  t: number; // Unix ms
}

export interface YahooDividend {
  amount: number;
  exDate: string; // YYYY-MM-DD
  t: number; // Unix ms
}

export interface YahooChartData {
  ticker: string;
  name: string;
  currentPrice: number;
  regularMarketOpen: number;
  regularMarketHigh: number;
  regularMarketLow: number;
  regularMarketVolume: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  currency: string;
  instrumentType: string | null;   // "ETF", "EQUITY", "MUTUALFUND", etc.
  firstTradeDate: string | null;   // YYYY-MM-DD inception / first trade
  trailingAnnualDividendYield: number | null;
  trailingAnnualDividendRate: number | null;
  bars: YahooBar[];       // oldest → newest
  dividends: YahooDividend[]; // newest → oldest
}

export async function fetchYahooChart(
  symbol: string,
  range: "1y" | "2y" | "5y" = "2y"
): Promise<YahooChartData> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&range=${range}&events=div%2Csplit&includePrePost=false`;

  const res = await fetch(url, {
    headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`);

  const json = await res.json();

  if (json?.chart?.error) {
    throw new Error(
      json.chart.error.description ?? "Ticker not found on Yahoo Finance"
    );
  }

  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No data from Yahoo Finance");

  const meta = result.meta ?? {};
  const timestamps: number[] = result.timestamp ?? [];
  const quoteData = result.indicators?.quote?.[0] ?? {};
  const adjCloseArr: (number | null)[] =
    result.indicators?.adjclose?.[0]?.adjclose ?? [];

  const bars: YahooBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = quoteData.close?.[i];
    if (close == null || close <= 0) continue;
    bars.push({
      date: new Date(timestamps[i] * 1000).toISOString().split("T")[0],
      open: quoteData.open?.[i] ?? close,
      high: quoteData.high?.[i] ?? close,
      low: quoteData.low?.[i] ?? close,
      close,
      adjClose: adjCloseArr[i] ?? close,
      volume: quoteData.volume?.[i] ?? 0,
      t: timestamps[i] * 1000,
    });
  }

  // Parse dividend events (object keyed by Unix timestamp string)
  const divEvents = result.events?.dividends ?? {};
  const dividends: YahooDividend[] = (
    Object.values(divEvents) as { amount: number; date: number }[]
  )
    .map((d) => ({
      amount: d.amount,
      exDate: new Date(d.date * 1000).toISOString().split("T")[0],
      t: d.date * 1000,
    }))
    .sort((a, b) => b.t - a.t);

  const currentPrice =
    meta.regularMarketPrice ?? bars[bars.length - 1]?.close ?? 0;

  const firstTrade = meta.firstTradeDate ?? null;

  return {
    ticker: symbol.toUpperCase(),
    name: meta.longName ?? meta.shortName ?? symbol.toUpperCase(),
    currentPrice,
    regularMarketOpen:
      meta.regularMarketOpen ?? bars[bars.length - 1]?.open ?? currentPrice,
    regularMarketHigh:
      meta.regularMarketDayHigh ?? bars[bars.length - 1]?.high ?? currentPrice,
    regularMarketLow:
      meta.regularMarketDayLow ?? bars[bars.length - 1]?.low ?? currentPrice,
    regularMarketVolume:
      meta.regularMarketVolume ?? bars[bars.length - 1]?.volume ?? 0,
    regularMarketChange: meta.regularMarketChange ?? 0,
    regularMarketChangePercent: meta.regularMarketChangePercent ?? 0,
    currency: meta.currency ?? "USD",
    instrumentType: meta.instrumentType ?? null,
    firstTradeDate: firstTrade
      ? new Date(firstTrade * 1000).toISOString().split("T")[0]
      : null,
    trailingAnnualDividendYield: meta.trailingAnnualDividendYield ?? null,
    trailingAnnualDividendRate: meta.trailingAnnualDividendRate ?? null,
    bars,
    dividends,
  };
}

// ── Yahoo-finance2 fund summary (handles crumb auth internally) ───────────────
import YahooFinance from "yahoo-finance2";
const _yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface YahooFundSummary {
  expenseRatio: number | null;      // e.g. 0.0006 = 0.06%
  totalAssets: number | null;       // AUM in dollars
  navPrice: number | null;          // Net asset value
  fundFamily: string | null;        // e.g. "Schwab ETFs"
  category: string | null;          // e.g. "Large Value"
  legalType: string | null;         // e.g. "Exchange Traded Fund"
  turnoverRate: number | null;      // e.g. 0.3 = 30%
  beta: number | null;              // 3-year beta
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  topHoldings: { symbol: string; name: string; pct: number }[];
  sectorWeightings: { sector: string; pct: number }[];
  assetAllocation: { cash: number | null; stock: number | null; bond: number | null };
}

export async function fetchYahooFundSummary(symbol: string): Promise<YahooFundSummary> {
  const r = await _yf.quoteSummary(symbol, {
    modules: ["summaryDetail", "fundProfile", "topHoldings", "defaultKeyStatistics"],
  });

  const sd = r.summaryDetail ?? {};
  const fp = r.fundProfile ?? {};
  const th = r.topHoldings ?? {};
  const ks = r.defaultKeyStatistics ?? {};
  const fees = (fp as { feesExpensesInvestment?: { annualReportExpenseRatio?: number; annualHoldingsTurnover?: number } }).feesExpensesInvestment ?? {};

  // Sector weightings: array of {sectorName: number} objects → flatten
  const sectorWeightings: { sector: string; pct: number }[] = [];
  for (const entry of ((th.sectorWeightings ?? []) as Record<string, number>[])) {
    for (const [k, v] of Object.entries(entry)) {
      if (v > 0) sectorWeightings.push({ sector: k, pct: v });
    }
  }
  sectorWeightings.sort((a, b) => b.pct - a.pct);

  return {
    expenseRatio: fees.annualReportExpenseRatio ?? null,
    totalAssets: (sd as { totalAssets?: number }).totalAssets ?? null,
    navPrice: (sd as { navPrice?: number }).navPrice ?? null,
    fundFamily: (fp as { family?: string }).family ?? null,
    category: fp.categoryName ?? null,
    legalType: fp.legalType ?? null,
    turnoverRate: fees.annualHoldingsTurnover ?? null,
    beta: (ks as { beta3Year?: number }).beta3Year ?? null,
    fiftyDayAverage: (sd as { fiftyDayAverage?: number }).fiftyDayAverage ?? null,
    twoHundredDayAverage: (sd as { twoHundredDayAverage?: number }).twoHundredDayAverage ?? null,
    peRatio: (th.equityHoldings as { priceToEarnings?: number } | undefined)?.priceToEarnings ?? null,
    pbRatio: (th.equityHoldings as { priceToBook?: number } | undefined)?.priceToBook ?? null,
    topHoldings: ((th.holdings ?? []) as { symbol?: string; holdingName?: string; holdingPercent?: number }[])
      .slice(0, 10)
      .map((h) => ({ symbol: h.symbol ?? "", name: h.holdingName ?? h.symbol ?? "", pct: h.holdingPercent ?? 0 })),
    sectorWeightings,
    assetAllocation: {
      cash: (th as { cashPosition?: number }).cashPosition ?? null,
      stock: (th as { stockPosition?: number }).stockPosition ?? null,
      bond: (th as { bondPosition?: number }).bondPosition ?? null,
    },
  };
}

// ── Stock profile (sector, industry, market cap, geography) ──────────────────
export interface YahooStockProfile {
  sector: string | null;       // e.g. "Technology", "Financials"
  industry: string | null;     // e.g. "Software—Application"
  marketCap: number | null;    // in USD
  country: string | null;      // e.g. "United States", "Canada"
  beta: number | null;         // 5-year beta
}

export async function fetchYahooStockProfile(symbol: string): Promise<YahooStockProfile> {
  const r = await _yf.quoteSummary(symbol, {
    modules: ["summaryProfile", "defaultKeyStatistics"],
  });

  const sp = r.summaryProfile ?? {};
  const ks = r.defaultKeyStatistics ?? {};

  return {
    sector:    (sp as { sector?: string }).sector ?? null,
    industry:  (sp as { industry?: string }).industry ?? null,
    marketCap: (ks as { marketCap?: number }).marketCap ?? null,
    country:   (sp as { country?: string }).country ?? null,
    beta:      (ks as { beta?: number }).beta ?? null,
  };
}

/** Infer annual payment frequency from average gap between dividends. */
export function inferFrequency(dividends: YahooDividend[]): number {
  if (dividends.length < 2) return 4;
  const count = Math.min(8, dividends.length);
  let totalGapMs = 0;
  for (let i = 0; i < count - 1; i++) {
    totalGapMs += dividends[i].t - dividends[i + 1].t;
  }
  const avgDays = totalGapMs / (count - 1) / 86_400_000;
  if (avgDays < 12) return 52;
  if (avgDays < 45) return 12;
  if (avgDays < 120) return 4;
  if (avgDays < 250) return 2;
  return 1;
}
