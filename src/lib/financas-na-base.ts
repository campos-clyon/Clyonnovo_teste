import { getPool } from "./db";
import { quantoOProfissionalRecebe, taxasDaNegociacao } from "./taxas-plataforma";
import {
  CATEGORIAS_DE_ORIGEM,
  CATEGORIAS_DO_SISTEMA,
  CONTAS_DE_ORIGEM,
  CORES,
  ICONES,
  TIPOS_DE_CONTA,
  movimentosDaPlataforma,
  type Categoria,
  type CategoriaDoSistema,
  type Conta,
  type Cor,
  type DadosDoMovimento,
  type Icone,
  type LevantamentoDaPlataforma,
  type Movimento,
  type PagamentoAoProfissional,
  type PapelDaConta,
  type RecebimentoDaPlataforma,
  type TipoDeCategoria,
  type TipoDeConta,
} from "./financas";

/**
 * A GESTORA DE CONTAS NA BASE — 14-10-2026. As regras vivem em `financas.ts`;
 * aqui fica o que fala com o MySQL.
 *
 * Três tabelas novas, só desta gestora: as contas, as categorias, e os
 * movimentos lançados à mão. O dinheiro da plataforma NÃO se copia para cá —
 * lê-se, a cada abertura, das tabelas onde já vive (`pagamentos`,
 * `negociacoes.pagoEm`, `levantamentos`). Uma cópia era uma segunda verdade, e
 * no dia em que um pagamento fosse corrigido lá, a gestora mentia cá.
 */

const CHAVE_REPETIDA = "ER_DUP_ENTRY";

/*
 * UMA PREPARAÇÃO POR PROCESSO, partilhada. A primeira abertura pede as
 * contas, as categorias e os movimentos ao mesmo tempo; sem a promessa
 * guardada, criava as tabelas e semeava as categorias três vezes em paralelo.
 * Se falhar, esquece-se, e a próxima chamada tenta outra vez.
 */
let preparacao: Promise<void> | null = null;
function garantirTabelas(): Promise<void> {
  preparacao ??= prepararTabelas().catch((e) => {
    preparacao = null;
    throw e;
  });
  return preparacao;
}

