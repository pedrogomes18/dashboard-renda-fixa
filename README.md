# Monitor de Renda Fixa

Painel que coleta todo dia as taxas públicas de juros do Brasil (Selic, CDI, IPCA e títulos do Tesouro Direto) e mostra a evolução em gráficos.

```
GitHub Actions (cron, 18h)  ->  ETL Python  ->  PostgreSQL / SQLite
                                                      |
                              Next.js  <-  API FastAPI
```

## Fontes de dados

| Dado | Fonte | Série |
|---|---|---|
| Selic meta (% a.a.) | Banco Central, API SGS | 432 |
| CDI (% a.a., base 252) | Banco Central, API SGS | 4389 |
| IPCA mensal (%) | Banco Central, API SGS | 433 |
| Taxas e preços dos títulos | Tesouro Transparente, CSV `PrecoTaxaTesouroDireto` | |

## Rodando localmente

### Backend (Python 3.13)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows (no Linux/Mac: source .venv/bin/activate)
pip install -r requirements-dev.txt

python -m app.etl               # baixa os dados (últimos 3 anos) para renda_fixa.db
uvicorn app.main:app --reload   # API em http://localhost:8000 (docs em /docs)
pytest                          # testes
```

Sem `DATABASE_URL`, o backend usa SQLite local. Para usar Postgres (Neon, Supabase):

```bash
DATABASE_URL=postgresql://usuario:senha@host/banco python -m app.etl
```

### Frontend (Node 20+)

```bash
cd frontend
npm install
npm run dev                     # http://localhost:3000
```

A URL da API vem de `NEXT_PUBLIC_API_URL` (padrão `http://localhost:8000`). Veja `frontend/.env.example`.

## API

| Rota | O que retorna |
|---|---|
| `GET /taxas` | Último valor de Selic, CDI, IPCA (com acumulado 12m) e de cada título ativo |
| `GET /indicadores/{selic\|cdi\|ipca}/historico?desde=AAAA-MM-DD` | Série histórica do indicador |
| `GET /titulos` | Títulos ativos na data base mais recente |
| `GET /titulos/{id}/historico?desde=AAAA-MM-DD` | Histórico de taxas e preços de um título |

IDs dos títulos seguem o padrão `tipo-vencimento`, ex.: `tesouro-ipca-2035-05-15`.

## Agendamento

`.github/workflows/etl.yml` roda o ETL de segunda a sexta às 18h (Brasília). Basta cadastrar o secret `DATABASE_URL` no repositório.

## Próximos passos

- [ ] Deploy (API no Render/Railway, front na Vercel, banco no Neon)
- [ ] Alertas por e-mail ("me avise quando o IPCA+ 2035 passar de 7%")
- [ ] Simulador de investimento
- [ ] Login para salvar favoritos
