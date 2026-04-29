import "server-only";

import { prisma } from "@/lib/db/prisma";

type TenantSnapshot = {
  activeProjects: Array<{ name: string; budgetCents: number; status: string }>;
  totalActiveProjects: number;
  totalProjects: number;
  overdueInvoiceCount: number;
  overdueInvoiceTotalCents: number;
  pendingPayableCents: number;
};

async function fetchTenantSnapshot(tenantId: string): Promise<TenantSnapshot> {
  const now = new Date();

  const [projects, overdueAgg, pendingPayableAgg] = await Promise.all([
    prisma.project.findMany({
      where: { tenantId, deletedAt: null, archivedAt: null },
      select: { name: true, status: true, budgetCents: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.invoice.aggregate({
      where: {
        tenantId,
        deletedAt: null,
        dueDate: { lt: now },
        status: { notIn: ["paid", "cancelled"] },
      },
      _count: { id: true },
      _sum: { totalCents: true },
    }),
    prisma.invoice.aggregate({
      where: {
        tenantId,
        type: "payable",
        deletedAt: null,
        status: { notIn: ["paid", "cancelled"] },
      },
      _sum: { totalCents: true },
    }),
  ]);

  const activeProjects = projects.filter((p) => p.status === "active");

  return {
    activeProjects,
    totalActiveProjects: activeProjects.length,
    totalProjects: projects.length,
    overdueInvoiceCount: overdueAgg._count.id ?? 0,
    overdueInvoiceTotalCents: overdueAgg._sum.totalCents ?? 0,
    pendingPayableCents: pendingPayableAgg._sum.totalCents ?? 0,
  };
}

function formatMXN(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
}

function formatDate(): string {
  return new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function buildTenantContext(tenantId: string): Promise<string> {
  const snap = await fetchTenantSnapshot(tenantId);

  const projectLines =
    snap.activeProjects.length > 0
      ? snap.activeProjects
          .map((p) => `  - ${p.name} — presupuesto ${formatMXN(p.budgetCents)}`)
          .join("\n")
      : "  (sin proyectos activos)";

  const overdueAlert =
    snap.overdueInvoiceCount > 0
      ? `⚠️ ${snap.overdueInvoiceCount} factura(s) vencida(s) por un total de ${formatMXN(snap.overdueInvoiceTotalCents)}`
      : "Sin facturas vencidas";

  const payableAlert =
    snap.pendingPayableCents > 0
      ? `Cuentas por pagar pendientes: ${formatMXN(snap.pendingPayableCents)}`
      : "Sin cuentas por pagar pendientes";

  return `## Contexto actual de la empresa

Fecha de hoy: ${formatDate()}

Proyectos activos (${snap.totalActiveProjects} de ${snap.totalProjects} total):
${projectLines}

Situación financiera inmediata:
- ${overdueAlert}
- ${payableAlert}`;
}
