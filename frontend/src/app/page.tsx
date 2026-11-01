"use client";

import { useEffect, useState } from "react";
import { Cards } from "@/components/Cards";
import { Comparador } from "@/components/Comparador";
import { Indicadores } from "@/components/Indicadores";
import { TabelaTitulos } from "@/components/TabelaTitulos";
import { Estado } from "@/components/ui";
import { api, API_URL, type Taxas } from "@/lib/api";

export default function Home() {
  const [taxas, setTaxas] = useState<Taxas | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.taxas().then(setTaxas).catch((e) => setErro(e.message));
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-8">
      <header className="mb-2">
        <h1 className="text-2xl font-semibold">Monitor de Renda Fixa</h1>
        <p className="text-sm text-secondary">
          Dados públicos do Banco Central e do Tesouro Direto, atualizados todo dia.
        </p>
      </header>

      {erro ? (
        <Estado>
          Não consegui falar com a API em {API_URL} ({erro}). O backend está rodando?
        </Estado>
      ) : !taxas ? (
        <Estado>Carregando…</Estado>
      ) : (
        <>
          <Cards taxas={taxas} />
          <Indicadores />
          {taxas.titulos.length > 1 && <Comparador titulos={taxas.titulos} />}
          <TabelaTitulos titulos={taxas.titulos} />
        </>
      )}
    </main>
  );
}
