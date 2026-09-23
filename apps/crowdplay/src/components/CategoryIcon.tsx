// A small set of hand-drawn line icons, one per trivia category slug
// (stored on question_packs.icon). Deliberately not emoji -- emoji glyphs
// render differently (or not at all) across devices/fonts, so categories
// get a real vector symbol that looks identical everywhere instead.
const PATHS: Record<string, React.ReactNode> = {
  beer: (
    <>
      <path d="M6 7h9a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7Z" />
      <path d="M16 9h1.5A2.5 2.5 0 0 1 20 11.5v3A2.5 2.5 0 0 1 17.5 17H16" />
      <path d="M8.5 7c0-1.5.8-2 .8-3.2S8.5 2 8.5 2" />
      <path d="M11.5 7c0-1.5.8-2 .8-3.2S11.5 2 11.5 2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  burger: (
    <>
      <path d="M4 9a8 5 0 0 1 16 0" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <path d="M3 15h18a1 1 0 0 1 0 3H3a1 1 0 0 1 0-3Z" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="7" y1="4" x2="7" y2="20" />
      <line x1="17" y1="4" x2="17" y2="20" />
      <line x1="3" y1="9" x2="7" y2="9" />
      <line x1="3" y1="15" x2="7" y2="15" />
      <line x1="17" y1="9" x2="21" y2="9" />
      <line x1="17" y1="15" x2="21" y2="15" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3c3 3 3 15 0 18" />
      <path d="M12 3c-3 3-3 15 0 18" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5a2 2 0 0 0 0 4h1" />
      <path d="M16 5h3a2 2 0 0 1 0 4h-1" />
      <line x1="12" y1="13" x2="12" y2="17" />
      <path d="M9 17h6l1 4H8l1-4Z" />
    </>
  ),
};

const FALLBACK = (
  <>
    <path d="M4 4h8l8 8-8 8-8-8V4Z" />
    <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
  </>
);

export function CategoryIcon({ slug, className }: { slug: string | null | undefined; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {(slug && PATHS[slug]) ?? FALLBACK}
    </svg>
  );
}
