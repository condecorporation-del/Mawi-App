"use client";

import { useRef, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProjectAction } from "@/app/(dashboard)/projects/actions";

type Project = {
  id: string;
  name: string;
  description: string | null;
  budgetCents: number;
  status: string;
};

export function EditProjectModal({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateProjectAction(project.id, formData);
        setOpen(false);
      } catch {
        setError("No se pudieron guardar los cambios. Intenta de nuevo.");
      }
    });
  }

  const budgetPesos = (project.budgetCents / 100).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <span className="material-symbols-outlined mr-2 text-base">edit</span>
          Editar proyecto
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar proyecto</DialogTitle>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              Nombre
            </label>
            <Input name="name" defaultValue={project.name} required minLength={2} maxLength={200} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              Presupuesto (MXN)
            </label>
            <Input
              name="budgetPesos"
              type="number"
              min="0"
              step="0.01"
              defaultValue={budgetPesos}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              Estado
            </label>
            <select
              name="status"
              defaultValue={project.status}
              className="w-full rounded-md border border-white/10 bg-surface-container px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-mawi-cyan"
            >
              <option value="planning">Planeación</option>
              <option value="active">Activo</option>
              <option value="on_hold">En pausa</option>
              <option value="completed">Completado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              Descripción
            </label>
            <textarea
              name="description"
              defaultValue={project.description ?? ""}
              maxLength={1000}
              rows={3}
              className="w-full rounded-md border border-white/10 bg-surface-container px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-mawi-cyan"
              placeholder="Descripción del proyecto (opcional)"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
