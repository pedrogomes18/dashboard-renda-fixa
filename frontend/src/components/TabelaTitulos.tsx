import { fmtBRL, fmtData, fmtPct, type Titulo } from "@/lib/api";
import { Painel } from "./ui";

export function TabelaTitulos({ titulos }: { titulos: Titulo[] }) {
  const dataBase = titulos[0]?.data;
  return (
    <Painel titulo={`Títulos do Tesouro Direto${dataBase ? ` · ${fmtData(dataBase)}` : ""}`}>
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2 font-medium sm:pl-0">Título</th>
              <th className="px-4 py-2 font-medium">Vencimento</th>
              <th className="px-4 py-2 text-right font-medium">Taxa compra</th>
              <th className="px-4 py-2 text-right font-medium">Taxa venda</th>
              <th className="px-4 py-2 text-right font-medium sm:pr-0">Preço unitário</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {titulos.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 sm:pl-0">{t.tipo}</td>
                <td className="px-4 py-2 text-secondary">{fmtData(t.vencimento)}</td>
                <td className="px-4 py-2 text-right">{fmtPct(t.taxa_compra)}</td>
                <td className="px-4 py-2 text-right">{fmtPct(t.taxa_venda)}</td>
                <td className="px-4 py-2 text-right sm:pr-0">{fmtBRL(t.pu_compra ?? t.pu_venda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Painel>
  );
}
