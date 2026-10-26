import { describe, it, expect } from "vitest";
import {
  dadosDoQueFalta,
  faltasDoPasso,
  oQueFaltaNoPedido,
  conteudoDaDescricao,
  type PedidoParaOQueFalta,
} from "./o-que-falta-no-pedido";
import { passosEmFalta, primeiroPassoEmFalta, type PassoDaRecolha } from "./whatsapp-recolha";
import { dadosDoPedido } from "./pedido-aberto-na-conversa";
import type { ChaveDaFalta } from "./mensagem-do-que-falta";

/**
 * O QUE FALTA NO PEDIDO — 26-10-2026 (d31). *«O registo tem de ficar 100 %
 * completo.»* — o dono.
 *
 * Os pedidos destes testes são inventados (nomes, moradas e números).
 */

const FOTO = JSON.stringify([{ url: "https://exemplo.invalid/foto-1.jpg", name: "foto-1.jpg" }]);

/** Uma recolha de monos com tudo — e cada teste tira o que quer ver faltar. */
const completa = (mudar: Partial<PedidoParaOQueFalta> = {}): PedidoParaOQueFalta => ({
  id: 812,
  serviceType: "recolha_monos",
  contactName: "Ana Exemplo",
  address: "Rua das Flores, 12",
  city: "Almada",
  postalCode: "2800-001",
  floor: "2",
  hasElevator: "yes",
  parkingDistance: "door",
  description: "Um sofá de três lugares e dois colchões.",
  filesJson: FOTO,
  urgency: "this_week",
  dataAgendada: null,
  rawOrderJson: null,
  ...mudar,
});

/** As faltas que vêm da conversa da Vitória — tudo menos as três que o pedido junta. */
const EXTRAS = new Set<ChaveDaFalta>(["fotografias", "numeroDaPorta", "tipologia"]);

describe("um pedido completo", () => {
  it("não pede nada", () => {
    expect(oQueFaltaNoPedido(completa())).toEqual([]);
  });

  it("o «Flexível» e um dia gravado também são uma data", () => {
    expect(oQueFaltaNoPedido(completa({ urgency: "flexible" }))).toEqual([]);
    expect(oQueFaltaNoPedido(completa({ urgency: null, dataAgendada: "2026-11-03T10:00:00.000Z" }))).toEqual([]);
  });
});

describe("pede só o que falta, pela ordem de pedir", () => {
  it("um pedido só com o serviço pede tudo o resto", () => {
    const p: PedidoParaOQueFalta = { id: 900, serviceType: "recolha_monos" };
    expect(oQueFaltaNoPedido(p)).toEqual([
      "fotografias",
      "descricao",
      "morada",
      "codigoPostal",
      "localidade",
      "andar",
      "elevador",
      "estacionamento",
      "data",
      "nome",
    ]);
  });

  it("sem fotografias, pede as fotografias — e uma linha sem endereço não é uma fotografia", () => {
    expect(oQueFaltaNoPedido(completa({ filesJson: null }))).toEqual(["fotografias"]);
    expect(oQueFaltaNoPedido(completa({ filesJson: JSON.stringify([{ name: "sem-url" }]) }))).toEqual(["fotografias"]);
    expect(oQueFaltaNoPedido(completa({ filesJson: "estragado" }))).toEqual(["fotografias"]);
  });

  it("a morada sem número pede o número da porta (o código postal da morada não conta como número)", () => {
    expect(oQueFaltaNoPedido(completa({ address: "Rua das Flores" }))).toEqual(["numeroDaPorta"]);
    expect(
      oQueFaltaNoPedido(completa({ address: "Rua das Flores, 2800-001 Almada", postalCode: null, city: null })),
    ).toEqual(["numeroDaPorta"]);
    expect(oQueFaltaNoPedido(completa({ address: "Quinta do Exemplo, s/n" }))).toEqual([]);
  });

  it("o código postal e a localidade pedem-se cada um por si — e lêem-se da morada ou do formulário", () => {
    expect(oQueFaltaNoPedido(completa({ postalCode: null }))).toEqual(["codigoPostal"]);
    expect(oQueFaltaNoPedido(completa({ city: null }))).toEqual(["localidade"]);
    expect(oQueFaltaNoPedido(completa({ postalCode: null, address: "Rua das Flores, 12, 2800-001 Almada" }))).toEqual([]);
    expect(
      oQueFaltaNoPedido(completa({ postalCode: null, rawOrderJson: JSON.stringify({ address: { postalCode: "2800-001" } }) })),
    ).toEqual([]);
  });

  it("o elevador: pede-se acima do rés-do-chão; num rés-do-chão ou numa moradia, não", () => {
    expect(oQueFaltaNoPedido(completa({ hasElevator: null }))).toEqual(["elevador"]);
    for (const andar of ["rés-do-chão", "R/C", "r/c Esq", "0", "moradia"]) {
      expect(oQueFaltaNoPedido(completa({ floor: andar, hasElevator: null })), andar).toEqual([]);
    }
    // «Não sei» é uma resposta — a Vitória também não volta a perguntar.
    expect(oQueFaltaNoPedido(completa({ hasElevator: "unknown" }))).toEqual([]);
  });

  it("sem andar pede o andar e o elevador", () => {
    expect(oQueFaltaNoPedido(completa({ floor: null, hasElevator: null }))).toEqual(["andar", "elevador"]);
  });

  it("o estacionamento, a data e o nome", () => {
    expect(oQueFaltaNoPedido(completa({ parkingDistance: null }))).toEqual(["estacionamento"]);
    expect(oQueFaltaNoPedido(completa({ urgency: null }))).toEqual(["data"]);
    expect(oQueFaltaNoPedido(completa({ contactName: null }))).toEqual(["nome"]);
    // O nome que o registo automático põe quando não o sabe não é um nome.
    expect(oQueFaltaNoPedido(completa({ contactName: "Cliente WhatsApp" }))).toEqual(["nome"]);
  });

  it("uma descrição só com o acesso e o quando não diz o que é para levar", () => {
    const soAcesso = "Acesso: 2.º andar, com elevador.\nQuando: sábado, 31 de outubro.\nFotografias enviadas pelo cliente: 2.";
    expect(conteudoDaDescricao(soAcesso)).toBe("");
    expect(oQueFaltaNoPedido(completa({ description: soAcesso }))).toEqual(["descricao"]);
    expect(oQueFaltaNoPedido(completa({ description: `Móveis: um sofá.\n${soAcesso}` }))).toEqual([]);
  });
});

