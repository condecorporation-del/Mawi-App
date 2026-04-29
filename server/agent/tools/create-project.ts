import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().min(2).max(50),
  budgetCents: z.number().int().nonnegative(),
  description: z.string().trim().max(1000).optional(),
  clientId: z.string().uuid().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

const confirmationRequiredSchema = z.object({
  status: z.literal("confirmation_required"),
  summary: z.string(),
  confirmationToken: z.string().uuid(),
});

const successSchema = z.object({
  status: z.literal("executed"),
  projectId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  budgetCents: z.number().int(),
  idempotencyKey: z.string(),
});

const outputSchema = z.union([confirmationRequiredSchema, successSchema]);

export const createProjectTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "project.create",
  description: "Crea un nuevo proyecto con nombre, código, presupuesto y cliente opcional. Requiere confirmación antes de guardar.",
  inputSchema,
  outputSchema,
  riskLevel: "medium",
  requiredPermissions: ["project.manage"],
  requiresConfirmation: true,
  auditEvent: "agent.tool.project_create.executed",
  version: "1.0.0",
  async execute(context, input) {
    const existing = await prisma.project.findUnique({
      where: { tenantId_code: { tenantId: context.tenantId, code: input.code } },
      select: { id: true, code: true, name: true, budgetCents: true },
    });

    if (existing) {
      // Idempotente: si el código ya existe devolvemos el proyecto existente.
      return {
        status: "executed",
        projectId: existing.id,
        code: existing.code,
        name: existing.name,
        budgetCents: existing.budgetCents,
        idempotencyKey: input.idempotencyKey,
      };
    }

    if (input.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, tenantId: context.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!client) throw new DomainError("Cliente no encontrado.", 404);
    }

    const created = await prisma.project.create({
      data: {
        tenantId: context.tenantId,
        name: input.name,
        code: input.code,
        description: input.description,
        budgetCents: input.budgetCents,
        clientId: input.clientId,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true, code: true, name: true, budgetCents: true },
    });

    return {
      status: "executed",
      projectId: created.id,
      code: created.code,
      name: created.name,
      budgetCents: created.budgetCents,
      idempotencyKey: input.idempotencyKey,
    };
  },
};
