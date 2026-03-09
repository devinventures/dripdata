"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PortfolioGroup {
  id: string;
  name: string;
  created_at: string;
}

export default function PortfolioListPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<PortfolioGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/portfolio-groups");
    if (res.ok) setGroups(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createGroup() {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/portfolio-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      const group = await res.json();
      router.push(`/portfolio-tracker/${group.id}`);
    }
    setCreating(false);
  }

  async function deleteGroup(id: string, e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm("Delete this portfolio and all its holdings?")) return;
    setDeletingId(id);
    await fetch(`/api/portfolio-groups/${id}`, { method: "DELETE" });
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setDeletingId(null);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-gray-500">
        <div className="inline-block w-5 h-5 border-2 border-gray-700 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Portfolios</h1>
          <p className="text-gray-400 text-sm mt-1">Track dividend income across separate portfolios</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          + New Portfolio
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-6">
          <p className="text-sm font-medium text-gray-300 mb-3">Portfolio name</p>
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createGroup()}
              placeholder="e.g. Growth Portfolio"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 text-sm"
            />
            <button
              onClick={createGroup}
              disabled={creating || !newName.trim()}
              className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              onClick={() => { setShowForm(false); setNewName(""); }}
              className="px-4 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-gray-200 font-semibold text-lg mb-2">No portfolios yet</p>
          <p className="text-gray-500 text-sm mb-6">Create a portfolio to start tracking your dividend income.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Create Your First Portfolio
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/portfolio-tracker/${g.id}`}
              className="group bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 transition-all hover:shadow-lg hover:shadow-black/20 relative"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center text-xl mb-3">
                  📊
                </div>
                <button
                  onClick={(e) => deleteGroup(g.id, e)}
                  disabled={deletingId === g.id}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-all text-xs"
                  title="Delete portfolio"
                >
                  {deletingId === g.id ? "…" : "✕"}
                </button>
              </div>
              <p className="font-semibold text-white text-lg leading-tight">{g.name}</p>
              <p className="text-gray-500 text-xs mt-1">
                Created {new Date(g.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
              <div className="mt-4 flex gap-2">
                {["Holdings", "Income", "Performance"].map((tab) => (
                  <span key={tab} className="text-xs text-gray-600 bg-gray-800 rounded-md px-2 py-1">
                    {tab}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
