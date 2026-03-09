import { NextRequest, NextResponse } from "next/server";
import { fetchYahooChart } from "@/lib/yahoo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  try {
    const yahoo = await fetchYahooChart(symbol, "1y");
    if (!yahoo.currentPrice) {
      return NextResponse.json({ error: "Ticker not found" }, { status: 404 });
    }
    return NextResponse.json({
      ticker: symbol,
      price: yahoo.currentPrice,
      name: yahoo.name,
      market_cap: null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
