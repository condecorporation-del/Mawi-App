import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]).optional(),
});

const projectItemSchema = z.object({
  projectId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  status: z.string(),
  budgetCents: z.number().int(),
  expenseCents: z.number().int(),
  receivableCents: z.number().int(),
  payableCents: z.number().int(),
  varianceCents: z.number().int(),
});

const outputSchema = z.object({
  projects: z.array(projectItemSchema),
  total: z.number().int(),
});

export const listProjectsTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "project.list",
  description: "Lista los proyectos del tenant con sus KPIs financieros (presupuesto, gastos, ingresos). Usa este tool cuando el usuario pregunte qué proyectos hay o quiera ver un resumen general.",
  inputSchema,
  outputSchema,
  riskLevel: "low",
  requiredPermissions: ["agent.chat"],
  requiresConfirmation: false,
  auditEvent: "agent.tool.project_list.executed",
  version: "1.0.0",
  async execute(context, input) {
    const projects = await prisma.project.findMany({
      where: {
        tenantId: context.tenantId,
        deletedAt: null,
        archivedAt: null,
        ...(input.status ? { status: input.status } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        budgetCents: true,
        expenses: {
          where: { deletedAt: null },
          select: { totalCents: true },
        },
        invoices: {
          where: { deletedAt: null },
          select: { type: true, totalCents: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const items = projects.map((p) => {
      const expenseCents = p.expenses.reduce((s, e) => s + e.totalCents, 0);
      const receivableCents = p.invoices
        .filter((i) => i.type === "receivable")
        .reduce((s, i) => s + i.totalCents, 0);
      const payableCents = p.invoices
        .filter((i) => i.type === "payable")
        .reduce((s, i) => s + i.totalCents, 0);

      return {
        projectId: p.id,
        code: p.code,
        name: p.name,
        status: p.status,
        budgetCents: p.budgetCents,
        expenseCents,
        receivableCents,
        payableCents,
        varianceCents: p.budgetCents - expenseCents,
      };
    });

    return { projects: items, total: items.length };
  },
};
