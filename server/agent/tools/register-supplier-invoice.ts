import { InvoiceStatus, InvoiceType, Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/domain-error";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  supplierId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  number: z.string().trim().min(1).max(80),
  issueDate: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
  totalCents: z.number().int().positive(),
});

const confirmationRequiredSchema = z.object({
  status: z.literal("confirmation_required"),
  summary: z.string(),
  confirmationToken: z.string().uuid(),
});

const successSchema = z.object({
  status: z.literal("executed"),
  invoiceId: z.string().uuid(),
  supplierId: z.string().uuid(),
  number: z.string(),
  totalCents: z.number().int().positive(),
  idempotencyKey: z.string(),
});

const outputSchema = z.union([confirmationRequiredSchema, successSchema]);

export const registerSupplierInvoiceTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "invoice.register_supplier_invoice",
  description: "Registra una factura de proveedor como cuenta por pagar asociada a un proyecto. Requiere confirmación.",
  inputSchema,
  outputSchema,
  riskLevel: "medium",
  requiredPermissions: ["invoice.manage"],
  requiresConfirmation: true,
  auditEvent: "agent.tool.invoice_register_supplier_invoice.executed",
  version: "1.1.0",
  async execute(context, input) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, tenantId: context.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundError("Proveedor no encontrado.");

    if (input.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: input.projectId, tenantId: context.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw new NotFoundError("Proyecto no encontrado.");
    }

    const existing = await prisma.invoice.findFirst({
      where: { tenantId: context.tenantId, clientGenId: input.idempotencyKey, deletedAt: null },
      select: { id: true, supplierId: true, number: true, totalCents: true },
    });

    if (existing) {
      return {
        status: "executed",
        invoiceId: existing.id,
        supplierId: existing.supplierId ?? input.supplierId,
        number: existing.number,
        totalCents: existing.totalCents,
        idempotencyKey: input.idempotencyKey,
      };
    }

    let created: { id: string; supplierId: string | null; number: string; totalCents: number };

    try {
      created = await prisma.invoice.create({
        data: {
          tenantId: context.tenantId,
          type: InvoiceType.payable,
          status: InvoiceStatus.pending_review,
          clientGenId: input.idempotencyKey,
          number: input.number,
          supplierId: input.supplierId,
          projectId: input.projectId,
          issueDate: new Date(input.issueDate),
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          totalCents: input.totalCents,
          createdBy: context.userId,
          updatedBy: context.userId,
        },
        select: { id: true, supplierId: true, number: true, totalCents: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await prisma.invoice.findFirst({
          where: { tenantId: context.tenantId, clientGenId: input.idempotencyKey, deletedAt: null },
          select: { id: true, supplierId: true, number: true, totalCents: true },
        });
        if (!duplicate) throw error;
        created = duplicate;
      } else {
        throw error;
      }
    }

    return {
      status: "executed",
      invoiceId: created.id,
      supplierId: created.supplierId ?? input.supplierId,
      number: created.number,
      totalCents: created.totalCents,
      idempotencyKey: input.idempotencyKey,
    };
  },
};
