import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";

// ── DELETE /api/portfolio/[ticker] — remove a holding ────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  const { ticker } = await params;

  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("user_id", userId)
    .eq("ticker", ticker.toUpperCase());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── PATCH /api/portfolio/[ticker] — update shares / cost_basis ───────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  const { ticker } = await params;
  const body = await req.json();
  const updates: Record<string, number | null> = {};
  if (body.shares !== undefined) updates.shares = Number(body.shares);
  if (body.cost_basis !== undefined) updates.cost_basis = body.cost_basis ? Number(body.cost_basis) : null;

  const { error } = await supabase
    .from("portfolios")
    .update(updates)
    .eq("user_id", userId)
    .eq("ticker", ticker.toUpperCase());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
