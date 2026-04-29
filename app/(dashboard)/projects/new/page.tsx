import Link from "next/link";

import { getTenantContext } from "@/lib/auth/tenant-context";
import { assertPermission } from "@/lib/permissions/assert-permission";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { createProjectAction } from "../actions";

type NewProjectPageProps = {
  searchParams?: { error?: string };
};

export default async function NewProjectPage({ searchParams }: NewProjectPageProps) {
  const ctx = await getTenantContext();
  await assertPermission(ctx.userId, ctx.tenantId, "project.manage");

  const error = searchParams?.error;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-space-grotesk text-2xl font-semibold text-mawi-on-bg">
          Nuevo proyecto
        </h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/projects">Volver</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del proyecto</CardTitle>
          <CardDescription>
            Codigo unico por cuenta. Presupuesto en pesos mexicanos (MXN).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div
              className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <form action={createProjectAction} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="code">
                Codigo
              </label>
              <Input id="code" name="code" required maxLength={40} placeholder="ej. RES-NORTE-01" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="name">
                Nombre
              </label>
              <Input id="name" name="name" required maxLength={200} placeholder="Nombre del proyecto" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="description">
                Descripcion (opcional)
              </label>
              <Input id="description" name="description" maxLength={2000} placeholder="Notas breves" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="budgetPesos">
                Presupuesto (MXN)
              </label>
              <Input
                id="budgetPesos"
                name="budgetPesos"
                type="number"
                min={0}
                step={0.01}
                defaultValue={0}
                required
              />
            </div>
            <Button className="w-full" type="submit">
              Crear proyecto
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
