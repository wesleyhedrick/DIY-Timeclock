import { NextResponse } from "next/server";
import { requireEmployee } from "../../../../lib/security";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function POST(request) {
  const session=await requireEmployee();
  if(!session) return NextResponse.json({error:"Please sign in again."},{status:401});

  const { notes="" }=await request.json().catch(()=>({}));
  if(String(notes).length>500) return NextResponse.json({error:"Notes must be 500 characters or fewer."},{status:400});

  const { data, error }=await supabaseAdmin()
    .from("help_time_entries")
    .insert({
      employee_id:session.employeeId,
      notes:String(notes).trim() || null
    })
    .select("id,clock_in,notes")
    .single();

  if(error?.code==="23505") {
    return NextResponse.json({error:"You are already clocked into Help Time. Clock out before starting another session."},{status:409});
  }
  if(error) return NextResponse.json({error:"Unable to start Help Time."},{status:500});

  return NextResponse.json({entry:data},{status:201});
}
