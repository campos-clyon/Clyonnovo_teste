import * as jose from "jose";

export type ProviderTokenPayload = {
  providerId: number;
  name: string;
  /** Discriminador — nunca confundir com um token de colaborador que também usa JWT_SECRET. */
  type: "provider";
};

/**
 * Fonte única de verdade para o segredo JWT dos parceiros.
 * Reutiliza o mesmo JWT_SECRET dos colaboradores (mesmo domínio de confiança),
 * mas o payload inclui type:"provider" para nunca ser aceite como token de colaborador.
 * Gerar com: openssl rand -base64 32
 */
export function getProviderSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "[provider-auth] JWT_SECRET não está definido. " +
      "Adicione JWT_SECRET às variáveis de ambiente (openssl rand -base64 32).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function verifyProviderToken(token?: string | null) {
  if (!token) return null;

  try {
    const { payload } = await jose.jwtVerify(token, getProviderSecretKey());
    const typed = payload as unknown as ProviderTokenPayload;
    if (typed.type !== "provider") return null;
    return typed;
  } catch {
    return null;
  }
}

export async function verifyProviderAuthHeader(authHeader?: string | null) {
  const token = authHeader?.replace("Bearer ", "") ?? null;
  return verifyProviderToken(token);
}
