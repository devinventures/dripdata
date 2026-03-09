import { supabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import PortfolioHeader from "./PortfolioHeader";

export default async function PortfolioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: group } = await supabase
    .from("portfolio_groups")
    .select("id, name")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!group) redirect("/portfolio-tracker");

  return (
    <div className="max-w-5xl">
      <PortfolioHeader portfolioId={id} initialName={group.name} />
      {children}
    </div>
  );
}
