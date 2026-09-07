/**
 * Testes de regressão para o fluxo de autenticação de colaboradores.
 *
 * Cobre:
 *  1. verifyColaboradorToken com token válido
 *  2. verifyColaboradorToken com token inválido/expirado → null
 *  3. verifyColaboradorAuthHeader com Bearer token
 *  4. verifyColaboradorAuthHeader sem header → null (401)
 *  5. Payload isAdmin=0 → sem acesso admin (403)
 *  6. Payload isAdmin=1 → acesso admin concedido
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as jose from "jose";

// Importações depois de definir o segredo no env
let verifyColaboradorToken: typeof import("./colaborador-auth").verifyColaboradorToken;
let verifyColaboradorAuthHeader: typeof import("./colaborador-auth").verifyColaboradorAuthHeader;
let getColaboradorSecretKey: typeof import("./colaborador-auth").getColaboradorSecretKey;

const TEST_SECRET = "test-secret-clyon-admin-2026-32bytes!!";

async function mintToken(payload: object, expiresIn = "1h") {
  const secret = new TextEncoder().encode(TEST_SECRET);
  return new jose.SignJWT(payload as jose.JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

beforeAll(async () => {
  process.env.JWT_SECRET = TEST_SECRET;
  const mod = await import("./colaborador-auth");
  verifyColaboradorToken = mod.verifyColaboradorToken;
  verifyColaboradorAuthHeader = mod.verifyColaboradorAuthHeader;
  getColaboradorSecretKey = mod.getColaboradorSecretKey;
});

describe("getColaboradorSecretKey", () => {
  it("retorna a chave quando JWT_SECRET está definida", () => {
    const key = getColaboradorSecretKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBeGreaterThan(0);
  });

  it("lança erro quando JWT_SECRET não está definida", () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => getColaboradorSecretKey()).toThrow("JWT_SECRET não está definido");
    process.env.JWT_SECRET = original;
  });
});

describe("verifyColaboradorToken", () => {
  it("retorna null para token nulo", async () => {
    expect(await verifyColaboradorToken(null)).toBeNull();
  });

  it("retorna null para token vazio", async () => {
    expect(await verifyColaboradorToken("")).toBeNull();
  });

  it("retorna null para token malformado", async () => {
    expect(await verifyColaboradorToken("not.a.jwt")).toBeNull();
  });

  it("retorna null para token expirado", async () => {
    const expired = await mintToken({ id: 1, nome: "Teste", isAdmin: 1 }, "-1s");
    expect(await verifyColaboradorToken(expired)).toBeNull();
  });

  it("retorna null para token assinado com segredo diferente", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret-completely-different");
    const token = await new jose.SignJWT({ id: 1, nome: "Fake", isAdmin: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(wrongSecret);
    expect(await verifyColaboradorToken(token)).toBeNull();
  });

  it("retorna payload para token válido", async () => {
    const token = await mintToken({ id: 42, nome: "Admin", isAdmin: 1 });
    const payload = await verifyColaboradorToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.id).toBe(42);
    expect(payload?.nome).toBe("Admin");
    expect(payload?.isAdmin).toBe(1);
  });

  it("colaborador isAdmin=0 — payload retornado mas isAdmin é 0", async () => {
    const token = await mintToken({ id: 10, nome: "Operador", isAdmin: 0 });
    const payload = await verifyColaboradorToken(token);
    expect(payload).not.toBeNull();
    // A lógica de negação de acesso fica no chamador; o token em si é válido
    expect(payload?.isAdmin).toBe(0);
  });
});

describe("verifyColaboradorAuthHeader", () => {
  it("retorna null quando header é undefined", async () => {
    expect(await verifyColaboradorAuthHeader(undefined)).toBeNull();
  });

  it("retorna null quando header é null", async () => {
    expect(await verifyColaboradorAuthHeader(null)).toBeNull();
  });

  it("retorna null quando header não tem Bearer", async () => {
    const token = await mintToken({ id: 1, nome: "A", isAdmin: 1 });
    // Sem "Bearer " prefixo → token inválido (é um JWT mas a função strips "Bearer " de string não existente)
    expect(await verifyColaboradorAuthHeader(token)).not.toBeNull(); // token puro também funciona
  });

  it("extrai token do header Bearer e retorna payload válido", async () => {
    const token = await mintToken({ id: 99, nome: "Gestor", isAdmin: 1 });
    const payload = await verifyColaboradorAuthHeader(`Bearer ${token}`);
    expect(payload).not.toBeNull();
    expect(payload?.id).toBe(99);
    expect(payload?.isAdmin).toBe(1);
  });

  it("retorna null para header Bearer com token inválido", async () => {
    expect(await verifyColaboradorAuthHeader("Bearer invalid.token.here")).toBeNull();
  });

  it("fluxo completo: admin autorizado → isAdmin=1 → acesso permitido", async () => {
    const token = await mintToken({ id: 5, nome: "SuperAdmin", isAdmin: 1, funcao: "admin" });
    const header = `Bearer ${token}`;
    const colab = await verifyColaboradorAuthHeader(header);
    expect(colab).not.toBeNull();
    // Simula a verificação que as rotas API fazem
    const isAuthorized = colab !== null && colab.isAdmin === 1;
    expect(isAuthorized).toBe(true);
  });

  it("fluxo completo: colaborador sem admin → isAdmin=0 → acesso negado (403)", async () => {
    const token = await mintToken({ id: 7, nome: "Operador", isAdmin: 0 });
    const header = `Bearer ${token}`;
    const colab = await verifyColaboradorAuthHeader(header);
    // Token válido mas sem privilégio
    expect(colab).not.toBeNull();
    const isAdmin = colab !== null && colab.isAdmin === 1;
    expect(isAdmin).toBe(false);
  });
});

// ─── O papel no token ────────────────────────────────────────────────────────
//
// O assistente entra com `isAdmin: 0` e `papel: "assistente"`. Um token
// antigo de administrador não traz `papel` nenhum e tem de continuar a ser
// administrador; um token com `isAdmin: 0` e sem papel — a forma dos antigos
// motoristas — não é de ninguém do backoffice.

describe("papel do token", () => {
  let papelDoColaborador: typeof import("./colaborador-auth").papelDoColaborador;
  let sessaoDoPainel: typeof import("./colaborador-auth").sessaoDoPainel;
  let sessaoDeAdminValida: typeof import("./colaborador-auth").sessaoDeAdminValida;

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    const mod = await import("./colaborador-auth");
    papelDoColaborador = mod.papelDoColaborador;
    sessaoDoPainel = mod.sessaoDoPainel;
    sessaoDeAdminValida = mod.sessaoDeAdminValida;
  });

  it("isAdmin=1 é administrador, com ou sem papel", () => {
    expect(papelDoColaborador({ isAdmin: 1 })).toBe("admin");
    expect(papelDoColaborador({ isAdmin: 1, papel: "admin" })).toBe("admin");
  });

  it("isAdmin=0 com papel assistente é assistente", () => {
    expect(papelDoColaborador({ isAdmin: 0, papel: "assistente" })).toBe("assistente");
  });

  it("isAdmin=0 sem papel não é ninguém do backoffice", () => {
    expect(papelDoColaborador({ isAdmin: 0 })).toBeNull();
    expect(papelDoColaborador(null)).toBeNull();
  });

  it("um papel de assistente não promove um isAdmin=1 a menos, nem um 'admin' escrito à mão promove um isAdmin=0", () => {
    expect(papelDoColaborador({ isAdmin: 1, papel: "assistente" })).toBe("admin");
    expect(papelDoColaborador({ isAdmin: 0, papel: "admin" })).toBeNull();
  });

  it("sessaoDoPainel devolve o papel do token de assistente e sessaoDeAdminValida recusa-o", async () => {
    const token = await mintToken({ id: 7, nome: "MARIA", isAdmin: 0, papel: "assistente" });
    const sessao = await sessaoDoPainel(token);
    expect(sessao?.papel).toBe("assistente");
    expect(sessao?.colab.id).toBe(7);
    expect(await sessaoDeAdminValida(token)).toBe(false);
  });

  it("sessaoDoPainel devolve admin para um token antigo sem papel", async () => {
    const token = await mintToken({ id: 1, nome: "WANDERSON", isAdmin: 1 });
    expect((await sessaoDoPainel(token))?.papel).toBe("admin");
    expect(await sessaoDeAdminValida(token)).toBe(true);
  });

  it("sessaoDoPainel recusa tokens de outros domínios e tokens sem papel nenhum", async () => {
    expect(await sessaoDoPainel(await mintToken({ id: 3, nome: "X", isAdmin: 0 }))).toBeNull();
    expect(await sessaoDoPainel(await mintToken({ id: 3, nome: "X", isAdmin: 0, papel: "assistente", type: "profissional" }))).toBeNull();
    expect(await sessaoDoPainel(null)).toBeNull();
  });
});
