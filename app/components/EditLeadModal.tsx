"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type DuplicateLead = {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
};

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
  aiScore?: number | null;
  aiScoreReason?: string | null;
  aiSuggestion?: string | null;
  dealValue?: number | null;
  source?: string | null;
  assignedTo?: string | null;
};

type Props = {
  lead: Lead;
  onClose: () => void;
  onSaved: (updated: Lead) => void;
};

const STATUS_OPTIONS = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];
const SOURCE_OPTIONS = ["cold_email", "referral", "paid_ad", "linkedin", "inbound", "event", "other"];
const SOURCE_LABELS: Record<string, string> = {
  cold_email: "Cold Email",
  referral: "Referral",
  paid_ad: "Paid Ad",
  linkedin: "LinkedIn",
  inbound: "Inbound",
  event: "Event",
  other: "Other",
};

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

type TeamMember = { userId: number; name: string | null; email: string; role: string };

export default function EditLeadModal({ lead, onClose, onSaved }: Props) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    // Try to load team members to populate the assignedTo dropdown
    fetch("/api/teams")
      .then((r) => r.ok ? r.json() : [])
      .then((teams: { id: number }[]) => {
        if (teams.length === 0) return;
        // Fetch members from the first team
        return fetch(`/api/teams/${teams[0].id}/members`)
          .then((r) => r.ok ? r.json() : []);
      })
      .then((members) => {
        if (members) setTeamMembers(members);
      })
      .catch(() => {});
  }, []);

  const [form, setForm] = useState({
    companyName: lead.companyName,
    website: lead.website ?? "",
    contactName: lead.contactName,
    title: lead.title,
    email: lead.email,
    phone: lead.phone ?? "",
    triggerEvent: lead.triggerEvent,
    intelligenceSummary: lead.intelligenceSummary,
    status: lead.status,
    notes: lead.notes ?? "",
    dealValue: lead.dealValue != null ? String(lead.dealValue) : "",
    source: lead.source ?? "",
    assignedTo: lead.assignedTo ?? "",
  });
  const [tags, setTags] = useState<string[]>(lead.tags);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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

  async function checkEmailDuplicate() {
    const email = form.email.trim();
    if (!email || email === lead.email) return;
    try {
      const res = await fetch(`/api/leads/duplicate-check?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setEmailDuplicate(data.duplicate ?? null);
    } catch { /* ignore */ }
  }

  async function checkCompanyDuplicate() {
    const company = form.companyName.trim();
    if (!company || company === lead.companyName) return;
    try {
      const res = await fetch(`/api/leads/duplicate-check?company=${encodeURIComponent(company)}`);
      const data = await res.json();
      setCompanyDuplicate(data.duplicate && data.duplicate.id !== lead.id ? data.duplicate : null);
    } catch { /* ignore */ }
  }

  async function handleSave() {
    if (!form.companyName || !form.contactName || !form.email) {
      setError("Company name, contact name, and email are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags,
          website: form.website || null,
          phone: form.phone || null,
          notes: form.notes || null,
          dealValue: form.dealValue !== "" ? parseFloat(form.dealValue) : null,
          source: form.source || null,
          assignedTo: form.assignedTo || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const updated = await res.json();
      onSaved({ ...updated, createdAt: lead.createdAt });
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-gray-900">Edit Lead</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none font-light"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="bg-rose-50 text-rose-700 text-sm px-4 py-2 rounded-xl border border-rose-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Company Name *</label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => { updateField("companyName", e.target.value); setCompanyDuplicate(null); }}
                onBlur={checkCompanyDuplicate}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Website</label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => updateField("website", e.target.value)}
                placeholder="https://example.com"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Name *</label>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) => updateField("contactName", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => { updateField("email", e.target.value); setEmailDuplicate(null); }}
                onBlur={checkEmailDuplicate}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
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
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => updateField("status", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Deal Value ($)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.dealValue}
                onChange={(e) => updateField("dealValue", e.target.value)}
                placeholder="e.g. 25000"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Source</label>
              <select
                value={form.source}
                onChange={(e) => updateField("source", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— Select source —</option>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Assigned To</label>
              {teamMembers.length > 0 ? (
                <select
                  value={form.assignedTo}
                  onChange={(e) => updateField("assignedTo", e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">— Unassigned —</option>
                  {teamMembers.map((m) => {
                    const label = m.name ? `${m.name} (${m.email})` : m.email;
                    const val = m.name ?? m.email;
                    return (
                      <option key={m.userId} value={val}>{label}</option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.assignedTo}
                  onChange={(e) => updateField("assignedTo", e.target.value)}
                  placeholder="Name or email"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Trigger Event</label>
            <input
              type="text"
              value={form.triggerEvent}
              onChange={(e) => updateField("triggerEvent", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Intelligence Summary</label>
            <textarea
              value={form.intelligenceSummary}
              onChange={(e) => updateField("intelligenceSummary", e.target.value)}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={3}
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
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-gray-400"
              />
              <button
                onClick={addTag}
                type="button"
                className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-200 font-medium"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
          <button
            onClick={onClose}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm bg-brand-600 text-white px-5 py-2 rounded-xl hover:bg-brand-700 font-medium disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
