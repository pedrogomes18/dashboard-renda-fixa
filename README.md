# Monitor de Renda Fixa

[![CI](https://github.com/pedrogomes18/dashboard-renda-fixa/actions/workflows/ci.yml/badge.svg)](https://github.com/pedrogomes18/dashboard-renda-fixa/actions/workflows/ci.yml)

Painel que coleta todo dia as taxas públicas de juros do Brasil (Selic, CDI, IPCA e todos os títulos do Tesouro Direto), mostra a evolução em gráficos, simula investimentos e **se atualiza sozinho em tempo real** quando chegam dados novos.

![Visão geral do painel](docs/screenshot.jpg)

## Funcionalidades

- **Visão geral**: Selic, CDI, IPCA 12 meses e juro real, com tendência (sparkline) e variação em 12 meses
- **Selic × CDI** ao longo do tempo (3 meses a 3 anos)
- **Curva de juros** prefixada e IPCA+, com leitura automática (positiva, plana ou invertida)
- **IPCA mês a mês** comparado ao ritmo da meta de inflação
- **Simulador de investimentos**: compara Poupança, CDB, LCI/LCA, Tesouro Selic, Prefixado e IPCA+ com IR regressivo, custódia da B3 e valor em reais de hoje
- **Comparador** da taxa de dois títulos lado a lado
- **Tabela de títulos** com filtro por tipo, ordenação por coluna e exportação em CSV
- **Tempo real com SSE**: indicador "ao vivo", contagem de pessoas com o painel aberto e recarga automática quando a ETL termina
- Tema claro e escuro automático, layout responsivo

| Simulador | Curva de juros e IPCA |
|---|---|
| ![Simulador](docs/simulador.jpg) | ![Curva de juros e IPCA mensal](docs/curva-ipca.jpg) |

## Arquitetura

```mermaid
flowchart LR
    GA["GitHub Actions<br/>cron 18h, dias úteis"] --> ETL["ETL Python"]
    BCB["Banco Central<br/>API SGS"] --> ETL
    TES["Tesouro Transparente<br/>CSV"] --> ETL
    ETL -->|upsert + registro da execução| DB[("PostgreSQL (Neon)<br/>ou SQLite")]
    DB --> API["API FastAPI"]
    API -->|REST| WEB["Next.js"]
    API -.->|SSE /eventos| WEB
```

| Camada | Tecnologias |
|---|---|
| Coleta (ETL) | Python 3.13, httpx, agendado no GitHub Actions |
| Banco | SQLAlchemy Core; SQLite local, PostgreSQL em produção; carga idempotente (upsert) |
| API | FastAPI, modelos Pydantic (documentação automática em `/docs`), Server-Sent Events |
| Front-end | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts |
| Qualidade | 25 testes com pytest (ETL, simulador, rotas e SSE), ESLint, CI a cada push |
| Infra | Docker Compose (Postgres + ETL + API + front) |

### Como funciona o tempo real (SSE)

A ETL roda em outro processo (no GitHub Actions), então a API não sabe quando ela termina. A solução:

1. Ao final de cada carga, a ETL grava uma linha na tabela `etl_execucoes`.
2. Na API, **uma única** tarefa em segundo plano consulta essa tabela a cada 10 segundos.
3. Quando aparece uma execução nova, ela publica o evento `atualizacao` para a fila de cada navegador conectado em `GET /eventos`.
4. O front recebe o evento pelo `EventSource`, recarrega as seções e mostra um aviso.

```mermaid
sequenceDiagram
    participant N as Navegador
    participant A as API (FastAPI)
    participant B as Banco
    participant E as ETL
    N->>A: GET /eventos (EventSource)
    A-->>N: event: status / presenca
    E->>B: upsert dos dados + linha em etl_execucoes
    loop a cada 10 s
        A->>B: última execução?
    end
    A-->>N: event: atualizacao
    N->>A: GET /taxas, /indicadores... (recarrega)
```

Detalhes: o servidor manda `retry: 5000` para o navegador reconectar sozinho se a conexão cair; um comentário `: ping` a cada 15 s evita que proxies fechem a conexão ociosa; filas com limite garantem que um cliente lento não trava os outros. O evento `presenca` conta quantas pessoas estão com o painel aberto.

Por que SSE e não WebSocket? A comunicação é só do servidor para o navegador. O SSE roda sobre HTTP comum, reconecta automaticamente e não precisa de biblioteca no front.

### Outras decisões técnicas

- **Upsert em vez de "apaga e insere"**: a ETL pode rodar várias vezes no mesmo dia (ou reprocessar anos) sem duplicar linhas, e ainda corrige valores revisados pela fonte.
- **A série da meta Selic traz datas futuras** já com a taxa vigente; a ETL descarta o que for posterior a hoje.
- **Datas tratadas como texto `AAAA-MM-DD` no front**, para não sofrer com fuso horário ao formatar.
- **Títulos "ativos"** são os que aparecem na data base mais recente do Tesouro, então títulos vencidos somem sozinhos da tabela.
- **O simulador roda no backend** (`app/simulador.py`), como função pura e testada; o front só envia os parâmetros.
- **Respostas fora de ordem são descartadas**: se você troca de período rápido, uma resposta antiga não sobrescreve a nova.

## Fontes de dados

| Dado | Fonte | Série |
|---|---|---|
| Selic meta (% a.a.) | Banco Central, API SGS | 432 |
| CDI (% a.a., base 252) | Banco Central, API SGS | 4389 |
| IPCA mensal (%) | Banco Central, API SGS | 433 |
| Taxas e preços dos títulos | Tesouro Transparente, CSV `PrecoTaxaTesouroDireto` | |

## Rodando localmente

### Opção 1: Docker (tudo de uma vez)

```bash
docker compose up --build
```

Sobe Postgres, roda a ETL uma vez, e serve a API em http://localhost:8000/docs e o painel em http://localhost:3000.

### Opção 2: manualmente

**Backend (Python 3.13)**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows (no Linux/Mac: source .venv/bin/activate)
pip install -r requirements-dev.txt

python -m app.etl               # baixa os dados (últimos 3 anos) para backend/renda_fixa.db
uvicorn app.main:app --reload   # API em http://localhost:8000 (docs em /docs)
pytest                          # testes
```

Sem `DATABASE_URL`, o backend usa SQLite em `backend/renda_fixa.db`. Para usar Postgres (Neon, Supabase):

```bash
DATABASE_URL=postgresql://usuario:senha@host/banco python -m app.etl
```

Dica: com o painel aberto, rode `python -m app.etl --anos 1` em outro terminal. Em até 10 segundos o painel recebe o evento SSE e se atualiza sozinho.

**Frontend (Node 20+)**

```bash
cd frontend
npm install
npm run dev                     # http://localhost:3000
```

A URL da API vem de `NEXT_PUBLIC_API_URL` (padrão `http://localhost:8000`). Veja `frontend/.env.example`.

### Variáveis de ambiente

| Variável | Onde | Para quê |
|---|---|---|
| `DATABASE_URL` | API, ETL, secret do GitHub | Conexão com o Postgres (sem ela, SQLite local) |
| `CORS_ORIGINS` | API | URLs do front autorizadas, separadas por vírgula |
| `SSE_INTERVALO` | API | Segundos entre verificações de nova carga (padrão 10) |
| `NEXT_PUBLIC_API_URL` | Front | Endereço da API |

## API

Documentação interativa em `/docs`.

| Rota | O que retorna |
|---|---|
| `GET /taxas` | Último valor de Selic, CDI, IPCA (com acumulado 12m), títulos ativos e horário da última coleta |
| `GET /indicadores/{selic\|cdi\|ipca}/historico?desde=AAAA-MM-DD` | Série histórica do indicador |
| `GET /titulos` | Títulos ativos na data base mais recente |
| `GET /titulos/{id}/historico?desde=AAAA-MM-DD` | Histórico de taxas e preços de um título |
| `GET /simulacao?valor=10000&meses=24&pct_cdb=100&pct_lci=90` | Comparação de produtos após IR e custódia |
| `GET /eventos` | Stream SSE: `status`, `atualizacao`, `presenca` |
| `GET /status` | Última execução da ETL e número de conexões SSE |
| `GET /health` | Verificação de saúde |

IDs dos títulos seguem o padrão `tipo-vencimento`, ex.: `tesouro-ipca-2035-05-15`.

## Agendamento e deploy

- `.github/workflows/etl.yml` roda a ETL de segunda a sexta às 18h (Brasília). Basta cadastrar o secret `DATABASE_URL` no repositório.
- `.github/workflows/ci.yml` roda testes, lint e build a cada push.
- **Front**: Vercel, com `NEXT_PUBLIC_API_URL` apontando para a API.
- **API**: precisa de um servidor que mantenha conexões abertas por causa do SSE (Render, Railway, Fly.io). O `backend/Dockerfile` já lê a variável `PORT` dessas plataformas. Funções serverless encerram a conexão depois de alguns segundos.
- **Banco**: Neon (Postgres serverless). A API usa `pool_pre_ping` para descartar conexões que o Neon fechou por inatividade.

## Próximos passos

- [ ] Deploy público
- [ ] Alertas por e-mail ("me avise quando o IPCA+ 2035 passar de 7%")
- [ ] Login para salvar favoritos
