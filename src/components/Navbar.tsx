"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { User } from "@supabase/supabase-js";
import { RESEARCH_LINKS, CALCULATOR_LINKS } from "@/lib/navigation";

type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "free" | null;

interface NavItem {
  href: string;
  label: string;
  desc: string;
  icon: string;
}

interface NavGroup {
  label: string;
  href?: string;
  items?: NavItem[];
}

interface PortfolioGroup {
  id: string;
  name: string;
}

// Extra metadata (desc + icon) layered on top of the shared link list
const RESEARCH_META: Pick<NavItem, "desc" | "icon">[] = [
  { icon: "🔍", desc: "Full data snapshot — price, yield & history" },
  { icon: "📋", desc: "Browse 30+ income ETFs — yield, AUM & return" },
  { icon: "⚖️", desc: "Side-by-side multi-ETF total return chart" },
  { icon: "🏅", desc: "Ranked income ETF picks — no YieldMax" },
];

const CALCULATOR_META: Pick<NavItem, "desc" | "icon">[] = [
  { icon: "%",  desc: "Instant live yield from any ticker" },
  { icon: "💧", desc: "Model dividend reinvestment compounding" },
  { icon: "📈", desc: "Multi-year dividend income forecast" },
  { icon: "🏆", desc: "Price appreciation + dividends combined" },
  { icon: "🌴", desc: "Plan the portfolio size needed to retire on income" },
  { icon: "🪤", desc: "Is that high yield real income or a NAV trap?" },
];

