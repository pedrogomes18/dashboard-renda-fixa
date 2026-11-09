"""API do Monitor de Renda Fixa.

Uso:
    uvicorn app.main:app --reload
"""

import asyncio
import contextlib
import math
import os
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select

from app import schemas
from app.db import engine, indicadores, init_db, titulo_historico, titulos
from app.eventos import difusor, ultima_execucao
from app.simulador import Premissas, simular

SERIES = ("selic", "cdi", "ipca")
Serie = Literal["selic", "cdi", "ipca"]


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    tarefa = asyncio.create_task(difusor.monitorar())
    yield
    tarefa.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await tarefa


app = FastAPI(
    title="Monitor de Renda Fixa",
    description="Selic, CDI, IPCA e títulos do Tesouro Direto, com histórico, simulador e eventos em tempo real (SSE).",
    version="2.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ---- consultas ----

def _ultimo_indicador(conn, serie: str) -> dict | None:
    row = conn.execute(
        select(indicadores.c.data, indicadores.c.valor)
        .where(indicadores.c.serie == serie)
        .order_by(indicadores.c.data.desc())
        .limit(1)
    ).first()
    return {"data": row.data, "valor": row.valor} if row else None


def _ipca_12m(conn) -> float | None:
    valores = conn.execute(
        select(indicadores.c.valor)
        .where(indicadores.c.serie == "ipca")
        .order_by(indicadores.c.data.desc())
        .limit(12)
    ).scalars().all()
    if len(valores) < 12:
        return None
    return round((math.prod(1 + v / 100 for v in valores) - 1) * 100, 2)


def _indicadores(conn) -> dict:
    ind = {s: _ultimo_indicador(conn, s) for s in SERIES}
    if ind["ipca"]:
        ind["ipca"]["acumulado_12m"] = _ipca_12m(conn)
    return ind


def _titulos_ativos(conn) -> list[dict]:
    """Títulos presentes na data base mais recente do Tesouro."""
    ultima = conn.execute(select(func.max(titulo_historico.c.data))).scalar()
    if ultima is None:
        return []
    rows = conn.execute(
        select(titulos, titulo_historico.c.data, titulo_historico.c.taxa_compra,
               titulo_historico.c.taxa_venda, titulo_historico.c.pu_compra,
               titulo_historico.c.pu_venda)
        .join(titulo_historico, titulo_historico.c.titulo_id == titulos.c.id)
        .where(titulo_historico.c.data == ultima)
        .order_by(titulos.c.tipo, titulos.c.vencimento)
    ).mappings().all()
    return [dict(r) for r in rows]


def _mais_proximo(ativos: list[dict], tipo: str, alvo: date) -> dict | None:
    """Título à venda de um tipo cujo vencimento fica mais perto da data alvo."""
    candidatos = [t for t in ativos if t["tipo"] == tipo and t["taxa_compra"] is not None]
    return min(candidatos, key=lambda t: abs((t["vencimento"] - alvo).days), default=None)


# ---- rotas ----

@app.get("/", include_in_schema=False)
def raiz():
    return {"api": "Monitor de Renda Fixa", "docs": "/docs"}


@app.get("/health", tags=["infra"])
def health():
    return {"status": "ok"}


@app.get("/status", response_model=schemas.Status, tags=["infra"])
def status():
    """Última execução da ETL e quantos navegadores estão conectados ao SSE."""
    return {"ultima_execucao": ultima_execucao(), "conectados": difusor.conectados}


@app.get("/eventos", tags=["tempo real"], response_class=StreamingResponse)
async def eventos(request: Request):
    """Stream SSE (`text/event-stream`).

    Eventos: `status` (ao conectar), `atualizacao` (ETL terminou, recarregue os dados)
    e `presenca` (quantas pessoas estão com o painel aberto).
    """
    return StreamingResponse(
        difusor.assinar(request.is_disconnected),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/taxas", response_model=schemas.Taxas, tags=["dados"])
def taxas():
    """Valores mais recentes de cada indicador e de cada título ativo."""
    with engine.connect() as conn:
        ind = _indicadores(conn)
        ativos = _titulos_ativos(conn)
    execucao = ultima_execucao()
    return {
        "indicadores": ind,
        "titulos": ativos,
        "atualizado_em": execucao["concluido_em"] if execucao else None,
    }


@app.get("/indicadores/{serie}/historico", response_model=list[schemas.Ponto], tags=["dados"])
def historico_indicador(serie: Serie, desde: date | None = None):
    q = select(indicadores.c.data, indicadores.c.valor).where(indicadores.c.serie == serie)
    if desde:
        q = q.where(indicadores.c.data >= desde)
    with engine.connect() as conn:
        rows = conn.execute(q.order_by(indicadores.c.data)).mappings().all()
    return [dict(r) for r in rows]


@app.get("/titulos", response_model=list[schemas.Titulo], tags=["dados"])
def listar_titulos():
    with engine.connect() as conn:
        return _titulos_ativos(conn)


@app.get("/titulos/{titulo_id}/historico", response_model=schemas.HistoricoTitulo, tags=["dados"])
def historico_titulo(titulo_id: str, desde: date | None = None):
    with engine.connect() as conn:
        titulo = conn.execute(select(titulos).where(titulos.c.id == titulo_id)).mappings().first()
        if not titulo:
            raise HTTPException(404, "Título não encontrado")
        q = select(
            titulo_historico.c.data, titulo_historico.c.taxa_compra, titulo_historico.c.taxa_venda,
            titulo_historico.c.pu_compra, titulo_historico.c.pu_venda,
        ).where(titulo_historico.c.titulo_id == titulo_id)
        if desde:
            q = q.where(titulo_historico.c.data >= desde)
        rows = conn.execute(q.order_by(titulo_historico.c.data)).mappings().all()
    return {"titulo": dict(titulo), "historico": [dict(r) for r in rows]}


@app.get("/simulacao", response_model=schemas.Simulacao, tags=["simulador"])
def simulacao(
    valor: float = Query(10_000, gt=0, le=100_000_000, description="Valor investido (R$)"),
    meses: int = Query(24, ge=1, le=360, description="Prazo em meses"),
    pct_cdb: float = Query(100, gt=0, le=200, description="Rentabilidade do CDB, % do CDI"),
    pct_lci: float = Query(90, gt=0, le=200, description="Rentabilidade da LCI/LCA, % do CDI"),
):
    """Compara o valor líquido (após IR e custódia) em cada produto, com as taxas de hoje."""
    with engine.connect() as conn:
        ind = _indicadores(conn)
        ativos = _titulos_ativos(conn)
    if not (ind["cdi"] and ind["selic"] and ind["ipca"] and ind["ipca"]["acumulado_12m"] is not None):
        raise HTTPException(503, "Ainda não há dados suficientes. Rode a ETL primeiro.")

    alvo = date.today() + timedelta(days=round(meses * 30.44))
    pre = _mais_proximo(ativos, "Tesouro Prefixado", alvo)
    ipca = _mais_proximo(ativos, "Tesouro IPCA+", alvo)
    selic = _mais_proximo(ativos, "Tesouro Selic", alvo)
    premissas = Premissas(
        cdi=ind["cdi"]["valor"],
        selic=ind["selic"]["valor"],
        ipca_12m=ind["ipca"]["acumulado_12m"],
        taxa_prefixado=pre["taxa_compra"] if pre else None,
        taxa_ipca_real=ipca["taxa_compra"] if ipca else None,
        spread_selic=selic["taxa_compra"] if selic else 0.0,
    )
    return simular(valor, meses, premissas, pct_cdb, pct_lci)
