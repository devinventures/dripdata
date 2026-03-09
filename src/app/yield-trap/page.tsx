"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import TickerSearch from "@/components/TickerSearch";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

interface YieldTrapData {
  ticker: string;
  name: string;
  currentPrice: number;
  priceOneYearAgo: number;
  navChangePct: number;
  ttmTotal: number;
  ttmYield: number;
  ttmCount: number;
  distTrend: number | null;
  score: 0 | 1 | 2;
  breakEvenYears: number | null;
  totalReturn: number;
  divYield: number;
  annualDiv: number;
  latestDiv: { amount: number; ex_date: string; pay_date: string; frequency: number } | null;
  priceHistory: { date: string; close: number }[];
  dividends: { amount: number; ex_date: string; pay_date: string }[];
}

const PRESET_TICKERS = [
  // Dividend ETFs
  "SCHD", "VYM", "VIG", "DGRO", "DVY", "HDV", "SPHD", "SPYD", "NOBL", "SDY",
  // Covered call ETFs
  "JEPI", "JEPQ", "DIVO", "GPIX", "GPIQ", "ISPY", "TLTW", "BALI",
  "QYLD", "XYLD", "RYLD", "KLIP",
  // YieldMax
  "CONY", "MSFO", "NVDY", "TSLY", "AMZY", "GOOGY", "APLY", "NFLY",
  // Preferred / fixed income
  "PFF", "PFFD", "SPFF",
  // REITs
  "VNQ", "SCHH", "REM",
  // CEFs
  "YYY", "UTG", "UTF", "EOI", "EOS", "CSQ",
  // Bond ETFs
  "HYG", "JNK", "SJNK", "BKLN",
  // BDCs
  "MAIN", "HTGC", "ARCC", "GAIN",
  // Dividend stocks
  "O", "ABBV", "T", "VZ", "MO", "KO", "PEP", "JNJ", "PFE", "XOM",
];

const scoreConfig = {
  0: {
    label: "Safe",
    sublabel: "NAV is growing — income is a bonus",
    bg: "bg-green-900/40",
    border: "border-green-700",
    text: "text-green-400",
    badge: "bg-green-700 text-green-100",
    icon: "✓",
  },
  1: {
    label: "Caution",
    sublabel: "NAV declining, but income covers the loss",
    bg: "bg-yellow-900/30",
    border: "border-yellow-700",
    text: "text-yellow-400",
    badge: "bg-yellow-700 text-yellow-100",
    icon: "⚠",
  },
  2: {
    label: "Yield Trap",
    sublabel: "High yield, but NAV loss exceeds income",
    bg: "bg-red-900/30",
    border: "border-red-700",
    text: "text-red-400",
    badge: "bg-red-700 text-red-100",
    icon: "✕",
  },
};

export default function YieldTrap() {
  return (
    <Suspense>
      <YieldTrapInner />
    </Suspense>
  );
}

function YieldTrapInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlTicker = searchParams.get("t")?.toUpperCase() ?? "";

  const [ticker, setTicker] = useState(urlTicker);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<YieldTrapData | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (urlTicker) {
      setTicker(urlTicker);
      runLookup(urlTicker);
    } else {
      abortRef.current?.abort();
      setTicker("");
      setError("");
      setData(null);
    }
    return () => { abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTicker]);

  // Clear stale state when restored from bfcache
  useEffect(() => {
    function onShow(e: PageTransitionEvent) {
      if (e.persisted) {
        setError("");
        setData(null);
        if (urlTicker) runLookup(urlTicker);
      }
    }
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTicker]);

  async function runLookup(t: string) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch(`/api/yield-trap/${t}`, { signal: abortRef.current.signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Not found");
      setData(json);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function lookup(overrideTicker?: string) {
    const t = (overrideTicker ?? ticker).trim().toUpperCase();
    if (!t) return;
    router.push(`/yield-trap?t=${t}`);
  }

  const cfg = data ? scoreConfig[data.score] : null;

  // Price chart: last 1 year for relevance
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];
  const priceChartData = data
    ? data.priceHistory
        .filter((p) => p.date >= oneYearAgoStr)
        .map((p, i, arr) => ({ ...p, label: i % 30 === 0 ? p.date.slice(0, 7) : "" }))
    : [];

  const priceUp = data ? data.navChangePct >= 0 : true;
  const chartColor = priceUp ? "#22c55e" : "#f87171";

  // Dividend bar chart
  const divChartData = data
    ? [...data.dividends].reverse().map((d) => ({
        date: d.ex_date.slice(0, 7),
        amount: d.amount,
      }))
    : [];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Yield Trap Calculator</h1>
      <p className="text-gray-400 text-sm mb-6">
        Works for any ticker — ETFs, stocks, BDCs, CEFs. See if the yield is real or just NAV erosion.
      </p>

      <div className="flex gap-2 mb-6">
        <TickerSearch
          value={ticker}
          onChange={setTicker}
          onSelect={lookup}
          placeholder="Any ticker — QYLD, SCHD, O, ABBV…"
          className="flex-1"
        />
        <button
          onClick={() => lookup()}
          disabled={loading || !ticker.trim()}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          {loading ? "Loading…" : "Analyze"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {data && cfg && (
        <div className="space-y-4">
          {/* Score banner */}
          <div className={`${cfg.bg} border ${cfg.border} rounded-xl p-5`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{data.ticker} · {data.name}</p>
                <div className="flex items-center gap-3">
                  <span className={`text-4xl font-black ${cfg.text}`}>{cfg.icon}</span>
                  <div>
                    <p className={`text-2xl font-bold ${cfg.text}`}>{cfg.label}</p>
                    <p className="text-gray-400 text-sm">{cfg.sublabel}</p>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-bold">${data.currentPrice.toFixed(2)}</p>
                <p className={`text-sm font-medium mt-0.5 ${priceUp ? "text-green-400" : "text-red-400"}`}>
                  {priceUp ? "+" : ""}{data.navChangePct.toFixed(2)}% NAV (1Y)
                </p>
              </div>
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatBox
              label="NAV Change (1Y)"
              value={`${data.navChangePct >= 0 ? "+" : ""}${data.navChangePct.toFixed(2)}%`}
              highlight={data.navChangePct >= 0}
              danger={data.navChangePct < 0}
            />
            <StatBox
              label="TTM Distributions"
              value={`$${data.ttmTotal.toFixed(4)}`}
              sub={`${data.ttmCount} payments`}
            />
            <StatBox
              label="TTM Yield"
              value={`${data.ttmYield.toFixed(2)}%`}
              highlight={data.ttmYield > 0}
            />
            <StatBox
              label="Total Return (1Y)"
              value={`${data.totalReturn >= 0 ? "+" : ""}${data.totalReturn.toFixed(2)}%`}
              highlight={data.totalReturn >= 0}
              danger={data.totalReturn < 0}
              sub="NAV + income"
            />
            <StatBox
              label="Dist. Trend (QoQ)"
              value={
                data.distTrend !== null
                  ? `${data.distTrend >= 0 ? "+" : ""}${data.distTrend.toFixed(2)}%`
                  : "N/A"
              }
              highlight={!!data.distTrend && data.distTrend > 0}
              danger={!!data.distTrend && data.distTrend < 0}
              sub="recent 4 vs prior 4"
            />
            <StatBox
              label="Break-Even"
              value={
                data.breakEvenYears !== null
                  ? `${data.breakEvenYears.toFixed(1)} yrs`
                  : "N/A"
              }
              sub={data.breakEvenYears !== null ? "at current yield" : "NAV not declining"}
            />
          </div>

          {/* NAV explainer strip */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4 text-sm">
            <div className="flex-1">
              <span className="text-gray-400">Price 1 year ago: </span>
              <span className="font-semibold">${data.priceOneYearAgo.toFixed(2)}</span>
            </div>
            <div className="text-gray-600">→</div>
            <div className="flex-1">
              <span className="text-gray-400">Today: </span>
              <span className="font-semibold">${data.currentPrice.toFixed(2)}</span>
            </div>
            <div className={`font-bold ${priceUp ? "text-green-400" : "text-red-400"}`}>
              {priceUp ? "+" : ""}{data.navChangePct.toFixed(2)}%
            </div>
          </div>

          {/* Price chart */}
          {priceChartData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-4">Price (1 Year)</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={priceChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ytPriceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                    labelStyle={{ color: "#9ca3af", fontSize: 12 }}
                    itemStyle={{ color: chartColor }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
                  />
                  <ReferenceLine
                    y={data.priceOneYearAgo}
                    stroke="#6b7280"
                    strokeDasharray="4 4"
                    label={{ value: "1Y ago", fill: "#6b7280", fontSize: 10, position: "insideTopRight" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill="url(#ytPriceGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Distribution chart */}
          {divChartData.length > 1 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-4">Distribution History</p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={divChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v.toFixed(2)}`}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                    labelStyle={{ color: "#9ca3af", fontSize: 12 }}
                    itemStyle={{ color: "#22c55e" }}
                    formatter={(v: number) => [`$${v.toFixed(4)}`, "Distribution"]}
                  />
                  <Bar dataKey="amount" fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* How scoring works */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">How Scoring Works</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-green-400 font-bold w-20 shrink-0">Safe ✓</span>
                <span className="text-gray-400">NAV is up over the past year. You&apos;re getting paid to hold a growing asset.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow-400 font-bold w-20 shrink-0">Caution ⚠</span>
                <span className="text-gray-400">NAV declined, but TTM yield ≥ |NAV change|. Income offsets the loss — net total return is positive or near breakeven.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-400 font-bold w-20 shrink-0">Trap ✕</span>
                <span className="text-gray-400">NAV declined more than you earned from distributions. High yield is misleading — you&apos;re losing money overall.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preset ETFs */}
      {!data && !loading && (
        <div className="mt-8">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Quick Analyze</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_TICKERS.map((etf) => (
              <button
                key={etf}
                onClick={() => lookup(etf)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium text-gray-300 hover:text-white transition-colors border border-gray-700"
              >
                {etf}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
  highlight,
  danger,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  danger?: boolean;
}) {
  const valueColor = highlight ? "text-green-400" : danger ? "text-red-400" : "text-white";
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <p className="text-gray-400 text-xs mb-0.5">{label}</p>
      <p className={`font-bold text-base ${valueColor}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}
