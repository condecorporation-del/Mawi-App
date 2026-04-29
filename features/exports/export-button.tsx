"use client";

import { useState } from "react";

import type { ExportType } from "./export-query.schema";

type Props = {
  type: ExportType;
  from: string;
  to: string;
  label?: string;
};

export function ExportCsvButton({ type, from, to, label = "Exportar CSV" }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleClick() {
    setStatus("loading");
    setErrorMsg(null);

    try {
      const params = new URLSearchParams({ type, from, to });
      const res = await fetch(`/api/export?${params.toString()}`);

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setErrorMsg(body?.error ?? `Error ${res.status}`);
        setStatus("error");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `constructai-${type}-${from}-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("idle");
    } catch {
      setErrorMsg("Error de red al exportar.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        disabled={status === "loading"}
        onClick={handleClick}
        type="button"
      >
        {status === "loading" ? "Exportando…" : label}
      </button>
      {status === "error" && errorMsg && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}
    </div>
  );
}
