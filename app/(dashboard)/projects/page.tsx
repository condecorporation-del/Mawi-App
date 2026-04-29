import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { formatCents } from "@/lib/money/format";
import { listProjects } from "@/server/services/projects.service";
import { ProjectsFab } from "@/components/projects/projects-fab";

type ProjectsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function getQueryValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

// ── Constantes visuales ──────────────────────────────────────────────────────
const CIRCUMFERENCE = 251.2; // 2π × r=40

function ringColor(pct: number) {
  if (pct >= 1.0) return "#ffb4ab";
  if (pct >= 0.8) return "#d2bbff";
  return "#00F5FF";
}
function ringGlow(pct: number) {
  if (pct >= 1.0) return "drop-shadow-[0_0_5px_rgba(255,180,171,0.8)]";
  if (pct >= 0.8) return "drop-shadow-[0_0_5px_rgba(210,187,255,0.8)]";
  return "drop-shadow-[0_0_5px_rgba(0,245,255,0.8)]";
}
function healthLabel(pct: number) {
  if (pct >= 1.0) return { text: "Sobre Presupuesto", cls: "text-mawi-error" };
  if (pct >= 0.9) return { text: "Riesgo Alto",       cls: "text-mawi-error" };
  if (pct >= 0.8) return { text: "Precaución",        cls: "text-mawi-purple" };
  return                 { text: "Óptimo",             cls: "text-mawi-green" };
}
function stageForStatus(status: string) {
  const map: Record<string, number> = {
    planning: 1, active: 3, on_hold: 2, completed: 5, cancelled: 0,
  };
  return map[status] ?? 0;
}
function stageLabelForStatus(status: string) {
  const map: Record<string, { text: string; cls: string }> = {
    planning:  { text: "Planificación",      cls: "text-mawi-cyan"   },
    active:    { text: "Construcción Activa", cls: "text-mawi-cyan"  },
    on_hold:   { text: "En Pausa",           cls: "text-mawi-purple" },
    completed: { text: "Completado",         cls: "text-mawi-green"  },
    cancelled: { text: "Cancelado",          cls: "text-mawi-error"  },
  };
  return map[status] ?? { text: status, cls: "text-zinc-400" };
}

// ── Tarjeta de proyecto ──────────────────────────────────────────────────────
type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
  budgetCents: number;
  spentCents: number;
  client: { name: string } | null;
};

