"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OPEN_COMMAND_PALETTE_EVENT } from "./CommandPalette";

const SHORTCUTS = [
  { keys: ["N"], description: "Add new lead" },
  { keys: ["K"], description: "Go to Kanban" },
  { keys: ["D"], description: "Go to Dashboard" },
  { keys: ["A"], description: "Go to Analytics" },
  { keys: ["T"], description: "Go to Team" },
  { keys: ["P"], description: "Go to Pipeline settings" },
  { keys: ["F", "/"], description: "Focus search" },
  { keys: ["?"], description: "Show this help" },
  { keys: ["Cmd", "K"], description: "Open command palette" },
  { keys: ["Esc"], description: "Close modal / dialog" },
];

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function isInputFocused() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K is handled by CommandPalette, skip here
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        setShowHelp(false);
        // Let modals handle their own Escape — don't preventDefault
        return;
      }

      if (isInputFocused()) return;

      switch (e.key) {
        case "?":
          e.preventDefault();
          setShowHelp((prev) => !prev);
          break;
        case "n":
        case "N":
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("shortcut-open-add-lead"));
          break;
        case "k":
        case "K":
          e.preventDefault();
          router.push("/kanban");
          break;
        case "d":
        case "D":
          e.preventDefault();
          router.push("/dashboard");
          break;
        case "a":
        case "A":
          e.preventDefault();
          router.push("/analytics");
          break;
        case "t":
        case "T":
          e.preventDefault();
          router.push("/team");
          break;
        case "p":
        case "P":
          e.preventDefault();
          router.push("/pipeline");
          break;
        case "f":
        case "F":
        case "/":
          e.preventDefault();
          // Focus search bar if present
          const searchEl = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
          searchEl?.focus();
          break;
      }
    }

    // Also open command palette via Cmd+K (shared with CommandPalette)
    function handleCmdK(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleCmdK);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keydown", handleCmdK);
    };
  }, [router]);

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4"
      onClick={() => setShowHelp(false)}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h2>
          <button
            onClick={() => setShowHelp(false)}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4 space-y-2">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
              <span className="text-sm text-gray-700 dark:text-gray-300">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, ki) => (
                  <span key={ki}>
                    <kbd className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-mono border border-gray-200 dark:border-gray-600">
                      {k}
                    </kbd>
                    {ki < s.keys.length - 1 && <span className="text-gray-400 text-xs mx-0.5">+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-xs text-gray-400 text-center">Press <kbd className="font-mono">?</kbd> or <kbd className="font-mono">Esc</kbd> to close</p>
        </div>
      </div>
    </div>
  );
}
