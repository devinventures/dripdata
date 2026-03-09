"use client";
import Link from "next/link";
import { useState } from "react";

const features = [
  { icon: "📊", label: "Multiple portfolios" },
  { icon: "💰", label: "Income projections" },
  { icon: "📈", label: "Total return tracking" },
  { icon: "🔍", label: "Smart insights & alerts" },
  { icon: "🗓", label: "Dividend calendar" },
  { icon: "⚡", label: "Live market data" },
];

export default function UpgradeWall() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
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
    <div className="max-w-2xl mx-auto py-20 px-4 text-center">
      {/* Lock icon */}
      <div className="w-20 h-20 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-4xl mx-auto mb-6">
        🔒
      </div>

      <h1 className="text-3xl font-bold mb-3">Portfolio Tracker is a Pro Feature</h1>
      <p className="text-gray-400 text-base mb-10 max-w-md mx-auto">
        Subscribe to DripData Pro for <strong className="text-white">$5/month</strong> and unlock full access to all portfolio tracking tools.
      </p>

      {/* Feature grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10 text-left max-w-lg mx-auto">
        {features.map((f) => (
          <div key={f.label} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
            <span className="text-lg">{f.icon}</span>
            <span className="text-sm text-gray-200 font-medium">{f.label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 bg-red-900/40 border border-red-700/50 text-red-300 rounded-xl px-4 py-3 text-sm max-w-sm mx-auto">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full sm:w-auto bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-base"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Redirecting to Stripe…
            </span>
          ) : "Subscribe for $5/month →"}
        </button>
        <Link
          href="/pricing"
          className="text-sm text-gray-400 hover:text-white transition-colors underline underline-offset-2"
        >
          See full pricing details
        </Link>
      </div>

      <p className="text-xs text-gray-600 mt-6">Cancel anytime · Secure checkout by Stripe · No hidden fees</p>
    </div>
  );
}
