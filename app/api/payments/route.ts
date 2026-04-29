import { z } from "zod";

import { requireActiveTenant } from "@/lib/auth/tenant";
import { requireSession } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors/domain-error";
import { assertPermission } from "@/lib/permissions/assert-permission";
import { createPaymentSchema } from "@/features/payments/payment.schema";
import { registerPayment } from "@/server/services/payments.service";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const json: unknown = await request.json();
    const input = createPaymentSchema.parse(json);
    const membership = await requireActiveTenant(
      session.user.id,
      input.tenantId,
    );

    await assertPermission(session.user.id, membership.tenantId, "payment.create");

    const payment = await registerPayment(
      { tenantId: membership.tenantId, userId: session.user.id },
      input,
    );

    return Response.json({ payment }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Datos de pago invalidos." }, { status: 400 });
    }

    if (error instanceof DomainError) {
      return Response.json(
        { error: error.publicMessage },
        { status: error.statusCode },
      );
    }

    return Response.json(
      { error: "No pudimos registrar el pago." },
      { status: 500 },
    );
  }
}
