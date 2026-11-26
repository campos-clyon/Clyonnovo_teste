/**
 * «QUEM CONTA PARA OS 12», NA BASE — 17-11-2026 (d60). As regras puras estão
 * em `quem-conta-para-os-12.ts`.
 *
 * DE ONDE VEM A «ÚLTIMA ABERTURA»:
 *   · CLYON Pro — `providers.appAbertaEm`, gravada desde 27-10-2026 pela rota
 *     que a app chama sempre que abre (`POST /api/profissionais/sessao`) e,
 *     desde 17-11-2026, também na entrada pela app (`/entrar` e
 *     `/definir-senha` com `paraApp`);
 *   · app de cliente — `users.appClienteAbertaEm`, gravada pela rota da
 *     sessão da app (`POST /api/cliente/sessao`) e, desde 17-11-2026, na
 *     entrada pela app (`/api/cliente/entrar`, `/api/entrada/palavra-passe`).
 * Quem instalou antes disso e tem os avisos ligados (`pushSubscriptions`)
 * conta como «Instalou e parou» até a app abrir outra vez.
 *
 * A LISTA COLADA da Play fica numa tabela nova, uma linha por app, que se
 * substitui a cada colagem (e se apaga colando uma lista vazia). São emails:
 * só o administrador a lê.
 */

import type { Pool } from "mysql2/promise";
import { ensureProvidersSchema, ensureUsersSchema, getPool } from "./db";
import { instanteDaBase } from "./hora-de-lisboa";
import {
  emailsDaListaColada,
  type AppDoTeste,
  type PessoaDoTeste,
} from "./quem-conta-para-os-12";

let tabelaPronta = false;

