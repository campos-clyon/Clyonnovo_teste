import { appendOrderHistory, getPool, negociacoesDoProfissional, registar, toMySQLDateTime } from "./db";
import { trabalhosDaCarteira } from "./carteira-do-profissional";
import { dividasDe, type DividaNaCarteira } from "./carteira";
import { registarRecebimentoAMao } from "./pagamentos-na-base";
import { configuracaoDoEupago } from "./eupago";
import { METODO_PAGO_AO_PROFISSIONAL } from "./pago-em-mao";
import { garantirTabelaDasCobrancas, origemLida } from "./marcas-da-divida-na-base";
import {
  fraseDaMarcacao,
  fraseDoDesfazer,
  type OrigemDaMarca,
  type ParteDaDivida,
} from "./cobrancas-ao-profissional";

/**
 * AS MARCAS DAS PARTES DA DÍVIDA, NA BASE — 11-11-2026 (dono). A regra está em
 * `cobrancas-ao-profissional.ts`; aqui só se lê e escreve.
 *
 * Uma linha por parte marcada. `activa` é 1 enquanto vale e NULL depois de
 * desfeita — o índice único (negociacaoId, parte, activa) impede a mesma parte
 * de ficar marcada duas vezes (dois cliques, duas pessoas), e deixa as
 * desfeitas ficar como história. Nada se apaga.
 */

const CHAVE_REPETIDA = "ER_DUP_ENTRY";
const aosCentimos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type DividaDoProfissionalComPedido = DividaNaCarteira & {
  providerId: number;
  pedidoId: number | null;
  cliente: string | null;
  servico: string | null;
};

/**
 * AS DÍVIDAS DE UM PROFISSIONAL, como a carteira dele as lê — a MESMA conta
 * para o separador «A receber dos profissionais», as Carteiras, o bloqueio e a
 * carteira dele (`trabalhosDaCarteira` + `dividasDe`).
 */
export async function dividasDoProfissional(
  providerId: number,
  agora: Date = new Date(),
): Promise<DividaDoProfissionalComPedido[]> {
  const linhas = await negociacoesDoProfissional(providerId);
  const trabalhos = await trabalhosDaCarteira(linhas);
  return dividasDe(trabalhos, agora).map((d) => {
    const l = linhas.find((x) => Number(x.id) === d.negociacaoId);
    return {
      ...d,
      providerId,
      pedidoId: l?.pedidoId != null ? Number(l.pedidoId) : null,
      cliente: ((l?.contactName as string | null) ?? "").trim() || null,
      servico: (l?.serviceType as string | null) ?? null,
    };
  });
}

/**
 * QUEM PODE TER DÍVIDA — os profissionais com trabalhos combinados em dinheiro
 * ou registados «pago ao profissional». Só pré-filtra: quem deve, e quanto,
 * decide-o `dividasDe`.
 */
export async function profissionaisComDividaPossivel(): Promise<number[]> {
  const pool = await getPool();
  if (!pool) return [];
  try {
    const [linhas] = (await pool.execute(
      `SELECT DISTINCT n.providerId
         FROM negociacoes n
        WHERE n.estado = 'acordada' AND n.providerId IS NOT NULL
          AND (n.formaDePagamento = 'dinheiro'
               OR EXISTS (SELECT 1 FROM pagamentos p
                           WHERE p.negociacaoId = n.id AND p.estado = 'pago' AND p.metodo = ?))`,
      [METODO_PAGO_AO_PROFISSIONAL],
    )) as [Array<{ providerId: number }>, unknown];
    return linhas.map((l) => Number(l.providerId)).filter((n) => Number.isInteger(n) && n > 0);
  } catch (e) {
    if ((e as { code?: string })?.code === "ER_NO_SUCH_TABLE") return [];
    throw e;
  }
}

/** As dívidas destes profissionais (ou de todos os que podem ter), por profissional. */
export async function dividasDosProfissionais(
  providerIds?: number[],
  agora: Date = new Date(),
): Promise<Map<number, DividaDoProfissionalComPedido[]>> {
  const ids = providerIds ?? (await profissionaisComDividaPossivel());
  const mapa = new Map<number, DividaDoProfissionalComPedido[]>();
  for (const pid of [...new Set(ids)]) {
    const dividas = await dividasDoProfissional(pid, agora);
    if (dividas.length > 0) mapa.set(pid, dividas);
  }
  return mapa;
}

