import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  comparaSemFuga,
  chaveConfere,
  chaveConfigurada,
  assinarSessaoDeTeste,
  verificarSessaoDeTeste,
  validarPalavraPasseDeTeste,
  MINIMO_DA_PALAVRA_PASSE_DE_TESTE,
  TIPO_TESTE,
} from "./acesso-mvp";
import { assinarSessaoDoProfissional } from "./profissional-auth";

const CHAVE = "chave-de-teste-com-tamanho-suficiente";

function definir(nome: string, valor: string | undefined) {
  if (valor === undefined) delete process.env[nome];
  else process.env[nome] = valor;
}

const antes = { chave: process.env.CHAVE_MVP, jwt: process.env.JWT_SECRET };

beforeEach(() => {
  definir("CHAVE_MVP", CHAVE);
  definir("JWT_SECRET", "segredo-de-teste-suficientemente-longo-1234");
});

afterEach(() => {
  definir("CHAVE_MVP", antes.chave);
  definir("JWT_SECRET", antes.jwt);
});

describe("comparaSemFuga", () => {
  it("é verdade só quando são iguais", () => {
    expect(comparaSemFuga("abc", "abc")).toBe(true);
    expect(comparaSemFuga("abc", "abd")).toBe(false);
    expect(comparaSemFuga("abc", "ab")).toBe(false);
    expect(comparaSemFuga("", "")).toBe(true);
  });

  it("não se engana com acentos e caracteres de vários bytes", () => {
    expect(comparaSemFuga("ção", "ção")).toBe(true);
    expect(comparaSemFuga("ção", "cao")).toBe(false);
  });
});

describe("chaveConfere", () => {
  it("aceita a chave certa", () => {
    expect(chaveConfere(CHAVE)).toBe(true);
  });

  it("recusa tudo o resto", () => {
    for (const v of [CHAVE + "x", CHAVE.slice(0, -1), "", null, undefined, 42, {}]) {
      expect(chaveConfere(v)).toBe(false);
    }
  });

  // Um ambiente mal configurado que deixasse entrar toda a gente é pior do que
  // um que não deixe entrar ninguém: o segundo nota-se em dez segundos.
  it("sem chave no ambiente, ninguém entra", () => {
    definir("CHAVE_MVP", undefined);
    expect(chaveConfigurada()).toBeNull();
    expect(chaveConfere("seja o que for")).toBe(false);
    expect(chaveConfere("")).toBe(false);
  });

  // Uma chave curta é uma chave adivinhável, e passa despercebida numa
  // variável de ambiente escrita à pressa.
  it("recusa uma chave curta de mais no ambiente", () => {
    definir("CHAVE_MVP", "1234");
    expect(chaveConfigurada()).toBeNull();
    expect(chaveConfere("1234")).toBe(false);
  });
});

describe("sessão de testador", () => {
  it("assina e verifica", async () => {
    const t = await assinarSessaoDeTeste({ testadorId: 7, nome: "Fred" });
    const s = await verificarSessaoDeTeste(t);
    expect(s).toEqual({ testadorId: 7, nome: "Fred", type: TIPO_TESTE });
  });

  it("recusa lixo e vazio", async () => {
    expect(await verificarSessaoDeTeste(null)).toBeNull();
    expect(await verificarSessaoDeTeste("")).toBeNull();
    expect(await verificarSessaoDeTeste("nao.e.um.token")).toBeNull();
  });

  // Já houve neste projecto um token de um domínio a passar por outro. O
  // discriminador de tipo é o que impede que volte a acontecer.
  it("um token de profissional não abre o ambiente de testes", async () => {
    const doProfissional = await assinarSessaoDoProfissional(1, "Fred");
    expect(await verificarSessaoDeTeste(doProfissional)).toBeNull();
  });

  it("recusa uma assinatura feita com outro segredo", async () => {
    const t = await assinarSessaoDeTeste({ testadorId: 1, nome: "X" });
    definir("JWT_SECRET", "outro-segredo-completamente-diferente-9876");
    expect(await verificarSessaoDeTeste(t)).toBeNull();
  });
});

describe("validarPalavraPasseDeTeste", () => {
  it("exige comprimento", () => {
    expect(validarPalavraPasseDeTeste("a".repeat(MINIMO_DA_PALAVRA_PASSE_DE_TESTE))).toBeNull();
    expect(validarPalavraPasseDeTeste("curta")).not.toBeNull();
    expect(validarPalavraPasseDeTeste(null)).not.toBeNull();
  });

  it("recusa só espaços", () => {
    expect(validarPalavraPasseDeTeste(" ".repeat(20))).not.toBeNull();
  });
});
