import asyncio
import json

from app.eventos import Difusor, formatar


def test_formatar_mensagem_sse():
    assert formatar("presenca", {"conectados": 2}) == 'event: presenca\ndata: {"conectados": 2}\n\n'


def _eventos(mensagens):
    """Converte mensagens SSE em (evento, dados), ignorando retry/ping."""
    saida = []
    for m in mensagens:
        if m.startswith("event:"):
            nome, dados = m.strip().split("\n")
            saida.append((nome.removeprefix("event: "), json.loads(dados.removeprefix("data: "))))
    return saida


def test_assinante_recebe_status_presenca_e_atualizacao(monkeypatch):
    monkeypatch.setattr("app.eventos.ultima_execucao", lambda: None)

    async def cenario():
        difusor = Difusor()
        fim = asyncio.Event()

        async def desconectado():
            return fim.is_set()

        recebidas = []

        async def cliente():
            async for msg in difusor.assinar(desconectado):
                recebidas.append(msg)
                if "atualizacao" in msg:
                    fim.set()

        tarefa = asyncio.create_task(cliente())
        await asyncio.sleep(0.05)
        assert difusor.conectados == 1
        difusor.publicar("atualizacao", {"id": 7})
        await asyncio.wait_for(tarefa, timeout=2)
        assert difusor.conectados == 0
        return recebidas

    recebidas = asyncio.run(cenario())
    assert recebidas[0] == "retry: 5000\n\n"
    assert _eventos(recebidas) == [
        ("status", {"ultima_execucao": None, "conectados": 1}),
        ("presenca", {"conectados": 1}),
        ("atualizacao", {"id": 7}),
    ]
