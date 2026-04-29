"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard",           icon: "dashboard",              label: "Centro de control" },
  { href: "/projects",            icon: "architecture",            label: "Proyectos"         },
  { href: "/invoices/receivable", icon: "account_balance_wallet", label: "Ingresos"          },
  { href: "/expenses",            icon: "query_stats",             label: "Gastos"            },
  { href: "/invoices/payable",    icon: "description",             label: "Facturas"          },
  { href: "/dashboard",           icon: "crisis_alert",            label: "Riesgos"           },
] as const;

const FOOTER_ITEMS = [{ href: "#", icon: "contact_support", label: "Soporte" }] as const;

function isActive(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="group fixed left-0 top-0 z-50 flex h-full w-20 flex-col overflow-hidden border-r border-white/10 bg-black/60 shadow-[10px_0_30px_rgba(0,0,0,0.5)] backdrop-blur-3xl transition-all duration-500 ease-in-out hover:w-64">

      {/* ── Logo ── */}
      <div className="mb-8 flex items-center gap-4 p-6">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-mawi-cyan">
          <span className="material-symbols-outlined text-xl text-mawi-cyan-on">
            architecture
          </span>
        </div>
        <div className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <h1 className="font-space-grotesk text-2xl font-black italic tracking-tighter text-mawi-cyan">
            Mawi AI
          </h1>
          <p className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            V0.4 sistema activo
          </p>
        </div>
      </div>

      {/* ── Main nav ── */}
      <nav aria-label="Navegación principal" className="flex-1 space-y-2 px-3">
        {NAV_ITEMS.map(({ href, icon, label }) =>
          isActive(href, pathname) ? (
            <Link
              key={href + label}
              href={href}
              className="flex items-center gap-4 rounded-lg border-l-4 border-mawi-cyan bg-mawi-cyan/10 p-3 text-mawi-cyan shadow-[0_0_20px_rgba(0,245,255,0.3)] transition-all duration-300"
            >
              <span className="material-symbols-outlined shrink-0">{icon}</span>
              <span className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest opacity-0 transition-opacity group-hover:opacity-100">
                {label}
              </span>
            </Link>
          ) : (
            <Link
              key={href + label}
              href={href}
              className="flex items-center gap-4 rounded-lg p-3 text-zinc-500 grayscale transition-all duration-300 hover:scale-95 hover:bg-white/5 hover:grayscale-0 hover:text-white hover:backdrop-blur-md"
            >
              <span className="material-symbols-outlined shrink-0">{icon}</span>
              <span className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest opacity-0 transition-opacity group-hover:opacity-100">
                {label}
              </span>
            </Link>
          )
        )}
      </nav>

      {/* ── Footer nav ── */}
      <div className="space-y-2 border-t border-white/10 p-3">
        {FOOTER_ITEMS.map(({ href, icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-lg p-3 text-zinc-500 grayscale transition-all duration-300 hover:bg-white/5 hover:grayscale-0 hover:text-white hover:backdrop-blur-md"
          >
            <span className="material-symbols-outlined shrink-0">{icon}</span>
            <span className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest opacity-0 transition-opacity group-hover:opacity-100">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
