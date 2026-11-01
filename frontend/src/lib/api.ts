export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Serie = "selic" | "cdi" | "ipca";

export type Ponto = { data: string; valor: number };

export type Indicador = Ponto & { acumulado_12m?: number | null };

export type Titulo = {
  id: string;
  tipo: string;
  vencimento: string;
  data: string;
  taxa_compra: number | null;
  taxa_venda: number | null;
  pu_compra: number | null;
  pu_venda: number | null;
};

export type HistoricoTitulo = {
  titulo: Pick<Titulo, "id" | "tipo" | "vencimento">;
  historico: Omit<Titulo, "id" | "tipo" | "vencimento">[];
};

export type Taxas = {
  indicadores: Record<Serie, Indicador | null>;
  titulos: Titulo[];
};

async function get<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_URL}${path}`);
  if (!resp.ok) throw new Error(`Erro ${resp.status} em ${path}`);
  return resp.json();
}

export const api = {
  taxas: () => get<Taxas>("/taxas"),
  indicador: (serie: Serie, desde?: string) =>
    get<Ponto[]>(`/indicadores/${serie}/historico${desde ? `?desde=${desde}` : ""}`),
  titulo: (id: string, desde?: string) =>
    get<HistoricoTitulo>(`/titulos/${id}/historico${desde ? `?desde=${desde}` : ""}`),
};

// ---- formatação ----

export const fmtPct = (v: number | null | undefined, casas = 2) =>
  v == null ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

export const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Datas chegam como "AAAA-MM-DD"; evitamos new Date() para não sofrer com fuso.
export const fmtData = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const fmtMesAno = (iso: string) => {
  const [a, m] = iso.split("-");
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
};

export const nomeTitulo = (t: Pick<Titulo, "tipo" | "vencimento">) =>
  `${t.tipo} ${t.vencimento.slice(0, 4)}`;

// ---- períodos ----

export const PERIODOS = [
  { id: "3m", rotulo: "3M", meses: 3 },
  { id: "6m", rotulo: "6M", meses: 6 },
  { id: "1a", rotulo: "1A", meses: 12 },
  { id: "3a", rotulo: "3A", meses: 36 },
] as const;

export type PeriodoId = (typeof PERIODOS)[number]["id"];

export function desdeDoPeriodo(id: PeriodoId): string {
  const meses = PERIODOS.find((p) => p.id === id)!.meses;
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return d.toISOString().slice(0, 10);
}
