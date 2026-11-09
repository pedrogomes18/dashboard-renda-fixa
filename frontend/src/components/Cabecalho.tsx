import type { EstadoConexao } from "@/lib/eventos";

const SECOES = [
  { id: "visao-geral", rotulo: "Visão geral" },
  { id: "curva", rotulo: "Curva de juros" },
  { id: "simulador", rotulo: "Simulador" },
  { id: "comparador", rotulo: "Comparador" },
  { id: "titulos", rotulo: "Títulos" },
];

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M7 21l6-6 4 4 8-9" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatusAoVivo({ estado, conectados }: { estado: EstadoConexao; conectados: number | null }) {
  const aoVivo = estado === "ao-vivo";
  const texto = aoVivo ? "Ao vivo" : estado === "conectando" ? "Conectando…" : "Offline";
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-secondary"
      title="Conexão SSE com a API: o painel se atualiza sozinho quando a ETL termina"
      aria-live="polite"
    >
      <span className={`inline-block h-2 w-2 rounded-full ${aoVivo ? "pulso bg-pos" : "bg-muted"}`} />
      <span className="font-medium text-primary">{texto}</span>
      {aoVivo && conectados != null && (
        <span className="hidden sm:inline">
          · {conectados} {conectados === 1 ? "pessoa" : "pessoas"} vendo
        </span>
      )}
    </div>
  );
}

export function Cabecalho({ estado, conectados }: { estado: EstadoConexao; conectados: number | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-page/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <a href="#" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          <span className="hidden sm:inline">Monitor de Renda Fixa</span>
        </a>
        <nav className="hidden flex-1 gap-1 text-sm text-secondary md:flex" aria-label="Seções">
          {SECOES.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-md px-2.5 py-1 transition-colors hover:bg-surface-2 hover:text-primary">
              {s.rotulo}
            </a>
          ))}
        </nav>
        <div className="ml-auto">
          <StatusAoVivo estado={estado} conectados={conectados} />
        </div>
      </div>
    </header>
  );
}
