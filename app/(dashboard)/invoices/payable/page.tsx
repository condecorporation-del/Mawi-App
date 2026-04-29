import { InvoiceType } from "@prisma/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportCsvButton } from "@/features/exports/export-button";
import { InvoiceFilters } from "@/features/invoices/invoice-filters";
import { PayableTable } from "@/features/invoices/payable-table";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { listInvoices } from "@/server/services/invoices.service";

type PayablePageProps = {
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

export default async function PayableInvoicesPage({
  searchParams,
}: PayablePageProps) {
  const context = await getTenantContext(getQueryValue(searchParams?.tenantId));
  const invoices = await listInvoices(context, {
    ...(searchParams ?? {}),
    type: InvoiceType.payable,
  });
  const { from, to } = currentMonthRange();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Facturas por pagar</CardTitle>
            <CardDescription>
              Filtra por estado, proveedor y vencimiento. La tabla muestra total,
              pagado y saldo.
            </CardDescription>
          </div>
          <ExportCsvButton from={from} to={to} type="payable_invoices" />
        </CardHeader>
        <CardContent className="space-y-4">
          <InvoiceFilters supplierIdName="supplierId" />
          <PayableTable invoices={invoices} />
        </CardContent>
      </Card>
    </div>
  );
}
