// Server Component wrapper -- see src/app/host/page.tsx for why this is
// needed: `dynamic` is silently ignored when declared in a "use client"
// file, and this route (no dynamic segment) would otherwise get statically
// prerendered at build time with no env vars available.
export const dynamic = "force-dynamic";

import BingoScreenClient from "./BingoScreenClient";

export default function BingoScreenPage() {
  return <BingoScreenClient />;
}