export const SQL_DA_LISTA_DA_PLAY = `
    CREATE TABLE IF NOT EXISTS listasDaPlayColadas (
      app       VARCHAR(16)  NOT NULL PRIMARY KEY,
      emails    MEDIUMTEXT   NOT NULL,
      coladaEm  DATETIME     NOT NULL,
      porQuem   VARCHAR(120) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

async function pool(): Promise<Pool> {
  const p = await getPool();
  if (!p) throw new Error("[quem-conta-para-os-12] base de dados indisponível");
  if (!tabelaPronta) {
    await p.execute(SQL_DA_LISTA_DA_PLAY);
    tabelaPronta = true;
  }
  return p as Pool;
}

async function lerSeExistir<T>(p: Pool, sql: string): Promise<T[]> {
  try {
    const [linhas] = (await p.query(sql)) as [T[], unknown];
    return linhas;
  } catch (err) {
    // Uma tabela que ainda não nasceu (nenhum convite enviado) é uma lista vazia.
    if ((err as { code?: string })?.code === "ER_NO_SUCH_TABLE") return [];
    throw err;
  }
}

const iso = (v: Date | string | null | undefined): string | null => {
  const d = instanteDaBase(v ?? null);
  return d ? d.toISOString() : null;
};

const minusculo = (v: unknown): string => (typeof v === "string" ? v.trim().toLowerCase() : "");

/* ─── A lista colada ────────────────────────────────────────────────────── */

export type ListaDaPlayGuardada = { emails: string[]; coladaEm: string | null; porQuem: string | null };

export async function listaDaPlayGuardada(app: AppDoTeste): Promise<ListaDaPlayGuardada> {
  const p = await pool();
  const [linhas] = (await p.execute(
    "SELECT emails, coladaEm, porQuem FROM listasDaPlayColadas WHERE app = ? LIMIT 1",
    [app],
  )) as [Array<{ emails: string; coladaEm: Date | string | null; porQuem: string | null }>, unknown];
  const l = linhas[0];
  if (!l) return { emails: [], coladaEm: null, porQuem: null };
  return { emails: emailsDaListaColada(l.emails), coladaEm: iso(l.coladaEm), porQuem: l.porQuem ?? null };
}

/** Guarda a lista (só os emails, um por linha). Vazia = apaga. Devolve quantos ficaram. */
export async function guardarListaDaPlay(app: AppDoTeste, texto: unknown, porQuem: string): Promise<number> {
  const p = await pool();
  const emails = emailsDaListaColada(texto);
  if (emails.length === 0) {
    await p.execute("DELETE FROM listasDaPlayColadas WHERE app = ?", [app]);
    return 0;
  }
  await p.execute(
    `INSERT INTO listasDaPlayColadas (app, emails, coladaEm, porQuem) VALUES (?, ?, UTC_TIMESTAMP(), ?)
     ON DUPLICATE KEY UPDATE emails = VALUES(emails), coladaEm = VALUES(coladaEm), porQuem = VALUES(porQuem)`,
    [app, emails.join("\n"), porQuem.slice(0, 120)],
  );
  return emails.length;
}

/* ─── Quem devia estar no teste ─────────────────────────────────────────── */

/**
 * CLYON Pro: os profissionais aprovados e activos (todos vêem o convite do
 * teste no painel), e quem — aprovado ou não — já abriu a app ou deu o Gmail
 * do teste. A conta da própria CLYON fica de fora.
 */
export async function pessoasDaAppPro(): Promise<PessoaDoTeste[]> {
  await ensureProvidersSchema();
  const p = await pool();
  const [linhas, avisos] = await Promise.all([
    lerSeExistir<{
      id: number;
      name: string | null;
      email: string | null;
      phone: string | null;
      gmailDoTeste: string | null;
      appAbertaEm: Date | string | null;
      appVersao: string | null;
      estado: string | null;
      isActive: number | null;
      contaDeTeste: number | null;
      createdAt: Date | string | null;
    }>(
      p,
      `SELECT id, name, email, phone, gmailDoTeste, appAbertaEm, appVersao, estado, isActive, contaDeTeste, createdAt
         FROM providers
        WHERE isClyon = 0 AND COALESCE(estado, '') <> 'apagado'
          AND ((isActive = 1 AND estado = 'aprovado')
               OR appAbertaEm IS NOT NULL
               OR (gmailDoTeste IS NOT NULL AND gmailDoTeste <> ''))
        LIMIT 3000`,
    ),
    lerSeExistir<{ e: string }>(
      p,
      "SELECT DISTINCT LOWER(TRIM(userEmail)) AS e FROM pushSubscriptions WHERE app = 'pro'",
    ),
  ]);
  const comAvisos = new Set(avisos.map((a) => String(a.e)));

  return linhas.map((l) => {
    const emails = [minusculo(l.email), minusculo(l.gmailDoTeste)].filter((e, i, a) => e && a.indexOf(e) === i);
    const aprovado = Number(l.isActive) === 1 && l.estado === "aprovado";
    return {
      id: `p${Number(l.id)}`,
      nome: String(l.name ?? "").trim() || `Sem nome (#${Number(l.id)})`,
      emails,
      telefone: l.phone ? String(l.phone) : null,
      abertaEm: iso(l.appAbertaEm),
      versao: l.appVersao ? String(l.appVersao) : null,
      temAvisosDaApp: emails.some((e) => comAvisos.has(e)),
      porque: aprovado ? "Aprovado (vê o convite no painel)" : l.appAbertaEm ? "Abriu a app" : "Deu o Gmail do teste",
      contaDeTeste: Number(l.contaDeTeste ?? 0) === 1,
      inscritoEm: iso(l.createdAt),
    };
  });
}

/**
 * App de cliente: quem foi posto na lista da Play ou convidado no programa
 * (`programaDaApp`, fora quem saiu e quem só se inscreveu), quem recebeu o
 * convite em massa (`convitesAppCliente`) e qualquer conta que já abriu a app.
 */
