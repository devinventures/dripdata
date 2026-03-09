"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface Dividend {
  amount: number;
  exDate: string;
  t: number;
}

interface Holding {
  ticker: string;
  shares: number;
  cost_basis: number | null;
  name: string;
  price: number | null;
  annual_dividend: number | null;
  yield_pct: number | null;
  dividends: Dividend[];
  error: string | null;
}

// Infer annual payment frequency from gaps between dividends
function inferFrequency(dividends: Dividend[]): number {
  if (dividends.length < 2) return 4;
  const count = Math.min(8, dividends.length);
  let totalGapMs = 0;
  for (let i = 0; i < count - 1; i++) totalGapMs += dividends[i].t - dividends[i + 1].t;
  const avgDays = totalGapMs / (count - 1) / 86_400_000;
  if (avgDays < 12) return 52;
  if (avgDays < 45) return 12;
  if (avgDays < 120) return 4;
  if (avgDays < 250) return 2;
  return 1;
}

// Build 12-month forward income projection
function buildMonthlyProjection(
  holdings: Holding[]
): { month: string; income: number; isCurrent: boolean }[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const calMonth = d.getMonth();
    const isCurrent = i === 0;
    let income = 0;

    for (const h of holdings) {
      if (!h.annual_dividend || h.annual_dividend <= 0 || !h.dividends?.length) continue;
      const freq = inferFrequency(h.dividends);
      const divPerPayment = h.annual_dividend / freq;
      const holdingIncome = divPerPayment * h.shares;

      // Determine which calendar months this holding pays
      const payMonths = new Set<number>();
      const lookback = Math.min(Math.max(freq * 2, 4), h.dividends.length);
      for (let j = 0; j < lookback; j++) {
        payMonths.add(new Date(h.dividends[j].t).getMonth());
      }

      if (payMonths.has(calMonth)) income += holdingIncome;
    }

    return {
      month: d.toLocaleString("en-US", { month: "short" }),
      income,
      isCurrent,
    };
  });
}

function fmt$(n: number | null, dec = 2) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPct(n: number | null) {
  if (n == null) return "—";
  return n.toFixed(2) + "%";
}

const FREQ_LABEL: Record<number, string> = { 52: "Weekly", 12: "Monthly", 4: "Quarterly", 2: "Semi-annual", 1: "Annual" };

