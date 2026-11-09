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

  useEffect(() => {
    let ativo = true;
    api
      .taxas()
      .then((t) => ativo && (setTaxas(t), setErro(null)))
      .catch((e) => ativo && setErro(e.message));
    return () => {
      ativo = false;
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
