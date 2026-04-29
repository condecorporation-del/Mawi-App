import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/domain-error";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  projectId: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const outputSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string(),
  status: z.string(),
  currency: z.literal("MXN"),
  budgetCents: z.number().int(),
  expenseCents: z.number().int(),
  receivableCents: z.number().int(),
  paidReceivableCents: z.number().int(),
  payableCents: z.number().int(),
  paidPayableCents: z.number().int(),
  grossProfitCents: z.number().int(),
  netProfitCents: z.number().int(),
  budgetUsedPct: z.number(),
  period: z.object({ from: z.string().nullable(), to: z.string().nullable() }),
});

export const getProjectSummaryTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "project.get_summary",
  description: "Devuelve el resumen financiero completo de un proyecto: presupuesto, gastos, ingresos, utilidad bruta y neta. Acepta rango de fechas opcional.",
  inputSchema,
  outputSchema,
  riskLevel: "low",
  requiredPermissions: ["agent.chat"],
  requiresConfirmation: false,
  auditEvent: "agent.tool.project_get_summary.executed",
  version: "1.0.0",
  async execute(context, input) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, tenantId: context.tenantId, deletedAt: null },
      select: { id: true, name: true, status: true, budgetCents: true },
    });
    if (!project) throw new NotFoundError("Proyecto no encontrado.");

    const dateFilter = {
      ...(input.from ? { gte: new Date(input.from) } : {}),
      ...(input.to ? { lte: new Date(input.to) } : {}),
    };
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const [expenseAgg, invoices] = await Promise.all([
      prisma.expense.aggregate({
        where: {
          tenantId: context.tenantId,
          projectId: project.id,
          deletedAt: null,
          ...(hasDateFilter ? { expenseDate: dateFilter } : {}),
        },
        _sum: { totalCents: true },
      }),
      prisma.invoice.findMany({
        where: {
          tenantId: context.tenantId,
          projectId: project.id,
          deletedAt: null,
          ...(hasDateFilter ? { issueDate: dateFilter } : {}),
        },
        select: { type: true, status: true, totalCents: true },
      }),
    ]);

    const expenseCents = expenseAgg._sum.totalCents ?? 0;
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

    const grossProfitCents = receivableCents - payableCents;
    const netProfitCents = receivableCents - expenseCents;
    const budgetUsedPct =
      project.budgetCents > 0
        ? Math.round((expenseCents / project.budgetCents) * 100 * 10) / 10
        : 0;

    return {
      projectId: project.id,
      projectName: project.name,
      status: project.status,
      currency: "MXN",
      budgetCents: project.budgetCents,
      expenseCents,
      receivableCents,
      paidReceivableCents,
      payableCents,
      paidPayableCents,
      grossProfitCents,
      netProfitCents,
      budgetUsedPct,
      period: {
        from: input.from ?? null,
        to: input.to ?? null,
      },
    };
  },
};
