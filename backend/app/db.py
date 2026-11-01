"""Conexão com o banco e definição das tabelas.

Localmente usa SQLite (arquivo renda_fixa.db). Em produção, basta definir
DATABASE_URL apontando para um PostgreSQL (Neon, Supabase...).
"""

import os

from sqlalchemy import Column, Date, Float, MetaData, String, Table, create_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./renda_fixa.db")

engine = create_engine(DATABASE_URL)
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
