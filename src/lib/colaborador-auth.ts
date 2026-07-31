import * as jose from "jose";

export type ColaboradorTokenPayload = {
  id: number;
  nome: string;
  isAdmin: number;
};

/**
 * Cookie de sessão do backoffice.
 *
 * O token do painel vivia só no localStorage. Isso quer dizer que o servidor
 * não o via: qualquer pedido a /admin recebia o HTML do painel, e o que
 * decidia se entrava era JavaScript no browser a olhar para uma chave que o
 * próprio browser guarda. Escrever `colaborador_isAdmin = "1"` na consola
 * bastava para o painel desenhar — vazio, porque as APIs verificam o token,
 * mas a desenhar.
 *
 * O mesmo token passa a ir também num cookie httpOnly, que o JavaScript da
 * página não lê nem escreve, para o middleware poder verificar a assinatura
 * antes de servir seja o que for.
 */
export const COOKIE_SESSAO_ADMIN = "clyon_admin";

/** 8 horas — o mesmo que o JWT. Expiram juntos, de propósito. */
export const DURACAO_SESSAO_ADMIN_SEGUNDOS = 8 * 60 * 60;

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

/**
 * O middleware usa isto para decidir se serve o backoffice.
 *
 * Passa pelo mesmo `verifyColaboradorToken` das APIs — assinatura, token de
 * outro domínio, id e nome — e acrescenta o que aqui interessa: tem de ser
 * administrador. Ter uma segunda implementação da mesma verificação era
 * garantir que um dia as duas discordavam.
 */
export async function sessaoDeAdminValida(token?: string | null) {
  const colab = await verifyColaboradorToken(token);
  return colab !== null && Number(colab.isAdmin) === 1;
}

export async function verifyColaboradorAuthHeader(authHeader?: string | null) {
  const token = authHeader?.replace("Bearer ", "") ?? null;
  return verifyColaboradorToken(token);
}
