import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente Supabase server-side com service_role (bypass RLS).
// NUNCA importar em ficheiros "use client".
// Inicialização lazy — só valida env vars quando efectivamente usado,
// para não quebrar a build quando as vars ainda não estão configuradas.

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Supabase admin client: faltam SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no ambiente."
    );
  }

  cached = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cached;
}

// ─── Tipos mapeados da schema Supabase ────────────────────────────────────────

export type AppRequestStatus = "draft" | "open" | "in_progress" | "completed" | "cancelled";
export type AppUrgency = "normal" | "urgent" | "flexible";

export interface AppOrder {
  id: string;
  title: string;
  description: string;
  location: string;
  district: string;
  city: string;
  urgency: AppUrgency;
  budget_range: string | null;
  preferred_date: string | null;
  status: AppRequestStatus;
  photos: string[];
  created_at: string;
  updated_at: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  category_name: string | null;
  category_icon: string | null;
  responses_count: number;
}
