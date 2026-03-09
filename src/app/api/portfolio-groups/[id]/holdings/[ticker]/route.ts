import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ticker: string }> }
) {
  const { id, ticker } = await params;

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shares, cost_basis, purchase_date } = await req.json();
  const updates: Record<string, unknown> = {};
  if (shares !== undefined) updates.shares = Number(shares);
  if (cost_basis !== undefined) updates.cost_basis = cost_basis ? Number(cost_basis) : null;
  if (purchase_date !== undefined) updates.purchase_date = purchase_date || null;

  const { error } = await supabase
    .from("portfolios")
    .update(updates)
    .eq("portfolio_id", id)
    .eq("ticker", ticker.toUpperCase());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; ticker: string }> }
) {
  const { id, ticker } = await params;

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("portfolio_id", id)
    .eq("ticker", ticker.toUpperCase());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
