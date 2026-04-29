import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/domain-error";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  projectId: z.string().uuid(),
  name: z.string().trim().min(2).max(200).optional(),
  budgetCents: z.number().int().nonnegative().optional(),
  status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]).optional(),
  description: z.string().trim().max(1000).optional(),
});

const confirmationRequiredSchema = z.object({
  status: z.literal("confirmation_required"),
  summary: z.string(),
  confirmationToken: z.string().uuid(),
});

const successSchema = z.object({
  status: z.literal("executed"),
  projectId: z.string().uuid(),
  name: z.string(),
  budgetCents: z.number().int(),
  projectStatus: z.string(),
  idempotencyKey: z.string(),
});

const outputSchema = z.union([confirmationRequiredSchema, successSchema]);

export const updateProjectTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "project.update",
  description: "Edita campos de un proyecto existente: nombre, presupuesto, estado o descripción. Requiere confirmación.",
  inputSchema,
  outputSchema,
  riskLevel: "medium",
  requiredPermissions: ["project.manage"],
  requiresConfirmation: true,
  auditEvent: "agent.tool.project_update.executed",
  version: "1.0.0",
  async execute(context, input) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, tenantId: context.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundError("Proyecto no encontrado.");

    const updated = await prisma.project.update({
      where: { id: input.projectId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.budgetCents !== undefined ? { budgetCents: input.budgetCents } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        updatedBy: context.userId,
      },
      select: { id: true, name: true, budgetCents: true, status: true },
    });

    return {
      status: "executed",
      projectId: updated.id,
      name: updated.name,
      budgetCents: updated.budgetCents,
      projectStatus: updated.status,
      idempotencyKey: input.idempotencyKey,
    };
  },
};
