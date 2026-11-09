"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, dataLocal, fmtMesAno, fmtPct, type Ponto } from "@/lib/api";
import { CaixaTooltip, Estado, Painel } from "./ui";

// Meta de inflação do CMN: 3% ao ano, o que dá cerca de 0,25% ao mês.
const META_MENSAL = (1.03 ** (1 / 12) - 1) * 100;

export function IpcaMensal({ versao }: { versao: number }) {
  const [dados, setDados] = useState<Ponto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    const d = new Date();
    d.setMonth(d.getMonth() - 24);
    api
      .indicador("ipca", dataLocal(d))
      .then((r) => ativo && (setDados(r), setErro(null)))
      .catch((e) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, [versao]);

  return (
    <Painel titulo="IPCA mês a mês" subtitulo="Variação mensal, últimos 24 meses. Laranja: mês acima do ritmo da meta de 3% ao ano (linha tracejada).">
      {erro ? (
        <Estado>{erro}</Estado>
      ) : !dados ? (
        <Estado>Carregando…</Estado>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis
                dataKey="data"
                tickFormatter={fmtMesAno}
                minTickGap={24}
                stroke="var(--axis)"
                tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                width={52}
                tickFormatter={(v: number) => fmtPct(v, 1)}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                content={({ active, payload }) => {
                  const p = active && (payload?.[0]?.payload as Ponto | undefined);
                  if (!p) return null;
                  return <CaixaTooltip titulo={fmtMesAno(p.data)} linhas={[{ nome: "IPCA", cor: "var(--series-3)", valor: fmtPct(p.valor) }]} />;
                }}
              />
              <ReferenceLine y={META_MENSAL} stroke="var(--text-muted)" strokeDasharray="4 4" />
              <ReferenceLine y={0} stroke="var(--axis)" />
              <Bar dataKey="valor" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {dados.map((p) => (
                  <Cell key={p.data} fill={p.valor > META_MENSAL ? "var(--series-2)" : "var(--series-3)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Painel>
  );
}
