import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { runAgentStream } from "@/server/agent/agent-runtime";
import {
  appendMessage,
  getConversationMessages,
  getLatestPendingToolConfirmation,
  markToolConfirmationAsUsed,
} from "@/server/agent/conversation.service";

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const DEEPGRAM_STT_URL =
  "https://api.deepgram.com/v1/listen?model=nova-2-general&language=es-419&punctuate=true&smart_format=true";

// ── Telegram types ────────────────────────────────────────────────────────────
interface TelegramUser {
  id: number;
  first_name?: string;
}
interface TelegramVoice {
  file_id: string;
  duration: number;
  mime_type?: string;
}
interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number };
  text?: string;
  voice?: TelegramVoice;
}
interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function sendTelegramMessage(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

async function getOwnerContext() {
  const membership = await prisma.membership.findFirst({
    where: { role: "owner", isActive: true },
    include: { tenant: { select: { id: true, name: true } } },
  });
  if (!membership) return null;
  return {
    tenantId: membership.tenantId,
    userId: membership.userId,
    tenantName: membership.tenant.name,
  };
}

async function findOrCreateTgConversation(tenantId: string, userId: string, chatId: number) {
  const title = `tg:${chatId}`;

  const existing = await prisma.conversation.findFirst({
    where: { tenantId, title },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: { tenantId, userId, title },
  });
}

async function downloadVoiceAsBuffer(fileId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  // Step 1: resolve file path
  const fileRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
  if (!fileRes.ok) return null;
  const fileData = (await fileRes.json()) as { ok: boolean; result?: { file_path?: string } };
  const filePath = fileData.result?.file_path;
  if (!filePath) return null;

  // Step 2: download the actual OGG/OGA file
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const audioRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!audioRes.ok) return null;

  const arrayBuffer = await audioRes.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: "audio/ogg" };
}

async function transcribeBuffer(buffer: Buffer, mimeType: string): Promise<string | null> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return null;

  const dgRes = await fetch(DEEPGRAM_STT_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": mimeType,
    },
    body: new Uint8Array(buffer),
  });

  if (!dgRes.ok) return null;

  const data = (await dgRes.json()) as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> };
  };

  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? null;
}

const CONFIRM_PATTERN = /\b(sí|si|confirmo|confirm|yes|dale|procede|acepto|ok)\b/i;

async function handleTextMessage(
  ctx: { tenantId: string; userId: string; conversationId: string },
  tenantName: string,
  chatId: number,
  text: string,
) {
  // Check if this is a confirmation reply
  const isConfirmation = CONFIRM_PATTERN.test(text);
  let confirmationToken: string | undefined;

  if (isConfirmation) {
    const pending = await getLatestPendingToolConfirmation(ctx);
    if (pending) {
      confirmationToken = pending.confirmationToken;
      await markToolConfirmationAsUsed(ctx, confirmationToken);
    }
  }

  // Save user message
  await appendMessage(ctx, {
    conversationId: ctx.conversationId,
    role: "user",
    content: text,
  });

  // Build message history (last 30)
  const history = await getConversationMessages(ctx, ctx.conversationId, 30);
  const agentMessages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Run agent
  const stream = await runAgentStream({
    ctx: { ...ctx, confirmationToken },
    tenantName,
    messages: agentMessages,
  });

  const fullText = await stream.text;

  // Save assistant reply
  await appendMessage(ctx, {
    conversationId: ctx.conversationId,
    role: "assistant",
    content: fullText,
  });

  await sendTelegramMessage(chatId, fullText);
}

// ── main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Validate Telegram secret token
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const message = update.message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;

  // Find owner context
  const owner = await getOwnerContext();
  if (!owner) {
    console.error("[telegram] No owner membership found");
    await sendTelegramMessage(chatId, "El sistema no está configurado todavía. Intenta más tarde.");
    return NextResponse.json({ ok: true });
  }

  const conversation = await findOrCreateTgConversation(owner.tenantId, owner.userId, chatId);
  const ctx = {
    tenantId: owner.tenantId,
    userId: owner.userId,
    conversationId: conversation.id,
  };

  try {
    // ── text message ──────────────────────────────────────────────────────────
    if (message.text) {
      await handleTextMessage(ctx, owner.tenantName, chatId, message.text);
      return NextResponse.json({ ok: true });
    }

    // ── voice message ─────────────────────────────────────────────────────────
    if (message.voice) {
      await sendTelegramMessage(chatId, "🎙️ Transcribiendo tu mensaje de voz...");

      const audio = await downloadVoiceAsBuffer(message.voice.file_id);
      if (!audio) {
        await sendTelegramMessage(chatId, "No pude descargar el audio. Intenta de nuevo.");
        return NextResponse.json({ ok: true });
      }

      const transcript = await transcribeBuffer(audio.buffer, audio.mimeType);
      if (!transcript) {
        await sendTelegramMessage(chatId, "No entendí el audio. ¿Puedes repetirlo o escribirlo?");
        return NextResponse.json({ ok: true });
      }

      await sendTelegramMessage(chatId, `_Transcripción: "${transcript}"_`);
      await handleTextMessage(ctx, owner.tenantName, chatId, transcript);
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("[telegram] handler error:", err);
    await sendTelegramMessage(chatId, "Ocurrió un error. Intenta de nuevo en un momento.");
  }

  return NextResponse.json({ ok: true });
}
