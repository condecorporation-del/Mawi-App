"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { DomainError } from "@/lib/errors/domain-error";
import {
  signInWithPassword,
  signOut,
} from "@/server/services/auth.service";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function loginAction(formData: FormData) {
  const email = getFormValue(formData, "email");
  const password = getFormValue(formData, "password");

  try {
    await signInWithPassword(
      { email, password },
      createSupabaseServerClient(),
    );
  } catch (error: unknown) {
    const message =
      error instanceof DomainError
        ? error.publicMessage
        : "No pudimos iniciar sesion.";
    const searchParams = new URLSearchParams({ error: message, email });

    redirect(`/login?${searchParams.toString()}`);
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  await signOut(createSupabaseServerClient());
  redirect("/login");
}
