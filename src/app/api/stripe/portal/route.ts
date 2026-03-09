import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { stripe, getBaseUrl } from "@/lib/stripe";

export async function POST() {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  const customerId = profile?.stripe_customer_id as string | null | undefined;
  if (!customerId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 404 });
  }

  const base = getBaseUrl();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/account`,
  });

  return NextResponse.json({ url: session.url });
}
