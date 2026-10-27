import * as jose from "jose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { ensureUsersSchema, getPool } from "@/lib/db";
import { sessaoVemDaApp } from "@/lib/profissional-auth";
import { emitidoAntesDoCorte } from "@/lib/corte-das-sessoes";

/**
 * A SESSÃO DO CLIENTE — 27-10-2026 (decisão d8, R1–R3).
 *
 * Até aqui o cliente só tinha a sessão do NextAuth, num cookie do browser. A
 * app de cliente não tem cookies: guarda um token no telemóvel e manda-o em
 * cada chamada, em `Authorization: Bearer` — o mesmo desenho da CLYON Pro.
 *
 * ⚠️ O TOKEN LEVA `type: "cliente"`, E O LEITOR EXIGE-O EXACTO.
 *
 * Há quatro sessões assinadas, três com o mesmo `JWT_SECRET`, e o que as
 * separa é o `type`:
 *   · cliente no site — cookie do NextAuth (outra chave, outro formato);
 *   · cliente na app — Bearer, `type: "cliente"`, só lido aqui;
 *   · profissional — `type: "profissional"`, só lido por
 *     `verificarSessaoDoProfissional` (que exige o seu `type` exacto);
 *   · equipa (backoffice) — SEM `type`, e `verifyColaboradorToken` recusa
 *     qualquer token que traga um.
 * Nenhum leitor aceita o token de outro: um cliente não abre o painel nem o
 * backoffice, e um profissional ou alguém da equipa não abre o lado do
 * cliente com o seu token. Os testes de `sessao-do-cliente.test.ts` fixam-no.
 *
 * O TOKEN NÃO LEVA MAIS NADA: nem id interno, nem nome, nem telefone, nem
 * papel. O cliente é o email — é por ele que os pedidos se ligam
 * (`contactEmail`) — e um token que levasse mais coisas era um token que um
 * dia alguém lia em vez de perguntar à base.
 */

export const TIPO_CLIENTE = "cliente";
export const DURACAO_SESSAO_CLIENTE_SEGUNDOS = 30 * 24 * 60 * 60;

export type EntradaDoCliente = "google" | "link";
const ENTRADAS: readonly EntradaDoCliente[] = ["google", "link"];

/** Os campos que um token de cliente tem — e só estes. */
const CAMPOS_DO_TOKEN = new Set(["type", "email", "entrada", "iat", "exp"]);

export type SessaoDoClienteNaApp = {
  type: typeof TIPO_CLIENTE;
  email: string;
  entrada: EntradaDoCliente;
  /** `iat`, em segundos — o que o corte das sessões compara. */
  emitidoEm: number;
  /** `exp`, em segundos. */
  expiraEm: number;
};

function chave() {
  const segredo = process.env.JWT_SECRET;
  if (!segredo) {
    throw new Error(
      "[cliente-auth] JWT_SECRET não está definido. " +
        "Adicione-o às variáveis de ambiente (openssl rand -base64 32).",
    );
  }
  return new TextEncoder().encode(segredo);
}

