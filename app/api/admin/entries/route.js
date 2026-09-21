import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/security";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(request) {
  if(!await requireAdmin()) return NextResponse.json({error:"Admin sign-in required."},{status:401});

  const {searchParams}=new URL(request.url);
  const from=searchParams.get("from");
  const to=searchParams.get("to");

  let q=supabaseAdmin()
    .from("help_time_entries")
    .select("id,clock_in,clock_out,notes,employees!inner(display_name)")
    .not("clock_out","is",null)
    .order("clock_in",{ascending:true})
    .limit(10000);

  if(from) q=q.gte("clock_in",from);
  if(to) q=q.lte("clock_in",to);

  const {data,error}=await q;
  if(error) return NextResponse.json({error:"Unable to load payroll activity."},{status:500});
  return NextResponse.json({entries:data});
}
