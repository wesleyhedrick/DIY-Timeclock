import { NextResponse } from "next/server";
import { requireEmployee } from "../../../lib/security";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET() {
  const session=await requireEmployee();
  if(!session) return NextResponse.json({error:"Please sign in again."},{status:401});

  const {data,error}=await supabaseAdmin()
    .from("help_time_entries")
    .select("id,clock_in,clock_out,notes")
    .eq("employee_id",session.employeeId)
    .not("clock_out","is",null)
    .order("clock_in",{ascending:false})
    .limit(10);

  if(error) return NextResponse.json({error:"Unable to load history."},{status:500});
  return NextResponse.json({entries:data});
}
