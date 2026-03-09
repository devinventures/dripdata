import { NextRequest, NextResponse } from "next/server";

const KEY = process.env.POLYGON_API_KEY;

export async function GET(req: NextRequest) {
  const query = new URL(req.url).searchParams.get("q");
  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const q = query.toUpperCase();

  // Fetch prefix matches (tickers starting with query) + name/ticker search in parallel
  const [prefixRes, searchRes] = await Promise.all([
    fetch(
      `https://api.polygon.io/v3/reference/tickers?ticker.gte=${q}&ticker.lte=${q}z&active=true&limit=6&sort=ticker&apiKey=${KEY}`
    ),
    fetch(
      `https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&limit=6&sort=ticker&apiKey=${KEY}`
    ),
  ]);

  const [prefixData, searchData] = await Promise.all([
    prefixRes.json(),
    searchRes.json(),
  ]);

  type RawTicker = { ticker: string; name: string; market: string; type: string };
  const seen = new Set<string>();
  const combined: RawTicker[] = [];

  for (const t of [...(prefixData.results ?? []), ...(searchData.results ?? [])]) {
    if (!seen.has(t.ticker)) {
      seen.add(t.ticker);
      combined.push(t);
    }
  }

  const results = combined
    .map((t) => ({ ticker: t.ticker, name: t.name, market: t.market, type: t.type }))
    .sort((a, b) => {
      const aExact = a.ticker === q;
      const bExact = b.ticker === q;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      const aStarts = a.ticker.startsWith(q);
      const bStarts = b.ticker.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.ticker.localeCompare(b.ticker);
    })
    .slice(0, 8);

  return NextResponse.json({ results });
}
