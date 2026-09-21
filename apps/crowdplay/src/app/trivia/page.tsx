// See src/app/host/page.tsx for why this needs to be a Server Component
// wrapper: `dynamic` from a "use client" file is silently ignored, and this
// route (no dynamic segment) would otherwise get statically prerendered at
// build time with no env vars available.
export const dynamic = "force-dynamic";

import TriviaLandingClient from "./TriviaLandingClient";

export default function TriviaLandingPage() {
  return <TriviaLandingClient />;
}
