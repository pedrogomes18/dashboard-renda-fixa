import { fmtData, fmtMesAno, fmtPct, type Taxas } from "@/lib/api";

function Card({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-sm text-secondary">{rotulo}</div>
      <div className="mt-1 text-3xl font-semibold">{valor}</div>
      <div className="mt-1 text-xs text-muted">{detalhe}</div>
    </div>
  );
}

export function Cards({ taxas }: { taxas: Taxas }) {
  const { selic, cdi, ipca } = taxas.indicadores;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card
        rotulo="Selic (meta)"
        valor={fmtPct(selic?.valor)}
        detalhe={selic ? `ao ano · ${fmtData(selic.data)}` : "sem dados"}
      />
      <Card
        rotulo="CDI"
        valor={fmtPct(cdi?.valor)}
        detalhe={cdi ? `ao ano · ${fmtData(cdi.data)}` : "sem dados"}
      />
      <Card
        rotulo="IPCA 12 meses"
        valor={fmtPct(ipca?.acumulado_12m)}
        detalhe={ipca ? `último mês ${fmtPct(ipca.valor)} · ${fmtMesAno(ipca.data)}` : "sem dados"}
      />
    </div>
  );
}