const navGroups: NavGroup[] = [
  { label: "Home", href: "/" },
  {
    label: "Research",
    items: RESEARCH_LINKS.map((l, i) => ({ ...l, ...RESEARCH_META[i] })),
  },
  {
    label: "Calculators",
    items: CALCULATOR_LINKS.map((l, i) => ({ ...l, ...CALCULATOR_META[i] })),
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [portfolios, setPortfolios] = useState<PortfolioGroup[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(null);
  const navRef = useRef<HTMLElement>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // Load portfolio groups + subscription status when user signs in
  useEffect(() => {
    if (!user) {
      setPortfolios([]);
      setSubscriptionStatus(null);
      return;
    }
    fetch("/api/portfolio-groups")
      .then((r) => r.ok ? r.json() : [])
      .then(setPortfolios)
      .catch(() => setPortfolios([]));

    fetch("/api/stripe/subscription")
      .then((r) => r.ok ? r.json() : { status: "free" })
      .then((d: { status?: string }) => setSubscriptionStatus((d.status ?? "free") as SubscriptionStatus))
      .catch(() => setSubscriptionStatus("free"));
  }, [user]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { setOpen(null); }, [pathname]);

  function groupActive(g: NavGroup) {
    if (g.href) return pathname === g.href;
    return g.items?.some((i) => pathname === i.href) ?? false;
  }

  const portfolioActive = pathname.startsWith("/portfolio-tracker");
  const portfolioOpen = open === "__portfolios";
  const isPro = subscriptionStatus === "active" || subscriptionStatus === "trialing";

  return (
    <nav ref={navRef} className="border-b border-gray-800 bg-gray-900 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-0.5 h-14">
        {/* Logo */}
        <Link href="/" className="text-brand-500 font-bold text-lg mr-8 shrink-0 hover:text-brand-400 transition-colors">
          DripData
        </Link>

        {/* Static nav groups */}
        {navGroups.map((group) => {
          const active = groupActive(group);
          const isOpen = open === group.label;

          if (group.href) {
            return (
              <Link
                key={group.label}
                href={group.href}
                className={`relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active ? "bg-brand-600 text-white shadow-sm" : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {group.label}
              </Link>
            );
          }

          return (
            <div key={group.label} className="relative">
              <button
                onClick={() => setOpen(isOpen ? null : group.label)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active || isOpen ? "text-white bg-gray-800" : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {group.label}
                <svg className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180 text-brand-400" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isOpen && (
                <div className={`absolute top-[calc(100%+8px)] left-0 rounded-2xl shadow-2xl overflow-hidden border divide-y
                  bg-white border-gray-200 divide-gray-100 dark:bg-gray-900 dark:border-gray-700/60 dark:divide-gray-800
                  ${group.items && group.items.length > 3 ? "w-72" : "w-64"}`}>
                  {group.items?.map((item) => {
                    const itemActive = pathname === item.href;
                    return (
                      <Link key={item.href} href={item.href}
                        className={`flex items-start gap-3.5 px-4 py-3.5 transition-colors group/item
                          ${itemActive ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800/70"}`}>
                        <span className={`mt-0.5 text-base w-8 h-8 flex items-center justify-center rounded-lg shrink-0 font-semibold
                          ${itemActive ? "bg-brand-600 text-white" : "bg-gray-100 dark:bg-gray-800 group-hover/item:bg-brand-600/10 dark:group-hover/item:bg-brand-900/40"}`}>
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold leading-tight transition-colors
                            ${itemActive ? "text-brand-600 dark:text-brand-400" : "text-gray-900 dark:text-gray-100 group-hover/item:text-brand-600 dark:group-hover/item:text-brand-400"}`}>
                            {item.label}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 leading-snug">{item.desc}</p>
                        </div>
                        <svg className={`w-3.5 h-3.5 mt-1.5 ml-auto shrink-0 transition-all opacity-0 group-hover/item:opacity-100 -translate-x-1 group-hover/item:translate-x-0
                          ${itemActive ? "text-brand-500 opacity-100 translate-x-0" : "text-gray-400"}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Portfolios dropdown ── */}
        <div className="relative">
          <button
            onClick={() => setOpen(portfolioOpen ? null : "__portfolios")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              portfolioActive || portfolioOpen ? "text-white bg-gray-800" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            Portfolios
            <svg className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${portfolioOpen ? "rotate-180 text-brand-400" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {portfolioOpen && (
            <div className="absolute top-[calc(100%+8px)] left-0 w-56 rounded-2xl shadow-2xl overflow-hidden border
              bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700/60">

              {portfolios.length > 0 ? (
                <div className="py-1.5">
                  {portfolios.map((p) => {
                    const href = `/portfolio-tracker/${p.id}`;
                    const isActive = pathname.startsWith(href);
                    return (
                      <Link
                        key={p.id}
                        href={href}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                          isActive
                            ? "text-brand-400 bg-brand-600/10 font-semibold"
                            : "text-gray-400 hover:text-white hover:bg-gray-800/40"
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-3 text-sm text-gray-500">No portfolios yet</div>
              )}

              <div className="border-t dark:border-gray-800 py-1.5">
                <Link
                  href="/portfolio-tracker"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
                >
                  <span className="text-brand-400 font-bold leading-none">+</span>
                  <span>Manage Portfolios</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Upgrade pill — shown when signed in but not Pro */}
        {user && !isPro && subscriptionStatus !== null && (
          <Link
            href="/pricing"
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600/15 hover:bg-brand-600/25 border border-brand-500/30 text-brand-400 hover:text-brand-300 text-xs font-semibold transition-all"
          >
            ⚡ Upgrade
          </Link>
        )}

        {/* Spacer + Theme + User */}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={toggle}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 dark:border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all text-sm font-medium"
          >
            {theme === "dark" ? (
              <><span className="text-yellow-300">☀</span><span className="hidden sm:inline">Light</span></>
            ) : (
              <><span>🌙</span><span className="hidden sm:inline">Dark</span></>
            )}
          </button>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setOpen(open === "__user" ? null : "__user")}
                className="w-8 h-8 rounded-full bg-brand-600 hover:bg-brand-500 flex items-center justify-center text-white text-sm font-semibold transition-colors"
                title={user.email ?? "Account"}
              >
                {user.email?.[0]?.toUpperCase() ?? "U"}
              </button>
              {open === "__user" && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <p className="text-xs text-gray-500">Signed in as</p>
                    <p className="text-sm text-white font-medium truncate">{user.email}</p>
                    {isPro && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-brand-400 bg-brand-600/15 border border-brand-500/30 px-2 py-0.5 rounded-full">
                        ⚡ Pro
                      </span>
                    )}
                  </div>
                  <Link href="/account" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
                    Account
                  </Link>
                  {isPro ? (
                    <Link href="/account" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
                      Manage Billing
                    </Link>
                  ) : (
                    <Link href="/pricing" className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-400 hover:text-brand-300 hover:bg-gray-800 transition-colors font-medium">
                      <span>⚡</span> Upgrade to Pro
                    </Link>
                  )}
                  <button onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors border-t border-gray-800">
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/sign-in" className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-all">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
