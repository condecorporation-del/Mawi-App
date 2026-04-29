import "server-only";

import { prisma } from "@/lib/db/prisma";

type NotificationContext = { tenantId: string; userId: string };

export async function getUnreadNotificationCount(ctx: NotificationContext): Promise<number> {
  return prisma.notification.count({
    where: { tenantId: ctx.tenantId, userId: ctx.userId, readAt: null },
  });
}

export async function markAllNotificationsRead(ctx: NotificationContext): Promise<void> {
  await prisma.notification.updateMany({
    where: { tenantId: ctx.tenantId, userId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  });
}
