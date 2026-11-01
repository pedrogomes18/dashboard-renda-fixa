from datetime import date

from app.etl import parse_num_br, parse_sgs, parse_tesouro_csv, titulo_id

CSV_EXEMPLO = """Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha
Tesouro IPCA+;15/05/2035;30/10/2026;7,12;7,24;2345,67;2330,10;2330,10
Tesouro IPCA+;15/05/2035;29/10/2026;7,10;7,22;2346,00;2331,00;2331,00
Tesouro Selic;01/03/2029;30/10/2026;0,06;;20185,67;20170,66;20170,66
Tesouro Selic;01/03/2029;02/01/2020;0,01;0,02;10000,00;9999,00;9999,00
"""


def test_parse_num_br():
    assert parse_num_br("20185,67") == 20185.67
    assert parse_num_br("1.234,5") == 1234.5
    assert parse_num_br("") is None


def test_titulo_id():
    assert titulo_id("Tesouro IPCA+", date(2035, 5, 15)) == "tesouro-ipca-2035-05-15"
    assert titulo_id("Tesouro IPCA+ com Juros Semestrais", date(2035, 5, 15)) == (
        "tesouro-ipca-com-juros-semestrais-2035-05-15"
    )


def test_parse_sgs_ignora_datas_futuras():
    payload = [
        {"data": "30/10/2026", "valor": "13.75"},
        {"data": "05/11/2026", "valor": "13.75"},
    ]
    rows = parse_sgs(payload, "selic", ate=date(2026, 11, 1))
    assert rows == [{"serie": "selic", "data": date(2026, 10, 30), "valor": 13.75}]


def test_parse_tesouro_csv():
    cad, hist = parse_tesouro_csv(CSV_EXEMPLO, desde=date(2025, 1, 1))

    assert {t["id"] for t in cad} == {"tesouro-ipca-2035-05-15", "tesouro-selic-2029-03-01"}
    assert len(hist) == 3  # a linha de 2020 fica de fora

    primeira = hist[0]
    assert primeira["taxa_compra"] == 7.12
    assert primeira["pu_venda"] == 2330.10
    assert hist[2]["taxa_venda"] is None
