/**
 * A VALIDADE DOS ORÇAMENTOS, NA BASE — d62 (CEO e dono, 18-11-2026).
 *
 * As regras puras estão em `validade-do-orcamento.ts`. Aqui:
 *
 *  - o interruptor «Validade dos orçamentos» (Configs), na tabela dos
 *    interruptores (`retencaoInterruptores`), DESLIGADO por omissão e na dúvida;
 *  - `validadeDosOrcamentos` — uma linha por pedido, com o ciclo (de onde conta,
 *    o que já saiu, se parou ou fechou) e o passo por enviar. Nada de dados de
 *    pessoas: o telefone e o nome lêem-se do pedido no momento de enviar;
 *  - `validadeDosOrcamentosVez` — o carimbo «o próximo pode sair a partir de…»,
 *    20 a 45 s entre WhatsApp, como as outras filas;
 *  - a rotina (`/api/cron/validade-dos-orcamentos`, de hora a hora) que decide o
 *    passo de cada pedido e o põe na fila; a passagem (às rondas da ponte) que
 *    envia UM de cada vez, das 9h às 21h de Lisboa;
 *  - o que a Vitória faz com o «1», o «2» e o «3» (chamado por
 *    `whatsapp-negociacao.ts`), e o «Lembrar agora» da Mesa.
 *
 * Com o interruptor desligado, nada sai e nada fecha. Nunca DELETE de pedidos:
 * fechar é arquivar; «já não preciso» cancela e anonimiza (`anonimizarPedido`).
 */

import {
  appendOrderHistory,
  ensureNegociacoesTable,
  ensureRegistoTable,
  ensureSimulatorOrdersTable,
  getPool,
  negociacoesDoPedido,
  registarNaTransaccao,
  registarSemFalhar,
} from "./db";
import {
  clienteRespondeuNoCiclo,
  jaFalouHoje,
  linhaDaMesa,
  melhorProposta,
  naJanelaDaValidade,
  NOME_DO_INTERRUPTOR_DA_VALIDADE,
  proximoPasso,
  rotuloDoLembrarAgora,
  textoDoFechoAoCliente,
  textoDoLembrete,
  textoDoUltimoAviso,
  type CicloDoOrcamento,
  type PassoDaValidade,
  type PropostaCandidata,
} from "./validade-do-orcamento";

/* ── O interruptor (Configs) — DESLIGADO por omissão ─────────────────────── */

export const CHAVE_DA_VALIDADE_DOS_ORCAMENTOS = "validade_orcamentos_d62";

export type InterruptorDaValidade = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

type Pool = NonNullable<Awaited<ReturnType<typeof getPool>>>;

let tabelasProntas = false;

