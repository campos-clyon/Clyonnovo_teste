import { getPool } from "@/lib/db";
import { garantirColunaDaTrocaDeSenha } from "@/lib/conta-do-painel";
import { hashDoCodigo, indiceDoCodigo } from "@/lib/codigo-de-entrada";

/**
 * O CÓDIGO PARA ENTRAR, NA BASE — d75, 20-11-2026.
 *
 * Três colunas novas em `colaboradores`, fora do schema do drizzle (como a
 * `senhaAlteradaEm`: uma coluna que ainda não existisse partia o select() do
 * login por utilizador):
 *
 *   · `codigoIndice` — o HMAC do código, com índice ÚNICO: dois códigos
 *     iguais não cabem na tabela, nem que duas gravações se cruzem;
 *   · `codigoHash`   — o bcrypt;
 *   · `codigoMudadoEm` — quando foi posto ou trocado.
 *
 * E uma tabela com o registo de cada criação, troca ou anulação: quem, para
 * quem, quando. O código nunca lá está — nem o índice, nem o hash.
 */

/** As contas que entram no backoffice: administradores e assistentes. */
const CONTAS_DO_PAINEL = "(isAdmin = 1 OR funcao IN ('admin','assistente'))";

/**
 * Activa, pelo critério do login: o administrador só fica de fora com um 0
 * escrito; o assistente só entra com um 1.
 */
const CONTA_ACTIVA = `((isAdmin = 1 OR funcao = 'admin') AND (active IS NULL OR active <> 0)
                       OR (funcao = 'assistente' AND isAdmin = 0 AND active = 1))`;

let esquema: Promise<boolean> | null = null;

