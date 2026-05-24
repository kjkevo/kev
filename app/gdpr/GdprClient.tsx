"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function GdprClient() {
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE MY ACCOUNT") {
      setDeleteError('Please type "DELETE MY ACCOUNT" exactly to confirm.');
      return;
    }

    setDeleteError("");
    setDeleteLoading(true);

    try {
      const res = await fetch("/api/export/delete-my-data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE MY ACCOUNT" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error ?? "Failed to delete account");
        setDeleteLoading(false);
        return;
      }

      // Sign out and redirect
      await signOut({ callbackUrl: "/" });
    } catch {
      setDeleteError("Something went wrong. Please try again.");
      setDeleteLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Section 1: Download your data */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Download Your Data</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Download a full export of all your LeadIQ data in JSON or CSV format.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/export/my-data"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download JSON export
          </a>
          <a
            href="/api/leads/export"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download leads CSV
          </a>
        </div>
      </div>

      {/* Section 2: Delete account */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Delete Your Account</h2>
        <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">
            Warning: This is permanent and cannot be undone.
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            All your data — including leads, activities, notifications, and account information — will be permanently deleted.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type <span className="font-mono font-bold">DELETE MY ACCOUNT</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {deleteError && (
            <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>
          )}

          <button
            onClick={handleDeleteAccount}
            disabled={deleteLoading || deleteConfirm !== "DELETE MY ACCOUNT"}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {deleteLoading ? "Deleting..." : "Delete my account and all data"}
          </button>
        </div>
      </div>

      {/* Section 3: Contact */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Contact Us</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          For privacy inquiries or to exercise any of your data rights, contact us at:
        </p>
        <a
          href="mailto:privacy@leadiq.com"
          className="text-brand-600 dark:text-brand-400 font-medium hover:underline"
        >
          privacy@leadiq.com
        </a>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          We respond to all GDPR requests within 30 days.
        </p>
      </div>
    </div>
  );
}
