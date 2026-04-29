import { InvoiceType } from "@prisma/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportCsvButton } from "@/features/exports/export-button";
import { InvoiceFilters } from "@/features/invoices/invoice-filters";
import { ReceivableTable } from "@/features/invoices/receivable-table";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { listInvoices } from "@/server/services/invoices.service";

type ReceivablePageProps = {
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

export default async function ReceivableInvoicesPage({
  searchParams,
}: ReceivablePageProps) {
  const context = await getTenantContext(getQueryValue(searchParams?.tenantId));
  const invoices = await listInvoices(context, {
    ...(searchParams ?? {}),
    type: InvoiceType.receivable,
  });
  const { from, to } = currentMonthRange();

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Facturas por cobrar</CardTitle>
          <CardDescription>
            Filtra por cliente, proyecto y vencimiento. Las vencidas se resaltan.
          </CardDescription>
        </div>
        <ExportCsvButton from={from} to={to} type="receivable_invoices" />
      </CardHeader>
      <CardContent className="space-y-4">
        <InvoiceFilters clientIdName="clientId" projectIdName="projectId" />
        <ReceivableTable invoices={invoices} />
      </CardContent>
    </Card>
  );
}
