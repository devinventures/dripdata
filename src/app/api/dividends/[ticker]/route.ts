import { NextRequest, NextResponse } from "next/server";

const POLYGON_KEY = process.env.POLYGON_API_KEY;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  try {
    const res = await fetch(
      `https://api.polygon.io/v3/reference/dividends?ticker=${symbol}&limit=12&sort=ex_dividend_date&order=desc&apiKey=${POLYGON_KEY}`
    );
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({ error: "No dividend data found" }, { status: 404 });
    }

    const dividends = data.results.map((d: {
      cash_amount: number;
      ex_dividend_date: string;
      pay_date: string;
      frequency: number;
    }) => ({
      amount: d.cash_amount,
      ex_date: d.ex_dividend_date,
      pay_date: d.pay_date,
      frequency: d.frequency,
    }));

    const latest = dividends[0];
    const annualDividend = latest.amount * (latest.frequency ?? 4);

    return NextResponse.json({
      ticker: symbol,
      latest_dividend: latest.amount,
      annual_dividend: annualDividend,
      frequency: latest.frequency,
      history: dividends,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch dividends" }, { status: 500 });
  }
}
