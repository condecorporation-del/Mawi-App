"use client";

import type { UIMessage } from "ai";

type Props = { message: UIMessage };

export function AgentMessage({ message }: Props) {
  const isUser = message.role === "user";

  const text = message.parts
    .filter((p): p is Extract<(typeof message.parts)[number], { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");

  if (isUser) {
    return (
      <div className="flex flex-col gap-1 text-right">
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          USUARIO
        </span>
        <p className="ml-auto max-w-[85%] border border-white/5 bg-white/5 p-3 text-xs leading-relaxed text-on-surface">
          {text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-primary-container/60">
        MOTOR_NUCLEO_MAWI
      </span>
      <p className="max-w-[92%] whitespace-pre-wrap border-l-2 border-primary-container bg-white/5 p-3 text-xs leading-relaxed text-on-surface">
        {text || (
          <span className="italic text-on-surface-variant">Procesando...</span>
        )}
      </p>
    </div>
  );
}
