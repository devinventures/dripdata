import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { fetchYahooChart } from "@/lib/yahoo";

// ── GET /api/portfolio — load all holdings with live prices ──────────────────
export async function GET() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  // 1. Load saved holdings from DB
  const { data: rows, error } = await supabase
    .from("portfolios")
    .select("ticker, shares, cost_basis, added_at")
    .eq("user_id", userId)
    .order("added_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json([]);

  // 2. Fetch live data for each ticker in parallel
  const enriched = await Promise.all(
    rows.map(async (row) => {
      try {
        const yahoo = await fetchYahooChart(row.ticker, "1y");
        const price = yahoo.currentPrice;

        // Prefer Yahoo meta fields; fall back to summing last 12 months of dividend events
        let annualDiv = yahoo.trailingAnnualDividendRate ?? null;
        if (annualDiv == null && yahoo.dividends.length > 0) {
          const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
          annualDiv = yahoo.dividends
            .filter((d) => d.t >= cutoff)
            .reduce((sum, d) => sum + d.amount, 0) || null;
        }

        const divYield = yahoo.trailingAnnualDividendYield
          ? yahoo.trailingAnnualDividendYield * 100
          : annualDiv && price > 0
          ? (annualDiv / price) * 100
          : null;

        return {
          ticker: row.ticker,
          shares: Number(row.shares),
          cost_basis: row.cost_basis ? Number(row.cost_basis) : null,
          name: yahoo.name,
          price,
          annual_dividend: annualDiv,
          yield_pct: divYield,
          error: null,
        };
      } catch {
        return {
          ticker: row.ticker,
          shares: Number(row.shares),
          cost_basis: row.cost_basis ? Number(row.cost_basis) : null,
          name: row.ticker,
          price: null,
          annual_dividend: null,
          yield_pct: null,
          error: "Failed to load",
        };
      }
    })
  );

  return NextResponse.json(enriched);
}

// ── POST /api/portfolio — add or update a holding ────────────────────────────
export async function POST(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  const { ticker, shares, cost_basis } = await req.json();
  if (!ticker || !shares || shares <= 0) {
    return NextResponse.json({ error: "Invalid ticker or shares" }, { status: 400 });
  }

  const { error } = await supabase
    .from("portfolios")
    .upsert(
      {
        user_id: userId,
        ticker: ticker.toUpperCase(),
        shares: Number(shares),
        cost_basis: cost_basis ? Number(cost_basis) : null,
      },
      { onConflict: "user_id,ticker" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
