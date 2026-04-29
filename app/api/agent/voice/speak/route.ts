import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth/session";
import { requireActiveTenant } from "@/lib/auth/tenant";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

const DEEPGRAM_TTS_URL =
  "https://api.deepgram.com/v1/speak?model=aura-2-andromeda-es&encoding=mp3";

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const membership = await requireActiveTenant(session.user.id).catch(() => null);
  if (!membership) return NextResponse.json({ error: "Tenant no encontrado." }, { status: 403 });

  const rateLimit = checkRateLimit(`tts:${membership.tenantId}:${session.user.id}`, 30);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes de voz." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Texto inválido o vacío." }, { status: 422 });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Servicio de voz no configurado." }, { status: 503 });
  }

  try {
    const dgRes = await fetch(DEEPGRAM_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: parsed.data.text }),
    });

    if (!dgRes.ok) {
      const err = await dgRes.text();
      console.error("[tts] deepgram error:", dgRes.status, err);
      return NextResponse.json({ error: "No pude generar la respuesta de voz." }, { status: 502 });
    }

    const audioBuffer = await dgRes.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[tts] error:", err);
    return NextResponse.json(
      { error: "Error al conectar con el servicio de voz." },
      { status: 502 },
    );
  }
}
