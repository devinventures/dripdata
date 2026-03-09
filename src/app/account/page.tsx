import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase as adminSupabase } from "@/lib/supabase";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";
import SubscriptionCard from "./SubscriptionCard";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Fetch profile + portfolio count in parallel
  const [profileResult, countResult] = await Promise.all([
    adminSupabase
      .from("profiles")
      .select("display_name, subscription_status, stripe_customer_id")
      .eq("id", user.id)
      .single(),
    adminSupabase
      .from("portfolios")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const profile = profileResult.data;
  const holdingCount = countResult.count ?? 0;

  const joined = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

  const provider = user.app_metadata?.provider ?? "email";
  const emailVerified = !!user.email_confirmed_at;
  const displayName = profile?.display_name;
  const subscriptionStatus = (profile?.subscription_status ?? "free") as string;
  const hasCustomer = !!profile?.stripe_customer_id;

  return (
    <div className="max-w-lg mx-auto py-12">
      <h1 className="text-3xl font-bold mb-8">Account</h1>

      {/* Profile */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800 mb-6">
        <div className="flex items-center gap-4 px-6 py-5">
          <div className="w-14 h-14 rounded-full bg-brand-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
            {(displayName ?? user.email)?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0">
            {displayName && <p className="font-semibold text-lg">{displayName}</p>}
            <p className={`truncate ${displayName ? "text-sm text-gray-400" : "font-semibold text-lg"}`}>
              {user.email}
            </p>
            <p className="text-sm text-gray-400">Member since {joined}</p>
          </div>
        </div>

        <Row label="Sign-in method" value={
          <span className="capitalize flex items-center gap-2">
            {provider === "google" && (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {provider}
          </span>
        } />
        <Row label="Email verified" value={
          emailVerified
            ? <span className="text-green-400">✓ Verified</span>
            : <span className="text-yellow-400">Not verified</span>
        } />
        <Row label="Last sign-in" value={lastSignIn} />
        <Row label="User ID" value={<span className="font-mono text-xs">{user.id.slice(0, 20)}…</span>} />
      </div>

      {/* Subscription */}
      <h2 className="text-lg font-semibold mb-3">Subscription</h2>
      <SubscriptionCard status={subscriptionStatus} hasCustomer={hasCustomer} />

      {/* Edit profile */}
      <h2 className="text-lg font-semibold mb-3 mt-6">Edit Profile</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-5 mb-6">
        <ProfileForm userId={user.id} initial={{ display_name: displayName ?? null }} />
      </div>

      {/* Stats */}
      <h2 className="text-lg font-semibold mb-3">Usage</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-5 flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-400">Portfolio Holdings</p>
          <p className="text-2xl font-bold mt-0.5">{holdingCount}</p>
        </div>
        <span className="text-3xl">📊</span>
      </div>

      {/* Links */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800">
        <a href="/portfolio-tracker" className="flex items-center justify-between px-6 py-4 text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors rounded-t-2xl">
          <span>View Portfolio</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
        </a>
        <a href="/sign-in" className="flex items-center justify-between px-6 py-4 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800/50 transition-colors rounded-b-2xl">
          <span>Sign Out</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/></svg>
        </a>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-6 py-4 flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200">{value}</span>
    </div>
  );
}