describe("cada serviço pede o que é seu", () => {
  it("entulho: a quantidade (do formulário ou dita na descrição); com ela, a descrição chega", () => {
    const entulho = completa({ serviceType: "recolha_entulho", description: null });
    expect(oQueFaltaNoPedido(entulho)).toEqual(["descricao", "volume"]);
    expect(oQueFaltaNoPedido({ ...entulho, rawOrderJson: JSON.stringify({ entulhoQuantidade: "20" }) })).toEqual([]);
    expect(oQueFaltaNoPedido({ ...entulho, rawOrderJson: { entulhoQuantidadeBigBags: 1 } })).toEqual([]);
    expect(oQueFaltaNoPedido({ ...entulho, description: "Entulho: 10 sacos." })).toEqual([]);
    expect(oQueFaltaNoPedido({ ...entulho, description: "Restos de obra, uns 3 m³." })).toEqual([]);
    // «Não sei» na estimativa visual não é uma quantidade.
    expect(oQueFaltaNoPedido({ ...entulho, rawOrderJson: { entulhoVolume: "incerto" } })).toEqual(["descricao", "volume"]);
  });

  it("mudança: o destino inteiro e a tipologia", () => {
    const mudanca = completa({ serviceType: "mudanca", description: "Os móveis de um T2 e umas 20 caixas." });
    expect(oQueFaltaNoPedido(mudanca)).toEqual([
      "moradaDestino",
      "codigoPostalDestino",
      "localidadeDestino",
      "andarDestino",
      "elevadorDestino",
      "estacionamentoDestino",
    ]);
    const comDestino = {
      ...mudanca,
      rawOrderJson: JSON.stringify({
        tipologia: "T2",
        destinationAddress: { formattedAddress: "Avenida do Exemplo, 5", postalCode: "2900-001", city: "Setúbal" },
        destinationAccess: { floor: "rés-do-chão", hasElevator: null, parkingDistance: "door" },
      }),
    };
    expect(oQueFaltaNoPedido(comDestino)).toEqual([]);
    // Sem a tipologia no formulário nem na descrição, pede-se.
    expect(oQueFaltaNoPedido({ ...comDestino, description: "Os móveis e umas caixas." , rawOrderJson: JSON.stringify({ ...JSON.parse(comDestino.rawOrderJson), tipologia: null }) })).toEqual([
      "tipologia",
    ]);
  });

  it("mudança: o JSON pequeno que a consulta da Mesa monta lê-se da mesma maneira (os null vêm como «null»)", () => {
    const daConsulta = JSON.stringify({
      tipologia: "T3",
      destinationAddress: { formattedAddress: "Avenida do Exemplo, 5", postalCode: null, city: "Setúbal" },
      destinationAccess: { floor: "4", hasElevator: "null", parkingDistance: null },
      entulhoQuantidade: null,
      address: { postalCode: null },
      originAddress: { postalCode: null },
    });
    expect(oQueFaltaNoPedido(completa({ serviceType: "mudanca", rawOrderJson: daConsulta }))).toEqual([
      "codigoPostalDestino",
      "elevadorDestino",
      "estacionamentoDestino",
    ]);
  });

  it("manutenção: o que é para reparar", () => {
    expect(oQueFaltaNoPedido(completa({ serviceType: "manutencao_casa", description: null }))).toEqual(["descricao"]);
  });

  it("sem serviço, pede o serviço", () => {
    expect(oQueFaltaNoPedido(completa({ serviceType: null }))).toEqual(["servico"]);
  });
});

