"""ETL diário: baixa dados do Banco Central e do Tesouro Direto e salva no banco.

Uso:
    python -m app.etl            # últimos 3 anos
    python -m app.etl --anos 5
"""

import argparse
import csv
import io
import re
import unicodedata
from datetime import date, datetime, timedelta

import httpx

from app.db import engine, indicadores, init_db, titulo_historico, titulos, upsert

# Códigos das séries no SGS do Banco Central.
SERIES_SGS = {
    "selic": 432,  # Meta Selic definida pelo Copom (% a.a.)
    "cdi": 4389,  # CDI anualizado base 252 (% a.a.)
    "ipca": 433,  # IPCA variação mensal (%)
}
SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados"
TESOURO_CSV_URL = (
    "https://www.tesourotransparente.gov.br/ckan/dataset/"
    "df56aa42-484a-4a59-8184-7676580c81e3/resource/"
    "796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv"
)


def parse_data_br(texto: str) -> date:
    return datetime.strptime(texto.strip(), "%d/%m/%Y").date()


def parse_num_br(texto: str) -> float | None:
    texto = texto.strip()
    if not texto:
        return None
    return float(texto.replace(".", "").replace(",", "."))


def slugify(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", texto.lower()).strip("-")


def titulo_id(tipo: str, vencimento: date) -> str:
    """Ex.: ('Tesouro IPCA+', 2035-05-15) -> 'tesouro-ipca-2035-05-15'."""
    return f"{slugify(tipo)}-{vencimento.isoformat()}"


def parse_sgs(payload: list[dict], serie: str, ate: date) -> list[dict]:
    # A série da meta Selic traz dias futuros já com a taxa vigente; ignoramos.
    rows = []
    for item in payload:
        data = parse_data_br(item["data"])
        if data <= ate:
            rows.append({"serie": serie, "data": data, "valor": float(item["valor"])})
    return rows


def parse_tesouro_csv(texto: str, desde: date) -> tuple[list[dict], list[dict]]:
    """Retorna (titulos, historico) a partir do CSV público do Tesouro."""
    cadastro: dict[str, dict] = {}
    historico = []

    for linha in csv.DictReader(io.StringIO(texto), delimiter=";"):
        data = parse_data_br(linha["Data Base"])
        if data < desde:
            continue
        tipo = linha["Tipo Titulo"].strip()
        vencimento = parse_data_br(linha["Data Vencimento"])
        tid = titulo_id(tipo, vencimento)

        cadastro[tid] = {"id": tid, "tipo": tipo, "vencimento": vencimento}
        historico.append(
            {
                "titulo_id": tid,
                "data": data,
                "taxa_compra": parse_num_br(linha["Taxa Compra Manha"]),
                "taxa_venda": parse_num_br(linha["Taxa Venda Manha"]),
                "pu_compra": parse_num_br(linha["PU Compra Manha"]),
                "pu_venda": parse_num_br(linha["PU Venda Manha"]),
            }
        )

    return list(cadastro.values()), historico


def baixar_sgs(client: httpx.Client, codigo: int, desde: date, ate: date) -> list[dict]:
    resp = client.get(
        SGS_URL.format(codigo=codigo),
        params={
            "formato": "json",
            "dataInicial": desde.strftime("%d/%m/%Y"),
            "dataFinal": ate.strftime("%d/%m/%Y"),
        },
    )
    resp.raise_for_status()
    return resp.json()


def baixar_tesouro(client: httpx.Client) -> str:
    resp = client.get(TESOURO_CSV_URL, follow_redirects=True)
    resp.raise_for_status()
    try:
        return resp.content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return resp.content.decode("latin-1")


def run(anos: int = 3) -> None:
    hoje = date.today()
    desde = hoje - timedelta(days=365 * anos)
    init_db()

    with httpx.Client(timeout=120) as client:
        rows_ind = []
        for serie, codigo in SERIES_SGS.items():
            rows = parse_sgs(baixar_sgs(client, codigo, desde, hoje), serie, hoje)
            print(f"[bcb] {serie}: {len(rows)} registros")
            rows_ind.extend(rows)

        cad, hist = parse_tesouro_csv(baixar_tesouro(client), desde)
        print(f"[tesouro] {len(cad)} títulos, {len(hist)} registros")

    with engine.begin() as conn:
        upsert(conn, indicadores, rows_ind)
        upsert(conn, titulos, cad)
        upsert(conn, titulo_historico, hist)
    print("ETL concluído.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--anos", type=int, default=3)
    run(parser.parse_args().anos)
