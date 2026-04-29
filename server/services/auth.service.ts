import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DomainError } from "@/lib/errors/domain-error";

export async function getAuthenticatedUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export async function signInWithPassword(
  credentials: { email: string; password: string },
  supabase: SupabaseClient,
) {
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) {
    throw new DomainError("Credenciales incorrectas. Revisa tu email y contrasena.", 401);
  }
}

export async function signOut(supabase: SupabaseClient) {
  await supabase.auth.signOut();
}
