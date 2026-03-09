"use client";

type Tier = "A" | "B" | "C" | "D" | "F";

interface ETF {
  ticker: string;
  name: string;
  yield: string;
  fiveYr: string | null; // null = no data
}

const TIER_CONFIG: Record<Tier, { color: string; bg: string; border: string; label: string }> = {
  A: { color: "#facc15", bg: "bg-yellow-500/10", border: "border-yellow-500/30", label: "Best NAV + Yield" },
  B: { color: "#22c55e", bg: "bg-green-500/10",  border: "border-green-500/30",  label: "Solid Income"    },
  C: { color: "#60a5fa", bg: "bg-blue-500/10",   border: "border-blue-500/30",   label: "High Yield / Some Decay" },
  D: { color: "#f97316", bg: "bg-orange-500/10", border: "border-orange-500/30", label: "Significant Decay" },
  F: { color: "#f87171", bg: "bg-red-500/10",    border: "border-red-500/30",    label: "Avoid" },
};

const TIERS: { tier: Tier; etfs: ETF[] }[] = [
  {
    tier: "A",
    etfs: [
      { ticker: "QQQI",  name: "NEOS Nasdaq-100 High Income ETF",                      yield: "14.03%", fiveYr: "5.40%"   },
      { ticker: "TSPY",  name: "TappAlpha SPY Growth & Daily Income ETF",              yield: "14.59%", fiveYr: "1.02%"   },
      { ticker: "BTCI",  name: "NEOS Bitcoin High Income ETF",                         yield: "26.54%", fiveYr: "-30.39%" },
      { ticker: "BITY",  name: "Amplify Bitcoin 2% Monthly Option Income ETF",         yield: "24.77%", fiveYr: "-36.95%" },
      { ticker: "QDVO",  name: "Amplify CWP Growth & Income ETF",                      yield: "10.15%", fiveYr: "13.31%"  },
      { ticker: "SPYH",  name: "NEOS S&P 500 Hedged Equity Income ETF",               yield: "7.84%",  fiveYr: "13.63%"  },
      { ticker: "QQQH",  name: "NEOS Nasdaq-100 Hedged Equity Income ETF",             yield: "8.99%",  fiveYr: "-1.00%"  },
      { ticker: "SPYI",  name: "NEOS S&P 500 High Income ETF",                         yield: "12.10%", fiveYr: "5.39%"   },
      { ticker: "GPIX",  name: "Goldman Sachs S&P 500 Premium Income ETF",             yield: "8.58%",  fiveYr: "32.53%"  },
      { ticker: "GPIQ",  name: "Goldman Sachs Nasdaq-100 Premium Income ETF",          yield: "10.52%", fiveYr: "33.60%"  },
      { ticker: "TDVI",  name: "FT Vest Technology Dividend Target Income ETF",        yield: "7.00%",  fiveYr: "40.32%"  },
    ],
  },
  {
    tier: "B",
    etfs: [
      { ticker: "BAGY",  name: "Amplify Bitcoin Max Income Covered Call ETF",          yield: "36.84%", fiveYr: "-40.83%" },
      { ticker: "TDAQ",  name: "TappAlpha Innovation 100 Growth & Daily Income ETF",   yield: "—",      fiveYr: null       },
      { ticker: "DIVO",  name: "Amplify CWP Enhanced Dividend Income ETF",             yield: "4.76%",  fiveYr: "37.92%"  },
      { ticker: "IAUI",  name: "NEOS Gold High Income ETF",                            yield: "12.04%", fiveYr: "23.92%"  },
      { ticker: "IWMI",  name: "NEOS Russell 2000 High Income ETF",                    yield: "14.66%", fiveYr: "-1.42%"  },
      { ticker: "CSHI",  name: "NEOS Enhanced Income 1-3 Month T-Bill ETF",            yield: "4.80%",  fiveYr: "-0.58%"  },
      { ticker: "IQQQ",  name: "ProShares Nasdaq-100 High Income ETF",                 yield: "5.55%",  fiveYr: "8.33%"   },
      { ticker: "NVII",  name: "REX NVDA Growth & Income ETF",                         yield: "19.82%", fiveYr: "2.80%"   },
      { ticker: "IYRI",  name: "NEOS Real Estate High Income ETF",                     yield: "10.93%", fiveYr: "-0.87%"  },
      { ticker: "BLOK",  name: "Amplify Blockchain Technology ETF",                    yield: "0.75%",  fiveYr: "11.55%"  },
      { ticker: "EIPI",  name: "FT Energy Income Partners Enhanced Income ETF",        yield: "6.74%",  fiveYr: "20.98%"  },
      { ticker: "BUYW",  name: "Main BuyWrite ETF",                                    yield: "6.01%",  fiveYr: "13.44%"  },
      { ticker: "FTQI",  name: "First Trust Nasdaq BuyWrite Income ETF",               yield: "12.15%", fiveYr: "-1.59%"  },
      { ticker: "PBP",   name: "Invesco S&P 500 BuyWrite ETF",                         yield: "10.72%", fiveYr: "9.25%"   },
      { ticker: "EGGY",  name: "NestYield Dynamic Income ETF",                         yield: "37.46%", fiveYr: "-19.24%" },
      { ticker: "EGGS",  name: "NestYield Total Return Guard ETF",                     yield: "20.95%", fiveYr: "-10.01%" },
      { ticker: "EGGQ",  name: "Nestyield Visionary ETF",                              yield: "10.36%", fiveYr: "7.31%"   },
      { ticker: "BLOX",  name: "Nicholas Crypto Income ETF",                           yield: "8.41%",  fiveYr: "-20.76%" },
      { ticker: "BETH",  name: "ProShares Bitcoin & Ether Market Cap Weight ETF",      yield: "1.61%",  fiveYr: "-1.64%"  },
    ],
  },
  {
    tier: "C",
    etfs: [
      { ticker: "JEPI",  name: "JPMorgan Equity Premium Income ETF",                   yield: "7.19%",  fiveYr: "5.72%"   },
      { ticker: "JEPQ",  name: "JPMorgan Nasdaq Equity Premium Income ETF",            yield: "10.60%", fiveYr: "12.82%"  },
      { ticker: "QYLD",  name: "Global X NASDAQ 100 Covered Call ETF",                 yield: "12.05%", fiveYr: "-20.04%" },
      { ticker: "OMAH",  name: "VistaShares Target 15 Berkshire Select Income ETF",    yield: "15.19%", fiveYr: "-8.30%"  },
      { ticker: "AIPI",  name: "REX AI Equity Premium Income ETF",                     yield: "34.35%", fiveYr: "-28.40%" },
      { ticker: "MDST",  name: "Westwood Salient Enhanced Midstream Income ETF",       yield: "9.39%",  fiveYr: "15.14%"  },
      { ticker: "XLBI",  name: "State Street Materials Sel Sec SPDR Pr In ETF",        yield: "17.51%", fiveYr: "-1.67%"  },
      { ticker: "XLKI",  name: "State Street Tech Sel Sec SPDR Pr In ETF",             yield: "17.91%", fiveYr: "-1.28%"  },
      { ticker: "XLUI",  name: "State Street Utl Sel Sec SPDR Prem Inc ETF",           yield: "10.74%", fiveYr: "-0.71%"  },
      { ticker: "XLEI",  name: "State Street Energy Sel Sec SPDR Prem Inc ETF",        yield: "20.62%", fiveYr: "6.33%"   },
      { ticker: "XLRI",  name: "State Street Real Estate Sel Sec SPDR Pr In ETF",      yield: "11.89%", fiveYr: "-4.92%"  },
      { ticker: "XLYI",  name: "State Street Cons Disc Sel Sect SPDR Prem In ETF",     yield: "9.26%",  fiveYr: "-3.36%"  },
      { ticker: "XLVI",  name: "State Street Health Care Sel Sec SPDR Prem Inc ETF",   yield: "14.80%", fiveYr: "4.83%"   },
      { ticker: "XLSI",  name: "State Street Con Stpls Sel Sec SPDR Prem In ETF",      yield: "14.65%", fiveYr: "-2.72%"  },
      { ticker: "XLFI",  name: "State Street Financial Sel Sec SPDR Prem Inc ETF",     yield: "14.18%", fiveYr: "-6.53%"  },
      { ticker: "XLII",  name: "State Street Industrial Sel Sec SPDR Pr In ETF",       yield: "15.33%", fiveYr: "3.00%"   },
    ],
  },
  {
    tier: "D",
    etfs: [
      { ticker: "MSII",  name: "REX MSTR Growth And Income ETF",                       yield: "9.24%",  fiveYr: "-72.30%" },
      { ticker: "QDTE",  name: "Roundhill Innov-100 0DTE Covered Call Strat ETF",      yield: "8.98%",  fiveYr: "-36.28%" },
      { ticker: "XYLD",  name: "Global X S&P 500 Covered Call ETF",                    yield: "10.08%", fiveYr: "-12.85%" },
      { ticker: "BCCC",  name: "Global X Bitcoin Covered Call ETF",                    yield: "8.19%",  fiveYr: "-43.42%" },
      { ticker: "YBTC",  name: "Fineqia Bitcoin Yield ETP",                            yield: "195.14%",fiveYr: "-24.58%" },
      { ticker: "IVVW",  name: "iShares S&P 500 BuyWrite ETF",                         yield: "14.65%", fiveYr: "-9.68%"  },
      { ticker: "MAGY",  name: "Roundhill Magnificent Seven Covered Call ETF",         yield: "29.41%", fiveYr: "-7.63%"  },
      { ticker: "TLTP",  name: "Amplify TLT US Treasury 12% Option Income ETF",        yield: "12.27%", fiveYr: "-12.25%" },
    ],
  },
  {
    tier: "F",
    etfs: [
      { ticker: "TQQY",  name: "GraniteShares YieldBOOST QQQ ETF",                    yield: "50.17%", fiveYr: "-41.26%" },
      { ticker: "YSPY",  name: "GraniteShares YieldBOOST SPY ETF",                    yield: "50.50%", fiveYr: "-30.81%" },
      { ticker: "YETH",  name: "Roundhill Ether Covered Call Strategy ETF",            yield: "83.57%", fiveYr: "-77.80%" },
      { ticker: "XDTE",  name: "Roundhill S&P 500 0DTE Covered Call Strategy ETF",    yield: "27.14%", fiveYr: "-25.81%" },
      { ticker: "TLTW",  name: "iShares 20+ Year Treasury Bond BuyWrite Strat ETF",   yield: "10.63%", fiveYr: "-41.71%" },
      { ticker: "RYLD",  name: "Global X Russell 2000 Covered Call ETF",               yield: "12.25%", fiveYr: "-33.82%" },
      { ticker: "LQDI",  name: "iShares Investment Grade Corporate Bd BW Strat ETF",   yield: "7.99%",  fiveYr: "-38.39%" },
      { ticker: "HYGI",  name: "iShares High Yield Corporate Bond BW Strat ETF",       yield: "5.00%",  fiveYr: "-25.14%" },
      { ticker: "RDTE",  name: "Roundhill Russell 2000 0DTE Covered Call Strat ETF",   yield: "37.68%", fiveYr: "-31.81%" },
      { ticker: "DJIA",  name: "Global X Dow 30 Covered Call ETF",                    yield: "5.92%",  fiveYr: "-9.09%"  },
    ],
  },
];

