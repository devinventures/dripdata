"use client";
import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import TickerSearch from "@/components/TickerSearch";

type Preset = "1y" | "3y" | "5y" | "custom";

const COLORS = ["#22c55e", "#60a5fa", "#f59e0b", "#f43f5e", "#a855f7", "#06b6d4"];

interface GrowthData {
  ticker: string;
  from: string;
  to: string;
  startPrice: number;
  endPrice: number;
  investment: number;
  finalValue: number;
  totalReturn: number;
  cagr: number;
  dividendCount: number;
  totalDividendsPerShare: number;
  drip: boolean;
  series: { date: string; value: number }[];
}

function getDateRange(
  preset: Preset,
  customFrom: string,
  customTo: string
): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().split("T")[0];
  if (preset === "custom") return { from: customFrom, to: customTo };
  const years: Record<string, number> = { "1y": 1, "3y": 3, "5y": 5 };
  const from = new Date(today);
  from.setFullYear(from.getFullYear() - years[preset]);
  return { from: from.toISOString().split("T")[0], to };
}

// Merge multiple ticker series into one recharts-compatible array keyed by date
function mergeSeries(results: GrowthData[]): Record<string, number | string>[] {
  const dateSet = new Set<string>();
  const maps = results.map((r) => {
    const m = new Map<string, number>();
    r.series.forEach((p) => {
      m.set(p.date, p.value);
      dateSet.add(p.date);
    });
    return m;
  });
  const dates = Array.from(dateSet).sort();
  return dates.map((date) => {
    const row: Record<string, number | string> = { date };
    results.forEach((r, i) => {
      const v = maps[i].get(date);
      if (v !== undefined) row[r.ticker] = v;
    });
    return row;
  });
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(2)}%`;
}

function fmtMoney(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export default function ComparePage() {
  const [tickers, setTickers] = useState<string[]>(["", ""]);
  const [preset, setPreset] = useState<Preset>("3y");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [drip, setDrip] = useState(true);
  const [investment, setInvestment] = useState("10000");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [results, setResults] = useState<GrowthData[]>([]);
  const [chartData, setChartData] = useState<Record<string, number | string>[]>([]);

  function addTicker() {
    if (tickers.length < 6) setTickers([...tickers, ""]);
  }

  function removeTicker(i: number) {
    if (tickers.length <= 1) return;
    setTickers(tickers.filter((_, idx) => idx !== i));
  }

  function updateTicker(i: number, val: string) {
    const next = [...tickers];
    next[i] = val;
    setTickers(next);
  }

  async function compare() {
    const valid = tickers.map((t) => t.trim().toUpperCase()).filter(Boolean);
    if (valid.length === 0) return;
    const { from, to } = getDateRange(preset, customFrom, customTo);
    if (!from || !to) return;

    setLoading(true);
    setErrors({});
    setResults([]);
    setChartData([]);

    const inv = parseFloat(investment) || 10000;

    const fetches = valid.map(async (t) => {
      const res = await fetch(
        `/api/compare-growth/${t}?from=${from}&to=${to}&drip=${drip}&investment=${inv}`
      );
      const json = await res.json();
      if (!res.ok) return { ticker: t, error: json.error ?? "Failed to fetch" };
      return json as GrowthData;
    });

    const all = await Promise.all(fetches);
    const newErrors: Record<string, string> = {};
    const good: GrowthData[] = [];

    for (const r of all) {
      if ("error" in r && typeof r.error === "string") {
        newErrors[(r as { ticker: string; error: string }).ticker] = r.error;
      } else {
        good.push(r as GrowthData);
      }
    }

    setErrors(newErrors);
    setResults(good);
    if (good.length > 0) setChartData(mergeSeries(good));
    setLoading(false);
  }

  const presets: { label: string; value: Preset }[] = [
    { label: "1Y", value: "1y" },
    { label: "3Y", value: "3y" },
    { label: "5Y", value: "5y" },
    { label: "Custom", value: "custom" },
  ];

  const inv = parseFloat(investment) || 10000;
  const winner = results.length > 1
    ? results.reduce((a, b) => (a.totalReturn > b.totalReturn ? a : b))
    : null;
  const loser = results.length > 1
    ? results.reduce((a, b) => (a.totalReturn < b.totalReturn ? a : b))
    : null;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Total Return Comparison</h1>
      <p className="text-gray-400 text-sm mb-6">
        Compare how $10k grows across multiple ETFs — price appreciation plus dividends, with or without reinvestment.
      </p>

      {/* Input Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5 space-y-4">
        {/* Tickers */}
        <div>
          <p className="text-gray-400 text-xs mb-2">ETFs / Tickers</p>
          <div className="space-y-2">
            {tickers.map((t, i) => (
              <div key={i} className="flex gap-2 items-center">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <TickerSearch
                  value={t}
                  onChange={(val) => updateTicker(i, val)}
                  onSelect={(val) => updateTicker(i, val)}
                  placeholder={`Ticker ${i + 1} (e.g. SCHD, VYM, JEPI)`}
                  className="flex-1"
                />
                {tickers.length > 1 && (
                  <button
                    onClick={() => removeTicker(i)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xl leading-none w-6 text-center"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {tickers.length < 6 && (
            <button
              onClick={addTicker}
              className="mt-2 text-brand-400 text-sm hover:text-brand-300 transition-colors"
            >
              + Add ticker
            </button>
          )}
        </div>

        {/* Period + Investment + DRIP */}
        <div className="flex gap-4 flex-wrap items-end">
          {/* Period */}
          <div className="flex-1 min-w-52">
            <p className="text-gray-400 text-xs mb-2">Time Period</p>
            <div className="flex gap-2">
              {presets.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    preset === p.value
                      ? "bg-brand-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="flex gap-3 mt-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">From</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">To</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Investment */}
          <div>
            <p className="text-gray-400 text-xs mb-2">Investment</p>
            <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg px-3 gap-1">
              <span className="text-gray-500 text-sm">$</span>
              <input
                type="number"
                value={investment}
                onChange={(e) => setInvestment(e.target.value)}
                className="w-28 bg-transparent text-white text-sm py-2.5 focus:outline-none"
              />
            </div>
          </div>

          {/* DRIP toggle */}
          <div>
            <p className="text-gray-400 text-xs mb-2">Dividends</p>
            <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setDrip(true)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  drip ? "bg-brand-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Reinvest
              </button>
              <button
                onClick={() => setDrip(false)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  !drip ? "bg-gray-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Collect
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={compare}
          disabled={loading || tickers.every((t) => !t.trim())}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors"
        >
          {loading ? "Fetching data…" : "Compare"}
        </button>
      </div>

      {/* Errors */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4 space-y-1">
          {Object.entries(errors).map(([t, e]) => (
            <p key={t} className="text-red-400 text-sm">
              <span className="font-semibold">{t}:</span> {e}
            </p>
          ))}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && chartData.length > 0 && (
        <div className="space-y-4">

          {/* Chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="mb-4">
              <h2 className="font-semibold text-white">Portfolio Growth</h2>
              <p className="text-gray-500 text-xs">
                ${inv.toLocaleString()} invested ·{" "}
                {drip ? "dividends reinvested (DRIP)" : "dividends collected as cash"} ·{" "}
                {results[0]?.from} → {results[0]?.to}
              </p>
            </div>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  tickFormatter={(d) =>
                    new Date(d).toLocaleDateString("en-US", {
                      month: "short",
                      year: "2-digit",
                    })
                  }
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  tickFormatter={(v) => fmtMoney(v)}
                  width={60}
                />
                <ReferenceLine
                  y={inv}
                  stroke="#374151"
                  strokeDasharray="4 4"
                  label={{
                    value: `$${inv.toLocaleString()} invested`,
                    fill: "#4b5563",
                    fontSize: 10,
                    position: "insideTopLeft",
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "#9ca3af", fontSize: 12 }}
                  formatter={(value: number, name: string) => [
                    `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                    name,
                  ]}
                  labelFormatter={(label) =>
                    new Date(label).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                />
                <Legend wrapperStyle={{ paddingTop: 16, fontSize: 13 }} />
                {results.map((r, i) => (
                  <Line
                    key={r.ticker}
                    type="monotone"
                    dataKey={r.ticker}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false}
                    strokeWidth={2}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Summary table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800">
              <h3 className="font-medium text-white">Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-5 py-3 text-gray-400 font-medium">Ticker</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Start</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">End</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Total Return</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">CAGR</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Divs / Share</th>
                    <th className="text-right px-5 py-3 text-gray-400 font-medium">Final Value</th>
                  </tr>
                </thead>
                <tbody>
                  {results
                    .slice()
                    .sort((a, b) => b.totalReturn - a.totalReturn)
                    .map((r) => {
                      const colorIdx = results.indexOf(r);
                      const isWinner = winner && r.ticker === winner.ticker;
                      return (
                        <tr
                          key={r.ticker}
                          className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                            isWinner ? "bg-green-900/10" : ""
                          }`}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: COLORS[colorIdx % COLORS.length] }}
                              />
                              <span className="font-semibold text-white">{r.ticker}</span>
                              {isWinner && results.length > 1 && (
                                <span className="text-xs text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">
                                  best
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-right px-4 py-3 text-gray-300">
                            ${r.startPrice.toFixed(2)}
                          </td>
                          <td className="text-right px-4 py-3 text-gray-300">
                            ${r.endPrice.toFixed(2)}
                          </td>
                          <td
                            className={`text-right px-4 py-3 font-semibold ${
                              r.totalReturn >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {fmtPct(r.totalReturn)}
                          </td>
                          <td
                            className={`text-right px-4 py-3 ${
                              r.cagr >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {fmtPct(r.cagr)}/yr
                          </td>
                          <td className="text-right px-4 py-3 text-gray-300">
                            ${r.totalDividendsPerShare.toFixed(4)}
                          </td>
                          <td className="text-right px-5 py-3 font-semibold text-white">
                            ${r.finalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Winner callout */}
          {results.length > 1 && winner && loser && (() => {
            const winnerIdx = results.indexOf(winner);
            const diff = winner.totalReturn - loser.totalReturn;
            const valueDiff = winner.finalValue - loser.finalValue;
            return (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: COLORS[winnerIdx % COLORS.length] }}
                    />
                    <p className="font-semibold text-white text-lg">{winner.ticker} wins</p>
                  </div>
                  <p className="text-gray-400 text-sm">
                    {fmtPct(diff)} better total return vs {loser.ticker} over this period
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {fmtPct(winner.cagr)}/yr vs {fmtPct(loser.cagr)}/yr annualized
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className="text-3xl font-bold"
                    style={{ color: COLORS[winnerIdx % COLORS.length] }}
                  >
                    +${valueDiff.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-gray-400 text-sm">
                    more on ${inv.toLocaleString()} invested
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
