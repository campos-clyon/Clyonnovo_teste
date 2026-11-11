import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * A LISTA DOS PARCEIROS NO SERVIDOR E A ESCOLHA CONFERIDA — 10-11-2026 (fase 2).
 *
 * Com a base, o Google e a distribuição fingidos: o id que o cliente vê é
 * opaco; um id que não é de um parceiro elegível COM tarifa activa recusa o
 * pedido; a tarifa congela-se na negociação de cada escolhido; o envio vai só
 * aos escolhidos (soPara ∩ elegíveis); e com o interruptor desligado é o
 * caminho de antes.
 */

const estado = vi.hoisted(() => ({
  ligado: true,
  candidatos: [] as unknown[],
  distribuir: [] as unknown[],
  prova: [] as unknown[],
  historico: [] as unknown[],
}));

vi.mock("@/lib/db", () => ({
  candidatosDaListaDasMudancas: vi.fn(async () => estado.candidatos),
  listaDeParceirosNasMudancasLigada: vi.fn(async () => estado.ligado),
  gravarEscolhaDosParceiros: vi.fn(async (id: number, p: unknown) => {
    estado.prova.push({ id, p });
  }),
  appendOrderHistory: vi.fn(async (id: number, h: unknown) => {
    estado.historico.push({ id, h });
  }),
}));
vi.mock("@/lib/distancia-rodoviaria", () => ({
  distanciaRodoviaria: vi.fn(async () => ({ km: 20, minutos: 25, origem: "estrada" })),
  // Da base de cada parceiro à origem: o 1 está perto, o 2 fora do raio.
  distanciasRodoviarias: vi.fn(async (pares: Array<{ origem: { lat: number } | null }>) =>
    pares.map((p) => (p.origem ? { km: p.origem.lat > 39 ? 90 : 10, minutos: null, origem: "estrada" } : null)),
  ),
}));
vi.mock("@/lib/geocodificar", () => ({ geocodificarMorada: vi.fn(async () => null) }));
vi.mock("@/lib/bloqueio-do-profissional", () => ({ profissionaisBloqueadosEmDinheiro: vi.fn(async () => new Set<number>()) }));
vi.mock("@/lib/distribuir-pedido", () => ({
  distribuirPedido: vi.fn(async (pedido: unknown, opcoes: unknown) => {
    estado.distribuir.push({ pedido, opcoes });
    return { avisados: 1, receberam: 1, falhados: 0, candidatos: 1, jaTinham: 0, motivos: {} };
  }),
  resumoDaDistribuicao: vi.fn(() => "Chegou a 1."),
}));
vi.mock("@/lib/avisos-do-backoffice", () => ({ avisarCliente: vi.fn(async () => undefined) }));

process.env.JWT_SECRET = "segredo-de-teste";

import { conferirEscolha, idOpacoDoParceiro, lerPedidoDaLista, listaDosParceirosDaMudanca, respostaDaLista } from "./parceiros-da-mudanca";
import { enviarAosEscolhidos, pedidoDaListaDoPedido, prepararEscolhaDaMudanca } from "./mudanca-com-parceiros-escolhidos";
import { congelarTarifa, tarifaCongeladaDeJson } from "./conta-da-mudanca";

const TARIFA = {
  precoHora2: 40,
  precoHora3: null,
  minimoHoras: 3,
  precoKm: 0.5,
  kmMinimo: 0,
  kmMaximo: 80,
  caixa: 2,
  cartaoMetro: null,
  filmeRolo: 10,
  plasticoBolhaRolo: null,
  aparecerNaLista: true,
};

function candidato(id: number, mais: Record<string, unknown> = {}) {
  return {
    id,
    nome: `Parceiro ${id}`,
    email: `p${id}@exemplo.pt`,
    telefone: "912345678",
    avisaPorWhatsApp: true,
    isActive: true,
    estado: "aprovado",
    categorias: ["mudancas"],
    raioKm: 50,
    emiteFatura: true,
    emiteGuiaTransporte: false,
    guiaVerificadaEm: null,
    baseLat: 38.6,
    baseLng: -9.1,
    contaDeTeste: false,
    verificado: false,
    fotografia: null,
    tarifa: TARIFA,
    notaMedia: null,
    avaliacoes: 0,
    ...mais,
  };
}

const ORDER = {
  serviceType: "mudanca",
  tipologia: "T2",
  originAddress: { lat: 38.64, lng: -9.1, formattedAddress: "Rua A, Seixal", city: "Seixal" },
  destinationAddress: { lat: 38.68, lng: -9.16, formattedAddress: "Rua B, Almada", city: "Almada" },
  originAccess: { difficultAccess: false },
  destinationAccess: {},
  pessoas: 2,
};

