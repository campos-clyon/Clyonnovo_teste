import { describe, it, expect, beforeAll } from "vitest";
import * as jose from "jose";
import {
  assinarSessaoDoProfissional,
  verificarSessaoDoProfissional,
  validarPalavraPasse,
  hashDaPalavraPasse,
  palavraPasseConfere,
  TIPO_PROFISSIONAL,
  MINIMO_DA_PALAVRA_PASSE,
} from "./profissional-auth";
import { verifyColaboradorToken } from "./colaborador-auth";

const SEGREDO = "segredo-de-teste-com-tamanho-suficiente-1234567890";
beforeAll(() => {
  process.env.JWT_SECRET = SEGREDO;
});

const chave = () => new TextEncoder().encode(SEGREDO);

describe("sessão do profissional", () => {
  it("assina e verifica", async () => {
    const t = await assinarSessaoDoProfissional(7, "Transportes Silva");
    const s = await verificarSessaoDoProfissional(t);
    expect(s).toEqual({ providerId: 7, nome: "Transportes Silva", type: TIPO_PROFISSIONAL });
  });

  it("recusa vazio, lixo e assinatura de outra chave", async () => {
    expect(await verificarSessaoDoProfissional(null)).toBeNull();
    expect(await verificarSessaoDoProfissional("nao-e-um-jwt")).toBeNull();
    const outraChave = new TextEncoder().encode("outro-segredo-completamente-diferente-000");
    const forjado = await new jose.SignJWT({ providerId: 1, nome: "X", type: TIPO_PROFISSIONAL })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(outraChave);
    expect(await verificarSessaoDoProfissional(forjado)).toBeNull();
  });

  it("recusa um payload sem providerId ou sem nome", async () => {
    for (const payload of [
      { nome: "X", type: TIPO_PROFISSIONAL },
      { providerId: 1, type: TIPO_PROFISSIONAL },
      { providerId: "1", nome: "X", type: TIPO_PROFISSIONAL },
    ]) {
      const t = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .sign(chave());
      expect(await verificarSessaoDoProfissional(t)).toBeNull();
    }
  });

  // A regra que impede o acidente que este projecto já teve: um token de um
  // domínio a passar por outro só porque a assinatura confere.
  it("um token de COLABORADOR não abre o painel do profissional", async () => {
    const doColaborador = await new jose.SignJWT({ id: 1, nome: "WANDERSON", isAdmin: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(chave());
    expect(await verificarSessaoDoProfissional(doColaborador)).toBeNull();
  });

  it("e um token de PROFISSIONAL não entra no backoffice", async () => {
    const doProfissional = await assinarSessaoDoProfissional(7, "Transportes Silva");
    expect(await verifyColaboradorToken(doProfissional)).toBeNull();
  });

  it("exige o type exacto, não um type qualquer", async () => {
    const outroDominio = await new jose.SignJWT({ providerId: 7, nome: "X", type: "cliente" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(chave());
    expect(await verificarSessaoDoProfissional(outroDominio)).toBeNull();
  });

  it("recusa um token expirado", async () => {
    const expirado = await new jose.SignJWT({
      providerId: 7,
      nome: "X",
      type: TIPO_PROFISSIONAL,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(chave());
    expect(await verificarSessaoDoProfissional(expirado)).toBeNull();
  });
});

describe("validarPalavraPasse", () => {
  it("aceita uma frase com o comprimento mínimo", () => {
    expect(validarPalavraPasse("a-minha-frase-secreta")).toBeNull();
  });

  it("recusa curta, vazia e do tipo errado", () => {
    expect(validarPalavraPasse("curta")).not.toBeNull();
    expect(validarPalavraPasse("")).not.toBeNull();
    expect(validarPalavraPasse(undefined)).not.toBeNull();
    expect(validarPalavraPasse(12345678901)).not.toBeNull();
  });

  it("recusa uma palavra-passe só de espaços", () => {
    expect(validarPalavraPasse(" ".repeat(MINIMO_DA_PALAVRA_PASSE + 5))).not.toBeNull();
  });

  it("recusa uma absurdamente longa", () => {
    expect(validarPalavraPasse("a".repeat(500))).not.toBeNull();
  });

  // Só comprimento, de propósito: exigir símbolos produz "Password1!" e um
  // papel colado ao monitor.
  it("não exige maiúsculas nem números", () => {
    expect(validarPalavraPasse("abcdefghijklm")).toBeNull();
  });
});

describe("hash da palavra-passe", () => {
  it("confere com a certa e recusa a errada", async () => {
    const h = await hashDaPalavraPasse("a-minha-frase-secreta");
    expect(await palavraPasseConfere("a-minha-frase-secreta", h)).toBe(true);
    expect(await palavraPasseConfere("outra-frase-qualquer", h)).toBe(false);
  });

  it("o hash não é a palavra-passe", async () => {
    const h = await hashDaPalavraPasse("a-minha-frase-secreta");
    expect(h).not.toContain("frase");
    expect(h.startsWith("$2")).toBe(true);
  });

  it("recusa sem rebentar quando o hash guardado falta ou está corrompido", async () => {
    expect(await palavraPasseConfere("x", null)).toBe(false);
    expect(await palavraPasseConfere("x", "")).toBe(false);
    expect(await palavraPasseConfere("x", "nao-e-um-hash")).toBe(false);
  });
});
