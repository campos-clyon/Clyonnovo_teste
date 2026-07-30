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

/**
 * ⚠️ O token de PARCEIRO é assinado com o MESMO JWT_SECRET (ver
 * provider-auth.ts). O comentário lá diz que o campo `type: "provider"`
 * impede que seja aceite como token de colaborador — mas só o lado dos
 * parceiros verificava o `type`. Este não verificava nada além da assinatura,
 * por isso um token de parceiro passava aqui como se fosse um colaborador.
 *
 * Em qualquer rota que se limite a `if (!colab) 401`, isso significa que um
 * parceiro externo com conta válida entrava. As rotas que usam requireAdmin
 * escapavam por acidente — o payload de parceiro não tem `isAdmin`, e o
 * `!colab.isAdmin` recusava — mas não é aceitável depender de acidentes
 * quando quem verifica é a porta de casa.
 *
 * A verificação passa a ser explícita nos dois sentidos.
 */
export async function verifyColaboradorToken(token?: string | null) {
  if (!token) return null;

  try {
    const { payload } = await jose.jwtVerify(token, getColaboradorSecretKey());

    // Um token de outro domínio (parceiro, cliente) não é um colaborador,
    // por muito que a assinatura confira.
    if (typeof (payload as Record<string, unknown>).type === "string") return null;

    // Um colaborador tem sempre id e nome. Um payload sem eles não é um
    // token nosso, venha de onde vier.
    const colab = payload as unknown as ColaboradorTokenPayload;
    if (typeof colab.id !== "number" || typeof colab.nome !== "string") return null;

    return colab;
  } catch {
    return null;
  }
}

export async function verifyColaboradorAuthHeader(authHeader?: string | null) {
  const token = authHeader?.replace("Bearer ", "") ?? null;
  return verifyColaboradorToken(token);
}