export function normalizarEmailDoCliente(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/** Assina uma sessão de trinta dias para a app. */
export async function assinarSessaoDoCliente(
  email: string,
  entrada: EntradaDoCliente,
  agora: Date = new Date(),
): Promise<{ token: string; expiraEm: Date }> {
  const emailNorm = normalizarEmailDoCliente(email);
  if (!emailNorm) throw new Error("[cliente-auth] sessão sem email");
  const iat = Math.floor(agora.getTime() / 1000);
  const exp = iat + DURACAO_SESSAO_CLIENTE_SEGUNDOS;
  const token = await new jose.SignJWT({ type: TIPO_CLIENTE, email: emailNorm, entrada })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(chave());
  return { token, expiraEm: new Date(exp * 1000) };
}

/**
 * Só a assinatura e a forma — sem ir à base. Exige o `type` exacto, e recusa
 * um token com campos a mais (um token de profissional ou de equipa com um
 * `type: "cliente"` acrescentado à mão não é nosso, venha de onde vier).
 */
export async function verificarSessaoDoCliente(
  token?: string | null,
): Promise<SessaoDoClienteNaApp | null> {
  if (!token) return null;
  try {
    const { payload } = await jose.jwtVerify(token, chave(), { algorithms: ["HS256"] });
    const p = payload as Record<string, unknown>;
    if (p.type !== TIPO_CLIENTE) return null;
    if (Object.keys(p).some((k) => !CAMPOS_DO_TOKEN.has(k))) return null;
    const email = normalizarEmailDoCliente(p.email);
    if (!email || email !== p.email || !email.includes("@")) return null;
    if (!ENTRADAS.includes(p.entrada as EntradaDoCliente)) return null;
    if (typeof p.iat !== "number" || typeof p.exp !== "number") return null;
    return {
      type: TIPO_CLIENTE,
      email,
      entrada: p.entrada as EntradaDoCliente,
      emitidoEm: p.iat,
      expiraEm: p.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Folga entre o relógio do servidor e o da base, ao comparar o `iat` com o
 * nascimento da conta. Um token emitido mais de dez minutos antes de a conta
 * existir é de uma conta que já foi apagada e voltou a ser criada com o mesmo
 * email — e não abre a conta nova.
 */
const FOLGA_DO_NASCIMENTO_SEGUNDOS = 600;

/**
 * A SESSÃO DA APP, CONFIRMADA NA BASE — como `sessaoActivaDoProfissional`.
 *
 * O token tem de ser válido E a conta tem de existir, não estar apagada, e o
 * token não pode ser de antes do corte (`users.sessoesClienteDesde`, posto em
 * agora ao apagar a conta ou num futuro «Sair de todos os aparelhos») nem de
 * antes de a conta nascer.
 *
 * SE A BASE FALHAR, LANÇA (dá 500, e a app tenta outra vez) — não devolve
 * null, que faria a app deitar fora a sessão por um soluço da base.
 */
export async function sessaoActivaDoCliente(
  token?: string | null,
): Promise<SessaoDoClienteNaApp | null> {
  const sessao = await verificarSessaoDoCliente(token);
  if (!sessao) return null;

  await ensureUsersSchema();
  const pool = await getPool();
  if (!pool) throw new Error("[cliente-auth] base de dados indisponível");

  type Conta = { sessoesClienteDesde?: Date | string | null; contaMaisNova?: number | null };
  let linhas: Conta[];
  const iatComFolga = sessao.emitidoEm + FOLGA_DO_NASCIMENTO_SEGUNDOS;
  try {
    [linhas] = (await pool.execute(
      `SELECT sessoesClienteDesde, (createdAt > FROM_UNIXTIME(?)) AS contaMaisNova
         FROM users WHERE email = ? AND deletedAt IS NULL LIMIT 1`,
      [iatComFolga, sessao.email],
    )) as [Conta[], unknown];
  } catch (e) {
    // Sem a coluna (a migração ainda não correu): entra-se sem o corte.
    if ((e as { code?: string })?.code !== "ER_BAD_FIELD_ERROR") throw e;
    [linhas] = (await pool.execute(
      `SELECT (createdAt > FROM_UNIXTIME(?)) AS contaMaisNova
         FROM users WHERE email = ? AND deletedAt IS NULL LIMIT 1`,
      [iatComFolga, sessao.email],
    )) as [Conta[], unknown];
  }

  const conta = linhas[0];
  if (!conta) return null;
  if (Number(conta.contaMaisNova) === 1) return null;
  if (emitidoAntesDoCorte(sessao.emitidoEm, conta.sessoesClienteDesde)) return null;
  return sessao;
}

/** O token que vem no cabeçalho, ou `null` (vazio ou estragado). */
export function tokenDoClienteNoCabecalho(req: {
  headers: { get: (nome: string) => string | null };
}): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization")?.trim() ?? "");
  return m ? m[1] : null;
}

export type ClienteDaSessao = {
  email: string;
  /** Só a sessão do site sabe o nome (o token da app não o leva). */
  nome: string | null;
  viaApp: boolean;
};

/**
 * QUEM É O CLIENTE DESTE PEDIDO — o único leitor da sessão do cliente (R3).
 *
 * 1. Com `Authorization: Bearer …` — só um token de cliente activo. Qualquer
 *    outro (de profissional, de equipa, estragado, expirado, de conta
 *    apagada) é `null`, e O COOKIE NÃO É LIDO: um Bearer errado não cai para
 *    a sessão do browser, para a app nunca trabalhar com uma sessão que não é
 *    a que julga ter.
 * 2. Sem Bearer — a sessão do NextAuth (o cookie do site), como sempre.
 *
 * As rotas do cliente leem a sessão por aqui e não pelo `getServerSession`
 * directo (um teste lê `src/app/api` e chumba quem o fizer).
 */
export async function clienteDaSessao(req: {
  headers: { get: (nome: string) => string | null };
}): Promise<ClienteDaSessao | null> {
  if (sessaoVemDaApp(req)) {
    const sessao = await sessaoActivaDoCliente(tokenDoClienteNoCabecalho(req));
    return sessao ? { email: sessao.email, nome: null, viaApp: true } : null;
  }
  const s = await getServerSession(authOptions);
  const email = normalizarEmailDoCliente(s?.user?.email);
  if (!email) return null;
  return { email, nome: s?.user?.name ?? null, viaApp: false };
}

/**
 * A mesma leitura, com a forma da sessão do NextAuth (`session.user.email`,
 * `session.user.name`) — para as rotas que já existiam trocarem o
 * `getServerSession` por esta sem mudar o resto.
 */
export async function sessaoDoCliente(req: {
  headers: { get: (nome: string) => string | null };
}): Promise<{ user: { email: string; name: string | null } } | null> {
  const c = await clienteDaSessao(req);
  return c ? { user: { email: c.email, name: c.nome } } : null;
}

/** O email do cliente desta sessão (minúsculas, sem espaços), ou `null`. */
export async function emailDoCliente(req: {
  headers: { get: (nome: string) => string | null };
}): Promise<string | null> {
  return (await clienteDaSessao(req))?.email ?? null;
}

/**
 * A APP DE CLIENTE ABRIU: grava quando e com que versão (as medidas da
 * especificação, como `registarAppAberta` da Pro). Nunca lança — a sessão já
 * foi renovada.
 */
export async function registarAppDoClienteAberta(email: string, versao: string): Promise<void> {
  try {
    await ensureUsersSchema();
    const pool = await getPool();
    if (!pool) return;
    await pool.execute(
      "UPDATE users SET appClienteAbertaEm = NOW(), appClienteVersao = ? WHERE email = ? AND deletedAt IS NULL",
      [versao || null, email],
    );
  } catch (e) {
    console.error("[cliente-auth] registar a abertura:", e instanceof Error ? e.message : e);
  }
}
