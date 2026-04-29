"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/session";
import { requireActiveTenant } from "@/lib/auth/tenant";
import { markAllNotificationsRead } from "@/server/services/notifications.service";

export async function markAllNotificationsReadAction() {
  const session = await requireSession();
  const membership = await requireActiveTenant(session.user.id);

  await markAllNotificationsRead({
    tenantId: membership.tenantId,
    userId: session.user.id,
  });
  revalidatePath("/dashboard");
}
