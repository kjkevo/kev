import { POWERS_LIVE, powerFor } from "@/lib/powers";

/** A character's power-up and how it works, shown under the character. */
export function PowerCard({ avatarId, className = "" }: { avatarId: string; className?: string }) {
  const power = powerFor(avatarId);
  if (!power) return null;
  return (
    <div className={`w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-left ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">{power.icon}</span>
        <span className="text-sm font-black text-amber-300">{power.name}</span>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-white/50">
          {POWERS_LIVE ? "Once per game" : "Coming soon"}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-white/80">{power.how}</p>
    </div>
  );
}
