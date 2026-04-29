"use client";

import { useRef, useState, useCallback } from "react";

type Props = {
  input:            string;
  isLoading:        boolean;
  onInputChange:    (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit:         (e: React.FormEvent<HTMLFormElement>) => void;
  onVoiceTranscript?: (text: string) => void;
};

type RecordingState = "idle" | "recording" | "transcribing" | "error";

const QUICK_PROMPTS = [
  "Lista mis proyectos",
  "Facturas vencidas",
  "Generar reporte",
  "Resumen del mes",
];

export function AgentInput({ input, isLoading, onInputChange, onSubmit, onVoiceTranscript }: Props) {
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const mediaRecRef    = useRef<MediaRecorder | null>(null);
  const chunksRef      = useRef<Blob[]>([]);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [voiceError, setVoiceError]         = useState<string | null>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = textareaRef.current?.closest("form");
      if (form && input.trim() && !isLoading) form.requestSubmit();
    }
  }

  const stopRecording = useCallback(() => {
    mediaRecRef.current?.stop();
  }, []);

  const startRecording = useCallback(async () => {
    setVoiceError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceError("Micrófono bloqueado. Permite el acceso en la barra del navegador.");
      setRecordingState("error");
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecRef.current = recorder;
    chunksRef.current   = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecordingState("transcribing");

      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (blob.size < 1000) {
        setVoiceError("Audio muy corto. Mantén presionado y habla.");
        setRecordingState("error");
        return;
      }

      try {
        const res = await fetch("/api/agent/voice/transcribe", {
          method: "POST",
          headers: { "Content-Type": mimeType },
          body: blob,
        });

        const data = (await res.json()) as { transcript?: string; warning?: string; error?: string };

        if (!res.ok || !data.transcript) {
          setVoiceError(data.error ?? "No entendí el audio. Intenta de nuevo.");
          setRecordingState("error");
          return;
        }

        onVoiceTranscript?.(data.transcript);
        if (data.warning) setVoiceError(data.warning);
        else setVoiceError(null);
        setRecordingState("idle");
      } catch {
        setVoiceError("Error de conexión. Intenta de nuevo.");
        setRecordingState("error");
      }
    };

    recorder.start();
    setRecordingState("recording");
  }, [onVoiceTranscript]);

  function handleMicClick() {
    if (recordingState === "recording") {
      stopRecording();
    } else if (recordingState === "idle" || recordingState === "error") {
      void startRecording();
    }
  }

  const micIcon =
    recordingState === "recording"    ? "stop_circle" :
    recordingState === "transcribing" ? "hourglass_top" :
    "mic";

  const micColor =
    recordingState === "recording"    ? "text-red-400 animate-pulse" :
    recordingState === "transcribing" ? "text-yellow-400" :
    "text-on-surface-variant hover:text-primary-container";

  return (
    <form className="border-t border-white/5 p-4" onSubmit={onSubmit}>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {QUICK_PROMPTS.map((label) => (
          <button
            className="whitespace-nowrap border border-white/10 bg-white/5 px-3 py-1.5 font-label-caps text-[10px] text-on-surface-variant transition-colors hover:border-primary-container hover:text-primary-container"
            disabled={isLoading}
            key={label}
            onClick={() => onInputChange({ target: { value: label } } as React.ChangeEvent<HTMLTextAreaElement>)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {voiceError && (
        <p className="mb-2 text-[10px] text-red-400">{voiceError}</p>
      )}

      <div className="relative">
        <textarea
          aria-label="Mensaje al agente"
          className="w-full resize-none border-b-2 border-white/10 bg-surface-container-low px-4 py-3 pr-20 text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-all duration-300 focus:border-primary-container disabled:opacity-50"
          disabled={isLoading}
          onChange={onInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Escribe o usa el micrófono..."
          ref={textareaRef}
          rows={2}
          value={input}
        />
        <div className="absolute bottom-3 right-3 flex gap-3">
          <button
            aria-label={recordingState === "recording" ? "Detener grabación" : "Grabar mensaje de voz"}
            className={`material-symbols-outlined transition-colors disabled:opacity-30 ${micColor}`}
            disabled={isLoading || recordingState === "transcribing"}
            onClick={handleMicClick}
            type="button"
          >
            {micIcon}
          </button>
          <button
            aria-label="Enviar mensaje"
            className="material-symbols-outlined text-on-surface-variant transition-colors hover:text-primary-container disabled:opacity-30"
            disabled={isLoading || !input.trim()}
            type="submit"
          >
            {isLoading ? "pending" : "send"}
          </button>
        </div>
      </div>
    </form>
  );
}
