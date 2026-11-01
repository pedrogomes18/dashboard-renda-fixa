"""API do Monitor de Renda Fixa.

Uso:
    uvicorn app.main:app --reload
"""

import math
import os
from contextlib import asynccontextmanager
from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from app.db import engine, indicadores, init_db, titulo_historico, titulos

SERIES = ("selic", "cdi", "ipca")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Monitor de Renda Fixa", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)


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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/taxas")
def taxas():
    """Valores mais recentes de cada indicador e de cada título ativo."""
    with engine.connect() as conn:
        ind = {s: _ultimo_indicador(conn, s) for s in SERIES}
        if ind["ipca"]:
            ind["ipca"]["acumulado_12m"] = _ipca_12m(conn)
        return {"indicadores": ind, "titulos": _titulos_ativos(conn)}


@app.get("/indicadores/{serie}/historico")
def historico_indicador(serie: str, desde: date | None = None):
    if serie not in SERIES:
        raise HTTPException(404, f"Série desconhecida. Use uma de: {', '.join(SERIES)}")
    q = select(indicadores.c.data, indicadores.c.valor).where(indicadores.c.serie == serie)
    if desde:
        q = q.where(indicadores.c.data >= desde)
    with engine.connect() as conn:
        rows = conn.execute(q.order_by(indicadores.c.data)).mappings().all()
    return [dict(r) for r in rows]


@app.get("/titulos")
def listar_titulos():
    with engine.connect() as conn:
        return _titulos_ativos(conn)


@app.get("/titulos/{titulo_id}/historico")
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
