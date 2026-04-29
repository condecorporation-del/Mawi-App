import { ProjectStatus } from "@prisma/client";
import { z } from "zod";

const centsSchema = z.number().int().nonnegative();

export const projectIdSchema = z.object({
  id: z.string().uuid(),
});

export const projectListSchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const createProjectSchema = z.object({
  clientId: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).optional(),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.planning),
  budgetCents: centsSchema.default(0),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