/*
 * A MESMA LÍNGUA DA VITÓRIA. O que falta sai de `passosEmFalta` — a função de
 * que a Vitória tira a próxima pergunta —, e estes testes guardam que nenhum
 * dos dois sítios passa a dizer outra coisa do mesmo pedido.
 */
const AMOSTRAS: PedidoParaOQueFalta[] = [
  completa(),
  { id: 1, serviceType: "recolha_monos" },
  completa({ floor: null, hasElevator: null, parkingDistance: null }),
  completa({ contactName: "Cliente WhatsApp", address: null, postalCode: null, city: null }),
  completa({ serviceType: "recolha_entulho", description: null }),
  completa({ serviceType: "mudanca", rawOrderJson: { destinationAddress: { formattedAddress: "Rua B, 3" } } }),
  completa({ serviceType: "esvaziamento_casa", urgency: null, description: "" }),
  completa({ serviceType: "manutencao_casa", floor: "rés-do-chão", hasElevator: null }),
];

describe("a mesma língua da Vitória", () => {
  it("cada falta da conversa está na lista, e a lista não tem outras além das três do pedido", () => {
    for (const p of AMOSTRAS) {
      const d = dadosDoQueFalta(p);
      const daVitoria = new Set(passosEmFalta(d).flatMap((passo) => faltasDoPasso(passo, d)));
      const lista = oQueFaltaNoPedido(p);
      expect(lista.filter((c) => !EXTRAS.has(c)).sort(), `#${p.id} ${p.serviceType}`).toEqual([...daVitoria].sort());
    }
  });

  it("a primeira pergunta da Vitória continua a ser a primeira das que faltam", () => {
    for (const p of AMOSTRAS) {
      const d = dadosDoQueFalta(p);
      expect(primeiroPassoEmFalta(d)).toBe(passosEmFalta(d)[0] ?? "confirmar");
    }
    expect(passosEmFalta({ serviceType: "recolha_monos" })).not.toContain("confirmar");
  });

  it("o que a Vitória perguntaria a quem já tem este pedido está sempre na lista", () => {
    for (const p of AMOSTRAS) {
      // É assim que ela continua um pedido aberto (d30): só o que lhe cabe numa conversa.
      const naConversa = dadosDoPedido({ ...p, id: p.id, rawOrderJson: undefined } as Parameters<typeof dadosDoPedido>[0]);
      const passo = primeiroPassoEmFalta(naConversa);
      if (passo === "confirmar") continue;
      const lista = oQueFaltaNoPedido(p);
      const doPasso = faltasDoPasso(passo, naConversa);
      expect(doPasso.some((c) => lista.includes(c)), `#${p.id}: a Vitória pergunta «${passo}»`).toBe(true);
    }
  });

  it("todas as perguntas da Vitória têm a sua falta, menos a factura (há sempre) e o fim", () => {
    const passos: PassoDaRecolha[] = [
      "servico", "nome", "morada", "codigoPostal", "moradaDestino", "codigoPostalDestino", "andar", "elevador",
      "estacionamento", "andarDestino", "elevadorDestino", "estacionamentoDestino", "entulhoQuantidade", "quando",
      "descricao", "fatura", "nif", "confirmar",
    ];
    const vazio = {};
    for (const passo of passos) {
      const f = faltasDoPasso(passo, vazio);
      if (passo === "fatura" || passo === "nif" || passo === "confirmar") expect(f, passo).toEqual([]);
      else expect(f.length, passo).toBeGreaterThan(0);
    }
  });
});
