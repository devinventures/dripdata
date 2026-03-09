"use client";
import { useState } from "react";
import TickerSearch from "@/components/TickerSearch";

type Preset = "1y" | "3y" | "5y" | "10y" | "custom";

interface ReturnData {
  ticker: string;
  from: string;
  to: string;
  startPrice: number;
  endPrice: number;
  dividends: {
    count: number;
    total: number;
    byYear: Record<string, number>;
  };
  withoutDrip: {
    priceReturn: number;
    dividendReturn: number;
    totalReturn: number;
    cagr: number;
  };
  withDrip: {
    finalShares: number;
    totalReturn: number;
    cagr: number;
  };
}

function getDateRange(preset: Preset, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().split("T")[0];
  if (preset === "custom") return { from: customFrom, to: customTo };
  const years = { "1y": 1, "3y": 3, "5y": 5, "10y": 10 }[preset];
  const from = new Date(today);
  from.setFullYear(from.getFullYear() - years);
  return { from: from.toISOString().split("T")[0], to };
}

export default function TotalReturn() {
  const [ticker, setTicker] = useState("");
  const [investment, setInvestment] = useState("10000");
  const [preset, setPreset] = useState<Preset>("5y");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ReturnData | null>(null);

  async function calculate() {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    const { from, to } = getDateRange(preset, customFrom, customTo);
    if (!from || !to) {
      setError("Please enter valid dates.");
      return;
    }
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch(`/api/total-return/${t}?from=${from}&to=${to}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to fetch");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inv = parseFloat(investment) || 10000;

  const presets: { label: string; value: Preset }[] = [
    { label: "1Y", value: "1y" },
    { label: "3Y", value: "3y" },
    { label: "5Y", value: "5y" },
    { label: "10Y", value: "10y" },
    { label: "Custom", value: "custom" },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Total Return Calculator</h1>
      <p className="text-gray-400 text-sm mb-6">
        See the full picture — price appreciation plus dividends, with and without reinvestment.
      </p>

      {/* Inputs */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5 space-y-4">
        <div className="flex gap-2">
          <TickerSearch
            value={ticker}
            onChange={setTicker}
            placeholder="Ticker (e.g. SCHD, VYM, O)"
            className="flex-1"
          />
          <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg px-3 gap-1">
            <span className="text-gray-500 text-sm">$</span>
            <input
              type="number"
              placeholder="Investment"
              value={investment}
              onChange={(e) => setInvestment(e.target.value)}
              className="w-28 bg-transparent text-white text-sm py-2.5 focus:outline-none"
            />
          </div>
        </div>

        {/* Period selector */}
        <div>
          <p className="text-gray-400 text-xs mb-2">Time Period</p>
          <div className="flex gap-2 flex-wrap">
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
              <div className="flex-1">
                <label className="text-gray-400 text-xs block mb-1">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-gray-400 text-xs block mb-1">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={calculate}
          disabled={loading || !ticker.trim()}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors"
        >
          {loading ? "Calculating… (this may take a moment)" : "Calculate Total Return"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-bold">{data.ticker}</h2>
            <span className="text-gray-400 text-sm">{data.from} → {data.to}</span>
          </div>

          {/* Price info */}
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Start Price" value={`$${data.startPrice.toFixed(2)}`} />
            <StatBox label="End Price" value={`$${data.endPrice.toFixed(2)}`} />
          </div>

          {/* Without DRIP */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Without Reinvestment</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatBox
                label="Total Return"
                value={pct(data.withoutDrip.totalReturn)}
                highlight
              />
              <StatBox label="CAGR" value={pct(data.withoutDrip.cagr)} />
              <StatBox label="Price Return" value={pct(data.withoutDrip.priceReturn)} />
              <StatBox label="Dividend Return" value={pct(data.withoutDrip.dividendReturn)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatBox
                label="Portfolio Value"
                value={`$${(inv * (1 + data.withoutDrip.totalReturn)).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              />
              <StatBox
                label="Dividends Collected"
                value={`$${(inv * data.withoutDrip.dividendReturn).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              />
            </div>
          </div>

          {/* With DRIP */}
          <div className="bg-gray-900 border border-brand-800/50 rounded-xl p-5">
            <p className="text-brand-400 text-xs uppercase tracking-wider mb-3">With DRIP (Dividend Reinvestment)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <StatBox
                label="Total Return"
                value={pct(data.withDrip.totalReturn)}
                highlight
              />
              <StatBox label="CAGR" value={pct(data.withDrip.cagr)} />
              <StatBox
                label="Portfolio Value"
                value={`$${(inv * (1 + data.withDrip.totalReturn)).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              />
            </div>
            <p className="text-gray-500 text-xs">
              Started with {(inv / data.startPrice).toFixed(4)} shares →{" "}
              {((inv / data.startPrice) * data.withDrip.finalShares).toFixed(4)} shares after reinvestment
            </p>
          </div>

          {/* DRIP vs No DRIP difference */}
          <div className="bg-brand-900/20 border border-brand-800/40 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-brand-300 text-sm font-medium">DRIP advantage</p>
              <p className="text-gray-400 text-xs">Extra value from reinvesting dividends</p>
            </div>
            <div className="text-right">
              <p className="text-brand-400 text-2xl font-bold">
                +${((data.withDrip.totalReturn - data.withoutDrip.totalReturn) * inv).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-gray-400 text-sm">+{pct(data.withDrip.totalReturn - data.withoutDrip.totalReturn)}</p>
            </div>
          </div>

          {/* Dividend history by year */}
          {Object.keys(data.dividends.byYear).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">
                Dividends Paid — {data.dividends.count} payments, ${data.dividends.total.toFixed(4)} total per share
              </p>
              <div className="space-y-2">
                {Object.entries(data.dividends.byYear).sort().map(([yr, amt]) => (
                  <div key={yr} className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm w-12">{yr}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-brand-500 h-2 rounded-full"
                        style={{
                          width: `${(amt / Math.max(...Object.values(data.dividends.byYear))) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-16 text-right">${amt.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function pct(n: number) {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(2)}%`;
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <p className="text-gray-400 text-xs mb-0.5">{label}</p>
      <p className={`font-bold text-lg ${highlight ? "text-brand-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
