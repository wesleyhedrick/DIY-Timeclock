import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { hashPin, safeEqualText, setSession } from "../../../../lib/security";
import { rateLimit } from "../../../../lib/rateLimit";

export async function POST(request) {
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const gate=rateLimit(`employee-login:${ip}`, 10, 60_000);
  if(!gate.allowed) return NextResponse.json({error:"Too many attempts. Try again in about a minute."},{status:429});

  const { employeeId, pin } = await request.json().catch(()=>({}));
  if(!employeeId || !/^\d{4,12}$/.test(String(pin||""))) {
    return NextResponse.json({error:"Select your name and enter your PIN."},{status:400});
  }

  const { data:employee, error } = await supabaseAdmin()
    .from("employees")
    .select("id,display_name,pin_hash,active")
    .eq("id", employeeId)
    .maybeSingle();

  if(error || !employee || !employee.active || !safeEqualText(hashPin(String(pin)), employee.pin_hash)) {
    return NextResponse.json({error:"Incorrect employee or PIN."},{status:401});
  }

  await setSession({role:"employee",employeeId:employee.id,employeeName:employee.display_name},12);
  return NextResponse.json({ok:true});
}
