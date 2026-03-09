"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

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
  dividends: { amount: number; t: number }[];
  loading: boolean;
  error: string | null;
}

function fmt$(n: number | null, decimals = 2) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtPct(n: number | null) {
  if (n == null) return "—";
  return n.toFixed(2) + "%";
}

export default function PortfolioHoldingsPage() {
  const params = useParams<{ id: string }>();
  const portfolioId = params.id;

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [tickerInput, setTickerInput] = useState("");
  const [sharesInput, setSharesInput] = useState("");
  const [costInput, setCostInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editShares, setEditShares] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editDate, setEditDate] = useState("");

  const loadPortfolio = useCallback(async () => {
    try {
      const res = await fetch(`/api/portfolio-groups/${portfolioId}/holdings`);
      if (!res.ok) return;
      const data: Holding[] = await res.json();
      setHoldings(data.map((h) => ({ ...h, loading: false })));
    } catch {
      // silently fail
    } finally {
      setInitialLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);

  async function addHolding() {
    const t = tickerInput.trim().toUpperCase();
    const s = parseFloat(sharesInput);
    if (!t || isNaN(s) || s <= 0) { setAddError("Enter a valid ticker and share count."); return; }
    setAddError("");
    setAdding(true);

    const placeholder: Holding = {
      ticker: t, shares: s,
      cost_basis: costInput ? parseFloat(costInput) : null,
      purchase_date: dateInput || null,
      dividends_received: null,
      name: t, price: null, annual_dividend: null, yield_pct: null,
      dividends: [], loading: true, error: null,
    };
    setHoldings((prev) => {
      const idx = prev.findIndex((h) => h.ticker === t);
      return idx >= 0 ? prev.map((h) => h.ticker === t ? placeholder : h) : [...prev, placeholder];
    });

    try {
      await fetch(`/api/portfolio-groups/${portfolioId}/holdings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: t, shares: s,
          cost_basis: costInput || null,
          purchase_date: dateInput || null,
        }),
      });
      await loadPortfolio();
    } catch {
      setHoldings((prev) => prev.map((h) => h.ticker === t ? { ...h, loading: false, error: "Failed to save" } : h));
    } finally {
      setAdding(false);
      setTickerInput("");
      setSharesInput("");
      setCostInput("");
      setDateInput("");
    }
  }

  async function remove(ticker: string) {
    setHoldings((prev) => prev.filter((h) => h.ticker !== ticker));
    await fetch(`/api/portfolio-groups/${portfolioId}/holdings/${ticker}`, { method: "DELETE" });
  }

  async function saveEdit(ticker: string) {
    const s = parseFloat(editShares);
    if (isNaN(s) || s <= 0) return;
    setHoldings((prev) => prev.map((h) => h.ticker === ticker
      ? { ...h, shares: s, cost_basis: editCost ? parseFloat(editCost) : h.cost_basis, loading: true }
      : h
    ));
    setEditingTicker(null);
    await fetch(`/api/portfolio-groups/${portfolioId}/holdings/${ticker}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shares: s,
        cost_basis: editCost || null,
        purchase_date: editDate || null,
      }),
    });
    await loadPortfolio();
  }

  const loaded = holdings.filter((h) => !h.loading && !h.error);
  const totalValue   = loaded.reduce((s, h) => s + (h.price ?? 0) * h.shares, 0);
  const totalCost    = loaded.reduce((s, h) => s + (h.cost_basis ?? 0) * h.shares, 0);
  const totalIncome  = loaded.reduce((s, h) => s + (h.annual_dividend ?? 0) * h.shares, 0);
  const blendedYield = totalValue > 0 ? (totalIncome / totalValue) * 100 : 0;
  const totalPnL     = totalCost > 0 ? totalValue - totalCost : null;
  const totalPnLPct  = totalCost > 0 && totalPnL != null ? (totalPnL / totalCost) * 100 : null;
  const hasCostBasis = loaded.some((h) => h.cost_basis != null);

  return (
    <div>
      {/* Add holding form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-gray-300 mb-3">Add Holding</p>
        <div className="flex flex-wrap gap-2 items-start">
          <input
            type="text" placeholder="Ticker (e.g. SCHD)"
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addHolding()}
            className="w-36 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 text-sm"
          />
          <input
            type="number" placeholder="Shares"
            value={sharesInput}
            onChange={(e) => setSharesInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addHolding()}
            className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 text-sm"
          />
          <input
            type="number" placeholder="Avg Cost / Share (optional)"
            value={costInput}
            onChange={(e) => setCostInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addHolding()}
            className="w-52 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 text-sm"
          />
          <div className="flex flex-col gap-0.5">
            <input
              type="date" title="Purchase date (for total return)"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="w-40 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand-500 text-sm [color-scheme:dark]"
            />
            <span className="text-gray-600 text-[10px] px-1">Purchase date (optional)</span>
          </div>
          <button
            onClick={addHolding} disabled={adding}
            className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium transition-colors text-sm"
          >
            {adding ? "Adding…" : "Add Holding"}
          </button>
        </div>
        {addError && <p className="text-red-400 text-xs mt-2">{addError}</p>}
      </div>

      {initialLoading ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-500">
          <div className="inline-block w-5 h-5 border-2 border-gray-700 border-t-brand-500 rounded-full animate-spin mb-3" />
          <p>Loading your portfolio…</p>
        </div>
      ) : holdings.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-gray-300 font-medium mb-1">No holdings yet</p>
          <p className="text-gray-500 text-sm">Add a ticker above to start tracking your dividend income.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <StatCard label="Portfolio Value" value={fmt$(totalValue)} />
            <StatCard label="Annual Income"   value={fmt$(totalIncome)} green />
            <StatCard label="Monthly Income"  value={fmt$(totalIncome / 12)} />
            <StatCard label="Blended Yield"   value={fmtPct(blendedYield)} />
          </div>
          {hasCostBasis && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <StatCard label="Total Cost Basis" value={fmt$(totalCost)} />
              <StatCard
                label="Unrealized P&L"
                value={totalPnL != null
                  ? `${totalPnL >= 0 ? "+" : ""}${fmt$(totalPnL)}${totalPnLPct != null ? ` (${totalPnLPct >= 0 ? "+" : ""}${totalPnLPct.toFixed(1)}%)` : ""}`
                  : "—"
                }
                pnl={totalPnL}
              />
            </div>
          )}
          {!hasCostBasis && <div className="mb-6" />}

          {/* Holdings table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                    <th className="text-left px-4 py-3">Ticker</th>
                    <th className="text-right px-4 py-3">Shares</th>
                    <th className="text-right px-4 py-3">Price</th>
                    <th className="text-right px-4 py-3">Yield</th>
                    <th className="text-right px-4 py-3">Div / Share</th>
                    <th className="text-right px-4 py-3">Annual Income</th>
                    <th className="text-right px-4 py-3">Mkt Value</th>
                    {hasCostBasis && <th className="text-right px-4 py-3">Cost Basis</th>}
                    {hasCostBasis && <th className="text-right px-4 py-3">P&L</th>}
                    <th className="px-4 py-3 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const income  = h.annual_dividend != null ? h.annual_dividend * h.shares : null;
                    const mktVal  = h.price != null ? h.price * h.shares : null;
                    const costVal = h.cost_basis != null ? h.cost_basis * h.shares : null;
                    const pnl     = mktVal != null && costVal != null ? mktVal - costVal : null;
                    const pnlPct  = costVal && pnl != null && costVal > 0 ? (pnl / costVal) * 100 : null;
                    const isEditing = editingTicker === h.ticker;

                    return (
                      <tr key={h.ticker} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold">{h.ticker}</p>
                          <p className="text-gray-500 text-xs truncate max-w-[130px]">{h.name}</p>
                          {h.purchase_date && !isEditing && (
                            <p className="text-gray-600 text-[10px] mt-0.5">Since {h.purchase_date}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <input type="number" value={editShares}
                              onChange={(e) => setEditShares(e.target.value)}
                              className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs text-right focus:outline-none focus:border-brand-500" />
                          ) : h.shares}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {h.loading ? <Spinner /> : h.error ? <span className="text-red-400 text-xs">{h.error}</span> : fmt$(h.price)}
                        </td>
                        <td className="px-4 py-3 text-right text-brand-400">
                          {h.loading ? <Spinner /> : fmtPct(h.yield_pct)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300">
                          {h.loading ? <Spinner /> : fmt$(h.annual_dividend, 4)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-brand-400">
                          {h.loading ? <Spinner /> : fmt$(income)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {h.loading ? <Spinner /> : fmt$(mktVal)}
                        </td>
                        {hasCostBasis && (
                          <td className="px-4 py-3 text-right text-gray-400">
                            {isEditing ? (
                              <input type="number" value={editCost} placeholder="—"
                                onChange={(e) => setEditCost(e.target.value)}
                                className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs text-right focus:outline-none focus:border-brand-500" />
                            ) : fmt$(costVal)}
                          </td>
                        )}
                        {hasCostBasis && (
                          <td className="px-4 py-3 text-right">
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
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isEditing ? (
                              <div className="flex flex-col items-end gap-1.5">
                                <input
                                  type="date" value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                  className="w-32 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-brand-500 [color-scheme:dark]"
                                  title="Purchase date"
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => saveEdit(h.ticker)} className="text-brand-400 hover:text-brand-300 text-xs font-medium transition-colors">Save</button>
                                  <button onClick={() => setEditingTicker(null)} className="text-gray-500 hover:text-gray-300 text-xs transition-colors">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <button onClick={() => {
                                  setEditingTicker(h.ticker);
                                  setEditShares(String(h.shares));
                                  setEditCost(h.cost_basis ? String(h.cost_basis) : "");
                                  setEditDate(h.purchase_date ?? "");
                                }}
                                  className="text-gray-500 hover:text-gray-300 text-xs transition-colors">Edit</button>
                                <button onClick={() => remove(h.ticker)}
                                  className="text-gray-600 hover:text-red-400 transition-colors text-xs">Remove</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Income allocation bars */}
          {totalIncome > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Income Allocation</h2>
              <div className="space-y-3">
                {loaded
                  .filter((h) => h.annual_dividend && h.annual_dividend > 0)
                  .sort((a, b) => (b.annual_dividend! * b.shares) - (a.annual_dividend! * a.shares))
                  .map((h) => {
                    const income = h.annual_dividend! * h.shares;
                    const pct = (income / totalIncome) * 100;
                    return (
                      <div key={h.ticker}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-200">{h.ticker}
                            <span className="text-gray-500 ml-1.5 font-normal">{h.name}</span>
                          </span>
                          <span className="text-gray-400">{fmt$(income)}/yr · {pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, green, pnl }: { label: string; value: string; green?: boolean; pnl?: number | null }) {
  const color = pnl != null
    ? pnl >= 0 ? "text-green-400" : "text-red-400"
    : green ? "text-brand-400"
    : "text-white";
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold ${color} leading-tight`}>{value}</p>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-flex justify-end">
      <span className="w-4 h-4 border-2 border-gray-700 border-t-brand-500 rounded-full animate-spin" />
    </span>
  );
}
