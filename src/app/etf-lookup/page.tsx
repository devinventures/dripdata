"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import TickerSearch from "@/components/TickerSearch";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface FundData {
  expenseRatio: number | null;
  totalAssets: number | null;
  navPrice: number | null;
  fundFamily: string | null;
  category: string | null;
  legalType: string | null;
  turnoverRate: number | null;
  beta: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  topHoldings: { symbol: string; name: string; pct: number }[];
  sectorWeightings: { sector: string; pct: number }[];
  assetAllocation: { cash: number | null; stock: number | null; bond: number | null };
}

interface ETFData {
  ticker: string;
  name: string;
  description: string | null;
  homepage: string | null;
  market_cap: number | null;
  list_date: string | null;
  instrument_type: string | null;
  returns: {
    ytd: number | null;
    oneYear: number | null;
    threeYear: number | null;
    fiveYear: number | null;
  } | null;
  fund: FundData | null;
  price: {
    current: number;
    open: number;
    high: number;
    low: number;
    volume: number;
    vwap: number | null;
    change: number;
    change_pct: number;
  };
  week52: { high: number | null; low: number | null; position: number | null };
  priceHistory: { date: string; close: number }[];
  dividends: {
    yield: number | null;
    annual: number | null;
    growth_yoy: number | null;
    cagr: number | null;
    latest: { amount: number; ex_date: string; pay_date: string; frequency: number } | null;
    history: { amount: number; ex_date: string; pay_date: string }[];
  };
}

const freqLabel: Record<number, string> = { 1: "Annual", 2: "Semi-annual", 4: "Quarterly", 12: "Monthly" };

type ChartRange = "1M" | "3M" | "6M" | "1Y" | "2Y" | "5Y";
const chartRanges: ChartRange[] = ["1M", "3M", "6M", "1Y", "2Y", "5Y"];
const rangeDays: Record<ChartRange, number> = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "2Y": 730, "5Y": 1825 };

export default function ETFLookup() {
  return (
    <Suspense>
      <ETFLookupInner />
    </Suspense>
  );
}

function ETFLookupInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlTicker = searchParams.get("t")?.toUpperCase() ?? "";

  const [ticker, setTicker] = useState(urlTicker);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ETFData | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>("1Y");
  const abortRef = useRef<AbortController | null>(null);

  // Run lookup when URL ticker param changes (handles navigation back/forward)
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

  async function runLookup(t: string) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch(`/api/etf/${t}`, { signal: abortRef.current.signal });
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
    router.push(`/etf-lookup?t=${t}`);
  }

  const priceUp = data ? data.price.change >= 0 : true;

  // Filter price history by selected range
  const filteredHistory = (() => {
    if (!data) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays[chartRange]);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    return data.priceHistory.filter((p) => p.date >= cutoffStr);
  })();

  // Range gain/loss
  const rangeStart = filteredHistory[0]?.close ?? null;
  const rangeEnd = filteredHistory[filteredHistory.length - 1]?.close ?? null;
  const rangeChange = rangeStart && rangeEnd ? rangeEnd - rangeStart : null;
  const rangePct = rangeStart && rangeChange !== null ? (rangeChange / rangeStart) * 100 : null;
  const rangeUp = rangePct !== null ? rangePct >= 0 : true;
  const chartColor = rangeUp ? "#22c55e" : "#f87171";

  // Space out labels based on range
  const labelInterval = { "1M": 5, "3M": 15, "6M": 25, "1Y": 40, "2Y": 60, "5Y": 120 }[chartRange];
  const priceChartData = filteredHistory.map((p, i) => ({
    ...p,
    label: i % labelInterval === 0 ? p.date.slice(0, 7) : "",
  }));

  // Dividend bar chart data (oldest first)
  const divChartData = data
    ? [...data.dividends.history].reverse().map((d) => ({
        date: d.ex_date.slice(0, 7),
        amount: d.amount,
      }))
    : [];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">ETF Lookup</h1>
      <p className="text-gray-400 text-sm mb-6">
        Full data snapshot for any ETF or dividend stock — price, yield, dividends, and more.
      </p>

      <div className="flex gap-2 mb-6">
        <TickerSearch
          value={ticker}
          onChange={setTicker}
          onSelect={lookup}
          placeholder="Search ticker (e.g. SCHD, VYM, JEPI)"
          className="flex-1"
        />
        <button
          onClick={() => lookup()}
          disabled={loading || !ticker.trim()}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          {loading ? "Loading…" : "Look up"}
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
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">{data.ticker}</p>
                <h2 className="text-xl font-bold">{data.name}</h2>
                {/* Metadata badges */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {(data.fund?.legalType ?? data.instrument_type) && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700 px-2.5 py-1 rounded-full">
                      {data.fund?.legalType ?? data.instrument_type}
                    </span>
                  )}
                  {data.fund?.category && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700 px-2.5 py-1 rounded-full">
                      {data.fund.category}
                    </span>
                  )}
                  {data.fund?.fundFamily && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 border border-gray-300 dark:border-gray-700 px-2.5 py-1 rounded-full">
                      {data.fund.fundFamily}
                    </span>
                  )}
                  {data.list_date && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700 px-2.5 py-1 rounded-full">
                      Since {data.list_date.slice(0, 4)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-bold">${data.price.current.toFixed(2)}</p>
                <p className={`text-sm font-medium ${priceUp ? "text-brand-400" : "text-red-400"}`}>
                  {priceUp ? "+" : ""}{data.price.change.toFixed(2)} ({priceUp ? "+" : ""}{data.price.change_pct.toFixed(2)}%)
                </p>
              </div>
            </div>
            {data.description && (
              <p className="text-gray-400 text-sm mt-3 leading-relaxed line-clamp-4">{data.description}</p>
            )}
          </div>

          {/* Price chart with range selector */}
          {priceChartData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Price History</p>
                  {rangePct !== null && (
                    <p className={`text-sm font-semibold mt-0.5 ${rangeUp ? "text-brand-400" : "text-red-400"}`}>
                      {rangeUp ? "+" : ""}{rangePct.toFixed(2)}%
                      <span className="text-gray-500 font-normal ml-1.5">
                        ({rangeUp ? "+" : ""}${rangeChange!.toFixed(2)}) over {chartRange}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  {chartRanges.map((r) => (
                    <button
                      key={r}
                      onClick={() => setChartRange(r)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        chartRange === r
                          ? "bg-brand-600 text-white"
                          : "text-gray-400 hover:text-white hover:bg-gray-800"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={priceChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
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
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Close"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill="url(#priceGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Price stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Open" value={`$${data.price.open.toFixed(2)}`} />
            <StatBox label="Day High" value={`$${data.price.high.toFixed(2)}`} />
            <StatBox label="Day Low" value={`$${data.price.low.toFixed(2)}`} />
            <StatBox label="VWAP" value={data.price.vwap ? `$${data.price.vwap.toFixed(2)}` : "N/A"} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Volume" value={data.price.volume.toLocaleString()} />
            <StatBox label="Market Cap" value={data.market_cap ? `$${(data.market_cap / 1e9).toFixed(2)}B` : "N/A"} />
          </div>

          {/* 52-week range slider */}
          {data.week52.high && data.week52.low && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">52-Week Range</p>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm text-gray-400 w-16">${data.week52.low.toFixed(2)}</span>
                <div className="flex-1 bg-gray-700 rounded-full h-2 relative">
                  <div
                    className="bg-brand-800/50 h-2 rounded-full"
                    style={{ width: `${data.week52.position?.toFixed(1) ?? 50}%` }}
                  />
                  <div
                    className="absolute top-0 w-3 h-3 -mt-0.5 bg-brand-500 rounded-full shadow"
                    style={{ left: `calc(${data.week52.position?.toFixed(1) ?? 50}% - 6px)` }}
                  />
                </div>
                <span className="text-sm text-gray-400 w-16 text-right">${data.week52.high.toFixed(2)}</span>
              </div>
              {data.week52.position !== null && (
                <p className="text-gray-500 text-xs text-center">
                  Current price is in the {data.week52.position.toFixed(0)}th percentile of the past year
                </p>
              )}
            </div>
          )}

          {/* Fund Details */}
          {data.fund && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Fund Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBox
                  label="Expense Ratio (MER)"
                  value={data.fund.expenseRatio != null ? `${(data.fund.expenseRatio * 100).toFixed(2)}%` : "N/A"}
                  highlight={data.fund.expenseRatio != null && data.fund.expenseRatio < 0.005}
                />
                <StatBox
                  label="AUM"
                  value={data.fund.totalAssets != null
                    ? data.fund.totalAssets >= 1e9
                      ? `$${(data.fund.totalAssets / 1e9).toFixed(2)}B`
                      : `$${(data.fund.totalAssets / 1e6).toFixed(0)}M`
                    : "N/A"}
                />
                <StatBox
                  label="NAV"
                  value={data.fund.navPrice != null ? `$${data.fund.navPrice.toFixed(2)}` : "N/A"}
                />
                <StatBox
                  label="Turnover Rate"
                  value={data.fund.turnoverRate != null ? `${(data.fund.turnoverRate * 100).toFixed(0)}%` : "N/A"}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <StatBox
                  label="Beta (3Y)"
                  value={data.fund.beta != null ? data.fund.beta.toFixed(2) : "N/A"}
                />
                <StatBox
                  label="Inception"
                  value={data.list_date ?? "N/A"}
                />
                <StatBox
                  label="50-Day Avg"
                  value={data.fund.fiftyDayAverage != null ? `$${data.fund.fiftyDayAverage.toFixed(2)}` : "N/A"}
                />
                <StatBox
                  label="200-Day Avg"
                  value={data.fund.twoHundredDayAverage != null ? `$${data.fund.twoHundredDayAverage.toFixed(2)}` : "N/A"}
                />
              </div>
              {(data.fund.peRatio != null || data.fund.pbRatio != null || data.fund.assetAllocation.stock != null) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  {data.fund.peRatio != null && <StatBox label="P/E (Holdings)" value={data.fund.peRatio.toFixed(2)} />}
                  {data.fund.pbRatio != null && <StatBox label="P/B (Holdings)" value={data.fund.pbRatio.toFixed(2)} />}
                  {data.fund.assetAllocation.stock != null && (
                    <StatBox label="Equity %" value={`${(data.fund.assetAllocation.stock * 100).toFixed(1)}%`} />
                  )}
                  {data.fund.assetAllocation.bond != null && data.fund.assetAllocation.bond > 0 && (
                    <StatBox label="Bond %" value={`${(data.fund.assetAllocation.bond * 100).toFixed(1)}%`} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Price Performance */}
          {data.returns && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Price Performance</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "YTD", val: data.returns.ytd },
                  { label: "1 Year", val: data.returns.oneYear },
                  { label: "3 Year", val: data.returns.threeYear },
                  { label: "5 Year", val: data.returns.fiveYear },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-0.5">{label}</p>
                    {val != null ? (
                      <p className={`font-bold text-base ${val >= 0 ? "text-brand-400" : "text-red-400"}`}>
                        {val >= 0 ? "+" : ""}{val.toFixed(2)}%
                      </p>
                    ) : (
                      <p className="font-bold text-base text-gray-600">N/A</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-gray-500 text-xs mt-3">Price-only returns, excluding dividends reinvested</p>
            </div>
          )}

          {/* Top Holdings */}
          {data.fund?.topHoldings && data.fund.topHoldings.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Top Holdings</p>
              <div className="space-y-2.5">
                {data.fund.topHoldings.map((h, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-gray-600 text-xs w-4 shrink-0 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {h.symbol && (
                            <span className="text-brand-400 text-xs font-mono font-semibold shrink-0">{h.symbol}</span>
                          )}
                          <span className="text-gray-300 text-sm truncate">{h.name}</span>
                        </div>
                        <span className="text-white text-sm font-semibold shrink-0">{(h.pct * 100).toFixed(2)}%</span>
                      </div>
                      <div className="bg-gray-800 rounded-full h-1">
                        <div
                          className="bg-brand-500 h-1 rounded-full transition-all"
                          style={{ width: `${Math.min((h.pct / data.fund!.topHoldings[0].pct) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sector Weightings */}
          {data.fund?.sectorWeightings && data.fund.sectorWeightings.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Sector Weightings</p>
              <div className="space-y-2">
                {data.fund.sectorWeightings.map((s) => (
                  <div key={s.sector} className="flex items-center gap-3">
                    <span className="text-gray-400 text-xs w-36 shrink-0 capitalize">
                      {s.sector.replace(/_/g, " ")}
                    </span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-brand-600 h-2 rounded-full"
                        style={{ width: `${Math.min(s.pct * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-300 text-xs font-medium w-10 text-right shrink-0">
                      {(s.pct * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dividend stats */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Dividend Info</p>
            {data.dividends.latest ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <StatBox label="Dividend Yield" value={data.dividends.yield ? `${data.dividends.yield.toFixed(2)}%` : "N/A"} highlight />
                  <StatBox label="Annual Dividend" value={data.dividends.annual ? `$${data.dividends.annual.toFixed(4)}` : "N/A"} />
                  <StatBox label="Per Payment" value={`$${data.dividends.latest.amount.toFixed(4)}`} />
                  <StatBox label="Frequency" value={freqLabel[data.dividends.latest.frequency] ?? `${data.dividends.latest.frequency}x/yr`} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                  <StatBox
                    label="YoY Div Growth"
                    value={data.dividends.growth_yoy !== null ? `${data.dividends.growth_yoy >= 0 ? "+" : ""}${data.dividends.growth_yoy.toFixed(2)}%` : "N/A"}
                    highlight={!!data.dividends.growth_yoy && data.dividends.growth_yoy > 0}
                  />
                  <StatBox
                    label="Div CAGR"
                    value={data.dividends.cagr !== null ? `${data.dividends.cagr >= 0 ? "+" : ""}${data.dividends.cagr.toFixed(2)}%` : "N/A"}
                    highlight={!!data.dividends.cagr && data.dividends.cagr > 0}
                  />
                  <StatBox label="Last Ex-Date" value={data.dividends.latest.ex_date} />
                </div>

                {/* Dividend bar chart */}
                {divChartData.length > 1 && (
                  <>
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Dividend Payment History</p>
                    <ResponsiveContainer width="100%" height={160}>
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
                          formatter={(v: number) => [`$${v.toFixed(4)}`, "Dividend"]}
                        />
                        <Bar dataKey="amount" fill="#22c55e" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </>
            ) : (
              <p className="text-gray-500 text-sm">No dividend data found for this ticker.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <p className="text-gray-400 text-xs mb-0.5">{label}</p>
      <p className={`font-bold text-base ${highlight ? "text-brand-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
