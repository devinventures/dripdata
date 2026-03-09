"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Dividend { amount: number; exDate: string; t: number }

interface FundSummary {
  beta: number | null;
  expenseRatio: number | null;
  totalAssets: number | null;
  category: string | null;
  fundFamily: string | null;
  sectorWeightings: { sector: string; pct: number }[];
  topHoldings: { symbol: string; name: string; pct: number }[];
  assetAllocation: { cash: number | null; stock: number | null; bond: number | null };
}

interface StockProfile {
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  country: string | null;
  beta: number | null;
}

interface InsightHolding {
  ticker: string;
  shares: number;
  cost_basis: number | null;
  purchase_date: string | null;
  name: string;
  price: number | null;
  annual_dividend: number | null;
  yield_pct: number | null;
  dividends: Dividend[];
  instrumentType: string | null;
  firstTradeDate: string | null;
  high52w: number | null;
  low52w: number | null;
  priceReturn1y: number | null;
  fundSummary: FundSummary | null;
  stockProfile: StockProfile | null;
  error: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function inferFrequency(dividends: Dividend[]): number {
  if (dividends.length < 2) return 4;
  const count = Math.min(8, dividends.length);
  let total = 0;
  for (let i = 0; i < count - 1; i++) total += dividends[i].t - dividends[i + 1].t;
  const avgDays = total / (count - 1) / 86_400_000;
  if (avgDays < 12) return 52;
  if (avgDays < 45) return 12;
  if (avgDays < 120) return 4;
  if (avgDays < 250) return 2;
  return 1;
}

function predictNextExDate(dividends: Dividend[]): Date | null {
  if (dividends.length < 2) return null;
  const count = Math.min(6, dividends.length);
  let totalGap = 0;
  for (let i = 0; i < count - 1; i++) totalGap += dividends[i].t - dividends[i + 1].t;
  const avgGap = totalGap / (count - 1);
  let next = dividends[0].t + avgGap;
  // Advance past today if already occurred
  while (next < Date.now() - 7 * 86_400_000) next += avgGap;
  return new Date(next);
}

function dividendGrowthRate(dividends: Dividend[], freq: number): number | null {
  const n = Math.min(freq, 4); // compare last n vs prior n payments
  if (dividends.length < n * 2) return null;
  const recent = dividends.slice(0, n).reduce((s, d) => s + d.amount, 0) / n;
  const prior  = dividends.slice(n, n * 2).reduce((s, d) => s + d.amount, 0) / n;
  if (prior === 0) return null;
  return ((recent - prior) / prior) * 100;
}

function dividendConsistencyScore(dividends: Dividend[], freq: number): number {
  const yearMs = 365 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - yearMs;
  const actual = dividends.filter((d) => d.t >= cutoff).length;
  return Math.min(100, Math.round((actual / freq) * 100));
}

function fmt$(n: number | null, dec = 2) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtPct(n: number | null, showPlus = false) {
  if (n == null) return "—";
  return `${showPlus && n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtMs(t: number): string {
  const diff = t - Date.now();
  const days = Math.round(diff / 86_400_000);
  if (days < 0) return "past";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 30) return `in ${days}d`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Prettify Yahoo's camelCase sector names → readable labels
function formatSector(s: string): string {
  const map: Record<string, string> = {
    realestate: "Real Estate", technology: "Technology", healthcare: "Healthcare",
    financialServices: "Financials", utilities: "Utilities", consumerDefensive: "Consumer Staples",
    consumerCyclical: "Consumer Discret.", industrials: "Industrials", energy: "Energy",
    basicMaterials: "Materials", communicationServices: "Comm. Services",
  };
  return map[s] ?? s.replace(/([A-Z])/g, " $1").trim();
}

function scoreColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Attention";
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = scoreColor(score);
  const dash = score * 2.199; // circumference ≈ 219.9 for r=35
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="35" fill="none" stroke="#1f2937" strokeWidth="10" />
          <circle
            cx="50" cy="50" r="35" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} 219.9`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{score}</span>
        </div>
      </div>
      <p className="text-xs font-medium mt-1.5" style={{ color }}>{scoreLabel(score)}</p>
      <p className="text-gray-500 text-xs mt-0.5">{label}</p>
    </div>
  );
}

