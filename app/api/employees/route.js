import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("employees")
    .select("id,display_name")
    .eq("active", true)
    .order("display_name");

  if (error) {
  console.error("Supabase employees query failed:", error);
  return NextResponse.json(
    { error: "Unable to load employees." },
    { status: 500 }
  );

  }
  }