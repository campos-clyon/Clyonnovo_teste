import * as bcrypt from "bcryptjs";

import { ensureColaboradoresSchema, ensureNegociacoesTable, withConnection } from "@/lib/db";
import {
  normalizarSeccoes,
  SECCOES_DO_ASSISTENTE,
  type PapelDoPainel,
  type SeccaoDoAssistente,
} from "@/lib/papel-do-painel";
import { TAXA_TOTAL } from "@/lib/taxas-plataforma";

/**
 * As contas de assistente, na tabela `colaboradores`.
 *
 * A tabela já tinha `funcao = 'assistente'` de uma vida anterior — assistentes
 * que aceitavam pedidos do simulador e viam só os seus. Essa vida acabou; a
 * coluna ficou. Reaproveita-se: um assistente é um colaborador com
 * `funcao = 'assistente'`, `isAdmin = 0` e `active = 1`. Desactivar é pôr
 * `active = 0` — não se apagam registos de pessoas que trabalharam connosco,
 * e um `active = 0` fecha a porta com a mesma eficácia.
 *
 * O login recusa quem não estiver activo, e o helper das rotas volta a
 * perguntar à base em cada chamada: um token de 8 horas não sobrevive a um
 * "desactivar" nem um minuto.
 *
 * O QUE CADA UM VÊ vive em `seccoesJson` — a lista das secções que o
 * administrador lhe deu. NULL quer dizer todas.
 *
 * O QUE CADA UM GANHA: uma percentagem da comissão da CLYON em cada trabalho
 * concluído de que foi responsável. A comissão da CLYON é a taxa da
 * plataforma (6 % + 5 % = 11 %, ver `taxas-plataforma.ts`), guardada aqui como
 * número editável porque o administrador vai querer mexer-lhe sem tocar no
 * código; a parte do assistente (40 % por omissão) está na coluna
 * `commissionPercent`, que a tabela já tinha.
 */

export type EstatisticasDeTrabalho = {
  /** Trabalhos com estado `concluido`. */
  concluidos: number;
  /** Tudo o que ainda mexe: pendente, atribuído, em análise, aprovado, confirmado… */
  emCurso: number;
  /** Cancelados pelo cliente ou rejeitados pela CLYON. */
  cancelados: number;
  /** Tirados da mesa sem conclusão. */
  arquivados: number;
  /** Soma dos valores dos trabalhos concluídos, em euros. */
  valorConcluido: number;
  /** O que a CLYON ficou nesses trabalhos, à percentagem actual. */
  comissaoClyon: number;
  /** O que cabe ao assistente, à percentagem dele. */
  comissaoAssistente: number;
};

export type Assistente = {
  id: number;
  nome: string;
  activo: boolean;
  seccoes: SeccaoDoAssistente[];
  /** Percentagem da comissão da CLYON que lhe cabe (0–100). */
  comissaoPercent: number;
  estatisticas: EstatisticasDeTrabalho;
  createdAt: string | null;
  updatedAt: string | null;
};

/** 40 % da comissão, por decisão de 07-09-2026. Muda-se no painel. */
export const COMISSAO_ASSISTENTE_POR_OMISSAO = 40;

/** 11 % — a taxa total da plataforma, como número redondo. */
export const COMISSAO_CLYON_POR_OMISSAO = Math.round(TAXA_TOTAL * 100);

const CHAVE_COMISSAO_CLYON = "comissao_clyon_percent";

