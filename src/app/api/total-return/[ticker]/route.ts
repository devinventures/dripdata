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

// Fetch all daily bars in one call and return a date->close price map
async function fetchPriceBars(
  ticker: string,
  from: string,
  to: string
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  let url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${KEY}`;

  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.results) {
      for (const bar of data.results) {
        const date = new Date(bar.t).toISOString().split("T")[0];
        map.set(date, bar.c);
      }
    }
    url = data.next_url ? `${data.next_url}&apiKey=${KEY}` : "";
  }
  return map;
}

// Get the closest available price on or before a given date
function closestPrice(map: Map<string, number>, targetDate: string): number | null {
  // Try exact date first, then walk back up to 7 days
  const target = new Date(targetDate);
  for (let offset = 0; offset <= 7; offset++) {
    const d = new Date(target);
    d.setDate(d.getDate() - offset);
    const ds = d.toISOString().split("T")[0];
    if (map.has(ds)) return map.get(ds)!;
  }
  return null;
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

  if (!from || !to) {
    return NextResponse.json({ error: "from and to dates required" }, { status: 400 });
  }

  try {
    const [priceMap, dividends] = await Promise.all([
      fetchPriceBars(symbol, from, to),
      fetchAllDividends(symbol, from, to),
    ]);

    if (priceMap.size === 0) {
      return NextResponse.json(
        { error: "No price data found. This ticker may not be supported on the free Polygon plan, or the date range is too old." },
        { status: 404 }
      );
    }

    const dates = Array.from(priceMap.keys()).sort();
    const startPrice = priceMap.get(dates[0])!;
    const endPrice = priceMap.get(dates[dates.length - 1])!;

    // --- Without DRIP ---
    const totalDividendsCash = dividends.reduce((s, d) => s + d.cash_amount, 0);
    const priceReturn = (endPrice - startPrice) / startPrice;
    const dividendReturn = totalDividendsCash / startPrice;
    const totalReturn = priceReturn + dividendReturn;

    // --- With DRIP ---
    let dripShares = 1;
    for (const div of dividends) {
      const price = closestPrice(priceMap, div.ex_dividend_date) ?? startPrice;
      dripShares += (dripShares * div.cash_amount) / price;
    }
    const dripTotalReturn = (dripShares * endPrice - startPrice) / startPrice;

    // Dividends by year
    const byYear: Record<string, number> = {};
    for (const d of dividends) {
      const yr = d.ex_dividend_date.slice(0, 4);
      byYear[yr] = (byYear[yr] ?? 0) + d.cash_amount;
    }

    const startYear = new Date(dates[0]).getFullYear();
    const endYear = new Date(dates[dates.length - 1]).getFullYear();
    const years = Math.max(endYear - startYear, 1);
    const cagr = Math.pow(1 + totalReturn, 1 / years) - 1;
    const dripCagr = Math.pow(1 + dripTotalReturn, 1 / years) - 1;

    return NextResponse.json({
      ticker: symbol,
      from: dates[0],
      to: dates[dates.length - 1],
      startPrice,
      endPrice,
      dividends: {
        count: dividends.length,
        total: totalDividendsCash,
        byYear,
      },
      withoutDrip: { priceReturn, dividendReturn, totalReturn, cagr },
      withDrip: { finalShares: dripShares, totalReturn: dripTotalReturn, cagr: dripCagr },
    });
  } catch (e) {
    console.error("total-return error:", e);
    return NextResponse.json({ error: "Failed to calculate returns" }, { status: 500 });
  }
}
