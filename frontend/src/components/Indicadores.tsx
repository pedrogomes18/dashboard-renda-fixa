"use client";

import { useEffect, useState } from "react";
import { api, desdeDoPeriodo, type PeriodoId } from "@/lib/api";
import { GraficoLinhas } from "./GraficoLinhas";
import { Estado, Painel, SeletorPeriodo } from "./ui";

const SERIES = [
  { chave: "selic", nome: "Selic (meta)", cor: "var(--series-1)" },
  { chave: "cdi", nome: "CDI", cor: "var(--series-2)" },
];

type Linha = { data: string; selic: number | null; cdi: number | null };

export function Indicadores() {
  const [periodo, setPeriodo] = useState<PeriodoId>("1a");
  const [dados, setDados] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const desde = desdeDoPeriodo(periodo);
    Promise.all([api.indicador("selic", desde), api.indicador("cdi", desde)])
      .then(([selic, cdi]) => {
        // A Selic tem um ponto por dia corrido e o CDI por dia útil; juntamos pela data.
        const porData = new Map<string, Linha>();
        for (const p of selic) porData.set(p.data, { data: p.data, selic: p.valor, cdi: null });
        for (const p of cdi) {
          const linha = porData.get(p.data) ?? { data: p.data, selic: null, cdi: null };
          linha.cdi = p.valor;
          porData.set(p.data, linha);
        }
        setDados([...porData.values()].sort((a, b) => a.data.localeCompare(b.data)));
        setErro(null);
      })
      .catch((e) => setErro(e.message));
  }, [periodo]);

  return (
    <Painel titulo="Selic e CDI (% ao ano)" acoes={<SeletorPeriodo valor={periodo} onChange={setPeriodo} />}>
      {erro ? <Estado>{erro}</Estado> : !dados ? <Estado>Carregando…</Estado> : <GraficoLinhas dados={dados} series={SERIES} />}
    </Painel>
  );
}
