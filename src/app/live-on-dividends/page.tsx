"use client";
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────
interface ExpenseRow { label: string; amount: number }
interface Holding { id: number; ticker: string; pct: number; yieldPct: number; taxRate: number; rocPct: number }
interface ProjectionRow {
  year: number; startValue: number; dividends: number; rocAmount: number; taxableDivs: number;
  costBasisRemaining: number; afterTax: number; reinvested: number; withdrawn: number;
  expenses: number; growth: number; endValue: number; cashflow: number;
}

// ── Defaults ──────────────────────────────────────────────────
const DEFAULT_EXPENSES: ExpenseRow[] = [
  { label: "Housing – rent/mortgage, utilities, insurance", amount: 1200 },
  { label: "Transportation – car payments, gas, transit",   amount: 750  },
  { label: "Food – groceries, dining out",                  amount: 500  },
  { label: "Health & Insurance",                            amount: 0    },
  { label: "Personal Lifestyle – clothes, hobbies, subscriptions", amount: 50 },
  { label: "Home Goods & Miscellaneous",                    amount: 50   },
  { label: "Entertainment & Travel",                        amount: 500  },
];

const STORAGE_KEY = "drip-live-state";
const PROJECTION_KEY = "drip-live-projection";

function loadSavedState(): {
  step: number; maxReached: number; expenses: ExpenseRow[];
  holdings: Holding[]; totalAmount: number; dripPct: number;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.expenses) || !Array.isArray(data.holdings)) return null;
    const holdings = (data.holdings || []).map((h: { id: number; ticker: string; pct: number; yieldPct: number; taxRate: number; rocPct?: number }) => ({
      ...h,
      rocPct: h.rocPct ?? 0,
    })) as Holding[];
    return {
      step: Math.min(data.step ?? 1, 3),
      maxReached: Math.min(data.maxReached ?? 1, 3),
      expenses: data.expenses,
      holdings,
      totalAmount: Number(data.totalAmount) || 350_000,
      dripPct: Number(data.dripPct) || 0,
    };
  } catch {
    return null;
  }
}

function saveState(state: {
  step: number; maxReached: number; expenses: ExpenseRow[];
  holdings: Holding[]; totalAmount: number; dripPct: number;
}) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function loadProjection(totalAmount: number, blendedYield: number, blendedRoc: number) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROJECTION_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return {
      portfolioValue: Number(d.portfolioValue) || totalAmount,
      yieldPct: Number(d.yieldPct) ?? parseFloat(blendedYield.toFixed(2)),
      rocPct: Number(d.rocPct) ?? blendedRoc,
      annualReturn: Number(d.annualReturn) || 3,
      dripPct: Number(d.dripPct) || 0,
      taxRate: Number(d.taxRate) || 15,
      inflation: Number(d.inflation) || 2,
      years: Number(d.years) || 20,
    };
  } catch {
    return null;
  }
}

function saveProjection(p: {
  portfolioValue: number; yieldPct: number; rocPct: number; annualReturn: number;
  dripPct: number; taxRate: number; inflation: number; years: number;
}) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROJECTION_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

let _nextId = 7;
const DEFAULT_HOLDINGS: Holding[] = [
  { id: 1, ticker: "QQQI", pct: 20, yieldPct: 14.0, taxRate: 0,  rocPct: 100 },
  { id: 2, ticker: "SPYI", pct: 20, yieldPct: 11.0, taxRate: 15, rocPct: 0   },
  { id: 3, ticker: "TSPY", pct: 10, yieldPct: 13.0, taxRate: 15, rocPct: 0   },
  { id: 4, ticker: "TDAQ", pct: 10, yieldPct: 17.0, taxRate: 15, rocPct: 0   },
  { id: 5, ticker: "GPIQ", pct: 20, yieldPct:  9.5, taxRate: 15, rocPct: 0   },
  { id: 6, ticker: "GPIX", pct: 20, yieldPct:  8.0, taxRate: 15, rocPct: 0   },
];