export default function IncomePage() {
  const params = useParams<{ id: string }>();
  const portfolioId = params.id;
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/portfolio-groups/${portfolioId}/holdings`);
    if (res.ok) setHoldings(await res.json());
    setLoading(false);
  }, [portfolioId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <div className="w-5 h-5 border-2 border-gray-700 border-t-brand-500 rounded-full animate-spin mr-3" />
        Loading income data…
      </div>
    );
  }

  const loaded = holdings.filter((h) => !h.error && h.annual_dividend != null);

  if (loaded.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <p className="text-3xl mb-3">💰</p>
        <p className="text-gray-300 font-medium mb-1">No income data yet</p>
        <p className="text-gray-500 text-sm">Add dividend-paying holdings on the Holdings tab.</p>
      </div>
    );
  }

  const totalValue = loaded.reduce((s, h) => s + (h.price ?? 0) * h.shares, 0);
  const totalIncome = loaded.reduce((s, h) => s + (h.annual_dividend ?? 0) * h.shares, 0);
  const blendedYield = totalValue > 0 ? (totalIncome / totalValue) * 100 : 0;

  // YTD income estimate — sum dividends paid since Jan 1 this year
  const ytdCutoff = new Date(new Date().getFullYear(), 0, 1).getTime();
  const ytdIncome = loaded.reduce((sum, h) => {
    const ytdDivs = h.dividends.filter((d) => d.t >= ytdCutoff);
    return sum + ytdDivs.reduce((s, d) => s + d.amount * h.shares, 0);
  }, 0);

  const monthlyData = buildMonthlyProjection(loaded);

  // Payout frequency breakdown
  const freqCounts: Record<string, number> = {};
  for (const h of loaded) {
    if (!h.dividends?.length) continue;
    const freq = inferFrequency(h.dividends);
    const label = FREQ_LABEL[freq] ?? "Other";
    freqCounts[label] = (freqCounts[label] ?? 0) + 1;
  }

  // Recent dividend history across all holdings (last 6 months)
  const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
  const recentHistory: { ticker: string; exDate: string; amount: number; totalIncome: number; t: number }[] = [];
  for (const h of loaded) {
    for (const d of h.dividends) {
      if (d.t >= sixMonthsAgo) {
        recentHistory.push({
          ticker: h.ticker,
          exDate: d.exDate,
          amount: d.amount,
          totalIncome: d.amount * h.shares,
          t: d.t,
        });
      }
    }
  }
  recentHistory.sort((a, b) => b.t - a.t);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Annual Income" value={fmt$(totalIncome)} green />
        <StatCard label="Monthly Income" value={fmt$(totalIncome / 12)} />
        <StatCard label="Blended Yield" value={fmtPct(blendedYield)} />
        <StatCard label="YTD Income" value={fmt$(ytdIncome)} />
      </div>

      {/* 12-month projected bar chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">12-Month Projected Income</h2>
        <p className="text-xs text-gray-500 mb-5">Based on dividend payment history</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#e5e7eb"} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: isDark ? "#9ca3af" : "#374151", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: isDark ? "#9ca3af" : "#374151", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v < 1000 ? v : (v / 1000).toFixed(1) + "k"}`}
              width={50}
            />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, color: "#f9fafb" }}
              labelStyle={{ color: "#f9fafb", fontWeight: 600 }}
              itemStyle={{ color: "#d1d5db" }}
              formatter={(value: number) => [fmt$(value), "Projected Income"]}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            <Bar dataKey="income" radius={[4, 4, 0, 0]}>
              {monthlyData.map((entry, i) => (
                <Cell key={i} fill={entry.isCurrent ? "#7c3aed" : "#4f46e5"} fillOpacity={entry.income === 0 ? 0.2 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Per-holding income table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300">Income by Holding</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left px-5 py-2.5">Ticker</th>
                <th className="text-right px-5 py-2.5">Div/Share</th>
                <th className="text-right px-5 py-2.5">Yield%</th>
                <th className="text-right px-5 py-2.5">YoC</th>
                <th className="text-right px-5 py-2.5">Annual</th>
              </tr>
            </thead>
            <tbody>
              {loaded
                .sort((a, b) => (b.annual_dividend! * b.shares) - (a.annual_dividend! * a.shares))
                .map((h) => {
                  const yoc = h.cost_basis && h.annual_dividend
                    ? (h.annual_dividend / h.cost_basis) * 100
                    : null;
                  return (
                    <tr key={h.ticker} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/20">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-white">{h.ticker}</p>
                        <p className="text-gray-500 text-xs">
                          {inferFrequency(h.dividends) === 12 ? "Monthly" :
                           inferFrequency(h.dividends) === 4 ? "Quarterly" :
                           inferFrequency(h.dividends) === 1 ? "Annual" : "Semi-annual"}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-300">{fmt$(h.annual_dividend, 4)}</td>
                      <td className="px-5 py-3 text-right text-brand-400">{fmtPct(h.yield_pct)}</td>
                      <td className="px-5 py-3 text-right text-gray-400">{yoc ? fmtPct(yoc) : "—"}</td>
                      <td className="px-5 py-3 text-right font-semibold text-brand-400">{fmt$(h.annual_dividend! * h.shares)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          {/* Payout frequency */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Payout Frequency</h2>
            <div className="space-y-2">
              {Object.entries(freqCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{label}</span>
                  <span className="font-semibold text-white">{count} {count === 1 ? "holding" : "holdings"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent dividend history */}
          {recentHistory.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-gray-300">Recent Dividends</h2>
                <p className="text-xs text-gray-500">Last 6 months · ex-dividend dates</p>
              </div>
              <div className="divide-y divide-gray-800 max-h-64 overflow-y-auto">
                {recentHistory.slice(0, 20).map((d, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <span className="font-semibold text-white">{d.ticker}</span>
                      <span className="text-gray-500 text-xs ml-2">{d.exDate}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-brand-400 font-semibold">{fmt$(d.totalIncome)}</p>
                      <p className="text-gray-500 text-xs">{fmt$(d.amount, 4)}/sh</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold leading-tight ${green ? "text-brand-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
