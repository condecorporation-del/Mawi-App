import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportCsvButton } from "@/features/exports/export-button";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { formatCents } from "@/lib/money/format";
import { listExpenses } from "@/server/services/expenses.service";

type ExpensesPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function currentMonthRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const context = await getTenantContext(getQueryValue(searchParams?.tenantId));
  const expenses = await listExpenses(context, searchParams ?? {});
  const { from, to } = currentMonthRange();

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Gastos</CardTitle>
          <CardDescription>Gastos por proyecto registrados en el sistema.</CardDescription>
        </div>
        <ExportCsvButton from={from} to={to} type="expenses" />
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
            No hay gastos registrados.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{expense.expenseDate.toISOString().slice(0, 10)}</TableCell>
                  <TableCell>{expense.project.name}</TableCell>
                  <TableCell>{expense.supplier?.name ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{expense.description}</TableCell>
                  <TableCell>{expense.status}</TableCell>
                  <TableCell>{formatCents(expense.totalCents, expense.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