function Alert({ type, children }: { type: "warn" | "info" | "success"; children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const styles = isDark
    ? {
        warn:    "bg-amber-950/40 border-amber-700/50 text-amber-300",
        info:    "bg-blue-950/40 border-blue-700/50 text-blue-300",
        success: "bg-green-950/40 border-green-700/50 text-green-300",
      }
    : {
        warn:    "bg-amber-50 border-amber-300 text-amber-800",
        info:    "bg-blue-50 border-blue-300 text-blue-800",
        success: "bg-green-50 border-green-300 text-green-800",
      };

  const icons = { warn: "⚠️", info: "💡", success: "✅" };
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm ${styles[type]}`}>
      <span className="shrink-0 mt-0.5">{icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const params = useParams<{ id: string }>();
  const portfolioId = params.id;
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [holdings, setHoldings] = useState<InsightHolding[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/portfolio-groups/${portfolioId}/insights`);
    if (res.ok) setHoldings(await res.json());
    setLoading(false);
  }, [portfolioId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-3">
        <div className="w-6 h-6 border-2 border-gray-700 border-t-brand-500 rounded-full animate-spin" />
        <p className="text-sm">Analysing your portfolio…</p>
        <p className="text-xs text-gray-600">Fetching 2 years of data + fund details</p>
      </div>
    );
  }

  const loaded = holdings.filter((h) => !h.error && h.price != null);

  if (loaded.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <p className="text-3xl mb-3">🔍</p>
        <p className="text-gray-300 font-medium mb-1">No holdings to analyse</p>
        <p className="text-gray-500 text-sm">Add some holdings on the Holdings tab first.</p>
      </div>
    );
  }

  // ── Computed Metrics ──────────────────────────────────────────────────────────

  const totalValue = loaded.reduce((s, h) => s + h.price! * h.shares, 0);
  const totalIncome = loaded.reduce((s, h) => s + (h.annual_dividend ?? 0) * h.shares, 0);

  // Diversification (inverse HHI)
  const weights = loaded.map((h) => (h.price! * h.shares) / totalValue);
  const hhi = weights.reduce((s, w) => s + w * w, 0);
  const diversificationScore = Math.round((1 - hhi) * 100);

  // Largest position
  const largestHolding = loaded.reduce((max, h) =>
    h.price! * h.shares > (max.price! * max.shares) ? h : max
  );
  const largestPct = totalValue > 0 ? (largestHolding.price! * largestHolding.shares / totalValue) * 100 : 0;

  // Income concentration
  const largestIncomeHolder = loaded.reduce((max, h) =>
    (h.annual_dividend ?? 0) * h.shares > (max.annual_dividend ?? 0) * max.shares ? h : max
  );
  const largestIncomePct = totalIncome > 0
    ? ((largestIncomeHolder.annual_dividend ?? 0) * largestIncomeHolder.shares / totalIncome) * 100
    : 0;

  // Per-holding dividend metrics
  const holdingMetrics = loaded.map((h) => {
    const freq = inferFrequency(h.dividends);
    const growthRate = dividendGrowthRate(h.dividends, freq);
    const consistency = dividendConsistencyScore(h.dividends, freq);
    const nextDate = predictNextExDate(h.dividends);
    const yoc = h.cost_basis && h.annual_dividend ? (h.annual_dividend / h.cost_basis) * 100 : null;
    const rangePos = h.high52w && h.low52w && h.high52w > h.low52w
      ? ((h.price! - h.low52w) / (h.high52w - h.low52w)) * 100
      : null;
    return { ...h, freq, growthRate, consistency, nextDate, yoc, rangePos };
  });

  // Income stability score — based on monthly payer %, income distribution across 12 months
  const monthlyPayerIncome = holdingMetrics
    .filter((h) => h.freq >= 12 && (h.annual_dividend ?? 0) > 0)
    .reduce((s, h) => s + (h.annual_dividend ?? 0) * h.shares, 0);
  const monthlyPayerPct = totalIncome > 0 ? (monthlyPayerIncome / totalIncome) * 100 : 0;
  const incomeStabilityScore = Math.min(100, Math.round(monthlyPayerPct * 0.6 + diversificationScore * 0.4));

  // Dividend health score — avg of consistency scores
  const avgConsistency = holdingMetrics.reduce((s, h) => s + h.consistency, 0) / holdingMetrics.length;
  const growthScoreBoost = holdingMetrics.filter((h) => (h.growthRate ?? 0) > 0).length / holdingMetrics.length * 20;
  const dividendHealthScore = Math.min(100, Math.round(avgConsistency * 0.8 + growthScoreBoost));

  // Overall health score
  const healthScore = Math.round(
    diversificationScore * 0.35 +
    incomeStabilityScore * 0.30 +
    dividendHealthScore  * 0.35
  );

  // Monthly income projection (for coverage heatmap)
  const monthLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthlyProjected = Array(12).fill(0) as number[];
  for (const h of holdingMetrics) {
    if (!h.annual_dividend || h.annual_dividend <= 0 || !h.dividends.length) continue;
    const freq = h.freq;
    const perPayment = (h.annual_dividend / freq) * h.shares;
    const payMonths = new Set<number>();
    const lookback = Math.min(Math.max(freq * 2, 4), h.dividends.length);
    for (let j = 0; j < lookback; j++) payMonths.add(new Date(h.dividends[j].t).getMonth());
    for (const m of payMonths) monthlyProjected[m] += perPayment;
  }
  const maxMonthlyIncome = Math.max(...monthlyProjected, 0.01);

  // ETF holdings with fund summaries
  const etfHoldings = holdingMetrics.filter((h) => h.instrumentType === "ETF" && h.fundSummary);

  // Alerts
  const alerts: { type: "warn" | "info" | "success"; text: string }[] = [];

  if (loaded.length === 1) {
    alerts.push({ type: "warn", text: "You only have 1 holding — consider adding more to spread your risk." });
  }
  if (largestPct > 60) {
    alerts.push({ type: "warn", text: `${largestHolding.ticker} makes up ${largestPct.toFixed(0)}% of your portfolio value — this is very concentrated. Consider rebalancing.` });
  } else if (largestPct > 35) {
    alerts.push({ type: "info", text: `${largestHolding.ticker} is your largest position at ${largestPct.toFixed(0)}% of your portfolio.` });
  }
  if (largestIncomePct > 70) {
    alerts.push({ type: "warn", text: `${largestIncomeHolder.ticker} generates ${largestIncomePct.toFixed(0)}% of your dividend income — a dividend cut would significantly impact your income.` });
  }

  const cutters = holdingMetrics.filter((h) => h.growthRate !== null && h.growthRate < -10);
  if (cutters.length > 0) {
    alerts.push({ type: "warn", text: `${cutters.map((h) => h.ticker).join(", ")} ${cutters.length === 1 ? "has" : "have"} reduced dividend payments over the past year — monitor closely.` });
  }

  const strongGrowers = holdingMetrics.filter((h) => h.growthRate !== null && h.growthRate > 5);
  if (strongGrowers.length > 0) {
    alerts.push({ type: "success", text: `${strongGrowers.map((h) => h.ticker).join(", ")} ${strongGrowers.length === 1 ? "has" : "have"} grown dividends by 5%+ over the past year — great sign of dividend health.` });
  }

  const noMonthlyPayers = holdingMetrics.every((h) => h.freq < 12);
  if (noMonthlyPayers && totalIncome > 0) {
    alerts.push({ type: "info", text: "All your holdings pay quarterly or less. Adding a monthly-payer (e.g. SCHD, JEPI, AGNC) would smooth your monthly cash flow." });
  }

  const hasCostBasis = loaded.some((h) => h.cost_basis != null);
  const yocBeaters = holdingMetrics.filter((h) => h.yoc !== null && h.yield_pct !== null && h.yoc > h.yield_pct!);
  if (yocBeaters.length > 0) {
    alerts.push({ type: "success", text: `Your yield-on-cost for ${yocBeaters.map((h) => h.ticker).join(", ")} exceeds the current yield — you're earning above the market rate thanks to price appreciation.` });
  }

  // ── Market Diversification Aggregation ───────────────────────────────────────

  // 1. Aggregate sector exposure weighted by portfolio value
  //    ETFs contribute their sectorWeightings × holding weight
  //    Individual stocks contribute 100% of their weight to their sector
  const sectorMap: Record<string, number> = {};
  for (const h of loaded) {
    const w = totalValue > 0 ? (h.price! * h.shares) / totalValue : 0;
    const fs = h.fundSummary;
    const sp = h.stockProfile;
    if (fs && fs.sectorWeightings.length > 0) {
      for (const sw of fs.sectorWeightings) {
        const key = formatSector(sw.sector);
        sectorMap[key] = (sectorMap[key] ?? 0) + w * sw.pct;
      }
    } else if (sp?.sector) {
      const key = sp.sector;
      sectorMap[key] = (sectorMap[key] ?? 0) + w;
    }
  }
  const sectorData = Object.entries(sectorMap)
    .map(([sector, pct]) => ({ sector, pct: pct * 100 }))
    .filter((s) => s.pct > 0.5)
    .sort((a, b) => b.pct - a.pct);

  // 2. Market cap distribution
  //    From ETF category: Large/Mid/Small Blend → assign cap bucket
  //    From stock: marketCap number → bucket
  const capMap: Record<string, number> = { "Large Cap": 0, "Mid Cap": 0, "Small Cap": 0, "Unknown": 0 };
  for (const h of loaded) {
    const w = totalValue > 0 ? (h.price! * h.shares) / totalValue : 0;
    const cat = h.fundSummary?.category ?? "";
    const mc  = h.stockProfile?.marketCap ?? null;
    if (cat) {
      if (/large/i.test(cat)) capMap["Large Cap"] += w;
      else if (/mid/i.test(cat)) capMap["Mid Cap"] += w;
      else if (/small/i.test(cat)) capMap["Small Cap"] += w;
      else capMap["Unknown"] += w;
    } else if (mc != null) {
      if (mc >= 10e9) capMap["Large Cap"] += w;
      else if (mc >= 2e9) capMap["Mid Cap"] += w;
      else capMap["Small Cap"] += w;
    } else {
      capMap["Unknown"] += w;
    }
  }
  const capData = Object.entries(capMap)
    .map(([label, pct]) => ({ label, pct: pct * 100 }))
    .filter((c) => c.pct > 0.5)
    .sort((a, b) => b.pct - a.pct);

  // 3. Geographic exposure
  //    ETF category containing "Foreign" / "Emerging" → international/emerging
  //    Individual stocks: country field
  const geoMap: Record<string, number> = {};
  for (const h of loaded) {
    const w = totalValue > 0 ? (h.price! * h.shares) / totalValue : 0;
    const cat     = h.fundSummary?.category ?? "";
    const country = h.stockProfile?.country ?? null;
    if (cat) {
      if (/emerging/i.test(cat)) geoMap["Emerging Markets"] = (geoMap["Emerging Markets"] ?? 0) + w;
      else if (/foreign|international|world|global/i.test(cat)) geoMap["International"] = (geoMap["International"] ?? 0) + w;
      else geoMap["United States"] = (geoMap["United States"] ?? 0) + w;
    } else if (country) {
      const label = country === "United States" ? "United States" : country;
      geoMap[label] = (geoMap[label] ?? 0) + w;
    } else {
      geoMap["United States"] = (geoMap["United States"] ?? 0) + w;
    }
  }
  const geoData = Object.entries(geoMap)
    .map(([region, pct]) => ({ region, pct: pct * 100 }))
    .filter((g) => g.pct > 0.5)
    .sort((a, b) => b.pct - a.pct);

  const hasMktData = sectorData.length > 0 || capData.length > 0;

  // ── Upcoming ex-dates sorted ascending
  const upcoming = holdingMetrics
    .filter((h) => h.nextDate !== null)
    .map((h) => ({ ticker: h.ticker, name: h.name, date: h.nextDate! }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 10);

  // ── Render ──────────────────────────────────────────────────────────────────

  const cardBg = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200";
  const subText = isDark ? "text-gray-400" : "text-gray-500";
  const divider = isDark ? "border-gray-800" : "border-gray-200";

  return (
    <div className="space-y-6">

      {/* ── Health Scores ── */}
      <div className={`${cardBg} border rounded-xl p-6`}>
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Portfolio Health</h2>
        <p className={`text-xs ${subText} mb-6`}>Composite score based on diversification, income stability and dividend health</p>
        <div className="flex flex-wrap justify-around gap-6">
          <div className="flex flex-col items-center gap-1">
            <ScoreGauge score={healthScore} label="Overall Score" />
          </div>
          <div className={`w-px ${isDark ? "bg-gray-800" : "bg-gray-200"} hidden sm:block`} />
          <ScoreGauge score={diversificationScore} label="Diversification" />
          <div className={`w-px ${isDark ? "bg-gray-800" : "bg-gray-200"} hidden sm:block`} />
          <ScoreGauge score={incomeStabilityScore} label="Income Stability" />
          <div className={`w-px ${isDark ? "bg-gray-800" : "bg-gray-200"} hidden sm:block`} />
          <ScoreGauge score={dividendHealthScore} label="Dividend Health" />
        </div>

        {/* Quick stats row */}
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t ${divider}`}>
          <QuickStat label="Holdings" value={String(loaded.length)} />
          <QuickStat label="ETFs" value={String(loaded.filter((h) => h.instrumentType === "ETF").length)} />
          <QuickStat label="Avg Yield" value={fmtPct(totalIncome > 0 && totalValue > 0 ? (totalIncome / totalValue) * 100 : null)} green />
          <QuickStat label="Monthly Income" value={fmt$(totalIncome / 12)} green />
        </div>
      </div>

      {/* ── Smart Alerts ── */}
      {alerts.length > 0 && (
        <div className="space-y-2.5">
          <h2 className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>Smart Alerts</h2>
          {alerts.map((a, i) => (
            <Alert key={i} type={a.type}>{a.text}</Alert>
          ))}
        </div>
      )}

      {/* ── Diversification Deep Dive ── */}
      <div className={`${cardBg} border rounded-xl overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${divider}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-300">Diversification Analysis</h2>
              <p className={`text-xs ${subText} mt-0.5`}>How your capital and income are distributed across holdings</p>
            </div>
            {/* Score badge */}
            <div className="flex items-center gap-2">
              <div
                className="text-lg font-bold w-12 h-12 rounded-full flex items-center justify-center border-2"
                style={{ color: scoreColor(diversificationScore), borderColor: scoreColor(diversificationScore) + "55" }}
              >
                {diversificationScore}
              </div>
            </div>
          </div>

          {/* Score scale */}
          <div className="mt-4">
            <div className="relative h-2 rounded-full overflow-hidden bg-gradient-to-r from-red-600 via-amber-500 to-green-500">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-gray-900 shadow-lg"
                style={{ left: `calc(${diversificationScore}% - 6px)` }}
              />
            </div>
            <div className={`flex justify-between text-[10px] mt-1 ${subText}`}>
              <span>Highly Concentrated</span>
              <span>Moderately Diversified</span>
              <span>Well Diversified</span>
            </div>
          </div>
        </div>

        <div className={`grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x ${isDark ? "divide-gray-800" : "divide-gray-200"}`}>

          {/* Position Weight Breakdown */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>Position Weight by Value</p>
              <span className={`text-[10px] ${subText}`}>equal weight = {(100 / loaded.length).toFixed(1)}%</span>
            </div>
            <div className="space-y-2.5">
              {[...loaded]
                .sort((a, b) => b.price! * b.shares - a.price! * a.shares)
                .map((h) => {
                  const pct = totalValue > 0 ? (h.price! * h.shares / totalValue) * 100 : 0;
                  const equalWeight = 100 / loaded.length;
                  const barColor = pct > 50 ? "#ef4444" : pct > 30 ? "#f59e0b" : "#22c55e";
                  return (
                    <div key={h.ticker}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-white">{h.ticker}</span>
                        <div className="flex items-center gap-2">
                          {pct > equalWeight * 1.5 && (
                            <span className="text-[10px] text-amber-400">overweight</span>
                          )}
                          <span className="text-xs font-bold" style={{ color: barColor }}>{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
                        {/* Equal weight reference tick */}
                        <div
                          className="absolute top-0 h-full w-0.5 bg-gray-500/60"
                          style={{ left: `${equalWeight}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
            <p className={`text-[10px] ${subText} mt-3`}>
              ┊ marks equal weight ({(100 / loaded.length).toFixed(1)}%)
            </p>
          </div>

          {/* Income Weight Breakdown */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>Income Concentration</p>
              <span className={`text-[10px] ${subText}`}>% of total annual income</span>
            </div>
            {totalIncome > 0 ? (
              <div className="space-y-2.5">
                {[...loaded]
                  .filter((h) => h.annual_dividend && h.annual_dividend > 0)
                  .sort((a, b) => (b.annual_dividend! * b.shares) - (a.annual_dividend! * a.shares))
                  .map((h) => {
                    const inc = (h.annual_dividend ?? 0) * h.shares;
                    const pct = totalIncome > 0 ? (inc / totalIncome) * 100 : 0;
                    const barColor = pct > 60 ? "#ef4444" : pct > 35 ? "#f59e0b" : "#4f46e5";
                    return (
                      <div key={h.ticker}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white">{h.ticker}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] ${subText}`}>{fmt$(inc)}/yr</span>
                            <span className="text-xs font-bold" style={{ color: barColor }}>{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className={`text-xs ${subText}`}>No dividend income data available.</p>
            )}
          </div>
        </div>

        {/* Bottom stats row */}
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-0 border-t ${divider}`}>
          {[
            {
              label: "Largest Position",
              value: `${largestHolding.ticker} · ${largestPct.toFixed(1)}%`,
              color: largestPct > 50 ? "text-red-400" : largestPct > 30 ? "text-amber-400" : "text-green-400",
            },
            {
              label: "Top Income Source",
              value: `${largestIncomeHolder.ticker} · ${largestIncomePct.toFixed(1)}%`,
              color: largestIncomePct > 60 ? "text-red-400" : largestIncomePct > 35 ? "text-amber-400" : "text-green-400",
            },
            {
              label: "ETFs",
              value: `${loaded.filter((h) => h.instrumentType === "ETF").length} of ${loaded.length}`,
              color: "text-white",
            },
            {
              label: "HHI Score",
              value: hhi.toFixed(3),
              color: hhi < 0.15 ? "text-green-400" : hhi < 0.35 ? "text-amber-400" : "text-red-400",
            },
          ].map((stat) => (
            <div key={stat.label} className={`px-5 py-3 border-r last:border-r-0 ${divider}`}>
              <p className={`text-[10px] uppercase tracking-wide ${subText} mb-0.5`}>{stat.label}</p>
              <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Market Diversification ── */}
      {hasMktData && (
        <div className={`${cardBg} border rounded-xl overflow-hidden`}>
          <div className={`px-5 py-4 border-b ${divider}`}>
            <h2 className="text-sm font-semibold text-gray-300">Market Diversification</h2>
            <p className={`text-xs ${subText} mt-0.5`}>
              Sector, market cap, and geographic exposure — weighted across your portfolio
            </p>
          </div>

          <div className={`grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x ${isDark ? "divide-gray-800" : "divide-gray-200"}`}>

            {/* Sector Exposure */}
            <div className="px-5 py-4">
              <p className={`text-xs font-semibold mb-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>Sector Exposure</p>
              {sectorData.length > 0 ? (
                <div className="space-y-2">
                  {sectorData.slice(0, 8).map((s, i) => {
                    const sectorColors = ["#4f46e5","#7c3aed","#2563eb","#0891b2","#059669","#d97706","#dc2626","#db2777"];
                    const col = sectorColors[i % sectorColors.length];
                    return (
                      <div key={s.sector}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-xs truncate max-w-[120px] ${isDark ? "text-gray-300" : "text-gray-700"}`}>{s.sector}</span>
                          <span className="text-xs font-bold text-white">{s.pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: col }} />
                        </div>
                      </div>
                    );
                  })}
                  {sectorData.length === 0 && (
                    <p className={`text-xs ${subText}`}>Sector data unavailable for these holdings.</p>
                  )}
                </div>
              ) : (
                <p className={`text-xs ${subText}`}>No sector data available.</p>
              )}
            </div>

            {/* Market Cap */}
            <div className="px-5 py-4">
              <p className={`text-xs font-semibold mb-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>Market Cap Exposure</p>
              {capData.filter(c => c.label !== "Unknown").length > 0 ? (
                <div className="space-y-3">
                  {capData.filter(c => c.label !== "Unknown").map((c) => {
                    const capColors: Record<string, string> = {
                      "Large Cap": "#4f46e5",
                      "Mid Cap":   "#0891b2",
                      "Small Cap": "#059669",
                    };
                    const col = capColors[c.label] ?? "#6b7280";
                    return (
                      <div key={c.label}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: col }} />
                            <span className={`text-xs ${isDark ? "text-gray-300" : "text-gray-700"}`}>{c.label}</span>
                          </div>
                          <span className="text-xs font-bold text-white">{c.pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, background: col }} />
                        </div>
                      </div>
                    );
                  })}
                  <p className={`text-[10px] ${subText} pt-1`}>
                    Large &gt;$10B · Mid $2B–$10B · Small &lt;$2B
                  </p>
                </div>
              ) : (
                <p className={`text-xs ${subText}`}>Market cap data unavailable.</p>
              )}
            </div>

            {/* Geographic Exposure */}
            <div className="px-5 py-4">
              <p className={`text-xs font-semibold mb-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>Geographic Exposure</p>
              {geoData.length > 0 ? (
                <div className="space-y-3">
                  {geoData.map((g) => {
                    const geoColors: Record<string, string> = {
                      "United States": "#4f46e5",
                      "International": "#0891b2",
                      "Emerging Markets": "#d97706",
                    };
                    const col = geoColors[g.region] ?? "#6b7280";
                    const flag: Record<string, string> = {
                      "United States": "🇺🇸",
                      "International": "🌍",
                      "Emerging Markets": "🌏",
                      "Canada": "🇨🇦",
                      "United Kingdom": "🇬🇧",
                    };
                    return (
                      <div key={g.region}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{flag[g.region] ?? "🌐"}</span>
                            <span className={`text-xs truncate max-w-[100px] ${isDark ? "text-gray-300" : "text-gray-700"}`}>{g.region}</span>
                          </div>
                          <span className="text-xs font-bold text-white">{g.pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${g.pct}%`, background: col }} />
                        </div>
                      </div>
                    );
                  })}
                  {geoData.length === 1 && geoData[0].region === "United States" && (
                    <p className={`text-[10px] ${subText} pt-1`}>
                      100% US-focused — consider international exposure for broader diversification.
                    </p>
                  )}
                </div>
              ) : (
                <p className={`text-xs ${subText}`}>Geographic data unavailable.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Upcoming Ex-Dividend Dates ── */}
      {upcoming.length > 0 && (
        <div className={`${cardBg} border rounded-xl overflow-hidden`}>
          <div className={`px-5 py-4 border-b ${divider}`}>
            <h2 className="text-sm font-semibold text-gray-300">Upcoming Ex-Dividend Dates</h2>
            <p className={`text-xs ${subText} mt-0.5`}>Predicted based on historical payment patterns</p>
          </div>
          <div className="divide-y divide-gray-800">
            {upcoming.map((u) => {
              const daysUntil = Math.round((u.date.getTime() - Date.now()) / 86_400_000);
              const isClose = daysUntil >= 0 && daysUntil <= 14;
              return (
                <div key={u.ticker} className={`flex items-center justify-between px-5 py-3 ${isClose ? "bg-brand-950/30" : ""}`}>
                  <div>
                    <span className="font-semibold text-white text-sm">{u.ticker}</span>
                    <span className={`text-xs ${subText} ml-2`}>{u.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${subText}`}>
                      {u.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isClose
                        ? "bg-brand-600/20 text-brand-400"
                        : "bg-gray-800 text-gray-400"
                    }`}>
                      {fmtMs(u.date.getTime())}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Dividend Health per Holding ── */}
      <div className={`${cardBg} border rounded-xl overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${divider}`}>
          <h2 className="text-sm font-semibold text-gray-300">Dividend Health</h2>
          <p className={`text-xs ${subText} mt-0.5`}>Growth rate, payment consistency and frequency per holding</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-xs uppercase border-b ${divider} text-gray-500`}>
                <th className="text-left px-5 py-2.5">Holding</th>
                <th className="text-right px-5 py-2.5">Frequency</th>
                <th className="text-right px-5 py-2.5">Div / Share</th>
                <th className="text-right px-5 py-2.5">1Y Growth</th>
                <th className="text-right px-5 py-2.5">Consistency</th>
                <th className="text-right px-5 py-2.5">Trend</th>
              </tr>
            </thead>
            <tbody>
              {holdingMetrics.map((h) => {
                const freqLabel: Record<number, string> = { 52: "Weekly", 12: "Monthly", 4: "Quarterly", 2: "Semi-annual", 1: "Annual" };
                const growthColor = h.growthRate == null ? "text-gray-500"
                  : h.growthRate > 3 ? "text-green-400"
                  : h.growthRate > 0 ? "text-green-300"
                  : h.growthRate > -3 ? "text-gray-400"
                  : "text-red-400";
                const trendIcon = h.growthRate == null ? "—"
                  : h.growthRate > 3 ? "📈"
                  : h.growthRate > 0 ? "↗️"
                  : h.growthRate > -3 ? "➡️"
                  : "📉";
                const consistencyColor = h.consistency >= 90 ? "text-green-400"
                  : h.consistency >= 70 ? "text-amber-400"
                  : "text-red-400";
                return (
                  <tr key={h.ticker} className={`border-b ${divider} last:border-0 hover:bg-gray-800/20 transition-colors`}>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-white">{h.ticker}</p>
                      <p className="text-gray-500 text-xs truncate max-w-[160px]">{h.name}</p>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
                        {freqLabel[h.freq] ?? `${h.freq}×/yr`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-300">{fmt$(h.annual_dividend, 4)}</td>
                    <td className={`px-5 py-3 text-right font-semibold ${growthColor}`}>
                      {h.growthRate != null
                        ? `${h.growthRate >= 0 ? "+" : ""}${h.growthRate.toFixed(1)}%`
                        : <span className="text-gray-600 font-normal text-xs">insufficient data</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${h.consistency}%`, background: scoreColor(h.consistency) }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${consistencyColor}`}>{h.consistency}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-base">{trendIcon}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Monthly Income Coverage ── */}
      <div className={`${cardBg} border rounded-xl p-5`}>
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Income by Month</h2>
        <p className={`text-xs ${subText} mb-5`}>Which months receive dividend payments</p>
        <div className="grid grid-cols-12 gap-1 items-end h-24">
          {monthlyProjected.map((income, i) => {
            const pct = maxMonthlyIncome > 0 ? (income / maxMonthlyIncome) * 100 : 0;
            const now = new Date();
            const isCurrentMonth = i === now.getMonth();
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm transition-all duration-500"
                  style={{
                    height: `${Math.max(pct, income > 0 ? 4 : 0)}%`,
                    background: isCurrentMonth ? "#7c3aed" : income > 0 ? "#4f46e5" : "#1f2937",
                    minHeight: income > 0 ? "4px" : "0",
                  }}
                  title={`${monthLabels[i]}: ${fmt$(income)}`}
                />
                <span className={`text-[9px] ${isCurrentMonth ? "text-brand-400 font-semibold" : subText}`}>
                  {monthLabels[i].slice(0, 1)}
                </span>
              </div>
            );
          })}
        </div>
        <div className={`flex justify-between mt-3 pt-3 border-t ${divider} text-xs ${subText}`}>
          <span>Best month: <span className="text-white font-medium">{monthLabels[monthlyProjected.indexOf(Math.max(...monthlyProjected))]}</span></span>
          <span>Weakest month: <span className="text-white font-medium">{monthLabels[monthlyProjected.indexOf(Math.min(...monthlyProjected))]}</span></span>
          <span>Avg/month: <span className="text-white font-medium">{fmt$(totalIncome / 12)}</span></span>
        </div>
      </div>

      {/* ── 52-Week Price Position ── */}
      <div className={`${cardBg} border rounded-xl p-5`}>
        <h2 className="text-sm font-semibold text-gray-300 mb-1">52-Week Price Range</h2>
        <p className={`text-xs ${subText} mb-5`}>Where each holding sits between its 52-week low and high</p>
        <div className="space-y-4">
          {holdingMetrics
            .filter((h) => h.rangePos !== null && h.high52w && h.low52w)
            .map((h) => {
              const pos = h.rangePos!;
              const nearHigh = pos >= 80;
              const nearLow = pos <= 20;
              const barColor = nearHigh ? "#22c55e" : nearLow ? "#ef4444" : "#4f46e5";
              return (
                <div key={h.ticker}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-white text-sm">{h.ticker}
                      <span className={`text-xs font-normal ml-2 ${subText}`}>{h.name}</span>
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className={subText}>{fmt$(h.low52w)} 52w low</span>
                      <span className={nearHigh ? "text-green-400" : nearLow ? "text-red-400" : "text-white"}>
                        {fmt$(h.price)} <span className={subText}>({pos.toFixed(0)}%)</span>
                      </span>
                      <span className={subText}>{fmt$(h.high52w)} 52w high</span>
                    </div>
                  </div>
                  <div className="relative h-2 bg-gray-800 rounded-full">
                    <div
                      className="absolute top-0 left-0 h-full rounded-full transition-all duration-700"
                      style={{ width: `${pos}%`, background: barColor }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-gray-900 transition-all duration-700"
                      style={{ left: `calc(${pos}% - 6px)`, background: barColor }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ── Yield on Cost ── */}
      {hasCostBasis && (
        <div className={`${cardBg} border rounded-xl overflow-hidden`}>
          <div className={`px-5 py-4 border-b ${divider}`}>
            <h2 className="text-sm font-semibold text-gray-300">Yield on Cost</h2>
            <p className={`text-xs ${subText} mt-0.5`}>What you're earning on your original investment vs current market yield</p>
          </div>
          <div className="divide-y divide-gray-800">
            {holdingMetrics
              .filter((h) => h.cost_basis != null && h.yoc != null)
              .sort((a, b) => (b.yoc ?? 0) - (a.yoc ?? 0))
              .map((h) => {
                const yocHigher = h.yoc! > h.yield_pct!;
                return (
                  <div key={h.ticker} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-semibold text-white text-sm">{h.ticker}</span>
                        <span className={`text-xs ml-2 ${subText}`}>{h.name}</span>
                      </div>
                      <div className={`text-xs font-medium ${yocHigher ? "text-green-400" : subText}`}>
                        {yocHigher ? "↑ Beating market yield" : "Below market yield"}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex-1">
                        <p className={`text-xs ${subText} mb-1`}>Yield on Cost</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(h.yoc!, 20) / 20 * 100}%` }} />
                          </div>
                          <span className="text-brand-400 font-bold text-sm w-14 text-right">{fmtPct(h.yoc)}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs ${subText} mb-1`}>Current Yield</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gray-600 rounded-full" style={{ width: `${Math.min(h.yield_pct ?? 0, 20) / 20 * 100}%` }} />
                          </div>
                          <span className={`${subText} font-medium text-sm w-14 text-right`}>{fmtPct(h.yield_pct)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── ETF Deep Dive ── */}
      {etfHoldings.length > 0 && (
        <div className="space-y-4">
          <h2 className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>ETF Details</h2>
          {etfHoldings.map((h) => {
            const fs = h.fundSummary!;
            return (
              <div key={h.ticker} className={`${cardBg} border rounded-xl p-5`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-white text-base">{h.ticker}</h3>
                    <p className={`text-xs ${subText}`}>{h.name}</p>
                    {fs.category && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full mt-1 inline-block">{fs.category}</span>}
                  </div>
                  <div className="text-right space-y-1">
                    {fs.expenseRatio != null && (
                      <p className="text-xs">
                        <span className={subText}>Expense Ratio </span>
                        <span className={fs.expenseRatio < 0.003 ? "text-green-400 font-semibold" : "text-amber-400 font-semibold"}>
                          {(fs.expenseRatio * 100).toFixed(2)}%
                        </span>
                      </p>
                    )}
                    {fs.beta != null && (
                      <p className="text-xs">
                        <span className={subText}>3Y Beta </span>
                        <span className="text-white font-semibold">{fs.beta.toFixed(2)}</span>
                      </p>
                    )}
                    {fs.totalAssets != null && (
                      <p className="text-xs">
                        <span className={subText}>AUM </span>
                        <span className="text-white font-semibold">
                          {fs.totalAssets >= 1e9
                            ? `$${(fs.totalAssets / 1e9).toFixed(1)}B`
                            : `$${(fs.totalAssets / 1e6).toFixed(0)}M`}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Sector Weights */}
                  {fs.sectorWeightings.length > 0 && (
                    <div>
                      <p className={`text-xs font-medium ${subText} mb-2`}>Sector Exposure</p>
                      <div className="space-y-1.5">
                        {fs.sectorWeightings.slice(0, 6).map((sw) => (
                          <div key={sw.sector} className="flex items-center gap-2">
                            <span className={`text-xs ${subText} w-28 truncate capitalize`}>
                              {sw.sector.replace(/([A-Z])/g, " $1").trim()}
                            </span>
                            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-600 rounded-full" style={{ width: `${sw.pct * 100}%` }} />
                            </div>
                            <span className="text-xs text-gray-400 w-9 text-right">{(sw.pct * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Holdings */}
                  {fs.topHoldings.length > 0 && (
                    <div>
                      <p className={`text-xs font-medium ${subText} mb-2`}>Top Holdings</p>
                      <div className="space-y-1.5">
                        {fs.topHoldings.slice(0, 6).map((th) => (
                          <div key={th.symbol} className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-gray-300 w-14 truncate">{th.symbol || th.name}</span>
                            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${th.pct * 100 * 5}%` }} />
                            </div>
                            <span className="text-xs text-gray-400 w-9 text-right">{(th.pct * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Asset Allocation */}
                {(fs.assetAllocation.stock != null || fs.assetAllocation.bond != null) && (
                  <div className={`mt-4 pt-4 border-t ${divider} flex gap-6 text-xs`}>
                    {fs.assetAllocation.stock != null && (
                      <span><span className={subText}>Stocks </span><span className="text-white font-semibold">{(fs.assetAllocation.stock * 100).toFixed(1)}%</span></span>
                    )}
                    {fs.assetAllocation.bond != null && (
                      <span><span className={subText}>Bonds </span><span className="text-white font-semibold">{(fs.assetAllocation.bond * 100).toFixed(1)}%</span></span>
                    )}
                    {fs.assetAllocation.cash != null && (
                      <span><span className={subText}>Cash </span><span className="text-white font-semibold">{(fs.assetAllocation.cash * 100).toFixed(1)}%</span></span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function QuickStat({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div>
      <p className="text-gray-500 text-xs mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${green ? "text-brand-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
