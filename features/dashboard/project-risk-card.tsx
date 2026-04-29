import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBasisPoints, formatCurrencyCents } from "@/features/dashboard/format";
import type { ProjectRisk } from "@/features/dashboard/kpi.schema";

type ProjectRiskCardProps = {
  risks: ProjectRisk[];
};

export function ProjectRiskCard({ risks }: ProjectRiskCardProps) {
  return (
    <Card className="glass-panel border-white/10 bg-transparent">
      <CardHeader>
        <CardTitle className="font-space-grotesk text-xl text-mawi-on-bg">Proyectos en riesgo</CardTitle>
        <CardDescription className="text-mawi-on-bg/60">
          Fase 3 compara presupuesto vs gasto real. No usa avance fisico hasta
          incorporar snapshots de avance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {risks.length === 0 ? (
          <div className="rounded-md border border-dashed border-white/20 p-6 text-sm text-mawi-on-bg/60">
            No hay proyectos con desviacion relevante.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead>Proyecto</TableHead>
                <TableHead>Presupuesto</TableHead>
                <TableHead>Gasto real</TableHead>
                <TableHead>Variacion</TableHead>
                <TableHead>Severidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {risks.map((risk) => (
                <TableRow key={risk.projectId} className="border-white/10 hover:bg-white/5">
                  <TableCell className="font-medium text-mawi-on-bg">{risk.projectName}</TableCell>
                  <TableCell className="text-mawi-on-bg/80">{formatCurrencyCents(risk.budgetCents)}</TableCell>
                  <TableCell className="text-mawi-on-bg/80">{formatCurrencyCents(risk.actualCents)}</TableCell>
                  <TableCell className="text-mawi-on-bg/80">
                    {formatCurrencyCents(risk.varianceCents)} (
                    {formatBasisPoints(risk.varianceBasisPoints)})
                  </TableCell>
                  <TableCell className="capitalize text-mawi-cyan">{risk.severity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
