import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

/**
 * O portão do ambiente de testes.
 *
 * A plataforma vive em produção — mesma base, mesmos emails, mesmos links —
 * mas não está aberta a ninguém. Não é um ambiente à parte: é o site a sério
 * com uma porta fechada à frente da parte nova.
 *
 * Duas fechaduras, e são-no de propósito:
 *
 *   1. **A chave no endereço.** Sem ela, o caminho responde 404 — nem sequer
 *      admite que existe uma porta. Um 403 confirmava a alguém que anda a
 *      sondar que ali há qualquer coisa;
 *   2. **Credenciais por pessoa.** A chave sozinha viaja: vai num WhatsApp,
 *      fica no histórico do browser, aparece num screenshot. Quem a apanhar
 *      chega ao ecrã de entrada e mais nada.
 *
 * O que NÃO fica atrás do portão são os links com token — o do pedido e o da
 * negociação. Esses trazem 256 bits de segredo e são guardados em hash: é uma
 * credencial mais forte do que qualquer palavra-passe que alguém escolha. Pô-los
 * atrás do portão obrigava o cliente de teste a ter conta de testador, e
 * deixávamos de estar a testar o fluxo real — que é justamente um cliente sem
 * conta nenhuma a abrir o link do email.
 */

export const COOKIE_CHAVE_MVP = "clyon_mvp_chave";
export const COOKIE_SESSAO_TESTE = "clyon_mvp";
export const DURACAO_SESSAO_TESTE_SEGUNDOS = 30 * 24 * 60 * 60;

/** Discrimina este token de todos os outros do projecto. */
export const TIPO_TESTE = "teste";

export type SessaoDeTeste = {
  testadorId: number;
  nome: string;
  type: typeof TIPO_TESTE;
};

function chaveDeAssinatura() {
  const segredo = process.env.JWT_SECRET;
  if (!segredo) {
    throw new Error(
      "[acesso-mvp] JWT_SECRET não está definido. " +
        "Adicione-o às variáveis de ambiente (openssl rand -base64 32).",
    );
  }
  return new TextEncoder().encode(segredo);
}

/**
 * Compara sem revelar pelo tempo quantos caracteres acertou.
 *
 * `a === b` desiste no primeiro caractere diferente, e a diferença de tempo
 * chega para adivinhar a chave letra a letra. Escrito à mão porque isto corre
 * também no edge, onde `crypto.timingSafeEqual` não existe.
 */
export function comparaSemFuga(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  // O comprimento não é segredo — o conteúdo é. Percorre-se sempre o maior.
  const n = Math.max(x.length, y.length);
  let diferenca = x.length ^ y.length;
  for (let i = 0; i < n; i++) {
    diferenca |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diferenca === 0;
}

/** A chave configurada, ou null se o ambiente não a tiver. */
export function chaveConfigurada(): string | null {
  const chave = process.env.CHAVE_MVP?.trim();
  return chave && chave.length >= 16 ? chave : null;
}

/**
 * A chave apresentada serve?
 *
 * Sem `CHAVE_MVP` no ambiente, NADA passa. É a escolha certa: um ambiente mal
 * configurado que deixasse entrar toda a gente é pior do que um que não deixe
 * entrar ninguém — o segundo nota-se em dez segundos, o primeiro pode passar
 * meses sem ninguém reparar.
 */
export function chaveConfere(apresentada: unknown): boolean {
  const esperada = chaveConfigurada();
  if (!esperada) return false;
  if (typeof apresentada !== "string" || apresentada.length === 0) return false;
  return comparaSemFuga(apresentada, esperada);
}

export async function assinarSessaoDeTeste(dados: {
  testadorId: number;
  nome: string;
}): Promise<string> {
  return new SignJWT({ ...dados, type: TIPO_TESTE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_TESTE_SEGUNDOS}s`)
    .sign(chaveDeAssinatura());
}

/**
 * Verifica a sessão de testador.
 *
 * Exige o `type` exacto. Um cookie de administrador ou de profissional
 * colocado à mão neste nome não abre nada — este projecto já teve um token de
 * um domínio a passar por outro.
 */
export async function verificarSessaoDeTeste(
  token?: string | null,
): Promise<SessaoDeTeste | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chaveDeAssinatura());
    if (payload.type !== TIPO_TESTE) return null;
    const testadorId = Number(payload.testadorId);
    if (!Number.isInteger(testadorId) || testadorId <= 0) return null;
    return {
      testadorId,
      nome: typeof payload.nome === "string" ? payload.nome : "",
      type: TIPO_TESTE,
    };
  } catch {
    return null;
  }
}

export const MINIMO_DA_PALAVRA_PASSE_DE_TESTE = 10;

export function validarPalavraPasseDeTeste(valor: unknown): string | null {
  if (typeof valor !== "string" || valor.length < MINIMO_DA_PALAVRA_PASSE_DE_TESTE) {
    return `A palavra-passe tem de ter pelo menos ${MINIMO_DA_PALAVRA_PASSE_DE_TESTE} caracteres.`;
  }
  if (valor.trim().length < MINIMO_DA_PALAVRA_PASSE_DE_TESTE) {
    return "A palavra-passe não pode ser só espaços.";
  }
  return null;
}

export async function hashDaPalavraPasseDeTeste(valor: string): Promise<string> {
  return bcrypt.hash(valor, 10);
}

export async function palavraPasseDeTesteConfere(
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

/**
 * Um endereço da plataforma com a chave lá dentro, para pôr num email.
 *
 * Enquanto o MVP estiver fechado, um link para o painel do profissional sem a
 * chave dá 404 a quem o receber — e a pessoa conclui, com razão, que aquilo
 * está avariado.
 *
 * A chave passa a viajar por email, e isso é uma cedência consciente: fica na
 * caixa de correio de quem convidámos e nos registos do serviço de envio. O que
 * a torna aceitável é que não abre nada sozinha — o painel continua a exigir a
 * palavra-passe dele. E roda-se numa variável de ambiente, num minuto.
 *
 * Quando a plataforma abrir ao público, esta função devolve o endereço tal e
 * qual: apaga-se a CHAVE_MVP e os links deixam de a levar.
 */
export function comChave(url: string): string {
  const chave = chaveConfigurada();
  if (!chave) return url;
  const separador = url.includes("?") ? "&" : "?";
  return `${url}${separador}chave=${encodeURIComponent(chave)}`;
}
