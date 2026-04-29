import "server-only";

import { AlertSeverity, AlertStatus, AlertType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type AlertContext = { tenantId: string; userId: string };

const OVERDUE_THRESHOLD_DAYS = 0;
const BUDGET_WARNING_PCT = 0.9;

export async function detectFinancialAlerts(ctx: AlertContext): Promise<void> {
  const now = new Date();

  const [overdueInvoices, overbudgetProjects] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        status: { notIn: ["paid", "cancelled"] },
        dueDate: { lt: now },
      },
      select: { id: true, number: true, totalCents: true, type: true },
    }),
    prisma.project.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        status: { in: ["active", "planning"] },
      },
      include: {
        expenses: { where: { deletedAt: null }, select: { totalCents: true } },
      },
    }),
  ]);

  const alertsToCreate: {
    tenantId: string;
    type: AlertType;
    severity: AlertSeverity;
    status: AlertStatus;
    title: string;
    description: string;
    entityType: string;
    entityId: string;
  }[] = [];

  for (const invoice of overdueInvoices) {
    const existing = await prisma.alert.findFirst({
      where: {
        tenantId: ctx.tenantId,
        type: AlertType.payment_overdue,
        entityType: "invoice",
        entityId: invoice.id,
        status: { not: AlertStatus.resolved },
      },
    });
    if (!existing) {
      alertsToCreate.push({
        tenantId: ctx.tenantId,
        type: AlertType.payment_overdue,
        severity: AlertSeverity.warning,
        status: AlertStatus.open,
        title: `Factura vencida: ${invoice.number}`,
        description: `La factura ${invoice.number} esta vencida.`,
        entityType: "invoice",
        entityId: invoice.id,
      });
    }
  }

  for (const project of overbudgetProjects) {
    if (project.budgetCents === 0) continue;
    const spentCents = project.expenses.reduce((s, e) => s + e.totalCents, 0);
    if (spentCents >= project.budgetCents * BUDGET_WARNING_PCT) {
      const existing = await prisma.alert.findFirst({
        where: {
          tenantId: ctx.tenantId,
          type: AlertType.budget_overrun,
          entityType: "project",
          entityId: project.id,
          status: { not: AlertStatus.resolved },
        },
      });
      if (!existing) {
        const pct = Math.round((spentCents / project.budgetCents) * 100);
        alertsToCreate.push({
          tenantId: ctx.tenantId,
          type: AlertType.budget_overrun,
          severity: pct >= 100 ? AlertSeverity.critical : AlertSeverity.warning,
          status: AlertStatus.open,
          title: `Presupuesto al ${pct}%: ${project.name}`,
          description: `El proyecto ${project.name} ha consumido el ${pct}% de su presupuesto.`,
          entityType: "project",
          entityId: project.id,
        });
      }
    }
  }

  if (alertsToCreate.length > 0) {
    await prisma.alert.createMany({ data: alertsToCreate });
  }
}