/* ─────────────────────────────── Escrever ─────────────────────────────── */

type Resultado =
  | { ok: true; frase: string; fechou: boolean; pagamentoId: number | null }
  | { ok: false; porque: string; status: number };

async function gravarMarca(m: {
  negociacaoId: number;
  providerId: number;
  pedidoId: number | null;
  parte: ParteDaDivida;
  valor: number;
  pagoEm: Date;
  metodo: string;
  nota: string | null;
  marcadoPor: string;
  origem: OrigemDaMarca;
  pagamentoId: number | null;
}): Promise<number | null> {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  try {
    const [r] = (await pool.execute(
      `INSERT INTO cobrancasAoProfissional
         (negociacaoId, providerId, pedidoId, parte, valor, pagoEm, metodo, nota, marcadoPor, origem, pagamentoId, activa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        m.negociacaoId,
        m.providerId,
        m.pedidoId,
        m.parte,
        aosCentimos(m.valor),
        toMySQLDateTime(m.pagoEm),
        m.metodo.slice(0, 20),
        m.nota ? m.nota.slice(0, 255) : null,
        m.marcadoPor.slice(0, 120),
        m.origem,
        m.pagamentoId,
      ],
    )) as [{ insertId?: number }, unknown];
    return Number(r?.insertId ?? 0) || null;
  } catch (e) {
    if ((e as { code?: string })?.code === CHAVE_REPETIDA) return null;
    throw e;
  }
}

/**
 * AS MARCAS DE UM PAGAMENTO QUE FECHOU A DÍVIDA INTEIRA (um bloco, um
 * abatimento) — para cada parte que ainda estava pendente, com a linha de
 * `pagamentos` que tem o dinheiro. Uma parte já marcada fica como está (o
 * índice único). Nunca lança: a linha de `pagamentos` já fechou a dívida, e o
 * estado das partes deriva dela na mesma.
 */
export async function marcarPartesCobertas(d: {
  divida: Pick<DividaNaCarteira, "negociacaoId" | "partes">;
  providerId: number;
  pedidoId: number | null;
  partes?: ParteDaDivida[];
  metodo: string;
  quando: Date;
  nota?: string | null;
  quem: string;
  origem: OrigemDaMarca;
  pagamentoId: number | null;
}): Promise<void> {
  try {
    await garantirTabelaDasCobrancas();
    for (const p of d.divida.partes) {
      if (p.paga) continue;
      if (d.partes && !d.partes.includes(p.parte)) continue;
      await gravarMarca({
        negociacaoId: d.divida.negociacaoId,
        providerId: d.providerId,
        pedidoId: d.pedidoId,
        parte: p.parte,
        valor: p.valor,
        pagoEm: d.quando,
        metodo: d.metodo,
        nota: d.nota ?? null,
        marcadoPor: d.quem,
        origem: d.origem,
        pagamentoId: d.pagamentoId,
      });
    }
  } catch (e) {
    console.error("[cobrancas-na-base] não marquei as partes cobertas:", e);
  }
}

/**
 * MARCAR O IVA, A TAXA, OU OS DOIS COMO PAGOS — o separador «A receber dos
 * profissionais» (e o bloco que cobre só o IVA de uma dívida).
 *
 * Se com estas já não fica nada pendente, nasce a linha de `pagamentos` que
 * fecha a dívida, com o valor só do que se marcou agora (o que se marcou antes
 * já está contado). Senão, as referências vivas da dívida deixam de se
 * oferecer — eram do valor inteiro, e o profissional pede outra do que falta.
 */
export async function marcarPartes(d: {
  negociacaoId: number;
  partes: ParteDaDivida[];
  metodo: string;
  quando: Date;
  nota: string | null;
  quem: string;
  origem?: OrigemDaMarca;
  agora?: Date;
}): Promise<Resultado> {
  const pool = await getPool();
  if (!pool) return { ok: false, porque: "Base de dados indisponível.", status: 503 };
  await garantirTabelaDasCobrancas();

  const [neg] = (await pool.execute(`SELECT providerId, pedidoId FROM negociacoes WHERE id = ? LIMIT 1`, [
    d.negociacaoId,
  ])) as [Array<{ providerId: number | null; pedidoId: number | null }>, unknown];
  const providerId = Number(neg[0]?.providerId ?? 0);
  if (!providerId) return { ok: false, porque: "Trabalho não encontrado.", status: 404 };
  const pedidoId = neg[0]?.pedidoId != null ? Number(neg[0].pedidoId) : null;

  const agora = d.agora ?? new Date();
  const divida = (await dividasDoProfissional(providerId, agora)).find((x) => x.negociacaoId === d.negociacaoId);
  if (!divida) {
    return {
      ok: false,
      porque: "Este trabalho não tem nada a pagar pelo profissional (ou ainda não está dado por feito).",
      status: 409,
    };
  }
  if (divida.paga) return { ok: false, porque: "A dívida deste trabalho já está paga.", status: 409 };

  const aMarcar = divida.partes.filter((p) => !p.paga && d.partes.includes(p.parte));
  if (aMarcar.length === 0) return { ok: false, porque: "Essas partes já estão pagas.", status: 409 };
  const faltam = divida.partes.filter((p) => !p.paga && !d.partes.includes(p.parte));
  const fecha = faltam.length === 0;
  const origem = d.origem ?? "marcacao";

  // As marcas primeiro: o índice único é que diz se outra pessoa marcou entretanto.
  const feitas: number[] = [];
  for (const p of aMarcar) {
    const id = await gravarMarca({
      negociacaoId: d.negociacaoId,
      providerId,
      pedidoId,
      parte: p.parte,
      valor: p.valor,
      pagoEm: d.quando,
      metodo: d.metodo,
      nota: d.nota,
      marcadoPor: d.quem,
      origem,
      pagamentoId: null,
    });
    if (id == null) {
      if (feitas.length > 0) {
        await pool.query(`DELETE FROM cobrancasAoProfissional WHERE id IN (?)`, [feitas]);
      }
      return { ok: false, porque: "Esta parte foi marcada entretanto. Recarregue a página.", status: 409 };
    }
    feitas.push(id);
  }

  const valor = aosCentimos(aMarcar.reduce((s, p) => s + p.valor, 0));
  let pagamentoId: number | null = null;
  if (fecha) {
    const conf = configuracaoDoEupago(process.env);
    const r = await registarRecebimentoAMao({
      negociacaoId: d.negociacaoId,
      pedidoId: pedidoId ?? 0,
      providerId,
      metodo: d.metodo,
      valor,
      quando: d.quando,
      ambiente: conf.ok ? conf.config.ambiente : "producao",
      aParte: divida.aParte === true,
    });
    if (!r.feito) {
      await pool.query(`DELETE FROM cobrancasAoProfissional WHERE id IN (?)`, [feitas]);
      return { ok: false, porque: "A dívida foi paga entretanto por outro caminho. Recarregue a página.", status: 409 };
    }
    pagamentoId = r.pagamentoId ?? null;
    if (pagamentoId) {
      await pool.query(`UPDATE cobrancasAoProfissional SET pagamentoId = ? WHERE id IN (?)`, [pagamentoId, feitas]);
    }
  } else {
    await pool.execute(
      `UPDATE pagamentos SET estado = 'substituido'
        WHERE negociacaoId = ? AND estado = 'pendente' AND parte = ?`,
      [d.negociacaoId, divida.aParte ? "divida" : "trabalho"],
    );
  }

  const frase = fraseDaMarcacao({
    partes: aMarcar.map((p) => ({ parte: p.parte, valor: p.valor })),
    pedidoId,
    metodo: d.metodo,
    quando: d.quando,
    faltam: faltam.map((p) => ({ parte: p.parte, valor: p.valor })),
  });
  const comNota = frase + (d.nota ? ` Nota: ${d.nota}` : "");
  await registar({
    acontecimento: "parte_da_divida_paga",
    pedidoId,
    negociacaoId: d.negociacaoId,
    providerId,
    autorTipo: "clyon",
    autorNome: d.quem,
    valor,
    resumo: comNota,
    detalhe: {
      partes: aMarcar.map((p) => ({ parte: p.parte, valor: p.valor })),
      metodo: d.metodo,
      origem,
      pagoEm: d.quando.toISOString(),
      pagamentoId,
      marcas: feitas,
      nota: d.nota,
    },
    visivelProfissional: true,
  });
  if (pedidoId != null) {
    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message: `${comNota} Registado por ${d.quem}.`,
    }).catch(() => {});
  }
  return { ok: true, frase, fechou: fecha, pagamentoId };
}

/**
 * DESFAZER A MARCA DE UMA PARTE — só o administrador, e com motivo.
 *
 * Só se desfaz o que a equipa marcou (ou um bloco que não fechou a dívida). Se
 * essa marca fechou a dívida, a linha de `pagamentos` que nasceu com ela fica
 * cancelada (não se apaga) e as outras partes que ela levava ficam marcadas
 * por si, com o seu dinheiro. Uma dívida fechada por uma referência, um
 * abatimento ou um pagamento registado noutro sítio corrige-se lá.
 */
export async function desfazerParte(d: {
  negociacaoId: number;
  parte: ParteDaDivida;
  motivo: string;
  quem: string;
}): Promise<Resultado> {
  const pool = await getPool();
  if (!pool) return { ok: false, porque: "Base de dados indisponível.", status: 503 };
  await garantirTabelaDasCobrancas();

  const [ms] = (await pool.execute(
    `SELECT id, providerId, pedidoId, valor, origem, pagamentoId
       FROM cobrancasAoProfissional
      WHERE negociacaoId = ? AND parte = ? AND activa = 1 LIMIT 1`,
    [d.negociacaoId, d.parte],
  )) as [Array<Record<string, unknown>>, unknown];
  const m = ms[0];
  if (!m) {
    return {
      ok: false,
      porque:
        "Esta parte não foi marcada aqui: foi paga com a dívida inteira (referência, abatimento no saldo ou " +
        "pagamento registado). Corrige-se nos Pagamentos.",
      status: 409,
    };
  }
  const pagamentoId = m.pagamentoId != null ? Number(m.pagamentoId) : null;
  if (pagamentoId != null && origemLida(m.origem) !== "marcacao") {
    return {
      ok: false,
      porque: `Esta parte foi paga pelo pagamento #${pagamentoId}, que fechou a dívida inteira. Corrige-se nos Pagamentos.`,
      status: 409,
    };
  }

  const motivo = d.motivo.trim().slice(0, 200);
  const agora = new Date();
  if (pagamentoId != null) {
    const [r] = (await pool.execute(
      `UPDATE pagamentos
          SET estado = 'cancelado', negociacaoPaga = NULL, trid = NULL, erro = ?
        WHERE id = ? AND estado = 'pago'`,
      [`Desfeito por ${d.quem}: ${motivo}`.slice(0, 255), pagamentoId],
    )) as [{ affectedRows?: number }, unknown];
    if (Number(r?.affectedRows ?? 0) !== 1) {
      return { ok: false, porque: "O pagamento desta marca mudou entretanto. Recarregue a página.", status: 409 };
    }
    // As outras partes que este pagamento levava ficam pagas por si.
    await pool.execute(
      `UPDATE cobrancasAoProfissional SET pagamentoId = NULL WHERE pagamentoId = ? AND activa = 1 AND id <> ?`,
      [pagamentoId, Number(m.id)],
    );
  }
  await pool.execute(
    `UPDATE cobrancasAoProfissional
        SET activa = NULL, desfeitoEm = ?, desfeitoPor = ?, motivoDesfeito = ?
      WHERE id = ? AND activa = 1`,
    [toMySQLDateTime(agora), d.quem.slice(0, 120), motivo || null, Number(m.id)],
  );

  const pedidoId = m.pedidoId != null ? Number(m.pedidoId) : null;
  const valor = Number(m.valor);
  const frase = fraseDoDesfazer({ parte: d.parte, valor, pedidoId, motivo });
  await registar({
    acontecimento: "parte_da_divida_desfeita",
    pedidoId,
    negociacaoId: d.negociacaoId,
    providerId: Number(m.providerId),
    autorTipo: "clyon",
    autorNome: d.quem,
    valor,
    resumo: frase,
    detalhe: { marca: Number(m.id), parte: d.parte, pagamentoCancelado: pagamentoId, motivo },
    visivelProfissional: true,
  });
  if (pedidoId != null) {
    await appendOrderHistory(pedidoId, { type: "created", by: null, message: `${frase} Por ${d.quem}.` }).catch(
      () => {},
    );
  }
  return { ok: true, frase, fechou: false, pagamentoId };
}

