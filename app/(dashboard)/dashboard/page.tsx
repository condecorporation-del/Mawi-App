import Link from "next/link";
import { InvoiceType } from "@prisma/client";

import { requireSession } from "@/lib/auth/session";
import { requireActiveTenant } from "@/lib/auth/tenant";
import { detectFinancialAlerts } from "@/server/services/alerts.service";
import { getDashboardKpis } from "@/server/services/dashboard-kpis.service";
import { FinancialChart } from "@/features/dashboard/financial-chart";
import { formatCents } from "@/lib/money/format";
import { prisma } from "@/lib/db/prisma";

const CIRCUMFERENCE = 175; // 2π × r=28

function statusBadge(status: string) {
  switch (status) {
    case "paid":           return { label: "PAGADO",    cls: "bg-tertiary-container/10 text-tertiary-fixed-dim" };
    case "overdue":        return { label: "ATRASADO",  cls: "bg-error-container/10 text-error" };
    case "cancelled":      return { label: "CANCELADO", cls: "bg-white/5 text-on-surface-variant" };
    default:               return { label: "PENDIENTE", cls: "bg-primary-container/10 text-primary-container" };
  }
}

function ringColorFor(pct: number) {
  if (pct >= 1.0) return "#ffb4ab";
  if (pct >= 0.8) return "#d2bbff";
  return "#00f5ff";
}

