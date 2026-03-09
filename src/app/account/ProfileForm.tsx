"use client";
import { useState } from "react";

export default function ProfileForm({
  userId,
  initial,
}: {
  userId: string;
  initial: { display_name: string | null };
}) {
  const [displayName, setDisplayName] = useState(initial.display_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName }),
    });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      const { error } = await res.json();
      setError(error ?? "Failed to save");
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-3">
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Noah"
          maxLength={50}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
        />
        <p className="text-xs text-gray-500 mt-1">Shown on your account page</p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="self-start bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save Profile"}
      </button>
    </form>
  );
}
