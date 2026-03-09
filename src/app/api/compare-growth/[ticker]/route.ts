import { NextRequest, NextResponse } from "next/server";

const KEY = process.env.POLYGON_API_KEY;

async function fetchAllDividends(ticker: string, from: string, to: string) {
  const dividends: { cash_amount: number; ex_dividend_date: string }[] = [];
  let url = `https://api.polygon.io/v3/reference/dividends?ticker=${ticker}&ex_dividend_date.gte=${from}&ex_dividend_date.lte=${to}&limit=1000&order=asc&apiKey=${KEY}`;
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.results) dividends.push(...data.results);
    url = data.next_url ? `${data.next_url}&apiKey=${KEY}` : "";
  }
  return dividends;
}

async function fetchPriceBars(
  ticker: string,
  from: string,
  to: string
): Promise<{ date: string; close: number }[]> {
  const bars: { date: string; close: number }[] = [];
  let url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${KEY}`;
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.results) {
      for (const bar of data.results) {
        const date = new Date(bar.t).toISOString().split("T")[0];
        bars.push({ date, close: bar.c });
      }
    }
    url = data.next_url ? `${data.next_url}&apiKey=${KEY}` : "";
  }
  return bars;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const drip = searchParams.get("drip") !== "false";
  const investment = parseFloat(searchParams.get("investment") ?? "10000");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to dates required" }, { status: 400 });
  }

  try {
    const [bars, dividends] = await Promise.all([
      fetchPriceBars(symbol, from, to),
      fetchAllDividends(symbol, from, to),
    ]);

    if (bars.length === 0) {
      return NextResponse.json(
        { error: `No price data found for ${symbol}. This ticker may not be supported on the free Polygon plan, or the date range is too old.` },
        { status: 404 }
      );
    }

    const startPrice = bars[0].close;

    // Build dividend map: ex_date -> dividend per share
    const divMap = new Map<string, number>();
    for (const d of dividends) {
      divMap.set(d.ex_dividend_date, (divMap.get(d.ex_dividend_date) ?? 0) + d.cash_amount);
    }

    // Simulate portfolio growth day by day
    let shares = investment / startPrice;
    let cashDividends = 0;
    const series: { date: string; value: number }[] = [];

    for (const bar of bars) {
      // Apply dividend if today is an ex-date
      if (divMap.has(bar.date)) {
        const divPerShare = divMap.get(bar.date)!;
        if (drip) {
          // Reinvest: buy more shares at today's close price
          shares += (shares * divPerShare) / bar.close;
        } else {
          // Accumulate cash
          cashDividends += shares * divPerShare;
        }
      }
      const value = shares * bar.close + (drip ? 0 : cashDividends);
      series.push({ date: bar.date, value: Math.round(value * 100) / 100 });
    }

    const finalValue = series[series.length - 1].value;
    const totalReturn = (finalValue - investment) / investment;

    // CAGR based on actual date range
    const startDate = new Date(bars[0].date);
    const endDate = new Date(bars[bars.length - 1].date);
    const years = Math.max(
      (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
      0.01
    );
    const cagr = Math.pow(1 + totalReturn, 1 / years) - 1;

    return NextResponse.json({
      ticker: symbol,
      from: bars[0].date,
      to: bars[bars.length - 1].date,
      startPrice,
      endPrice: bars[bars.length - 1].close,
      investment,
      finalValue,
      totalReturn,
      cagr,
      dividendCount: dividends.length,
      totalDividendsPerShare: dividends.reduce((s, d) => s + d.cash_amount, 0),
      drip,
      series,
    });
  } catch (e) {
    console.error("compare-growth error:", e);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
