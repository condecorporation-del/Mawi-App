import { z } from "zod";

export const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
});

export const appendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string().min(1).max(32_000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const listConversationsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(4_000),
  confirmationToken: z.string().uuid().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
