import type { InvoiceStatus } from "@prisma/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents } from "@/lib/money/format";

import { InvoiceStatusBadge } from "./invoice-status-badge";

type PayableInvoiceRow = {
  id: string;
  number: string;
  status: InvoiceStatus;
  totalCents: number;
  paidCents: number;
  currency: string;
  dueDate: Date | null;
  supplier: { name: string } | null;
};

export function PayableTable({ invoices }: { invoices: PayableInvoiceRow[] }) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        No hay facturas por pagar con los filtros actuales.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Proveedor</TableHead>
          <TableHead>Factura</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Pagado</TableHead>
          <TableHead>Saldo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell>{invoice.supplier?.name ?? "Sin proveedor"}</TableCell>
            <TableCell>{invoice.number}</TableCell>
            <TableCell>
              <InvoiceStatusBadge status={invoice.status} />
            </TableCell>
            <TableCell>{formatCents(invoice.totalCents, invoice.currency)}</TableCell>
            <TableCell>{formatCents(invoice.paidCents, invoice.currency)}</TableCell>
            <TableCell>
              {formatCents(invoice.totalCents - invoice.paidCents, invoice.currency)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
