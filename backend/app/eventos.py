"""Server-Sent Events: avisa os navegadores conectados quando chegam dados novos.

A ETL roda em outro processo (GitHub Actions), então a API não "sabe" quando ela
termina. Uma única tarefa em segundo plano consulta a tabela etl_execucoes a cada
poucos segundos e, quando aparece uma execução nova, publica um evento para todos
os clientes. Cada cliente tem sua própria fila; o difusor só distribui.
"""

import asyncio
import json
import os
from collections.abc import AsyncIterator
from datetime import timezone

from fastapi.encoders import jsonable_encoder
from sqlalchemy import select

from app.db import engine, etl_execucoes

INTERVALO_VERIFICACAO = float(os.getenv("SSE_INTERVALO", "10"))  # segundos
INTERVALO_PING = 15.0  # comentário periódico para proxies não fecharem a conexão


def formatar(evento: str, dados) -> str:
    """Monta uma mensagem no formato text/event-stream."""
    return f"event: {evento}\ndata: {json.dumps(jsonable_encoder(dados), ensure_ascii=False)}\n\n"


def ultima_execucao() -> dict | None:
    with engine.connect() as conn:
        row = conn.execute(
            select(etl_execucoes).order_by(etl_execucoes.c.id.desc()).limit(1)
        ).mappings().first()
    if not row:
        return None
    execucao = dict(row)
    # SQLite não guarda fuso: os horários foram gravados em UTC, então marcamos como tal.
    for campo in ("iniciado_em", "concluido_em"):
        if execucao[campo].tzinfo is None:
            execucao[campo] = execucao[campo].replace(tzinfo=timezone.utc)
    return execucao


class Difusor:
    def __init__(self) -> None:
        self._filas: set[asyncio.Queue] = set()
        # Última execução já conhecida pelos clientes; None = ainda não sincronizado.
        self._id_visto: int | None = None
        self._sincronizado = False

    @property
    def conectados(self) -> int:
        return len(self._filas)

    def publicar(self, evento: str, dados) -> None:
        msg = formatar(evento, dados)
        for fila in list(self._filas):
            try:
                fila.put_nowait(msg)
            except asyncio.QueueFull:
                pass  # cliente lento: perde a mensagem, mas não trava os outros

    def _presenca(self) -> None:
        self.publicar("presenca", {"conectados": self.conectados})

    async def assinar(self, desconectado) -> AsyncIterator[str]:
        """Gera as mensagens de um cliente até ele desconectar."""
        fila: asyncio.Queue = asyncio.Queue(maxsize=20)
        self._filas.add(fila)
        self._presenca()
        try:
            yield "retry: 5000\n\n"  # o navegador tenta reconectar após 5 s
            yield formatar("status", {
                "ultima_execucao": await asyncio.to_thread(ultima_execucao),
                "conectados": self.conectados,
            })
            while not await desconectado():
                try:
                    yield await asyncio.wait_for(fila.get(), timeout=INTERVALO_PING)
                except TimeoutError:
                    yield ": ping\n\n"
        finally:
            self._filas.discard(fila)
            self._presenca()

    async def monitorar(self) -> None:
        """Loop de fundo: detecta execuções novas da ETL e avisa todo mundo.

        Sem ninguém conectado, não consulta o banco, para o Postgres serverless
        poder hibernar. Quem conecta recebe o estado atual no evento "status".
        """
        while True:
            await asyncio.sleep(INTERVALO_VERIFICACAO)
            if not self.conectados:
                self._sincronizado = False
                continue
            try:
                atual = await asyncio.to_thread(ultima_execucao)
            except Exception as e:  # banco fora do ar não pode derrubar a API
                print(f"[sse] falha ao consultar execuções: {e}")
                continue
            id_atual = atual["id"] if atual else None
            if not self._sincronizado:
                # Chegou antes do "status" do cliente: só registra, quem conecta já lê o estado atual.
                self._id_visto, self._sincronizado = id_atual, True
            elif id_atual is not None and id_atual != self._id_visto:
                self._id_visto = id_atual
                self.publicar("atualizacao", atual)


difusor = Difusor()
