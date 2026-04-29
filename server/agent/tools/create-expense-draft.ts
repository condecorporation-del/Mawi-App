import { ExpenseSource, ExpenseStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/domain-error";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  projectId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  description: z.string().trim().min(3).max(500),
  totalCents: z.number().int().positive(),
  expenseDate: z.string().datetime(),
});

const confirmationRequiredSchema = z.object({
  status: z.literal("confirmation_required"),
  summary: z.string(),
  confirmationToken: z.string().uuid(),
});

const successSchema = z.object({
  status: z.literal("executed"),
  expenseId: z.string().uuid(),
  projectId: z.string().uuid(),
  description: z.string(),
  totalCents: z.number().int().positive(),
  expenseDate: z.string().datetime(),
  idempotencyKey: z.string(),
});

const outputSchema = z.union([confirmationRequiredSchema, successSchema]);

export const createExpenseDraftTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "expense.create_draft",
  description: "Registra un gasto en un proyecto. Requiere confirmación del usuario antes de guardar.",
  inputSchema,
  outputSchema,
  riskLevel: "medium",
  requiredPermissions: ["expense.manage"],
  requiresConfirmation: true,
  auditEvent: "agent.tool.expense_create_draft.executed",
  version: "1.1.0",
  async execute(context, input) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, tenantId: context.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundError("Proyecto no encontrado.");

    if (input.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: input.supplierId, tenantId: context.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!supplier) throw new NotFoundError("Proveedor no encontrado.");
    }

    const existing = await prisma.expense.findFirst({
      where: { tenantId: context.tenantId, clientGenId: input.idempotencyKey, deletedAt: null },
      select: { id: true, projectId: true, description: true, totalCents: true, expenseDate: true },
    });

    if (existing) {
      return {
        status: "executed",
        expenseId: existing.id,
        projectId: existing.projectId,
        description: existing.description,
        totalCents: existing.totalCents,
        expenseDate: existing.expenseDate.toISOString(),
        idempotencyKey: input.idempotencyKey,
      };
    }

    const created = await prisma.expense.create({
      data: {
        tenantId: context.tenantId,
        projectId: input.projectId,
        supplierId: input.supplierId,
        description: input.description,
        totalCents: input.totalCents,
        expenseDate: new Date(input.expenseDate),
        status: ExpenseStatus.pending_review,
        source: ExpenseSource.agent,
        clientGenId: input.idempotencyKey,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true, projectId: true, description: true, totalCents: true, expenseDate: true },
    });

    return {
      status: "executed",
      expenseId: created.id,
      projectId: created.projectId,
      description: created.description,
      totalCents: created.totalCents,
      expenseDate: created.expenseDate.toISOString(),
      idempotencyKey: input.idempotencyKey,
    };
  },
};
