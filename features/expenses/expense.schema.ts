import { ExpenseSource, ExpenseStatus } from "@prisma/client";
import { z } from "zod";

export const expenseListSchema = z.object({
  status: z.nativeEnum(ExpenseStatus).optional(),
  projectId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const createExpenseSchema = z.object({
  projectId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  budgetLineId: z.string().uuid().optional(),
  description: z.string().trim().min(3).max(500),
  totalCents: z.number().int().positive(),
  expenseDate: z.string().datetime(),
  status: z.nativeEnum(ExpenseStatus).default(ExpenseStatus.pending_review),
  source: z.nativeEnum(ExpenseSource).default(ExpenseSource.manual),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
