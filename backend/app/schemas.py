"""Modelos de resposta da API (aparecem documentados em /docs)."""

from datetime import date, datetime

from pydantic import BaseModel


class Ponto(BaseModel):
    data: date
    valor: float


class Indicador(Ponto):
    acumulado_12m: float | None = None


class Indicadores(BaseModel):
    selic: Indicador | None
    cdi: Indicador | None
    ipca: Indicador | None


class TituloBase(BaseModel):
    id: str
    tipo: str
    vencimento: date


class Cotacao(BaseModel):
    data: date
    taxa_compra: float | None
    taxa_venda: float | None
    pu_compra: float | None
    pu_venda: float | None


class Titulo(TituloBase, Cotacao):
    pass


class HistoricoTitulo(BaseModel):
    titulo: TituloBase
    historico: list[Cotacao]


class Execucao(BaseModel):
    id: int
    iniciado_em: datetime
    concluido_em: datetime
    origem: str
    registros: int


class Taxas(BaseModel):
    indicadores: Indicadores
    titulos: list[Titulo]
    atualizado_em: datetime | None


class Status(BaseModel):
    ultima_execucao: Execucao | None
    conectados: int


class PremissasSimulacao(BaseModel):
    cdi: float
    selic: float
    ipca_12m: float
    taxa_prefixado: float | None
    taxa_ipca_real: float | None
    spread_selic: float


class ProdutoSimulado(BaseModel):
    produto: str
    taxa_aa: float
    bruto: float
    imposto: float
    custodia: float
    liquido: float
    liquido_real: float
    rentabilidade_liquida: float
    evolucao: list[float]


class Simulacao(BaseModel):
    valor: float
    meses: int
    aliquota_ir: float
    premissas: PremissasSimulacao
    produtos: list[ProdutoSimulado]
