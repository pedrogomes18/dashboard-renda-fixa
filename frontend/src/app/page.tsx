"use client";

import { useCallback, useEffect, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Cabecalho } from "@/components/Cabecalho";
import { Cards, CardsEsqueleto } from "@/components/Cards";
import { Comparador } from "@/components/Comparador";
import { CurvaJuros } from "@/components/CurvaJuros";
import { Indicadores } from "@/components/Indicadores";
import { IpcaMensal } from "@/components/IpcaMensal";
import { Rodape } from "@/components/Rodape";
import { Simulador } from "@/components/Simulador";
import { TabelaTitulos } from "@/components/TabelaTitulos";
import { Esqueleto, Estado } from "@/components/ui";
import { api, API_URL, fmtDataHora, type Taxas } from "@/lib/api";
import { useEventos } from "@/lib/eventos";

const MAX_TENTATIVAS = 15; // 15 × 5 s ≈ 75 s

export default function Home() {
  const [taxas, setTaxas] = useState<Taxas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Incrementado quando o SSE avisa que a ETL terminou: cada seção recarrega seus dados.
  const [versao, setVersao] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  const { estado, conectados, ultimaExecucao } = useEventos(
    useCallback(() => {
      setVersao((v) => v + 1);
      setAviso("Chegaram dados novos. O painel foi atualizado.");
    }, []),
  );

  // No plano gratuito do Render a API hiberna e leva até ~1 min para acordar:
  // em vez de mostrar erro logo, tentamos de novo algumas vezes.
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let ativo = true;
    let espera: ReturnType<typeof setTimeout>;
    const carregar = (n: number) => {
      api
        .taxas()
        .then((t) => ativo && (setTaxas(t), setErro(null), setTentativa(0)))
        .catch((e) => {
          if (!ativo) return;
          if (n < MAX_TENTATIVAS) {
            setTentativa(n + 1);
            espera = setTimeout(() => carregar(n + 1), 5000);
          } else {
            setErro(e.message);
          }
        });
    };
    carregar(0);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [versao]);

  const atualizadoEm = ultimaExecucao?.concluido_em ?? taxas?.atualizado_em;
  const fecharAviso = useCallback(() => setAviso(null), []);

  return (
    <>
      <Cabecalho estado={estado} conectados={conectados} />

      <main className="mx-auto w-full max-w-6xl space-y-4 px-4 pb-12 pt-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Renda fixa no Brasil, hoje</h1>
            <p className="mt-2 max-w-2xl text-secondary">
              Selic, CDI, inflação e as taxas de todos os títulos do Tesouro Direto, coletados todo dia direto das fontes
              oficiais.
            </p>
          </div>
          {atualizadoEm && <p className="text-sm text-muted">Última coleta: {fmtDataHora(atualizadoEm)}</p>}
        </div>

        {erro ? (
          <Estado>
            Não consegui falar com a API em {API_URL} ({erro}). O backend está rodando?
          </Estado>
        ) : !taxas ? (
          <>
            {tentativa > 0 && (
              <p className="entrar rounded-xl border border-line bg-surface px-4 py-3 text-sm text-secondary">
                Acordando o servidor… a API fica em plano gratuito e hiberna quando ninguém usa. Isso leva até 1
                minuto (tentativa {tentativa} de {MAX_TENTATIVAS}).
              </p>
            )}
            <CardsEsqueleto />
            <Esqueleto className="h-96 rounded-2xl" />
          </>
        ) : (
          <>
            <Cards taxas={taxas} versao={versao} />
            <Indicadores versao={versao} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CurvaJuros titulos={taxas.titulos} />
              <IpcaMensal versao={versao} />
            </div>
            <Simulador versao={versao} />
            {taxas.titulos.length > 1 && <Comparador titulos={taxas.titulos} versao={versao} />}
            <TabelaTitulos titulos={taxas.titulos} />
          </>
        )}
      </main>

      <Rodape />
      <Aviso texto={aviso} aoFechar={fecharAviso} />
    </>
  );
}
