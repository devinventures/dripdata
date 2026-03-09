"use client";
import { useState, useEffect } from "react";
import TickerSearch from "@/components/TickerSearch";

interface ProjectionRow {
  year: number;
  investment: number;
  yield_pct: number;
  annualIncome: number;
  monthlyIncome: number;
  cumulativeIncome: number;
}

export default function IncomeProjector() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);

  const [investment, setInvestment] = useState("10000");
  const [yieldPct, setYieldPct] = useState("4");
  const [divGrowth, setDivGrowth] = useState("5");
  const [additionalMonthly, setAdditionalMonthly] = useState("0");
  const [years, setYears] = useState("30");

  const [rows, setRows] = useState<ProjectionRow[]>([]);

  async function autofill(overrideTicker?: string) {
    const t = (overrideTicker ?? ticker).trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    try {
      const [sRes, dRes] = await Promise.all([
        fetch(`/api/stock/${t}`),
        fetch(`/api/dividends/${t}`),
      ]);
      if (sRes.ok && dRes.ok) {
        const s = await sRes.json();
        const d = await dRes.json();
        if (s.price && d.annual_dividend) {
          const y = (d.annual_dividend / s.price) * 100;
          setYieldPct(y.toFixed(2));
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const inv = parseFloat(investment);
    const yld = parseFloat(yieldPct) / 100;
    const dg = parseFloat(divGrowth) / 100;
    const monthly = parseFloat(additionalMonthly) || 0;
    const y = parseInt(years);

    if (isNaN(inv) || isNaN(yld) || isNaN(y) || inv <= 0 || yld <= 0) {
      setRows([]);
      return;
    }

    const result: ProjectionRow[] = [];
    let totalInvested = inv;
    let currentYield = yld;
    let cumulative = 0;

    for (let yr = 1; yr <= y; yr++) {
      const annualIncome = totalInvested * currentYield;
      cumulative += annualIncome;
      result.push({
        year: yr,
        investment: totalInvested,
        yield_pct: currentYield * 100,
        annualIncome,
        monthlyIncome: annualIncome / 12,
        cumulativeIncome: cumulative,
      });
      currentYield = currentYield * (1 + dg);
      totalInvested += monthly * 12;
    }

    setRows(result);
  }, [investment, yieldPct, divGrowth, additionalMonthly, years]);

  const goal10k = rows.find((r) => r.monthlyIncome >= 10000);
  const goal1k = rows.find((r) => r.monthlyIncome >= 1000);
  const finalRow = rows[rows.length - 1];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Dividend Income Projector</h1>
      <p className="text-gray-400 text-sm mb-6">
        Forecast your future dividend income based on investment, yield, and growth.
      </p>

      {/* Ticker auto-fill */}
      <div className="flex gap-2 mb-4">
        <TickerSearch
          value={ticker}
          onChange={setTicker}
          onSelect={autofill}
          placeholder="Ticker to auto-fill yield (optional)"
          className="flex-1"
        />
        <button
          onClick={autofill}
          disabled={loading}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          {loading ? "Loading…" : "Auto-fill"}
        </button>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <Field label="Initial Investment ($)" value={investment} onChange={setInvestment} prefix="$" />
        <Field label="Starting Yield (%)" value={yieldPct} onChange={setYieldPct} suffix="%" />
        <Field label="Dividend Growth Rate (%/yr)" value={divGrowth} onChange={setDivGrowth} suffix="%" />
        <Field label="Additional Monthly ($)" value={additionalMonthly} onChange={setAdditionalMonthly} prefix="$" />
        <Field label="Projection Years" value={years} onChange={setYears} suffix="yrs" />
      </div>

      {/* Milestones */}
      {(goal1k || goal10k || finalRow) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {goal1k && (
            <MilestoneCard label="$1k/mo reached" value={`Year ${goal1k.year}`} />
          )}
          {goal10k && (
            <MilestoneCard label="$10k/mo reached" value={`Year ${goal10k.year}`} />
          )}
          {finalRow && (
            <MilestoneCard
              label={`Monthly Income (yr ${years})`}
              value={`$${finalRow.monthlyIncome.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              highlight
            />
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Year</th>
                <th className="text-right px-4 py-3">Portfolio</th>
                <th className="text-right px-4 py-3">Yield</th>
                <th className="text-right px-4 py-3">Annual Income</th>
                <th className="text-right px-4 py-3">Monthly Income</th>
                <th className="text-right px-4 py-3">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.year}
                  className={`border-b border-gray-800 last:border-0 hover:bg-gray-800/40 ${
                    r.year === goal1k?.year || r.year === goal10k?.year
                      ? "bg-brand-900/20"
                      : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium">{r.year}</td>
                  <td className="px-4 py-2.5 text-right">
                    ${r.investment.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-2.5 text-right">{r.yield_pct.toFixed(2)}%</td>
                  <td className="px-4 py-2.5 text-right text-brand-400 font-medium">
                    ${r.annualIncome.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    ${r.monthlyIncome.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-400">
                    ${r.cumulativeIncome.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  prefix = "",
  suffix = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div>
      <label className="block text-gray-400 text-xs mb-1">{label}</label>
      <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 gap-1">
        {prefix && <span className="text-gray-500 text-sm">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-white text-sm focus:outline-none min-w-0"
        />
        {suffix && <span className="text-gray-500 text-sm">{suffix}</span>}
      </div>
    </div>
  );
}

function MilestoneCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight ? "text-brand-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
