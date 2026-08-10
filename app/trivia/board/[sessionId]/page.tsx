import { BoardClient } from "./BoardClient";

export const dynamic = "force-dynamic";

// Screen 3 — Wall-mounted leaderboard. Big, glanceable, realtime.
export default function BoardPage({
  params,
}: {
  params: { sessionId: string };
}) {
  return <BoardClient sessionId={params.sessionId} />;
}
