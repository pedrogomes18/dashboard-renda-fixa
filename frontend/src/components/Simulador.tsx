"use client";

import { useEffect, useState } from "react";
import { api, fmtBRL, fmtPct, type Simulacao } from "@/lib/api";
import { Esqueleto, Estado, Painel, Segmentado } from "./ui";

const PRAZOS = [
  { id: "6", rotulo: "6M" },
  { id: "12", rotulo: "1A" },
  { id: "24", rotulo: "2A" },
  { id: "36", rotulo: "3A" },
  { id: "60", rotulo: "5A" },
  { id: "120", rotulo: "10A" },
] as const;

const CORES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];
// Cor fixa por produto, para não mudar quando o ranking reordena.
const corDe = (produto: string) => {
  const ordem = ["Tesouro IPCA+", "Tesouro Prefixado", "Tesouro Selic", "CDB", "LCI/LCA", "Poupança"];
  const i = ordem.findIndex((p) => produto.startsWith(p));
  return CORES[i < 0 ? 0 : i];
};

const prazoTexto = (meses: number) =>
  meses % 12 === 0 ? `${meses / 12} ${meses === 12 ? "ano" : "anos"}` : `${meses} ${meses === 1 ? "mês" : "meses"}`;

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-secondary">
      {rotulo}
      {children}
    </label>
  );
}

const estiloInput =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-primary tabular-nums outline-none focus:border-accent";

export function Simulador({ versao }: { versao: number }) {
  const [valorTexto, setValorTexto] = useState("10000");
  const [meses, setMeses] = useState(24);
  const [pctCdb, setPctCdb] = useState(100);
  const [resultado, setResultado] = useState<Simulacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const valor = Number(valorTexto.replace(/\D/g, "")) || 0;

  // Espera o usuário parar de digitar (300 ms) antes de chamar a API.
  useEffect(() => {
    if (valor <= 0 || pctCdb <= 0) return;
    let ativo = true;
    const t = setTimeout(() => {
      api
        .simulacao({ valor, meses, pct_cdb: pctCdb, pct_lci: Math.round(pctCdb * 0.9) })
        .then((r) => ativo && (setResultado(r), setErro(null)))
        .catch((e) => ativo && setErro(e.message));
    }, 300);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [valor, meses, pctCdb, versao]);

  const produtos = resultado?.produtos ?? [];
  const maiorLucro = Math.max(...produtos.map((p) => p.liquido - (resultado?.valor ?? 0)), 1);

  return (
    <Painel
      id="simulador"
      titulo="Simulador de investimentos"
      subtitulo="Quanto você teria no fim do prazo, já descontando IR e custódia, se as taxas de hoje se mantiverem."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.4fr_0.8fr]">
        <Campo rotulo="Valor investido">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">R$</span>
            <input
              inputMode="numeric"
              value={valor ? valor.toLocaleString("pt-BR") : ""}
              onChange={(e) => setValorTexto(e.target.value)}
              className={`${estiloInput} pl-9`}
              aria-label="Valor investido em reais"
            />
          </div>
        </Campo>
        <Campo rotulo={`Prazo: ${prazoTexto(meses)}`}>
          <div className="flex flex-col gap-2">
            <Segmentado
              opcoes={PRAZOS}
              valor={(PRAZOS.find((p) => Number(p.id) === meses)?.id ?? "") as (typeof PRAZOS)[number]["id"]}
              onChange={(v) => setMeses(Number(v))}
              rotulo="Prazo"
            />
            <input
              type="range"
              min={1}
              max={120}
              value={meses}
              onChange={(e) => setMeses(Number(e.target.value))}
              aria-label="Prazo em meses"
            />
          </div>
        </Campo>
        <Campo rotulo="CDB paga (% do CDI)">
          <input
            type="number"
            min={50}
            max={200}
            step={5}
            value={pctCdb}
            onChange={(e) => setPctCdb(Number(e.target.value))}
            className={estiloInput}
          />
        </Campo>
      </div>

      <div className="mt-6">
        {erro ? (
          <Estado altura="h-48">{erro}</Estado>
        ) : !resultado ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Esqueleto key={i} className="h-11" />
            ))}
          </div>
        ) : (
          <>
            <ol className="space-y-2.5">
              {produtos.map((p, i) => {
                const lucro = p.liquido - resultado.valor;
                return (
                  <li key={p.produto} className="entrar grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[16rem_1fr_9rem]">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corDe(p.produto) }} />
                      <span className="font-medium">{p.produto}</span>
                      {i === 0 && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">melhor</span>
                      )}
                    </div>
                    <div className="order-last col-span-2 h-2.5 rounded-full bg-surface-2 sm:order-none sm:col-span-1">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${Math.max((lucro / maiorLucro) * 100, 1)}%`, background: corDe(p.produto) }}
                      />
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-sm font-semibold">{fmtBRL(p.liquido)}</div>
                      <div className="text-xs text-muted">
                        +{fmtBRL(lucro)} · {fmtPct(p.rentabilidade_liquida, 1)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <details className="group mt-5 rounded-xl border border-line">
              <summary className="cursor-pointer select-none px-4 py-2.5 text-sm text-secondary hover:text-primary">
                Ver detalhes do cálculo
              </summary>
              <div className="overflow-x-auto px-4 pb-3">
                <table className="w-full min-w-[620px] text-sm tabular-nums">
                  <thead className="text-left text-muted">
                    <tr className="border-b border-line">
                      <th className="py-2 font-medium">Produto</th>
                      <th className="py-2 text-right font-medium">Taxa a.a.</th>
                      <th className="py-2 text-right font-medium">Bruto</th>
                      <th className="py-2 text-right font-medium">IR</th>
                      <th className="py-2 text-right font-medium">Custódia</th>
                      <th className="py-2 text-right font-medium">Líquido</th>
                      <th className="py-2 text-right font-medium" title="Valor líquido em reais de hoje, descontada a inflação">
                        Em R$ de hoje
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos.map((p) => (
                      <tr key={p.produto} className="border-b border-line last:border-0">
                        <td className="py-2">{p.produto}</td>
                        <td className="py-2 text-right">{fmtPct(p.taxa_aa)}</td>
                        <td className="py-2 text-right">{fmtBRL(p.bruto)}</td>
                        <td className="py-2 text-right text-secondary">{p.imposto ? `−${fmtBRL(p.imposto)}` : "isento"}</td>
                        <td className="py-2 text-right text-secondary">{p.custodia ? `−${fmtBRL(p.custodia)}` : "—"}</td>
                        <td className="py-2 text-right font-medium">{fmtBRL(p.liquido)}</td>
                        <td className="py-2 text-right text-secondary">{fmtBRL(p.liquido_real)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <p className="mt-4 text-xs leading-relaxed text-muted">
              Premissas: CDI {fmtPct(resultado.premissas.cdi)}, Selic {fmtPct(resultado.premissas.selic)} e inflação de{" "}
              {fmtPct(resultado.premissas.ipca_12m)} ao ano (IPCA dos últimos 12 meses). Títulos do Tesouro com vencimento
              mais próximo do prazo. IR de {fmtPct(resultado.aliquota_ir, 1)} sobre o lucro, custódia B3 de 0,20% ao ano,
              poupança sem TR. É uma estimativa educativa, não recomendação de investimento.
            </p>
          </>
        )}
      </div>
    </Painel>
  );
}
