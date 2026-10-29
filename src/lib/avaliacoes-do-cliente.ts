import { getPool } from "./db";
import { diaCurtoEmLisboa } from "./pedido-para-a-app";
import { nomeDoServico } from "./service-categories";

/**
 * AS AVALIAÇÕES QUE O CLIENTE RECEBEU — 29-10-2026 (ordem do CEO e do dono).
 *
 * Regra: cada um vê só as avaliações que RECEBEU, nunca as que deu. O cliente
 * avalia o parceiro no fim do trabalho (`negociacoes.estrelas`, a do perfil
 * dele); depois de feita não se muda e fica guardada, mas não aparece ao
 * cliente. O parceiro avalia o cliente aqui, numa tabela própria — uma por
 * negociação —, e só o cliente as lê, pela sua sessão (`GET
 * /api/cliente/avaliacoes`).
 *
 * Quem escreve: o profissional, no fim do trabalho, na app Pro e no painel
 * (ver «O PROFISSIONAL AVALIA O CLIENTE», mais abaixo).
 *
 * O QUE SAI: as estrelas, o comentário, o dia (em Lisboa), o serviço e o
 * primeiro nome do parceiro. Nunca o telefone nem o apelido do parceiro.
 */

export const TABELA_DAS_AVALIACOES_AO_CLIENTE = "avaliacoesAoCliente";
export const MAXIMO_NA_LISTA = 100;

let pronta = false;

