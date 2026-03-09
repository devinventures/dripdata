"use client";
import { useState, useEffect, useRef } from "react";

interface Result {
  ticker: string;
  name: string;
  type: string;
}

interface Props {
  value: string;
  onChange: (ticker: string) => void;
  onSelect?: (ticker: string) => void;
  placeholder?: string;
  className?: string;
}

export default function TickerSearch({
  value,
  onChange,
  onSelect,
  placeholder = "e.g. SCHD, O, AAPL",
  className = "",
}: Props) {
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value || value.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen((data.results ?? []).length > 0);
        setActiveIdx(-1);
      } catch {
        setResults([]);
      }
    }, 250);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(ticker: string) {
    onChange(ticker);
    setOpen(false);
    setResults([]);
    onSelect?.(ticker);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      select(results[activeIdx].ticker);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const typeLabel: Record<string, string> = {
    CS: "Stock",
    ETF: "ETF",
    ETP: "ETP",
    ADRC: "ADR",
    FUND: "Fund",
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        autoComplete="off"
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl">
          {results.map((r, i) => (
            <li key={r.ticker}>
              <button
                type="button"
                onMouseDown={() => select(r.ticker)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-gray-700 transition-colors ${
                  i === activeIdx ? "bg-gray-700" : ""
                }`}
              >
                <span className="font-semibold text-white w-16 shrink-0">{r.ticker}</span>
                <span className="text-gray-400 text-sm truncate flex-1">{r.name}</span>
                {r.type && (
                  <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
                    {typeLabel[r.type] ?? r.type}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
