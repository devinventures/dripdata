"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface Holding {
  ticker: string;
  shares: number;
  cost_basis: number | null;
  purchase_date: string | null;
  dividends_received: number | null;
  name: string;
  price: number | null;
  annual_dividend: number | null;
  yield_pct: number | null;
  error: string | null;
}

function fmt$(n: number | null, dec = 2) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPct(n: number | null, showPlus = false) {
  if (n == null) return "—";
  return `${showPlus && n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

const COLORS = [
  "#4f46e5", "#7c3aed", "#2563eb", "#0891b2", "#059669",
  "#d97706", "#dc2626", "#db2777", "#7c3aed", "#6366f1",
];

export default function PerformancePage() {
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
        Loading performance data…
      </div>
    );
  }

  const loaded = holdings.filter((h) => !h.error && h.price != null);

  if (loaded.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <p className="text-3xl mb-3">📈</p>
        <p className="text-gray-300 font-medium mb-1">No performance data yet</p>
        <p className="text-gray-500 text-sm">Add holdings with cost basis on the Holdings tab to track P&L.</p>
      </div>
    );
  }

  const totalValue = loaded.reduce((s, h) => s + h.price! * h.shares, 0);
  const totalCost = loaded.filter((h) => h.cost_basis != null).reduce((s, h) => s + h.cost_basis! * h.shares, 0);
  const totalPnL = totalCost > 0 ? totalValue - totalCost : null;
  const totalPnLPct = totalCost > 0 && totalPnL != null ? (totalPnL / totalCost) * 100 : null;
  const hasCostBasis = loaded.some((h) => h.cost_basis != null);

  // Total return = unrealized P&L + dividends received
  const hasTotalReturn = loaded.some((h) => h.cost_basis != null && h.dividends_received != null);
  const totalDivsReceived = hasTotalReturn
    ? loaded.reduce((s, h) => s + (h.dividends_received ?? 0), 0)
    : null;
  const totalReturn = totalPnL != null && totalDivsReceived != null ? totalPnL + totalDivsReceived : null;
  const totalReturnPct = totalCost > 0 && totalReturn != null ? (totalReturn / totalCost) * 100 : null;

  // Allocation data (by market value)
  const allocationData = loaded
    .map((h, i) => ({
      ticker: h.ticker,
      value: h.price! * h.shares,
      pct: totalValue > 0 ? (h.price! * h.shares / totalValue) * 100 : 0,
      color: COLORS[i % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  // Unrealized P&L data for chart
  const pnlData = loaded
    .filter((h) => h.cost_basis != null)
    .map((h) => {
      const mktVal = h.price! * h.shares;
      const costVal = h.cost_basis! * h.shares;
      const pnl = mktVal - costVal;
      return {
        ticker: h.ticker,
        pnl,
        pnlPct: (pnl / costVal) * 100,
        gain: pnl >= 0,
      };
    })
    .sort((a, b) => b.pnlPct - a.pnlPct);

  // Total return data (price + dividends)
  const totalReturnData = loaded
    .filter((h) => h.cost_basis != null && h.dividends_received != null)
    .map((h) => {
      const mktVal = h.price! * h.shares;
      const costVal = h.cost_basis! * h.shares;
      const pnl = mktVal - costVal;
      const divsRcvd = h.dividends_received!;
      const totalRet = pnl + divsRcvd;
      const totalRetPct = costVal > 0 ? (totalRet / costVal) * 100 : 0;
      const priceRetPct = costVal > 0 ? (pnl / costVal) * 100 : 0;
      const divRetPct = costVal > 0 ? (divsRcvd / costVal) * 100 : 0;
      return {
        ticker: h.ticker,
        totalRet,
        totalRetPct,
        priceRetPct,
        divRetPct,
        divsRcvd,
        gain: totalRet >= 0,
      };
    })
    .sort((a, b) => b.totalRetPct - a.totalRetPct);

  const axisTickColor = isDark ? "#e5e7eb" : "#111827";
  const axisNumColor  = isDark ? "#9ca3af" : "#6b7280";
  const gridColor     = isDark ? "#1f2937" : "#e5e7eb";

  return (
    <div className="space-y-6">
      {/* Summary cards — unrealized */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Portfolio Value" value={fmt$(totalValue)} />
        <StatCard label="Total Cost" value={hasCostBasis ? fmt$(totalCost) : "—"} />
        <StatCard
          label="Unrealized P&L"
          value={totalPnL != null ? `${totalPnL >= 0 ? "+" : ""}${fmt$(totalPnL)}` : "—"}
          pnl={totalPnL}
        />
        <StatCard
          label="Price Return"
          value={totalPnLPct != null ? fmtPct(totalPnLPct, true) : "—"}
          pnl={totalPnL}
        />
      </div>

      {/* Total return summary cards (shown when purchase_date available) */}
      {hasTotalReturn && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Dividends Received"
            value={fmt$(totalDivsReceived)}
            green
          />
          <StatCard
            label="Total Return $"
            value={totalReturn != null ? `${totalReturn >= 0 ? "+" : ""}${fmt$(totalReturn)}` : "—"}
            pnl={totalReturn}
          />
          <StatCard
            label="Total Return %"
            value={totalReturnPct != null ? fmtPct(totalReturnPct, true) : "—"}
            pnl={totalReturn}
          />
        </div>
      )}

      {/* Allocation chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Portfolio Allocation</h2>
        <p className="text-xs text-gray-500 mb-5">By market value</p>
        <ResponsiveContainer width="100%" height={Math.max(allocationData.length * 40, 160)}>
          <BarChart
            layout="vertical"
            data={allocationData}
            margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: axisNumColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="ticker"
              tick={{ fill: axisTickColor, fontSize: 13, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, color: "#f9fafb" }}
              labelStyle={{ color: "#f9fafb", fontWeight: 600 }}
              itemStyle={{ color: "#d1d5db" }}
              formatter={(value: number, _name: string, props: { payload?: { value: number } }) => [
                `${value.toFixed(1)}% · ${fmt$(props.payload?.value)}`,
                "Allocation",
              ]}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
              {allocationData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
          {allocationData.map((d) => (
            <div key={d.ticker} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
              {d.ticker}
              <span className="text-gray-600">{d.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Total return chart (price + dividends, requires purchase_date) */}
      {totalReturnData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-1">Total Return by Holding</h2>
          <p className="text-xs text-gray-500 mb-5">Price appreciation + dividends received since purchase</p>
          <ResponsiveContainer width="100%" height={Math.max(totalReturnData.length * 44, 120)}>
            <BarChart
              layout="vertical"
              data={totalReturnData}
              margin={{ top: 0, right: 70, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: axisNumColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
              />
              <YAxis
                type="category"
                dataKey="ticker"
                tick={{ fill: axisTickColor, fontSize: 13, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <ReferenceLine x={0} stroke={isDark ? "#374151" : "#9ca3af"} strokeWidth={1} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, color: "#f9fafb" }}
                labelStyle={{ color: "#f9fafb", fontWeight: 600 }}
                itemStyle={{ color: "#d1d5db" }}
                formatter={(value: number, _name: string, props: { payload?: { priceRetPct: number; divRetPct: number; divsRcvd: number; totalRet: number } }) => {
                  const p = props.payload;
                  if (!p) return [`${value > 0 ? "+" : ""}${value.toFixed(2)}%`, "Total Return"];
                  return [
                    `${value > 0 ? "+" : ""}${value.toFixed(2)}%  ·  ${p.totalRet >= 0 ? "+" : ""}${fmt$(p.totalRet)}\nPrice: ${p.priceRetPct >= 0 ? "+" : ""}${p.priceRetPct.toFixed(2)}%  ·  Divs: +${p.divRetPct.toFixed(2)}%  (${fmt$(p.divsRcvd)} received)`,
                    "Total Return",
                  ];
                }}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="totalRetPct" radius={[0, 4, 4, 0]}>
                {totalReturnData.map((entry, i) => (
                  <Cell key={i} fill={entry.gain ? "#10b981" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Unrealized P&L chart */}
      {pnlData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-1">Unrealized P&L by Holding</h2>
          <p className="text-xs text-gray-500 mb-5">Price appreciation only vs cost basis</p>
          <ResponsiveContainer width="100%" height={Math.max(pnlData.length * 44, 120)}>
            <BarChart
              layout="vertical"
              data={pnlData}
              margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: axisNumColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
              />
              <YAxis
                type="category"
                dataKey="ticker"
                tick={{ fill: axisTickColor, fontSize: 13, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, color: "#f9fafb" }}
                labelStyle={{ color: "#f9fafb", fontWeight: 600 }}
                itemStyle={{ color: "#d1d5db" }}
                formatter={(value: number, _name: string, props: { payload?: { pnl: number } }) => [
                  `${value > 0 ? "+" : ""}${value.toFixed(2)}% · ${props.payload?.pnl != null ? (props.payload.pnl >= 0 ? "+" : "") + fmt$(props.payload.pnl) : ""}`,
                  "Price Return",
                ]}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="pnlPct" radius={[0, 4, 4, 0]}>
                {pnlData.map((entry, i) => (
                  <Cell key={i} fill={entry.gain ? "#10b981" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Full holdings detail table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300">Holdings Detail</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left px-5 py-2.5">Ticker</th>
                <th className="text-right px-5 py-2.5">Shares</th>
                <th className="text-right px-5 py-2.5">Price</th>
                <th className="text-right px-5 py-2.5">Mkt Value</th>
                {hasCostBasis && <th className="text-right px-5 py-2.5">Avg Cost</th>}
                {hasCostBasis && <th className="text-right px-5 py-2.5">Cost Basis</th>}
                {hasCostBasis && <th className="text-right px-5 py-2.5">Unrealized P&L</th>}
                {hasTotalReturn && <th className="text-right px-5 py-2.5">Divs Rcvd</th>}
                {hasTotalReturn && <th className="text-right px-5 py-2.5">Total Return</th>}
                <th className="text-right px-5 py-2.5">Weight</th>
              </tr>
            </thead>
            <tbody>
              {loaded
                .sort((a, b) => b.price! * b.shares - a.price! * a.shares)
                .map((h) => {
                  const mktVal = h.price! * h.shares;
                  const costVal = h.cost_basis != null ? h.cost_basis * h.shares : null;
                  const pnl = costVal != null ? mktVal - costVal : null;
                  const pnlPct = costVal && pnl != null && costVal > 0 ? (pnl / costVal) * 100 : null;
                  const divsRcvd = h.dividends_received;
                  const totalRet = pnl != null && divsRcvd != null ? pnl + divsRcvd : null;
                  const totalRetPct = costVal && totalRet != null && costVal > 0 ? (totalRet / costVal) * 100 : null;
                  const weight = totalValue > 0 ? (mktVal / totalValue) * 100 : 0;

                  return (
                    <tr key={h.ticker} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/20">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-white">{h.ticker}</p>
                        <p className="text-gray-500 text-xs truncate max-w-[140px]">{h.name}</p>
                        {h.purchase_date && (
                          <p className="text-gray-600 text-[10px] mt-0.5">Since {h.purchase_date}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-300">{h.shares}</td>
                      <td className="px-5 py-3 text-right text-gray-300">{fmt$(h.price)}</td>
                      <td className="px-5 py-3 text-right font-semibold">{fmt$(mktVal)}</td>
                      {hasCostBasis && (
                        <td className="px-5 py-3 text-right text-gray-400">{fmt$(h.cost_basis)}</td>
                      )}
                      {hasCostBasis && (
                        <td className="px-5 py-3 text-right text-gray-400">{fmt$(costVal)}</td>
                      )}
                      {hasCostBasis && (
                        <td className="px-5 py-3 text-right">
                          {pnl != null ? (
                            <span className={pnl >= 0 ? "text-green-400" : "text-red-400"}>
                              {pnl >= 0 ? "+" : ""}{fmt$(pnl)}
                              {pnlPct != null && (
                                <span className="text-xs ml-1 opacity-70">({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)</span>
                              )}
                            </span>
                          ) : "—"}
                        </td>
                      )}
                      {hasTotalReturn && (
                        <td className="px-5 py-3 text-right text-brand-400 font-medium">
                          {divsRcvd != null ? fmt$(divsRcvd) : <span className="text-gray-600">—</span>}
                        </td>
                      )}
                      {hasTotalReturn && (
                        <td className="px-5 py-3 text-right">
                          {totalRet != null ? (
                            <span className={totalRet >= 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                              {totalRet >= 0 ? "+" : ""}{fmt$(totalRet)}
                              {totalRetPct != null && (
                                <span className="text-xs ml-1 opacity-70">({totalRetPct >= 0 ? "+" : ""}{totalRetPct.toFixed(1)}%)</span>
                              )}
                            </span>
                          ) : <span className="text-gray-600 text-xs">Add purchase date</span>}
                        </td>
                      )}
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-gray-400 text-xs">{weight.toFixed(1)}%</span>
                          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-600 rounded-full" style={{ width: `${weight}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {!hasCostBasis && (
        <p className="text-center text-gray-600 text-sm">
          Add cost basis to your holdings to track P&L and returns.
        </p>
      )}
      {hasCostBasis && !hasTotalReturn && (
        <p className="text-center text-gray-600 text-sm">
          Add a purchase date to your holdings on the Holdings tab to track total return including dividends.
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, pnl, green }: { label: string; value: string; pnl?: number | null; green?: boolean }) {
  const color = pnl != null
    ? pnl >= 0 ? "text-green-400" : "text-red-400"
    : green ? "text-brand-400"
    : "text-white";
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold leading-tight ${color}`}>{value}</p>
    </div>
  );
}
