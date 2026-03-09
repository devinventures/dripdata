"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

const features = [
  { icon: "📊", label: "Unlimited portfolios", desc: "Create and manage multiple dividend portfolios" },
  { icon: "💰", label: "Income analysis", desc: "12-month projected income charts by month" },
  { icon: "📈", label: "Performance tracking", desc: "P&L, total return including dividends received" },
  { icon: "🔍", label: "Smart insights", desc: "Diversification scores, alerts, ETF deep dives" },
  { icon: "🗓", label: "Dividend calendar", desc: "Predicted ex-dividend dates for every holding" },
  { icon: "⚡", label: "Live market data", desc: "Real-time prices and yields via Yahoo Finance" },
];

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled") === "1";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) {
          router.push("/sign-in?next=/pricing");
          return;
        }
        throw new Error(body.error ?? "Failed to start checkout");
      }
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-16 px-4">
      {/* Header */}
      <div className="text-center mb-12">
        <span className="inline-block bg-brand-600/20 text-brand-400 text-xs font-semibold px-3 py-1 rounded-full mb-4 border border-brand-500/30">
          DRIPDATA PRO
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          Track your dividends like a pro
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Full access to the portfolio tracker — income charts, performance analytics, smart insights and more.
        </p>
      </div>

      {canceled && (
        <div className="mb-8 bg-gray-800 border border-gray-700 rounded-xl px-5 py-3 text-sm text-gray-400 text-center">
          No worries — you can subscribe whenever you&apos;re ready.
        </div>
      )}

      {/* Pricing card */}
      <div className="w-full max-w-md">
        <div className="relative bg-gray-900 border border-brand-500/40 rounded-3xl overflow-hidden shadow-2xl">
          {/* Glow */}
          <div className="absolute inset-0 bg-brand-600/5 pointer-events-none" />

          <div className="px-8 pt-8 pb-6">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-bold text-white">$5</span>
              <span className="text-gray-400 text-lg">/ month</span>
            </div>
            <p className="text-gray-500 text-sm mb-6">Cancel anytime. No hidden fees.</p>

            {error && (
              <div className="mb-4 bg-red-900/40 border border-red-700/50 text-red-300 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors text-base"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Redirecting to Stripe…
                </span>
              ) : "Get Started →"}
            </button>

            <p className="text-center text-xs text-gray-600 mt-3">
              Secure checkout powered by Stripe
            </p>
          </div>

          {/* Feature list */}
          <div className="border-t border-gray-800 px-8 py-6 space-y-4">
            {features.map((f) => (
              <div key={f.label} className="flex items-start gap-3">
                <span className="text-xl leading-none mt-0.5">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-100">{f.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                </div>
                <svg
                  className="w-4 h-4 text-brand-500 ml-auto mt-0.5 shrink-0"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ))}
          </div>
        </div>

        {/* Trust indicators */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            SSL secured
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Stripe payments
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            Cancel anytime
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}
