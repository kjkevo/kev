"use client";

import { useState } from "react";
import Link from "next/link";

type Stage = {
  id?: number;
  key: string;
  label: string;
  color: string;
  position: number;
  isDefault: boolean;
};

const COLOR_OPTIONS = ["gray", "blue", "cyan", "amber", "orange", "emerald", "rose"];

const COLOR_DOT: Record<string, string> = {
  gray: "bg-gray-400",
  blue: "bg-blue-400",
  cyan: "bg-cyan-400",
  amber: "bg-amber-400",
  orange: "bg-orange-400",
  emerald: "bg-emerald-400",
  rose: "bg-rose-400",
};

const COLOR_SWATCH: Record<string, string> = {
  gray: "bg-gray-400 hover:bg-gray-500",
  blue: "bg-blue-400 hover:bg-blue-500",
  cyan: "bg-cyan-400 hover:bg-cyan-500",
  amber: "bg-amber-400 hover:bg-amber-500",
  orange: "bg-orange-400 hover:bg-orange-500",
  emerald: "bg-emerald-400 hover:bg-emerald-500",
  rose: "bg-rose-400 hover:bg-rose-500",
};

export default function PipelineClient({ stages: initialStages }: { stages: Stage[] }) {
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("blue");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const isCustom = stages.some((s) => !s.isDefault);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }

  function startEdit(stage: Stage) {
    setEditingId(stage.key);
    setEditLabel(stage.label);
  }

  async function saveLabel(stage: Stage) {
    if (!editLabel.trim() || editLabel === stage.label) {
      setEditingId(null);
      return;
    }
    if (!stage.id) { setEditingId(null); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/pipeline-stages/${stage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editLabel.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to save");
        return;
      }
      setStages((prev) =>
        prev.map((s) => (s.key === stage.key ? { ...s, label: editLabel.trim() } : s))
      );
      showSuccess("Stage label updated.");
    } finally {
      setSaving(false);
      setEditingId(null);
    }
  }

  async function deleteStage(stage: Stage) {
    if (!stage.id) return;
    setDeletingKey(stage.key);
    setError("");
    try {
      const res = await fetch(`/api/pipeline-stages/${stage.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to delete");
        return;
      }
      setStages((prev) => prev.filter((s) => s.key !== stage.key));
      showSuccess("Stage deleted.");
    } finally {
      setDeletingKey(null);
    }
  }

  async function moveStage(index: number, dir: -1 | 1) {
    const newStages = [...stages];
    const targetIndex = index + dir;
    if (targetIndex < 0 || targetIndex >= newStages.length) return;
    [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
    // Update positions
    const updated = newStages.map((s, i) => ({ ...s, position: i }));
    setStages(updated);

    // Save all positions
    await Promise.all(
      updated
        .filter((s) => s.id)
        .map((s) =>
          fetch(`/api/pipeline-stages/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position: s.position }),
          })
        )
    );
    showSuccess("Order saved.");
  }

  async function addStage() {
    if (!newLabel.trim()) {
      setAddError("Label is required.");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const key = newLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      const position = stages.length;
      const res = await fetch("/api/pipeline-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, label: newLabel.trim(), color: newColor, position }),
      });
      if (!res.ok) {
        const d = await res.json();
        setAddError(d.error ?? "Failed to add stage");
        return;
      }
      const created: Stage = await res.json();
      setStages((prev) => [...prev, created]);
      setNewLabel("");
      setNewColor("blue");
      setShowAddForm(false);
      showSuccess("Stage added.");
    } finally {
      setAdding(false);
    }
  }

  async function resetToDefaults() {
    if (!confirm("Reset to default stages? All custom stages will be deleted.")) return;
    await fetch("/api/pipeline-stages", { method: "DELETE" });
    const res = await fetch("/api/pipeline-stages");
    const data = await res.json();
    setStages(data);
    showSuccess("Reset to defaults.");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold text-brand-700 shrink-0">LeadIQ</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500 dark:text-gray-400">
            <Link href="/dashboard" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Dashboard</Link>
            <Link href="/kanban" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Kanban</Link>
            <Link href="/pipeline" className="text-brand-600 font-semibold">Pipeline</Link>
          </nav>
          <Link href="/dashboard" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pipeline Stages</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Customise the stages in your sales pipeline
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isCustom && (
              <button
                onClick={resetToDefaults}
                className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-rose-600 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl transition-colors"
              >
                Reset to defaults
              </button>
            )}
            <button
              onClick={() => setShowAddForm(true)}
              className="text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 px-3 py-1.5 rounded-xl transition-colors"
            >
              + Add stage
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-800">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
            {successMsg}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          {stages.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 px-6 py-10 text-center">No stages yet.</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {stages.map((stage, index) => (
                <div key={stage.key} className="px-5 py-4 flex items-center gap-4">
                  {/* Color dot */}
                  <span className={`w-3 h-3 rounded-full shrink-0 ${COLOR_DOT[stage.color] ?? "bg-gray-400"}`} />

                  {/* Label (editable) */}
                  <div className="flex-1 min-w-0">
                    {editingId === stage.key ? (
                      <input
                        autoFocus
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onBlur={() => saveLabel(stage)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveLabel(stage);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="text-sm border border-brand-300 dark:border-brand-600 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-full max-w-[200px]"
                        disabled={saving}
                      />
                    ) : (
                      <button
                        onClick={() => stage.id && startEdit(stage)}
                        className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-400 text-left"
                        title={stage.id ? "Click to edit label" : "Default stage (read-only)"}
                      >
                        {stage.label}
                      </button>
                    )}
                  </div>

                  {/* Key chip */}
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono shrink-0">
                    {stage.key}
                  </span>

                  {/* Default badge */}
                  {stage.isDefault && !stage.id && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">default</span>
                  )}

                  {/* Reorder buttons */}
                  {stage.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => moveStage(index, -1)}
                        disabled={index === 0}
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30 p-1 rounded"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveStage(index, 1)}
                        disabled={index === stages.length - 1}
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30 p-1 rounded"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => deleteStage(stage)}
                        disabled={deletingKey === stage.key}
                        className="text-rose-400 hover:text-rose-600 disabled:opacity-50 p-1 rounded ml-1"
                        title="Delete stage"
                      >
                        {deletingKey === stage.key ? "…" : "×"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add stage form */}
        {showAddForm && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">New Stage</h3>
            {addError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{addError}</p>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Label</label>
              <input
                autoFocus
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addStage()}
                placeholder="e.g. Discovery"
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Color</label>
              <div className="flex items-center gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`w-6 h-6 rounded-full transition-all ${COLOR_SWATCH[c]} ${
                      newColor === c ? "ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 scale-110" : ""
                    }`}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={addStage}
                disabled={adding}
                className="text-sm bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 font-medium disabled:opacity-60 transition-colors"
              >
                {adding ? "Adding…" : "Add Stage"}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddError(""); setNewLabel(""); }}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="h-8" />
      </main>
    </div>
  );
}
