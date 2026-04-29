import Link from "next/link";
import { notFound } from "next/navigation";

import { getTenantContext } from "@/lib/auth/tenant-context";
import { formatCents } from "@/lib/money/format";
import { getProjectById } from "@/server/services/projects.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditProjectModal } from "@/components/projects/edit-project-modal";

type ProjectDetailPageProps = {
  params: { id: string };
  searchParams?: { error?: string };
};

const STATUS_LABELS: Record<string, string> = {
  planning: "Planeación",
  active: "Activo",
  on_hold: "En pausa",
  completed: "Completado",
  cancelled: "Cancelado",
};

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const ctx = await getTenantContext();
  const project = await getProjectById(ctx, params.id);

  if (!project) notFound();

  return (
    <div className="space-y-8">
      {searchParams?.error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {decodeURIComponent(searchParams.error)}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-space-grotesk text-[10px] uppercase tracking-widest text-mawi-cyan/70">
            {project.code}
          </p>
          <h1 className="font-space-grotesk text-3xl font-semibold text-mawi-on-bg">
            {project.name}
          </h1>
          {project.client && (
            <p className="mt-1 text-sm text-on-surface-variant">Cliente: {project.client.name}</p>
          )}
          {project.description && (
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">{project.description}</p>
          )}
          <p className="mt-2 text-xs uppercase tracking-wider text-on-surface-variant">
            Estado: {STATUS_LABELS[project.status] ?? project.status}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <EditProjectModal
            project={{
              id: project.id,
              name: project.name,
              description: project.description,
              budgetCents: project.budgetCents,
              status: project.status,
            }}
          />
          <Button asChild variant="outline" size="sm">
            <Link href="/projects">Volver</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Presupuesto</CardDescription>
            <CardTitle className="text-xl">{formatCents(project.budgetCents)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gastado</CardDescription>
            <CardTitle className="text-xl">{formatCents(project.spentCents)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Por cobrar</CardDescription>
            <CardTitle className="text-xl">{formatCents(project.receivableCents)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Por pagar</CardDescription>
            <CardTitle className="text-xl">{formatCents(project.payableCents)}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Utilidad bruta aproximada</CardTitle>
          <CardDescription>
            Ingresos registrados menos gastos ejecutados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-mono-data text-2xl font-semibold text-primary-container">
            {formatCents(project.grossMarginCents)}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary" size="sm">
          <Link href="/expenses">Ver gastos</Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/invoices/receivable">Facturas por cobrar</Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/invoices/payable">Facturas por pagar</Link>
        </Button>
      </div>
    </div>
  );
}
