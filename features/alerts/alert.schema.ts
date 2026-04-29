import { AlertSeverity, AlertStatus, AlertType } from "@prisma/client";
import { z } from "zod";

export const alertListSchema = z.object({
  status: z.nativeEnum(AlertStatus).optional(),
  severity: z.nativeEnum(AlertSeverity).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const alertStatusUpdateSchema = z.object({
  alertId: z.string().uuid(),
  status: z.nativeEnum(AlertStatus).refine(
    (status) => status !== AlertStatus.open,
    "Solo se permite confirmar o resolver alertas desde esta accion.",
  ),
});

export const alertOutputSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(AlertType),
  severity: z.nativeEnum(AlertSeverity),
  status: z.nativeEnum(AlertStatus),
  title: z.string(),
  description: z.string(),
  triggeredAt: z.date(),
});

export type AlertListInput = z.infer<typeof alertListSchema>;
export type AlertStatusUpdateInput = z.infer<typeof alertStatusUpdateSchema>;
