"use client";

type BudgetLine = {
  category: string;
  name: string;
  budgetCents: number;
  spentCents: number;
  varianceCents: number;
  variancePercent: number;
};

type Financials = {
  totalExpensesCents: number;
  approvedExpensesCents: number;
  pendingExpensesCents: number;
  totalInvoicedCents: number;
  totalPaidCents: number;
  overdueInvoicesCents: number;
  remainingBudgetCents: number;
  budgetUsedPercent: number;
};

type Project = {
  name: string;
  code: string;
  status: string;
  budgetCents: number;
  currency: string;
  clientName: string | null;
};

type Anomaly = { title: string; severity: string; description: string };

export type AiReportData = {
  project: Project;
  financials: Financials;
  budgetLines: BudgetLine[];
  anomalies: Anomaly[];
  analysis: string;
  generatedAt: string;
  periodStart: string | null;
  periodEnd: string | null;
};

type Props = { report: AiReportData };

function formatMXN(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-950/30 border-red-800/40",
  high: "text-orange-400 bg-orange-950/30 border-orange-800/40",
  medium: "text-yellow-400 bg-yellow-950/30 border-yellow-800/40",
  low: "text-blue-400 bg-blue-950/30 border-blue-800/40",
};

export function AiReportView({ report }: Props) {
  const { project, financials, budgetLines, anomalies, analysis, generatedAt } = report;
  const generatedDate = new Date(generatedAt).toLocaleString("es-MX");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{project.name}</h2>
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {project.code}
          </span>
        </div>
        {project.clientName && (
          <p className="text-sm text-muted-foreground">Cliente: {project.clientName}</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Reporte generado el {generatedDate}
          {report.periodStart && report.periodEnd && (
            <> · Periodo: {report.periodStart} – {report.periodEnd}</>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Presupuesto", value: formatMXN(project.budgetCents) },
          { label: "Gasto aprobado", value: formatMXN(financials.approvedExpensesCents) },
          { label: "Saldo restante", value: formatMXN(financials.remainingBudgetCents) },
          { label: "% Consumido", value: `${financials.budgetUsedPercent}%` },
        ].map(({ label, value }) => (
          <div className="rounded-lg border border-border bg-card p-4" key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-base font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {budgetLines.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Partidas presupuestales</h3>
          <div className="space-y-2">
            {budgetLines.map((bl) => {
              const overBudget = bl.varianceCents < 0;
              return (
                <div className="flex items-center justify-between text-sm" key={bl.name}>
                  <span className="text-muted-foreground">{bl.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono">{formatMXN(bl.spentCents)}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        overBudget ? "bg-red-950/40 text-red-400" : "bg-green-950/40 text-green-400"
                      }`}
                    >
                      {overBudget ? "+" : ""}{Math.abs(bl.variancePercent)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {anomalies.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Anomalías detectadas</h3>
          <div className="space-y-2">
            {anomalies.map((a) => (
              <div
                className={`rounded-lg border p-3 text-sm ${SEVERITY_COLORS[a.severity] ?? SEVERITY_COLORS.low}`}
                key={a.title}
              >
                <p className="font-medium">{a.title}</p>
                <p className="mt-1 opacity-80">{a.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Análisis ejecutivo</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{analysis}</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Esta información es orientativa. Valida con tu contador o administrador financiero.
      </p>
    </div>
  );
}
