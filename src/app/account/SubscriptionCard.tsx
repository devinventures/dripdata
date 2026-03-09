"use client";
import Link from "next/link";
import { useState } from "react";

interface Props {
  status: string;
  hasCustomer: boolean;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active:    { label: "Active",    color: "text-green-400",  bg: "bg-green-900/30",  border: "border-green-700/40" },
  trialing:  { label: "Trial",     color: "text-blue-400",   bg: "bg-blue-900/30",   border: "border-blue-700/40"  },
  past_due:  { label: "Past Due",  color: "text-yellow-400", bg: "bg-yellow-900/30", border: "border-yellow-700/40" },
  canceled:  { label: "Canceled",  color: "text-gray-400",   bg: "bg-gray-800/60",   border: "border-gray-700/40"  },
  unpaid:    { label: "Unpaid",    color: "text-red-400",    bg: "bg-red-900/30",    border: "border-red-700/40"   },
  free:      { label: "Free",      color: "text-gray-400",   bg: "bg-gray-800/60",   border: "border-gray-700/40"  },
};

export default function SubscriptionCard({ status, hasCustomer }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cfg = statusConfig[status] ?? statusConfig.free;
  const isActive = status === "active" || status === "trialing";

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to open portal");
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-5 mb-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">DripData Pro</p>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
              {cfg.label}
            </span>
            {isActive && (
              <span className="text-sm text-gray-300 font-medium">$5 / month</span>
            )}
          </div>
        </div>

        {isActive && hasCustomer ? (
          <button
            onClick={openPortal}
            disabled={loading}
            className="text-sm px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white border border-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : "Manage Billing"}
          </button>
        ) : (
          <Link
            href="/pricing"
            className="text-sm px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors"
          >
            {status === "canceled" || status === "past_due" ? "Reactivate" : "Upgrade →"}
          </Link>
        )}
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-400">{error}</p>
      )}

      {status === "past_due" && (
        <p className="mt-3 text-xs text-yellow-400">
          Your last payment failed. Please update your payment method to continue.
        </p>
      )}
      {!isActive && status !== "free" && status !== "canceled" && (
        <p className="mt-3 text-xs text-gray-500">
          Your subscription is {status}. Contact support if you need help.
        </p>
      )}
    </div>
  );
}
