import "server-only";

import { Prisma, ProjectStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

type TenantContext = { tenantId: string; userId: string };

export type CreateProjectInput = {
  code: string;
  name: string;
  description?: string | null;
  budgetCents: number;
  status?: ProjectStatus;
  clientId?: string | null;
};

export async function listProjects(
  ctx: TenantContext,
  query: Record<string, string | string[] | undefined>,
) {
  const rows = await prisma.project.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    include: {
      client: { select: { name: true } },
      expenses: {
        where: { deletedAt: null },
        select: { totalCents: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return rows.map(({ expenses, ...r }) => ({
    ...r,
    currency: "MXN" as const,
    spentCents: expenses.reduce((s, e) => s + e.totalCents, 0),
  }));
}

export async function createProject(ctx: TenantContext, input: CreateProjectInput) {
  const code = input.code.trim();
  const name = input.name.trim();

  const duplicate = await prisma.project.findFirst({
    where: { tenantId: ctx.tenantId, code, deletedAt: null },
    select: { id: true },
  });
  if (duplicate) {
    throw new DomainError("Ya existe un proyecto con ese codigo en tu cuenta.");
  }

  try {
    return await prisma.project.create({
      data: {
        tenantId: ctx.tenantId,
        code,
        name,
        description: input.description?.trim() || null,
        status: input.status ?? ProjectStatus.planning,
        budgetCents: input.budgetCents,
        clientId: input.clientId ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DomainError("Ya existe un proyecto con ese codigo en tu cuenta.");
    }
    throw error;
  }
}

export type UpdateProjectInput = {
  name?: string;
  description?: string | null;
  budgetCents?: number;
  status?: ProjectStatus;
};

export async function updateProject(ctx: TenantContext, projectId: string, input: UpdateProjectInput) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new DomainError("Proyecto no encontrado.", 404);

  return prisma.project.update({
    where: { id: projectId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.budgetCents !== undefined ? { budgetCents: input.budgetCents } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedBy: ctx.userId,
    },
  });
}

export async function getProjectById(ctx: TenantContext, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: ctx.tenantId, deletedAt: null },
    include: {
      client: { select: { id: true, name: true } },
      expenses: {
        where: { deletedAt: null },
        select: { totalCents: true },
      },
      invoices: {
        where: { deletedAt: null },
        select: { type: true, totalCents: true, status: true, number: true },
      },
    },
  });

  if (!project) {
    return null;
  }

  const spentCents = project.expenses.reduce((s, e) => s + e.totalCents, 0);
  const receivableCents = project.invoices
    .filter((i) => i.type === "receivable")
    .reduce((s, i) => s + i.totalCents, 0);
  const payableCents = project.invoices
    .filter((i) => i.type === "payable")
    .reduce((s, i) => s + i.totalCents, 0);

  return {
    ...project,
    spentCents,
    receivableCents,
    payableCents,
    grossMarginCents: receivableCents - spentCents,
  };
}
