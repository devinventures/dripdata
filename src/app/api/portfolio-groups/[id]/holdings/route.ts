import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { fetchYahooChart } from "@/lib/yahoo";

// ── GET /api/portfolio-groups/[id]/holdings ────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const { data: group } = await supabase
    .from("portfolio_groups")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: rows, error } = await supabase
    .from("portfolios")
    .select("ticker, shares, cost_basis, purchase_date, added_at")
    .eq("portfolio_id", id)
    .order("added_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json([]);

  const enriched = await Promise.all(
    rows.map(async (row) => {
      try {
        const yahoo = await fetchYahooChart(row.ticker, "1y");
        const price = yahoo.currentPrice;

        let annualDiv = yahoo.trailingAnnualDividendRate ?? null;
        if (annualDiv == null && yahoo.dividends.length > 0) {
          const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
          annualDiv =
            yahoo.dividends
              .filter((d) => d.t >= cutoff)
              .reduce((sum, d) => sum + d.amount, 0) || null;
        }

        const divYield = yahoo.trailingAnnualDividendYield
          ? yahoo.trailingAnnualDividendYield * 100
          : annualDiv && price > 0
          ? (annualDiv / price) * 100
          : null;

        // Calculate dividends received since purchase date
        const purchaseDateMs = row.purchase_date
          ? new Date(row.purchase_date + "T00:00:00").getTime()
          : null;
        const dividendsReceived =
          purchaseDateMs != null
            ? yahoo.dividends
                .filter((d) => d.t >= purchaseDateMs)
                .reduce((sum, d) => sum + d.amount * Number(row.shares), 0)
            : null;

        return {
          ticker: row.ticker,
          shares: Number(row.shares),
          cost_basis: row.cost_basis ? Number(row.cost_basis) : null,
          purchase_date: row.purchase_date ?? null,
          dividends_received: dividendsReceived,
          name: yahoo.name,
          price,
          annual_dividend: annualDiv,
          yield_pct: divYield,
          dividends: yahoo.dividends,
          error: null,
        };
      } catch {
        return {
          ticker: row.ticker,
          shares: Number(row.shares),
          cost_basis: row.cost_basis ? Number(row.cost_basis) : null,
          purchase_date: row.purchase_date ?? null,
          dividends_received: null,
          name: row.ticker,
          price: null,
          annual_dividend: null,
          yield_pct: null,
          dividends: [],
          error: "Failed to load",
        };
      }
    })
  );

  return NextResponse.json(enriched);
}

// ── POST /api/portfolio-groups/[id]/holdings ───────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: group } = await supabase
    .from("portfolio_groups")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { ticker, shares, cost_basis, purchase_date } = await req.json();
  if (!ticker || !shares || shares <= 0) {
    return NextResponse.json({ error: "Invalid ticker or shares" }, { status: 400 });
  }

  const upperTicker = ticker.toUpperCase();

  // Upsert on (portfolio_id, ticker) — requires UNIQUE constraint on those columns
  const { error } = await supabase
    .from("portfolios")
    .upsert(
      {
        user_id: user.id,
        portfolio_id: id,
        ticker: upperTicker,
        shares: Number(shares),
        cost_basis: cost_basis ? Number(cost_basis) : null,
        purchase_date: purchase_date || null,
      },
      { onConflict: "portfolio_id,ticker" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
