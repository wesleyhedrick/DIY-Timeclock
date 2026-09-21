import { NextResponse } from "next/server";
import { safeEqualText, setSession } from "../../../../lib/security";
import { rateLimit } from "../../../../lib/rateLimit";

export async function POST(request) {
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const gate=rateLimit(`admin-login:${ip}`, 6, 60_000);
  if(!gate.allowed) return NextResponse.json({error:"Too many attempts. Try again in about a minute."},{status:429});

  const { password }=await request.json().catch(()=>({}));
  const expected=process.env.ADMIN_PASSWORD;
  if(!expected || !password || !safeEqualText(password,expected)) {
    return NextResponse.json({error:"Incorrect admin password."},{status:401});
  }
  await setSession({role:"admin"},8);
  return NextResponse.json({ok:true});
}
