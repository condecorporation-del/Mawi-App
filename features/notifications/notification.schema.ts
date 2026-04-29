import { z } from "zod";

const NOTIFICATION_STATUSES = ["read", "unread"] as const;

export const notificationListSchema = z.object({
  status: z.enum(NOTIFICATION_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(20).default(5),
});

export const notificationIdSchema = z.object({
  id: z.string().uuid(),
});

export type NotificationListInput = z.infer<typeof notificationListSchema>;
