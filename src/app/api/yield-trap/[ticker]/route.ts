import { NextRequest, NextResponse } from "next/server";
import { fetchYahooChart } from "@/lib/yahoo";

const KEY = process.env.POLYGON_API_KEY;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];

  // ── 1. Try Yahoo Finance (free, no rate limit) ─────────────────────────────
  try {
    const yahoo = await fetchYahooChart(symbol, "2y");
    if (yahoo.bars.length === 0) throw new Error("No price data");

    const { bars, dividends, currentPrice, name } = yahoo;

    const barsBeforeOneYear = bars.filter((b) => b.date <= oneYearAgoStr);
    const priceOneYearAgo =
      barsBeforeOneYear.length > 0
        ? barsBeforeOneYear[barsBeforeOneYear.length - 1].close
        : bars[0].close;

    const navChangePct =
      ((currentPrice - priceOneYearAgo) / priceOneYearAgo) * 100;

    const ttmDividends = dividends.filter((d) => d.exDate >= oneYearAgoStr);
    const ttmTotal = ttmDividends.reduce((s, d) => s + d.amount, 0);
    const ttmYield = currentPrice > 0 ? (ttmTotal / currentPrice) * 100 : 0;

    let distTrend: number | null = null;
    if (dividends.length >= 8) {
      const recent = dividends.slice(0, 4).reduce((s, d) => s + d.amount, 0);
      const prior = dividends.slice(4, 8).reduce((s, d) => s + d.amount, 0);
      distTrend = prior > 0 ? ((recent - prior) / prior) * 100 : null;
    }

    let score: 0 | 1 | 2;
    if (navChangePct >= 0) score = 0;
    else if (ttmYield >= Math.abs(navChangePct)) score = 1;
    else score = 2;

    const breakEvenYears =
      navChangePct < 0 && ttmYield > 0
        ? Math.abs(navChangePct) / ttmYield
        : null;
    const totalReturn = navChangePct + ttmYield;

    const latestDiv = dividends[0] ?? null;
    const annualDiv = ttmTotal > 0 ? ttmTotal : (latestDiv?.amount ?? 0) * 4;
    const divYield = currentPrice > 0 ? (annualDiv / currentPrice) * 100 : 0;

    return NextResponse.json({
      ticker: symbol,
      name,
      currentPrice,
      priceOneYearAgo,
      navChangePct,
      ttmTotal,
      ttmYield,
      ttmCount: ttmDividends.length,
      distTrend,
      score,
      breakEvenYears,
      totalReturn,
      divYield,
      annualDiv,
      latestDiv: latestDiv
        ? { amount: latestDiv.amount, ex_date: latestDiv.exDate, pay_date: latestDiv.exDate, frequency: 12 }
        : null,
      priceHistory: bars.map((b) => ({ date: b.date, close: b.close })),
      dividends: dividends
        .slice(0, 20)
        .map((d) => ({ amount: d.amount, ex_date: d.exDate, pay_date: d.exDate })),
    });
  } catch (yahooErr) {
    console.log(`[yield-trap] Yahoo failed for ${symbol}, trying Polygon:`, yahooErr);
  }

  // ── 2. Polygon fallback ────────────────────────────────────────────────────
  const twoYearsAgo = new Date(today);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const from = twoYearsAgo.toISOString().split("T")[0];
  const to = today.toISOString().split("T")[0];

  try {
    const [detailRes, barsRes, divRes] = await Promise.all([
      fetch(`https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${KEY}`),
      fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=1000&apiKey=${KEY}`),
      fetch(`https://api.polygon.io/v3/reference/dividends?ticker=${symbol}&limit=30&order=desc&sort=ex_dividend_date&apiKey=${KEY}`),
    ]);

    const [detail, bars, divData] = await Promise.all([
      detailRes.json(),
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

    const allBars: { c: number; h: number; l: number; o: number; v: number; t: number }[] =
      bars.results ?? [];
    if (allBars.length === 0) {
      return NextResponse.json({ error: "No price data available" }, { status: 404 });
    }

    const currentPrice = allBars[allBars.length - 1].c;
    const barsBeforeOneYear = allBars.filter(
      (b) => new Date(b.t).toISOString().split("T")[0] <= oneYearAgoStr
    );
    const priceOneYearAgo =
      barsBeforeOneYear.length > 0
        ? barsBeforeOneYear[barsBeforeOneYear.length - 1].c
        : allBars[0].c;

    const navChangePct = ((currentPrice - priceOneYearAgo) / priceOneYearAgo) * 100;

    const dividends = (divData.results ?? []).map(
      (d: { cash_amount: number; ex_dividend_date: string; pay_date: string; frequency: number }) => ({
        amount: d.cash_amount,
        ex_date: d.ex_dividend_date,
        pay_date: d.pay_date,
        frequency: d.frequency,
      })
    );

    const ttmDividends = dividends.filter((d: { ex_date: string }) => d.ex_date >= oneYearAgoStr);
    const ttmTotal = ttmDividends.reduce((s: number, d: { amount: number }) => s + d.amount, 0);
    const ttmYield = currentPrice > 0 ? (ttmTotal / currentPrice) * 100 : 0;

    let distTrend: number | null = null;
    if (dividends.length >= 8) {
      const recent = dividends.slice(0, 4).reduce((s: number, d: { amount: number }) => s + d.amount, 0);
      const prior = dividends.slice(4, 8).reduce((s: number, d: { amount: number }) => s + d.amount, 0);
      distTrend = prior > 0 ? ((recent - prior) / prior) * 100 : null;
    }

    let score: 0 | 1 | 2;
    if (navChangePct >= 0) score = 0;
    else if (ttmYield >= Math.abs(navChangePct)) score = 1;
    else score = 2;

    const breakEvenYears =
      navChangePct < 0 && ttmYield > 0 ? Math.abs(navChangePct) / ttmYield : null;
    const totalReturn = navChangePct + ttmYield;
    const latestDiv = dividends[0] ?? null;
    const annualDiv = latestDiv ? latestDiv.amount * (latestDiv.frequency ?? 4) : ttmTotal;
    const divYield = currentPrice > 0 ? (annualDiv / currentPrice) * 100 : 0;

    return NextResponse.json({
      ticker: symbol,
      name: detail.results?.name ?? symbol,
      currentPrice,
      priceOneYearAgo,
      navChangePct,
      ttmTotal,
      ttmYield,
      ttmCount: ttmDividends.length,
      distTrend,
      score,
      breakEvenYears,
      totalReturn,
      divYield,
      annualDiv,
      latestDiv,
      priceHistory: allBars.map((b) => ({
        date: new Date(b.t).toISOString().split("T")[0],
        close: b.c,
      })),
      dividends: dividends.slice(0, 20),
    });
  } catch (e) {
    console.error("[yield-trap] Polygon fallback error:", e);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
