import { InvoiceType, InvoiceStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { NotFoundError, DomainError } from "@/lib/errors/domain-error";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  projectId: z.string().uuid(),
  number: z.string().trim().min(1).max(100),
  totalCents: z.number().int().positive(),
  issueDate: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
  clientId: z.string().uuid().optional(),
  description: z.string().trim().max(500).optional(),
});

const confirmationRequiredSchema = z.object({
  status: z.literal("confirmation_required"),
  summary: z.string(),
  confirmationToken: z.string().uuid(),
});

const successSchema = z.object({
  status: z.literal("executed"),
  invoiceId: z.string().uuid(),
  projectId: z.string().uuid(),
  number: z.string(),
  totalCents: z.number().int(),
  invoiceStatus: z.string(),
  idempotencyKey: z.string(),
});

const outputSchema = z.union([confirmationRequiredSchema, successSchema]);

export const registerIncomeTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "invoice.register_income",
  description: "Registra una factura por cobrar (ingreso) asociada a un proyecto. Requiere confirmación.",
  inputSchema,
  outputSchema,
  riskLevel: "medium",
  requiredPermissions: ["invoice.manage"],
  requiresConfirmation: true,
  auditEvent: "agent.tool.invoice_register_income.executed",
  version: "1.0.0",
  async execute(context, input) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, tenantId: context.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundError("Proyecto no encontrado.");

    if (input.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, tenantId: context.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!client) throw new DomainError("Cliente no encontrado.", 404);
    }

    const existing = await prisma.invoice.findFirst({
      where: { tenantId: context.tenantId, clientGenId: input.idempotencyKey, deletedAt: null },
      select: { id: true, projectId: true, number: true, totalCents: true, status: true },
    });

    if (existing) {
      return {
        status: "executed",
        invoiceId: existing.id,
        projectId: existing.projectId ?? input.projectId,
        number: existing.number,
        totalCents: existing.totalCents,
        invoiceStatus: existing.status,
        idempotencyKey: input.idempotencyKey,
      };
    }

    const created = await prisma.invoice.create({
      data: {
        tenantId: context.tenantId,
        type: InvoiceType.receivable,
        status: InvoiceStatus.pending_review,
        number: input.number,
        projectId: input.projectId,
        clientId: input.clientId,
        issueDate: new Date(input.issueDate),
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        totalCents: input.totalCents,
        clientGenId: input.idempotencyKey,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true, projectId: true, number: true, totalCents: true, status: true },
    });

    return {
      status: "executed",
      invoiceId: created.id,
      projectId: created.projectId ?? input.projectId,
      number: created.number,
      totalCents: created.totalCents,
      invoiceStatus: created.status,
      idempotencyKey: input.idempotencyKey,
    };
  },
};
