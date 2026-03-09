import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // Only warn — allows the app to build even before keys are set
  console.warn("[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

export const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);
