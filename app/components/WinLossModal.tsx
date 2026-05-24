"use client";

type LossReason = "price" | "timing" | "competitor" | "product_fit" | "no_budget" | "other";

type Props = {
  onSelect: (reason: LossReason) => void;
  onCancel: () => void;
};

const REASONS: { value: LossReason; label: string; color: string }[] = [
  { value: "price", label: "Price Too High", color: "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100" },
  { value: "timing", label: "Bad Timing", color: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" },
  { value: "competitor", label: "Competitor Won", color: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100" },
  { value: "product_fit", label: "Poor Product Fit", color: "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100" },
  { value: "no_budget", label: "No Budget", color: "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100" },
  { value: "other", label: "Other", color: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" },
];

export default function WinLossModal({ onSelect, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-700">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Why was this deal lost?</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select the primary reason to track your pipeline health.</p>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-3">
          {REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => onSelect(r.value)}
              className={`border rounded-xl px-4 py-3 text-sm font-semibold text-left transition-colors ${r.color}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
          <button
            onClick={onCancel}
            className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-4 py-2"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
