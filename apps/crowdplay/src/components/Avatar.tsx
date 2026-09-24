/* eslint-disable @next/next/no-img-element -- avatar art is small and comes from the database */

/** A round avatar: the uploaded image if there is one, else its emoji. */
export function Avatar({
  emoji,
  imageUrl,
  size = 28,
  className = "",
}: {
  emoji?: string | null;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.62) };
  if (imageUrl) {
    return <img src={imageUrl} alt="" style={style} className={`rounded-full object-cover shrink-0 ${className}`} />;
  }
  return (
    <span
      style={style}
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full bg-white/10 shrink-0 leading-none ${className}`}
    >
      {emoji ?? "🙂"}
    </span>
  );
}