beforeEach(() => {
  estado.ligado = true;
  estado.candidatos = [
    candidato(1),
    candidato(2, { baseLat: 40 }), // fora do raio
    candidato(3, { contaDeTeste: true }),
    candidato(4, { tarifa: { ...TARIFA, aparecerNaLista: false } }),
    candidato(5, { estado: "suspenso" }),
  ];
  estado.distribuir = [];
  estado.prova = [];
  estado.historico = [];
});

describe("a lista no servidor", () => {
  it("só os elegíveis com tarifa activa, com o id opaco", async () => {
    const lido = lerPedidoDaLista({ origem: ORDER.originAddress, destino: ORDER.destinationAddress, tipologia: "T2", pessoas: 2 });
    expect(lido.ok).toBe(true);
    if (!lido.ok) return;
    const r = await listaDosParceirosDaMudanca(lido.pedido);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cartoes.map((c) => c.nome)).toEqual(["Parceiro 1"]);
    expect(r.cartoes[0].id).toBe(idOpacoDoParceiro(1));
    expect(r.cartoes[0].id).not.toContain("1");
    const resposta = respostaDaLista(lido.pedido, r);
    // O mapa interno (com o número da base) nunca sai na resposta.
    expect(JSON.stringify(resposta)).not.toContain("escolhiveis");
    expect(JSON.stringify(resposta)).not.toContain("p1@exemplo.pt");
    expect(JSON.stringify(resposta)).not.toContain("912345678");
    expect(resposta.resumo).toBe("T2 · Seixal → Almada · entre 6,5 e 9 h com 2 pessoas");
    expect([resposta.horasMinimo, resposta.horasMaximo, resposta.pessoas, resposta.soComTres]).toEqual([6.5, 9, 2, false]);
    expect(resposta.recomendaTres).toBeNull();
    expect(resposta.ordenacao.frase).toBeTruthy();
  });

  it("T3 e T4+ com 2 pessoas pedidas: a rota responde como 3 e di-lo (a app publicada pede 2 por omissão)", async () => {
    for (const [tipologia, horas] of [["T3", [7, 9]], ["T4+", [9, 12]]] as const) {
      const lido = lerPedidoDaLista({ origem: ORDER.originAddress, destino: ORDER.destinationAddress, tipologia, pessoas: 2 });
      if (!lido.ok) throw new Error(lido.erro);
      expect([lido.pedido.pessoas, lido.pedido.pessoasPedidas, lido.pedido.soComTres]).toEqual([3, 2, true]);
      const r = await listaDosParceirosDaMudanca(lido.pedido);
      if (!r.ok) throw new Error(r.erro);
      const resposta = respostaDaLista(lido.pedido, r);
      expect([resposta.pessoas, resposta.pessoasPedidas, resposta.soComTres]).toEqual([3, 2, true]);
      expect([resposta.horasMinimo, resposta.horasMaximo]).toEqual(horas);
      expect(resposta.resumo).toBe(`${tipologia === "T3" ? "T3" : "T4 ou maior"} · Seixal → Almada · entre ${horas[0]} e ${horas[1]} h com 3 pessoas`);
      expect(resposta.recomendaTres).toMatch(/^Num T3 ou maior a mudança faz-se com 3 pessoas/);
      if (tipologia === "T4+") expect(resposta.recomendaTres).toContain("4 pessoas ou duas viaturas");
      for (const c of resposta.parceiros) {
        expect(c.pessoas).toBe(3);
        expect(c.horasTexto).toBe(`Entre ${horas[0]} e ${horas[1]} h com 3 pessoas`);
      }
    }
    // E o pedido que a app manda com pessoas: 2 lê-se como 3, para congelar o preço da equipa de 3.
    const doPedido = pedidoDaListaDoPedido({ ...ORDER, tipologia: "T3", pessoas: 2, embalamento: true });
    expect(doPedido.ok && [doPedido.pedido.pessoas, doPedido.pedido.embalamento]).toEqual([3, true]);
  });

  it("o id opaco muda com o segredo e com o parceiro", () => {
    expect(idOpacoDoParceiro(1, "a")).not.toBe(idOpacoDoParceiro(1, "b"));
    expect(idOpacoDoParceiro(1, "a")).not.toBe(idOpacoDoParceiro(2, "a"));
  });

  it("pede origem, destino e uma equipa de 2 ou 3", () => {
    expect(lerPedidoDaLista({ destino: ORDER.destinationAddress }).ok).toBe(false);
    expect(lerPedidoDaLista({ origem: ORDER.originAddress }).ok).toBe(false);
    expect(lerPedidoDaLista({ origem: ORDER.originAddress, destino: ORDER.destinationAddress, pessoas: 4 }).ok).toBe(false);
  });
});

