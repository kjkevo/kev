import * as React from "react";
import Image from "next/image";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  /** Full name — first letter of each of the first two words becomes the initials */
  name?: string;
  /** Image URL. If provided and loads successfully, shows the image */
  src?: string;
  size?: AvatarSize;
  className?: string;
}

/* ─── Size map ───────────────────────────────────────────────────────────── */

const sizeClasses: Record<AvatarSize, string> = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-9 h-9 text-[11px]",
  lg: "w-11 h-11 text-[13px]",
};

const sizePx: Record<AvatarSize, number> = {
  sm: 28,
  md: 36,
  lg: 44,
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function getInitials(name?: string): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  const a = words[0]?.[0] ?? "";
  const b = words[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

/* ─── Avatar ─────────────────────────────────────────────────────────────── */

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ name, src, size = "md", className = "" }, ref) => {
    const [imgError, setImgError] = React.useState(false);
    const initials = getInitials(name);
    const showImage = Boolean(src) && !imgError;
    const px = sizePx[size];

    const base = [
      "relative inline-flex shrink-0 items-center justify-center",
      "rounded-full select-none overflow-hidden",
      sizeClasses[size],
      className,
    ].join(" ");

    return (
      <span ref={ref} className={base} aria-label={name ?? "Avatar"} role="img">
        {showImage ? (
          <Image
            src={src!}
            alt={name ?? ""}
            width={px}
            height={px}
            className="object-cover w-full h-full"
            onError={() => setImgError(true)}
          />
        ) : (
          /* Initials fallback */
          <span
            className={[
              "flex items-center justify-center w-full h-full rounded-full",
              "font-mono font-semibold tracking-wide uppercase",
              // teal-dim bg + teal text + subtle glow ring
              "bg-[rgba(0,229,196,0.12)] text-[#00E5C4]",
              "ring-1 ring-[rgba(0,229,196,0.25)]",
            ].join(" ")}
          >
            {initials}
          </span>
        )}
      </span>
    );
  },
);

Avatar.displayName = "Avatar";

/* ─── AvatarGroup — overlapping stack of avatars ────────────────────────── */

interface AvatarGroupProps {
  users: Array<{ name?: string; src?: string }>;
  size?: AvatarSize;
  max?: number;
  className?: string;
}

function AvatarGroup({ users, size = "md", max = 4, className = "" }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;

  const overflowSize: Record<AvatarSize, string> = {
    sm: "w-7 h-7 text-[10px]",
    md: "w-9 h-9 text-[11px]",
    lg: "w-11 h-11 text-[13px]",
  };

  return (
    <div className={["flex -space-x-2", className].join(" ")}>
      {visible.map((u, i) => (
        <Avatar
          key={i}
          name={u.name}
          src={u.src}
          size={size}
          className="ring-2 ring-[#080D1A]"
        />
      ))}

      {overflow > 0 && (
        <span
          className={[
            "inline-flex shrink-0 items-center justify-center rounded-full",
            "ring-2 ring-[#080D1A]",
            "bg-[#111D33] text-[#64748B]",
            "font-mono font-medium",
            overflowSize[size],
          ].join(" ")}
          aria-label={`${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

export { Avatar, AvatarGroup };
export type { AvatarProps, AvatarGroupProps, AvatarSize };
