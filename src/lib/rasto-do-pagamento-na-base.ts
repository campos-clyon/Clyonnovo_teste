import { put } from "@vercel/blob";
import { getPool } from "./db";
import { obterTokenDoBlob } from "./blob-token";
import { tokenDoBlobDasFaturas } from "./faturas-do-trabalho-no-servidor";
import { foiPagoEmMaoPor } from "./pago-em-mao";
import {
  origemDoPagamento,
  porConferirNoExtrato,
  semComprovativo,
  type AlvoDoExtrato,
  type AlvoDoComprovativo,
  type ComprovativoVisto,
  type RegistoDoDinheiro,
} from "./origem-do-pagamento";
import type { ComprovativoConferido } from "./comprovativo-do-pagamento";
import type { OrigemNaGestora } from "./financas";

/**
 * O RASTO DE CADA PAGAMENTO, NA BASE — d66 (CEO e dono, 18-11-2026).
 *
 * Duas coisas novas, as duas só a acrescentar (nenhuma linha existente muda):
 *
 *   · a coluna `contaDeDestino` em `pagamentos` e em `cobrancasAoProfissional`
 *     — o rótulo da conta onde a transferência entrou (`contas-de-destino.ts`);
 *   · a tabela `comprovativosDosPagamentos` — cada ficheiro junto a um
 *     registo (`alvo` + `alvoId`: a linha de `pagamentos`, a parte da
 *     cobrança, ou o «Já pagámos» do trabalho), com o trabalho e o pedido para
 *     se ler de uma vez. Nunca se apaga: um comprovativo trocado fica inactivo.
 *
 * Os ficheiros sobem para o armazenamento PRIVADO das faturas (o mesmo das
 * faturas do trabalho, d28); sem ele ligado, para o de sempre com sufixo ao
 * acaso — e, nos dois, o endereço nunca sai do servidor: lê-se pela rota
 * autenticada do backoffice.
 */

let pronta = false;

