"use client";

import { useState } from "react";
import Link from "next/link";

type Lead = {
  id: number;
  companyName: string;
  website: string | null;
  contactName: string;
  title: string;
  email: string;
  phone: string | null;
  triggerEvent: string;
  intelligenceSummary: string;
  status: string;
  notes: string | null;
  tags: string[];
  createdAt: string;
  aiScore: number | null;
  aiScoreReason: string | null;
  aiSuggestion: string | null;
};

type DuplicateLead = {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
};

type Props = {
  onClose: () => void;
  onSaved: (lead: Lead) => void;
};

const STATUS_OPTIONS = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];

const TAG_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-pink-100 text-pink-700",
  "bg-indigo-100 text-indigo-700",
];

function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export default function AddLeadModal({ onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    companyName: "",
    website: "",
    contactName: "",
    title: "",
    email: "",
    phone: "",
    triggerEvent: "",
    intelligenceSummary: "",
    status: "new",
    notes: "",
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [enriched, setEnriched] = useState(false);
  const [emailDuplicate, setEmailDuplicate] = useState<DuplicateLead | null>(null);
  const [companyDuplicate, setCompanyDuplicate] = useState<DuplicateLead | null>(null);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addTag() {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) { setTagInput(""); return; }
    setTags([...tags, tag]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  // Duplicate check on email blur
  async function checkEmailDuplicate() {
    const email = form.email.trim();
    if (!email) return;
    try {
      const res = await fetch(`/api/leads/duplicate-check?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setEmailDuplicate(data.duplicate ?? null);
    } catch {
      // ignore
    }
  }

  // Duplicate check on company blur
  async function checkCompanyDuplicate() {
    const company = form.companyName.trim();
    if (!company) return;
    try {
      const res = await fetch(`/api/leads/duplicate-check?company=${encodeURIComponent(company)}`);
      const data = await res.json();
      setCompanyDuplicate(data.duplicate ?? null);
    } catch {
      // ignore
    }
  }

  // Enrich from email domain
  async function enrichFromEmail() {
    const email = form.email.trim();
    if (!email || !email.includes("@")) return;
    const domain = email.split("@")[1];
    setEnriching(true);
    try {
      const res = await fetch("/api/leads/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (!data.error) {
        setForm((prev) => ({
          ...prev,
          companyName: data.companyName || prev.companyName,
          website: data.website || prev.website,
          intelligenceSummary: data.industry
            ? `${data.industry}${data.size ? `, ${data.size} employees` : ""}`
            : prev.intelligenceSummary,
        }));
        setEnriched(true);
      }
    } catch {
      // ignore
    } finally {
      setEnriching(false);
    }
  }

  async function handleSave() {
    if (!form.companyName || !form.contactName || !form.email || !form.triggerEvent || !form.intelligenceSummary) {
      setError("Company name, contact name, email, trigger event, and intelligence summary are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags,
          website: form.website || null,
          phone: form.phone || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Save failed");
      }
      const created = await res.json();
      onSaved({
        ...created,
        tags: created.tags ?? [],
        aiScore: created.aiScore ?? null,
        aiScoreReason: created.aiScoreReason ?? null,
        aiSuggestion: created.aiSuggestion ?? null,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-none sm:rounded-2xl shadow-xl w-full sm:max-w-2xl min-h-screen sm:min-h-0 sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 rounded-t-none sm:rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add New Lead</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none font-light"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Company Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Company Name *</label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => { updateField("companyName", e.target.value); setCompanyDuplicate(null); }}
                onBlur={checkCompanyDuplicate}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {companyDuplicate && (
                <div className="mt-1.5 flex items-start gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-xl">
                  <span>⚠️</span>
                  <span>
                    A lead with this company already exists:{" "}
                    <Link href={`/leads/${companyDuplicate.id}`} className="font-semibold underline hover:no-underline" onClick={onClose}>
                      {companyDuplicate.contactName} at {companyDuplicate.companyName}
                    </Link>
                  </span>
                </div>
              )}
            </div>

            {/* Website */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Website
                {enriched && (
                  <span className="ml-2 text-xs font-normal text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                    ✨ Enriched via AI
                  </span>
                )}
              </label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => updateField("website", e.target.value)}
                placeholder="https://example.com"
                className="w-full text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Contact Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Name *</label>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) => updateField("contactName", e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Email + Enrich button */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => { updateField("email", e.target.value); setEmailDuplicate(null); setEnriched(false); }}
                  onBlur={checkEmailDuplicate}
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {form.email.includes("@") && (
                  <button
                    type="button"
                    onClick={enrichFromEmail}
                    disabled={enriching}
                    className="shrink-0 text-xs font-medium bg-violet-600 text-white px-3 py-2.5 rounded-xl hover:bg-violet-700 disabled:opacity-60 transition-colors"
                  >
                    {enriching ? "Enriching…" : "✨ Enrich"}
                  </button>
                )}
              </div>
              {emailDuplicate && (
                <div className="mt-1.5 flex items-start gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-xl">
                  <span>⚠️</span>
                  <span>
                    A lead with this email already exists:{" "}
                    <Link href={`/leads/${emailDuplicate.id}`} className="font-semibold underline hover:no-underline" onClick={onClose}>
                      {emailDuplicate.contactName} at {emailDuplicate.companyName}
                    </Link>
                  </span>
                </div>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Trigger Event */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Trigger Event *</label>
            <input
              type="text"
              value={form.triggerEvent}
              onChange={(e) => updateField("triggerEvent", e.target.value)}
              placeholder="e.g. Raised Series B, hiring 50 engineers…"
              className="w-full text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Intelligence Summary */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Intelligence Summary *</label>
            <textarea
              value={form.intelligenceSummary}
              onChange={(e) => updateField("intelligenceSummary", e.target.value)}
              rows={3}
              placeholder="Key context about this prospect…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={2}
              placeholder="Internal notes…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${tagColor(tag)}`}
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-0.5 hover:opacity-70">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag()}
                placeholder="Add tag…"
                className="flex-1 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <button
                onClick={addTag}
                type="button"
                className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 font-medium"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-900 rounded-b-none sm:rounded-b-2xl">
          <button
            onClick={onClose}
            className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm bg-brand-600 text-white px-5 py-2 rounded-xl hover:bg-brand-700 font-medium disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving…" : "Add Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}
