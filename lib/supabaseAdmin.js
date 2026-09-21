import { createClient } from "@supabase/supabase-js";

let client;

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY.");
  }

  if (!client) {
    client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return client;
}