export default async function DashboardPage() {
  const session    = await requireSession();
  const membership = await requireActiveTenant(session.user.id);
  const ctx        = { tenantId: membership.tenantId, userId: session.user.id };

  await detectFinancialAlerts(ctx);

  const [dashboard, recentPayables, allProjects] = await Promise.all([
    getDashboardKpis({ tenantId: membership.tenantId }),
    prisma.invoice.findMany({
      where:   { tenantId: membership.tenantId, type: InvoiceType.payable, deletedAt: null },
      include: { supplier: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }],
      take:    5,
    }),
    prisma.project.findMany({
      where:   { tenantId: membership.tenantId, deletedAt: null },
      include: { expenses: { where: { deletedAt: null }, select: { totalCents: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalBudget   = allProjects.reduce((s, p) => s + p.budgetCents, 0);
  const totalSpent    = allProjects.reduce((s, p) => s + p.expenses.reduce((a, e) => a + e.totalCents, 0), 0);
  const projectSample = allProjects.slice(0, 4);

  const spentPct = totalBudget > 0 ? Math.min(totalSpent / totalBudget, 1) : 0;

  return (
    <div className="space-y-6">

      {/* ── KPI STRIP ──────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-4">

        {/* Presupuesto Total */}
        <div className="glass-card relative overflow-hidden rounded-xl p-6 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <p className="text-label-caps uppercase text-on-surface-variant">Presupuesto Total</p>
            <span className="material-symbols-outlined text-primary-container">account_balance</span>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="font-h1-display text-3xl font-black text-primary-container">
              {formatCents(totalBudget)}
            </h3>
          </div>
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div className="h-full bg-primary-container neon-glow" style={{ width: "70%" }} />
          </div>
        </div>

        {/* Gasto Ejecutado */}
        <div className="glass-card relative overflow-hidden rounded-xl p-6 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <p className="text-label-caps uppercase text-on-surface-variant">Gasto Ejecutado</p>
            <span className="material-symbols-outlined text-primary-container">payments</span>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="font-h1-display text-3xl font-black text-primary-container">
              {formatCents(totalSpent)}
            </h3>
            {totalBudget > 0 && (
              <span className="text-xs font-bold text-on-surface-variant">
                {Math.round(spentPct * 100)}% TOTAL
              </span>
            )}
          </div>
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full bg-primary-container neon-glow"
              style={{ width: `${Math.round(spentPct * 100)}%` }}
            />
          </div>
        </div>

        {/* Facturas Pendientes */}
        <div className="glass-card relative overflow-hidden rounded-xl p-6 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <p className="text-label-caps uppercase text-on-surface-variant">Facturas Pendientes</p>
            <span className="material-symbols-outlined text-primary-container">description</span>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="font-h1-display text-3xl font-black text-primary-container">
              {recentPayables.length.toString().padStart(2, "0")}
            </h3>
          </div>
          <div className="mt-4 flex gap-1">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i < Math.max(1, Math.ceil(recentPayables.length / 2)) ? "bg-primary-container neon-glow" : "bg-primary-container/20"}`}
              />
            ))}
          </div>
        </div>

        {/* Alertas Activas */}
        <div className={`glass-card relative overflow-hidden rounded-xl p-6 flex flex-col gap-2 ${dashboard.openAlertsCount > 0 ? "border-error/20" : ""}`}>
          <div className="flex items-start justify-between">
            <p className={`text-label-caps uppercase ${dashboard.openAlertsCount > 0 ? "text-error" : "text-on-surface-variant"}`}>
              Alertas Activas
            </p>
            <span
              className={`material-symbols-outlined ${dashboard.openAlertsCount > 0 ? "text-error" : "text-on-surface-variant"}`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              warning
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className={`font-h1-display text-3xl font-black ${dashboard.openAlertsCount > 0 ? "text-error" : "text-on-surface-variant"}`}>
              {dashboard.openAlertsCount.toString().padStart(2, "0")}
            </h3>
            {dashboard.openAlertsCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-bold text-error">
                <span className="h-2 w-2 rounded-full bg-error animate-pulse" />
                NIVEL ALTO
              </span>
            )}
          </div>
          {dashboard.alerts[0] && (
            <p className="mt-4 truncate text-[10px] uppercase text-on-surface-variant">
              {dashboard.alerts[0].title}
            </p>
          )}
        </div>
      </section>

      {/* ── MAIN GRID: chart + right panel ─────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">

        {/* Left block: chart + invoices table (8 cols) */}
        <section className="col-span-12 space-y-6 lg:col-span-8">

          {/* Flujo de Caja chart */}
          <div className="glass-card relative overflow-hidden rounded-xl p-8" style={{ minHeight: "360px" }}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-h3-technical text-on-surface">Flujo de Caja — Últimos 6 Meses</h2>
                <p className="mt-1 text-xs uppercase tracking-widest text-on-surface-variant">
                  Análisis Financiero Proyectado
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-primary-container" />
                  <span className="text-[10px] text-on-surface-variant">REAL</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border border-dashed border-primary-container/50" />
                  <span className="text-[10px] text-on-surface-variant">PROYECTADO</span>
                </div>
              </div>
            </div>
            <FinancialChart data={dashboard.chart} />
          </div>

          {/* Tabla de facturas recientes */}
          <div className="glass-card overflow-hidden rounded-xl">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-6 py-4">
              <h3 className="text-label-caps uppercase text-on-surface">Facturas Recientes</h3>
              <Link href="/invoices/payable" className="text-[10px] font-bold text-primary-container hover:underline">
                VER TODO
              </Link>
            </div>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  <th className="px-6 py-4">Proveedor</th>
                  <th className="px-6 py-4">No. Factura</th>
                  <th className="px-6 py-4">Vencimiento</th>
                  <th className="px-6 py-4">Monto</th>
                  <th className="px-6 py-4 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {recentPayables.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-on-surface-variant">
                      Sin facturas registradas
                    </td>
                  </tr>
                ) : (
                  recentPayables.map((inv) => {
                    const badge = statusBadge(inv.status);
                    return (
                      <tr key={inv.id} className="border-b border-white/5 transition-colors hover:bg-white/[0.02]">
                        <td className="px-6 py-4 font-medium text-on-surface">
                          {inv.supplier?.name ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-on-surface-variant">{inv.number}</td>
                        <td className="font-mono-data px-6 py-4 text-on-surface-variant">
                          {inv.dueDate
                            ? new Date(inv.dueDate).toLocaleDateString("es-MX", {
                                day: "2-digit", month: "2-digit", year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="font-mono-data px-6 py-4 text-on-surface">
                          {formatCents(inv.totalCents)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`rounded px-2 py-1 text-[10px] font-bold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right panel: AI status + project rings (4 cols) */}
        <aside className="col-span-12 flex flex-col gap-6 lg:col-span-4">

          {/* Estado de Mawi IA neural */}
          <div className="glass-card flex flex-col overflow-hidden rounded-xl border-primary-container/20">
            <div className="flex items-center justify-between border-b border-primary-container/20 bg-primary-container/10 p-4">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 animate-pulse rounded-full bg-primary-container shadow-[0_0_8px_#00F5FF]" />
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface">Mawi IA neural</span>
              </div>
              <span className="font-mono-data text-[10px] text-primary-container/60">ENLACE_SEGURO: ACTIVO</span>
            </div>
            <div className="flex-1 space-y-3 p-4 font-mono-data text-xs text-on-surface-variant">
              {dashboard.alerts.length > 0 ? (
                dashboard.alerts.slice(0, 2).map((a) => (
                  <div key={a.id} className="rounded-r-lg border-l-2 border-error bg-white/5 p-3">
                    <p className="font-bold text-error">{a.title}</p>
                    <p className="mt-1 text-[11px]">{a.description}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-r-lg border-l-2 border-tertiary-fixed-dim bg-white/5 p-3">
                  <p className="text-tertiary-fixed-dim">Sistema operando dentro de parámetros normales.</p>
                  <p className="mt-1 text-[11px]">Flujo de caja estable. Sin anomalías detectadas.</p>
                </div>
              )}
              <p className="flex items-center gap-1 text-[10px] italic text-on-surface-variant/40">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
                Mawi está analizando operaciones
              </p>
            </div>
            <div className="border-t border-white/5 p-4">
              <input
                readOnly
                className="w-full cursor-pointer rounded border border-white/10 bg-white/5 px-4 py-3 text-xs text-on-surface-variant placeholder:text-on-surface-variant/40 focus:outline-none"
                placeholder="Consultar a Mawi AI..."
              />
            </div>
          </div>

          {/* Project progress rings */}
          <div className="grid grid-cols-2 gap-4">
            {projectSample.length === 0 ? (
              <div className="glass-card col-span-2 rounded-xl p-6 text-center text-xs text-on-surface-variant">
                Sin proyectos activos
              </div>
            ) : (
              projectSample.map((p) => {
                const spent = p.expenses.reduce((s, e) => s + e.totalCents, 0);
                const pct   = p.budgetCents > 0 ? Math.min(spent / p.budgetCents, 1) : 0;
                const offset = CIRCUMFERENCE * (1 - pct);
                const color  = ringColorFor(pct);
                return (
                  <div key={p.id} className="glass-card flex flex-col items-center justify-center gap-3 rounded-xl p-4">
                    <div className="relative h-16 w-16">
                      <svg
                        className="h-full w-full"
                        style={{ transform: "rotate(-90deg)" }}
                        viewBox="0 0 64 64"
                      >
                        <circle
                          cx="32" cy="32" r="28"
                          fill="transparent"
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth="4"
                        />
                        <circle
                          cx="32" cy="32" r="28"
                          fill="transparent"
                          stroke={color}
                          strokeDasharray={CIRCUMFERENCE}
                          strokeDashoffset={offset}
                          strokeWidth="4"
                          style={{ filter: `drop-shadow(0 0 4px ${color}99)` }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-mono-data text-[10px] font-bold text-on-surface">
                        {Math.round(pct * 100)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase text-on-surface">
                        {p.name.length > 12 ? p.name.slice(0, 11) + "…" : p.name}
                      </p>
                      <p className="text-[8px] capitalize text-on-surface-variant">{p.status.replace("_", " ")}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>

      {/* ── FAB ──────────────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-8 right-8 z-[60]">
        <Link
          href="/expenses"
          aria-label="Registrar gasto"
          className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary-container text-on-primary shadow-[0_0_30px_rgba(0,245,255,0.4)] transition-all hover:scale-110 active:scale-95"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </Link>
      </div>
    </div>
  );
}
