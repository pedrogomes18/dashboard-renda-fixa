"use client";

import { useEffect, useState } from "react";
import { api, desdeDoPeriodo, nomeTitulo, type PeriodoId, type Titulo } from "@/lib/api";
import { GraficoLinhas } from "./GraficoLinhas";
import { Estado, Painel, SeletorPeriodo } from "./ui";

const CORES = ["var(--series-1)", "var(--series-2)"];

function padrao(titulos: Titulo[]): [string, string] {
  const ipca = titulos.find((t) => t.tipo === "Tesouro IPCA+") ?? titulos[0];
  const pre = titulos.find((t) => t.tipo === "Tesouro Prefixado") ?? titulos[1] ?? titulos[0];
  return [ipca?.id ?? "", pre?.id ?? ""];
}

export function Comparador({ titulos }: { titulos: Titulo[] }) {
  const [ids, setIds] = useState<[string, string]>(() => padrao(titulos));
  const [periodo, setPeriodo] = useState<PeriodoId>("1a");
  const [dados, setDados] = useState<Record<string, number | string | null>[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!ids[0] || !ids[1]) return;
    const desde = desdeDoPeriodo(periodo);
    Promise.all(ids.map((id) => api.titulo(id, desde)))
      .then((resps) => {
        const porData = new Map<string, Record<string, number | string | null>>();
        resps.forEach((r, i) => {
          for (const h of r.historico) {
            const linha = porData.get(h.data) ?? { data: h.data, a: null, b: null };
            linha[i === 0 ? "a" : "b"] = h.taxa_compra;
            porData.set(h.data, linha);
          }
        });
        setDados([...porData.values()].sort((x, y) => String(x.data).localeCompare(String(y.data))));
        setErro(null);
      })
      .catch((e) => setErro(e.message));
  }, [ids, periodo]);

  const nome = (id: string) => {
    const t = titulos.find((t) => t.id === id);
    return t ? nomeTitulo(t) : id;
  };

  const series = ids.map((id, i) => ({ chave: i === 0 ? "a" : "b", nome: nome(id), cor: CORES[i] }));

  return (
    <Painel titulo="Comparador de títulos (taxa de compra, % ao ano)" acoes={<SeletorPeriodo valor={periodo} onChange={setPeriodo} />}>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ids.map((id, i) => (
          <label key={i} className="flex flex-col gap-1 text-sm text-secondary">
            Título {i + 1}
            <select
              value={id}
              onChange={(e) => setIds((atual) => (i === 0 ? [e.target.value, atual[1]] : [atual[0], e.target.value]))}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-primary"
            >
              {titulos.map((t) => (
                <option key={t.id} value={t.id}>
                  {nomeTitulo(t)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {erro ? <Estado>{erro}</Estado> : !dados ? <Estado>Carregando…</Estado> : <GraficoLinhas dados={dados} series={series} />}
    </Painel>
  );
}