export async function garantirTabelaDosComprovativos(): Promise<void> {
  if (pronta) return;
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS comprovativosDosPagamentos (
      id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      alvo          VARCHAR(24) NOT NULL,
      alvoId        INT UNSIGNED NOT NULL,
      negociacaoId  INT UNSIGNED NULL DEFAULT NULL,
      pedidoId      INT NULL DEFAULT NULL,
      url           VARCHAR(700) NOT NULL,
      nome          VARCHAR(160) NOT NULL,
      tipo          VARCHAR(60) NOT NULL,
      tamanho       INT UNSIGNED NOT NULL DEFAULT 0,
      carregadoPor  VARCHAR(120) NULL DEFAULT NULL,
      activo        TINYINT(1) NOT NULL DEFAULT 1,
      criadoEm      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_alvo (alvo, alvoId, activo),
      KEY idx_negociacao (negociacaoId, activo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  for (const sql of [
    "ALTER TABLE pagamentos ADD COLUMN contaDeDestino VARCHAR(60) NULL DEFAULT NULL",
    "ALTER TABLE cobrancasAoProfissional ADD COLUMN contaDeDestino VARCHAR(60) NULL DEFAULT NULL",
    // «Conferido no extrato» (d1, 19-11-2026): só a acrescentar, nulas em todas as linhas que já existem.
    "ALTER TABLE pagamentos ADD COLUMN conferidoNoExtratoEm DATETIME NULL DEFAULT NULL",
    "ALTER TABLE pagamentos ADD COLUMN conferidoNoExtratoPor VARCHAR(120) NULL DEFAULT NULL",
    "ALTER TABLE cobrancasAoProfissional ADD COLUMN conferidoNoExtratoEm DATETIME NULL DEFAULT NULL",
    "ALTER TABLE cobrancasAoProfissional ADD COLUMN conferidoNoExtratoPor VARCHAR(120) NULL DEFAULT NULL",
  ]) {
    try {
      await pool.execute(sql);
    } catch {
      // Já lá estava (ou a tabela ainda não existe: nasce com a coluna).
    }
  }
  pronta = true;
}

/** Sobe o ficheiro já conferido. Devolve o endereço (que fica no servidor). */
export async function subirComprovativo(
  ficheiro: Blob,
  c: Extract<ComprovativoConferido, { ok: true }>,
  caminho: string,
): Promise<string> {
  const privado = tokenDoBlobDasFaturas();
  if (privado) {
    const b = await put(`${caminho}.${c.extensao}`, ficheiro, {
      access: "private",
      contentType: c.tipo,
      addRandomSuffix: true,
      token: privado,
    });
    return b.url;
  }
  console.warn("[comprovativos] sem o armazenamento privado das faturas — vai para o de sempre.");
  const t = await obterTokenDoBlob();
  if (!t.ok) throw new Error(`sem token do Blob: ${t.motivo}`);
  const b = await put(`${caminho}.${c.extensao}`, ficheiro, {
    access: "public",
    contentType: c.tipo,
    addRandomSuffix: true,
    ...(t.modo === "token" ? { token: t.token } : { storeId: t.storeId }),
  });
  return b.url;
}

export async function guardarComprovativo(d: {
  alvo: AlvoDoComprovativo;
  alvoIds: number[];
  negociacaoId: number | null;
  pedidoId: number | null;
  url: string;
  nome: string;
  tipo: string;
  tamanho: number;
  por: string;
}): Promise<number[]> {
  await garantirTabelaDosComprovativos();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const ids: number[] = [];
  for (const alvoId of d.alvoIds) {
    const [r] = (await pool.execute(
      `INSERT INTO comprovativosDosPagamentos
         (alvo, alvoId, negociacaoId, pedidoId, url, nome, tipo, tamanho, carregadoPor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.alvo, alvoId, d.negociacaoId, d.pedidoId, d.url, d.nome.slice(0, 160), d.tipo, d.tamanho, d.por.slice(0, 120)],
    )) as [{ insertId?: number }, unknown];
    ids.push(Number(r?.insertId ?? 0));
  }
  return ids;
}

export async function comprovativoParaLer(id: number): Promise<{ id: number; url: string; nome: string; tipo: string } | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  await garantirTabelaDosComprovativos();
  const pool = await getPool();
  if (!pool) return null;
  const [l] = (await pool.execute(
    `SELECT id, url, nome, tipo FROM comprovativosDosPagamentos WHERE id = ? AND activo = 1 LIMIT 1`,
    [id],
  )) as [Array<Record<string, unknown>>, unknown];
  const x = l[0];
  return x ? { id: Number(x.id), url: String(x.url), nome: String(x.nome), tipo: String(x.tipo) } : null;
}

/**
 * O registo existe, e de que trabalho é? Só se junta comprovativo a um
 * registo que existe e que foi feito à mão — nunca a um pagamento do euPago.
 */
export async function alvoDoComprovativo(
  alvo: AlvoDoComprovativo,
  alvoId: number,
): Promise<{ negociacaoId: number; pedidoId: number | null } | { erro: string; status: number }> {
  if (!Number.isInteger(alvoId) || alvoId <= 0) return { erro: "Registo não indicado.", status: 400 };
  await garantirTabelaDosComprovativos();
  const pool = await getPool();
  if (!pool) return { erro: "Base indisponível.", status: 503 };
  if (alvo === "pagamento") {
    const [l] = (await pool.execute(
      `SELECT negociacaoId, pedidoId, metodo, estado FROM pagamentos WHERE id = ? LIMIT 1`,
      [alvoId],
    )) as [Array<Record<string, unknown>>, unknown];
    const x = l[0];
    if (!x) return { erro: "Pagamento não encontrado.", status: 404 };
    if (x.estado !== "pago") return { erro: "Só se junta comprovativo a um pagamento registado.", status: 409 };
    if (origemDoPagamento({ metodo: String(x.metodo) }).automatica) {
      return { erro: "Este pagamento veio do euPago — a prova é o próprio euPago.", status: 409 };
    }
    return { negociacaoId: Number(x.negociacaoId), pedidoId: x.pedidoId != null ? Number(x.pedidoId) : null };
  }
  if (alvo === "cobranca") {
    const [l] = (await pool.execute(
      `SELECT negociacaoId, pedidoId FROM cobrancasAoProfissional WHERE id = ? AND activa = 1 LIMIT 1`,
      [alvoId],
    )) as [Array<Record<string, unknown>>, unknown];
    const x = l[0];
    if (!x) return { erro: "Esta parte não está marcada como paga.", status: 404 };
    return { negociacaoId: Number(x.negociacaoId), pedidoId: x.pedidoId != null ? Number(x.pedidoId) : null };
  }
  const [l] = (await pool.execute(`SELECT id, pedidoId, pagoEm FROM negociacoes WHERE id = ? LIMIT 1`, [alvoId])) as [
    Array<Record<string, unknown>>,
    unknown,
  ];
  const x = l[0];
  if (!x) return { erro: "Trabalho não encontrado.", status: 404 };
  if (x.pagoEm == null) return { erro: "Ainda não está marcado como pago ao profissional.", status: 409 };
  return { negociacaoId: Number(x.id), pedidoId: x.pedidoId != null ? Number(x.pedidoId) : null };
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

/** A marca «conferido no extrato» de uma linha lida (d1), ou nula. */
function conferido(l: Record<string, unknown>): { em: string | null; por: string | null } | null {
  if (l.conferidoNoExtratoEm == null) return null;
  return { em: iso(l.conferidoNoExtratoEm), por: (l.conferidoNoExtratoPor as string | null) ?? null };
}

/**
 * MARCAR «CONFERIDO NO EXTRATO» — d1 (CEO e dono, 19-11-2026). Só numa
 * transferência que entrou na CLYON (uma linha paga de `pagamentos`, ou uma
 * parte activa da cobrança ao profissional), e só uma vez: a marca não se
 * reescreve (`conferidoNoExtratoEm IS NULL` no UPDATE). Não mexe em valores,
 * estados nem comprovativos — só escreve quem e quando.
 */
export async function marcarConferidoNoExtrato(d: {
  alvo: AlvoDoExtrato;
  alvoId: number;
  por: string;
  agora: Date;
}): Promise<
  | { ok: true; negociacaoId: number | null; pedidoId: number | null; valor: number | null }
  | { ok: false; erro: string; status: number }
> {
  if (!Number.isInteger(d.alvoId) || d.alvoId <= 0) return { ok: false, erro: "Registo não indicado.", status: 400 };
  await garantirTabelaDosComprovativos();
  const pool = await getPool();
  if (!pool) return { ok: false, erro: "Base indisponível.", status: 503 };
  const [l] = (await pool.execute(
    d.alvo === "pagamento"
      ? `SELECT negociacaoId, pedidoId, metodo, estado AS situacao, COALESCE(valorPago, valor) AS valor, conferidoNoExtratoEm
           FROM pagamentos WHERE id = ? LIMIT 1`
      : `SELECT negociacaoId, pedidoId, metodo, IF(activa = 1, 'pago', 'inactiva') AS situacao, valor, conferidoNoExtratoEm
           FROM cobrancasAoProfissional WHERE id = ? LIMIT 1`,
    [d.alvoId],
  )) as [Array<Record<string, unknown>>, unknown];
  const x = l[0];
  if (!x) return { ok: false, erro: "Registo não encontrado.", status: 404 };
  if (x.situacao !== "pago") return { ok: false, erro: "Só se confere no extrato um pagamento registado.", status: 409 };
  if (origemDoPagamento({ metodo: String(x.metodo ?? "") }).chave !== "transferencia") {
    return { ok: false, erro: "Só as transferências se conferem no extrato.", status: 409 };
  }
  if (x.conferidoNoExtratoEm != null) return { ok: false, erro: "Já estava conferido no extrato.", status: 409 };
  const [r] = (await pool.execute(
    d.alvo === "pagamento"
      ? `UPDATE pagamentos SET conferidoNoExtratoEm = ?, conferidoNoExtratoPor = ? WHERE id = ? AND conferidoNoExtratoEm IS NULL`
      : `UPDATE cobrancasAoProfissional SET conferidoNoExtratoEm = ?, conferidoNoExtratoPor = ? WHERE id = ? AND conferidoNoExtratoEm IS NULL`,
    [d.agora, d.por.slice(0, 120), d.alvoId],
  )) as [{ affectedRows?: number }, unknown];
  if (!r?.affectedRows) return { ok: false, erro: "Já estava conferido no extrato.", status: 409 };
  return {
    ok: true,
    negociacaoId: x.negociacaoId != null ? Number(x.negociacaoId) : null,
    pedidoId: x.pedidoId != null ? Number(x.pedidoId) : null,
    valor: x.valor != null ? Number(x.valor) : null,
  };
}

async function lerSemFalhar(sql: string, params: unknown[]): Promise<Array<Record<string, unknown>>> {
  const pool = await getPool();
  if (!pool) return [];
  try {
    const [l] = (await pool.query(sql, params)) as [Array<Record<string, unknown>>, unknown];
    return l;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR") return [];
    throw e;
  }
}

/** Os comprovativos activos destes registos, por `alvo:alvoId`. */
export async function comprovativosDosAlvos(
  pares: ReadonlyArray<{ alvo: AlvoDoComprovativo; alvoId: number }>,
): Promise<Map<string, ComprovativoVisto[]>> {
  const mapa = new Map<string, ComprovativoVisto[]>();
  const ids = [...new Set(pares.map((p) => p.alvoId).filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) return mapa;
  await garantirTabelaDosComprovativos().catch(() => {});
  const linhas = await lerSemFalhar(
    `SELECT id, alvo, alvoId, nome, criadoEm, carregadoPor FROM comprovativosDosPagamentos
      WHERE activo = 1 AND alvoId IN (?) ORDER BY id`,
    [ids],
  );
  for (const l of linhas) {
    const k = `${l.alvo}:${l.alvoId}`;
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k)!.push({
      id: Number(l.id),
      nome: String(l.nome ?? "comprovativo"),
      em: iso(l.criadoEm),
      por: (l.carregadoPor as string | null) ?? null,
    });
  }
  return mapa;
}

function oQueDoPagamento(metodo: string, parte: string): string {
  if (parte === "diferenca") return "Diferença das horas";
  if (metodo === "ao_profissional") return "O cliente pagou ao profissional";
  if (metodo === "abatimento" || metodo === "quitacao") return "Acerto no saldo do profissional";
  if (parte === "divida" || metodo.startsWith("pro_")) return "Do profissional à CLYON";
  return "Pagamento à CLYON";
}

/**
 * OS REGISTOS DE DINHEIRO DE CADA TRABALHO, com a origem e a prova: as linhas
 * pagas de `pagamentos`, as partes da cobrança pagas à parte (sem linha em
 * `pagamentos`) e o «Já pagámos» ao profissional. Uma leitura por tabela.
 */
export async function registosDasNegociacoes(negociacaoIds: ReadonlyArray<number>): Promise<Map<number, RegistoDoDinheiro[]>> {
  const mapa = new Map<number, RegistoDoDinheiro[]>();
  const ids = [...new Set(negociacaoIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) return mapa;
  await garantirTabelaDosComprovativos().catch(() => {});

  const [pags, cobs, negs] = await Promise.all([
    lerSemFalhar(
      `SELECT id, negociacaoId, metodo, parte, valor, valorPago, pagoEm, referencia, entidade, trid, transacaoId, contaDeDestino,
              conferidoNoExtratoEm, conferidoNoExtratoPor
         FROM pagamentos WHERE estado = 'pago' AND negociacaoId IN (?) ORDER BY id`,
      [ids],
    ),
    lerSemFalhar(
      `SELECT id, negociacaoId, parte, valor, pagoEm, metodo, contaDeDestino, conferidoNoExtratoEm, conferidoNoExtratoPor
         FROM cobrancasAoProfissional WHERE activa = 1 AND pagamentoId IS NULL AND negociacaoId IN (?) ORDER BY id`,
      [ids],
    ),
    lerSemFalhar(
      `SELECT n.id, n.pagoEm, n.formaDePagamento, pg.metodo AS comoEntrou
         FROM negociacoes n LEFT JOIN pagamentos pg ON pg.negociacaoPaga = n.id
        WHERE n.pagoEm IS NOT NULL AND n.id IN (?)`,
      [ids],
    ),
  ]);

  const pares: Array<{ alvo: AlvoDoComprovativo; alvoId: number }> = [
    ...pags.map((p) => ({ alvo: "pagamento" as const, alvoId: Number(p.id) })),
    ...cobs.map((c) => ({ alvo: "cobranca" as const, alvoId: Number(c.id) })),
    ...negs.map((n) => ({ alvo: "pago_ao_profissional" as const, alvoId: Number(n.id) })),
  ];
  const provas = await comprovativosDosAlvos(pares);
  const juntar = (negociacaoId: number, r: Omit<RegistoDoDinheiro, "semComprovativo">) => {
    const registo = { ...r, semComprovativo: semComprovativo(r), porConferir: porConferirNoExtrato(r) };
    if (!mapa.has(negociacaoId)) mapa.set(negociacaoId, []);
    mapa.get(negociacaoId)!.push(registo);
  };

  for (const p of pags) {
    const metodo = String(p.metodo ?? "");
    juntar(Number(p.negociacaoId), {
      alvo: "pagamento",
      alvoId: Number(p.id),
      oQue: oQueDoPagamento(metodo, String(p.parte ?? "trabalho")),
      valor: p.valorPago != null ? Number(p.valorPago) : p.valor != null ? Number(p.valor) : null,
      em: iso(p.pagoEm),
      origem: origemDoPagamento({
        metodo,
        referencia: (p.referencia as string) ?? null,
        entidade: (p.entidade as string) ?? null,
        trid: (p.trid as string) ?? null,
        transacaoId: (p.transacaoId as string) ?? null,
        contaDeDestino: (p.contaDeDestino as string) ?? null,
      }),
      comprovativos: provas.get(`pagamento:${p.id}`) ?? [],
      conferidoNoExtrato: conferido(p),
    });
  }
  for (const c of cobs) {
    juntar(Number(c.negociacaoId), {
      alvo: "cobranca",
      alvoId: Number(c.id),
      oQue: c.parte === "iva" ? "IVA pago à parte pelo profissional" : "Taxa paga à parte pelo profissional",
      valor: c.valor != null ? Number(c.valor) : null,
      em: iso(c.pagoEm),
      origem: origemDoPagamento({ metodo: String(c.metodo ?? ""), contaDeDestino: (c.contaDeDestino as string) ?? null }),
      comprovativos: provas.get(`cobranca:${c.id}`) ?? [],
      conferidoNoExtrato: conferido(c),
    });
  }
  for (const n of negs) {
    // Pago em mão: a CLYON não transferiu nada ao profissional.
    if (foiPagoEmMaoPor(n.formaDePagamento, n.comoEntrou)) continue;
    const origem = origemDoPagamento({ metodo: "transferencia" });
    juntar(Number(n.id), {
      alvo: "pago_ao_profissional",
      alvoId: Number(n.id),
      oQue: "A CLYON pagou ao profissional",
      valor: null,
      em: iso(n.pagoEm),
      // Dinheiro a sair, e muitas vezes por levantamento: junta-se se houver, não fica por falta.
      origem: { ...origem, rotulo: "Transferência da CLYON", detalhe: null, precisaDeComprovativo: false },
      comprovativos: provas.get(`pago_ao_profissional:${n.id}`) ?? [],
    });
  }
  return mapa;
}

/**
 * A ORIGEM DE CADA MOVIMENTO DA PLATAFORMA NAS FINANÇAS — d66. Pela chave do
 * registo (`pagamento:<id>`, `cobranca:<id>`, `pago_ao_profissional:<id>`),
 * para `comAOrigem` (financas.ts). Se falhar, as Finanças abrem sem ela.
 */
export async function origensParaAGestora(): Promise<Map<string, OrigemNaGestora>> {
  const mapa = new Map<string, OrigemNaGestora>();
  await garantirTabelaDosComprovativos().catch(() => {});
  const [pags, cobs, negs] = await Promise.all([
    lerSemFalhar(
      `SELECT id, metodo, referencia, entidade, trid, transacaoId, contaDeDestino
         FROM pagamentos WHERE estado = 'pago' AND pagoEm IS NOT NULL`,
      [],
    ),
    lerSemFalhar(
      `SELECT id, metodo, contaDeDestino FROM cobrancasAoProfissional WHERE activa = 1 AND pagamentoId IS NULL`,
      [],
    ),
    lerSemFalhar(`SELECT id FROM negociacoes WHERE pagoEm IS NOT NULL`, []),
  ]);
  const provas = await comprovativosDosAlvos([
    ...pags.map((p) => ({ alvo: "pagamento" as const, alvoId: Number(p.id) })),
    ...cobs.map((c) => ({ alvo: "cobranca" as const, alvoId: Number(c.id) })),
    ...negs.map((n) => ({ alvo: "pago_ao_profissional" as const, alvoId: Number(n.id) })),
  ]);
  const por = (k: string, o: ReturnType<typeof origemDoPagamento>) => {
    const comprovativos = provas.get(k) ?? [];
    mapa.set(k, { chave: o.chave, rotulo: o.rotulo, detalhe: o.detalhe, comprovativos, semComprovativo: semComprovativo({ origem: o, comprovativos }) });
  };
  for (const p of pags) {
    por(
      `pagamento:${p.id}`,
      origemDoPagamento({
        metodo: String(p.metodo ?? ""),
        referencia: (p.referencia as string) ?? null,
        entidade: (p.entidade as string) ?? null,
        trid: (p.trid as string) ?? null,
        transacaoId: (p.transacaoId as string) ?? null,
        contaDeDestino: (p.contaDeDestino as string) ?? null,
      }),
    );
  }
  for (const c of cobs) {
    por(`cobranca:${c.id}`, origemDoPagamento({ metodo: String(c.metodo ?? ""), contaDeDestino: (c.contaDeDestino as string) ?? null }));
  }
  for (const n of negs) {
    const o = origemDoPagamento({ metodo: "transferencia" });
    por(`pago_ao_profissional:${n.id}`, { ...o, rotulo: "Transferência da CLYON", detalhe: null, precisaDeComprovativo: false });
  }
  return mapa;
}

/** A conta onde entrou cada um destes pagamentos (só os que a têm). */
export async function contasDosPagamentos(ids: ReadonlyArray<number>): Promise<Map<number, string>> {
  const mapa = new Map<number, string>();
  const limpos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (limpos.length === 0) return mapa;
  await garantirTabelaDosComprovativos().catch(() => {});
  const l = await lerSemFalhar(
    `SELECT id, contaDeDestino FROM pagamentos WHERE contaDeDestino IS NOT NULL AND id IN (?)`,
    [limpos],
  );
  for (const x of l) mapa.set(Number(x.id), String(x.contaDeDestino));
  return mapa;
}

/** Usado ao registar: o rótulo da conta, direito na linha (dentro da transacção de quem chama, se houver). */
export async function anotarContaDeDestino(
  tabela: "pagamentos" | "cobrancasAoProfissional",
  ids: number[],
  rotulo: string | null,
  ligacao?: { execute: (sql: string, params?: unknown[]) => Promise<unknown> },
): Promise<void> {
  if (!rotulo || ids.length === 0) return;
  // Dentro de uma transacção, quem chama já garantiu a coluna (um ALTER fechava a transacção).
  if (!ligacao) await garantirTabelaDosComprovativos();
  const pool = ligacao ?? (await getPool());
  if (!pool) return;
  for (const id of ids) {
    await pool.execute(`UPDATE ${tabela} SET contaDeDestino = ? WHERE id = ?`, [rotulo.slice(0, 60), id]);
  }
}

