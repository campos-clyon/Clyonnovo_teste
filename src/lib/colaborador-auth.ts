import * as jose from "jose";

export type ColaboradorTokenPayload = {
  id: number;
  nome: string;
  isAdmin: number;
  /** Funcao do colaborador — colocada no JWT pelo login route */
  funcao?: string;
};

/**
 * Fonte única de verdade para o segredo JWT dos colaboradores.
 * A verificação é lazy (em runtime) para não falhar durante o build do Next.js,
 * quando as variáveis de ambiente de runtime ainda não estão disponíveis.
 * Gerar com: openssl rand -base64 32
 */
export function getColaboradorSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "[colaborador-auth] JWT_SECRET não está definido. " +
      "Adicione JWT_SECRET às variáveis de ambiente (openssl rand -base64 32).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function verifyColaboradorToken(token?: string | null) {
  if (!token) return null;

  try {
    const { payload } = await jose.jwtVerify(token, getColaboradorSecretKey());
    return payload as unknown as ColaboradorTokenPayload;
  } catch {
    return null;
  }
}

export async function verifyColaboradorAuthHeader(authHeader?: string | null) {
  const token = authHeader?.replace("Bearer ", "") ?? null;
  return verifyColaboradorToken(token);
}
