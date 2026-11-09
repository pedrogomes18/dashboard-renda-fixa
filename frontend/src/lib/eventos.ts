"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL, type Execucao } from "./api";

export type EstadoConexao = "conectando" | "ao-vivo" | "offline";

/**
 * Mantém uma conexão SSE com a API (GET /eventos).
 *
 * O EventSource do navegador já reconecta sozinho quando a conexão cai
 * (o servidor manda `retry: 5000`), então aqui só traduzimos os eventos em estado.
 */
export function useEventos(aoAtualizar: (execucao: Execucao) => void) {
  const [estado, setEstado] = useState<EstadoConexao>("conectando");
  const [conectados, setConectados] = useState<number | null>(null);
  const [ultimaExecucao, setUltimaExecucao] = useState<Execucao | null>(null);

  // Guarda o callback mais recente sem precisar reabrir a conexão.
  const callback = useRef(aoAtualizar);
  useEffect(() => {
    callback.current = aoAtualizar;
  });

  useEffect(() => {
    const es = new EventSource(`${API_URL}/eventos`);
    const ler = (e: Event) => JSON.parse((e as MessageEvent<string>).data);

    es.onopen = () => setEstado("ao-vivo");
    es.onerror = () => setEstado(es.readyState === EventSource.CLOSED ? "offline" : "conectando");

    es.addEventListener("status", (e) => {
      const dados = ler(e);
      setUltimaExecucao(dados.ultima_execucao);
      setConectados(dados.conectados);
    });
    es.addEventListener("presenca", (e) => setConectados(ler(e).conectados));
    es.addEventListener("atualizacao", (e) => {
      const execucao: Execucao = ler(e);
      setUltimaExecucao(execucao);
      callback.current(execucao);
    });

    return () => es.close();
  }, []);

  return { estado, conectados, ultimaExecucao };
}