// ── Helpers ───────────────────────────────────────────────────
function fmt(n: number, decimals = 0) {
  const abs = Math.abs(n);
  const s = abs.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
  return (n < 0 ? "-$" : "$") + s;
}
function pct(n: number) { return n.toFixed(2) + "%"; }

// ── Shared styles ─────────────────────────────────────────────
const card = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.07] rounded-2xl shadow-sm dark:shadow-lg";
const inputCls = "w-full bg-gray-100 dark:bg-white/[0.05] border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-gray-900 dark:text-white font-semibold text-sm focus:outline-none focus:border-brand-500 focus:bg-white dark:focus:bg-white/[0.08] transition-all";
const inputSm  = "bg-gray-100 dark:bg-white/[0.05] border border-gray-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-500 focus:bg-white dark:focus:bg-white/[0.08] transition-all font-semibold";

// ── Step bar ──────────────────────────────────────────────────
function StepBar({ step, maxReached, go }: { step: number; maxReached: number; go: (n: number) => void }) {
  const steps = [{ n: 1, label: "Expenses" }, { n: 2, label: "Portfolio" }, { n: 3, label: "Projection" }];
  return (
    <div className="flex items-center mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <button
            onClick={() => s.n <= maxReached && go(s.n)}
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
              step === s.n
                ? "text-gray-900 dark:text-white"
                : s.n <= maxReached
                ? "text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-gray-100 dark:hover:bg-white/[0.04]"
                : "text-gray-400 dark:text-gray-600 cursor-default"
            }`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
              step === s.n
                ? "bg-brand-500 border-brand-500 text-white shadow-[0_0_12px_rgba(34,197,94,0.4)]"
                : s.n < step
                ? "bg-brand-500/20 border-brand-500 text-brand-600 dark:text-brand-400"
                : "bg-transparent border-gray-300 dark:border-white/10 text-gray-400 dark:text-gray-600"
            }`}>{s.n < step ? "✓" : s.n}</span>
            <span>{s.label}</span>
          </button>
          {i < 2 && (
            <div className={`w-12 h-px mx-1 transition-colors ${s.n < step ? "bg-brand-500/50" : "bg-gray-200 dark:bg-white/[0.06]"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Expenses ──────────────────────────────────────────
function Step1({
  expenses, setExpenses, onNext,
}: { expenses: ExpenseRow[]; setExpenses: (e: ExpenseRow[]) => void; onNext: () => void }) {
  const monthly = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  function update(i: number, val: string) {
    const next = [...expenses];
    next[i] = { ...next[i], amount: parseFloat(val) || 0 };
    setExpenses(next);
  }

  const icons = ["🏠","🚗","🍽️","🏥","👕","🛒","🎬"];

  return (
    <div className="space-y-4">
      <div className={card + " overflow-hidden"}>
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-white/[0.06]">
          <h2 className="font-bold text-gray-900 dark:text-white text-lg">Map Your Monthly Expenses</h2>
          <p className="text-gray-500 text-sm mt-1">This determines how much dividend income you need to cover your lifestyle</p>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
          {expenses.map((row, i) => (
            <div key={i} className="flex items-center px-6 py-3.5 gap-4 hover:bg-gray-50 dark:hover:bg-white/[0.025] transition-colors group">
              <span className="text-lg w-7 shrink-0">{icons[i]}</span>
              <span className="text-gray-700 dark:text-gray-300 text-sm flex-1">{row.label}</span>
              <div className="relative w-36 shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">$</span>
                <input
                  type="number" min={0} value={row.amount || ""}
                  onChange={e => update(i, e.target.value)}
                  placeholder="0"
                  autoComplete="off"
                  className="w-full bg-gray-100 dark:bg-white/[0.05] border border-gray-300 dark:border-white/10 rounded-xl pl-7 pr-3 py-2 text-gray-900 dark:text-white text-sm text-right focus:outline-none focus:border-brand-500 focus:bg-white dark:focus:bg-white/[0.08] transition-all font-semibold"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-gray-100 dark:border-white/[0.06] bg-gradient-to-r from-brand-500/[0.05] to-transparent flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-10">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Monthly Total</p>
              <p className="text-gray-900 dark:text-white font-black text-2xl">{fmt(monthly)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Annual Total</p>
              <p className="text-gray-900 dark:text-white font-black text-2xl">{fmt(monthly * 12)}</p>
            </div>
          </div>
          <button
            onClick={onNext}
            className="bg-brand-500 hover:bg-brand-400 text-black font-bold px-6 py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(34,197,94,0.25)] hover:shadow-[0_0_28px_rgba(34,197,94,0.4)]"
          >
            Build Portfolio →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Portfolio ─────────────────────────────────────────
function Step2({
  monthlyExpenses, holdings, setHoldings,
  totalAmount, setTotalAmount, dripPct, setDripPct, onNext,
}: {
  monthlyExpenses: number; holdings: Holding[]; setHoldings: React.Dispatch<React.SetStateAction<Holding[]>>;
  totalAmount: number; setTotalAmount: (v: number) => void;
  dripPct: number; setDripPct: (v: number) => void; onNext: () => void;
}) {
  const totalPct = holdings.reduce((s, h) => s + h.pct, 0);
  const rows = holdings.map(h => {
    const amount   = totalAmount * (h.pct / 100);
    const gross    = amount * (h.yieldPct / 100);
    const rocPart  = gross * ((h.rocPct ?? 0) / 100);
    const taxable  = gross - rocPart;
    const afterTax = rocPart + taxable * (1 - h.taxRate / 100);
    const withdrawn = afterTax * (1 - dripPct / 100);
    return { ...h, amount, gross, afterTax, monthly: withdrawn / 12 };
  });
  const totalMonthly = rows.reduce((s, r) => s + r.monthly, 0);
  const blended      = holdings.reduce((s, h) => s + (h.pct / 100) * h.yieldPct, 0);
  const blendedRoc   = holdings.reduce((s, h) => s + (h.pct / 100) * (h.rocPct ?? 0), 0);
  const cashflow     = totalMonthly - monthlyExpenses;
  const pos          = cashflow >= 0;

  const [fetching, setFetching] = useState<Record<number, boolean>>({});
  const [fetchError, setFetchError] = useState<Record<number, string>>({});
  const tickerRefs = useRef<Record<number, string>>({});
  const fetchedTickers = useRef<Set<string>>(new Set());

  function upd(id: number, field: keyof Holding, raw: string) {
    const val = field === "ticker" ? raw.toUpperCase() : (parseFloat(raw) || 0);
    if (field === "ticker") tickerRefs.current[id] = raw.toUpperCase();
    setHoldings(holdings.map(h => h.id === id ? { ...h, [field]: val } : h));
  }

  async function fetchYield(id: number, ticker: string, markFetched?: (key: string) => void) {
    if (!ticker || ticker.length < 1) return;
    setFetching(f => ({ ...f, [id]: true }));
    setFetchError(e => ({ ...e, [id]: "" }));
    try {
      const [divRes, stockRes] = await Promise.all([
        fetch(`/api/dividends/${ticker}`),
        fetch(`/api/stock/${ticker}`),
      ]);
      const [div, stock] = await Promise.all([divRes.json(), stockRes.json()]);
      if (div.annual_dividend != null && stock.price != null && !div.error && !stock.error) {
        const yld = parseFloat(((div.annual_dividend / stock.price) * 100).toFixed(2));
        setHoldings((h: Holding[]) => h.map((row: Holding) => row.id === id ? { ...row, yieldPct: yld } : row));
        markFetched?.(`${id}:${ticker}`);
      } else {
        // Keep the existing yield on error — don't overwrite with 0
        const msg = stock.error ?? div.error ?? "No yield data";
        setFetchError(e => ({ ...e, [id]: msg }));
        // Don't markFetched so it retries on next mount
      }
    } catch {
      // Keep the existing yield on network error
      setFetchError(e => ({ ...e, [id]: "Network error" }));
      // Don't markFetched so it retries on next mount
    } finally {
      setFetching(f => ({ ...f, [id]: false }));
    }
  }

  function add() { setHoldings([...holdings, { id: _nextId++, ticker: "", pct: 0, yieldPct: 0, taxRate: 15, rocPct: 0 }]); }
  function del(id: number) { setHoldings(holdings.filter(h => h.id !== id)); }

  const markFetched = (key: string) => { fetchedTickers.current.add(key); };

  // Dynamically fetch live yields when holdings change (debounced to avoid fetching on each keystroke)
  useEffect(() => {
    const timer = setTimeout(() => {
      holdings.forEach((h) => {
        const t = h.ticker?.trim();
        if (!t || t.length < 2) return;
        const key = `${h.id}:${t}`;
        if (fetchedTickers.current.has(key)) return;
        fetchYield(h.id, t, markFetched);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [holdings]);

  return (
    <div className="space-y-4">
      {/* Top inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card + " p-5"}>
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">Total Portfolio Size</p>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold pointer-events-none">$</span>
            <input
              type="number" value={totalAmount}
              onChange={e => setTotalAmount(parseFloat(e.target.value) || 0)}
              autoComplete="off"
              className="w-full bg-gray-100 dark:bg-white/[0.05] border border-gray-300 dark:border-white/10 rounded-xl pl-9 pr-4 py-3 text-gray-900 dark:text-white font-bold text-xl focus:outline-none focus:border-brand-500 focus:bg-white dark:focus:bg-white/[0.08] transition-all"
            />
          </div>
        </div>
        <div className={card + " p-5"}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-500 text-xs uppercase tracking-widest">DRIP — Reinvest Rate</p>
            <span className="text-brand-600 dark:text-brand-400 font-black text-lg">{dripPct}%</span>
          </div>
          <input type="range" min={0} max={100} step={5} value={dripPct}
            onChange={e => setDripPct(parseInt(e.target.value))}
            className="w-full accent-brand-500 mb-2"
          />
          <p className="text-gray-400 dark:text-gray-600 text-xs">{100 - dripPct}% paid out as income · {dripPct}% reinvested</p>
        </div>
      </div>

      {/* Holdings table */}
      <div className={card + " overflow-hidden"}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/[0.06]">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">Portfolio Holdings</h2>
            <p className={`text-xs mt-0.5 font-semibold ${Math.abs(totalPct - 100) < 0.5 ? "text-green-600 dark:text-green-400" : "text-orange-500 dark:text-orange-400"}`}>
              {totalPct.toFixed(1)}% allocated{" "}
              {Math.abs(totalPct - 100) < 0.5 ? "✓" : `— ${totalPct > 100 ? "over" : "under"} by ${Math.abs(totalPct - 100).toFixed(1)}%`}
            </p>
          </div>
          <button onClick={add} className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 text-sm font-semibold transition-colors border border-brand-500/30 hover:border-brand-400/50 px-3 py-1.5 rounded-lg">
            + Add ETF
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/[0.05] text-gray-500 dark:text-gray-600 text-xs uppercase tracking-wide bg-gray-50 dark:bg-white/[0.02]">
                <th className="text-left px-5 py-3">Ticker</th>
                <th className="text-right px-4 py-3">Alloc</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-right px-4 py-3">Yield</th>
                <th className="text-right px-5 py-3">Monthly Income</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                  <td className="px-5 py-2.5">
                    <input value={row.ticker} onChange={e => upd(row.id, "ticker", e.target.value)}
                      placeholder="TICK" maxLength={6} autoComplete="off"
                      className={inputSm + " w-20 text-center uppercase text-brand-600 dark:text-brand-300"}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <input type="number" value={row.pct} onChange={e => upd(row.id, "pct", e.target.value)}
                        autoComplete="off" className={inputSm + " w-14 text-right"}
                      />
                      <span className="text-gray-400 text-xs">%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400 font-medium">{fmt(row.amount)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <div className="relative">
                        <input type="number" value={row.yieldPct} onChange={e => upd(row.id, "yieldPct", e.target.value)}
                          autoComplete="off" className={inputSm + " w-20 text-right" + (fetching[row.id] ? " opacity-40" : "")}
                        />
                        {fetching[row.id] && (
                          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                          </span>
                        )}
                      </div>
                      <span className="text-gray-400 text-xs">%</span>
                      {fetchError[row.id] && (
                        <span className="text-red-400 text-xs" title={fetchError[row.id]}>!</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-2.5 text-right font-bold text-brand-600 dark:text-brand-400">
                    {fmt(row.monthly)}<span className="text-gray-400 font-normal text-xs">/mo</span>
                  </td>
                  <td className="pr-4 py-2.5 text-center">
                    <button onClick={() => del(row.id)} className="text-gray-300 dark:text-gray-700 hover:text-red-500 dark:hover:text-red-400 transition-colors text-xl leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] font-bold">
                <td className="px-5 py-3 text-gray-400 dark:text-gray-500 text-xs uppercase">Total</td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{totalPct.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{fmt(totalAmount)}</td>
                <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 text-xs font-normal">{pct(blended)} blended</td>
                <td className="px-5 py-3 text-right text-brand-600 dark:text-brand-400 text-base">
                  {fmt(totalMonthly)}<span className="text-gray-400 font-normal text-xs">/mo</span>
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Cashflow callout */}
      <div className={`rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-4 ${
        pos
          ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/25"
          : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/25"
      }`}>
        <div className="flex flex-wrap gap-10">
          {[
            { label: "Monthly Income",   val: fmt(totalMonthly), color: "text-brand-600 dark:text-brand-400" },
            { label: "Monthly Expenses", val: fmt(monthlyExpenses), color: "text-gray-900 dark:text-white" },
            { label: "Monthly Cashflow", val: (pos ? "+" : "") + fmt(cashflow), color: pos ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400" },
          ].map(({ label, val, color }) => (
            <div key={label}>
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-0.5">{label}</p>
              <p className={`font-black text-2xl ${color}`}>{val}</p>
            </div>
          ))}
        </div>
        <button onClick={onNext}
          className="bg-brand-500 hover:bg-brand-400 text-black font-bold px-6 py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(34,197,94,0.25)] hover:shadow-[0_0_28px_rgba(34,197,94,0.4)] shrink-0"
        >
          Project the Future →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Projection ────────────────────────────────────────
function Step3({
  annualExpenses, totalAmount, blendedYield, blendedRoc,
}: { annualExpenses: number; totalAmount: number; blendedYield: number; blendedRoc: number }) {
  const saved = loadProjection(totalAmount, blendedYield, blendedRoc);
  const [portfolioValue, setPortfolioValue] = useState(saved?.portfolioValue ?? totalAmount);
  const [yieldPct,       setYieldPct]       = useState(saved?.yieldPct ?? parseFloat(blendedYield.toFixed(2)));
  const [rocPct,         setRocPct]         = useState(saved?.rocPct ?? blendedRoc);
  const [annualReturn,   setAnnualReturn]   = useState(saved?.annualReturn ?? 3);
  const [dripPct,        setDripPct]        = useState(saved?.dripPct ?? 0);
  const [taxRate,        setTaxRate]        = useState(saved?.taxRate ?? 15);
  const [inflation,      setInflation]      = useState(saved?.inflation ?? 2);
  const [years,          setYears]          = useState(saved?.years ?? 20);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveProjection({
        portfolioValue, yieldPct, rocPct, annualReturn, dripPct, taxRate, inflation, years,
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [portfolioValue, yieldPct, rocPct, annualReturn, dripPct, taxRate, inflation, years]);

  const rows = useMemo<ProjectionRow[]>(() => {
    const out: ProjectionRow[] = [];
    let value = portfolioValue;
    let costBasis = portfolioValue;
    const rocFraction = Math.min(100, Math.max(0, rocPct)) / 100;

    for (let y = 1; y <= years; y++) {
      const dividends = value * (yieldPct / 100);
      const potentialRoc = dividends * rocFraction;
      const rocAmount = Math.min(potentialRoc, Math.max(0, costBasis));
      const taxableDivs = dividends - rocAmount;

      costBasis = Math.max(0, costBasis - rocAmount);

      const afterTax = rocAmount + taxableDivs * (1 - taxRate / 100);
      const reinvested = afterTax * (dripPct / 100);
      const withdrawn = afterTax * (1 - dripPct / 100);
      const expenses = annualExpenses * Math.pow(1 + inflation / 100, y - 1);
      const growth = (value + reinvested) * (annualReturn / 100);
      const endValue = value + reinvested + growth;
      const cashflow = withdrawn - expenses;

      out.push({
        year: y,
        startValue: value,
        dividends,
        rocAmount,
        taxableDivs,
        costBasisRemaining: costBasis,
        afterTax,
        reinvested,
        withdrawn,
        expenses,
        growth,
        endValue,
        cashflow,
      });
      value = endValue;
    }
    return out;
  }, [portfolioValue, yieldPct, rocPct, annualReturn, dripPct, taxRate, inflation, years, annualExpenses]);

  const totalWithdrawn  = rows.reduce((s, r) => s + r.withdrawn, 0);
  const totalReinvested = rows.reduce((s, r) => s + r.reinvested, 0);
  const totalDividends  = rows.reduce((s, r) => s + r.dividends, 0);
  const totalRoc        = rows.reduce((s, r) => s + r.rocAmount, 0);
  const posYears        = rows.filter(r => r.cashflow >= 0).length;
  const endBalance      = rows[rows.length - 1]?.endValue ?? 0;
  const gain            = endBalance - portfolioValue;

  const chartData = rows.map(r => ({
    year: `Yr ${r.year}`,
    "Portfolio Value": Math.round(r.endValue),
    "Annual Income":   Math.round(r.withdrawn),
    "Expenses":        Math.round(r.expenses),
  }));

  const params = [
    { label: "Starting Portfolio", val: portfolioValue, set: setPortfolioValue, prefix: "$", suffix: "",      icon: "💼" },
    { label: "Dividend Yield",     val: yieldPct,       set: setYieldPct,       prefix: "",  suffix: "%",    icon: "💰" },
    { label: "ROC %",              val: rocPct,         set: setRocPct,         prefix: "",  suffix: "%",    icon: "📋" },
    { label: "Annual Return",      val: annualReturn,   set: setAnnualReturn,   prefix: "",  suffix: "%",    icon: "📈" },
    { label: "DRIP Reinvest",      val: dripPct,        set: setDripPct,        prefix: "",  suffix: "%",    icon: "💧" },
    { label: "Tax Rate",           val: taxRate,        set: setTaxRate,        prefix: "",  suffix: "%",    icon: "🏛️" },
    { label: "Inflation",          val: inflation,      set: setInflation,      prefix: "",  suffix: "%",    icon: "📊" },
    { label: "Years",              val: years,          set: setYears,          prefix: "",  suffix: " yrs", icon: "📅" },
  ];

  const stats = [
    { label: "End Portfolio",     val: fmt(endBalance),                              color: gain >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400",    border: gain >= 0 ? "border-green-400 dark:border-green-500/40" : "border-red-400 dark:border-red-500/40" },
    { label: "Portfolio Change",  val: (gain >= 0 ? "+" : "") + fmt(gain),           color: gain >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400",    border: gain >= 0 ? "border-green-400 dark:border-green-500/40" : "border-red-400 dark:border-red-500/40" },
    { label: "Total Withdrawn",   val: fmt(totalWithdrawn),                          color: "text-brand-600 dark:text-brand-400",  border: "border-brand-500" },
    { label: "Total Dividends",   val: fmt(totalDividends),                          color: "text-gray-900 dark:text-white",       border: "border-gray-300 dark:border-white/20" },
    { label: "Total ROC",         val: fmt(totalRoc),                                 color: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-400 dark:border-emerald-500/40" },
    { label: "Total Reinvested",  val: fmt(totalReinvested),                         color: "text-blue-600 dark:text-blue-400",    border: "border-blue-400 dark:border-blue-500/40" },
    { label: "Positive CF Years", val: `${posYears} / ${years}`,                    color: posYears === years ? "text-green-700 dark:text-green-400" : posYears > years / 2 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400", border: "border-yellow-400 dark:border-yellow-500/40" },
    (() => {
      const lastCf = (rows[rows.length - 1]?.cashflow ?? 0);
      const pos = lastCf >= 0;
      return { label: `Year ${years} Cashflow/mo`, val: (pos ? "+" : "") + fmt(lastCf / 12), color: pos ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400", border: pos ? "border-green-400 dark:border-green-500/40" : "border-red-400 dark:border-red-500/40" };
    })(),
  ];

  return (
    <div className="space-y-5">
      {/* Params card */}
      <div className={card + " overflow-hidden"}>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/[0.06] bg-gradient-to-r from-brand-500/[0.05] to-transparent">
          <h2 className="font-bold text-gray-900 dark:text-white text-lg">Projection Parameters</h2>
          <p className="text-gray-500 text-sm mt-0.5">Adjust to model different scenarios</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-gray-100 dark:divide-white/[0.05]">
          {params.map(({ label, val, set, prefix, suffix, icon }) => (
            <div key={label} className="p-4 hover:bg-gray-50 dark:hover:bg-white/[0.025] transition-colors">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">{icon}</span>
                <p className="text-gray-500 text-xs uppercase tracking-wide">{label}</p>
              </div>
              <div className="relative flex items-center">
                {prefix && <span className="absolute left-3 text-gray-400 text-sm pointer-events-none z-10">{prefix}</span>}
                <input type="number" value={val}
                  onChange={e => set(parseFloat(e.target.value) || 0)}
                  autoComplete="off"
                  className={inputCls + (prefix ? " pl-7" : "") + (suffix ? " pr-10" : "")}
                />
                {suffix && <span className="absolute right-3 text-gray-400 dark:text-gray-500 text-xs pointer-events-none">{suffix}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ label, val, color, border }) => (
          <div key={label} className={`${card} border-t-2 ${border} p-4`}>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1.5">{label}</p>
            <p className={`font-black text-xl leading-tight ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className={card + " p-5"}>
        <h3 className="font-bold text-gray-900 dark:text-white mb-1">Portfolio Value Over Time</h3>
        <p className="text-gray-400 dark:text-gray-600 text-xs mb-4">Green area = portfolio · dashed green = annual income · red dashed = expenses</p>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gVal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:[stroke:#ffffff08]" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => "$" + (v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + "M" : (v / 1000).toFixed(0) + "K")}
                tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12, color: "#111" }}
                labelStyle={{ color: "#6b7280" }}
                formatter={(v, name) => [v != null ? fmt(Number(v)) : "", String(name ?? "")]}
              />
              <Area type="monotone" dataKey="Portfolio Value" stroke="#22c55e" strokeWidth={2.5} fill="url(#gVal)" dot={false} />
              <Area type="monotone" dataKey="Annual Income"   stroke="#4ade80" strokeWidth={1.5} fill="url(#gInc)" strokeDasharray="5 3" dot={false} />
              <Line type="monotone" dataKey="Expenses"        stroke="#f87171" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Year-by-year table */}
      <div className={card + " overflow-hidden"}>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/[0.06]">
          <h3 className="font-bold text-gray-900 dark:text-white">Year-by-Year Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/[0.05] text-gray-500 dark:text-gray-600 text-xs uppercase tracking-wide bg-gray-50 dark:bg-white/[0.02]">
                <th className="text-center px-4 py-3 w-16">Year</th>
                <th className="text-right px-4 py-3">Start Value</th>
                <th className="text-right px-4 py-3">Dividends</th>
                <th className="text-right px-4 py-3" title="Return of Capital">ROC</th>
                <th className="text-right px-4 py-3">Taxable</th>
                <th className="text-right px-4 py-3">Cost Basis</th>
                <th className="text-right px-4 py-3">After-Tax</th>
                <th className="text-right px-4 py-3">Reinvested</th>
                <th className="text-right px-4 py-3">Withdrawn</th>
                <th className="text-right px-4 py-3">Expenses</th>
                <th className="text-right px-4 py-3">End Value</th>
                <th className="text-right px-4 py-3">Cashflow</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.year}
                  className={`border-b border-gray-100 dark:border-white/[0.04] last:border-0 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors ${i % 2 === 1 ? "bg-gray-50/50 dark:bg-white/[0.015]" : ""}`}
                >
                  <td className="px-4 py-2.5 text-center font-bold text-gray-400">{r.year}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400">{fmt(r.startValue)}</td>
                  <td className="px-4 py-2.5 text-right text-brand-600 dark:text-brand-400">{fmt(r.dividends)}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400">{fmt(r.rocAmount)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">{fmt(r.taxableDivs)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">{fmt(r.costBasisRemaining)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">{fmt(r.afterTax)}</td>
                  <td className="px-4 py-2.5 text-right text-blue-600 dark:text-blue-400">{fmt(r.reinvested)}</td>
                  <td className="px-4 py-2.5 text-right text-green-700 dark:text-green-400">{fmt(r.withdrawn)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{fmt(r.expenses)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">{fmt(r.endValue)}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${r.cashflow >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {r.cashflow >= 0 ? "+" : ""}{fmt(r.cashflow)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function LiveOnDividendsPage() {
  const [step,        setStep]        = useState(1);
  const [maxReached,  setMaxReached]  = useState(1);
  const [expenses,    setExpenses]    = useState<ExpenseRow[]>(DEFAULT_EXPENSES);
  const [holdings,    setHoldings]    = useState<Holding[]>(DEFAULT_HOLDINGS);
  const [totalAmount, setTotalAmount] = useState(350_000);
  const [dripPct,     setDripPct]     = useState(0);

  // Load saved state on mount
  useEffect(() => {
    const saved = loadSavedState();
    if (saved) {
      setStep(saved.step);
      setMaxReached(saved.maxReached);
      setExpenses(saved.expenses);
      setHoldings(saved.holdings);
      setTotalAmount(saved.totalAmount);
      setDripPct(saved.dripPct);
      const maxId = saved.holdings.length ? Math.max(...saved.holdings.map((h) => h.id)) : 6;
      _nextId = Math.max(7, maxId + 1);
    }
  }, []);

  // Save state when it changes (debounced to avoid excessive writes)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveState({
        step,
        maxReached,
        expenses,
        holdings,
        totalAmount,
        dripPct,
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [step, maxReached, expenses, holdings, totalAmount, dripPct]);

  const monthlyExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const annualExpenses  = monthlyExpenses * 12;
  const blendedYield    = holdings.reduce((s, h) => s + (h.pct / 100) * h.yieldPct, 0);
  const blendedRoc      = holdings.reduce((s, h) => s + (h.pct / 100) * (h.rocPct ?? 0), 0);

  function goStep(n: number) { setStep(n); if (n > maxReached) setMaxReached(n); }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Live On Dividends</h1>
        <p className="text-gray-500 text-sm mt-1">
          Map your expenses · build a portfolio · project your financial future
        </p>
      </div>

      <StepBar step={step} maxReached={maxReached} go={setStep} />

      {step === 1 && (
        <Step1 expenses={expenses} setExpenses={setExpenses} onNext={() => goStep(2)} />
      )}
      {step === 2 && (
        <Step2
          monthlyExpenses={monthlyExpenses}
          holdings={holdings} setHoldings={setHoldings}
          totalAmount={totalAmount} setTotalAmount={setTotalAmount}
          dripPct={dripPct} setDripPct={setDripPct}
          onNext={() => goStep(3)}
        />
      )}
      {step === 3 && (
        <Step3
          annualExpenses={annualExpenses}
          totalAmount={totalAmount}
          blendedYield={blendedYield}
          blendedRoc={blendedRoc}
        />
      )}
    </div>
  );
}
