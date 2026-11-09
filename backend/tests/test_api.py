from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.db import engine, indicadores, init_db, metadata, titulo_historico, titulos, upsert
from app.main import app


@pytest.fixture(scope="module")
def client():
    init_db()
    with engine.begin() as conn:
        for t in reversed(metadata.sorted_tables):
            conn.execute(t.delete())
        ipca = [{"serie": "ipca", "data": date(2026, m, 1), "valor": 0.5} for m in range(1, 13)]
        upsert(conn, indicadores, ipca + [
            {"serie": "selic", "data": date(2026, 10, 1), "valor": 14.0},
            {"serie": "selic", "data": date(2026, 11, 1), "valor": 13.75},
            {"serie": "cdi", "data": date(2026, 10, 30), "valor": 13.65},
        ])
        upsert(conn, titulos, [
            {"id": "tesouro-ipca-2035-05-15", "tipo": "Tesouro IPCA+", "vencimento": date(2035, 5, 15)},
            {"id": "tesouro-selic-2020-03-01", "tipo": "Tesouro Selic", "vencimento": date(2020, 3, 1)},
        ])
        upsert(conn, titulo_historico, [
            {"titulo_id": "tesouro-ipca-2035-05-15", "data": date(2026, 10, 29), "taxa_compra": 7.1,
             "taxa_venda": 7.2, "pu_compra": 2300.0, "pu_venda": 2290.0},
            {"titulo_id": "tesouro-ipca-2035-05-15", "data": date(2026, 10, 30), "taxa_compra": 7.12,
             "taxa_venda": 7.24, "pu_compra": 2345.67, "pu_venda": 2330.1},
            # título vencido: só aparece em datas antigas, não deve ser listado como ativo
            {"titulo_id": "tesouro-selic-2020-03-01", "data": date(2020, 1, 2), "taxa_compra": 0.01,
             "taxa_venda": 0.02, "pu_compra": 10000.0, "pu_venda": 9999.0},
        ])
    with TestClient(app) as c:
        yield c


def test_taxas(client):
    body = client.get("/taxas").json()
    assert body["indicadores"]["selic"] == {"data": "2026-11-01", "valor": 13.75, "acumulado_12m": None}
    assert body["indicadores"]["cdi"]["valor"] == 13.65
    assert body["indicadores"]["ipca"]["acumulado_12m"] == 6.17  # 1.005^12 - 1
    assert [t["id"] for t in body["titulos"]] == ["tesouro-ipca-2035-05-15"]


def test_historico_indicador_filtra_por_data(client):
    resp = client.get("/indicadores/selic/historico", params={"desde": "2026-10-15"})
    assert resp.json() == [{"data": "2026-11-01", "valor": 13.75}]


def test_serie_desconhecida(client):
    assert client.get("/indicadores/poupanca/historico").status_code == 422


def test_historico_titulo(client):
    body = client.get("/titulos/tesouro-ipca-2035-05-15/historico").json()
    assert body["titulo"]["tipo"] == "Tesouro IPCA+"
    assert [h["data"] for h in body["historico"]] == ["2026-10-29", "2026-10-30"]
    assert client.get("/titulos/nao-existe/historico").status_code == 404


def test_simulacao_usa_taxas_do_banco(client):
    body = client.get("/simulacao", params={"valor": 1000, "meses": 120}).json()
    assert body["premissas"]["cdi"] == 13.65
    assert body["premissas"]["taxa_ipca_real"] == 7.12  # IPCA+ 2035 é o mais próximo de 10 anos
    assert body["premissas"]["taxa_prefixado"] is None  # não há prefixado no banco de teste
    assert "Tesouro IPCA+" in {p["produto"] for p in body["produtos"]}


def test_simulacao_valida_parametros(client):
    assert client.get("/simulacao", params={"valor": -1}).status_code == 422


def test_status(client):
    body = client.get("/status").json()
    assert body["ultima_execucao"] is None
    assert body["conectados"] == 0
