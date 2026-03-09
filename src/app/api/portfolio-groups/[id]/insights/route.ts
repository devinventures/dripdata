import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { fetchYahooChart, fetchYahooFundSummary, fetchYahooStockProfile } from "@/lib/yahoo";

export async function GET(
  _req: NextRequest,
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
        // Use 2y range for better dividend history (8 quarterly or 24 monthly payments)
        const yahoo = await fetchYahooChart(row.ticker, "2y");
        const price = yahoo.currentPrice;

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

        // 52-week high/low from bars
        const year = 365 * 24 * 60 * 60 * 1000;
        const cutoff52 = Date.now() - year;
        const recentBars = yahoo.bars.filter((b) => b.t >= cutoff52);
        const high52w = recentBars.length > 0 ? Math.max(...recentBars.map((b) => b.high)) : null;
        const low52w  = recentBars.length > 0 ? Math.min(...recentBars.map((b) => b.low))  : null;

        // Price change from 1 year ago
        const oldestBar = recentBars[0];
        const priceReturn1y = oldestBar && oldestBar.close > 0
          ? ((price - oldestBar.close) / oldestBar.close) * 100
          : null;

        // Fund summary for ETFs; stock profile for individual stocks
        let fundSummary = null;
        let stockProfile = null;
        if (yahoo.instrumentType === "ETF") {
          try { fundSummary = await fetchYahooFundSummary(row.ticker); } catch { /* optional */ }
        } else {
          try { stockProfile = await fetchYahooStockProfile(row.ticker); } catch { /* optional */ }
        }

        return {
          ticker: row.ticker,
          shares: Number(row.shares),
          cost_basis: row.cost_basis ? Number(row.cost_basis) : null,
          purchase_date: row.purchase_date ?? null,
          name: yahoo.name,
          price,
          annual_dividend: annualDiv,
          yield_pct: divYield,
          dividends: yahoo.dividends,
          instrumentType: yahoo.instrumentType,
          firstTradeDate: yahoo.firstTradeDate,
          high52w,
          low52w,
          priceReturn1y,
          fundSummary,
          stockProfile,
          error: null,
        };
      } catch {
        return {
          ticker: row.ticker,
          shares: Number(row.shares),
          cost_basis: row.cost_basis ? Number(row.cost_basis) : null,
          purchase_date: row.purchase_date ?? null,
          name: row.ticker,
          price: null,
          annual_dividend: null,
          yield_pct: null,
          dividends: [],
          instrumentType: null,
          firstTradeDate: null,
          high52w: null,
          low52w: null,
          priceReturn1y: null,
          fundSummary: null,
          stockProfile: null,
          error: "Failed to load",
        };
      }
    })
  );

  return NextResponse.json(enriched);
}