async function prepararTabelas(): Promise<void> {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS financasContas (
      id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      nome         VARCHAR(60) NOT NULL,
      tipo         VARCHAR(20) NOT NULL DEFAULT 'banco',
      saldoInicial DECIMAL(12,2) NOT NULL DEFAULT 0,
      cor          VARCHAR(20) NOT NULL DEFAULT 'azul',
      papel        VARCHAR(20) NULL DEFAULT NULL,
      criadoEm     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_nome (nome),
      UNIQUE KEY uq_papel (papel)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS financasCategorias (
      id       INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      nome     VARCHAR(60) NOT NULL,
      tipo     VARCHAR(10) NOT NULL,
      cor      VARCHAR(20) NOT NULL DEFAULT 'ardosia',
      icone    VARCHAR(30) NOT NULL DEFAULT 'outros',
      sistema  VARCHAR(40) NULL DEFAULT NULL,
      criadoEm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_nome (tipo, nome),
      UNIQUE KEY uq_sistema (sistema)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  /*
   * O DIA É UM DIA (`DATE`), e não um instante. Uma despesa de 14 de outubro
   * é de 14 de outubro em qualquer fuso — e lê-se com `DATE_FORMAT`, para o
   * driver não a passar por meia-noite em UTC e devolver o dia 13.
   */
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS financasMovimentos (
      id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      tipo           VARCHAR(20) NOT NULL,
      valor          DECIMAL(12,2) NOT NULL,
      dia            DATE NOT NULL,
      descricao      VARCHAR(200) NOT NULL DEFAULT '',
      categoriaId    INT UNSIGNED NULL DEFAULT NULL,
      contaId        INT UNSIGNED NOT NULL,
      contaDestinoId INT UNSIGNED NULL DEFAULT NULL,
      efectivado     TINYINT(1) NOT NULL DEFAULT 1,
      ignorado       TINYINT(1) NOT NULL DEFAULT 0,
      notas          VARCHAR(500) NULL DEFAULT NULL,
      anexoUrl       VARCHAR(500) NULL DEFAULT NULL,
      anexoNome      VARCHAR(160) NULL DEFAULT NULL,
      criadoPor      VARCHAR(120) NULL DEFAULT NULL,
      actualizadoPor VARCHAR(120) NULL DEFAULT NULL,
      criadoEm       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizadoEm  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_dia (dia),
      KEY idx_conta (contaId),
      KEY idx_destino (contaDestinoId),
      KEY idx_categoria (categoriaId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  /*
   * AS DUAS CONTAS QUE A PLATAFORMA CONHECE existem sempre — o índice único do
   * `papel` faz do `INSERT IGNORE` uma garantia, e não uma repetição. Mudar-lhes
   * o nome é com quem as usa; o papel fica.
   */
  for (const c of CONTAS_DE_ORIGEM) {
    await pool.execute(
      `INSERT IGNORE INTO financasContas (nome, tipo, cor, papel) VALUES (?, ?, ?, ?)`,
      [c.nome, c.tipo, c.cor, c.papel],
    );
  }

  // E as categorias da plataforma, pela mesma razão.
  for (const [sistema, c] of Object.entries(CATEGORIAS_DO_SISTEMA)) {
    await pool.execute(
      `INSERT IGNORE INTO financasCategorias (nome, tipo, cor, icone, sistema) VALUES (?, ?, ?, ?, ?)`,
      [c.nome, c.tipo, c.cor, c.icone, sistema],
    );
  }

  /*
   * As do dia-a-dia só na primeira vez: depois são dele. Apagou os
   * «Impostos»? Não voltam ao reiniciar o servidor.
   */
  const [n] = (await pool.execute(
    "SELECT COUNT(*) AS n FROM financasCategorias WHERE sistema IS NULL",
  )) as [Array<{ n: number }>, unknown];
  if (Number(n[0]?.n ?? 0) === 0) {
    for (const c of CATEGORIAS_DE_ORIGEM) {
      await pool.execute(
        `INSERT IGNORE INTO financasCategorias (nome, tipo, cor, icone) VALUES (?, ?, ?, ?)`,
        [c.nome, c.tipo, c.cor, c.icone],
      );
    }
  }
}

const cor = (v: unknown): Cor => ((CORES as readonly string[]).includes(String(v)) ? (v as Cor) : "ardosia");
const icone = (v: unknown): Icone => ((ICONES as readonly string[]).includes(String(v)) ? (v as Icone) : "outros");
const tipoDeConta = (v: unknown): TipoDeConta =>
  TIPOS_DE_CONTA.some((t) => t.id === v) ? (v as TipoDeConta) : "outra";

export async function contasDaGestora(): Promise<Conta[]> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [linhas] = (await pool.execute(
    "SELECT id, nome, tipo, saldoInicial, cor, papel FROM financasContas ORDER BY papel IS NULL, id",
  )) as [Array<Record<string, unknown>>, unknown];
  return linhas.map((l) => ({
    id: Number(l.id),
    nome: String(l.nome),
    tipo: tipoDeConta(l.tipo),
    saldoInicial: Number(l.saldoInicial ?? 0),
    cor: cor(l.cor),
    papel: l.papel === "plataforma" || l.papel === "caixa" ? (l.papel as PapelDaConta) : null,
  }));
}

export async function categoriasDaGestora(): Promise<Categoria[]> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [linhas] = (await pool.execute(
    "SELECT id, nome, tipo, cor, icone, sistema FROM financasCategorias ORDER BY tipo, sistema IS NOT NULL, nome",
  )) as [Array<Record<string, unknown>>, unknown];
  return linhas.map((l) => ({
    id: Number(l.id),
    nome: String(l.nome),
    tipo: (l.tipo === "receita" ? "receita" : "despesa") as TipoDeCategoria,
    cor: cor(l.cor),
    icone: icone(l.icone),
    sistema: l.sistema && String(l.sistema) in CATEGORIAS_DO_SISTEMA ? (l.sistema as CategoriaDoSistema) : null,
  }));
}

/** Os movimentos lançados à mão, todos. */
async function movimentosAMao(): Promise<Movimento[]> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [linhas] = (await pool.execute(
    `SELECT id, tipo, valor, DATE_FORMAT(dia, '%Y-%m-%d') AS dia, descricao, categoriaId, contaId,
            contaDestinoId, efectivado, ignorado, notas, anexoUrl, anexoNome, criadoPor
       FROM financasMovimentos
      ORDER BY dia DESC, id DESC`,
  )) as [Array<Record<string, unknown>>, unknown];
  return linhas.map((l) => ({
    id: `m${Number(l.id)}`,
    tipo: l.tipo === "receita" ? "receita" : l.tipo === "transferencia" ? "transferencia" : "despesa",
    valor: Number(l.valor),
    dia: String(l.dia),
    descricao: String(l.descricao ?? ""),
    categoriaId: l.categoriaId != null ? Number(l.categoriaId) : null,
    contaId: Number(l.contaId),
    contaDestinoId: l.contaDestinoId != null ? Number(l.contaDestinoId) : null,
    efectivado: Number(l.efectivado) === 1,
    ignorado: Number(l.ignorado) === 1,
    notas: (l.notas as string) ?? null,
    anexo: l.anexoUrl ? { url: String(l.anexoUrl), nome: String(l.anexoNome ?? "Anexo") } : null,
    automatico: null,
    criadoPor: (l.criadoPor as string) ?? null,
  }));
}

/**
 * Lê uma consulta que pode bater numa tabela que ainda não existe — a dos
 * pagamentos nasce no primeiro pagamento, a dos levantamentos no primeiro
 * pedido. Sem a tabela, não há nada a ler, e a gestora abre na mesma.
 */
async function lerSeHouver(sql: string): Promise<Array<Record<string, unknown>>> {
  const pool = await getPool();
  if (!pool) return [];
  try {
    const [linhas] = (await pool.execute(sql)) as [Array<Record<string, unknown>>, unknown];
    return linhas;
  } catch (e) {
    if ((e as { code?: string })?.code === "ER_NO_SUCH_TABLE") return [];
    throw e;
  }
}

/** O dinheiro que passou pela plataforma, como ela o guarda. */
async function dinheiroDaPlataforma(): Promise<{
  recebimentos: RecebimentoDaPlataforma[];
  pagosAosProfissionais: PagamentoAoProfissional[];
  levantamentos: LevantamentoDaPlataforma[];
}> {
  const [recebidos, pagos, levantados] = await Promise.all([
    lerSeHouver(
      `SELECT pg.id, pg.pedidoId, pg.metodo, pg.valor, pg.valorPago, pg.comissaoEupago, pg.pagoEm,
              pg.ambiente, pg.deTeste, COALESCE(pr.contaDeTeste, 0) AS contaDeTeste,
              n.formaDePagamento, o.contactName AS cliente, pr.name AS profissional
         FROM pagamentos pg
         LEFT JOIN negociacoes n ON n.id = pg.negociacaoId
         LEFT JOIN providers pr ON pr.id = pg.providerId
         LEFT JOIN simulatorOrders o ON o.id = pg.pedidoId
        WHERE pg.estado = 'pago' AND pg.pagoEm IS NOT NULL`,
    ),
    lerSeHouver(
      `SELECT n.id, n.pedidoId, n.pagoEm, n.valorAcordado, n.taxaCliente, n.taxaProfissional,
              n.formaDePagamento, pr.name AS profissional, COALESCE(pr.contaDeTeste, 0) AS contaDeTeste
         FROM negociacoes n
         JOIN providers pr ON pr.id = n.providerId
        WHERE n.pagoEm IS NOT NULL AND n.valorAcordado IS NOT NULL`,
    ),
    lerSeHouver(
      `SELECT l.id, l.valor, l.processadoEm, pr.name AS profissional, COALESCE(pr.contaDeTeste, 0) AS contaDeTeste
         FROM levantamentos l
         JOIN providers pr ON pr.id = l.providerId
        WHERE l.estado = 'pago'`,
    ),
  ]);

  return {
    recebimentos: recebidos.map((l) => ({
      id: Number(l.id),
      pedidoId: Number(l.pedidoId),
      metodo: String(l.metodo ?? ""),
      valor: Number(l.valor ?? 0),
      valorPago: l.valorPago != null ? Number(l.valorPago) : null,
      comissaoEupago: l.comissaoEupago != null ? Number(l.comissaoEupago) : null,
      pagoEm: (l.pagoEm as Date | string | null) ?? null,
      ambiente: String(l.ambiente ?? ""),
      deTeste: Number(l.deTeste) === 1,
      contaDeTeste: Number(l.contaDeTeste) === 1,
      formaDoTrabalho: (l.formaDePagamento as string) ?? null,
      cliente: (l.cliente as string) ?? null,
      profissional: (l.profissional as string) ?? null,
    })),
    pagosAosProfissionais: pagos.map((l) => ({
      negociacaoId: Number(l.id),
      pedidoId: Number(l.pedidoId),
      pagoEm: (l.pagoEm as Date | string | null) ?? null,
      recebe: quantoOProfissionalRecebe(Number(l.valorAcordado), taxasDaNegociacao(l)),
      profissional: String(l.profissional ?? "Profissional"),
      contaDeTeste: Number(l.contaDeTeste) === 1,
      formaDoTrabalho: (l.formaDePagamento as string) ?? null,
    })),
    levantamentos: levantados.map((l) => ({
      id: Number(l.id),
      valor: Number(l.valor ?? 0),
      processadoEm: (l.processadoEm as Date | string | null) ?? null,
      profissional: String(l.profissional ?? "Profissional"),
      contaDeTeste: Number(l.contaDeTeste) === 1,
    })),
  };
}

/** Tudo o que o ecrã precisa, de uma vez: contas, categorias e movimentos. */
export async function tudoDaGestora(): Promise<{ contas: Conta[]; categorias: Categoria[]; movimentos: Movimento[] }> {
  const [contas, categorias, aMao, plataforma] = await Promise.all([
    contasDaGestora(),
    categoriasDaGestora(),
    movimentosAMao(),
    dinheiroDaPlataforma(),
  ]);
  const contaPlataforma = contas.find((c) => c.papel === "plataforma")?.id ?? contas[0]?.id ?? 0;
  const contaCaixa = contas.find((c) => c.papel === "caixa")?.id ?? contaPlataforma;
  const doSistema = new Map(categorias.filter((c) => c.sistema).map((c) => [c.sistema as CategoriaDoSistema, c.id]));
  const automaticos = movimentosDaPlataforma(plataforma, {
    contaPlataforma,
    contaCaixa,
    categoria: (s) => doSistema.get(s) ?? 0,
  });
  return { contas, categorias, movimentos: [...aMao, ...automaticos] };
}

// ─── Movimentos à mão ────────────────────────────────────────────────────────

/** `m12` → 12. O que não for um movimento à mão não se mexe por aqui. */
export function idDoMovimento(id: unknown): number | null {
  const m = /^m(\d+)$/.exec(String(id ?? ""));
  return m ? Number(m[1]) : null;
}

const valoresDoMovimento = (d: DadosDoMovimento) => [
  d.tipo,
  d.valor,
  d.dia,
  d.descricao,
  d.categoriaId,
  d.contaId,
  d.contaDestinoId,
  d.efectivado ? 1 : 0,
  d.ignorado ? 1 : 0,
  d.notas,
  d.anexoUrl,
  d.anexoNome,
];

export async function lancarMovimento(d: DadosDoMovimento, quem: string): Promise<number> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute(
    `INSERT INTO financasMovimentos
       (tipo, valor, dia, descricao, categoriaId, contaId, contaDestinoId, efectivado, ignorado,
        notas, anexoUrl, anexoNome, criadoPor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...valoresDoMovimento(d), quem.slice(0, 120)],
  )) as [{ insertId?: number }, unknown];
  return Number(r.insertId ?? 0);
}

export async function mudarMovimento(id: number, d: DadosDoMovimento, quem: string): Promise<boolean> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute(
    `UPDATE financasMovimentos
        SET tipo = ?, valor = ?, dia = ?, descricao = ?, categoriaId = ?, contaId = ?, contaDestinoId = ?,
            efectivado = ?, ignorado = ?, notas = ?, anexoUrl = ?, anexoNome = ?, actualizadoPor = ?
      WHERE id = ?`,
    [...valoresDoMovimento(d), quem.slice(0, 120), id],
  )) as [{ affectedRows?: number }, unknown];
  return Number(r.affectedRows ?? 0) > 0;
}

export async function apagarMovimento(id: number): Promise<boolean> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute("DELETE FROM financasMovimentos WHERE id = ?", [id])) as [
    { affectedRows?: number },
    unknown,
  ];
  return Number(r.affectedRows ?? 0) > 0;
}

// ─── Contas e categorias ─────────────────────────────────────────────────────

type Resultado = { ok: true; id?: number } | { ok: false; erro: string };

async function escrever(sql: string, valores: Array<string | number | null>, repetido: string): Promise<Resultado> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  try {
    const [r] = (await pool.execute(sql, valores)) as [{ insertId?: number; affectedRows?: number }, unknown];
    if (Number(r.affectedRows ?? 0) === 0) return { ok: false, erro: "Já não existe — actualize a página." };
    return { ok: true, id: r.insertId ? Number(r.insertId) : undefined };
  } catch (e) {
    if ((e as { code?: string })?.code === CHAVE_REPETIDA) return { ok: false, erro: repetido };
    throw e;
  }
}

export function criarConta(d: { nome: string; tipo: TipoDeConta; saldoInicial: number; cor: Cor }): Promise<Resultado> {
  return escrever(
    "INSERT INTO financasContas (nome, tipo, saldoInicial, cor) VALUES (?, ?, ?, ?)",
    [d.nome, d.tipo, d.saldoInicial, d.cor],
    "Já há uma conta com esse nome.",
  );
}

export function mudarConta(
  id: number,
  d: { nome: string; tipo: TipoDeConta; saldoInicial: number; cor: Cor },
): Promise<Resultado> {
  return escrever(
    "UPDATE financasContas SET nome = ?, tipo = ?, saldoInicial = ?, cor = ? WHERE id = ?",
    [d.nome, d.tipo, d.saldoInicial, d.cor, id],
    "Já há uma conta com esse nome.",
  );
}

/** Só uma conta sem movimentos, e nunca as duas da plataforma. */
export async function apagarConta(id: number): Promise<Resultado> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [c] = (await pool.execute("SELECT papel FROM financasContas WHERE id = ?", [id])) as [
    Array<{ papel: string | null }>,
    unknown,
  ];
  if (!c[0]) return { ok: false, erro: "Já não existe — actualize a página." };
  if (c[0].papel) return { ok: false, erro: "É a conta onde entra o dinheiro da plataforma: muda-se o nome, não se apaga." };
  const [n] = (await pool.execute(
    "SELECT COUNT(*) AS n FROM financasMovimentos WHERE contaId = ? OR contaDestinoId = ?",
    [id, id],
  )) as [Array<{ n: number }>, unknown];
  if (Number(n[0]?.n ?? 0) > 0) {
    return { ok: false, erro: `Tem ${n[0].n} movimento(s). Passe-os para outra conta antes de a apagar.` };
  }
  return escrever("DELETE FROM financasContas WHERE id = ?", [id], "");
}

export function criarCategoria(d: { nome: string; tipo: TipoDeCategoria; cor: Cor; icone: Icone }): Promise<Resultado> {
  return escrever(
    "INSERT INTO financasCategorias (nome, tipo, cor, icone) VALUES (?, ?, ?, ?)",
    [d.nome, d.tipo, d.cor, d.icone],
    "Já há uma categoria com esse nome.",
  );
}

/** O tipo não muda: uma categoria de despesas com receitas lá dentro deixava de bater certo. */
export function mudarCategoria(id: number, d: { nome: string; cor: Cor; icone: Icone }): Promise<Resultado> {
  return escrever(
    "UPDATE financasCategorias SET nome = ?, cor = ?, icone = ? WHERE id = ?",
    [d.nome, d.cor, d.icone, id],
    "Já há uma categoria com esse nome.",
  );
}

/** Só uma categoria sem movimentos, e nunca as da plataforma. */
export async function apagarCategoria(id: number): Promise<Resultado> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [c] = (await pool.execute("SELECT sistema FROM financasCategorias WHERE id = ?", [id])) as [
    Array<{ sistema: string | null }>,
    unknown,
  ];
  if (!c[0]) return { ok: false, erro: "Já não existe — actualize a página." };
  if (c[0].sistema) return { ok: false, erro: "É uma categoria do dinheiro da plataforma: não se apaga." };
  const [n] = (await pool.execute("SELECT COUNT(*) AS n FROM financasMovimentos WHERE categoriaId = ?", [id])) as [
    Array<{ n: number }>,
    unknown,
  ];
  if (Number(n[0]?.n ?? 0) > 0) {
    return { ok: false, erro: `Tem ${n[0].n} movimento(s). Mude-os de categoria antes de a apagar.` };
  }
  return escrever("DELETE FROM financasCategorias WHERE id = ?", [id], "");
}
