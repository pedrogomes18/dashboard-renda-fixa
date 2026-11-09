import { API_URL } from "@/lib/api";

const LINKS = [
  { href: "https://github.com/pedrogomes18/dashboard-renda-fixa", rotulo: "Código no GitHub" },
  { href: `${API_URL}/docs`, rotulo: "Documentação da API" },
  { href: "https://dadosabertos.bcb.gov.br/", rotulo: "Banco Central (SGS)" },
  { href: "https://www.tesourotransparente.gov.br/", rotulo: "Tesouro Transparente" },
];

export function Rodape() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          Feito por Pedro Gomes. Dados públicos, sem fins de recomendação de investimento.
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="hover:text-primary">
              {l.rotulo}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
