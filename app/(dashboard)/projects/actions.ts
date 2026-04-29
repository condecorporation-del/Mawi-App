"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getTenantContext } from "@/lib/auth/tenant-context";
import { assertPermission } from "@/lib/permissions/assert-permission";
import { DomainError } from "@/lib/errors/domain-error";
import {
  budgetPesosToCents,
  createProjectFormSchema,
} from "@/features/projects/create-project.schema";
import { createProject, updateProject } from "@/server/services/projects.service";
import { createAuditLog } from "@/server/services/audit.service";
import { ActorType } from "@prisma/client";

function isNextRedirect(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateProjectAction(projectId: string, formData: FormData) {
  const ctx = await getTenantContext();
  await assertPermission(ctx.userId, ctx.tenantId, "project.manage");

  const budgetRaw = getFormValue(formData, "budgetPesos");
  const statusRaw = getFormValue(formData, "status");

  const budgetCents = budgetRaw ? budgetPesosToCents(parseFloat(budgetRaw)) : undefined;

  try {
    await updateProject(ctx, projectId, {
      name: getFormValue(formData, "name") || undefined,
      description: getFormValue(formData, "description") || null,
      budgetCents,
      status: statusRaw ? (statusRaw as import("@prisma/client").ProjectStatus) : undefined,
    });

    await createAuditLog({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      actorType: ActorType.user,
      entityType: "project",
      entityId: projectId,
      action: "project.updated",
      metadata: { name: getFormValue(formData, "name") },
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    redirect(`/projects/${projectId}`);
  } catch (error: unknown) {
    if (isNextRedirect(error)) throw error;
    const message =
      error instanceof DomainError
        ? error.publicMessage
        : "No pudimos guardar los cambios. Intenta de nuevo.";
    redirect(`/projects/${projectId}?error=${encodeURIComponent(message)}`);
  }
}

export async function createProjectAction(formData: FormData) {
  const ctx = await getTenantContext();
  await assertPermission(ctx.userId, ctx.tenantId, "project.manage");

  const raw = {
    code: getFormValue(formData, "code"),
    name: getFormValue(formData, "name"),
    description: getFormValue(formData, "description"),
    budgetPesos: getFormValue(formData, "budgetPesos") || "0",
  };

  const parsed = createProjectFormSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Datos invalidos.";
    redirect(`/projects/new?error=${encodeURIComponent(first)}`);
  }

  const budgetCents = budgetPesosToCents(parsed.data.budgetPesos);

  try {
    const project = await createProject(ctx, {
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      budgetCents,
    });

    await createAuditLog({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      actorType: ActorType.user,
      entityType: "project",
      entityId: project.id,
      action: "project.created",
      metadata: { code: project.code, name: project.name },
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${project.id}`);
    redirect("/projects");
  } catch (error: unknown) {
    if (isNextRedirect(error)) {
      throw error;
    }
    const message =
      error instanceof DomainError
        ? error.publicMessage
        : "No pudimos crear el proyecto. Intenta de nuevo.";
    redirect(`/projects/new?error=${encodeURIComponent(message)}`);
  }
}
