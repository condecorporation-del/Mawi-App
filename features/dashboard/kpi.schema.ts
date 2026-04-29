import { AlertSeverity, AlertStatus } from "@prisma/client";
import { z } from "zod";

export const dashboardPeriodSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const moneyKpiSchema = z.object({
  label: z.string(),
  amountCents: z.number().int(),
});

export const monthlyFinancialPointSchema = z.object({
  month: z.string(),
  incomeCents: z.number().int().nonnegative(),
  expenseCents: z.number().int().nonnegative(),
  profitCents: z.number().int(),
});

export const projectRiskSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string(),
  budgetCents: z.number().int().nonnegative(),
  actualCents: z.number().int().nonnegative(),
  varianceCents: z.number().int(),
  varianceBasisPoints: z.number().int(),
  severity: z.nativeEnum(AlertSeverity),
});

export const dashboardAlertSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  severity: z.nativeEnum(AlertSeverity),
  status: z.nativeEnum(AlertStatus),
  triggeredAt: z.string().datetime(),
});

export const dashboardKpisSchema = z.object({
  period: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    timezone: z.string(),
  }),
  incomeCents: z.number().int().nonnegative(),
  expenseCents: z.number().int().nonnegative(),
  profitCents: z.number().int(),
  upcomingCashFlowCents: z.number().int(),
  overduePayableCents: z.number().int().nonnegative(),
  overdueReceivableCents: z.number().int().nonnegative(),
  openAlertsCount: z.number().int().nonnegative(),
  chart: z.array(monthlyFinancialPointSchema),
  projectRisks: z.array(projectRiskSchema),
  alerts: z.array(dashboardAlertSummarySchema),
});

export type DashboardKpis = z.infer<typeof dashboardKpisSchema>;
export type MonthlyFinancialPoint = z.infer<typeof monthlyFinancialPointSchema>;
export type ProjectRisk = z.infer<typeof projectRiskSchema>;