type LinhaDeAssistente = {
  id: number;
  nome: string;
  funcao: string;
  isAdmin: number;
  active: number | null;
  seccoesJson: string | null;
  commissionPercent: string | number | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

// ─── Esquema ─────────────────────────────────────────────────────────────────

let esquemaGarantido = false;

/**
 * A coluna das secções e a tabela de configuração do painel.
 *
 * `ADD COLUMN` dentro de try/catch, como o resto deste projecto faz: o MySQL
 * do Railway não tem `IF NOT EXISTS` para colunas em todas as versões, e
 * falhar porque a coluna já lá está não é falhar.
 */
export async function ensureAssistentesSchema(): Promise<void> {
  if (esquemaGarantido) return;
  await ensureColaboradoresSchema();
  await withConnection(async (conn) => {
    try {
      await conn.execute(`ALTER TABLE colaboradores ADD COLUMN seccoesJson TEXT NULL DEFAULT NULL`);
    } catch {
      /* já existe */
    }
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS painelConfig (
        chave     VARCHAR(80) NOT NULL PRIMARY KEY,
        valor     VARCHAR(255) NOT NULL,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  });
  esquemaGarantido = true;
}

// ─── Validação ───────────────────────────────────────────────────────────────

/**
 * Nome de utilizador: maiúsculas, sem espaços, 3 a 40 caracteres.
 *
 * O login já normaliza para maiúsculas e a coluna é única — dois nomes que
 * diferem só na caixa seriam um só aos olhos da entrada. Sem espaços porque é
 * um nome que se dita ao telefone e se escreve num campo pequeno.
 */
export function normalizarNomeDeAssistente(bruto: unknown): string {
  return typeof bruto === "string" ? bruto.trim().toUpperCase() : "";
}

export function erroDoNomeDeAssistente(nome: string): string | null {
  if (!/^[A-Z0-9][A-Z0-9._-]{2,39}$/.test(nome)) {
    return "Nome: 3 a 40 caracteres, letras, números, ponto, hífen ou sublinhado, sem espaços.";
  }
  return null;
}

/** As mesmas regras da palavra-passe do administrador. */
export function erroDaPalavraPasseDeAssistente(senha: unknown): string | null {
  if (typeof senha !== "string" || senha.length < 8) {
    return "A palavra-passe deve ter pelo menos 8 caracteres.";
  }
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    return "A palavra-passe deve incluir pelo menos uma letra e um número.";
  }
  return null;
}

/** Uma percentagem entre 0 e 100, com duas casas; null se não for número. */
export function percentagemValida(bruto: unknown): number | null {
  const n =
    typeof bruto === "number"
      ? bruto
      : typeof bruto === "string"
        ? Number(bruto.trim().replace(",", "."))
        : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

export async function hashDaPalavraPasseDeAssistente(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12);
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

function paraIso(v: Date | string | null): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function seccoesDaLinha(json: string | null): SeccaoDoAssistente[] {
  if (!json) return [...SECCOES_DO_ASSISTENTE];
  try {
    return normalizarSeccoes(JSON.parse(json));
  } catch {
    return [...SECCOES_DO_ASSISTENTE];
  }
}

function comissaoDaLinha(v: string | number | null): number {
  const n = Number(v);
  return Number.isFinite(n) && v !== null ? n : COMISSAO_ASSISTENTE_POR_OMISSAO;
}

const SELECT_ASSISTENTE = `SELECT id, nome, funcao, isAdmin, active, seccoesJson, commissionPercent, createdAt, updatedAt
                             FROM colaboradores`;

/**
 * Um assistente pela chave, com as secções e a comissão — para o helper das
 * rotas decidir. Devolve undefined para quem não for assistente.
 */
export async function assistentePorId(id: number): Promise<{
  id: number;
  nome: string;
  activo: boolean;
  seccoes: SeccaoDoAssistente[];
  comissaoPercent: number;
} | undefined> {
  await ensureAssistentesSchema();
  return withConnection(async (conn) => {
    const [linhas] = (await conn.execute(
      `${SELECT_ASSISTENTE} WHERE id = ? AND funcao = 'assistente' AND isAdmin = 0 LIMIT 1`,
      [id],
    )) as [LinhaDeAssistente[], unknown];
    const l = linhas[0];
    if (!l) return undefined;
    return {
      id: l.id,
      nome: l.nome,
      activo: Number(l.active ?? 0) === 1,
      seccoes: seccoesDaLinha(l.seccoesJson),
      comissaoPercent: comissaoDaLinha(l.commissionPercent),
    };
  });
}

/** A percentagem da CLYON usada nas contas dos assistentes. */
export async function comissaoClyonPercent(): Promise<number> {
  await ensureAssistentesSchema();
  return withConnection(async (conn) => {
    const [linhas] = (await conn.execute(
      "SELECT valor FROM painelConfig WHERE chave = ? LIMIT 1",
      [CHAVE_COMISSAO_CLYON],
    )) as [Array<{ valor: string }>, unknown];
    const n = percentagemValida(linhas[0]?.valor);
    return n ?? COMISSAO_CLYON_POR_OMISSAO;
  });
}

export async function definirComissaoClyonPercent(percent: number): Promise<void> {
  await ensureAssistentesSchema();
  await withConnection(async (conn) => {
    await conn.execute(
      `INSERT INTO painelConfig (chave, valor) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [CHAVE_COMISSAO_CLYON, String(percent)],
    );
  });
}

type LinhaDeContagem = {
  assignedToId: number;
  status: string | null;
  n: number | string;
  valor: string | number | null;
};

/**
 * Os trabalhos de cada assistente, por estado, e o valor dos concluídos.
 *
 * ATRIBUIÇÃO: um trabalho é de quem está em `assignedToId` — quem o aceitou
 * ou quem foi o primeiro a agir nele. Não se conta por "quem carregou em
 * quê" no histórico: um trabalho tem um responsável, e é a esse que a
 * comissão pertence.
 *
 * VALOR de um concluído: o acordado com o profissional quando o trabalho
 * passou pela plataforma (`negociacoes.valorAcordado`, do trabalho
 * confirmado); senão o preço final que a CLYON fechou; senão a estimativa.
 */
export async function estatisticasDosAssistentes(
  ids: number[],
  comissaoPorAssistente: Map<number, number>,
  clyonPercent: number,
): Promise<Map<number, EstatisticasDeTrabalho>> {
  const vazio = (): EstatisticasDeTrabalho => ({
    concluidos: 0,
    emCurso: 0,
    cancelados: 0,
    arquivados: 0,
    valorConcluido: 0,
    comissaoClyon: 0,
    comissaoAssistente: 0,
  });
  const resultado = new Map<number, EstatisticasDeTrabalho>(ids.map((id) => [id, vazio()]));
  if (ids.length === 0) return resultado;

  await ensureNegociacoesTable();
  const marcadores = ids.map(() => "?").join(",");
  const linhas = await withConnection(async (conn) => {
    const [r] = (await conn.execute(
      `SELECT o.assignedToId, o.status, COUNT(*) AS n,
              SUM(CASE WHEN o.status = 'concluido'
                       THEN COALESCE(n.valorAcordado, o.precoFinal, o.estimateTotal, 0)
                       ELSE 0 END) AS valor
         FROM simulatorOrders o
         LEFT JOIN (
           SELECT pedidoId, MAX(valorAcordado) AS valorAcordado
             FROM negociacoes
            WHERE confirmadoEm IS NOT NULL
            GROUP BY pedidoId
         ) n ON n.pedidoId = o.id
        WHERE o.assignedToId IN (${marcadores})
        GROUP BY o.assignedToId, o.status`,
      ids,
    )) as [LinhaDeContagem[], unknown];
    return r;
  });

  for (const l of linhas) {
    const e = resultado.get(Number(l.assignedToId));
    if (!e) continue;
    const n = Number(l.n) || 0;
    const status = l.status ?? "";
    if (status === "concluido") {
      e.concluidos += n;
      e.valorConcluido += Number(l.valor) || 0;
    } else if (status === "cancelado" || status === "rejeitado") {
      e.cancelados += n;
    } else if (status === "arquivado") {
      e.arquivados += n;
    } else {
      e.emCurso += n;
    }
  }

  const aosCentimos = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
  for (const [id, e] of resultado) {
    e.valorConcluido = aosCentimos(e.valorConcluido);
    e.comissaoClyon = aosCentimos((e.valorConcluido * clyonPercent) / 100);
    const minha = comissaoPorAssistente.get(id) ?? COMISSAO_ASSISTENTE_POR_OMISSAO;
    e.comissaoAssistente = aosCentimos((e.comissaoClyon * minha) / 100);
  }
  return resultado;
}

export async function listarAssistentes(): Promise<{ assistentes: Assistente[]; comissaoClyonPercent: number }> {
  await ensureAssistentesSchema();
  const linhas = await withConnection(async (conn) => {
    const [r] = (await conn.execute(
      `${SELECT_ASSISTENTE} WHERE funcao = 'assistente' AND isAdmin = 0 ORDER BY active DESC, nome ASC`,
    )) as [LinhaDeAssistente[], unknown];
    return r;
  });
  const clyon = await comissaoClyonPercent();
  const comissoes = new Map(linhas.map((l) => [l.id, comissaoDaLinha(l.commissionPercent)]));
  const stats = await estatisticasDosAssistentes(linhas.map((l) => l.id), comissoes, clyon);

  return {
    comissaoClyonPercent: clyon,
    assistentes: linhas.map((l) => ({
      id: l.id,
      nome: l.nome,
      activo: Number(l.active ?? 0) === 1,
      seccoes: seccoesDaLinha(l.seccoesJson),
      comissaoPercent: comissaoDaLinha(l.commissionPercent),
      estatisticas: stats.get(l.id)!,
      createdAt: paraIso(l.createdAt),
      updatedAt: paraIso(l.updatedAt),
    })),
  };
}

/** O que um assistente vê de si próprio: secções e os números dele. */
export async function resumoDoAssistente(id: number): Promise<{
  seccoes: SeccaoDoAssistente[];
  comissaoPercent: number;
  comissaoClyonPercent: number;
  estatisticas: EstatisticasDeTrabalho;
} | undefined> {
  const a = await assistentePorId(id);
  if (!a) return undefined;
  const clyon = await comissaoClyonPercent();
  const stats = await estatisticasDosAssistentes([id], new Map([[id, a.comissaoPercent]]), clyon);
  return {
    seccoes: a.seccoes,
    comissaoPercent: a.comissaoPercent,
    comissaoClyonPercent: clyon,
    estatisticas: stats.get(id)!,
  };
}

/** Existe já um colaborador com este nome — de QUALQUER função? */
export async function existeColaboradorComNome(nome: string): Promise<boolean> {
  return withConnection(async (conn) => {
    const [linhas] = (await conn.execute(
      "SELECT id FROM colaboradores WHERE nome = ? LIMIT 1",
      [nome],
    )) as [Array<{ id: number }>, unknown];
    return linhas.length > 0;
  });
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

export async function criarAssistente(dados: {
  nome: string;
  senhaHash: string;
  seccoes: SeccaoDoAssistente[];
  comissaoPercent: number;
}): Promise<number> {
  await ensureAssistentesSchema();
  return withConnection(async (conn) => {
    // valorHora e paymentModel: colunas herdadas da folha de pagamentos dos
    // motoristas. Um assistente é pago à comissão — e a comissão fica em
    // commissionPercent, sobre a parte da CLYON.
    const [r] = (await conn.execute(
      `INSERT INTO colaboradores
         (nome, senha, funcao, isAdmin, valorHora, paymentModel, commissionType, commissionPercent,
          seccoesJson, canReceiveSimulatorRequests, participatesInTimeTracking, active)
       VALUES (?, ?, 'assistente', 0, '0.00', 'commission', 'profit_percent', ?, ?, 0, 0, 1)`,
      [dados.nome, dados.senhaHash, dados.comissaoPercent.toFixed(2), JSON.stringify(dados.seccoes)],
    )) as [{ insertId?: number }, unknown];
    return Number(r.insertId ?? 0);
  });
}

async function actualizarAssistente(id: number, sql: string, params: unknown[]): Promise<boolean> {
  await ensureAssistentesSchema();
  return withConnection(async (conn) => {
    const [r] = (await conn.execute(
      `UPDATE colaboradores SET ${sql}, updatedAt = NOW()
        WHERE id = ? AND funcao = 'assistente' AND isAdmin = 0`,
      [...params, id],
    )) as [{ affectedRows?: number }, unknown];
    return Number(r.affectedRows ?? 0) > 0;
  });
}

/** Só toca em assistentes: um id de administrador aqui não muda nada. */
export function definirEstadoDoAssistente(id: number, activo: boolean): Promise<boolean> {
  return actualizarAssistente(id, "active = ?", [activo ? 1 : 0]);
}

export function definirPalavraPasseDoAssistente(id: number, senhaHash: string): Promise<boolean> {
  return actualizarAssistente(id, "senha = ?", [senhaHash]);
}

export function definirSeccoesDoAssistente(id: number, seccoes: SeccaoDoAssistente[]): Promise<boolean> {
  return actualizarAssistente(id, "seccoesJson = ?", [JSON.stringify(seccoes)]);
}

export function definirComissaoDoAssistente(id: number, percent: number): Promise<boolean> {
  return actualizarAssistente(id, "commissionPercent = ?", [percent.toFixed(2)]);
}

// ─── Atribuição ──────────────────────────────────────────────────────────────

/**
 * O pedido passa a ser de quem agiu nele primeiro.
 *
 * Só para assistentes, e só se o pedido ainda não tiver responsável: a
 * comissão é por trabalho de que se foi responsável, e um trabalho sem
 * ninguém passa a ter alguém no momento em que alguém lhe mexe — aprova,
 * pede informação, agenda, promove à plataforma. O administrador não entra
 * nisto: o painel dele nunca atribuiu sozinho, e não é ele que ganha
 * comissão.
 *
 * Não mexe no estado. O botão "Aceitar pedido" continua a existir e faz mais
 * do que isto (passa a `atribuido`); isto é a rede por baixo, para quem age
 * sem carregar nele.
 */
export async function assumirPedidoSeLivre(
  pedidoId: number,
  colab: { id: number; nome: string; papel: PapelDoPainel } | null | undefined,
): Promise<void> {
  if (!colab || colab.papel !== "assistente") return;
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return;
  try {
    await withConnection(async (conn) => {
      await conn.execute(
        `UPDATE simulatorOrders
            SET assignedToId = ?, assignedToName = ?, assignedAt = NOW(), updatedAt = NOW()
          WHERE id = ? AND (assignedToId IS NULL OR assignedToId = 0)`,
        [colab.id, colab.nome, pedidoId],
      );
    });
  } catch (error) {
    // Uma atribuição falhada não pode travar a acção que a pessoa fez.
    console.error("[assistentes] assumirPedidoSeLivre", { pedidoId, colab: colab.id }, error);
  }
}
