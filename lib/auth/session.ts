import "server-only";

import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { AuthenticationError } from "@/lib/errors/domain-error";
import { getAuthenticatedUser } from "@/server/services/auth.service";

export type AuthenticatedSession = {
  user: User;
};

export async function getCurrentSession(): Promise<AuthenticatedSession | null> {
  const supabase = createSupabaseServerClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return null;
  }

  return { user };
}

export async function requireSession(): Promise<AuthenticatedSession> {
  const session = await getCurrentSession();

  if (!session) {
    throw new AuthenticationError();
  }

  return session;
}
