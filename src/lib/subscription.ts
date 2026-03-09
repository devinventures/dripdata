import { supabase } from "@/lib/supabase";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "free";

/** Returns true if the user has an active or trialing subscription. */
export function isSubscribed(status: SubscriptionStatus | null | undefined) {
  return status === "active" || status === "trialing";
}

/** Fetch a user's subscription status from the profiles table. */
export async function getUserSubscriptionStatus(
  userId: string
): Promise<SubscriptionStatus> {
  const { data } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", userId)
    .single();

  return (data?.subscription_status as SubscriptionStatus) ?? "free";
}
