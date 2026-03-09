"use client";
import { useState } from "react";
import TickerSearch from "@/components/TickerSearch";

interface StockData {
  ticker: string;
  price: number;
  name: string;
}

interface DividendData {
  latest_dividend: number;
  annual_dividend: number;
  frequency: number;
  history: { amount: number; ex_date: string; pay_date: string }[];
}

export default function YieldCalculator() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stock, setStock] = useState<StockData | null>(null);
  const [divData, setDivData] = useState<DividendData | null>(null);

  async function lookup(overrideTicker?: string) {
    const t = (overrideTicker ?? ticker).trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    setError("");
    setStock(null);
    setDivData(null);

    try {
      const [stockRes, divRes] = await Promise.all([
        fetch(`/api/stock/${t}`),
        fetch(`/api/dividends/${t}`),
      ]);

      if (!stockRes.ok) throw new Error("Ticker not found");
      const stockJson = await stockRes.json();
      if (overrideTicker) setTicker(overrideTicker);
      setStock(stockJson);

      if (divRes.ok) {
        const divJson = await divRes.json();
        setDivData(divJson);
      } else {
        setDivData(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const yield_pct =
    stock?.price && divData?.annual_dividend
      ? ((divData.annual_dividend / stock.price) * 100).toFixed(2)
      : null;

  const freqLabel: Record<number, string> = {
    1: "Annual",
    2: "Semi-annual",
    4: "Quarterly",
    12: "Monthly",
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-1">Dividend Yield Calculator</h1>
      <p className="text-gray-400 text-sm mb-6">
        Look up any stock to see its live yield and dividend info.
      </p>

      <div className="flex gap-2 mb-6">
        <TickerSearch
          value={ticker}
          onChange={setTicker}
          onSelect={lookup}
          placeholder="e.g. AAPL, O, SCHD"
          className="flex-1"
        />
        <button
          onClick={() => lookup()}
          disabled={loading}
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

      {stock && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Company</p>
            <p className="font-semibold text-lg">{stock.name}</p>
            <p className="text-gray-400 text-sm">{stock.ticker}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Stat label="Current Price" value={stock.price ? `$${stock.price.toFixed(2)}` : "N/A"} />
            <Stat
              label="Dividend Yield"
              value={yield_pct ? `${yield_pct}%` : "N/A"}
              highlight={!!yield_pct}
            />
            <Stat
              label="Annual Dividend"
              value={divData ? `$${divData.annual_dividend.toFixed(4)}` : "N/A"}
            />
            <Stat
              label="Per Payment"
              value={divData ? `$${divData.latest_dividend.toFixed(4)}` : "N/A"}
            />
            <Stat
              label="Frequency"
              value={divData ? (freqLabel[divData.frequency] ?? `${divData.frequency}x/yr`) : "N/A"}
            />
          </div>

          {divData && divData.history.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Recent Dividends</p>
              <div className="space-y-1">
                {divData.history.slice(0, 6).map((d, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-400">{d.ex_date}</span>
                    <span className="font-medium">${d.amount.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!divData && (
            <p className="text-gray-500 text-sm">No dividend data available for this ticker.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <p className="text-gray-400 text-xs mb-0.5">{label}</p>
      <p className={`font-bold text-lg ${highlight ? "text-brand-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