function ProjectCard({ project }: { project: Project }) {
  const pct = project.budgetCents > 0
    ? Math.min(project.spentCents / project.budgetCents, 1.5)
    : 0;
  const pctDisplay = Math.round(Math.min(pct, 1) * 100);
  const dashOffset  = CIRCUMFERENCE * (1 - Math.min(pct, 1));
  const color       = ringColor(pct);
  const glow        = ringGlow(pct);
  const health      = healthLabel(pct);
  const barWidth    = `${Math.min(pct * 100, 100).toFixed(0)}%`;
  const stage       = stageForStatus(project.status);
  const stageLabel  = stageLabelForStatus(project.status);
  const isHighRisk  = pct >= 0.9;

  return (
    <Link
      href={`/projects/${project.id}`}
      className={`block glass-panel group relative overflow-hidden rounded-xl transition-all duration-500 hover:scale-[1.02] ${isHighRisk ? "hover:border-mawi-error/40" : "hover:border-mawi-cyan/40"}`}
    >
      <div className="pointer-events-none absolute inset-0 holographic-overlay opacity-40" />
      <div className="pointer-events-none absolute -bottom-10 -right-10 opacity-10 transition-opacity group-hover:opacity-20">
        <span className="material-symbols-outlined text-[160px] font-thin">architecture</span>
      </div>

      <div className="relative z-10 flex h-full flex-col p-6">
        {/* ── Header row ── */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <span className="font-space-grotesk text-[10px] text-mawi-cyan/60 uppercase tracking-widest">
              {project.code}
            </span>
            <h3 className="font-space-grotesk text-2xl font-medium text-mawi-on-bg transition-colors group-hover:text-mawi-cyan">
              {project.name}
            </h3>
            {project.client && (
              <p className="mt-0.5 text-xs text-zinc-500">{project.client.name}</p>
            )}
          </div>

          {/* Progress ring */}
          <div className="relative h-16 w-16 shrink-0">
            <svg className="progress-ring h-full w-full" viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" r="40"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="8"
                className="text-white/5"
              />
              <circle
                cx="50" cy="50" r="40"
                fill="transparent"
                stroke={color}
                strokeWidth="8"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                className={glow}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-inter text-[12px] font-medium text-mawi-on-bg">
              {pctDisplay}%
            </div>
          </div>
        </div>

        {/* ── Budget health bar ── */}
        <div className="mb-8 space-y-4">
          <div className="flex items-end justify-between">
            <span className="font-space-grotesk text-[10px] uppercase tracking-widest text-mawi-on-bg/40">
              Salud del Presupuesto
            </span>
            <span className={`font-inter text-xs ${health.cls}`}>{health.text}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full"
              style={{
                width: barWidth,
                background: isHighRisk
                  ? "linear-gradient(to right, #00F5FF, #ffb4ab, #ffb4ab)"
                  : "linear-gradient(to right, #00e383, #00dce5, #00e383)",
              }}
            />
          </div>
          {project.budgetCents > 0 && (
            <div className="flex justify-between font-inter text-[11px] text-zinc-500">
              <span>Gastado: {formatCents(project.spentCents)}</span>
              <span>Presupuesto: {formatCents(project.budgetCents)}</span>
            </div>
          )}
        </div>

        {/* ── Stage tracker ── */}
        <div className="mt-auto space-y-4">
          <div className="flex items-center justify-between font-inter text-xs">
            <span className="uppercase tracking-widest text-mawi-on-bg/40">Etapa</span>
            <span className={stageLabel.cls}>{stageLabel.text}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-1 flex-1 items-center gap-1 rounded-full bg-white/10 px-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className="h-full w-1/5 rounded-sm"
                  style={i < stage
                    ? { background: color, boxShadow: `0 0 8px ${color}` }
                    : { background: "rgba(255,255,255,0.1)" }
                  }
                />
              ))}
            </div>
            <div
              className="h-2 w-2 animate-pulse rounded-full"
              style={{ background: color, boxShadow: `0 0 10px ${color}` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const context  = await getTenantContext(getQueryValue(searchParams?.tenantId));
  const projects = await listProjects(context, searchParams ?? {});

  // Estadísticas del hero
  const activeProjects = projects.filter((p) =>
    p.status === "active" || p.status === "planning"
  );
  const avgHealth =
    activeProjects.length > 0
      ? activeProjects.reduce((s, p) => {
          const pct = p.budgetCents > 0 ? p.spentCents / p.budgetCents : 0;
          return s + Math.max(0, 100 - Math.round(Math.min(pct, 1) * 100));
        }, 0) / activeProjects.length
      : null;
  const criticalCount = projects.filter(
    (p) => p.budgetCents > 0 && p.spentCents / p.budgetCents >= 0.9
  ).length;
  const totalBudget = projects.reduce((s, p) => s + p.budgetCents, 0);
  const totalSpent  = projects.reduce((s, p) => s + p.spentCents,  0);

  return (
    <div className="space-y-12">

      {/* ── HERO ── */}
      <section className="flex flex-col items-end justify-between gap-8 md:flex-row">
        <div className="space-y-2">
          <span className="font-space-grotesk text-xs font-bold uppercase tracking-[0.2em] text-mawi-on-bg opacity-60">
            Operaciones Activas
          </span>
          <h1 className="font-space-grotesk text-5xl font-bold leading-none tracking-tighter text-mawi-on-bg">
            Visión Holística
          </h1>
          <Button asChild className="mt-4 w-full sm:w-auto">
            <Link href="/projects/new">+ Nuevo proyecto</Link>
          </Button>
        </div>
        <div className="flex gap-4">
          {avgHealth !== null ? (
            <div className="glass-panel flex flex-col gap-1 rounded-xl border-l-4 border-mawi-cyan/20 px-8 py-4">
              <span className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest text-mawi-on-bg opacity-40">
                Salud Promedio
              </span>
              <span className="font-space-grotesk text-xl font-medium text-mawi-cyan">
                {avgHealth.toFixed(1)}%
              </span>
            </div>
          ) : (
            <div className="glass-panel flex flex-col gap-1 rounded-xl border-l-4 border-mawi-cyan/20 px-8 py-4">
              <span className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest text-mawi-on-bg opacity-40">
                Salud Promedio
              </span>
              <span className="font-space-grotesk text-xl font-medium text-zinc-500">Sin datos</span>
            </div>
          )}
          <div className="glass-panel flex flex-col gap-1 rounded-xl px-8 py-4">
            <span className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest text-mawi-on-bg opacity-40">
              Hitos Críticos
            </span>
            <span className="font-space-grotesk text-xl font-medium text-mawi-purple">
              {criticalCount.toString().padStart(2, "0")}
            </span>
          </div>
        </div>
      </section>

      {/* ── GRID DE PROYECTOS ── */}
      {projects.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center">
          <span className="material-symbols-outlined mb-4 block text-5xl text-zinc-600">
            architecture
          </span>
          <p className="font-space-grotesk text-sm font-medium text-zinc-500">
            Sin proyectos activos. Crea el primero para comenzar.
          </p>
          <Button asChild className="mt-6">
            <Link href="/projects/new">Crear proyecto</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      {/* ── FAB ── */}
      <ProjectsFab />

      {/* ── SECCION BENTO ── */}
      <section className="grid h-auto grid-cols-1 gap-6 md:h-96 md:grid-cols-3">

        {/* Panel de analisis neural (2/3) */}
        <div className="glass-panel relative flex flex-col overflow-hidden rounded-xl border-mawi-cyan/10 p-6 md:col-span-2">
          <div className="relative z-10 mb-4 flex items-center justify-between">
            <h4 className="font-space-grotesk text-lg font-medium text-mawi-on-bg">
              Análisis Neural de Salud
            </h4>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-ping rounded-full bg-mawi-cyan" />
              <span className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest opacity-60">
                Sincronizando nucleo IA
              </span>
            </div>
          </div>
          <div className="relative flex flex-1 items-center justify-center">
            <svg className="h-full max-h-40 w-full opacity-40" viewBox="0 0 600 200">
              <path d="M0,100 Q150,20 300,100 T600,100" fill="none" stroke="#00F5FF" strokeDasharray="4,4" strokeWidth="1" />
              <path d="M0,120 Q150,50 300,120 T600,120" fill="none" stroke="#D2BBFF" strokeWidth="0.5" />
              <circle cx="100" cy="65" r="4" fill="#00F5FF" className="animate-pulse" />
              <circle cx="300" cy="100" r="4" fill="#00F5FF" className="animate-pulse" />
              <circle cx="450" cy="85" r="4" fill="#00F5FF" className="animate-pulse" />
            </svg>
            <div className="pointer-events-none absolute inset-0 blueprint-grid opacity-20" />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-4 border-t border-white/5 pt-4 text-center">
            <div>
              <p className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest opacity-40">
                Proyectos
              </p>
              <p className="font-inter text-sm font-medium text-mawi-cyan">
                {projects.length}
              </p>
            </div>
            <div>
              <p className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest opacity-40">
                Críticos
              </p>
              <p className="font-inter text-sm font-medium text-mawi-cyan">
                {criticalCount}
              </p>
            </div>
            <div>
              <p className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest opacity-40">
                Presupuesto
              </p>
              <p className="font-inter text-sm font-medium text-mawi-cyan">
                {totalBudget > 0 ? formatCents(totalBudget) : "Sin datos"}
              </p>
            </div>
            <div>
              <p className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest opacity-40">
                Gastado
              </p>
              <p className={`font-inter text-sm font-medium ${totalSpent > totalBudget && totalBudget > 0 ? "text-mawi-error" : "text-mawi-green"}`}>
                {totalSpent > 0 ? formatCents(totalSpent) : "Sin datos"}
              </p>
            </div>
          </div>
        </div>

        {/* Panel de insights (1/3) */}
        <div className="glass-panel flex flex-col justify-between rounded-xl border-mawi-cyan/10 bg-gradient-to-br from-mawi-cyan/5 to-transparent p-6">
          <div className="space-y-1">
            <span className="material-symbols-outlined mb-4 block text-3xl text-mawi-cyan">
              architecture
            </span>
            <h4 className="font-space-grotesk text-lg font-medium text-mawi-on-bg">
              Insight de diseno
            </h4>
            <p className="text-xs leading-relaxed text-mawi-on-bg/60">
              {criticalCount > 0
                ? `${criticalCount} proyecto${criticalCount > 1 ? "s" : ""} superando el 90% del presupuesto. Se recomienda revisión de partidas y actualización de cronograma.`
                : "Todos los proyectos operan dentro de los parámetros esperados. Continúa monitoreando el flujo de gastos mensual."}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="group mt-4 w-full rounded-sm border border-white/10 py-3 text-center font-space-grotesk text-xs font-bold uppercase tracking-widest transition-all hover:bg-mawi-cyan hover:text-mawi-cyan-on"
          >
            Ver centro de control{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </section>

    </div>
  );
}
