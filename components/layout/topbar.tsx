"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":           "Centro de control",
  "/projects":            "Proyectos",
  "/projects/new":        "Nuevo proyecto",
  "/invoices/receivable": "Ingresos",
  "/invoices/payable":    "Facturas",
  "/expenses":            "Gastos",
  "/contracts":           "Contratos",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/projects/") && pathname !== "/projects/new") {
    return "Proyecto";
  }
  const match = Object.keys(PAGE_TITLES).find((k) => k !== "/" && pathname.startsWith(k));
  return match ? PAGE_TITLES[match] : "Mawi AI";
}

function fmtCompact(cents: number): string {
  if (cents === 0) return "—";
  const abs = Math.abs(cents);
  if (abs >= 100_000_000) return `$${(cents / 100_000_000).toFixed(1)}M`;
  if (abs >= 100_000)     return `$${(cents / 100_000).toFixed(0)}k`;
  return `$${(cents / 100).toFixed(0)}`;
}

type TopbarProps = {
  tenantName:           string;
  userEmail?:           string;
  unreadNotifications:  number;
  totalBudgetCents?:    number;
  totalSpentCents?:     number;
  openAlertsCount?:     number;
  logoutAction:         () => void;
};

export function Topbar({
  tenantName,
  userEmail,
  unreadNotifications,
  totalBudgetCents  = 0,
  totalSpentCents   = 0,
  openAlertsCount   = 0,
  logoutAction,
}: TopbarProps) {
  const pathname  = usePathname();
  const pageTitle = getPageTitle(pathname);
  const initial   = userEmail ? userEmail[0].toUpperCase() : "U";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-zinc-950/80 px-8 shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-xl">

      {/* ── Left: page title + live metrics ── */}
      <div className="flex items-center gap-8">
        <h2 className="font-h2-headline text-xl font-bold text-primary-container drop-shadow-[0_0_10px_rgba(0,245,255,0.5)]">
          {pageTitle}
        </h2>
        <nav className="hidden items-center gap-6 divide-x divide-white/5 md:flex">
          <span className="font-mono-data text-xs font-medium tracking-tight text-primary-container">
            {fmtCompact(totalBudgetCents)} Presupuesto
          </span>
          <span className="pl-6 font-mono-data text-xs font-medium tracking-tight text-on-surface-variant">
            {fmtCompact(totalSpentCents)} Gastado
          </span>
          <span className={`pl-6 font-mono-data text-xs font-medium tracking-tight ${openAlertsCount > 0 ? "text-error" : "text-on-surface-variant"}`}>
            {openAlertsCount} Alertas
          </span>
        </nav>
      </div>

      {/* ── Right: controls ── */}
      <div className="flex items-center gap-4">
        <button className="material-symbols-outlined text-on-surface-variant transition-colors hover:text-on-surface" aria-label="Hub">
          hub
        </button>
        <div className="relative">
          <button
            className={`material-symbols-outlined transition-colors ${unreadNotifications > 0 ? "text-error" : "text-on-surface-variant hover:text-on-surface"}`}
            aria-label="Notificaciones"
          >
            {unreadNotifications > 0 ? "notifications_active" : "notifications_paused"}
          </button>
          {unreadNotifications > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[9px] font-bold text-on-error">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </div>

        <Link
          href="/invoices/payable"
          className="hidden rounded-sm bg-primary-container px-4 py-1.5 font-label-caps text-[10px] uppercase text-on-primary shadow-[0_0_15px_rgba(0,245,255,0.4)] transition-all hover:bg-primary-fixed-dim active:scale-95 sm:inline-flex"
        >
          Ejecutar pago
        </Link>

        {/* User identity */}
        <div className="ml-2 flex items-center gap-3 border-l border-white/10 pl-4">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase leading-none text-on-surface">{tenantName}</p>
            <p className="text-[8px] uppercase tracking-tighter text-primary-container">
              {userEmail?.split("@")[0] ?? "Usuario"}
            </p>
          </div>
          <div
            title={userEmail}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-primary-container/30 bg-primary-container/10 font-mono-data text-sm font-bold text-primary-container"
          >
            {initial}
          </div>
        </div>

        {/* Logout — llamado desde el layout (server action seguro) */}
        <form action={logoutAction}>
          <button
            title="Cerrar sesión"
            type="submit"
            className="flex items-center text-on-surface-variant transition-colors hover:text-error"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </form>
      </div>
    </header>
  );
}
