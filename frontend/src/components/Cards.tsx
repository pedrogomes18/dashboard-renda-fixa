"use client";

import { useEffect, useState } from "react";
import { api, dataLocal, fmtData, fmtMesAno, fmtPct, fmtPP, juroReal, type Ponto, type Taxas } from "@/lib/api";
import { Esqueleto } from "./ui";

/** Linha minúscula sem eixos, só para mostrar a tendência. */
function Sparkline({ valores, cor }: { valores: number[]; cor: string }) {
  if (valores.length < 2) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const amplitude = max - min || 1;
  const pontos = valores
    .map((v, i) => `${(i / (valores.length - 1)) * 100},${28 - ((v - min) / amplitude) * 24}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <polyline points={pontos} fill="none" stroke={cor} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

type CardProps = {
  rotulo: string;
  valor: string;
  detalhe: string;
  variacao?: number | null;
  serie?: number[];
  cor?: string;
  destaque?: boolean;
};

function Card({ rotulo, valor, detalhe, variacao, serie, cor = "var(--accent)", destaque }: CardProps) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-4 shadow-card ${
        destaque ? "border-transparent bg-accent-soft" : "border-line bg-surface"
      }`}
    >
      <div className="text-sm text-secondary">{rotulo}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{valor}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        {variacao != null && (
          // Sem verde/vermelho: juro subir é bom para quem investe e ruim para quem toma crédito.
          <span className="font-medium text-secondary">
            {variacao > 0 ? "▲" : variacao < 0 ? "▼" : "■"} {fmtPP(variacao)} em 12m
          </span>
        )}
        <span>{detalhe}</span>
      </div>
      <div className="mt-auto pt-3">{serie ? <Sparkline valores={serie} cor={cor} /> : <div className="h-8" />}</div>
    </div>
  );
}

/** IPCA acumulado em 12 meses, mês a mês, a partir das variações mensais. */
function ipcaAcumulado(mensal: Ponto[]): Ponto[] {
  const saida: Ponto[] = [];
  for (let i = 11; i < mensal.length; i++) {
    const fator = mensal.slice(i - 11, i + 1).reduce((acc, p) => acc * (1 + p.valor / 100), 1);
    saida.push({ data: mensal[i].data, valor: (fator - 1) * 100 });
  }
  return saida;
}

/** Diferença entre o último valor e o valor de ~12 meses antes. */
function variacao12m(serie: Ponto[]): number | null {
  if (serie.length < 2) return null;
  const ultimo = serie[serie.length - 1];
  const [a, m, d] = ultimo.data.split("-").map(Number);
  const alvo = dataLocal(new Date(a - 1, m - 1, d));
  const antes = serie.find((p) => p.data >= alvo);
  return antes && antes !== ultimo ? ultimo.valor - antes.valor : null;
}

type Historicos = { selic: Ponto[]; cdi: Ponto[]; ipca12m: Ponto[] };

export function Cards({ taxas, versao }: { taxas: Taxas; versao: number }) {
  const [hist, setHist] = useState<Historicos | null>(null);

  useEffect(() => {
    let ativo = true;
    const d = new Date();
    d.setMonth(d.getMonth() - 13);
    const umAno = dataLocal(d);
    d.setMonth(d.getMonth() - 12);
    const doisAnos = dataLocal(d);
    Promise.all([api.indicador("selic", umAno), api.indicador("cdi", umAno), api.indicador("ipca", doisAnos)])
      .then(([selic, cdi, ipca]) => ativo && setHist({ selic, cdi, ipca12m: ipcaAcumulado(ipca) }))
      .catch(() => ativo && setHist({ selic: [], cdi: [], ipca12m: [] }));
    return () => {
      ativo = false;
    };
  }, [versao]);

  const { selic, cdi, ipca } = taxas.indicadores;
  const ipca12 = ipca?.acumulado_12m;
  const real = selic && ipca12 != null ? juroReal(selic.valor, ipca12) : null;
  const so = (s: Ponto[] | undefined) => s?.map((p) => p.valor);

  return (
    <div id="visao-geral" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        rotulo="Selic (meta)"
        valor={fmtPct(selic?.valor)}
        detalhe={selic ? `ao ano · ${fmtData(selic.data)}` : "sem dados"}
        variacao={hist && variacao12m(hist.selic)}
        serie={so(hist?.selic)}
        cor="var(--series-1)"
      />
      <Card
        rotulo="CDI"
        valor={fmtPct(cdi?.valor)}
        detalhe={cdi ? `ao ano · ${fmtData(cdi.data)}` : "sem dados"}
        variacao={hist && variacao12m(hist.cdi)}
        serie={so(hist?.cdi)}
        cor="var(--series-2)"
      />
      <Card
        rotulo="IPCA 12 meses"
        valor={fmtPct(ipca12)}
        detalhe={ipca ? `último mês ${fmtPct(ipca.valor)} · ${fmtMesAno(ipca.data)}` : "sem dados"}
        variacao={hist && variacao12m(hist.ipca12m)}
        serie={so(hist?.ipca12m)}
        cor="var(--series-3)"
      />
      <Card
        rotulo="Juro real"
        valor={fmtPct(real)}
        detalhe="Selic acima da inflação de 12 meses"
        destaque
      />
    </div>
  );
}

export function CardsEsqueleto() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Esqueleto key={i} className="h-36 rounded-2xl" />
      ))}
    </div>
  );
}
