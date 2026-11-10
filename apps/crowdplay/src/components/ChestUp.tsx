/* eslint-disable @next/next/no-img-element -- small static character art */

/** A character from the chest up (head and shoulders), with a name under it. */
export function ChestUp({
  imageUrl,
  emoji,
  name,
  width = 64,
  highlight = false,
}: {
  imageUrl: string | null;
  emoji?: string | null;
  name: string;
  width?: number;
  highlight?: boolean;
}) {
  const height = Math.round(width * 0.9);
  return (
    <div className="flex flex-col items-center gap-1 min-w-0" style={{ width }}>
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-white/15 to-white/[0.03] ${
          highlight ? "ring-2 ring-amber-400" : "ring-1 ring-white/15"
        }`}
        style={{ width, height }}
      >
        {imageUrl ? (
          // The full-body art scaled up and pinned to the top, so the frame shows head to chest.
          <img
            src={imageUrl}
            alt=""
            className="absolute left-1/2 top-[2%] max-w-none -translate-x-1/2"
            style={{ width: width * 2.3 }}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center" style={{ fontSize: width * 0.55 }}>
            {emoji ?? "🙂"}
          </span>
        )}
      </div>
      <span
        className={`w-full line-clamp-2 break-words text-center font-bold leading-tight ${width >= 90 ? "text-base" : "text-[11px]"} ${highlight ? "text-amber-300" : ""}`}
      >
        {name}
      </span>
    </div>
  );
}
