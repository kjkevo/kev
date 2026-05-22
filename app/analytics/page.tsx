import { supabase } from "@/app/lib/supabase";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { data: leads } = await supabase
    .from("Lead")
    .select("id, companyName, contactName, status, dealValue, source, wonAt, lostAt, lossReason, assignedTo, createdAt, aiScore");

  return <AnalyticsClient leads={leads ?? []} />;
}
