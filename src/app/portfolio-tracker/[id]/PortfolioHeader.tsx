"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function PortfolioHeader({
  portfolioId,
  initialName,
}: {
  portfolioId: string;
  initialName: string;
}) {
  const pathname = usePathname();
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);

  async function saveName() {
    if (!draft.trim() || draft.trim() === name) { setEditing(false); return; }
    setSaving(true);
    await fetch(`/api/portfolio-groups/${portfolioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.trim() }),
    });
    setName(draft.trim());
    setSaving(false);
    setEditing(false);
  }

  const tabs = [
    { label: "Holdings",    href: `/portfolio-tracker/${portfolioId}` },
    { label: "Income",      href: `/portfolio-tracker/${portfolioId}/income` },
    { label: "Performance", href: `/portfolio-tracker/${portfolioId}/performance` },
    { label: "Insights",    href: `/portfolio-tracker/${portfolioId}/insights` },
  ];

  return (
    <div className="mb-6">
      {/* Back link */}
      <Link
        href="/portfolio-tracker"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 mb-4 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All Portfolios
      </Link>

      {/* Portfolio name (editable) */}
      <div className="flex items-center gap-3 mb-5">
        {editing ? (
          <form
            onSubmit={(e) => { e.preventDefault(); saveName(); }}
            className="flex items-center gap-2 w-full"
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveName}
              className="text-2xl font-bold bg-transparent border-b-2 border-brand-500 outline-none text-white flex-1 py-0.5"
            />
            <button
              type="submit"
              disabled={saving}
              className="text-sm text-brand-400 hover:text-brand-300 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setDraft(name); setEditing(false); }}
              className="text-sm text-gray-500 hover:text-gray-300"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => { setDraft(name); setEditing(true); }}
            className="text-2xl font-bold text-white hover:text-brand-400 transition-colors text-left group flex items-center gap-2"
            title="Click to rename"
          >
            {name}
            <svg
              className="w-4 h-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-brand-500 text-white"
                  : "border-transparent text-gray-400 hover:text-white hover:border-gray-600"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
