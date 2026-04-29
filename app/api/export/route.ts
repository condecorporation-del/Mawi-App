import "server-only";

import { ActorType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { exportQuerySchema } from "@/features/exports/export-query.schema";
import { getCurrentSession } from "@/lib/auth/session";
import { requireActiveTenant } from "@/lib/auth/tenant";
import { createAuditLog } from "@/server/services/audit.service";
import { DomainError } from "@/lib/errors/domain-error";
import { assertPermission } from "@/lib/permissions/assert-permission";
import { buildExportCsv } from "@/server/services/export.service";

const TYPE_PERMISSION = {
  expenses: "expense.manage",
  payable_invoices: "invoice.manage",
  receivable_invoices: "invoice.manage",
} as const;

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const membership = await requireActiveTenant(session.user.id).catch(() => null);
    if (!membership) {
      return NextResponse.json({ error: "Tenant no encontrado." }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const rawQuery = {
      type: searchParams.get("type"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    };

    const parsed = exportQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos.", details: parsed.error.issues },
        { status: 422 },
      );
    }

    const { type, from, to } = parsed.data;

    await assertPermission(session.user.id, membership.tenantId, TYPE_PERMISSION[type]);

    const result = await buildExportCsv(membership.tenantId, type, from, to);

    await createAuditLog({
      tenantId: membership.tenantId,
      actorUserId: session.user.id,
      actorType: ActorType.user,
      entityType: "export",
      action: "export.csv",
      metadata: { type, from, to, rowCount: result.rowCount },
    });

    const filename = `constructai-${result.filename}-${from}-${to}.csv`;

    return new Response(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.publicMessage }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
