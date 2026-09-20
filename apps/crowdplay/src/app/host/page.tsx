// Server Component wrapper: `dynamic` is only honored here, not in a
// "use client" file (Next.js silently ignores it there). This route has no
// dynamic segment, so without this it gets statically prerendered at build
// time, which runs the client's Supabase-touching code with no env vars
// available and crashes the build.
export const dynamic = "force-dynamic";

import HostSetupClient from "./HostSetupClient";

export default function HostSetupPage() {
  return <HostSetupClient />;
}
