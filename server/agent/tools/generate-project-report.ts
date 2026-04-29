import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/domain-error";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  projectId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
});

const expenseRowSchema = z.object({
  description: z.string(),
  supplierName: z.string().nullable(),
  totalCents: z.number().int(),
  expenseDate: z.string(),
  status: z.string(),
});

const invoiceRowSchema = z.object({
  number: z.string(),
  type: z.string(),
  status: z.string(),
  totalCents: z.number().int(),
  issueDate: z.string(),
  dueDate: z.string().nullable(),
  counterpartName: z.string().nullable(),
});

const outputSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string(),
  period: z.object({ from: z.string(), to: z.string() }),
  currency: z.literal("MXN"),
  summary: z.object({
    budgetCents: z.number().int(),
    expenseCents: z.number().int(),
    receivableCents: z.number().int(),
    paidReceivableCents: z.number().int(),
    payableCents: z.number().int(),
    paidPayableCents: z.number().int(),
    netProfitCents: z.number().int(),
    budgetUsedPct: z.number(),
  }),
  expenses: z.array(expenseRowSchema),
  invoices: z.array(invoiceRowSchema),
  generatedAt: z.string(),
});

export const generateProjectReportTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "project.generate_report",
  description: "Genera un reporte financiero detallado de un proyecto en un rango de fechas, incluyendo resumen, lista de gastos y facturas. Úsalo cuando el usuario pida 'el reporte de X' o 'estado financiero de X'.",
  inputSchema,
  outputSchema,
  riskLevel: "low",
  requiredPermissions: ["agent.chat"],
  requiresConfirmation: false,
  auditEvent: "agent.tool.project_generate_report.executed",
  version: "1.0.0",
  async execute(context, input) {
    const from = new Date(input.from);
    const to = new Date(input.to);

    const project = await prisma.project.findFirst({
      where: { id: input.projectId, tenantId: context.tenantId, deletedAt: null },
      select: { id: true, name: true, budgetCents: true },
    });
    if (!project) throw new NotFoundError("Proyecto no encontrado.");

    const [expenses, invoices] = await Promise.all([
      prisma.expense.findMany({
        where: {
          tenantId: context.tenantId,
          projectId: project.id,
          deletedAt: null,
          expenseDate: { gte: from, lte: to },
        },
        select: {
          description: true,
          totalCents: true,
          expenseDate: true,
          status: true,
          supplier: { select: { name: true } },
        },
        orderBy: { expenseDate: "asc" },
      }),
      prisma.invoice.findMany({
        where: {
          tenantId: context.tenantId,
          projectId: project.id,
          deletedAt: null,
          issueDate: { gte: from, lte: to },
        },
        select: {
          number: true,
          type: true,
          status: true,
          totalCents: true,
          issueDate: true,
          dueDate: true,
          client: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { issueDate: "asc" },
      }),
    ]);

    const expenseCents = expenses.reduce((s, e) => s + e.totalCents, 0);
    const receivableCents = invoices
      .filter((i) => i.type === "receivable")
      .reduce((s, i) => s + i.totalCents, 0);
    const paidReceivableCents = invoices
      .filter((i) => i.type === "receivable" && i.status === "paid")
      .reduce((s, i) => s + i.totalCents, 0);
    const payableCents = invoices
      .filter((i) => i.type === "payable")
      .reduce((s, i) => s + i.totalCents, 0);
    const paidPayableCents = invoices
      .filter((i) => i.type === "payable" && i.status === "paid")
      .reduce((s, i) => s + i.totalCents, 0);
    const budgetUsedPct =
      project.budgetCents > 0
        ? Math.round((expenseCents / project.budgetCents) * 100 * 10) / 10
        : 0;

    return {
      projectId: project.id,
      projectName: project.name,
      period: { from: input.from, to: input.to },
      currency: "MXN",
      summary: {
        budgetCents: project.budgetCents,
        expenseCents,
        receivableCents,
        paidReceivableCents,
        payableCents,
        paidPayableCents,
        netProfitCents: receivableCents - expenseCents,
        budgetUsedPct,
      },
      expenses: expenses.map((e) => ({
        description: e.description,
        supplierName: e.supplier?.name ?? null,
        totalCents: e.totalCents,
        expenseDate: e.expenseDate.toISOString(),
        status: e.status,
      })),
      invoices: invoices.map((i) => ({
        number: i.number,
        type: i.type,
        status: i.status,
        totalCents: i.totalCents,
        issueDate: i.issueDate.toISOString(),
        dueDate: i.dueDate?.toISOString() ?? null,
        counterpartName: i.client?.name ?? i.supplier?.name ?? null,
      })),
      generatedAt: new Date().toISOString(),
    };
  },
};
