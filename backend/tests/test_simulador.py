import pytest

from app.simulador import Premissas, aliquota_ir, simular, taxa_poupanca

P = Premissas(cdi=12.0, selic=12.0, ipca_12m=4.0, taxa_prefixado=13.0, taxa_ipca_real=7.0)


@pytest.mark.parametrize(("dias", "esperado"), [(30, 22.5), (180, 22.5), (181, 20.0), (720, 17.5), (721, 15.0)])
def test_aliquota_ir(dias, esperado):
    assert aliquota_ir(dias) == esperado


def test_poupanca_segue_regra_da_selic():
    assert taxa_poupanca(13.75) == pytest.approx(6.17, abs=0.01)
    assert taxa_poupanca(7.0) == pytest.approx(4.9)


def _por_nome(resultado):
    return {p["produto"]: p for p in resultado["produtos"]}


def test_cdb_um_ano():
    r = _por_nome(simular(10_000, 12, P))
    cdb = r["CDB 100% do CDI"]
    assert cdb["bruto"] == pytest.approx(11_200, abs=0.5)
    assert cdb["imposto"] == pytest.approx(1_200 * 0.20, abs=0.5)  # 12 meses = 360 dias -> 20%
    assert len(cdb["evolucao"]) == 13


def test_lci_isenta_e_tesouro_paga_custodia():
    r = _por_nome(simular(50_000, 36, P))
    assert r["LCI/LCA 90% do CDI"]["imposto"] == 0
    assert r["Tesouro Prefixado"]["custodia"] > 0
    assert r["CDB 100% do CDI"]["custodia"] == 0


def test_tesouro_selic_isento_de_custodia_ate_10_mil():
    r = _por_nome(simular(8_000, 24, P))
    assert r["Tesouro Selic"]["custodia"] == 0


def test_ipca_combina_juro_real_e_inflacao():
    r = _por_nome(simular(1_000, 12, P))
    assert r["Tesouro IPCA+"]["taxa_aa"] == pytest.approx(11.28)  # 1,07 * 1,04 - 1


def test_ordena_do_maior_para_o_menor_liquido():
    liquidos = [p["liquido"] for p in simular(10_000, 60, P)["produtos"]]
    assert liquidos == sorted(liquidos, reverse=True)


def test_sem_titulos_disponiveis_simula_so_o_resto():
    r = simular(1_000, 12, Premissas(cdi=10, selic=10, ipca_12m=4))
    assert {p["produto"] for p in r["produtos"]} == {
        "Poupança", "CDB 100% do CDI", "LCI/LCA 90% do CDI", "Tesouro Selic"
    }
