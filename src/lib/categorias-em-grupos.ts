import { normalizarCategorias, servicosDasCategorias } from "./service-categories";

/**
 * AS CATEGORIAS DOS PROFISSIONAIS PASSAM A GRUPOS — 29-10-2026 (decisão do dono).
 *
 * Cada profissional tinha gravados os serviços que marcou um a um
 * («recolha_monos», «esvaziamento_casa»…). Passa a ter os grupos desses
 * serviços: quem tinha qualquer recolha fica com «Recolhas», e assim por
 * diante (`normalizarCategorias`). A montagem, a jardinagem e o «outro» não
 * dão grupo e ficam como estavam.
 *
 * A CÓPIA VEM ANTES. Antes de mudar uma linha, o que lá estava fica em
 * `providers_categorias_antes_dos_grupos` (uma linha por profissional, a
 * primeira cópia nunca é reescrita: INSERT IGNORE). Para desfazer basta
 * repor `categorias` a partir dela.
 *
 * Corre sozinha ao arrancar (`ensureProvidersSchema`) e é idempotente: um
 * profissional já em grupos não muda, e duas instâncias a correr ao mesmo
 * tempo escrevem o mesmo.
 *
 * QUEM PASSA A RECEBER MAIS. Quem tinha só a recolha de móveis passa a
 * receber também monos e entulho. A cópia guarda isso (`ganhaServicos`) e o
 * backoffice mostra quantos são, para o dono saber a quem avisar.
 */

export type LinhaDaMigracao = {
  providerId: number;
  antes: string[];
  depois: string[];
  /** Passa a receber serviços que antes não recebia. */
  ganhaServicos: boolean;
  /** Os serviços que ganha (ids), para a cópia. */
  servicosNovos: string[];
};

export const TABELA_DA_COPIA = "providers_categorias_antes_dos_grupos";

function listaDeJson(v: unknown): string[] {
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const l = JSON.parse(v);
    return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** O que muda, profissional a profissional. Só entram os que mudam. */
export function planoDaMigracao(linhas: Array<{ id: number; categorias: unknown }>): LinhaDaMigracao[] {
  const plano: LinhaDaMigracao[] = [];
  for (const l of linhas) {
    const antes = listaDeJson(l.categorias);
    if (antes.length === 0) continue;
    const depois = normalizarCategorias(antes);
    if (JSON.stringify(antes) === JSON.stringify(depois)) continue;
    // Antes, recebia exactamente os serviços gravados; depois, os dos grupos.
    const servicosNovos = servicosDasCategorias(depois).filter((s) => !antes.includes(s));
    plano.push({ providerId: Number(l.id), antes, depois, ganhaServicos: servicosNovos.length > 0, servicosNovos });
  }
  return plano;
}

type Ligacao = {
  execute: (sql: string, valores?: unknown[]) => Promise<unknown>;
};

export async function migrarCategoriasParaGrupos(conn: Ligacao): Promise<{ migrados: number; ganham: number }> {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS ${TABELA_DA_COPIA} (
      providerId     INT UNSIGNED NOT NULL PRIMARY KEY,
      categorias     TEXT NULL,
      depois         TEXT NULL,
      ganhaServicos  TINYINT(1) NOT NULL DEFAULT 0,
      servicosNovos  TEXT NULL,
      copiadoEm      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [linhas] = (await conn.execute(
    "SELECT id, categorias FROM providers WHERE categorias IS NOT NULL AND categorias <> ''",
  )) as [Array<{ id: number; categorias: unknown }>, unknown];
  const plano = planoDaMigracao(linhas);
  for (const m of plano) {
    // A cópia primeiro; a primeira que entrou fica (INSERT IGNORE).
    await conn.execute(
      `INSERT IGNORE INTO ${TABELA_DA_COPIA} (providerId, categorias, depois, ganhaServicos, servicosNovos)
       VALUES (?, ?, ?, ?, ?)`,
      [m.providerId, JSON.stringify(m.antes), JSON.stringify(m.depois), m.ganhaServicos ? 1 : 0, JSON.stringify(m.servicosNovos)],
    );
    await conn.execute("UPDATE providers SET categorias = ? WHERE id = ?", [JSON.stringify(m.depois), m.providerId]);
  }
  const ganham = plano.filter((m) => m.ganhaServicos).length;
  if (plano.length > 0) {
    console.log(`[categorias→grupos] ${plano.length} profissionais passaram a grupos; ${ganham} passam a receber mais serviços`);
  }
  return { migrados: plano.length, ganham };
}

/** Para o backoffice: quantos passaram a grupos e quantos ganharam serviços (a partir da cópia). */
export async function resumoDaMigracao(
  conn: Ligacao,
): Promise<{ migrados: number; ganham: number; ganhamAprovados: number } | null> {
  try {
    const [r] = (await conn.execute(
      `SELECT COUNT(*) AS migrados, COALESCE(SUM(c.ganhaServicos), 0) AS ganham,
              COALESCE(SUM(c.ganhaServicos = 1 AND p.estado = 'aprovado' AND p.isActive = 1), 0) AS ganhamAprovados
         FROM ${TABELA_DA_COPIA} c LEFT JOIN providers p ON p.id = c.providerId`,
    )) as [Array<Record<string, number | string>>, unknown];
    return {
      migrados: Number(r[0]?.migrados ?? 0),
      ganham: Number(r[0]?.ganham ?? 0),
      ganhamAprovados: Number(r[0]?.ganhamAprovados ?? 0),
    };
  } catch {
    return null;
  }
}
