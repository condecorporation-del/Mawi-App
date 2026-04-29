import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { requireActiveTenant } from "@/lib/auth/tenant";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const DEEPGRAM_STT_URL =
  "https://api.deepgram.com/v1/listen?model=nova-2-general&language=es-419&punctuate=true&smart_format=true";

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const membership = await requireActiveTenant(session.user.id).catch(() => null);
  if (!membership) return NextResponse.json({ error: "Tenant no encontrado." }, { status: 403 });

  const rateLimit = checkRateLimit(`voice:${membership.tenantId}:${session.user.id}`, 30);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes de voz." }, { status: 429 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES) {
    return NextResponse.json({ error: "El audio es demasiado grande (máx. 10 MB)." }, { status: 413 });
  }

  const arrayBuffer = await req.arrayBuffer();
  if (arrayBuffer.byteLength < 100) {
    return NextResponse.json({ error: "Audio vacío. Intenta grabar de nuevo." }, { status: 400 });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Servicio de voz no configurado." }, { status: 503 });
  }

  const contentType = req.headers.get("content-type") ?? "audio/webm";

  try {
    const dgRes = await fetch(DEEPGRAM_STT_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": contentType,
      },
      body: arrayBuffer,
    });

    if (!dgRes.ok) {
      const err = await dgRes.text();
      console.error("[stt] deepgram error:", dgRes.status, err);
      return NextResponse.json({ error: "No pude transcribir el audio." }, { status: 502 });
    }

    const data = (await dgRes.json()) as {
      results?: {
        channels?: Array<{
          alternatives?: Array<{ transcript?: string; confidence?: number }>;
        }>;
      };
    };

    const alt = data.results?.channels?.[0]?.alternatives?.[0];
    const transcript = alt?.transcript?.trim() ?? "";
    const confidence = alt?.confidence ?? 0;

    if (!transcript) {
      return NextResponse.json(
        { error: "No entendí el audio. ¿Puedes repetirlo?" },
        { status: 422 },
      );
    }

    return NextResponse.json({
      transcript,
      confidence,
      ...(confidence < 0.4
        ? { warning: "Baja confianza — revisa el texto antes de enviar." }
        : {}),
    });
  } catch (err) {
    console.error("[stt] error:", err);
    return NextResponse.json(
      { error: "Error al conectar con el servicio de voz." },
      { status: 502 },
    );
  }
}
