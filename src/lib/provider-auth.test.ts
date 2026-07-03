import { describe, it, expect, beforeAll } from "vitest";
import * as jose from "jose";
import { verifyProviderToken, verifyProviderAuthHeader } from "./provider-auth";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-not-real-do-not-use-in-prod";
});

async function signProviderToken(payload: Record<string, unknown>) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(secret);
}

describe("verifyProviderToken", () => {
  it("aceita um token válido com type:provider", async () => {
    const token = await signProviderToken({ providerId: 1, name: "CLYON", type: "provider" });
    const payload = await verifyProviderToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.providerId).toBe(1);
    expect(payload?.name).toBe("CLYON");
  });

  it("rejeita um token sem type:provider (ex: token de colaborador)", async () => {
    const token = await signProviderToken({ id: 1, nome: "Alguem", isAdmin: 1 });
    const payload = await verifyProviderToken(token);
    expect(payload).toBeNull();
  });

  it("rejeita um token assinado com segredo errado", async () => {
    const wrongSecret = new TextEncoder().encode("segredo-errado");
    const token = await new jose.SignJWT({ providerId: 1, name: "X", type: "provider" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(wrongSecret);
    const payload = await verifyProviderToken(token);
    expect(payload).toBeNull();
  });

  it("rejeita null/undefined/string vazia", async () => {
    expect(await verifyProviderToken(null)).toBeNull();
    expect(await verifyProviderToken(undefined)).toBeNull();
    expect(await verifyProviderToken("")).toBeNull();
  });

  it("rejeita um token expirado", async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const token = await new jose.SignJWT({ providerId: 1, name: "X", type: "provider" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("0s")
      .sign(secret);
    await new Promise((r) => setTimeout(r, 1100));
    const payload = await verifyProviderToken(token);
    expect(payload).toBeNull();
  });
});

describe("verifyProviderAuthHeader", () => {
  it("extrai o token do header 'Bearer <token>'", async () => {
    const token = await signProviderToken({ providerId: 1, name: "CLYON", type: "provider" });
    const payload = await verifyProviderAuthHeader(`Bearer ${token}`);
    expect(payload?.providerId).toBe(1);
  });

  it("devolve null quando o header está ausente", async () => {
    expect(await verifyProviderAuthHeader(null)).toBeNull();
    expect(await verifyProviderAuthHeader(undefined)).toBeNull();
  });
});
