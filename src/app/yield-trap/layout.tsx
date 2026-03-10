import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { isSubscribed } from "@/lib/subscription";
import UpgradeWall from "@/app/portfolio-tracker/UpgradeWall";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .single();

  if (!isSubscribed(profile?.subscription_status as Parameters<typeof isSubscribed>[0])) {
    return <UpgradeWall />;
  }

  return <>{children}</>;
}
