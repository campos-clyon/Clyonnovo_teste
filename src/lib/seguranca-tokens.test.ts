import { describe, it, expect, beforeAll } from "vitest";
import * as jose from "jose";
import { sessaoDeAdminValida, verifyColaboradorToken } from "./colaborador-auth";

/**
 * Houve um token de parceiro assinado com o MESMO JWT_SECRET do colaborador,
 * e só o lado dos parceiros verificava o discriminador — um token de parceiro
 * passava como colaborador em qualquer rota que só perguntasse "existe token
 * válido?". O portal dos parceiros já não existe, mas os testes ficam: o que
 * eles fixam é que a assinatura por si só nunca chega, e isso vale para
 * qualquer token que venha a partilhar esta chave no futuro.
 */
const SEGREDO = "segredo-de-teste-com-tamanho-suficiente-1234567890";

beforeAll(() => { process.env.JWT_SECRET = SEGREDO; });

const chave = () => new TextEncoder().encode(SEGREDO);

async function assinar(payload: Record<string, unknown>) {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(chave());
}

describe("verifyColaboradorToken — só aceita colaboradores", () => {
  it("aceita um token de colaborador legítimo", async () => {
    const t = await assinar({ id: 1, nome: "WANDERSON", isAdmin: 1 });
    const colab = await verifyColaboradorToken(t);
    expect(colab?.id).toBe(1);
    expect(colab?.nome).toBe("WANDERSON");
  });

  // O caso que estava explorável: assinatura válida, domínio errado
  it("recusa um token de outro domínio, apesar de a assinatura conferir", async () => {
    const t = await assinar({ providerId: 7, name: "Parceiro X", type: "provider" });
    expect(await verifyColaboradorToken(t)).toBeNull();
  });

  it("recusa qualquer token que declare um type", async () => {
    const t = await assinar({ id: 1, nome: "X", type: "cliente" });
    expect(await verifyColaboradorToken(t)).toBeNull();
  });

  it("recusa um payload sem id ou sem nome", async () => {
    expect(await verifyColaboradorToken(await assinar({ nome: "X" }))).toBeNull();
    expect(await verifyColaboradorToken(await assinar({ id: 1 }))).toBeNull();
  });

  it("recusa um id que venha como texto", async () => {
    expect(await verifyColaboradorToken(await assinar({ id: "1", nome: "X" }))).toBeNull();
  });

  it("recusa assinatura de outro segredo", async () => {
    const outra = new TextEncoder().encode("outro-segredo-completamente-diferente-000");
    const t = await new jose.SignJWT({ id: 1, nome: "X" })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(outra);
    expect(await verifyColaboradorToken(t)).toBeNull();
  });

  it("recusa token expirado", async () => {
    const t = await new jose.SignJWT({ id: 1, nome: "X" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(chave());
    expect(await verifyColaboradorToken(t)).toBeNull();
  });

  it("vazio é vazio", async () => {
    expect(await verifyColaboradorToken(null)).toBeNull();
    expect(await verifyColaboradorToken("")).toBeNull();
  });
});

/**
 * O portão do backoffice. Até aqui, /admin era servido a quem o pedisse e o
 * JavaScript da página é que decidia — a olhar para o localStorage, que quem
 * está no browser escreve à mão.
 */
describe("sessaoDeAdminValida — o que abre a porta do painel", () => {
  it("aceita o token de um administrador", async () => {
    expect(await assinar({ id: 1, nome: "WANDERSON", isAdmin: 1 }).then(sessaoDeAdminValida)).toBe(true);
  });

  it("recusa uma conta sem isAdmin", async () => {
    expect(await assinar({ id: 2, nome: "OUTRO", isAdmin: 0 }).then(sessaoDeAdminValida)).toBe(false);
    expect(await assinar({ id: 2, nome: "OUTRO" }).then(sessaoDeAdminValida)).toBe(false);
  });

  it("recusa isAdmin em texto — não basta parecer verdadeiro", async () => {
    expect(await assinar({ id: 3, nome: "X", isAdmin: "sim" }).then(sessaoDeAdminValida)).toBe(false);
  });

  it("recusa um token de outro domínio que se diga administrador", async () => {
    const t = await assinar({ providerId: 9, name: "P", type: "provider", isAdmin: 1 });
    expect(await sessaoDeAdminValida(t)).toBe(false);
  });

  it("recusa um token expirado", async () => {
    const t = await new jose.SignJWT({ id: 1, nome: "X", isAdmin: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(chave());
    expect(await sessaoDeAdminValida(t)).toBe(false);
  });

  it("sem cookie não há sessão", async () => {
    expect(await sessaoDeAdminValida(undefined)).toBe(false);
    expect(await sessaoDeAdminValida("")).toBe(false);
    expect(await sessaoDeAdminValida("nao-e-um-jwt")).toBe(false);
  });
});