export const SQL_DAS_TABELAS_DA_VALIDADE = [
  `CREATE TABLE IF NOT EXISTS retencaoInterruptores (
      chave     VARCHAR(40) NOT NULL PRIMARY KEY,
      ligado    TINYINT(1) NOT NULL DEFAULT 0,
      mudadoEm  DATETIME NULL DEFAULT NULL,
      porQuem   VARCHAR(120) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS validadeDosOrcamentos (
      pedidoId        INT UNSIGNED NOT NULL PRIMARY KEY,
      versao          DATETIME NOT NULL,
      desde           DATETIME NOT NULL,
      reaberto        TINYINT(1) NOT NULL DEFAULT 0,
      lembrete1Em     DATETIME NULL DEFAULT NULL,
      ultimoAvisoEm   DATETIME NULL DEFAULT NULL,
      fechadoEm       DATETIME NULL DEFAULT NULL,
      paradoEm        DATETIME NULL DEFAULT NULL,
      paradoPorque    VARCHAR(160) NULL DEFAULT NULL,
      porEnviar       VARCHAR(16) NULL DEFAULT NULL,
      porEnviarDesde  DATETIME NULL DEFAULT NULL,
      negociacaoId    INT UNSIGNED NULL DEFAULT NULL,
      ultimaFalha     VARCHAR(160) NULL DEFAULT NULL,
      KEY idx_validade_por_enviar (porEnviar, porEnviarDesde)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS validadeDosOrcamentosVez (
      id        TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      proximoEm DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

async function garantirTabelas(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("[validade-do-orcamento] base de dados indisponível");
  if (!tabelasProntas) {
    for (const sql of SQL_DAS_TABELAS_DA_VALIDADE) await pool.execute(sql);
    await pool.execute("INSERT IGNORE INTO validadeDosOrcamentosVez (id, proximoEm) VALUES (1, '2000-01-01 00:00:00')");
    tabelasProntas = true;
  }
  return pool;
}

/** DESLIGADO NA DÚVIDA: sem linha, sem tabela, ou com a base a falhar. */
export async function interruptorDaValidade(): Promise<InterruptorDaValidade> {
  const desligado: InterruptorDaValidade = { ligado: false, mudadoEm: null, porQuem: null };
  try {
    const pool = await garantirTabelas();
    const [rows] = (await pool.execute(
      "SELECT ligado, mudadoEm, porQuem FROM retencaoInterruptores WHERE chave = ? LIMIT 1",
      [CHAVE_DA_VALIDADE_DOS_ORCAMENTOS],
    )) as [Array<{ ligado: number; mudadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = rows[0];
    if (!l) return desligado;
    return {
      ligado: Number(l.ligado) === 1,
      mudadoEm: l.mudadoEm ? new Date(l.mudadoEm).toISOString() : null,
      porQuem: l.porQuem ?? null,
    };
  } catch (e) {
    console.error("[validade-do-orcamento] não li o interruptor — fica desligado:", e instanceof Error ? e.message : e);
    return desligado;
  }
}

/** Liga ou desliga; a mudança e quem a fez ficam no registo permanente, na mesma transacção. */
export async function mudarInterruptorDaValidade(ligar: boolean, porQuem: string): Promise<InterruptorDaValidade> {
  const pool = await garantirTabelas();
  await ensureRegistoTable();
  const antes = await interruptorDaValidade();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE ligado = VALUES(ligado), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
      [CHAVE_DA_VALIDADE_DOS_ORCAMENTOS, ligar ? 1 : 0, porQuem.slice(0, 120)],
    );
    await registarNaTransaccao(conn, {
      acontecimento: "validade_orcamentos_interruptor",
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: antes.ligado ? "ligado" : "desligado",
      estadoDepois: ligar ? "ligado" : "desligado",
      resumo: `«${NOME_DO_INTERRUPTOR_DA_VALIDADE}» ${ligar ? "LIGADO" : "DESLIGADO"} por ${porQuem} (d62).`,
    });
    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* já houve rollback */
    }
    throw e;
  } finally {
    conn.release();
  }
  return interruptorDaValidade();
}

/* ── O ciclo de cada pedido ──────────────────────────────────────────────── */

type LinhaDoCiclo = CicloDoOrcamento & {
  pedidoId: number;
  versao: Date;
  reaberto: boolean;
  porEnviar: PassoDaValidade | null;
  negociacaoId: number | null;
};

const data = (v: unknown): Date | null => {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
};

function lerLinha(l: Record<string, unknown>): LinhaDoCiclo {
  const passo = String(l.porEnviar ?? "");
  return {
    pedidoId: Number(l.pedidoId),
    versao: data(l.versao) ?? new Date(0),
    desde: data(l.desde) ?? new Date(0),
    reaberto: Number(l.reaberto) === 1,
    lembrete1Em: data(l.lembrete1Em),
    ultimoAvisoEm: data(l.ultimoAvisoEm),
    fechadoEm: data(l.fechadoEm),
    paradoEm: data(l.paradoEm),
    porEnviar: passo === "lembrete1" || passo === "ultimo_aviso" || passo === "fechar" ? passo : null,
    negociacaoId: l.negociacaoId == null ? null : Number(l.negociacaoId),
  };
}

async function ciclosDosPedidos(pool: Pool, ids: number[]): Promise<Map<number, LinhaDoCiclo>> {
  const m = new Map<number, LinhaDoCiclo>();
  const limpos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (limpos.length === 0) return m;
  const [rows] = (await pool.execute(
    `SELECT * FROM validadeDosOrcamentos WHERE pedidoId IN (${limpos.map(() => "?").join(",")})`,
    limpos,
  )) as [Array<Record<string, unknown>>, unknown];
  for (const r of rows) m.set(Number(r.pedidoId), lerLinha(r));
  return m;
}

/** O pedido à espera do cliente, como a rotina o lê. */
type PedidoAEspera = {
  id: number;
  eClyon: boolean;
  propostaEnviadaEm: Date;
  precoAceiteEm: Date | null;
  valorFixoClyon: number | null;
  taxaClyon: number | null;
  precoClienteClyon: number | null;
  valorUnicoCliente: number | null;
  serviceType: string | null;
  contactName: string | null;
  contactPhone: string | null;
  baseDoPreco: string | null;
};

const numeroOuNull = (v: unknown) => (v == null || v === "" ? null : Number(v));

/** Os pedidos com o orçamento no cliente e ainda na mesa — larga; quem decide é `oQueOClienteTem`. */
async function pedidosComOOrcamentoNoCliente(pool: Pool, ids?: number[]): Promise<PedidoAEspera[]> {
  await ensureSimulatorOrdersTable();
  await ensureNegociacoesTable();
  const filtro = ids && ids.length ? `AND o.id IN (${ids.map(() => "?").join(",")})` : "";
  const [rows] = (await pool.execute(
    `SELECT o.id, o.propostaEnviadaEm, o.precoAceiteEm, o.valorFixoClyon, o.taxaClyon, o.precoClienteClyon,
            o.valorUnicoCliente, o.serviceType, o.contactName, o.contactPhone, o.baseDoPreco
       FROM simulatorOrders o
      WHERE o.propostaEnviadaEm IS NOT NULL
        AND o.anonimizadoEm IS NULL
        AND (o.status IS NULL OR o.status NOT IN ('arquivado', 'cancelado', 'concluido', 'rejeitado'))
        AND NOT EXISTS (SELECT 1 FROM negociacoes n WHERE n.pedidoId = o.id AND n.estado = 'acordada')
        ${filtro}
      ORDER BY o.id ASC
      LIMIT 300`,
    ids && ids.length ? ids : [],
  )) as [Array<Record<string, unknown>>, unknown];
  return rows.map((r) => ({
    id: Number(r.id),
    eClyon: r.valorFixoClyon != null,
    propostaEnviadaEm: data(r.propostaEnviadaEm) ?? new Date(0),
    precoAceiteEm: data(r.precoAceiteEm),
    valorFixoClyon: numeroOuNull(r.valorFixoClyon),
    taxaClyon: numeroOuNull(r.taxaClyon),
    precoClienteClyon: numeroOuNull(r.precoClienteClyon),
    valorUnicoCliente: numeroOuNull(r.valorUnicoCliente),
    serviceType: (r.serviceType as string | null) ?? null,
    contactName: (r.contactName as string | null) ?? null,
    contactPhone: (r.contactPhone as string | null) ?? null,
    baseDoPreco: (r.baseDoPreco as string | null) ?? null,
  }));
}

/** O que o cliente tem em cima da mesa — ou null (não está à espera dele). */
export type OQueOClienteTem = {
  proposta: PropostaCandidata;
  /** Num valor único, o aceite é da equipa (escolhe ela o parceiro). */
  valorUnico: boolean;
};

/**
 * ESTE PEDIDO ESTÁ MESMO À ESPERA DO CLIENTE? E COM QUE PROPOSTA? A mesma
 * pergunta da Mesa («A aguardar cliente»), feita à base:
 *
 *   · Trabalho CLYON: o preço foi, ninguém o aceitou ainda, e há quem tenha
 *     aceitado fazê-lo («aguarda_contratacao») — é desses o parceiro;
 *   · valor único: o valor foi, e o cliente ainda não o aceitou;
 *   · negociação: nenhuma proposta chegou depois do envio, e há propostas.
 */
async function oQueOClienteTem(p: PedidoAEspera): Promise<OQueOClienteTem | null> {
  const negs = await negociacoesDoPedido(p.id);
  const { parceirosParaOValorUnico } = await import("./db");
  const nota = async (providerIds: number[]) =>
    parceirosParaOValorUnico(providerIds).catch(() => new Map<number, { nota: { media: number; quantas: number } | null }>());

  if (p.eClyon) {
    if (p.precoAceiteEm) return null;
    const { precoDaPropostaClyon } = await import("./proposta-clyon-ao-cliente");
    const preco = precoDaPropostaClyon({
      valorFixo: Number(p.valorFixoClyon),
      taxa: p.taxaClyon,
      precoAoCliente: p.precoClienteClyon,
    });
    if (!preco) return null;
    const aceitaram = negs.filter((n) => n.estado === "aguarda_contratacao");
    if (aceitaram.length === 0) return null;
    const notas = await nota(aceitaram.map((n) => Number(n.providerId)));
    const escolhida = melhorProposta(
      aceitaram.map((n) => ({
        negociacaoId: Number(n.id),
        parceiro: String(n.profissionalNome ?? "").trim() || null,
        semIva: preco.semIva,
        total: preco.total,
        nota: notas.get(Number(n.providerId))?.nota ?? null,
      })),
    );
    return escolhida ? { proposta: escolhida, valorUnico: false } : null;
  }

  if (p.valorUnicoCliente != null) {
    const { aceitesDoValorUnico } = await import("./valor-unico-no-whatsapp-na-base");
    const aceites = await aceitesDoValorUnico([p.id]).catch(() => new Map());
    if (aceites.has(p.id)) return null;
    const { totalDoValorUnico } = await import("./valor-unico-ao-cliente");
    return {
      proposta: {
        negociacaoId: null,
        parceiro: null,
        semIva: p.valorUnicoCliente,
        total: totalDoValorUnico(p.valorUnicoCliente),
        nota: null,
      },
      valorUnico: true,
    };
  }

  // Uma proposta que chegou depois do envio é uma que o cliente não viu (`orcamentoEnviadoCobre`).
  const enviado = p.propostaEnviadaEm.getTime();
  const lerPropostas = (j: unknown): Array<{ por?: string; criadaEm?: string }> => {
    try {
      const l = JSON.parse(String(j ?? "[]"));
      return Array.isArray(l) ? l : [];
    } catch {
      return [];
    }
  };
  const depois = negs.some((n) =>
    lerPropostas(n.propostasJson).some((x) => x.por === "profissional" && x.criadaEm && new Date(x.criadaEm).getTime() > enviado),
  );
  if (depois) return null;

  const { propostasParaOCliente } = await import("./mensagem-das-propostas");
  const { negociacoesNoNovoModelo, regimesDasNegociacoes } = await import("./novo-modelo-no-servidor");
  const { agoraDoModelo } = await import("./relogio-do-modelo");
  const doNovo = await negociacoesNoNovoModelo(negs as never, agoraDoModelo()).catch(() => new Set<number>());
  const regimes = await regimesDasNegociacoes([...doNovo]).catch(() => new Map());
  const propostas = propostasParaOCliente(
    negs.map((n) => ({
      id: Number(n.id),
      estado: String(n.estado),
      profissionalNome: String(n.profissionalNome ?? ""),
      propostasJson: (n.propostasJson as string | null) ?? null,
      formaDePagamento: (n as { formaDePagamento?: string | null }).formaDePagamento ?? null,
      regimeIva: n.regimeIva ?? null,
      taxaCliente: (n as { taxaCliente?: string | number | null }).taxaCliente ?? null,
      taxaProfissional: (n as { taxaProfissional?: string | number | null }).taxaProfissional ?? null,
      criadaEm: (n as { createdAt?: Date | string | null }).createdAt ?? null,
      materiaisJson: (n as { materiaisJson?: string | null }).materiaisJson ?? null,
      ...(doNovo.has(Number(n.id)) ? { noNovoModelo: true } : {}),
      ...(doNovo.has(Number(n.id)) && regimes.has(Number(n.id)) ? { regimeParaOTotal: regimes.get(Number(n.id)) } : {}),
    })),
  );
  if (propostas.length === 0) return null;
  const providerDe = new Map(negs.map((n) => [Number(n.id), Number(n.providerId)]));
  const notas = await nota([...new Set(propostas.map((x) => providerDe.get(Number(x.negociacaoId)) ?? 0))]);
  const escolhida = melhorProposta(
    propostas.map((x) => ({
      negociacaoId: x.negociacaoId ?? null,
      parceiro: x.profissional?.trim() || null,
      semIva: x.semIva,
      total: x.total,
      nota: notas.get(providerDe.get(Number(x.negociacaoId)) ?? 0)?.nota ?? null,
    })),
  );
  return escolhida ? { proposta: escolhida, valorUnico: false } : null;
}

/** O ciclo de cada pedido: cria-o, ou recomeça-o (orçamento enviado de novo, ou pedido reaberto). */
async function cicloEmDia(pool: Pool, p: PedidoAEspera, antes: LinhaDoCiclo | undefined, agora: Date): Promise<LinhaDoCiclo> {
  const versaoMudou = !antes || Math.abs(antes.versao.getTime() - p.propostaEnviadaEm.getTime()) > 1000;
  // Reaberto: o ciclo tinha fechado, e o pedido voltou a estar à espera do cliente — recomeça do zero, a contar de agora.
  const reaberto = !versaoMudou && antes?.fechadoEm != null;
  if (!versaoMudou && !reaberto) return antes!;
  const desde = reaberto ? agora : p.propostaEnviadaEm;
  await pool.execute(
    `INSERT INTO validadeDosOrcamentos (pedidoId, versao, desde, reaberto) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE versao = VALUES(versao), desde = VALUES(desde), reaberto = VALUES(reaberto),
       lembrete1Em = NULL, ultimoAvisoEm = NULL, fechadoEm = NULL, paradoEm = NULL, paradoPorque = NULL,
       porEnviar = NULL, porEnviarDesde = NULL, negociacaoId = NULL, ultimaFalha = NULL`,
    [p.id, p.propostaEnviadaEm, desde, reaberto ? 1 : 0],
  );
  return {
    pedidoId: p.id,
    versao: p.propostaEnviadaEm,
    desde,
    reaberto,
    lembrete1Em: null,
    ultimoAvisoEm: null,
    fechadoEm: null,
    paradoEm: null,
    porEnviar: null,
    negociacaoId: null,
  };
}

/** A contagem pára (o cliente respondeu, ou a conversa está com uma pessoa). */
export async function pararOCiclo(pedidoId: number, porque: string): Promise<void> {
  const pool = await garantirTabelas();
  await pool.execute(
    `UPDATE validadeDosOrcamentos SET paradoEm = NOW(), paradoPorque = ?, porEnviar = NULL, porEnviarDesde = NULL
      WHERE pedidoId = ? AND paradoEm IS NULL AND fechadoEm IS NULL`,
    [porque.slice(0, 160), pedidoId],
  );
}

const noveDigitos = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
};

/* ── A rotina: de hora a hora, decide e põe na fila ──────────────────────── */

export type ResultadoDaRotinaDaValidade = {
  ligado: boolean;
  foraDaJanela?: boolean;
  aEspera: number;
  naFila: number;
  parados: number;
  falhados: number;
};

/**
 * Cada pedido à espera do cliente: o ciclo em dia, a contagem parada se ele
 * respondeu, e o passo que toca (no máximo um por telefone e por dia) na fila.
 * Desligado, não faz nada. Falha fechada: sem saber se o cliente respondeu,
 * não põe nada na fila.
 */
export async function rotinaDaValidade(agora: Date = new Date()): Promise<ResultadoDaRotinaDaValidade> {
  const r: ResultadoDaRotinaDaValidade = { ligado: false, aEspera: 0, naFila: 0, parados: 0, falhados: 0 };
  const { ligado } = await interruptorDaValidade();
  if (!ligado) return r;
  r.ligado = true;
  if (!naJanelaDaValidade(agora)) {
    r.foraDaJanela = true;
    return r;
  }
  const pool = await garantirTabelas();
  const pedidos = await pedidosComOOrcamentoNoCliente(pool);
  const ciclos = await ciclosDosPedidos(pool, pedidos.map((p) => p.id));
  const { respostasDoClienteNoWhatsApp } = await import("./db");
  const respostas = await respostasDoClienteNoWhatsApp(pedidos.map((p) => p.contactPhone));

  // Os que estão mesmo à espera, com o ciclo em dia.
  const vivos: Array<{ p: PedidoAEspera; c: LinhaDoCiclo; tel: string }> = [];
  for (const p of pedidos) {
    try {
      const tel = noveDigitos(p.contactPhone);
      if (!tel) continue;
      if (!(await oQueOClienteTem(p))) continue;
      const c = await cicloEmDia(pool, p, ciclos.get(p.id), agora);
      r.aEspera += 1;
      const resp = respostas.get(tel);
      if (!c.paradoEm && clienteRespondeuNoCiclo(c.desde, resp?.ultimaMensagemEm)) {
        await pararOCiclo(p.id, "o cliente respondeu");
        r.parados += 1;
        continue;
      }
      vivos.push({ p, c, tel });
    } catch (e) {
      r.falhados += 1;
      console.error("[validade-do-orcamento] pedido", p.id, e instanceof Error ? e.message : e);
    }
  }

  // Um passo por telefone e por dia — contam os ciclos de todos os pedidos desse telefone.
  const porTelefone = new Map<string, typeof vivos>();
  for (const v of vivos) porTelefone.set(v.tel, [...(porTelefone.get(v.tel) ?? []), v]);
  for (const lista of porTelefone.values()) {
    if (lista.some((v) => v.c.porEnviar)) continue;
    if (jaFalouHoje(lista.map((v) => v.c), agora)) continue;
    for (const v of lista) {
      const passo = proximoPasso(v.c, agora);
      if (!passo) continue;
      const [u] = (await pool.execute(
        `UPDATE validadeDosOrcamentos SET porEnviar = ?, porEnviarDesde = NOW(), ultimaFalha = NULL
          WHERE pedidoId = ? AND porEnviar IS NULL AND paradoEm IS NULL AND fechadoEm IS NULL`,
        [passo, v.p.id],
      )) as [{ affectedRows: number }, unknown];
      if (Number(u.affectedRows) === 1) r.naFila += 1;
      break;
    }
  }
  return r;
}

export function resumoDaRotinaDaValidade(r: ResultadoDaRotinaDaValidade): string | null {
  if (!r.ligado) return "desligado (interruptor «Validade dos orçamentos» nas Configs)";
  if (r.foraDaJanela) return "fora das 9h–21h de Lisboa";
  if (r.naFila === 0 && r.parados === 0 && r.falhados === 0) return null;
  return `${r.aEspera} à espera do cliente · ${r.naFila} passo(s) na fila · ${r.parados} parado(s)` + (r.falhados ? ` · ${r.falhados} falhado(s)` : "");
}

/* ── A passagem: um WhatsApp por vez, às rondas da ponte ─────────────────── */

export type ResultadoDaPassagemDaValidade = "desligado" | "fora-da-janela" | "nada" | "nao-e-a-vez" | "feito" | "falhou";

export async function passagemDaValidade(agora: Date = new Date()): Promise<ResultadoDaPassagemDaValidade> {
  if (!naJanelaDaValidade(agora)) return "fora-da-janela";
  const pool = await garantirTabelas();
  const [proximos] = (await pool.query(
    "SELECT pedidoId, porEnviar FROM validadeDosOrcamentos WHERE porEnviar IS NOT NULL ORDER BY porEnviarDesde ASC LIMIT 1",
  )) as [Array<{ pedidoId: number; porEnviar: string }>, unknown];
  const p = proximos[0];
  if (!p) return "nada";
  if (!(await interruptorDaValidade()).ligado) return "desligado";

  const { intervaloAoAcaso } = await import("./aviso-aos-profissionais");
  const [vez] = (await pool.execute(
    "UPDATE validadeDosOrcamentosVez SET proximoEm = UTC_TIMESTAMP() + INTERVAL ? SECOND WHERE id = 1 AND proximoEm <= UTC_TIMESTAMP()",
    [intervaloAoAcaso()],
  )) as [{ affectedRows: number }, unknown];
  if (Number(vez.affectedRows) !== 1) return "nao-e-a-vez";

  // Reservar: tirar da fila ANTES de enviar. Uma passagem ao mesmo tempo não manda outra vez.
  const [reserva] = (await pool.execute(
    "UPDATE validadeDosOrcamentos SET porEnviar = NULL, porEnviarDesde = NULL WHERE pedidoId = ? AND porEnviar = ?",
    [p.pedidoId, p.porEnviar],
  )) as [{ affectedRows: number }, unknown];
  if (Number(reserva.affectedRows) !== 1) return "nada";

  const passo = p.porEnviar as PassoDaValidade;
  const r = await darOPasso(Number(p.pedidoId), passo, agora, { manual: false });
  if (!r.ok) {
    await pool.execute("UPDATE validadeDosOrcamentos SET ultimaFalha = ? WHERE pedidoId = ?", [r.porque.slice(0, 160), p.pedidoId]);
    return "falhou";
  }
  return "feito";
}

/* ── Dar um passo (a passagem e o «Lembrar agora») ───────────────────────── */

export type ResultadoDoPasso = { ok: true; feito: string } | { ok: false; porque: string };

/**
 * Lê tudo outra vez — o pedido ainda à espera, a resposta do cliente, o ciclo
 * — e só então envia. O lembrete e o último aviso pela porta da Vitória
 * (`enviarTextoWhatsApp`: não fala com números bloqueados nem com conversas
 * entregues a uma pessoa, e não sai em língua errada); o fecho arquiva e avisa.
 */
async function darOPasso(
  pedidoId: number,
  passo: PassoDaValidade,
  agora: Date,
  opcoes: { manual: boolean; porQuem?: string },
): Promise<ResultadoDoPasso> {
  const pool = await garantirTabelas();
  const [p] = await pedidosComOOrcamentoNoCliente(pool, [pedidoId]);
  if (!p) return { ok: false, porque: "o pedido já não está à espera do cliente" };
  const tem = await oQueOClienteTem(p);
  if (!tem) return { ok: false, porque: "o pedido já não está à espera do cliente" };
  const c = (await ciclosDosPedidos(pool, [pedidoId])).get(pedidoId);
  if (!c) return { ok: false, porque: "sem ciclo" };
  const { respostasDoClienteNoWhatsApp } = await import("./db");
  const resp = (await respostasDoClienteNoWhatsApp([p.contactPhone])).get(noveDigitos(p.contactPhone));
  if (clienteRespondeuNoCiclo(c.desde, resp?.ultimaMensagemEm)) {
    await pararOCiclo(pedidoId, "o cliente respondeu");
    return { ok: false, porque: "o cliente respondeu — a contagem parou" };
  }
  if (proximoPasso(c, agora, { manual: opcoes.manual }) !== passo) return { ok: false, porque: "não é a vez deste passo" };

  const telefone = String(p.contactPhone ?? "");
  const { servicoEmPalavras } = await import("./servico-em-palavras");
  const { lerBase } = await import("./base-do-preco");
  const base = lerBase(p.baseDoPreco);
  const dados = {
    pedidoId,
    nome: p.contactName,
    servico: servicoEmPalavras(p.serviceType).toLowerCase(),
    semIva: tem.proposta.semIva,
    total: tem.proposta.total,
    unidade: base === "carga" ? ("carga" as const) : base === "hora" ? ("hora" as const) : null,
    parceiro: tem.proposta.parceiro,
  };
  const quem = opcoes.porQuem ? ` (Lembrar agora, por ${opcoes.porQuem})` : "";

  if (passo === "lembrete1" || passo === "ultimo_aviso") {
    const texto = passo === "lembrete1" ? textoDoLembrete(dados) : textoDoUltimoAviso(dados);
    /*
     * Como o «Enviar pela CLYON»: sai mesmo com a conversa entregue a uma pessoa
     * (é assim que muitos orçamentos saem, do telemóvel da equipa), nunca para
     * um número bloqueado ou com o WhatsApp desligado (`enviarAvisoWhatsApp`), e
     * a conversa volta à Vitória para ela ler o «1», o «2» ou o «3».
     */
    const { enviarAvisoWhatsApp } = await import("./whatsapp-cloud");
    // d63: na língua da conversa do cliente, ou nada (sem tradução, a conversa passa à equipa).
    if (!(await enviarAvisoWhatsApp(telefone, texto, { semLinguaErrada: true }))) {
      return {
        ok: false,
        porque: "o WhatsApp não saiu (número bloqueado, WhatsApp desligado, sem canal, ou sem tradução para a língua do cliente — passou à equipa)",
      };
    }
    const { retomarNumeroWhatsApp } = await import("./db");
    await retomarNumeroWhatsApp(telefone).catch(() => {});
    const coluna = passo === "lembrete1" ? "lembrete1Em" : "ultimoAvisoEm";
    await pool.execute(`UPDATE validadeDosOrcamentos SET ${coluna} = NOW(), negociacaoId = ?, ultimaFalha = NULL WHERE pedidoId = ?`, [
      tem.proposta.negociacaoId,
      pedidoId,
    ]);
    const feito = `${passo === "lembrete1" ? "Lembrete do orçamento" : "Último aviso do orçamento"} enviado ao cliente pelo WhatsApp${quem}.`;
    await appendOrderHistory(pedidoId, { type: "note", by: null, message: feito }).catch(() => {});
    return { ok: true, feito };
  }

  return fecharPorFaltaDeResposta(pedidoId, p, telefone);
}

/** D+4 às 18h: arquivado (nunca apagado), os parceiros com proposta avisados, e o cliente. */
async function fecharPorFaltaDeResposta(pedidoId: number, p: PedidoAEspera, telefone: string): Promise<ResultadoDoPasso> {
  const pool = await garantirTabelas();
  const { updateSimulatorOrder, gravarMotivoDoFecho, perfilDoProfissional, quemTemOTrabalhoClyon } = await import("./db");
  const { avisarProfissionalSemOTrabalhoPorPush } = await import("./avisar-por-push");
  const { textoDoFechoAoParceiro } = await import("./textos-dos-avisos-ao-profissional");

  // Quem tem proposta — lido ANTES de arquivar, que encerra as negociações.
  const negs = await negociacoesDoPedido(pedidoId);
  // Com proposta: num Trabalho CLYON, quem aceitou; numa negociação, quem propôs ou aceitou o valor do cliente.
  const propostaDoPro = (j: unknown) => {
    try {
      const l = JSON.parse(String(j ?? "[]"));
      return Array.isArray(l) && l.some((x: { por?: string }) => x?.por === "profissional");
    } catch {
      return false;
    }
  };
  const comProposta = negs.filter((n) =>
    n.estado === "aguarda_contratacao" ? true : !p.eClyon && n.estado === "aberta" && propostaDoPro(n.propostasJson),
  );
  const ids = new Set(comProposta.map((n) => Number(n.id)));
  const doTrabalhoClyon = p.eClyon ? (await quemTemOTrabalhoClyon(pedidoId)).vivos.filter((q) => ids.has(q.negociacaoId)) : [];

  // Marca primeiro: uma segunda passagem não fecha nem avisa outra vez.
  const [m] = (await pool.execute(
    "UPDATE validadeDosOrcamentos SET fechadoEm = NOW(), porEnviar = NULL WHERE pedidoId = ? AND fechadoEm IS NULL",
    [pedidoId],
  )) as [{ affectedRows: number }, unknown];
  if (Number(m.affectedRows) !== 1) return { ok: false, porque: "já fechado" };

  await updateSimulatorOrder(pedidoId, { status: "arquivado" });
  await gravarMotivoDoFecho(pedidoId, "sem_resposta", null, null).catch(() => {});

  let avisados = 0;
  for (const n of comProposta) {
    try {
      const perfil = await perfilDoProfissional(Number(n.providerId));
      const email = typeof perfil?.email === "string" ? perfil.email : null;
      if (!email) continue;
      await avisarProfissionalSemOTrabalhoPorPush({
        email,
        pedidoId,
        negociacaoId: Number(n.id),
        porque: "fechado_sem_resposta",
      });
      avisados += 1;
    } catch (e) {
      console.error("[validade-do-orcamento] aviso ao parceiro:", e instanceof Error ? e.message : e);
    }
  }
  // Num Trabalho CLYON, a quem aceitou e quer avisos, também no WhatsApp (o canal de sempre deles).
  if (doTrabalhoClyon.length > 0) {
    const { avisarSemEfeitoDoTrabalhoClyon } = await import("./avisar-trabalho-clyon");
    await avisarSemEfeitoDoTrabalhoClyon({
      pedidoId,
      servico: p.serviceType,
      localidade: null,
      quem: doTrabalhoClyon.filter((q) => !q.eraDele),
      texto: textoDoFechoAoParceiro(pedidoId),
    }).catch(() => 0);
  }

  const saiu = await (await import("./whatsapp-cloud")).enviarAvisoWhatsApp(telefone, textoDoFechoAoCliente(pedidoId), { semLinguaErrada: true }).catch(() => false);

  const resumo =
    `Fechado sozinho por falta de resposta (validade do orçamento): o orçamento foi ao cliente, com lembrete e último aviso, sem resposta. ` +
    `${comProposta.length} parceiro(s) com proposta avisado(s) (${avisados} no telemóvel); ` +
    `${saiu ? "o cliente foi avisado pelo WhatsApp" : "o aviso ao cliente não saiu"}.`;
  await appendOrderHistory(pedidoId, { type: "archived", by: null, message: resumo }).catch(() => {});
  await registarSemFalhar({
    acontecimento: "negociacao_encerrada",
    pedidoId,
    autorTipo: "sistema",
    autorNome: "validade do orçamento",
    resumo,
  });
  return { ok: true, feito: resumo };
}

/* ── O «Lembrar agora» da Mesa ───────────────────────────────────────────── */

/** O próximo lembrete, já, fora das horas da rotina — uma vez. Só com o interruptor ligado. */
export async function lembrarAgora(pedidoId: number, porQuem: string, agora: Date = new Date()): Promise<ResultadoDoPasso> {
  if (!(await interruptorDaValidade()).ligado) {
    return { ok: false, porque: "O interruptor «Validade dos orçamentos» está desligado nas Configs: nada sai." };
  }
  const pool = await garantirTabelas();
  const [p] = await pedidosComOOrcamentoNoCliente(pool, [pedidoId]);
  if (!p || !(await oQueOClienteTem(p))) return { ok: false, porque: "Este pedido já não está à espera do cliente." };
  const c = await cicloEmDia(pool, p, (await ciclosDosPedidos(pool, [pedidoId])).get(pedidoId), agora);
  const passo = proximoPasso(c, agora, { manual: true });
  if (passo !== "lembrete1" && passo !== "ultimo_aviso") {
    return { ok: false, porque: "Não há lembrete por enviar hoje (já saiu um hoje, ou já saíram os dois)." };
  }
  // Tira-o da fila, se lá estava: sai agora, uma vez.
  await pool.execute("UPDATE validadeDosOrcamentos SET porEnviar = NULL, porEnviarDesde = NULL WHERE pedidoId = ?", [pedidoId]);
  return darOPasso(pedidoId, passo, agora, { manual: true, porQuem });
}

/* ── A Mesa ──────────────────────────────────────────────────────────────── */

export type ValidadeNaMesa = {
  pedidoId: number;
  linha: string;
  /** O rótulo do botão «Lembrar agora», ou null (sem botão). */
  lembrar: string | null;
  /** O cliente respondeu: a contagem parou e o pedido é connosco («Precisa de si»). */
  parado: boolean;
  /** O que falhou da última vez, se falhou. */
  falha: string | null;
};

/**
 * O passo de cada pedido com o orçamento no cliente, para os cartões de «A
 * aguardar cliente». Só leitura: com o ciclo ainda por criar, conta-se do envio.
 */
export async function validadeNaMesa(agora: Date = new Date()): Promise<{ ligado: boolean; pedidos: ValidadeNaMesa[] }> {
  const { ligado } = await interruptorDaValidade();
  const pool = await garantirTabelas();
  const pedidos = await pedidosComOOrcamentoNoCliente(pool);
  const ciclos = await ciclosDosPedidos(pool, pedidos.map((p) => p.id));
  const [falhas] = (await pool.execute(
    "SELECT pedidoId, ultimaFalha FROM validadeDosOrcamentos WHERE ultimaFalha IS NOT NULL",
  )) as [Array<{ pedidoId: number; ultimaFalha: string }>, unknown];
  const falhaDe = new Map(falhas.map((f) => [Number(f.pedidoId), String(f.ultimaFalha)]));
  const { respostasDoClienteNoWhatsApp } = await import("./db");
  const respostas = await respostasDoClienteNoWhatsApp(pedidos.map((p) => p.contactPhone)).catch(() => new Map());
  return {
    ligado,
    pedidos: pedidos.map((p) => {
      const antes = ciclos.get(p.id);
      const mesmaVersao = antes && Math.abs(antes.versao.getTime() - p.propostaEnviadaEm.getTime()) <= 1000 && !antes.fechadoEm;
      const c: CicloDoOrcamento & { reaberto?: boolean } = mesmaVersao
        ? antes!
        : { desde: p.propostaEnviadaEm, lembrete1Em: null, ultimoAvisoEm: null, fechadoEm: null, paradoEm: null };
      const resp = respostas.get(noveDigitos(p.contactPhone));
      const respondeu = clienteRespondeuNoCiclo(c.desde, resp?.ultimaMensagemEm);
      const vista = respondeu && !c.paradoEm ? { ...c, paradoEm: resp?.ultimaMensagemEm ?? agora } : c;
      return {
        pedidoId: p.id,
        linha: linhaDaMesa(vista, ligado),
        lembrar: ligado && !vista.paradoEm ? rotuloDoLembrarAgora(vista, agora) : null,
        parado: Boolean(vista.paradoEm),
        falha: falhaDe.get(p.id) ?? null,
      };
    }),
  };
}

/* ── As respostas do cliente (a Vitória, em whatsapp-negociacao.ts) ──────── */

export type CicloComLembrete = {
  pedidoId: number;
  negociacaoId: number | null;
  eClyon: boolean;
  valorUnico: boolean;
  parceiro: string | null;
};

/**
 * Os pedidos deste telefone com um lembrete (ou o último aviso) já enviado e o
 * ciclo ainda a correr — é a esses que o «1», o «2» e o «3» respondem. Com o
 * interruptor desligado, nenhum (a conversa segue como sempre).
 */
export async function ciclosComLembreteDoTelefone(telefone: string): Promise<CicloComLembrete[]> {
  const tel = noveDigitos(telefone);
  if (!tel) return [];
  if (!(await interruptorDaValidade()).ligado) return [];
  const pool = await garantirTabelas();
  const [rows] = (await pool.execute(
    `SELECT v.pedidoId, v.negociacaoId, o.valorFixoClyon, o.valorUnicoCliente
       FROM validadeDosOrcamentos v
       JOIN simulatorOrders o ON o.id = v.pedidoId
      WHERE (v.lembrete1Em IS NOT NULL OR v.ultimoAvisoEm IS NOT NULL)
        AND v.fechadoEm IS NULL AND v.paradoEm IS NULL
        AND o.propostaEnviadaEm IS NOT NULL
        AND (o.status IS NULL OR o.status NOT IN ('arquivado', 'cancelado', 'concluido', 'rejeitado'))
        AND RIGHT(REGEXP_REPLACE(COALESCE(o.contactPhone, ''), '[^0-9]', ''), 9) = ?
      ORDER BY v.pedidoId DESC
      LIMIT 5`,
    [tel],
  )) as [Array<Record<string, unknown>>, unknown];
  const saida: CicloComLembrete[] = [];
  for (const r of rows) {
    let parceiro: string | null = null;
    if (r.negociacaoId != null) {
      const negs = await negociacoesDoPedido(Number(r.pedidoId)).catch(() => []);
      parceiro = String(negs.find((n) => Number(n.id) === Number(r.negociacaoId))?.profissionalNome ?? "").trim() || null;
    }
    saida.push({
      pedidoId: Number(r.pedidoId),
      negociacaoId: r.negociacaoId == null ? null : Number(r.negociacaoId),
      eClyon: r.valorFixoClyon != null,
      valorUnico: r.valorFixoClyon == null && r.valorUnicoCliente != null,
      parceiro,
    });
  }
  return saida;
}

/**
 * «1» NUM TRABALHO CLYON: o cliente aceita o preço, e o parceiro do lembrete
 * fica com o trabalho — a escolha de sempre (`atribuirOfertaClyon`, como o
 * «Escolher» dos Trabalhos CLYON), com o aviso ao escolhido e ao cliente.
 */
export async function aceitarTrabalhoClyonPeloLembrete(
  pedidoId: number,
  negociacaoId: number,
): Promise<{ ok: true; parceiro: string | null } | { ok: false; porque: string }> {
  const { getSimulatorOrderById, aceitarPrecoClyon, atribuirOfertaClyon } = await import("./db");
  const pedido = (await getSimulatorOrderById(pedidoId)) as unknown as
    | { propostaEnviadaEm?: Date | string | null; precoAceiteEm?: Date | string | null; valorFixoClyon?: unknown }
    | undefined;
  if (!pedido || pedido.valorFixoClyon == null || !pedido.propostaEnviadaEm) return { ok: false, porque: "não é um Trabalho CLYON com o preço enviado" };
  const { guiaImpedeANegociacao } = await import("./guia-na-base");
  if (await guiaImpedeANegociacao(negociacaoId)) return { ok: false, porque: "a guia do parceiro está por verificar" };
  if (!pedido.precoAceiteEm) {
    const versao = pedido.propostaEnviadaEm instanceof Date ? pedido.propostaEnviadaEm : new Date(String(pedido.propostaEnviadaEm));
    await aceitarPrecoClyon(pedidoId, versao).catch(() => false);
  }
  const r = await atribuirOfertaClyon(negociacaoId);
  if (!r.ok) return { ok: false, porque: `não deu para escolher o parceiro (${r.porque})` };
  const { avisarProfissionalEscolhido } = await import("./avisar-escolhido-da-oferta");
  const { urlDeAccao } = await import("./url-do-site");
  const aviso = await avisarProfissionalEscolhido({ negociacaoId, pedidoId: r.pedidoId, providerId: r.providerId, baseUrl: urlDeAccao() });
  const resumo =
    `O cliente respondeu «1» ao lembrete do orçamento: aceitou o preço e ${aviso.profissional || `o parceiro #${r.providerId}`} ficou com o trabalho` +
    (r.encerradas > 0 ? `; ${r.encerradas} outro(s) que tinham aceitado ficaram de fora.` : ".");
  await appendOrderHistory(r.pedidoId, { type: "created", by: null, message: resumo }).catch(() => {});
  const { avisarOClienteDoPedido } = await import("./avisos-ao-cliente");
  await avisarOClienteDoPedido(r.pedidoId, "escolhido", { nome: aviso.profissional || null, negociacaoId }).catch(() => {});
  await registarSemFalhar({
    acontecimento: "negociacao_fechada",
    pedidoId: r.pedidoId,
    negociacaoId,
    providerId: r.providerId,
    providerNome: aviso.profissional || null,
    autorTipo: "cliente",
    autorNome: "WhatsApp (lembrete do orçamento)",
    valor: aviso.valorDoTrabalho ?? aviso.valor,
    valorProfissional: aviso.valor,
    resumo,
    visivelProfissional: true,
  });
  await marcarCicloTerminado(pedidoId, "o cliente avançou («1»)");
  return { ok: true, parceiro: aviso.profissional || null };
}

/** O ciclo acabou bem (o cliente avançou): pára, para nada mais sair. */
export async function marcarCicloTerminado(pedidoId: number, porque: string): Promise<void> {
  await pararOCiclo(pedidoId, porque).catch(() => {});
}

/**
 * «3» / «JÁ NÃO PRECISO»: cancela o pedido, avisa os parceiros, manda ao cliente
 * o texto de cancelamento aprovado (mensagens-das-fases.ts) e ANONIMIZA o
 * pedido (`anonimizarPedido`, o da retenção, sem o primeiro nome): saem o nome,
 * o telefone, o email, a morada exacta, a descrição e as fotografias; ficam o
 * serviço, a localidade e a zona do código postal, os valores e as datas. A
 * linha fica.
 */
export async function cancelarPeloLembrete(pedidoId: number, telefone: string): Promise<{ ok: boolean; porque?: string }> {
  const { getSimulatorOrderById, cancelarPedido, gravarMotivoDoFecho, quemTemOTrabalhoClyon } = await import("./db");
  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return { ok: false, porque: "pedido não encontrado" };
  const eClyon = (pedido as { valorFixoClyon?: unknown }).valorFixoClyon != null;
  const MOTIVO = "O cliente já não precisa";
  const existentes = await negociacoesDoPedido(pedidoId);
  const doTrabalhoClyon = eClyon ? (await quemTemOTrabalhoClyon(pedidoId)).vivos : [];
  await pararOCiclo(pedidoId, "o cliente já não precisa («3»)").catch(() => {});

  const r = await cancelarPedido(pedidoId);
  if (!r) return { ok: false, porque: "pedido não encontrado" };
  await gravarMotivoDoFecho(pedidoId, "ja_nao_precisa", null, null).catch(() => {});
  if (eClyon) {
    const { avisarCancelamentoDoTrabalhoClyon } = await import("./avisar-trabalho-clyon");
    await avisarCancelamentoDoTrabalhoClyon({
      pedidoId,
      servico: pedido.serviceType ?? null,
      localidade: pedido.city ?? null,
      motivo: MOTIVO,
      quem: doTrabalhoClyon,
    }).catch(() => 0);
  } else {
    const { avisarDoCancelamento } = await import("./avisar-cancelamento");
    await avisarDoCancelamento({ pedidoId, negociacoes: existentes, motivo: MOTIVO, porQuem: "cliente" });
  }
  const { enviarTextoWhatsApp } = await import("./whatsapp-cloud");
  const { mensagemDeCancelamento } = await import("./mensagens-das-fases");
  await enviarTextoWhatsApp(telefone, mensagemDeCancelamento()).catch(() => false);

  const resumo = `O cliente respondeu ao lembrete do orçamento que já não precisa: pedido cancelado, ${r.encerradas} negociação(ões) encerrada(s), e os dados dele apagados do pedido.`;
  await appendOrderHistory(pedidoId, { type: "created", by: null, message: resumo }).catch(() => {});
  await registarSemFalhar({ acontecimento: "pedido_cancelado", pedidoId, autorTipo: "cliente", autorNome: "WhatsApp (lembrete do orçamento)", resumo });

  // Por último: com o pedido já cancelado e os avisos dados, os dados dele saem.
  try {
    const { anonimizarPedido } = await import("./regras-novas-na-base");
    await anonimizarPedido(pedidoId, {
      semNome: true,
      autorNome: "validade do orçamento",
      resumo:
        "Pedido anonimizado a pedido do cliente («já não preciso», d62): ficam o serviço, a localidade, a zona do código postal, " +
        "as datas e os valores; saíram o nome, os contactos, a morada, a descrição e as fotografias.",
    });
  } catch (e) {
    console.error("[validade-do-orcamento] a anonimização falhou:", e instanceof Error ? e.message : e);
    return { ok: true, porque: "cancelado, mas a anonimização falhou" };
  }
  return { ok: true };
}
