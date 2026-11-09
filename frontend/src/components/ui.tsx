import type { ReactNode } from "react";
import { PERIODOS, type PeriodoId } from "@/lib/api";

type PainelProps = {
  id?: string;
  titulo: string;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Painel({ id, titulo, subtitulo, acoes, children, className = "" }: PainelProps) {
  return (
    <section id={id} className={`rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-sm text-muted">{subtitulo}</p>}
        </div>
        {acoes}
      </div>
      {children}
    </section>
  );
}

type Opcao<T extends string> = { id: T; rotulo: string };

/** Grupo de botões em que só um fica selecionado. */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
}: {
  opcoes: readonly Opcao<T>[];
  valor: T;
  onChange: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div className="inline-flex rounded-lg bg-surface-2 p-0.5 text-sm" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={valor === o.id}
          className={`rounded-md px-3 py-1 transition-colors ${
            valor === o.id ? "bg-surface font-medium text-primary shadow-sm" : "text-secondary hover:text-primary"
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

export function SeletorPeriodo({ valor, onChange }: { valor: PeriodoId; onChange: (p: PeriodoId) => void }) {
  return <Segmentado opcoes={PERIODOS} valor={valor} onChange={onChange} rotulo="Período" />;
}

export function Legenda({ itens }: { itens: { nome: string; cor: string }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-secondary">
      {itens.map((i, idx) => (
        <li key={idx} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: i.cor }} />
          {i.nome}
        </li>
      ))}
    </ul>
  );
}

type LinhaTooltip = { nome: string; cor: string; valor: string };

export function CaixaTooltip({ titulo, linhas }: { titulo: string; linhas: LinhaTooltip[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg">
      <div className="mb-1 text-muted">{titulo}</div>
      {linhas.map((l, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.cor }} />
          <span className="text-secondary">{l.nome}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums">{l.valor}</span>
        </div>
      ))}
    </div>
  );
}

export function Estado({ children, altura = "h-64" }: { children: ReactNode; altura?: string }) {
  return <div className={`flex ${altura} items-center justify-center text-sm text-muted`}>{children}</div>;
}

/** Bloco cinza animado enquanto os dados carregam. */
export function Esqueleto({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}
