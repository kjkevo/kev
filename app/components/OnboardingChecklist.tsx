"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type OnboardingStatus = {
  hasLeads: boolean;
  hasActivities: boolean;
  hasScoredLead: boolean;
  hasTeamMate: boolean;
  hasCustomStages: boolean;
};

const ITEMS = [
  { key: "hasLeads" as const, label: "Add your first lead", href: null, action: "openAddLeadModal" },
  { key: "hasActivities" as const, label: "Log your first activity", href: "/leads", action: null },
  { key: "hasScoredLead" as const, label: "Score a lead with AI", href: "/leads", action: null },
  { key: "hasTeamMate" as const, label: "Invite a teammate", href: "/team", action: null },
  { key: "hasCustomStages" as const, label: "Customise your pipeline", href: "/pipeline", action: null },
];

export default function OnboardingChecklist() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("onboarding_dismissed") === "1") {
      setDismissed(true);
      return;
    }
    fetch("/api/onboarding-status")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setStatus(data);
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    localStorage.setItem("onboarding_dismissed", "1");
    setDismissed(true);
  }

  if (dismissed || !status) return null;

  const completedCount = ITEMS.filter((item) => status[item.key]).length;

  // Auto-dismiss when all done
  if (completedCount === ITEMS.length) {
    localStorage.setItem("onboarding_dismissed", "1");
    return null;
  }

  function handleItemAction(item: typeof ITEMS[number]) {
    if (item.action === "openAddLeadModal") {
      window.dispatchEvent(new CustomEvent("shortcut-open-add-lead"));
    } else if (item.href) {
      router.push(item.href);
    }
  }

  return (
    <div className="mb-6 bg-gradient-to-r from-brand-50 to-blue-50 dark:from-brand-900/20 dark:to-blue-900/20 border border-brand-100 dark:border-brand-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">🚀 Get started with LeadIQ</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{completedCount}/5 completed</p>
        </div>
        <button
          onClick={dismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
        >
          Dismiss
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-4">
        <div
          className="bg-brand-600 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / ITEMS.length) * 100}%` }}
        />
      </div>

      {/* Items */}
      <div className="space-y-1">
        {ITEMS.map((item) => {
          const done = status[item.key];
          return (
            <div key={item.key} className="flex items-center gap-3 py-1.5">
              <span className={done ? "text-emerald-500" : "text-gray-300 dark:text-gray-600"}>
                {done ? "✓" : "○"}
              </span>
              <span
                className={`text-sm ${
                  done
                    ? "line-through text-gray-400 dark:text-gray-500"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {item.label}
              </span>
              {!done && (
                <button
                  onClick={() => handleItemAction(item)}
                  className="ml-auto text-xs text-brand-600 dark:text-brand-400 font-medium hover:underline shrink-0"
                >
                  Do it →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
