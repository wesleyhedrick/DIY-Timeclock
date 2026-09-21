import { NextResponse } from "next/server";
import { getSession } from "../../../lib/security";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET() {
  const session=await getSession();
  if(!session) return NextResponse.json({error:"Not signed in."},{status:401});

  if(session.role==="employee") {
    const { data:active, error }=await supabaseAdmin()
      .from("help_time_entries")
      .select("id,clock_in,notes")
      .eq("employee_id",session.employeeId)
      .is("clock_out",null)
      .maybeSingle();

    if(error) return NextResponse.json({error:"Unable to load status."},{status:500});
    return NextResponse.json({
      session:{role:"employee",employeeId:session.employeeId,employeeName:session.employeeName},
      active
    });
  }

  return NextResponse.json({session:{role:"admin"},active:null});
}
