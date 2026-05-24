export const dynamic = "force-dynamic";

import PipelineClient from "./PipelineClient";

async function getStages() {
  try {
    const res = await fetch(`${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/pipeline-stages`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function PipelinePage() {
  const stages = await getStages();
  return <PipelineClient stages={stages} />;
}
