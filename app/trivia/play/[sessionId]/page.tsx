import { PlayClient } from "./PlayClient";

export const dynamic = "force-dynamic";

// Screen 2 — Mobile gameplay. All live state comes from Supabase Realtime on the
// client, so this is just a thin shell around the client component.
export default function PlayPage({
  params,
}: {
  params: { sessionId: string };
}) {
  return <PlayClient sessionId={params.sessionId} />;
}
