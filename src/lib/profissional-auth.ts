import * as jose from "jose";
import * as bcrypt from "bcryptjs";

/**
 * Sessão e palavra-passe do profissional.
 *
 * ⚠️ O TOKEN LEVA SEMPRE `type: "profissional"`, E ISSO NÃO É DECORATIVO.
 *
 * Este projecto já teve um token de parceiro assinado com o mesmo JWT_SECRET do
 * colaborador. O ficheiro dos parceiros dizia que o campo `type` impedia a
 * confusão, mas só o lado deles verificava — o do colaborador aceitava qualquer
 * assinatura válida, e por isso um token externo entrava no backoffice.
 *
 * Hoje o `verifyColaboradorToken` recusa qualquer token que traga um `type`, e
 * há testes a fixá-lo. O `type` daqui é o que faz essa recusa funcionar: sem
 * ele, um token de profissional voltava a passar por colaborador.
 *
 * A verificação deste lado é simétrica: exige o `type` exacto. Um token de
 * colaborador — que não tem `type` — não abre o painel do profissional.
 */

export const COOKIE_SESSAO_PROFISSIONAL = "clyon_profissional";
export const DURACAO_SESSAO_SEGUNDOS = 30 * 24 * 60 * 60;

/** O valor que distingue este domínio de todos os outros. */
export const TIPO_PROFISSIONAL = "profissional";

export type SessaoDoProfissional = {
  providerId: number;
  nome: string;
  type: typeof TIPO_PROFISSIONAL;
};

function chave() {
  const segredo = process.env.JWT_SECRET;
  if (!segredo) {
    throw new Error(
      "[profissional-auth] JWT_SECRET não está definido. " +
        "Adicione-o às variáveis de ambiente (openssl rand -base64 32).",
    );
  }
  return new TextEncoder().encode(segredo);
}

export async function assinarSessaoDoProfissional(
  providerId: number,
  nome: string,
): Promise<string> {
  return new jose.SignJWT({ providerId, nome, type: TIPO_PROFISSIONAL })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(chave());
}

export async function verificarSessaoDoProfissional(
  token?: string | null,
): Promise<SessaoDoProfissional | null> {
  if (!token) return null;
  try {
    const { payload } = await jose.jwtVerify(token, chave());
    const p = payload as Record<string, unknown>;

    // O `type` exacto, e não "existe um type qualquer": um token de cliente ou
    // de outro domínio futuro que partilhe esta chave não entra aqui.
    if (p.type !== TIPO_PROFISSIONAL) return null;
    if (typeof p.providerId !== "number" || typeof p.nome !== "string") return null;

    return { providerId: p.providerId, nome: p.nome, type: TIPO_PROFISSIONAL };
  } catch {
    return null;
  }
}

// ── Palavra-passe ───────────────────────────────────────────────────────────

/** Mínimo aceitável. Curta demais não protege nada. */
export const MINIMO_DA_PALAVRA_PASSE = 10;

export type ErroDePalavraPasse = { mensagem: string };

/**
 * Regras da palavra-passe.
 *
 * Só comprimento, de propósito. Exigir maiúsculas, números e símbolos produz
 * palavras-passe piores — as pessoas escrevem `Password1!` e apontam-na num
 * papel. O comprimento é o que conta, e dez caracteres deixa espaço para uma
 * frase que se lembre.
 */
export function validarPalavraPasse(valor: unknown): ErroDePalavraPasse | null {
  if (typeof valor !== "string" || valor.length === 0) {
    return { mensagem: "Escolha uma palavra-passe." };
  }
  if (valor.length < MINIMO_DA_PALAVRA_PASSE) {
    return {
      mensagem: `A palavra-passe tem de ter pelo menos ${MINIMO_DA_PALAVRA_PASSE} caracteres.`,
    };
  }
  if (valor.length > 200) {
    return { mensagem: "A palavra-passe é demasiado longa." };
  }
  // Uma palavra-passe só de espaços passa o comprimento e não é nada.
  if (valor.trim().length < MINIMO_DA_PALAVRA_PASSE) {
    return { mensagem: "A palavra-passe não pode ser só espaços." };
  }
  return null;
}

export async function hashDaPalavraPasse(valor: string): Promise<string> {
  return bcrypt.hash(valor, 10);
}

/** Compara. Nunca lança — um hash corrompido é uma recusa, não uma avaria. */
export async function palavraPasseConfere(
  valor: string,
  hashGuardado: string | null | undefined,
): Promise<boolean> {
  if (!hashGuardado) return false;
  try {
    return await bcrypt.compare(valor, hashGuardado);
  } catch {
    return false;
  }
}
