"use client";

import { useState, useCallback } from "react";

type AuditEntry = {
  id: number;
  createdAt: string;
  userId: number | null;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  meta: Record<string, unknown> | null;
};

type Props = {
  initialLogs: AuditEntry[];
  initialTotal: number;
  isAdmin: boolean;
};

const ACTION_CATEGORIES: Record<string, { color: string; label: string }> = {
  "lead.created": { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", label: "Lead Created" },
  "lead.updated": { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", label: "Lead Updated" },
  "lead.deleted": { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", label: "Lead Deleted" },
  "lead.status_changed": { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", label: "Status Changed" },
  "activity.logged": { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", label: "Activity Logged" },
  "team.member_added": { color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", label: "Member Added" },
  "team.member_removed": { color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", label: "Member Removed" },
  "2fa.enabled": { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", label: "2FA Enabled" },
  "2fa.disabled": { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", label: "2FA Disabled" },
  "data.exported": { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", label: "Data Exported" },
};

const ALL_ACTIONS = Object.keys(ACTION_CATEGORIES);

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CATEGORIES[action] ?? { color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400", label: action };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AuditLogClient({ initialLogs, initialTotal, isAdmin }: Props) {
  const [logs, setLogs] = useState<AuditEntry[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const LIMIT = 50;

  const fetchLogs = useCallback(async (newPage: number, action: string, email: string, reset = false) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(newPage), limit: String(LIMIT) });
    if (action) params.set("action", action);
    if (email) params.set("email", email);

    const res = await fetch(`/api/audit-log?${params}`);
    const data = await res.json();

    if (reset) {
      setLogs(data.logs ?? []);
    } else {
      setLogs((prev) => [...prev, ...(data.logs ?? [])]);
    }
    setTotal(data.total ?? 0);
    setPage(newPage);
    setLoading(false);
  }, []);

  function handleFilterChange(action: string, email: string) {
    setFilterAction(action);
    setFilterEmail(email);
    fetchLogs(1, action, email, true);
  }

  function handleLoadMore() {
    fetchLogs(page + 1, filterAction, filterEmail, false);
  }

  function exportCSV() {
    const headers = ["ID", "Timestamp", "User Email", "Action", "Entity Type", "Entity ID", "Meta"];
    const rows = logs.map((l) => [
      l.id,
      l.createdAt,
      l.userEmail ?? "",
      l.action,
      l.entityType ?? "",
      l.entityId ?? "",
      l.meta ? JSON.stringify(l.meta) : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map(String).map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Action</label>
          <select
            value={filterAction}
            onChange={(e) => handleFilterChange(e.target.value, filterEmail)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All actions</option>
            {ALL_ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_CATEGORIES[a].label}</option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
            <input
              type="text"
              value={filterEmail}
              onChange={(e) => handleFilterChange(filterAction, e.target.value)}
              placeholder="Search by email"
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}
        <div className="ml-auto">
          <button
            onClick={exportCSV}
            className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Timestamp</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">User</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Action</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Entity</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No audit log entries found.</td>
              </tr>
            )}
            {logs.map((entry) => (
              <tr key={entry.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {formatDate(entry.createdAt)}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[160px] truncate">
                  {entry.userEmail ?? <span className="text-gray-400">System</span>}
                </td>
                <td className="px-4 py-3">
                  <ActionBadge action={entry.action} />
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {entry.entityType ? (
                    <span>{entry.entityType}{entry.entityId ? ` #${entry.entityId}` : ""}</span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                  {entry.meta ? (
                    <span className="font-mono text-xs">{JSON.stringify(entry.meta)}</span>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>Showing {logs.length} of {total} entries</span>
        {logs.length < total && (
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}
