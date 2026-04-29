import "server-only";

import { AlertStatus, InvoiceType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { DashboardKpis } from "@/features/dashboard/kpi.schema";

type KpiContext = { tenantId: string };

export async function getDashboardKpis(ctx: KpiContext): Promise<DashboardKpis> {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const timezone = "America/Mexico_City";
  // Rango para la gráfica: últimos 6 meses completos
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [receivables, payables, expenses, overduePayable, overdueReceivable, openAlerts, projects, chartInvs, chartExps] =
    await Promise.all([
      prisma.invoice.findMany({
        where: { tenantId: ctx.tenantId, type: InvoiceType.receivable, deletedAt: null, issueDate: { gte: from, lt: to } },
        select: { totalCents: true },
      }),
      prisma.invoice.findMany({
        where: { tenantId: ctx.tenantId, type: InvoiceType.payable, deletedAt: null, issueDate: { gte: from, lt: to } },
        include: { payments: { select: { amountCents: true } } },
      }),
      prisma.expense.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null, expenseDate: { gte: from, lt: to } },
        select: { totalCents: true },
      }),
      prisma.invoice.aggregate({
        where: { tenantId: ctx.tenantId, type: InvoiceType.payable, deletedAt: null, status: { notIn: ["paid", "cancelled"] }, dueDate: { lt: now } },
        _sum: { totalCents: true },
      }),
      prisma.invoice.aggregate({
        where: { tenantId: ctx.tenantId, type: InvoiceType.receivable, deletedAt: null, status: { notIn: ["paid", "cancelled"] }, dueDate: { lt: now } },
        _sum: { totalCents: true },
      }),
      prisma.alert.count({ where: { tenantId: ctx.tenantId, status: AlertStatus.open } }),
      prisma.project.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null, status: { in: ["active", "planning"] } },
        include: { expenses: { where: { deletedAt: null }, select: { totalCents: true } } },
      }),
      // Gráfica: facturas por cobrar de los últimos 6 meses
      prisma.invoice.findMany({
        where: { tenantId: ctx.tenantId, type: InvoiceType.receivable, deletedAt: null, issueDate: { gte: sixMonthsAgo, lt: to } },
        select: { totalCents: true, issueDate: true },
      }),
      // Gráfica: gastos de los últimos 6 meses
      prisma.expense.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null, expenseDate: { gte: sixMonthsAgo, lt: to } },
        select: { totalCents: true, expenseDate: true },
      }),
    ]);

  const incomeCents = receivables.reduce((s, r) => s + r.totalCents, 0);
  const expenseCents = expenses.reduce((s, e) => s + e.totalCents, 0);
  const profitCents = incomeCents - expenseCents;

  // Agrega datos por mes para la gráfica (últimos 6 meses)
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthKeys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const chartMap = new Map<string, { incomeCents: number; expenseCents: number }>(
    monthKeys.map((k) => [k, { incomeCents: 0, expenseCents: 0 }]),
  );
  for (const inv of chartInvs) {
    const k = `${inv.issueDate.getUTCFullYear()}-${String(inv.issueDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const entry = chartMap.get(k);
    if (entry) entry.incomeCents += inv.totalCents;
  }
  for (const exp of chartExps) {
    const k = `${exp.expenseDate.getUTCFullYear()}-${String(exp.expenseDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const entry = chartMap.get(k);
    if (entry) entry.expenseCents += exp.totalCents;
  }
  const chart = monthKeys.map((month) => {
    const m = chartMap.get(month)!;
    return { month, incomeCents: m.incomeCents, expenseCents: m.expenseCents, profitCents: m.incomeCents - m.expenseCents };
  });

  const upcomingReceivable = await prisma.invoice.aggregate({
    where: { tenantId: ctx.tenantId, type: InvoiceType.receivable, deletedAt: null, status: { notIn: ["paid", "cancelled"] }, dueDate: { gte: now, lte: in30Days } },
    _sum: { totalCents: true },
  });
  const upcomingPayable = await prisma.invoice.aggregate({
    where: { tenantId: ctx.tenantId, type: InvoiceType.payable, deletedAt: null, status: { notIn: ["paid", "cancelled"] }, dueDate: { gte: now, lte: in30Days } },
    _sum: { totalCents: true },
  });
  const upcomingCashFlowCents =
    (upcomingReceivable._sum.totalCents ?? 0) - (upcomingPayable._sum.totalCents ?? 0);

  const projectRisks = projects
    .map((p) => {
      if (p.budgetCents === 0) return null;
      const actualCents = p.expenses.reduce((s, e) => s + e.totalCents, 0);
      const varianceCents = actualCents - p.budgetCents;
      const varianceBasisPoints = Math.round((varianceCents / p.budgetCents) * 10_000);
      if (varianceBasisPoints < 5_000) return null;
      return {
        projectId: p.id,
        projectName: p.name,
        budgetCents: p.budgetCents,
        actualCents,
        varianceCents,
        varianceBasisPoints,
        severity: varianceBasisPoints >= 10_000 ? ("critical" as const) : ("warning" as const),
      };
    })
    .filter(Boolean) as DashboardKpis["projectRisks"];

  const recentAlerts = await prisma.alert.findMany({
    where: { tenantId: ctx.tenantId, status: AlertStatus.open },
    orderBy: { triggeredAt: "desc" },
    take: 5,
    select: { id: true, title: true, description: true, severity: true, status: true, triggeredAt: true },
  });

  return {
    period: { from: from.toISOString(), to: to.toISOString(), timezone },
    incomeCents,
    expenseCents,
    profitCents,
    upcomingCashFlowCents,
    overduePayableCents: overduePayable._sum.totalCents ?? 0,
    overdueReceivableCents: overdueReceivable._sum.totalCents ?? 0,
    openAlertsCount: openAlerts,
    chart,
    projectRisks,
    alerts: recentAlerts.map((a) => ({
      ...a,
      triggeredAt: a.triggeredAt.toISOString(),
    })),
  };
}