/** Garante as colunas e a tabela do registo — uma vez por instância. */
export function garantirEsquemaDoCodigo(): Promise<boolean> {
  if (!esquema) {
    esquema = (async () => {
      const pool = await getPool();
      if (!pool) return false;
      const [cols] = (await pool.execute(
        `SELECT column_name AS c FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'colaboradores'
            AND column_name IN ('codigoIndice','codigoHash','codigoMudadoEm')`,
      )) as [Array<{ c?: string; C?: string; COLUMN_NAME?: string }>, unknown];
      const tem = new Set(cols.map((l) => String(l.c ?? l.C ?? l.COLUMN_NAME ?? "")));
      if (!tem.has("codigoIndice")) {
        await pool.execute("ALTER TABLE colaboradores ADD COLUMN codigoIndice CHAR(64) NULL DEFAULT NULL");
      }
      if (!tem.has("codigoHash")) {
        await pool.execute("ALTER TABLE colaboradores ADD COLUMN codigoHash VARCHAR(100) NULL DEFAULT NULL");
      }
      if (!tem.has("codigoMudadoEm")) {
        await pool.execute("ALTER TABLE colaboradores ADD COLUMN codigoMudadoEm DATETIME NULL DEFAULT NULL");
      }
      try {
        await pool.execute("ALTER TABLE colaboradores ADD UNIQUE KEY uq_codigo_indice (codigoIndice)");
      } catch {
        /* já existe */
      }
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS codigosDeEntradaRegisto (
          id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          contaId   INT NOT NULL,
          contaNome VARCHAR(120) NOT NULL,
          porId     INT NULL,
          porNome   VARCHAR(120) NULL,
          accao     VARCHAR(20) NOT NULL,
          em        DATETIME NOT NULL,
          KEY idx_em (em)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      return true;
    })().catch((e) => {
      esquema = null;
      console.error("[codigo-de-entrada] esquema:", String(e).slice(0, 160));
      return false;
    });
  }
  return esquema;
}

export type ContaPeloCodigo = {
  id: number;
  nome: string;
  isAdmin: number | null;
  funcao: string | null;
  active: number | null;
  codigoHash: string | null;
};

/** A conta cujo índice é este — undefined se nenhuma. Lança se a base falhar. */
export async function contaPeloIndice(indice: string): Promise<ContaPeloCodigo | undefined> {
  if (!(await garantirEsquemaDoCodigo())) throw new Error("Esquema do código indisponível");
  const pool = await getPool();
  if (!pool) throw new Error("Base de dados indisponível");
  const [linhas] = (await pool.execute(
    `SELECT id, nome, isAdmin, funcao, active, codigoHash FROM colaboradores
      WHERE codigoIndice = ? AND ${CONTAS_DO_PAINEL} LIMIT 1`,
    [indice],
  )) as [Array<Record<string, unknown>>, unknown];
  const l = linhas[0];
  if (!l) return undefined;
  return {
    id: Number(l.id),
    nome: String(l.nome ?? ""),
    isAdmin: l.isAdmin == null ? null : Number(l.isAdmin),
    funcao: typeof l.funcao === "string" ? l.funcao : null,
    active: l.active == null ? null : Number(l.active),
    codigoHash: typeof l.codigoHash === "string" ? l.codigoHash : null,
  };
}

/**
 * Esta conta já tem código? Então a palavra-passe deixou de servir para
 * entrar. Lança se a base falhar — o login por utilizador fecha-se nesse caso.
 */
export async function contaTemCodigo(id: number): Promise<boolean> {
  if (!(await garantirEsquemaDoCodigo())) throw new Error("Esquema do código indisponível");
  const pool = await getPool();
  if (!pool) throw new Error("Base de dados indisponível");
  const [linhas] = (await pool.execute(
    "SELECT codigoHash IS NOT NULL AS tem FROM colaboradores WHERE id = ? LIMIT 1",
    [id],
  )) as [Array<{ tem: number }>, unknown];
  return Number(linhas[0]?.tem ?? 0) === 1;
}

/**
 * Ainda há alguma conta activa sem código? Enquanto houver, o ecrã de entrada
 * mostra «Ainda não tem código? Entrar com utilizador». Quando todas tiverem,
 * a ligação desaparece sozinha.
 */
export async function haContasActivasSemCodigo(): Promise<boolean> {
  if (!(await garantirEsquemaDoCodigo())) throw new Error("Esquema do código indisponível");
  const pool = await getPool();
  if (!pool) throw new Error("Base de dados indisponível");
  const [linhas] = (await pool.execute(
    `SELECT COUNT(*) AS n FROM colaboradores WHERE ${CONTA_ACTIVA} AND codigoHash IS NULL`,
  )) as [Array<{ n: number }>, unknown];
  return Number(linhas[0]?.n ?? 0) > 0;
}

export type ContaComCodigo = {
  id: number;
  nome: string;
  papel: "admin" | "assistente";
  activo: boolean;
  temCodigo: boolean;
  codigoMudadoEm: string | null;
};

/** As contas do painel, para o cartão «Códigos para entrar». Nunca o código. */
export async function contasParaOsCodigos(): Promise<ContaComCodigo[]> {
  if (!(await garantirEsquemaDoCodigo())) throw new Error("Esquema do código indisponível");
  const pool = await getPool();
  if (!pool) throw new Error("Base de dados indisponível");
  const [linhas] = (await pool.execute(
    `SELECT id, nome, isAdmin, funcao, ${CONTA_ACTIVA} AS activo,
            codigoHash IS NOT NULL AS temCodigo, codigoMudadoEm
       FROM colaboradores WHERE ${CONTAS_DO_PAINEL}
      ORDER BY (isAdmin = 1 OR funcao = 'admin') DESC, activo DESC, nome ASC`,
  )) as [Array<Record<string, unknown>>, unknown];
  return linhas.map((l) => {
    const em = l.codigoMudadoEm as Date | string | null;
    return {
      id: Number(l.id),
      nome: String(l.nome ?? ""),
      papel: Number(l.isAdmin) === 1 || l.funcao === "admin" ? "admin" : "assistente",
      activo: Number(l.activo) === 1,
      temCodigo: Number(l.temCodigo) === 1,
      codigoMudadoEm: em ? (em instanceof Date ? em.toISOString() : String(em)) : null,
    };
  });
}

export type RegistoDoCodigo = {
  contaNome: string;
  porNome: string | null;
  accao: string;
  em: string;
};

export async function registoDosCodigos(limite = 30): Promise<RegistoDoCodigo[]> {
  if (!(await garantirEsquemaDoCodigo())) return [];
  const pool = await getPool();
  if (!pool) return [];
  const n = Math.max(1, Math.min(100, Math.floor(limite)));
  const [linhas] = (await pool.execute(
    `SELECT contaNome, porNome, accao, em FROM codigosDeEntradaRegisto ORDER BY em DESC, id DESC LIMIT ${n}`,
  )) as [Array<Record<string, unknown>>, unknown];
  return linhas.map((l) => {
    const em = l.em as Date | string;
    return {
      contaNome: String(l.contaNome ?? ""),
      porNome: l.porNome == null ? null : String(l.porNome),
      accao: String(l.accao ?? ""),
      em: em instanceof Date ? em.toISOString() : String(em),
    };
  });
}

export type ResultadoDoCodigo =
  | { ok: true; nome: string; accao: "criado" | "trocado" }
  | { ok: false; estado: number; erro: string };

/**
 * Põe (ou troca) o código de uma conta do painel.
 *
 * O código já vem validado pela regra (`erroDoCodigo`). Aqui:
 *   1. confere-se contra os existentes ANTES de gravar — o índice de outra
 *      conta igual a este é um código repetido;
 *   2. grava-se o índice, o hash e a hora, e a MESMA hora em
 *      `senhaAlteradaEm` — é isso que fecha as sessões abertas dessa pessoa
 *      (ver `tokenAnteriorATrocaDeSenha`);
 *   3. regista-se quem, para quem e quando — sem o código.
 *
 * Sem a coluna `senhaAlteradaEm` não se grava: trocar o código TEM de fechar
 * as sessões, e sem ela não se fecham.
 */
export async function definirCodigoDaConta(args: {
  contaId: number;
  codigo: string;
  segredo: string;
  por: { id: number; nome: string } | null;
  agora?: Date;
}): Promise<ResultadoDoCodigo> {
  if (!(await garantirEsquemaDoCodigo())) {
    return { ok: false, estado: 503, erro: "A base não está pronta para os códigos. Tente daqui a instantes." };
  }
  if (!(await garantirColunaDaTrocaDeSenha())) {
    return { ok: false, estado: 503, erro: "Não foi possível garantir o fecho das sessões. Tente daqui a instantes." };
  }
  const pool = await getPool();
  if (!pool) return { ok: false, estado: 503, erro: "Base de dados indisponível." };

  const indice = indiceDoCodigo(args.codigo, args.segredo);

  const [conta] = (await pool.execute(
    `SELECT id, nome, codigoHash IS NOT NULL AS temCodigo FROM colaboradores
      WHERE id = ? AND ${CONTAS_DO_PAINEL} LIMIT 1`,
    [args.contaId],
  )) as [Array<Record<string, unknown>>, unknown];
  const c = conta[0];
  if (!c) return { ok: false, estado: 404, erro: "Conta não encontrada." };

  const [iguais] = (await pool.execute(
    "SELECT id FROM colaboradores WHERE codigoIndice = ? AND id <> ? LIMIT 1",
    [indice, args.contaId],
  )) as [Array<{ id: number }>, unknown];
  if (iguais.length > 0) return { ok: false, estado: 409, erro: CODIGO_REPETIDO };

  const hash = await hashDoCodigo(args.codigo);
  const agora = args.agora ?? new Date();
  try {
    const [r] = (await pool.execute(
      `UPDATE colaboradores SET codigoIndice = ?, codigoHash = ?, codigoMudadoEm = ?, senhaAlteradaEm = ?, updatedAt = NOW()
        WHERE id = ? AND ${CONTAS_DO_PAINEL}`,
      [indice, hash, agora, agora, args.contaId],
    )) as [{ affectedRows?: number }, unknown];
    if (Number(r.affectedRows ?? 0) === 0) return { ok: false, estado: 404, erro: "Conta não encontrada." };
  } catch (e) {
    // O índice único a fazer o trabalho dele, se duas gravações se cruzarem.
    if ((e as { code?: string })?.code === "ER_DUP_ENTRY") {
      return { ok: false, estado: 409, erro: CODIGO_REPETIDO };
    }
    throw e;
  }

  const accao = Number(c.temCodigo) === 1 ? "trocado" : "criado";
  await registarNoRegisto(args.contaId, String(c.nome ?? ""), args.por, accao, agora);
  return { ok: true, nome: String(c.nome ?? ""), accao };
}

export const CODIGO_REPETIDO = "Esse código já está em uso. Escolha ou gere outro.";

/**
 * Tira o código a uma conta — ao desactivar uma assistente. Reactivá-la não o
 * devolve: o administrador dá-lhe um novo.
 */
export async function anularCodigoDaConta(
  contaId: number,
  por: { id: number; nome: string } | null,
  agora: Date = new Date(),
): Promise<void> {
  if (!(await garantirEsquemaDoCodigo())) throw new Error("Esquema do código indisponível");
  const pool = await getPool();
  if (!pool) throw new Error("Base de dados indisponível");
  const [conta] = (await pool.execute(
    "SELECT nome, codigoHash IS NOT NULL AS temCodigo FROM colaboradores WHERE id = ? LIMIT 1",
    [contaId],
  )) as [Array<Record<string, unknown>>, unknown];
  const c = conta[0];
  if (!c || Number(c.temCodigo) !== 1) return;
  await pool.execute(
    "UPDATE colaboradores SET codigoIndice = NULL, codigoHash = NULL, codigoMudadoEm = ? WHERE id = ?",
    [agora, contaId],
  );
  await registarNoRegisto(contaId, String(c.nome ?? ""), por, "anulado", agora);
}

async function registarNoRegisto(
  contaId: number,
  contaNome: string,
  por: { id: number; nome: string } | null,
  accao: string,
  em: Date,
): Promise<void> {
  try {
    const pool = await getPool();
    if (!pool) return;
    await pool.execute(
      `INSERT INTO codigosDeEntradaRegisto (contaId, contaNome, porId, porNome, accao, em)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [contaId, contaNome.slice(0, 120), por?.id ?? null, por?.nome?.slice(0, 120) ?? null, accao, em],
    );
  } catch (e) {
    console.error("[codigo-de-entrada] registo:", e instanceof Error ? e.message : e);
  }
}
