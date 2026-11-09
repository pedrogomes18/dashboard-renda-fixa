"use client";

import { useMemo, useState } from "react";
import { fmtBRL, fmtData, fmtPct, type Titulo } from "@/lib/api";
import { Painel } from "./ui";

type Coluna = "tipo" | "vencimento" | "taxa_compra" | "taxa_venda" | "pu";
type Ordem = { coluna: Coluna; asc: boolean };

const preco = (t: Titulo) => t.pu_compra ?? t.pu_venda;

function valorOrdenacao(t: Titulo, c: Coluna): string | number {
  if (c === "pu") return preco(t) ?? -Infinity;
  if (c === "taxa_compra" || c === "taxa_venda") return t[c] ?? -Infinity;
  return t[c];
}

function baixarCsv(titulos: Titulo[]) {
  const linhas = [
    ["titulo", "vencimento", "taxa_compra", "taxa_venda", "pu_compra", "pu_venda", "data_base"],
    ...titulos.map((t) => [t.tipo, t.vencimento, t.taxa_compra, t.taxa_venda, t.pu_compra, t.pu_venda, t.data]),
  ];
  const csv = linhas.map((l) => l.map((v) => (v == null ? "" : `"${String(v).replace(/"/g, '""')}"`)).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "titulos-tesouro.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

type CabecalhoProps = {
  coluna: Coluna;
  children: string;
  direita?: boolean;
  ordem: Ordem;
  onOrdenar: (c: Coluna) => void;
};

function Cabecalho({ coluna, children, direita, ordem, onOrdenar }: CabecalhoProps) {
  const ativa = ordem.coluna === coluna;
  return (
    <th className={`px-4 py-2 font-medium ${direita ? "text-right" : ""}`} aria-sort={ativa ? (ordem.asc ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onOrdenar(coluna)}
        className={`inline-flex items-center gap-1 hover:text-primary ${ativa ? "text-primary" : ""}`}
      >
        {children}
        <span className="text-[10px]">{ativa ? (ordem.asc ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}

export function TabelaTitulos({ titulos }: { titulos: Titulo[] }) {
  const [filtro, setFiltro] = useState<string>("Todos");
  const [ordem, setOrdem] = useState<Ordem>({ coluna: "tipo", asc: true });

  const tipos = useMemo(() => ["Todos", ...new Set(titulos.map((t) => t.tipo))], [titulos]);
  const linhas = useMemo(() => {
    const filtradas = filtro === "Todos" ? titulos : titulos.filter((t) => t.tipo === filtro);
    return [...filtradas].sort((a, b) => {
      const va = valorOrdenacao(a, ordem.coluna);
      const vb = valorOrdenacao(b, ordem.coluna);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      // desempate pelo vencimento, para títulos do mesmo tipo ficarem em ordem
      return (ordem.asc ? cmp : -cmp) || a.vencimento.localeCompare(b.vencimento);
    });
  }, [titulos, filtro, ordem]);

  const dataBase = titulos[0]?.data;
  const cab = {
    ordem,
    onOrdenar: (coluna: Coluna) => setOrdem((o) => ({ coluna, asc: o.coluna === coluna ? !o.asc : true })),
  };

  return (
    <Painel
      id="titulos"
      titulo="Títulos do Tesouro Direto"
      subtitulo={dataBase ? `${titulos.length} títulos · data base ${fmtData(dataBase)}` : undefined}
      acoes={
        <button
          type="button"
          onClick={() => baixarCsv(linhas)}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-secondary transition-colors hover:bg-surface-2 hover:text-primary"
        >
          Baixar CSV
        </button>
      }
    >
      <div className="-mx-1 mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
        {tipos.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFiltro(t)}
            aria-pressed={filtro === t}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filtro === t
                ? "border-transparent bg-primary text-surface"
                : "border-line text-secondary hover:bg-surface-2 hover:text-primary"
            }`}
          >
            {t.replace("Tesouro ", "")}
          </button>
        ))}
      </div>

      <div className="-mx-4 max-h-[32rem] overflow-auto sm:-mx-6">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="sticky top-0 bg-surface text-left text-muted">
            <tr className="border-b border-line">
              <Cabecalho {...cab} coluna="tipo">Título</Cabecalho>
              <Cabecalho {...cab} coluna="vencimento">Vencimento</Cabecalho>
              <Cabecalho {...cab} coluna="taxa_compra" direita>Taxa compra</Cabecalho>
              <Cabecalho {...cab} coluna="taxa_venda" direita>Taxa venda</Cabecalho>
              <Cabecalho {...cab} coluna="pu" direita>Preço unitário</Cabecalho>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {linhas.map((t) => (
              <tr key={t.id} className="border-b border-line transition-colors last:border-0 hover:bg-surface-2">
                <td className="px-4 py-2.5">{t.tipo}</td>
                <td className="px-4 py-2.5 text-secondary">{fmtData(t.vencimento)}</td>
                <td className="px-4 py-2.5 text-right">
                  {t.taxa_compra == null ? <span className="text-muted">só resgate</span> : fmtPct(t.taxa_compra)}
                </td>
                <td className="px-4 py-2.5 text-right">{fmtPct(t.taxa_venda)}</td>
                <td className="px-4 py-2.5 text-right">{fmtBRL(preco(t))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Painel>
  );
}
