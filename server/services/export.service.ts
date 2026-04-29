import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { ExportType } from "@/features/exports/export-query.schema";

type ExportResult = { csv: string; filename: string; rowCount: number };

export async function buildExportCsv(
  tenantId: string,
  type: ExportType,
  from: string,
  to: string,
): Promise<ExportResult> {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (type === "expenses") {
    const rows = await prisma.expense.findMany({
      where: {
        tenantId,
        deletedAt: null,
        expenseDate: { gte: fromDate, lte: toDate },
      },
      include: { project: true, supplier: true },
      orderBy: { expenseDate: "asc" },
    });

    const header = "id,fecha,proyecto,proveedor,descripcion,total_mxn,estatus,fuente";
    const lines = rows.map((r) =>
      [
        r.id,
        r.expenseDate.toISOString().split("T")[0],
        r.project.name,
        r.supplier?.name ?? "",
        `"${r.description.replace(/"/g, '""')}"`,
        (r.totalCents / 100).toFixed(2),
        r.status,
        r.source,
      ].join(","),
    );

    return {
      csv: [header, ...lines].join("\n"),
      filename: "gastos",
      rowCount: rows.length,
    };
  }

  if (type === "payable_invoices" || type === "receivable_invoices") {
    const invoiceType = type === "payable_invoices" ? "payable" : "receivable";
    const rows = await prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        type: invoiceType as "payable" | "receivable",
        issueDate: { gte: fromDate, lte: toDate },
      },
      include: { client: true, supplier: true, project: true },
      orderBy: { issueDate: "asc" },
    });

    const header = "id,numero,fecha_emision,fecha_vencimiento,cliente_proveedor,proyecto,total_mxn,estatus";
    const lines = rows.map((r) =>
      [
        r.id,
        r.number,
        r.issueDate.toISOString().split("T")[0],
        r.dueDate?.toISOString().split("T")[0] ?? "",
        r.client?.name ?? r.supplier?.name ?? "",
        r.project?.name ?? "",
        (r.totalCents / 100).toFixed(2),
        r.status,
      ].join(","),
    );

    return {
      csv: [header, ...lines].join("\n"),
      filename: invoiceType === "payable" ? "facturas-por-pagar" : "facturas-por-cobrar",
      rowCount: rows.length,
    };
  }

  return { csv: "", filename: "export", rowCount: 0 };
}