describe("a escolha do cliente é conferida no servidor", () => {
  it("um id de um parceiro não elegível (ou inventado) é recusado — o cliente não força ninguém", async () => {
    for (const forjado of [idOpacoDoParceiro(2), idOpacoDoParceiro(3), idOpacoDoParceiro(4), idOpacoDoParceiro(5), "2", "inventado"]) {
      const r = await prepararEscolhaDaMudanca({ ...ORDER, parceirosEscolhidos: [idOpacoDoParceiro(1), forjado] });
      expect(r.caminho).toBe("recusado");
    }
  });

  it("mais de 3, repetidos ou vazios não passam", () => {
    const e = [1, 2, 3, 4].map((n) => ({ id: `id${n}`, providerId: n, nome: "", tarifa: TARIFA, distanciaKm: 1 }));
    expect(conferirEscolha(["id1", "id2", "id3", "id4"], e).ok).toBe(false);
    expect(conferirEscolha(["id1", "id1"], e).ok).toBe(false);
    expect(conferirEscolha([], e).ok).toBe(false);
    expect(conferirEscolha(["id1", "id2"], e).ok).toBe(true);
  });

  it("sem escolha, ou com o interruptor desligado, é o caminho de antes", async () => {
    expect((await prepararEscolhaDaMudanca({ ...ORDER })).caminho).toBe("antigo");
    expect((await prepararEscolhaDaMudanca({ ...ORDER, serviceType: "recolha_moveis", parceirosEscolhidos: ["x"] })).caminho).toBe(
      "antigo",
    );
    estado.ligado = false;
    expect((await prepararEscolhaDaMudanca({ ...ORDER, parceirosEscolhidos: [idOpacoDoParceiro(1)] })).caminho).toBe("antigo");
  });

  it("com 3 pessoas, quem não faz com 3 não pode ser escolhido", async () => {
    const r = await prepararEscolhaDaMudanca({ ...ORDER, pessoas: 3, parceirosEscolhidos: [idOpacoDoParceiro(1)] });
    expect(r.caminho).toBe("recusado");
  });
});

describe("o envio aos escolhidos", () => {
  it("congela a tarifa de cada um, grava o prazo e a prova, e vai só a eles com a regra inteira", async () => {
    const agora = new Date("2026-11-10T10:00:00Z");
    const p = await prepararEscolhaDaMudanca({ ...ORDER, parceirosEscolhidos: [idOpacoDoParceiro(1)] }, agora);
    expect(p.caminho).toBe("escolhidos");
    if (p.caminho !== "escolhidos") return;
    await enviarAosEscolhidos(
      {
        id: 900,
        description: "Mudança",
        city: "Seixal",
        urgency: null,
        quantidadeDeFotos: 0,
        valorDesejadoCliente: 47.62,
        precisaFatura: false,
        formaDePagamento: "na_plataforma",
        baseUrl: "https://exemplo.pt",
      },
      p.escolha,
      agora,
    );
    expect(estado.distribuir).toHaveLength(1);
    const { opcoes } = estado.distribuir[0] as {
      opcoes: { soPara: number[]; exigirElegibilidade: boolean; mudancaPorParceiro: Map<number, Record<string, unknown>> };
    };
    expect(opcoes.soPara).toEqual([1]);
    expect(opcoes.exigirElegibilidade).toBe(true);
    const m = opcoes.mudancaPorParceiro.get(1)!;
    const congelada = tarifaCongeladaDeJson(m.tarifaCongeladaJson as string);
    expect(congelada).toEqual(congelarTarifa(TARIFA, undefined, agora));
    expect(m.pessoas).toBe(2);
    expect(m.precoHora).toBe(40);
    // 10h de Lisboa (Inverno, UTC+0) + 3 h = 13h00 em Lisboa.
    expect((m.prazoRespostaEm as Date).toISOString()).toBe("2026-11-10T13:00:00.000Z");
    // A taxa da plataforma sai do lado dele; o cliente paga o preço dele.
    expect((m.taxas as { cliente: number }).cliente).toBe(0);

    // Mudar a tarifa depois não muda o que ficou congelado.
    TARIFA.precoHora2 = 99;
    expect(tarifaCongeladaDeJson(m.tarifaCongeladaJson as string)?.precoHora2Cent).toBe(4000);
    TARIFA.precoHora2 = 40;

    const prova = (estado.prova[0] as { p: { escolhidos: Array<{ providerId: number }>; cartoesVistos: unknown[] } }).p;
    expect(prova.escolhidos.map((x) => x.providerId)).toEqual([1]);
    expect(prova.cartoesVistos).toHaveLength(1);
    expect(estado.historico).toHaveLength(1);
  });
});
