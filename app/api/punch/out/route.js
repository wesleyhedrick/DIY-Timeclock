import { NextResponse } from "next/server";
import { requireEmployee } from "../../../../lib/security";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function POST() {
  const session=await requireEmployee();
  if(!session) return NextResponse.json({error:"Please sign in again."},{status:401});

  const db=supabaseAdmin();
  const { data:open,error:findError }=await db
    .from("help_time_entries")
    .select("id,clock_in")
    .eq("employee_id",session.employeeId)
    .is("clock_out",null)
    .maybeSingle();

  if(findError) return NextResponse.json({error:"Unable to check current status."},{status:500});
  if(!open) return NextResponse.json({error:"You are not currently clocked into Help Time."},{status:409});

  const now=new Date().toISOString();
  const { data,error }=await db
    .from("help_time_entries")
    .update({clock_out:now})
    .eq("id",open.id)
    .is("clock_out",null)
    .select("id,clock_in,clock_out,notes")
    .maybeSingle();

  if(error) return NextResponse.json({error:"Unable to stop Help Time."},{status:500});
  if(!data) return NextResponse.json({error:"This Help Time session was already stopped."},{status:409});
  if(new Date(data.clock_out)<=new Date(data.clock_in)) {
    return NextResponse.json({error:"Invalid time record detected. Contact a supervisor."},{status:409});
  }

  return NextResponse.json({entry:data});
}
