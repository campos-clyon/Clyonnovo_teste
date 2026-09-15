import * as jose from "jose";
import {
  LEMBRAR_POR_OMISSAO,
  devePrologar,
  duracaoDaSessao,
  maxAgeDoCookie,
} from "./manter-sessao";
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
  /**
   * Ele pediu para ficar ligado — ver `manter-sessao`.
   *
   * Viaja DENTRO do token e nao num cookie ao lado: a escolha tem de sobreviver
   * a cada renovacao, e um cookie a parte podia ser apagado sozinho e deixar a
   * sessao sem saber o que ela e.
   */
  lembrar: boolean;
  /** Quando o token deixa de valer, em segundos. E o que decide a renovacao. */
  expiraEm: number | null;
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
  /**
   * Manter-me ligado. Por omissao SIM — e o que o sistema sempre fez, e o que
   * ele quer em quase todos os casos. Ver `LEMBRAR_POR_OMISSAO`.
   */
  lembrar: boolean = LEMBRAR_POR_OMISSAO,
): Promise<string> {
  /*
   * O prazo sai da escolha, e nao de um "30d" escrito a mao aqui. Eram dois
   * numeros a ter de concordar — este e o `maxAge` do cookie — e o dia em que
   * discordassem dava um token vivo dentro de um cookie morto, ou o inverso:
   * uma sessao que o browser guarda e o servidor recusa.
   */
  return new jose.SignJWT({ providerId, nome, type: TIPO_PROFISSIONAL, lembrar })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${duracaoDaSessao(lembrar)}s`)
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

    return {
      providerId: p.providerId,
      nome: p.nome,
      type: TIPO_PROFISSIONAL,
      /*
       * Os tokens assinados ANTES desta mudanca nao tem `lembrar`. Contam como
       * lembrados, que e o que eram: trinta dias de cookie persistente. Le-los
       * como "nao lembrar" deitava fora, de uma vez, toda a gente que estava
       * ligada no dia em que isto subisse.
       */
      lembrar: p.lembrar === false ? false : true,
      expiraEm: typeof p.exp === "number" ? p.exp : null,
    };
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

/* ────────────────────────────────────────────────────────────────────────────
 * O COOKIE, NUM SÍTIO SÓ.
 *
 * Eram três rotas a escrevê-lo com cinco opções copiadas à mão — entrar,
 * definir a palavra-passe, e agora a renovação. Cinco opções copiadas três
 * vezes é uma que um dia fica diferente das outras, e a que fica diferente é
 * sempre a que ninguém olha: um `httpOnly` esquecido abre a sessão ao
 * JavaScript da página, e um `maxAge` esquecido faz dela um cookie que morre
 * com o browser. Foi por isso que isto passou a ter nome.
 * ──────────────────────────────────────────────────────────────────────────── */

type RespostaComCookies = {
  cookies: {
    set: (nome: string, valor: string, opcoes: Record<string, unknown>) => unknown;
  };
};

/** Escreve a sessão na resposta, com as opções certas para a escolha dele. */
export function porSessaoNaResposta(
  resposta: RespostaComCookies,
  token: string,
  lembrar: boolean,
): void {
  resposta.cookies.set(COOKIE_SESSAO_PROFISSIONAL, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeDoCookie(lembrar),
  });
}

/**
 * RENOVAR A SESSÃO DE QUEM ESTÁ A USAR O PAINEL.
 *
 * "Garanta que funcione para eles não terem de entrar com senha várias vezes
 * ao dia." — 15-09-2026.
 *
 * Sem isto, os trinta dias contavam-se do dia em que ele entrou: ao trigésimo
 * primeiro era posto fora por muito que tivesse trabalhado todos os dias.
 * Agora o prazo conta-se da última vez que cá esteve — enquanto usar, nunca sai.
 *
 * Só depois de METADE do prazo, e só a quem pediu para ser lembrado. As duas
 * condições estão em `devePrologar`, com o porquê de cada uma.
 *
 * Não devolve erro: falhar a renovar deixa a sessão como estava, que ainda
 * tem quinze dias pela frente. Nunca pode impedir a resposta de sair.
 */
export async function renovarSessaoSePreciso(
  resposta: RespostaComCookies,
  sessao: SessaoDoProfissional,
  agora: Date = new Date(),
): Promise<boolean> {
  if (!devePrologar(sessao.expiraEm, sessao.lembrar, agora)) return false;
  try {
    const token = await assinarSessaoDoProfissional(sessao.providerId, sessao.nome, sessao.lembrar);
    porSessaoNaResposta(resposta, token, sessao.lembrar);
    return true;
  } catch (e) {
    console.error("[profissional-auth] não renovei a sessão:", e instanceof Error ? e.message : e);
    return false;
  }
}
