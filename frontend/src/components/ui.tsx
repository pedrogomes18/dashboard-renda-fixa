import type { ReactNode } from "react";
import { PERIODOS, type PeriodoId } from "@/lib/api";

export function Painel({ titulo, acoes, children }: { titulo: string; acoes?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{titulo}</h2>
        {acoes}
      </div>
      {children}
    </section>
  );
}

export function SeletorPeriodo({ valor, onChange }: { valor: PeriodoId; onChange: (p: PeriodoId) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-line p-0.5 text-sm" role="group" aria-label="Período">
      {PERIODOS.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          aria-pressed={valor === p.id}
          className={`rounded-md px-3 py-1 transition-colors ${
            valor === p.id ? "bg-primary text-surface font-medium" : "text-secondary hover:bg-line"
          }`}
        >
          {p.rotulo}
        </button>
      ))}
    </div>
  );
}

export function Legenda({ itens }: { itens: { nome: string; cor: string }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-secondary">
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: i.cor }} />
          {i.nome}
        </li>
      ))}
    </ul>
  );
}

type LinhaTooltip = { nome: string; cor: string; valor: string };

export function CaixaTooltip({ titulo, linhas }: { titulo: string; linhas: LinhaTooltip[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-md">
      <div className="mb-1 text-muted">{titulo}</div>
      {linhas.map((l) => (
        <div key={l.nome} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.cor }} />
          <span className="text-secondary">{l.nome}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums">{l.valor}</span>
        </div>
      ))}
    </div>
  );
}

export function Estado({ children }: { children: ReactNode }) {
  return <div className="flex h-64 items-center justify-center text-sm text-muted">{children}</div>;
}
