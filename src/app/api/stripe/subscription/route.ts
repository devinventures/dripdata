import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) return NextResponse.json({ status: "free" });

  const { data } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ status: data?.subscription_status ?? "free" });
}
