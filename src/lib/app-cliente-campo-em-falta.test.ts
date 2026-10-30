import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { camposEmFalta, catalogoValido, faltaNoPasso, rascunhoVazio, type Catalogo, type Rascunho } from "../../app-cliente/src/lib/novo-pedido";
import { catalogoDaApp } from "./catalogo-da-app";

/**
 * O CAMPO EM FALTA E O TELEMÓVEL QUE PASSA PARA A CONTA — ordem do CEO com o
 * sim do dono, 30-10-2026 (parte A). Ao tocar em Continuar/Enviar com um campo
 * obrigatório vazio, o ecrã desce até ao primeiro, que fica a vermelho com uma
 * frase curta; com sessão, o telemóvel do pedido passa para a conta que não o tem.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const c = catalogoValido({
  ...catalogoDaApp(),
  servicos: [
    { id: "recolha_moveis", nome: "Recolha de móveis", detalhes: "moveis" },
    { id: "mudanca", nome: "Mudança", detalhes: "mudanca" },
  ],
}) as Catalogo;
const base = (extra: Partial<Rascunho>): Rascunho => ({ ...rascunhoVazio(), ...extra });
const ACESSO = { floor: "rés-do-chão", parkingDistance: "porta" } as unknown as Rascunho["acesso"];

describe("o primeiro campo em falta, em cada passo", () => {
  it("passo 1 sem serviço: só o serviço", () => {
    expect(camposEmFalta(base({}), 1, c)).toEqual([{ campo: "servico", texto: "Escolha o que precisa." }]);
  });

  it("passo 1: todos os que faltam, pela ordem do ecrã", () => {
    expect(camposEmFalta(base({ servico: "recolha_moveis" }), 1, c).map((x) => x.campo)).toEqual(["movelModo", "descricao"]);
    expect(camposEmFalta(base({ servico: "mudanca", descricao: "Um T2 inteiro" }), 1, c).map((x) => x.campo)).toEqual(["tipologia"]);
  });

  it("passo 2: «Falta a morada»; o vermelho sai quando fica preenchida", () => {
    const r = base({ servico: "recolha_moveis" });
    expect(camposEmFalta(r, 2, c)[0]).toEqual({ campo: "morada", texto: "Falta a morada." });
    const comMorada = { ...r, morada: { formattedAddress: "Rua A, Lisboa" } as Rascunho["morada"] };
    expect(camposEmFalta(comMorada, 2, c).map((x) => x.campo)).not.toContain("morada");
  });

  it("passo 3: quando, nome e telemóvel, e o NIF quando o pede", () => {
    const r = base({ servico: "recolha_moveis", querNif: true, nif: "12" });
    expect(camposEmFalta(r, 3, c).map((x) => x.campo)).toEqual(["quando", "nif", "nome", "telefone"]);
    const bem = { ...r, quando: "flexivel" as const, querNif: false, nome: "Ana", telefone: "912345678" };
    expect(camposEmFalta(bem, 3, c)).toEqual([]);
    expect(faltaNoPasso(bem, 3, c)).toBeNull();
  });

  it("os dois acessos e as duas moradas da mudança", () => {
    const r = base({ servico: "mudanca", acesso: ACESSO });
    expect(camposEmFalta(r, 2, c).map((x) => x.campo)).toEqual(["morada", "destino", "acessoDestino"]);
  });
});

describe("o ecrã: desce, pinta e põe o foco", () => {
  const novo = ler("app-cliente/src/componentes/NovoPedido.tsx");
  const ui = ler("app-cliente/src/componentes/ui.tsx");

  it("Continuar/Enviar marca os que faltam e desce até ao primeiro", () => {
    expect(novo).toContain("const lista = camposEmFalta(r, passo, c);");
    expect(novo).toContain("setMarcados(new Set(lista.map((x) => x.campo)));");
    expect(novo).toContain("descerAte(lista[0].campo)");
    expect(novo).toContain("scroll.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });");
    expect(novo).toContain("lugar?.focar?.();");
  });

  it("cada campo do pedido tem o seu nome, e os de texto ficam com o rótulo e o contorno a vermelho", () => {
    for (const campo of ["servico", "movelModo", "itens", "volume", "entulho", "entulhoModo", "sacos", "entulhoVolume", "tipologia", "descricao", "fotos", "morada", "acesso", "destino", "acessoDestino", "quando", "data", "nif", "nome", "telefone"]) {
      expect(novo, campo).toContain(`campo="${campo}"`);
    }
    expect(ui).toContain("color: erro ? CORES.mau : CORES.tinta");
    expect(ui).toContain("borderColor: erro ? CORES.mau : CORES.linha");
  });

  it("o vermelho é só dos que faltavam e ainda faltam", () => {
    expect(novo).toContain("marcados.has(campo) ? (emFaltaAgora.find((x) => x.campo === campo)?.texto ?? null) : null");
  });
});

describe("o telemóvel do pedido passa para a conta", () => {
  const conta = ler("src/lib/conta-server.ts");
  const rota = ler("src/app/api/simulador/pedido/route.ts");
  const funcao = conta.slice(conta.indexOf("export async function completarContaComOPedido"), conta.indexOf("A CONTA DO CLIENTE PARA A PRIMEIRA CARGA"));

  it("só com sessão, com o email da sessão", () => {
    expect(rota).toContain("if (sessionEmail) {\n      await completarContaComOPedido({ email: sessionEmail,");
  });

  it("nunca sobrescreve, nunca cria uma conta, e respeita o número de outra conta", () => {
    expect(funcao).toContain("AND (phone IS NULL OR phone = '')");
    expect(funcao).toContain("AND (name IS NULL OR name = '')");
    expect(funcao).not.toMatch(/INSERT/);
    expect(funcao).toContain("SELECT id FROM users WHERE phone = ? AND email <> ? AND deletedAt IS NULL LIMIT 1");
    expect(funcao).toContain("if (telefone && telefoneLivre)");
  });
});
