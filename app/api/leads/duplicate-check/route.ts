import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const company = searchParams.get("company");

  if (!email && !company) {
    return NextResponse.json({ error: "Provide email or company param" }, { status: 400 });
  }

  if (email) {
    const { data, error } = await supabase
      .from("Lead")
      .select("id, companyName, contactName, email")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data) return NextResponse.json({ duplicate: data });
    return NextResponse.json({ duplicate: null });
  }

  // company check — fuzzy match with ilike
  const { data, error } = await supabase
    .from("Lead")
    .select("id, companyName, contactName, email")
    .ilike("companyName", company!)
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data) return NextResponse.json({ duplicate: data });
  return NextResponse.json({ duplicate: null });
}
