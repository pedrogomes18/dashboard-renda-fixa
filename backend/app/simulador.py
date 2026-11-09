"""Simulador de investimentos em renda fixa.

Compara quanto um valor rende em cada produto, já descontando IR e custódia.
É uma estimativa: supõe que as taxas de hoje (CDI, Selic, IPCA dos últimos 12 meses)
se mantêm durante todo o período.
"""

from dataclasses import dataclass

CUSTODIA_B3 = 0.20  # % ao ano sobre o saldo dos títulos do Tesouro
ISENCAO_CUSTODIA_SELIC = 10_000.0  # Tesouro Selic não paga custódia até R$ 10 mil


@dataclass
class Premissas:
    cdi: float  # % a.a.
    selic: float  # % a.a.
    ipca_12m: float  # % (usado como inflação esperada)
    taxa_prefixado: float | None = None  # % a.a. do Prefixado com vencimento mais próximo
    taxa_ipca_real: float | None = None  # juro real % a.a. do IPCA+ mais próximo
    spread_selic: float = 0.0  # ágio/deságio do Tesouro Selic, % a.a.


def aliquota_ir(dias: int) -> float:
    """Tabela regressiva do IR para renda fixa."""
    if dias <= 180:
        return 22.5
    if dias <= 360:
        return 20.0
    if dias <= 720:
        return 17.5
    return 15.0


def taxa_poupanca(selic: float) -> float:
    """Regra da poupança (sem TR): 0,5% ao mês se Selic > 8,5%, senão 70% da Selic."""
    if selic > 8.5:
        return ((1.005**12) - 1) * 100
    return selic * 0.7


def _produto(nome: str, taxa_aa: float, valor: float, meses: int, *, ir: bool,
             custodia_sobre: float = 0.0) -> dict:
    """custodia_sobre: parcela do valor investido sujeita à custódia (0 = isento)."""
    fator_mes = (1 + taxa_aa / 100) ** (1 / 12)
    evolucao = [round(valor * fator_mes**m, 2) for m in range(meses + 1)]
    bruto = evolucao[-1]
    lucro = bruto - valor
    anos = meses / 12

    custodia = 0.0
    if custodia_sobre > 0:
        saldo_medio = custodia_sobre * (1 + bruto / valor) / 2
        custodia = saldo_medio * CUSTODIA_B3 / 100 * anos

    imposto = max(lucro - custodia, 0) * aliquota_ir(meses * 30) / 100 if ir else 0.0
    liquido = bruto - imposto - custodia
    return {
        "produto": nome,
        "taxa_aa": round(taxa_aa, 2),
        "bruto": round(bruto, 2),
        "imposto": round(imposto, 2),
        "custodia": round(custodia, 2),
        "liquido": round(liquido, 2),
        "rentabilidade_liquida": round((liquido / valor - 1) * 100, 2),
        "evolucao": evolucao,
    }


def simular(valor: float, meses: int, p: Premissas, pct_cdb: float = 100, pct_lci: float = 90) -> dict:
    produtos = [
        _produto("Poupança", taxa_poupanca(p.selic), valor, meses, ir=False),
        _produto(f"CDB {pct_cdb:g}% do CDI", p.cdi * pct_cdb / 100, valor, meses, ir=True),
        _produto(f"LCI/LCA {pct_lci:g}% do CDI", p.cdi * pct_lci / 100, valor, meses, ir=False),
        _produto("Tesouro Selic", p.selic + p.spread_selic, valor, meses, ir=True,
                 custodia_sobre=max(valor - ISENCAO_CUSTODIA_SELIC, 0)),
    ]
    if p.taxa_prefixado is not None:
        produtos.append(_produto("Tesouro Prefixado", p.taxa_prefixado, valor, meses, ir=True,
                                 custodia_sobre=valor))
    if p.taxa_ipca_real is not None:
        nominal = ((1 + p.taxa_ipca_real / 100) * (1 + p.ipca_12m / 100) - 1) * 100
        produtos.append(_produto("Tesouro IPCA+", nominal, valor, meses, ir=True, custodia_sobre=valor))

    inflacao = (1 + p.ipca_12m / 100) ** (meses / 12)
    for prod in produtos:
        prod["liquido_real"] = round(prod["liquido"] / inflacao, 2)

    produtos.sort(key=lambda x: x["liquido"], reverse=True)
    return {
        "valor": valor,
        "meses": meses,
        "aliquota_ir": aliquota_ir(meses * 30),
        "premissas": p.__dict__,
        "produtos": produtos,
    }