export async function garantirTabelaDasAvaliacoesAoCliente() {
  const pool = await getPool();
  if (!pool) throw new Error("[avaliacoes-do-cliente] base de dados indisponível");
  if (pronta) return pool;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS avaliacoesAoCliente (
      id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      pedidoId      INT          NOT NULL,
      negociacaoId  INT          NOT NULL,
      providerId    INT          NOT NULL,
      clienteEmail  VARCHAR(190) NOT NULL,
      estrelas      TINYINT      NOT NULL,
      comentario    VARCHAR(500) NULL DEFAULT NULL,
      criadaEm      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_negociacao (negociacaoId),
      KEY idx_cliente (clienteEmail)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  pronta = true;
  return pool;
}

export type AvaliacaoRecebida = {
  estrelas: number;
  comentario: string | null;
  quandoTexto: string | null;
  servico: string | null;
  parceiro: string | null;
};

export type RespostaDasAvaliacoes = {
  ok: true;
  avaliacoes: AvaliacaoRecebida[];
  total: number;
  /** «4,8» — ou null sem avaliações. */
  mediaTexto: string | null;
};

function primeiraPalavra(nome: unknown): string | null {
  if (typeof nome !== "string") return null;
  const p = nome.trim().split(/\s+/)[0];
  return p ? p : null;
}

/** Uma linha da base → o que a app mostra. Puro (os testes chamam-no). */
export function avaliacaoParaAApp(l: Record<string, unknown>): AvaliacaoRecebida | null {
  const estrelas = Math.round(Number(l.estrelas));
  if (!Number.isFinite(estrelas) || estrelas < 1 || estrelas > 5) return null;
  const comentario = typeof l.comentario === "string" && l.comentario.trim() ? l.comentario.trim().slice(0, 500) : null;
  const servico = typeof l.serviceType === "string" && l.serviceType ? nomeDoServico(l.serviceType) : null;
  return {
    estrelas,
    comentario,
    quandoTexto: diaCurtoEmLisboa((l.criadaEm as string | Date | null) ?? null),
    servico: servico || null,
    parceiro: primeiraPalavra(l.parceiroNome),
  };
}

export function respostaDasAvaliacoes(linhas: Array<Record<string, unknown>>): RespostaDasAvaliacoes {
  const avaliacoes = linhas.map(avaliacaoParaAApp).filter((a): a is AvaliacaoRecebida => a !== null);
  const media = avaliacoes.length > 0 ? avaliacoes.reduce((s, a) => s + a.estrelas, 0) / avaliacoes.length : null;
  return {
    ok: true,
    avaliacoes,
    total: avaliacoes.length,
    mediaTexto: media === null ? null : media.toFixed(1).replace(".", ","),
  };
}

/** O SQL: só as do email da sessão, as mais recentes primeiro. */
export const SQL_DAS_AVALIACOES_AO_CLIENTE = `SELECT a.estrelas, a.comentario, a.criadaEm, o.serviceType, p.name AS parceiroNome
       FROM avaliacoesAoCliente a
       LEFT JOIN simulatorOrders o ON o.id = a.pedidoId
       LEFT JOIN providers p ON p.id = a.providerId
      WHERE a.clienteEmail = ?
      ORDER BY a.criadaEm DESC
      LIMIT ${MAXIMO_NA_LISTA}`;

export async function avaliacoesRecebidasPeloCliente(email: string): Promise<RespostaDasAvaliacoes> {
  const pool = await garantirTabelaDasAvaliacoesAoCliente();
  const [linhas] = (await pool.execute(SQL_DAS_AVALIACOES_AO_CLIENTE, [email.trim().toLowerCase()])) as [Array<Record<string, unknown>>, unknown];
  return respostaDasAvaliacoes(linhas);
}

/* ─── O PROFISSIONAL AVALIA O CLIENTE (dono, 29-10-2026) ──────────────────── */

/**
 * Depois do trabalho feito (ele marcou-o como feito) ou confirmado, o
 * profissional dá ao cliente de 1 a 5 estrelas e, se quiser, um comentário —
 * na app Pro e no painel, pela mesma rota
 * (`/api/profissionais/trabalho/avaliar-cliente`). Uma por trabalho, e não se
 * altera depois de feita (a chave única `uniq_negociacao` e o INSERT IGNORE).
 * O profissional não vê as que deu: a rota só lhe diz se já avaliou.
 */
export const MAXIMO_DO_COMENTARIO = 500;

export type TrabalhoParaAvaliarOCliente = {
  providerId: number | string;
  estado: string;
  execucaoEnviadaEm: Date | string | null;
  confirmadoEm: Date | string | null;
  pagoEm: Date | string | null;
  contactEmail: string | null;
};

/** Pode avaliar? Só o profissional do trabalho, com o trabalho feito ou confirmado, e com o email do cliente. */
export function podeAvaliarOCliente(n: TrabalhoParaAvaliarOCliente | null, providerId: number): boolean {
  if (!n || Number(n.providerId) !== providerId) return false;
  if (n.estado === "desistida" || n.estado === "morta" || n.estado === "cancelada") return false;
  if (!(n.execucaoEnviadaEm || n.confirmadoEm || n.pagoEm)) return false;
  return typeof n.contactEmail === "string" && n.contactEmail.trim().includes("@");
}

export type AvaliacaoDoProfissional = { estrelas: number; comentario: string | null };

/** O corpo do pedido → as estrelas (1 a 5, inteiras) e o comentário (até 500), ou o erro em palavras. */
export function lerAvaliacaoDoProfissional(corpo: unknown): AvaliacaoDoProfissional | { erro: string } {
  const o = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  const estrelas = Number(o.estrelas);
  if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5) return { erro: "Escolha de 1 a 5 estrelas." };
  const texto = typeof o.comentario === "string" ? o.comentario.trim() : "";
  if (texto.length > MAXIMO_DO_COMENTARIO) return { erro: `O comentário tem no máximo ${MAXIMO_DO_COMENTARIO} caracteres.` };
  return { estrelas, comentario: texto || null };
}

export async function jaAvaliouOCliente(negociacaoId: number): Promise<boolean> {
  const pool = await garantirTabelaDasAvaliacoesAoCliente();
  const [linhas] = (await pool.execute("SELECT id FROM avaliacoesAoCliente WHERE negociacaoId = ? LIMIT 1", [negociacaoId])) as [
    Array<{ id: number }>,
    unknown,
  ];
  return linhas.length > 0;
}

/** Grava a avaliação. Devolve false se este trabalho já tinha uma (não se altera). */
export async function gravarAvaliacaoAoCliente(a: {
  pedidoId: number;
  negociacaoId: number;
  providerId: number;
  clienteEmail: string;
  estrelas: number;
  comentario: string | null;
}): Promise<boolean> {
  const pool = await garantirTabelaDasAvaliacoesAoCliente();
  const [r] = (await pool.execute(
    `INSERT IGNORE INTO avaliacoesAoCliente (pedidoId, negociacaoId, providerId, clienteEmail, estrelas, comentario)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [a.pedidoId, a.negociacaoId, a.providerId, a.clienteEmail.trim().toLowerCase(), a.estrelas, a.comentario],
  )) as [{ affectedRows?: number }, unknown];
  return Number(r.affectedRows ?? 0) > 0;
}
