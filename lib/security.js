import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "help_time_session";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
  return value;
}

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload) {
  const encoded = b64url(JSON.stringify(payload));
  const sig = crypto
    .createHmac("sha256", secret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [encoded, sig] = token.split(".");
  const expected = crypto
    .createHmac("sha256", secret())
    .update(encoded)
    .digest("base64url");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashPin(pin) {
  const pepper = process.env.EMPLOYEE_PIN_PEPPER;
  if (!pepper || pepper.length < 16) {
    throw new Error("EMPLOYEE_PIN_PEPPER must be at least 16 characters.");
  }
  return crypto.createHash("sha256").update(`${pepper}:${pin}`).digest("hex");
}

export function safeEqualText(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export async function setSession(payload, hours = 12) {
  const exp = Date.now() + hours * 60 * 60 * 1000;
  const store = await cookies();
  store.set(COOKIE_NAME, sign({ ...payload, exp }), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: hours * 60 * 60
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getSession() {
  const store = await cookies();
  return verify(store.get(COOKIE_NAME)?.value);
}

export async function requireEmployee() {
  const session = await getSession();
  if (!session || session.role !== "employee" || !session.employeeId) return null;
  return session;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return session;
}
