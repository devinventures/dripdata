"use client";
import { useState, useEffect } from "react";
import TickerSearch from "@/components/TickerSearch";

interface YearRow {
  year: number;
  shares: number;
  dividendPerShare: number;
  annualIncome: number;
  totalValue: number;
  totalInvested: number;
}

export default function DRIPCalculator() {
  const [ticker, setTicker] = useState("");
  const [lookupDone, setLookupDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");

  // Inputs (pre-filled from API, user can override)
  const [shares, setShares] = useState("100");
  const [price, setPrice] = useState("");
  const [annualDiv, setAnnualDiv] = useState("");
  const [divGrowth, setDivGrowth] = useState("5");
  const [stockGrowth, setStockGrowth] = useState("7");
  const [years, setYears] = useState("20");

  const [rows, setRows] = useState<YearRow[]>([]);

  async function lookupTicker(overrideTicker?: string) {
    const t = (overrideTicker ?? ticker).trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    setLookupError("");
    try {
      const [sRes, dRes] = await Promise.all([
        fetch(`/api/stock/${t}`),
        fetch(`/api/dividends/${t}`),
      ]);
      if (sRes.ok) {
        const s = await sRes.json();
        if (s.price) setPrice(s.price.toFixed(2));
      }
      if (dRes.ok) {
        const d = await dRes.json();
        if (d.annual_dividend) setAnnualDiv(d.annual_dividend.toFixed(4));
      }
      setLookupDone(true);
    } catch {
      setLookupError("Could not fetch data. You can enter values manually.");
      setLookupDone(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const s = parseFloat(shares);
    const p = parseFloat(price);
    const d = parseFloat(annualDiv);
    const dg = parseFloat(divGrowth) / 100;
    const sg = parseFloat(stockGrowth) / 100;
    const y = parseInt(years);

    if (isNaN(s) || isNaN(p) || isNaN(d) || isNaN(y) || p <= 0) {
      setRows([]);
      return;
    }

    const result: YearRow[] = [];
    let currentShares = s;
    let currentDiv = d;
    let currentPrice = p;

    for (let yr = 1; yr <= y; yr++) {
      const annualIncome = currentShares * currentDiv;
      const newShares = annualIncome / currentPrice;
      currentShares += newShares;
      currentDiv = currentDiv * (1 + dg);
      currentPrice = currentPrice * (1 + sg);
      result.push({
        year: yr,
        shares: currentShares,
        dividendPerShare: currentDiv,
        annualIncome: currentShares * currentDiv,
        totalValue: currentShares * currentPrice,
        totalInvested: s * p,
      });
    }
    setRows(result);
  }, [shares, price, annualDiv, divGrowth, stockGrowth, years]);

  const finalRow = rows[rows.length - 1];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">DRIP Calculator</h1>
      <p className="text-gray-400 text-sm mb-6">
        Model the compounding effect of reinvesting dividends over time.
      </p>

      {/* Ticker lookup */}
      <div className="flex gap-2 mb-4">
        <TickerSearch
          value={ticker}
          onChange={setTicker}
          onSelect={lookupTicker}
          placeholder="Ticker to auto-fill (optional)"
          className="flex-1"
        />
        <button
          onClick={() => lookupTicker()}
          disabled={loading}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          {loading ? "Loading…" : "Auto-fill"}
        </button>
      </div>
      {lookupError && <p className="text-yellow-500 text-sm mb-3">{lookupError}</p>}

      {/* Inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <Field label="Starting Shares" value={shares} onChange={setShares} prefix="" suffix="shares" />
        <Field label="Share Price ($)" value={price} onChange={setPrice} prefix="$" />
        <Field label="Annual Dividend/Share ($)" value={annualDiv} onChange={setAnnualDiv} prefix="$" />
        <Field label="Dividend Growth Rate (%/yr)" value={divGrowth} onChange={setDivGrowth} suffix="%" />
        <Field label="Stock Price Growth (%/yr)" value={stockGrowth} onChange={setStockGrowth} suffix="%" />
        <Field label="Years" value={years} onChange={setYears} suffix="yrs" />
      </div>

      {finalRow && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <SummaryCard label={`Value in ${years} yrs`} value={`$${finalRow.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} highlight />
          <SummaryCard label="Total Shares" value={finalRow.shares.toFixed(2)} />
          <SummaryCard label="Annual Income Then" value={`$${finalRow.annualIncome.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} />
          <SummaryCard label="Initial Investment" value={`$${finalRow.totalInvested.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} />
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Year</th>
                <th className="text-right px-4 py-3">Shares</th>
                <th className="text-right px-4 py-3">Div/Share</th>
                <th className="text-right px-4 py-3">Annual Income</th>
                <th className="text-right px-4 py-3">Portfolio Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40">
                  <td className="px-4 py-2.5 font-medium">{r.year}</td>
                  <td className="px-4 py-2.5 text-right">{r.shares.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right">${r.dividendPerShare.toFixed(4)}</td>
                  <td className="px-4 py-2.5 text-right text-brand-400 font-medium">
                    ${r.annualIncome.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    ${r.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
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

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight ? "text-brand-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
