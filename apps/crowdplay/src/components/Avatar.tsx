/* eslint-disable @next/next/no-img-element -- avatar art is small and comes from the database */

/**
 * An avatar. "round" is the small circle used in lists (the character's
 * face icon); "full" shows the whole character (picker, unlock screen).
 */
export function Avatar({
  emoji,
  imageUrl,
  size = 28,
  variant = "round",
  className = "",
}: {
  emoji?: string | null;
  imageUrl?: string | null;
  size?: number;
  variant?: "round" | "full";
  className?: string;
}) {
  if (imageUrl && variant === "full") {
    return (
      <img
        src={imageUrl}
        alt=""
        style={{ width: size, height: size }}
        className={`object-contain shrink-0 drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)] ${className}`}
      />
    );
  }
  if (imageUrl) {
    // Each character has a hand-framed face icon next to its full art
    // (name-256.png → name-icon.png) so small circles show the face.
    const icon = imageUrl.endsWith("-256.png") ? imageUrl.replace(/-256\.png$/, "-icon.png") : imageUrl;
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={`inline-block rounded-full overflow-hidden bg-white/10 ring-1 ring-white/20 shrink-0 ${className}`}
      >
        <img src={icon} alt="" className="w-full h-full object-cover" />
      </span>
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.62) }}
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full bg-white/10 shrink-0 leading-none ${className}`}
    >
      {emoji ?? "🙂"}
    </span>
  );
}
