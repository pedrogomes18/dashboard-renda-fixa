"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtData, fmtMesAno, fmtPct } from "@/lib/api";
import { CaixaTooltip, Legenda } from "./ui";

export type SerieGrafico = { chave: string; nome: string; cor: string };

type Props = {
  dados: Record<string, number | string | null>[];
  series: SerieGrafico[];
  casas?: number;
};

/** Gráfico de linhas com eixo de datas ("data": AAAA-MM-DD) e valores em %. */
export function GraficoLinhas({ dados, series, casas = 2 }: Props) {
  // Índice do último ponto com valor de cada série (as séries podem terminar em dias diferentes).
  const ultimoIndice = Object.fromEntries(
    series.map((s) => [s.chave, dados.findLastIndex((d) => d[s.chave] != null)]),
  );
  const ultimoValor = (chave: string) => (dados[ultimoIndice[chave]]?.[chave] as number | undefined) ?? -Infinity;
  // Afasta os rótulos finais para não se sobreporem: o da série mais alta sobe, o da mais baixa desce.
  const maisAlta = series.reduce((a, b) => (ultimoValor(b.chave) > ultimoValor(a.chave) ? b : a), series[0]);

  return (
    <div>
      {series.length > 1 && <Legenda itens={series} />}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 8, right: 56, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="data"
              tickFormatter={fmtMesAno}
              minTickGap={40}
              stroke="var(--axis)"
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              width={52}
              domain={["auto", "auto"]}
              padding={{ top: 12, bottom: 12 }}
              tickFormatter={(v: number) => fmtPct(v, 1)}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ stroke: "var(--axis)" }}
              content={({ active, label }) => {
                if (!active || label == null) return null;
                const linha = dados.find((d) => d.data === label);
                if (!linha) return null;
                return (
                  <CaixaTooltip
                    titulo={fmtData(String(label))}
                    linhas={series.map((s) => ({
                      nome: s.nome,
                      cor: s.cor,
                      valor: fmtPct(linha[s.chave] as number | null, casas),
                    }))}
                  />
                );
              }}
            />
            {series.map((s) => (
              <Line
                key={s.chave}
                dataKey={s.chave}
                name={s.nome}
                stroke={s.cor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
                label={
                  // rótulo direto só no último ponto, quando há mais de uma série
                  series.length > 1
                    ? ({ x, y, index }: { x?: number | string; y?: number | string; index?: number }) =>
                        index === ultimoIndice[s.chave] ? (
                          <text
                            x={Number(x) + 6}
                            y={Number(y)}
                            dy={s.chave === maisAlta?.chave ? -2 : 11}
                            fontSize={12}
                            fill="var(--text-secondary)"
                          >
                            {fmtPct(dados[index][s.chave] as number, casas)}
                          </text>
                        ) : null
                    : undefined
                }
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
