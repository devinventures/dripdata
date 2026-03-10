import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// ── Signed-in dashboard tool grid ────────────────────────────────────────────
const tools = [
  {
    href: "/yield-calculator",
    title: "Dividend Yield Calculator",
    desc: "Enter any ticker to instantly see its live yield, annual dividend, and payout frequency.",
    icon: "%",
  },
  {
    href: "/portfolio-tracker",
    title: "Portfolio Dividend Tracker",
    desc: "Add your holdings and see your total projected annual dividend income in real time.",
    icon: "📊",
  },
  {
    href: "/drip-calculator",
    title: "DRIP Calculator",
    desc: "Model the compounding power of reinvesting dividends over time.",
    icon: "💧",
  },
  {
    href: "/income-projector",
    title: "Dividend Income Projector",
    desc: "Project future income based on investment amount, yield, and dividend growth rate.",
    icon: "📈",
  },
  {
    href: "/total-return",
    title: "Total Return Calculator",
    desc: "See price appreciation + dividends combined. Compare DRIP vs no reinvestment over any period.",
    icon: "🏆",
  },
  {
    href: "/etf-lookup",
    title: "ETF Lookup",
    desc: "Full data snapshot — price, 52-week range, dividend yield, payment history, and growth.",
    icon: "🔍",
  },
  {
    href: "/yield-trap",
    title: "Yield Trap Calculator",
    desc: "Is that high yield real income — or a trap? Instantly score any ETF by NAV change vs. distributions.",
    icon: "🪤",
  },
];

// ── Landing page feature highlights ──────────────────────────────────────────
const features = [
  {
    icon: "🔍",
    title: "Research ETFs & Stocks",
    desc: "Deep-dive into any ticker — expense ratio, AUM, top holdings, sector weights, 52-week range, and full dividend history.",
    tools: ["ETF Lookup", "Compare", "Tier List"],
  },
  {
    icon: "💧",
    title: "Calculate & Project Income",
    desc: "Model DRIP compounding, forecast dividend income over years, and see your true total return with reinvestment.",
    tools: ["DRIP Calculator", "Income Projector", "Total Return"],
  },
  {
    icon: "🪤",
    title: "Avoid Yield Traps",
    desc: "High yield isn't always real income. Instantly score any ETF to see if distributions are eroding your NAV.",
    tools: ["Yield Trap Calculator", "Yield Calculator"],
  },
];

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  return (
    <>
      {/* ── SIGNED OUT: Marketing landing page ───────────────────────────── */}
      {!userId && (
        <div className="-mt-8">

          {/* Hero ─────────────────────────────────────────────────────────── */}
          <section className="relative py-20 sm:py-28 overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-600/10 rounded-full blur-3xl" />
            </div>

            <div className="max-w-3xl mx-auto text-center px-4">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-brand-900/30 border border-brand-700/40 text-brand-400 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
                <span>💧</span>
                <span>Live Market Data · Pro from $5/month</span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight mb-6">
                Your{" "}
                <span className="text-brand-500">Dividend</span>{" "}
                Research,
                <br />
                All in One Place
              </h1>

              {/* Subheadline */}
              <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                Real-time yield calculators, ETF deep-dives, and portfolio tracking —
                built for income investors who want the numbers, not the noise.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-base shadow-lg shadow-brand-900/30"
                >
                  Get Started Free
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-200 font-semibold px-8 py-3.5 rounded-xl transition-colors text-base"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </section>

          {/* Stats bar ───────────────────────────────────────────────────── */}
          <section className="border-y border-gray-800 py-5 mb-16">
            <div className="flex flex-wrap justify-center gap-x-12 gap-y-3 text-sm text-gray-400">
              {[
                { label: "Dividend Tools", value: "8+" },
                { label: "Live Market Data", value: "✓" },
                { label: "Portfolio Tracker", value: "Pro $5/mo" },
                { label: "Light & Dark Mode", value: "✓" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="font-semibold text-white">{s.value}</span>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Features ────────────────────────────────────────────────────── */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-center mb-2">Everything you need to invest smarter</h2>
            <p className="text-gray-400 text-center mb-10">Three categories of tools, built for dividend investors.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-4"
                >
                  <div className="w-12 h-12 bg-brand-900/30 border border-brand-800/40 rounded-xl flex items-center justify-center text-2xl">
                    {f.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2">
                    {f.tools.map((t) => (
                      <span
                        key={t}
                        className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-2.5 py-1 rounded-lg"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tool preview grid ───────────────────────────────────────────── */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-center mb-2">Everything in one platform</h2>
            <p className="text-gray-400 text-center mb-10">Yield calculators, ETF research, and more. Portfolio Tracker requires Pro ($5/month).</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tools.map((t) => (
                <div
                  key={t.href}
                  className="relative group bg-gray-900 border border-gray-800 rounded-xl p-5 overflow-hidden"
                >
                  {/* Lock overlay on hover */}
                  <div className="absolute inset-0 bg-gray-950/70 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl z-10">
                    <Link
                      href="/sign-up"
                      className="bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      Sign up to access →
                    </Link>
                  </div>
                  <div className="text-2xl mb-3">{t.icon}</div>
                  <h3 className="font-semibold mb-1">{t.title}</h3>
                  <p className="text-gray-400 text-sm">{t.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom CTA ──────────────────────────────────────────────────── */}
          <section className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/50 dark:via-gray-900 dark:to-gray-900 border border-brand-200 dark:border-brand-800/30 p-10 sm:p-14 text-center mb-8">
            <div className="absolute bottom-0 right-0 w-72 h-72 bg-brand-600/10 rounded-full blur-3xl -z-10" />
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
              Start building your dividend portfolio today
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto text-lg">
              Join DripData and get instant access to free tools — upgrade to Pro for $5/month to unlock the Portfolio Tracker.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-lg shadow-brand-900/40 text-base"
            >
              Get Started
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </section>

        </div>
      )}

      {/* ── SIGNED IN: Dashboard tool grid ───────────────────────────────── */}
      {userId && (
        <div>
          <div className="mb-12 mt-4">
            <h1 className="text-4xl font-bold mb-3">
              <span className="text-brand-500">Drip</span>Data
            </h1>
            <p className="text-gray-400 text-lg">
              Real-time dividend calculators and portfolio tools, powered by live market data.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tools.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="group block bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-brand-600 transition-colors"
              >
                <div className="text-3xl mb-3">{t.icon}</div>
                <h2 className="font-semibold text-lg mb-1 group-hover:text-brand-400 transition-colors">
                  {t.title}
                </h2>
                <p className="text-gray-400 text-sm">{t.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
