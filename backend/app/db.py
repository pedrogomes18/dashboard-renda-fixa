"""Conexão com o banco e definição das tabelas.

Localmente usa SQLite (arquivo renda_fixa.db). Em produção, basta definir
DATABASE_URL apontando para um PostgreSQL (Neon, Supabase...).
"""

import os
from pathlib import Path

from sqlalchemy import Column, Date, DateTime, Float, Integer, MetaData, String, Table, create_engine

# Caminho fixo (backend/renda_fixa.db), para não depender da pasta onde o comando roda.
_SQLITE_PADRAO = Path(__file__).resolve().parent.parent / "renda_fixa.db"
DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite:///{_SQLITE_PADRAO.as_posix()}"
# Alguns provedores entregam "postgres://", que o SQLAlchemy não aceita.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# pool_pre_ping descarta conexões que o Postgres serverless (Neon) fechou por inatividade.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
metadata = MetaData()

# Uma linha por dia por indicador (selic, cdi, ipca).
indicadores = Table(
    "indicadores",
    metadata,
    Column("serie", String(20), primary_key=True),
    Column("data", Date, primary_key=True),
    Column("valor", Float, nullable=False),
)

# Cadastro dos títulos do Tesouro Direto.
titulos = Table(
    "titulos",
    metadata,
    Column("id", String(100), primary_key=True),
    Column("tipo", String(100), nullable=False),
    Column("vencimento", Date, nullable=False),
)

# Uma linha por dia por título.
titulo_historico = Table(
    "titulo_historico",
    metadata,
    Column("titulo_id", String(100), primary_key=True),
    Column("data", Date, primary_key=True),
    Column("taxa_compra", Float),
    Column("taxa_venda", Float),
    Column("pu_compra", Float),
    Column("pu_venda", Float),
)


# Uma linha por execução da ETL. A API observa esta tabela para avisar o front (SSE).
etl_execucoes = Table(
    "etl_execucoes",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("iniciado_em", DateTime(timezone=True), nullable=False),
    Column("concluido_em", DateTime(timezone=True), nullable=False),
    Column("origem", String(30), nullable=False),
    Column("registros", Integer, nullable=False),
)


def init_db() -> None:
    metadata.create_all(engine)


def upsert(conn, table: Table, rows: list[dict], chunk_size: int = 5000) -> None:
    """Insere linhas e, se a chave já existir, atualiza os valores."""
    if not rows:
        return

    if conn.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert

    keys = [c.name for c in table.primary_key.columns]
    stmt = insert(table)
    update_cols = {c.name: stmt.excluded[c.name] for c in table.columns if c.name not in keys}
    stmt = stmt.on_conflict_do_update(index_elements=keys, set_=update_cols)

    for i in range(0, len(rows), chunk_size):
        conn.execute(stmt, rows[i : i + chunk_size])
