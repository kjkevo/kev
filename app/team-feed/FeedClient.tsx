"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type FeedActivity = {
  id: number;
  type: string;
  content: string;
  date: string;
  createdAt: string;
  userName: string | null;
  leadId: number;
  leadCompanyName: string;
  userId: number | null;
};

const ACTIVITY_BADGE: Record<string, string> = {
  Call: "bg-blue-100 text-blue-700",
  Email: "bg-violet-100 text-violet-700",
  Meeting: "bg-emerald-100 text-emerald-700",
  Note: "bg-amber-100 text-amber-700",
};

const ACTIVITY_ICONS: Record<string, string> = {
  Call: "📞",
  Email: "✉️",
  Meeting: "🤝",
  Note: "📝",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function FeedClient({ initialActivities }: { initialActivities: FeedActivity[] }) {
  const [activities, setActivities] = useState<FeedActivity[]>(initialActivities);
  const [loading, setLoading] = useState(false);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/team-feed");
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    setLoading(false);
    const interval = setInterval(fetchFeed, 30000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Activity Feed</h1>
          <p className="text-sm text-gray-500 mt-1">All activity across your team&apos;s leads, newest first</p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchFeed().finally(() => setLoading(false)); }}
          disabled={loading}
          className="text-xs font-medium text-gray-500 hover:text-gray-900 border border-gray-200 bg-white px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <p className="text-2xl mb-3">📋</p>
          <p className="text-sm text-gray-500 font-medium">No activities logged yet.</p>
          <p className="text-xs text-gray-400 mt-1">Activities appear here as your team logs interactions with leads.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => (
            <div
              key={a.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex gap-4 items-start"
            >
              <span className="text-xl shrink-0 mt-0.5">{ACTIVITY_ICONS[a.type] ?? "📌"}</span>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTIVITY_BADGE[a.type] ?? "bg-gray-100 text-gray-600"}`}>
                    {a.type}
                  </span>
                  <Link
                    href={`/leads/${a.leadId}`}
                    className="text-sm font-semibold text-brand-600 hover:underline truncate max-w-[200px]"
                  >
                    {a.leadCompanyName}
                  </Link>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {a.content.length > 120 ? a.content.slice(0, 120) + "…" : a.content}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{a.userName ?? "Unknown"}</span>
                  <span>·</span>
                  <time>{relativeTime(a.date)}</time>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