function fiveYrColor(val: string | null): string {
  if (!val) return "text-gray-600";
  return val.startsWith("-") ? "text-red-400" : "text-green-400";
}

export default function TierListPage() {
  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-1">ETF Tier List</h1>
      <p className="text-gray-400 text-sm mb-6">
        Ranked by NAV growth &amp; sustainable yield · no YieldMax · static data
      </p>

      <div className="space-y-3">
        {TIERS.map(({ tier, etfs }) => {
          const cfg = TIER_CONFIG[tier];
          return (
            <div
              key={tier}
              className={`rounded-2xl border ${cfg.bg} ${cfg.border} overflow-hidden`}
            >
              {/* Tier header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <span className="text-3xl font-black leading-none w-8 text-center" style={{ color: cfg.color }}>
                  {tier}
                </span>
                <span className="text-sm text-gray-400 font-medium">{cfg.label}</span>
                <span className="ml-auto text-xs text-gray-600">{etfs.length} ETFs</span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-4 py-2 text-gray-600 text-xs font-medium uppercase tracking-wide w-24">Ticker</th>
                      <th className="text-left px-4 py-2 text-gray-600 text-xs font-medium uppercase tracking-wide">ETF</th>
                      <th className="text-right px-4 py-2 text-gray-600 text-xs font-medium uppercase tracking-wide w-24">Yield</th>
                      <th className="text-right px-4 py-2 text-gray-600 text-xs font-medium uppercase tracking-wide w-32">5-Yr Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etfs.map((etf, i) => (
                      <tr
                        key={etf.ticker}
                        className={`border-b border-white/5 last:border-0 transition-colors hover:bg-white/5 ${
                          i % 2 === 0 ? "" : "bg-white/[0.02]"
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <span className="font-bold text-white">{etf.ticker}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs leading-snug max-w-xs">{etf.name}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="font-bold text-base" style={{ color: cfg.color }}>
                            {etf.yield}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-medium text-sm ${fiveYrColor(etf.fiveYr)}`}>
                            {etf.fiveYr ?? "N/A"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-gray-700 text-xs mt-6 text-center">
        Static data · no YieldMax products included · 5-year price return only (excludes dividends)
      </p>
    </div>
  );
}
