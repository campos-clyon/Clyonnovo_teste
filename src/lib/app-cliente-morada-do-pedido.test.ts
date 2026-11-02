import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  abreAEscolher,
  botaoDaEscolha,
  chaveDaMorada,
  indiceDaMorada,
  juntarMoradas,
  moradaDaConta,
  moradaDoPedido,
  pedidosParaAsMoradas,
  perguntaDaEscolha,
} from "../../app-cliente/src/lib/moradas-do-pedido";
import type { Morada } from "../../app-cliente/src/lib/novo-pedido";

/**
 * «É NESTA MORADA?» — o 1.º ecrã do Pedir na app de cliente (ordem do CEO com
 * o sim do dono, 02-11-2026). Com sessão e morada (da conta ou de um pedido
 * anterior), abre com ela já escolhida; várias → até 3; «Outra morada» abre a
 * procura de sempre; uma morada nova no pedido não se grava na conta.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const m = (formattedAddress: string): Morada => ({ formattedAddress, aMao: true });

describe("a morada da conta numa linha", () => {
  it("junta o número, o código postal e a localidade que faltam", () => {
    expect(moradaDaConta({ addressLine: "Rua das Flores", addressNumber: "12", postalCode: "1000-001", addressCity: "Lisboa" })?.formattedAddress).toBe(
      "Rua das Flores 12, 1000-001 Lisboa",
    );
  });
  it("não repete o que já está na linha (a barra de cima grava a morada inteira)", () => {
    const linha = "Rua das Flores 12, 1000-001 Lisboa, Portugal";
    expect(moradaDaConta({ addressLine: linha, addressNumber: "12", postalCode: "1000-001", addressCity: "Lisboa" })?.formattedAddress).toBe(linha);
  });
  it("sem linha, não há morada da conta", () => {
    expect(moradaDaConta({ addressLine: "  ", postalCode: "1000-001" })).toBeNull();
    expect(moradaDaConta(null)).toBeNull();
  });
});

describe("as moradas para escolher", () => {
  it("a conta primeiro, depois os pedidos, sem repetir (acentos, maiúsculas e vírgulas não contam), até 3", () => {
    const lista = juntarMoradas([
      m("Rua da Prata 5, Lisboa"),
      m("rua da prata 5 lisboa"),
      moradaDoPedido({ morada: "Av. da República 10, Porto", cidade: "Porto" }),
      moradaDoPedido({ morada: "Avenida da Republica 10 Porto" }),
      moradaDoPedido({ morada: "Praça do Comércio 1, Lisboa" }),
      moradaDoPedido({ morada: "Rua Augusta 2, Lisboa" }),
      moradaDoPedido({ morada: "Rua Augusta 3, Lisboa" }),
    ]);
    expect(lista.map((x) => x.formattedAddress)).toEqual([
      "Rua da Prata 5, Lisboa",
      "Av. da República 10, Porto",
      "Avenida da Republica 10 Porto",
    ]);
  });
  it("as vazias e os pedidos sem morada ficam de fora", () => {
    expect(juntarMoradas([null, undefined, m("  "), moradaDoPedido({ morada: null }), moradaDoPedido(null)])).toEqual([]);
  });
  it("lê os pedidos mais recentes (n.º maior primeiro), até 3, sem repetir", () => {
    expect(pedidosParaAsMoradas([499, 551, 500, 551, 0, -1, 530])).toEqual([551, 530, 500]);
  });
  it("a mesma morada escrita de outra maneira é a mesma", () => {
    expect(chaveDaMorada("Praça do Comércio, 1")).toBe(chaveDaMorada("praca do comercio 1"));
    expect(indiceDaMorada([m("Rua A 1"), m("Praça do Comércio, 1")], m("praca do comercio 1"))).toBe(1);
  });
});

describe("o ecrã «Onde é?»", () => {
  const moradas = [m("Rua A 1, Lisboa"), m("Rua B 2, Porto")];
  it("abre a escolher com o rascunho sem morada ou com uma das guardadas", () => {
    expect(abreAEscolher(moradas, undefined, false)).toBe(true);
    expect(abreAEscolher(moradas, m("rua b 2 porto"), false)).toBe(true);
  });
  it("sem moradas (sem sessão), ou depois de «Outra morada», ou com uma morada nova, fica a procura de sempre", () => {
    expect(abreAEscolher([], undefined, false)).toBe(false);
    expect(abreAEscolher(moradas, undefined, true)).toBe(false);
    expect(abreAEscolher(moradas, m("Rua Nova 9, Faro"), false)).toBe(false);
  });
  it("uma pergunta: «É nesta morada?» com uma, e o botão «Sim, é esta»", () => {
    expect(perguntaDaEscolha(1, false)).toBe("É nesta morada?");
    expect(botaoDaEscolha(1)).toBe("Sim, é esta");
    expect(perguntaDaEscolha(3, false)).toBe("Em que morada é?");
    expect(botaoDaEscolha(3)).toBe("Continuar");
    expect(perguntaDaEscolha(1, true)).toBe("A mudança sai desta morada?");
  });
});

describe("no código da app", () => {
  const pedir = ler("app-cliente/src/componentes/NovoPedido.tsx");
  const leitor = ler("app-cliente/src/lib/morada-do-cliente.ts");
  const corpoDoLeitor = leitor.slice(leitor.indexOf("export async function lerMoradasParaOPedido"));

  it("o Pedir mostra os cartões e «Outra morada» abre a procura de sempre", () => {
    expect(pedir).toContain("<EscolherMorada");
    expect(pedir).toContain("lerMoradasParaOPedido(");
    expect(pedir).toMatch(/aoPedirOutra=\{\(\) => \{\s*setOutraMorada\(true\)/);
    expect(pedir).toContain("<CampoDeMorada rotulo={mudanca ?");
  });
  it("uma morada usada num pedido não se grava na conta: o Pedir não chama guardarMorada nem faz PATCH", () => {
    expect(pedir).not.toContain("guardarMorada");
    expect(pedir).not.toMatch(/metodo:\s*"PATCH"/);
    expect(corpoDoLeitor).not.toMatch(/PATCH|guardarNoCofre|guardarMorada/);
  });
  it("só com sessão: sem token não lê nada", () => {
    expect(corpoDoLeitor).toMatch(/if \(!\(await lerToken\(\)\)\) return \[\];/);
  });
});
