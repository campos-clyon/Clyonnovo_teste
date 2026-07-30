import { describe, it, expect, beforeAll } from "vitest";
import * as jose from "jose";
import { verifyColaboradorToken } from "./colaborador-auth";

/**
 * O token de parceiro é assinado com o MESMO JWT_SECRET do colaborador.
 * O comentário em provider-auth.ts dizia que o campo `type: "provider"`
 * impedia a confusão — mas só o lado dos parceiros o verificava. Um token de
 * parceiro passava como colaborador em qualquer rota que só perguntasse
 * "existe token válido?".
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
  it("recusa um token de PARCEIRO, apesar de a assinatura conferir", async () => {
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
