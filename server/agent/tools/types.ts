import type { ZodType } from "zod";
import type { Permission } from "@/lib/permissions/permissions";

export type ToolRiskLevel = "low" | "medium" | "high";

export type ToolExecutionContext = {
  tenantId: string;
  userId: string;
  conversationId: string;
  confirmationToken?: string;
};

type ToolExecuteFn<TInput, TOutput> = {
  bivarianceHack: (
    context: ToolExecutionContext,
    input: TInput,
  ) => Promise<TOutput> | TOutput;
}["bivarianceHack"];

export type ToolDefinition<TInput = unknown, TOutput = unknown> = {
  name: string;
  description: string;
  inputSchema: ZodType<TInput>;
  outputSchema: ZodType<TOutput>;
  riskLevel: ToolRiskLevel;
  requiredPermissions: Permission[];
  requiresConfirmation: boolean;
  auditEvent: string;
  version: string;
  execute: ToolExecuteFn<TInput, TOutput>;
};
