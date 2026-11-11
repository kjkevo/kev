import { POWERS_LIVE, powerFor } from "@/lib/powers";

/** A character's power-up and how it works, shown under the character. */
export function PowerCard({ avatarId, className = "" }: { avatarId: string; className?: string }) {
  const power = powerFor(avatarId);
  if (!power) return null;
  return (
    <div className={`w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-left ${className}`}>
      <div className="flex items-center gap-2">
        
        <span className="text-lg font-black text-amber-300">{power.name}</span>
        {!POWERS_LIVE && <span className="ml-auto text-xs font-bold text-white/60">Coming soon</span>}
      </div>
      <p className="mt-0.5 text-base text-white">{power.how}</p>
    </div>
  );
}
