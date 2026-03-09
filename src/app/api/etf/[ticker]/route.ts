import { NextRequest, NextResponse } from "next/server";
import { fetchYahooChart, fetchYahooFundSummary, inferFrequency } from "@/lib/yahoo";

const KEY = process.env.POLYGON_API_KEY;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  const today = new Date();
  const yearAgo = new Date(today);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearAgoStr = yearAgo.toISOString().split("T")[0];

  // ── 1. Try Yahoo Finance (free, no rate limit) ─────────────────────────────
  try {
    const [yahoo, fund] = await Promise.all([
      fetchYahooChart(symbol, "5y"),
      fetchYahooFundSummary(symbol).catch(() => null),
    ]);

    if (yahoo.bars.length === 0) throw new Error("No price data");

    const { bars, dividends, currentPrice, name } = yahoo;

    const bars52 = bars.filter((b) => b.date >= yearAgoStr);
    const high52 = bars52.length ? Math.max(...bars52.map((b) => b.high)) : null;
    const low52 = bars52.length ? Math.min(...bars52.map((b) => b.low)) : null;
    const pricePosition =
      high52 && low52 && high52 !== low52
        ? ((currentPrice - low52) / (high52 - low52)) * 100
        : null;

    const freq = inferFrequency(dividends);
    const latestDiv = dividends[0] ?? null;
    const annualDiv = latestDiv ? latestDiv.amount * freq : null;
    const divYield =
      annualDiv && currentPrice > 0 ? (annualDiv / currentPrice) * 100 : null;

    let divGrowth: number | null = null;
    if (dividends.length >= 8) {
      const recent = dividends.slice(0, 4).reduce((s, d) => s + d.amount, 0);
      const prior = dividends.slice(4, 8).reduce((s, d) => s + d.amount, 0);
      divGrowth = prior > 0 ? ((recent - prior) / prior) * 100 : null;
    }

    // ── Compute multi-period returns ─────────────────────────────────────────
    function periodReturn(daysAgo: number) {
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - daysAgo);
      const cutStr = cutoff.toISOString().split("T")[0];
      const startBar = bars.find((b) => b.date >= cutStr);
      if (!startBar) return null;
      return ((currentPrice - startBar.close) / startBar.close) * 100;
    }

    const ytdStart = `${today.getFullYear()}-01-01`;
    const ytdBar = bars.find((b) => b.date >= ytdStart);
    const ytdReturn = ytdBar ? ((currentPrice - ytdBar.close) / ytdBar.close) * 100 : null;

    // Dividend CAGR (oldest to newest over available period)
    let divCagr: number | null = null;
    if (dividends.length >= 4) {
      const newest = dividends[0];
      const oldest = dividends[dividends.length - 1];
      const years = (newest.t - oldest.t) / (365.25 * 86_400_000);
      if (years >= 0.9) divCagr = (Math.pow(newest.amount / oldest.amount, 1 / years) - 1) * 100;
    }

    return NextResponse.json({
      ticker: symbol,
      name,
      description: null,
      homepage: null,
      market_cap: null,
      total_employees: null,
      list_date: yahoo.firstTradeDate,
      instrument_type: yahoo.instrumentType,
      returns: {
        ytd: ytdReturn,
        oneYear: periodReturn(365),
        threeYear: periodReturn(365 * 3),
        fiveYear: periodReturn(365 * 5),
      },
      fund: fund
        ? {
            expenseRatio: fund.expenseRatio,
            totalAssets: fund.totalAssets,
            navPrice: fund.navPrice,
            fundFamily: fund.fundFamily,
            category: fund.category,
            legalType: fund.legalType,
            turnoverRate: fund.turnoverRate,
            beta: fund.beta,
            fiftyDayAverage: fund.fiftyDayAverage,
            twoHundredDayAverage: fund.twoHundredDayAverage,
            peRatio: fund.peRatio,
            pbRatio: fund.pbRatio,
            topHoldings: fund.topHoldings,
            sectorWeightings: fund.sectorWeightings,
            assetAllocation: fund.assetAllocation,
          }
        : null,
      price: {
        current: currentPrice,
        open: yahoo.regularMarketOpen,
        high: yahoo.regularMarketHigh,
        low: yahoo.regularMarketLow,
        volume: yahoo.regularMarketVolume,
        vwap: null,
        change: yahoo.regularMarketChange,
        change_pct: yahoo.regularMarketChangePercent,
      },
      week52: { high: high52, low: low52, position: pricePosition },
      priceHistory: bars.map((b) => ({ date: b.date, close: b.close })),
      dividends: {
        yield: divYield,
        annual: annualDiv,
        latest: latestDiv
          ? {
              amount: latestDiv.amount,
              ex_date: latestDiv.exDate,
              pay_date: latestDiv.exDate,
              frequency: freq,
            }
          : null,
        growth_yoy: divGrowth,
        cagr: divCagr,
        history: dividends.slice(0, 64).map((d) => ({
          amount: d.amount,
          ex_date: d.exDate,
          pay_date: d.exDate,
          frequency: freq,
          type: "CD",
        })),
      },
    });
  } catch (yahooErr) {
    console.log(`[etf-lookup] Yahoo failed for ${symbol}, trying Polygon:`, yahooErr);
  }

  // ── 2. Polygon fallback ────────────────────────────────────────────────────
  const fiveYearsAgo = new Date(today);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const from = fiveYearsAgo.toISOString().split("T")[0];
  const to = today.toISOString().split("T")[0];

  try {
    const [detailRes, prevRes, barsRes, divRes] = await Promise.all([
      fetch(`https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${KEY}`),
      fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${KEY}`),
      fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=2000&apiKey=${KEY}`),
      fetch(`https://api.polygon.io/v3/reference/dividends?ticker=${symbol}&limit=64&order=desc&sort=ex_dividend_date&apiKey=${KEY}`),
    ]);

    const [detail, prev, bars, divData] = await Promise.all([
      detailRes.json(),
      prevRes.json(),
      barsRes.json(),
      divRes.json(),
    ]);

    if (detail.status === "ERROR" || bars.status === "ERROR") {
      const msg = detail.error ?? bars.error ?? "";
      if (msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("plan")) {
        return NextResponse.json(
          { error: "API rate limit reached — wait a moment and try again" },
          { status: 429 }
        );
      }
    }

    if (detail.status === "NOT_FOUND" || !detail.results) {
      return NextResponse.json({ error: "Ticker not found" }, { status: 404 });
    }

    const allBars: { o: number; h: number; l: number; c: number; v: number; vw?: number; t: number }[] =
      bars.results ?? [];
    const prevBar = prev.results?.[0] ?? allBars[allBars.length - 1];

    if (!prevBar) {
      return NextResponse.json({ error: "No price data available for this ticker" }, { status: 404 });
    }

    const bars52 = allBars.filter(
      (b) => new Date(b.t).toISOString().split("T")[0] >= yearAgoStr
    );
    const high52 = bars52.length ? Math.max(...bars52.map((b) => b.h)) : null;
    const low52 = bars52.length ? Math.min(...bars52.map((b) => b.l)) : null;
    const pricePosition =
      high52 && low52 && high52 !== low52
        ? ((prevBar.c - low52) / (high52 - low52)) * 100
        : null;

    const dividends = (divData.results ?? []).map(
      (d: { cash_amount: number; ex_dividend_date: string; pay_date: string; frequency: number; dividend_type: string }) => ({
        amount: d.cash_amount,
        ex_date: d.ex_dividend_date,
        pay_date: d.pay_date,
        frequency: d.frequency,
        type: d.dividend_type,
      })
    );

    const latestDiv = dividends[0] ?? null;
    const annualDiv = latestDiv ? latestDiv.amount * (latestDiv.frequency ?? 4) : null;
    const divYield = annualDiv ? (annualDiv / prevBar.c) * 100 : null;

    let divGrowth: number | null = null;
    if (dividends.length >= 8) {
      const recent = dividends.slice(0, 4).reduce((s: number, d: { amount: number }) => s + d.amount, 0);
      const prior = dividends.slice(4, 8).reduce((s: number, d: { amount: number }) => s + d.amount, 0);
      divGrowth = prior > 0 ? ((recent - prior) / prior) * 100 : null;
    }

    return NextResponse.json({
      ticker: symbol,
      name: detail.results?.name ?? symbol,
      description: detail.results?.description ?? null,
      homepage: detail.results?.homepage_url ?? null,
      market_cap: detail.results?.market_cap ?? null,
      total_employees: detail.results?.total_employees ?? null,
      list_date: detail.results?.list_date ?? null,
      price: {
        current: prevBar.c,
        open: prevBar.o,
        high: prevBar.h,
        low: prevBar.l,
        volume: prevBar.v,
        vwap: prevBar.vw ?? null,
        change: prevBar.c - prevBar.o,
        change_pct: ((prevBar.c - prevBar.o) / prevBar.o) * 100,
      },
      week52: { high: high52, low: low52, position: pricePosition },
      priceHistory: allBars.map((b) => ({
        date: new Date(b.t).toISOString().split("T")[0],
        close: b.c,
      })),
      dividends: {
        yield: divYield,
        annual: annualDiv,
        latest: latestDiv,
        growth_yoy: divGrowth,
        history: dividends,
      },
    });
  } catch (e) {
    console.error("[etf-lookup] Polygon fallback error:", e);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
