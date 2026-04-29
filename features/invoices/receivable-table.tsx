import type { InvoiceStatus } from "@prisma/client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCents } from "@/lib/money/format";

import { InvoiceStatusBadge } from "./invoice-status-badge";

type ReceivableInvoiceRow = {
  id: string;
  number: string;
  status: InvoiceStatus;
  totalCents: number;
  paidCents: number;
  currency: string;
  dueDate: Date | null;
  client: { name: string } | null;
  project: { name: string } | null;
};

export function ReceivableTable({
  invoices,
}: {
  invoices: ReceivableInvoiceRow[];
}) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        No hay facturas por cobrar con los filtros actuales.
      </div>
    );
  }

  const today = new Date();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Proyecto</TableHead>
          <TableHead>Factura</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Saldo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => {
          const isOverdue =
            invoice.dueDate !== null &&
            invoice.dueDate < today &&
            invoice.paidCents < invoice.totalCents;

          return (
            <TableRow key={invoice.id}>
              <TableCell>{invoice.client?.name ?? "Sin cliente"}</TableCell>
              <TableCell>{invoice.project?.name ?? "Sin proyecto"}</TableCell>
              <TableCell>{invoice.number}</TableCell>
              <TableCell>
                <InvoiceStatusBadge
                  status={invoice.status}
                  isOverdue={isOverdue}
                />
              </TableCell>
              <TableCell>{formatCents(invoice.totalCents, invoice.currency)}</TableCell>
              <TableCell>
                {formatCents(invoice.totalCents - invoice.paidCents, invoice.currency)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