export async function pessoasDaAppDeCliente(): Promise<PessoaDoTeste[]> {
  await ensureUsersSchema();
  const p = await pool();
  type Conta = {
    id: number | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    appClienteAbertaEm: Date | string | null;
    appClienteVersao: string | null;
  };
  /*
   * Consultas simples, juntadas aqui: um JOIN por email entre tabelas criadas
   * em alturas diferentes pode chocar nas colações (o 500 do primeiro dia).
   */
  const [programaCru, convites, abriram, avisos] = await Promise.all([
    lerSeExistir<{ email: string; estado: string; userId: number | null }>(
      p,
      "SELECT email, estado, userId FROM programaDaApp WHERE estado IN ('adicionado', 'convidado')",
    ),
    lerSeExistir<{ userId: number }>(p, "SELECT userId FROM convitesAppCliente WHERE enviadoEm IS NOT NULL"),
    lerSeExistir<Conta>(
      p,
      `SELECT id, name, email, phone, appClienteAbertaEm, appClienteVersao
         FROM users WHERE deletedAt IS NULL AND appClienteAbertaEm IS NOT NULL
        LIMIT 3000`,
    ),
    lerSeExistir<{ e: string }>(
      p,
      "SELECT DISTINCT LOWER(TRIM(userEmail)) AS e FROM pushSubscriptions WHERE app = 'cliente'",
    ),
  ]);

  const ids = [
    ...new Set([...programaCru.map((l) => l.userId), ...convites.map((c) => c.userId)].filter((v) => v != null).map(Number)),
  ];
  const emailsSemConta = [...new Set(programaCru.filter((l) => l.userId == null).map((l) => minusculo(l.email)).filter(Boolean))];
  let contas: Conta[] = [];
  if (ids.length || emailsSemConta.length) {
    const [linhas] = (await p.query(
      `SELECT id, name, email, phone, appClienteAbertaEm, appClienteVersao
         FROM users WHERE deletedAt IS NULL AND (id IN (?) OR email IN (?))`,
      [ids.length ? ids : [0], emailsSemConta.length ? emailsSemConta : [""]],
    )) as [Conta[], unknown];
    contas = linhas;
  }
  const porId = new Map(contas.map((c) => [Number(c.id), c]));
  const porEmail = new Map(contas.map((c) => [minusculo(c.email), c]));
  // Inscrito no programa sem conta CLYON: fica pelo email do programa.
  const SEM_CONTA: Conta = { id: null, name: null, email: null, phone: null, appClienteAbertaEm: null, appClienteVersao: null };
  const programa = programaCru.map((l) => ({
    ...((l.userId != null ? porId.get(Number(l.userId)) : porEmail.get(minusculo(l.email))) ?? SEM_CONTA),
    emailDoPrograma: String(l.email),
    estadoNoPrograma: String(l.estado),
  }));
  const emMassa = convites.map((c) => porId.get(Number(c.userId))).filter((c): c is Conta => c != null);
  const comAvisos = new Set(avisos.map((a) => String(a.e)));

  const porChave = new Map<string, PessoaDoTeste>();
  const juntar = (c: Conta, porque: string, emailExtra?: string) => {
    const emailDaConta = minusculo(c.email);
    const extra = minusculo(emailExtra);
    const chave = c.id != null ? `c${Number(c.id)}` : `e:${extra}`;
    if (chave === "e:") return;
    const ja = porChave.get(chave);
    if (ja) {
      if (extra && !ja.emails.includes(extra)) ja.emails.push(extra);
      return;
    }
    const emails = [emailDaConta, extra].filter((e, i, a) => e && a.indexOf(e) === i);
    porChave.set(chave, {
      id: chave,
      nome: String(c.name ?? "").trim() || (c.id != null ? `Conta #${Number(c.id)}` : "Sem conta CLYON"),
      emails,
      telefone: c.phone ? String(c.phone) : null,
      abertaEm: iso(c.appClienteAbertaEm),
      versao: c.appClienteVersao ? String(c.appClienteVersao) : null,
      temAvisosDaApp: emails.some((e) => comAvisos.has(e)),
      porque,
      contaDeTeste: false,
    });
  };

  for (const l of programa) {
    juntar(
      l,
      l.estadoNoPrograma === "convidado" ? "Programa: convidado" : "Programa: adicionado à Play",
      l.emailDoPrograma,
    );
  }
  for (const l of emMassa) juntar(l, "Recebeu o convite");
  for (const l of abriram) juntar(l, "Abriu a app");
  return [...porChave.values()];
}
