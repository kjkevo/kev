import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";

  let query = supabase.from("Lead").select("*").order("createdAt", { ascending: false });

  if (search) {
    query = query.or(
      `contactName.ilike.%${search}%,email.ilike.%${search}%,companyName.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("Lead")
    .insert({
      companyName: body.companyName,
      website: body.website ?? null,
      contactName: body.contactName,
      title: body.title,
      email: body.email,
      phone: body.phone ?? null,
      triggerEvent: body.triggerEvent,
      intelligenceSummary: body.intelligenceSummary,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
