import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: leads, error } = await supabase
    .from("Lead")
    .select("id, status, dealValue, wonAt, lostAt, lossReason");
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ 
    count: leads?.length,
    sample: leads?.map(l => ({ id: l.id, status: l.status, dealValue: l.dealValue, wonAt: l.wonAt }))
  });
}
