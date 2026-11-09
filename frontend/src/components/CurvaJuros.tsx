"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtData, fmtPct, type Titulo } from "@/lib/api";
import { CaixaTooltip, Estado, Painel, Segmentado } from "./ui";

const CURVAS = [
  { id: "pre", rotulo: "Prefixada", tipo: "Tesouro Prefixado", cor: "var(--series-1)", nota: "Juro nominal, % ao ano." },
  { id: "ipca", rotulo: "IPCA+", tipo: "Tesouro IPCA+", cor: "var(--series-3)", nota: "Juro real (acima da inflação), % ao ano." },
] as const;

type CurvaId = (typeof CURVAS)[number]["id"];

const anoDecimal = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return a + (m - 1) / 12 + (d - 1) / 365;
};

/** Curva de juros: taxa de cada título contra o seu vencimento. */
export function CurvaJuros({ titulos }: { titulos: Titulo[] }) {
  const [id, setId] = useState<CurvaId>("pre");
  const curva = CURVAS.find((c) => c.id === id)!;
  const pontos = titulos
    .filter((t) => t.tipo === curva.tipo && t.taxa_compra != null)
    .map((t) => ({ x: anoDecimal(t.vencimento), taxa: t.taxa_compra as number, titulo: t }))
    .sort((a, b) => a.x - b.x);

  const inclinacao = pontos.length > 1 ? pontos[pontos.length - 1].taxa - pontos[0].taxa : 0;
  const leitura =
    pontos.length < 2
      ? null
      : Math.abs(inclinacao) < 0.15
        ? "Curva plana: o mercado cobra quase o mesmo juro no curto e no longo prazo."
        : inclinacao > 0
          ? "Curva positiva: prazos mais longos pagam mais, o mercado pede prêmio por esperar."
          : "Curva invertida: prazos curtos pagam mais, sinal de que o mercado espera queda de juros.";

  return (
    <Painel
      id="curva"
      titulo="Curva de juros"
      subtitulo={curva.nota}
      acoes={<Segmentado opcoes={CURVAS} valor={id} onChange={setId} rotulo="Curva" />}
    >
      {pontos.length === 0 ? (
        <Estado>Nenhum título desse tipo à venda hoje.</Estado>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pontos} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={["dataMin - 0.5", "dataMax + 0.5"]}
                  tickFormatter={(v: number) => String(Math.floor(v))}
                  allowDecimals={false}
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
                  content={({ active, payload }) => {
                    const p = active && payload?.[0]?.payload;
                    if (!p) return null;
                    return (
                      <CaixaTooltip
                        titulo={`Vence em ${fmtData(p.titulo.vencimento)}`}
                        linhas={[{ nome: p.titulo.tipo, cor: curva.cor, valor: fmtPct(p.taxa) }]}
                      />
                    );
                  }}
                />
                <Line
                  dataKey="taxa"
                  stroke={curva.cor}
                  strokeWidth={2}
                  dot={{ r: 3.5, fill: curva.cor, stroke: "var(--surface)", strokeWidth: 1.5 }}
                  activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {leitura && <p className="mt-3 text-sm text-secondary">{leitura}</p>}
        </>
      )}
    </Painel>
  );
}
