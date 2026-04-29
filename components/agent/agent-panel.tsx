"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AgentInput } from "./agent-input";
import { AgentMessage, type UIMessage } from "./agent-message";

type ConfirmationBannerProps = {
  token:     string;
  summary:   string;
  onConfirm: (token: string) => void;
  onDismiss: () => void;
};

function ConfirmationBanner({ token, summary, onConfirm, onDismiss }: ConfirmationBannerProps) {
  return (
    <div className="m-3 border border-error/30 bg-error-container/20 p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-error">
        Confirmación requerida
      </p>
      <p className="mb-3 text-xs text-on-surface">{summary}</p>
      <div className="flex gap-2">
        <button
          className="bg-primary-container px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-primary transition-all hover:bg-primary-fixed-dim"
          onClick={() => onConfirm(token)}
          type="button"
        >
          Confirmar
        </button>
        <button
          className="border border-white/10 px-3 py-1.5 text-[10px] text-on-surface-variant transition-colors hover:text-on-surface"
          onClick={onDismiss}
          type="button"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

type PendingConfirmation = { token: string; summary: string };
type PendingConfirmationApiResponse = {
  conversationId: string;
  pendingConfirmation: {
    confirmationToken: string;
    summary: string;
  } | null;
};

function makeUserMsg(text: string): UIMessage {
  return { id: crypto.randomUUID(), role: "user",      parts: [{ type: "text", text }] };
}
function makeAssistantMsg(id: string, text: string): UIMessage {
  return { id,                        role: "assistant", parts: [{ type: "text", text }] };
}

export function AgentPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef       = useRef<AbortController | null>(null);
  const audioRef       = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const speakText = useCallback(async (text: string) => {
    if (!text.trim() || isSpeaking) return;
    // Solo habla si el texto tiene contenido real (no solo números de herramientas)
    const cleanText = text.replace(/```[\s\S]*?```/g, "").trim();
    if (cleanText.length < 5) return;

    try {
      setIsSpeaking(true);
      const res = await fetch("/api/agent/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText.slice(0, 1000) }),
      });
      if (!res.ok) return;

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
      };
      audio.onerror = () => setIsSpeaking(false);
      void audio.play();
    } catch {
      setIsSpeaking(false);
    }
  }, [isSpeaking]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value);
  }

  function handleVoiceTranscript(text: string) {
    setInputValue(text);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue("");
    void sendUserMessage(text);
  }

  async function syncPendingConfirmation(targetConversationId: string) {
    const stateRes = await fetch(
      `/api/agent/chat?conversationId=${encodeURIComponent(targetConversationId)}`,
      { method: "GET" },
    );

    if (!stateRes.ok) {
      return;
    }

    const statePayload = (await stateRes.json()) as PendingConfirmationApiResponse;
    const pending = statePayload.pendingConfirmation;
    if (!pending) {
      setPendingConfirmation(null);
      return;
    }

    setPendingConfirmation({
      token: pending.confirmationToken,
      summary: pending.summary,
    });
  }

  async function sendUserMessage(text: string, confirmationToken?: string) {
    setMessages((prev) => [...prev, makeUserMsg(text)]);
    setIsLoading(true);
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, makeAssistantMsg(assistantId, "")]);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text, confirmationToken }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? makeAssistantMsg(
                  assistantId,
                  "No pude procesar la solicitud en este momento. Intenta de nuevo.",
                )
              : m,
          ),
        );
        return;
      }

      const newConvId = res.headers.get("X-Conversation-Id");
      const activeConversationId = newConvId ?? conversationId;
      if (newConvId && !conversationId) setConversationId(newConvId);

      if (!res.body) return;
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? makeAssistantMsg(assistantId, accumulated) : m),
        );
      }

      if (activeConversationId) {
        await syncPendingConfirmation(activeConversationId);
      }

      // Reproducir respuesta por voz cuando el stream termina
      if (accumulated.trim()) {
        void speakText(accumulated);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm(token: string) {
    setPendingConfirmation(null);
    await sendUserMessage("Confirmo la accion.", token);
  }

  return (
    <>
      {/* FAB toggle */}
      <button
        aria-label={isOpen ? "Cerrar agente" : "Abrir Mawi AI"}
        className="fixed bottom-8 right-24 z-50 flex h-14 w-14 items-center justify-center rounded-lg bg-primary-container text-on-primary shadow-[0_0_25px_rgba(0,245,255,0.5)] transition-all hover:scale-110 active:scale-90"
        onClick={() => setIsOpen((v) => !v)}
        type="button"
      >
        {isOpen ? (
          <span className="material-symbols-outlined text-2xl">close</span>
        ) : (
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          aria-label="Panel del agente Mawi AI"
          className="glass-panel fixed bottom-28 right-8 z-50 grid overflow-hidden border-primary-container/20 bg-surface-container-lowest/95 shadow-[0_0_45px_rgba(0,245,255,0.18)] lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]"
          role="dialog"
          style={{
            width: "min(920px, calc(100vw - 2rem))",
            height: "min(640px, calc(100dvh - 9rem))",
          }}
        >
          <section className="flex min-h-0 flex-col border-r border-white/5 bg-surface-container-lowest/30">
            <div className="flex items-center justify-between border-b border-primary-container/20 bg-primary-container/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 animate-pulse-cyan rounded-full bg-primary-container shadow-[0_0_8px_#00F5FF]" />
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface">Nucleo Mawi AI</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono-data text-[10px] text-primary-container/60">ENLACE_SEGURO: ACTIVO</span>
                {messages.length > 0 && (
                  <button
                    className="text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-on-surface"
                    onClick={() => { setMessages([]); setConversationId(undefined); setPendingConfirmation(null); }}
                    type="button"
                  >
                    Nuevo chat
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6 font-mono-data scrollbar-hide">
              {messages.length === 0 && (
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-primary-container/40 bg-primary-container/10">
                    <span
                      className="material-symbols-outlined text-xl text-primary-container"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      smart_toy
                    </span>
                  </div>
                  <div className="max-w-[85%] space-y-2">
                    <div className="font-label-caps text-[10px] text-primary-fixed-dim">NUCLEO MAWI AI • EN LINEA</div>
                    <p className="font-body-main text-lg leading-relaxed text-primary">
                      Sistemas listos. Estoy monitoreando flujo de caja, facturas, gastos y proyectos del tenant activo. Puedo analizar desviaciones, preparar reportes o revisar alertas.
                    </p>
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <AgentMessage key={m.id} message={m} />
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-[10px] italic text-on-surface-variant/50">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
                  <span>Mawi esta analizando datos del tenant</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {pendingConfirmation && (
              <ConfirmationBanner
                onConfirm={handleConfirm}
                onDismiss={() => setPendingConfirmation(null)}
                summary={pendingConfirmation.summary}
                token={pendingConfirmation.token}
              />
            )}

            {isSpeaking && (
              <div className="flex items-center gap-2 border-t border-white/5 px-4 py-2">
                <div className="flex gap-0.5">
                  {[0, 0.15, 0.3].map((delay) => (
                    <span
                      key={delay}
                      className="inline-block h-3 w-0.5 animate-bounce bg-primary-container"
                      style={{ animationDelay: `${delay}s` }}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-primary-container/70">Mawi está hablando...</span>
                <button
                  className="ml-auto text-[10px] text-on-surface-variant hover:text-on-surface"
                  onClick={() => { audioRef.current?.pause(); setIsSpeaking(false); }}
                  type="button"
                >
                  Detener
                </button>
              </div>
            )}
            <AgentInput
              input={inputValue}
              isLoading={isLoading}
              onInputChange={handleInputChange}
              onSubmit={handleSubmit}
              onVoiceTranscript={handleVoiceTranscript}
            />
          </section>

          <section className="relative hidden min-h-0 overflow-hidden bg-surface-container-lowest lg:flex lg:flex-col">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute left-1/4 top-1/4 h-2 w-2 animate-pulse-cyan rounded-full bg-primary-container" />
              <div className="absolute left-3/4 top-1/2 h-2 w-2 animate-pulse-cyan rounded-full bg-primary-container" />
              <div className="absolute left-1/3 top-3/4 h-2 w-2 animate-pulse-cyan rounded-full bg-tertiary-fixed-dim" />
              <svg className="h-full w-full stroke-primary-container/20" viewBox="0 0 400 600">
                <path d="M100 150 L300 300 L200 450" fill="none" strokeDasharray="4 2" strokeWidth="0.5" />
                <circle cx="100" cy="150" fill="#00F5FF" r="2" />
                <circle cx="300" cy="300" fill="#00F5FF" r="2" />
                <circle cx="200" cy="450" fill="#00F5FF" r="2" />
              </svg>
            </div>

            <div className="z-10 flex flex-1 flex-col items-center justify-center p-10">
              <div className="relative flex h-56 w-56 items-center justify-center">
                <div className="absolute inset-0 rotate-45 border border-primary-container/20 scale-110" />
                <div className="absolute inset-0 -rotate-12 border border-primary-container/10" />
                <div className="relative z-20 flex h-40 w-40 flex-col items-center justify-center gap-8">
                  <div className="flex gap-10">
                    <div className="h-1 w-12 animate-pulse bg-primary-container shadow-[0_0_20px_rgba(0,245,255,1)]" />
                    <div className="h-1 w-12 animate-pulse bg-primary-container shadow-[0_0_20px_rgba(0,245,255,1)]" />
                  </div>
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-px w-32 bg-gradient-to-r from-transparent via-primary-container/40 to-transparent" />
                    <div className="font-mono-data animate-pulse text-[10px] tracking-[0.35em] text-primary-container">
                      NUCLEO_NEURONAL
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 animate-[spin_20s_linear_infinite] rounded-full border border-white/5 scale-125" />
                <div className="absolute inset-0 animate-[spin_10s_linear_infinite] rounded-full border-t-2 border-primary-container/30 scale-110" />
              </div>

              <div className="mt-12 w-full max-w-sm space-y-5">
                <div className="flex items-end justify-between border-b border-white/10 pb-2">
                  <span className="font-label-caps text-[10px] text-on-surface-variant">Carga de nucleo CPU</span>
                  <span className="font-mono-data text-primary-container">42.8%</span>
                </div>
                <div className="flex items-end justify-between border-b border-white/10 pb-2">
                  <span className="font-label-caps text-[10px] text-on-surface-variant">Sinapsis neuronal</span>
                  <span className="font-mono-data text-tertiary-fixed-dim">ESTABLE</span>
                </div>
                <div className="flex items-end justify-between border-b border-white/10 pb-2">
                  <span className="font-label-caps text-[10px] text-on-surface-variant">Latencia de datos</span>
                  <span className="font-mono-data text-primary-container">14ms</span>
                </div>
              </div>
            </div>

            <div className="z-10 grid h-36 grid-cols-2 gap-6 border-t border-white/10 bg-black/40 p-6 backdrop-blur-md">
              <div className="space-y-3">
                <div className="font-label-caps text-[10px] text-on-surface-variant">Contexto</div>
                <div className="border border-white/10 bg-white/5 p-3">
                  <div className="font-mono-data text-xs text-on-surface">ALCANCE_TENANT</div>
                  <div className="text-sm font-bold text-primary-container">ACTIVO</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="font-label-caps text-[10px] text-on-surface-variant">Estado</div>
                <div className="flex items-center gap-3 p-3">
                  <div className="h-2 w-2 animate-pulse-cyan rounded-full bg-tertiary-fixed-dim" />
                  <span className="font-h3-technical text-sm text-tertiary-fixed-dim">OPTIMIZADO</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
