"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Activity = {
  id: number;
  type: string;
  content: string;
  date: string;
  createdAt: string;
};

type CustomFieldValue = {
  id: number;
  leadId: number;
  customFieldId: number;
  value: string;
  fieldName: string;
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
  updatedAt: string;
  activities: Activity[];
  customFieldValues: CustomFieldValue[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-700",
  contacted: "bg-blue-100 text-blue-700",
  qualified: "bg-cyan-100 text-cyan-700",
  proposal: "bg-amber-100 text-amber-700",
  negotiation: "bg-orange-100 text-orange-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-rose-100 text-rose-700",
};

const ACTIVITY_ICONS: Record<string, string> = {
  Call: "📞",
  Email: "✉️",
  Meeting: "🤝",
  Note: "📝",
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LeadDetailClient({ lead: initialLead }: { lead: Lead }) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead>(initialLead);
  const [notes, setNotes] = useState(initialLead.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Activity state
  const [activities, setActivities] = useState<Activity[]>(initialLead.activities);
  const [newActivityType, setNewActivityType] = useState("Note");
  const [newActivityContent, setNewActivityContent] = useState("");
  const [addingActivity, setAddingActivity] = useState(false);

  // Tags state
  const [tags, setTags] = useState<string[]>(initialLead.tags);
  const [tagInput, setTagInput] = useState("");

  // Status
  const [status, setStatus] = useState(initialLead.status);
  const [savingStatus, setSavingStatus] = useState(false);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // --------------------------------------------------------------------------
  // Save notes
  // --------------------------------------------------------------------------
  async function saveNotes() {
    setSavingNotes(true);
    await fetch(`/api/leads/${lead.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lead, notes, tags, status }),
    });
    setSavingNotes(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  // --------------------------------------------------------------------------
  // Save status
  // --------------------------------------------------------------------------
  async function saveStatus(newStatus: string) {
    setSavingStatus(true);
    setStatus(newStatus);
    await fetch(`/api/leads/${lead.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lead, notes, tags, status: newStatus }),
    });
    setSavingStatus(false);
  }

  // --------------------------------------------------------------------------
  // Tags
  // --------------------------------------------------------------------------
  async function addTag() {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) { setTagInput(""); return; }
    const newTags = [...tags, tag];
    setTags(newTags);
    setTagInput("");
    await fetch(`/api/leads/${lead.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lead, notes, tags: newTags, status }),
    });
  }

  async function removeTag(tag: string) {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    await fetch(`/api/leads/${lead.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lead, notes, tags: newTags, status }),
    });
  }

  // --------------------------------------------------------------------------
  // Activities
  // --------------------------------------------------------------------------
  async function addActivity() {
    if (!newActivityContent.trim()) return;
    setAddingActivity(true);
    const res = await fetch(`/api/leads/${lead.id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: newActivityType, content: newActivityContent }),
    });
    const activity = await res.json();
    setActivities([activity, ...activities]);
    setNewActivityContent("");
    setAddingActivity(false);
  }

  async function deleteActivity(activityId: number) {
    await fetch(`/api/leads/${lead.id}/activities?activityId=${activityId}`, {
      method: "DELETE",
    });
    setActivities(activities.filter((a) => a.id !== activityId));
  }

  // --------------------------------------------------------------------------
  // Delete lead
  // --------------------------------------------------------------------------
  async function deleteLead() {
    setDeleting(true);
    await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold text-brand-700 shrink-0">
            LeadIQ
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
            <Link href="/dashboard" className="hover:text-gray-900 transition-colors">Dashboard</Link>
            <Link href="/kanban" className="hover:text-gray-900 transition-colors">Kanban</Link>
            <Link href="/leads" className="hover:text-gray-900 transition-colors">All Leads</Link>
          </nav>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1.5"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Top row: identity + status */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{lead.companyName}</h1>
              <p className="text-gray-500 mt-1">{lead.contactName} · {lead.title}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-400">
                <a href={`mailto:${lead.email}`} className="hover:text-brand-600">{lead.email}</a>
                {lead.phone && <span>{lead.phone}</span>}
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600">
                    {lead.website}
                  </a>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">Added {formatDate(lead.createdAt)}</p>
            </div>

            <div className="flex flex-col items-end gap-3">
              {/* Status selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Status</span>
                <select
                  value={status}
                  onChange={(e) => saveStatus(e.target.value)}
                  disabled={savingStatus}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-brand-500 ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s} className="bg-white text-gray-900 capitalize">
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delete */}
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-rose-500 hover:text-rose-700 font-medium"
                >
                  Delete Lead
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Are you sure?</span>
                  <button
                    onClick={deleteLead}
                    disabled={deleting}
                    className="text-xs bg-rose-600 text-white px-2.5 py-1 rounded-lg hover:bg-rose-700 font-medium"
                  >
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: notes + tags + intel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Intelligence */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Intelligence</h2>
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <span className="shrink-0 mt-px text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full leading-none">
                    Trigger
                  </span>
                  <p className="text-sm text-gray-800 leading-relaxed">{lead.triggerEvent}</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="shrink-0 mt-px text-xs font-bold uppercase tracking-wider text-brand-600 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-full leading-none">
                    Intel
                  </span>
                  <p className="text-sm text-gray-500 leading-relaxed">{lead.intelligenceSummary}</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Notes</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this lead…"
                rows={5}
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none placeholder-gray-400"
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={saveNotes}
                  disabled={savingNotes}
                  className="text-sm bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 font-medium disabled:opacity-60 transition-colors"
                >
                  {savingNotes ? "Saving…" : "Save Notes"}
                </button>
                {notesSaved && <span className="text-xs text-emerald-600 font-medium">Saved!</span>}
              </div>
            </div>

            {/* Tags */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${tagColor(tag)}`}
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 hover:opacity-70 text-current"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {tags.length === 0 && (
                  <span className="text-xs text-gray-400">No tags yet</span>
                )}
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
                  className="text-sm bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 font-medium transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Custom fields */}
            {lead.customFieldValues.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Custom Fields</h2>
                <dl className="space-y-2">
                  {lead.customFieldValues.map((cfv) => (
                    <div key={cfv.id} className="flex gap-3">
                      <dt className="text-xs font-semibold text-gray-500 w-32 shrink-0">{cfv.fieldName}</dt>
                      <dd className="text-sm text-gray-800">{cfv.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          {/* Right column: activity log */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Log Activity</h2>
              <select
                value={newActivityType}
                onChange={(e) => setNewActivityType(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {["Call", "Email", "Meeting", "Note"].map((t) => (
                  <option key={t} value={t}>{ACTIVITY_ICONS[t]} {t}</option>
                ))}
              </select>
              <textarea
                value={newActivityContent}
                onChange={(e) => setNewActivityContent(e.target.value)}
                placeholder="What happened?"
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none placeholder-gray-400"
              />
              <button
                onClick={addActivity}
                disabled={addingActivity || !newActivityContent.trim()}
                className="w-full text-sm bg-brand-600 text-white py-2 rounded-xl hover:bg-brand-700 font-medium disabled:opacity-60 transition-colors"
              >
                {addingActivity ? "Logging…" : "Log Activity"}
              </button>
            </div>

            {/* Activity history */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                Activity History
              </h2>
              {activities.length === 0 ? (
                <p className="text-xs text-gray-400">No activities yet. Log your first interaction above.</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((a) => (
                    <div key={a.id} className="flex gap-3 items-start group">
                      <span className="text-base shrink-0 mt-0.5">{ACTIVITY_ICONS[a.type] ?? "📌"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-700">{a.type}</span>
                          <button
                            onClick={() => deleteActivity(a.id)}
                            className="opacity-0 group-hover:opacity-100 text-xs text-rose-400 hover:text-rose-600 transition-opacity shrink-0"
                          >
                            ×
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5 break-words">{a.content}</p>
                        <time className="text-xs text-gray-400">{formatDateTime(a.date)}</time>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
