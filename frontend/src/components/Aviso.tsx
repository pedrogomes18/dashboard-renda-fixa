"use client";

import { useEffect } from "react";

/** Notificação flutuante que some sozinha. */
export function Aviso({ texto, aoFechar }: { texto: string | null; aoFechar: () => void }) {
  useEffect(() => {
    if (!texto) return;
    const t = setTimeout(aoFechar, 6000);
    return () => clearTimeout(t);
  }, [texto, aoFechar]);

  if (!texto) return null;
  return (
    <div role="status" className="entrar fixed bottom-4 left-1/2 z-30 -translate-x-1/2 px-4">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-lg">
        <span className="pulso inline-block h-2 w-2 shrink-0 rounded-full bg-pos" />
        <span>{texto}</span>
        <button type="button" onClick={aoFechar} className="ml-2 text-muted hover:text-primary" aria-label="Fechar aviso">
          ✕
        </button>
      </div>
    </div>
  );
}
