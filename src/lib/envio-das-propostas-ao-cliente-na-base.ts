/**
 * AS PROPOSTAS VÃO AO CLIENTE SOZINHAS, NA BASE — d88 passo 3 (CEO e dono,
 * 23-11-2026). As regras puras estão em `envio-das-propostas-ao-cliente.ts`.
 *
 *  - o interruptor «Enviar as propostas ao cliente» (Configs, só o
 *    administrador), na tabela dos interruptores (`retencaoInterruptores`):
 *    LIGADO POR OMISSÃO (o dono pediu) — sem linha, ligado; com a base a
 *    falhar, nada sai;
 *  - `envioDasPropostasAoCliente` — UMA linha por pedido (a chave primária é o
 *    pedido): na fila, a enviar, enviado ou falhou. É a reserva que impede o
 *    mesmo orçamento de sair duas vezes;
 *  - a rotina (`/api/cron/propostas-ao-cliente`, de 15 em 15 min, das 9h às
 *    20h de Lisboa) põe na fila os que já podem sair; a passagem (às rondas da
 *    ponte) envia UM de cada vez, 20 a 45 s entre cada, e lê tudo outra vez
 *    antes de enviar;
 *  - a linha do cartão da Mesa e o ensaio das Configs.
 *
 * O envio é o do «Enviar pela CLYON» da Mesa: o texto de `textoDoOrcamentoDaMesa`
 * (a mesma função do painel), o número da plataforma (`enviarTextoManualWhatsApp`),
 * a conversa devolvida à Vitória (`retomarNumeroWhatsApp`) e o pedido em «A
 * aguardar cliente» (`marcarOrcamentoEnviado`) — e daí correm a validade (d62)
 * e o seguimento (d83). Nunca DELETE: a linha fica, e diz o que aconteceu.
 *
 * d114 (25-11-2026): o texto é a mensagem curta (`propostas-curtas.ts`), e a
 * linha do pedido pode voltar à fila — no máximo uma vez por dia
 * (`ultimoEnvioEm`), só com propostas que o cliente ainda não ouviu (as
 * chaves no registo dos avisos do assistente, as mesmas dos três caminhos).
 * Só sai com os dois interruptores ligados: este («Enviar as propostas ao
 * cliente») e o «Avisar de propostas» do assistente (`podeDizerAsPropostas`).
 */

import { appendOrderHistory, ensureRegistoTable, getPool, registarNaTransaccao } from "./db";
import { propostasPorEnviarDoPedido, type PedidoParaOLado } from "./do-nosso-lado";
import { instanteDaBase } from "./hora-de-lisboa";
import { naJanelaDasMensagensAutomaticas } from "./janela-das-mensagens-automaticas";
import { propostasParaOCliente, trabalhoFechado } from "./mensagem-das-propostas";
import { nomeDoServicoDoOrcamento, type PedidoDoOrcamento } from "./texto-do-orcamento-da-mesa";
import {
  chavesDasPropostasVivas,
  ESPECIE_DAS_PROPOSTAS_DITAS,
  mensagemCurtaDasPropostas,
  oTextoNomeia,
  type PropostaCurta,
} from "./propostas-curtas";
import { lerBase } from "./base-do-preco";
import { melhorProposta } from "./validade-do-orcamento";
import {
  estadoDoEnvio,
  historicoDoEnvioAutomatico,
  linhaDoEnvioNaMesa,
  MOTIVOS_COM_UMA_PESSOA,
  NOME_DO_INTERRUPTOR_DAS_PROPOSTAS,
  type EstadoDoEnvio,
  type PedidoParaOEnvio,
} from "./envio-das-propostas-ao-cliente";

/* ── O interruptor (Configs) — LIGADO por omissão ───────────────────────── */

export const CHAVE_DO_ENVIO_DAS_PROPOSTAS = "enviar_as_propostas_d88";

export type InterruptorDasPropostas = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

type Pool = NonNullable<Awaited<ReturnType<typeof getPool>>>;

let tabelasProntas = false;

export const SQL_DAS_TABELAS_DAS_PROPOSTAS = [
  `CREATE TABLE IF NOT EXISTS retencaoInterruptores (
      chave     VARCHAR(40) NOT NULL PRIMARY KEY,
      ligado    TINYINT(1) NOT NULL DEFAULT 0,
      mudadoEm  DATETIME NULL DEFAULT NULL,
      porQuem   VARCHAR(120) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS envioDasPropostasAoCliente (
      pedidoId    INT UNSIGNED NOT NULL PRIMARY KEY,
      estado      VARCHAR(12) NOT NULL,
      naFilaEm    DATETIME NULL DEFAULT NULL,
      reservadoEm DATETIME NULL DEFAULT NULL,
      enviadoEm   DATETIME NULL DEFAULT NULL,
      propostas   TINYINT UNSIGNED NULL DEFAULT NULL,
      motivo      VARCHAR(160) NULL DEFAULT NULL,
      KEY idx_envio_das_propostas_estado (estado, naFilaEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  // d114: a última mensagem das propostas (uma por dia) e quantas já foram.
  `ALTER TABLE envioDasPropostasAoCliente ADD COLUMN ultimoEnvioEm DATETIME NULL DEFAULT NULL`,
  `ALTER TABLE envioDasPropostasAoCliente ADD COLUMN envios TINYINT UNSIGNED NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS envioDasPropostasVez (
      id        TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      proximoEm DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

async function garantirTabelas(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("[envio-das-propostas] base de dados indisponível");
  if (!tabelasProntas) {
    for (const sql of SQL_DAS_TABELAS_DAS_PROPOSTAS) {
      // A coluna que já existe não é um erro (d114).
      if (sql.startsWith("ALTER TABLE")) await pool.execute(sql).catch(() => {});
      else await pool.execute(sql);
    }
    await pool.execute("INSERT IGNORE INTO envioDasPropostasVez (id, proximoEm) VALUES (1, '2000-01-01 00:00:00')");
    tabelasProntas = true;
  }
  return pool;
}

/** LIGADO POR OMISSÃO (sem linha, ligado); com a base a falhar, desligado — nada sai sem base. */
export async function interruptorDasPropostas(): Promise<InterruptorDasPropostas> {
  try {
    const pool = await garantirTabelas();
    const [rows] = (await pool.execute(
      "SELECT ligado, mudadoEm, porQuem FROM retencaoInterruptores WHERE chave = ? LIMIT 1",
      [CHAVE_DO_ENVIO_DAS_PROPOSTAS],
    )) as [Array<{ ligado: number; mudadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = rows[0];
    if (!l) return { ligado: true, mudadoEm: null, porQuem: null };
    return {
      ligado: Number(l.ligado) === 1,
      mudadoEm: l.mudadoEm ? (instanteDaBase(l.mudadoEm)?.toISOString() ?? null) : null,
      porQuem: l.porQuem ?? null,
    };
  } catch (e) {
    console.error("[envio-das-propostas] não li o interruptor — nada sai:", e instanceof Error ? e.message : e);
    return { ligado: false, mudadoEm: null, porQuem: null };
  }
}

/**
 * PODE DIZER AS PROPOSTAS AO CLIENTE? — d114: este interruptor E o «Avisar de
 * propostas» do assistente (`assistentePode("propostas")`), que governava a
 * proposta nova e o «aceitou» um a um, e agora governa a única mensagem que
 * os diz. Com a base a falhar, não.
 */
export async function podeDizerAsPropostas(): Promise<boolean> {
  if (!(await interruptorDasPropostas()).ligado) return false;
  try {
    const { assistentePode } = await import("./db");
    return await assistentePode("propostas");
  } catch {
    return false;
  }
}

/** Liga ou desliga; a mudança e quem a fez ficam no registo permanente, na mesma transacção. */
export async function mudarInterruptorDasPropostas(ligar: boolean, porQuem: string): Promise<InterruptorDasPropostas> {
  const pool = await garantirTabelas();
  await ensureRegistoTable();
  const antes = await interruptorDasPropostas();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, ?, UTC_TIMESTAMP(), ?)
       ON DUPLICATE KEY UPDATE ligado = VALUES(ligado), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
      [CHAVE_DO_ENVIO_DAS_PROPOSTAS, ligar ? 1 : 0, porQuem.slice(0, 120)],
    );
    await registarNaTransaccao(conn, {
      acontecimento: "envio_das_propostas_interruptor",
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: antes.ligado ? "ligado" : "desligado",
      estadoDepois: ligar ? "ligado" : "desligado",
      resumo: `«${NOME_DO_INTERRUPTOR_DAS_PROPOSTAS}» ${ligar ? "LIGADO" : "DESLIGADO"} por ${porQuem} (d88).`,
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
  return interruptorDasPropostas();
}

/* ── Os pedidos, como o envio os vê ──────────────────────────────────────── */

type NegociacaoDaMesa = PedidoParaOLado["negociacoes"][number] &
  PedidoDoOrcamento["negociacoes"][number] & { id: number; providerId: number };

type PedidoDaMesa = Omit<PedidoParaOLado, "negociacoes"> &
  Omit<PedidoDoOrcamento, "negociacoes"> & {
    id: number;
    contactPhone: string | null;
    valorFixoClyon?: unknown;
    negociacoes: NegociacaoDaMesa[];
  };

export type CandidatoAoEnvio = {
  pedido: PedidoDaMesa;
  envio: PedidoParaOEnvio;
  propostas: number;
  estado: EstadoDoEnvio;
  /** A linha da tabela do envio, se já há (fila, a enviar, enviado, falhou, espera). */
  linhaDoEnvio: LinhaDoEnvio | null;
  /** A mensagem curta, tal como sai (d114). */
  texto: string;
  /** As chaves das propostas vivas — as que ficam ditas quando a mensagem sai (d114). */
  chaves: Array<{ chave: string; negociacaoId: number }>;
};

const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

type LinhaDoEnvio = { estado: string; motivo: string | null; ultimoEnvioEm: Date | null };

/** As linhas do envio dos pedidos pedidos — com a última mensagem que a Vitória mandou (d114). */
async function linhasDoEnvio(pool: Pool, ids: number[]): Promise<Map<number, LinhaDoEnvio>> {
  const m = new Map<number, LinhaDoEnvio>();
  const limpos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (limpos.length === 0) return m;
  const [rows] = (await pool.execute(
    `SELECT pedidoId, estado, motivo, COALESCE(ultimoEnvioEm, enviadoEm) AS ultimo
       FROM envioDasPropostasAoCliente WHERE pedidoId IN (${limpos.map(() => "?").join(",")})`,
    limpos,
  )) as [Array<{ pedidoId: number; estado: string; motivo: string | null; ultimo: Date | string | null }>, unknown];
  for (const r of rows) {
    m.set(Number(r.pedidoId), { estado: String(r.estado), motivo: r.motivo ?? null, ultimoEnvioEm: instanteDaBase(r.ultimo ?? null) });
  }
  return m;
}

/**
 * AS CHAVES QUE JÁ FORAM DITAS AO CLIENTE — no registo dos avisos do
 * assistente (a proposta nova e o «aceitou» de antes, a rotina e a conversa
 * livre). Na dúvida (a base falhou), todas: não se repete nada.
 */
async function chavesJaDitas(pool: Pool, chaves: string[]): Promise<Set<string>> {
  const limpas = [...new Set(chaves)].slice(0, 200);
  if (limpas.length === 0) return new Set();
  try {
    const [rows] = (await pool.execute(
      `SELECT chave FROM assistenteAvisos WHERE chave IN (${limpas.map(() => "?").join(",")})`,
      limpas,
    )) as [Array<{ chave: string }>, unknown];
    return new Set((Array.isArray(rows) ? rows : []).map((r) => String(r.chave)));
  } catch (e) {
    if ((e as { code?: string })?.code === "ER_NO_SUCH_TABLE") return new Set();
    return new Set(limpas);
  }
}

/**
 * FICA ESCRITO QUE O CLIENTE OUVIU ESTAS PROPOSTAS — d114. A chave de cada uma
 * no registo dos avisos do assistente (fechada logo: é uma notícia, não leva
 * lembretes). É o que impede a rotina, a passagem e a conversa livre de a
 * dizerem outra vez. Nunca lança.
 */
export async function marcarPropostasDitas(
  telefone: string,
  pedidoId: number,
  chaves: ReadonlyArray<{ chave: string; negociacaoId: number }>,
): Promise<void> {
  try {
    const db = await import("./db");
    for (const c of chaves) {
      const { id } = await db.reservarAvisoDoAssistente({
        chave: c.chave,
        especie: ESPECIE_DAS_PROPOSTAS_DITAS,
        telefone,
        pedidoId,
        negociacaoId: c.negociacaoId,
      });
      if (id) await db.fecharAvisoDoAssistente(id, "informado").catch(() => {});
    }
  } catch (e) {
    console.error("[envio-das-propostas] não marquei as propostas ditas:", e instanceof Error ? e.message : e);
  }
}

/**
 * O QUE A CONVERSA DISSE TAMBÉM CONTA — d114. Uma mensagem da Vitória que
 * saiu ao cliente (a conversa livre, a lista da d111) e nomeia o parceiro de
 * uma proposta viva de um pedido dele: essa proposta fica dita, e a rotina
 * não a repete sozinha. Nunca lança.
 */
export async function marcarAsPropostasNomeadas(telefone: string, texto: string, agora: Date = new Date()): Promise<void> {
  try {
    const { pedidosDoTelefone } = await import("./whatsapp-negociacao");
    const db = await import("./db");
    for (const pedidoId of (await pedidosDoTelefone(telefone)).slice(0, 5)) {
      const negociacoes = await db.negociacoesDoPedido(pedidoId);
      const chaves = chavesDasPropostasVivas(
        negociacoes.map((n) => ({
          id: n.id,
          estado: n.estado,
          profissionalNome: n.profissionalNome,
          propostasJson: n.propostasJson ?? null,
          valorAcordado: n.valorAcordado ?? null,
        })),
        agora,
      ).filter((c) => oTextoNomeia(texto, c.parceiro));
      if (chaves.length > 0) await marcarPropostasDitas(telefone, pedidoId, chaves);
    }
  } catch (e) {
    console.error("[envio-das-propostas] não li as propostas nomeadas:", e instanceof Error ? e.message : e);
  }
}

type NotasDosParceiros = Map<number, { nota: { media: number; quantas: number } | null }>;

/**
 * AS PROPOSTAS DE UM PEDIDO COMO A MENSAGEM CURTA AS DIZ (d114): o total com
 * IVA e o sem IVA, o parceiro isento, o parceiro que aceitou o valor do
 * cliente, e a nota (só com avaliações).
 */
function propostasCurtasDoPedido(p: PedidoDaMesa, notas: NotasDosParceiros): PropostaCurta[] {
  const daNegociacao = new Map(p.negociacoes.map((n) => [Number(n.id), n]));
  return propostasParaOCliente(p.negociacoes).map((x) => {
    const n = daNegociacao.get(Number(x.negociacaoId));
    return {
      negociacaoId: x.negociacaoId ?? null,
      parceiro: x.profissional,
      semIva: x.semIva,
      total: x.total,
      isento: x.contaDoNovoModelo?.regime === "isento",
      aceitou: n?.estado === "aguarda_contratacao",
      nota: n ? (notas.get(Number(n.providerId))?.nota ?? null) : null,
    };
  });
}

/** A mensagem curta das propostas deste pedido, tal como sai (d114). */
export function textoDasPropostasDoPedido(p: PedidoDaMesa, agora: Date, notas: NotasDosParceiros, primeira: boolean): string {
  const base = lerBase(p.baseDoPreco);
  return mensagemCurtaDasPropostas({
    pedidoId: Number(p.id),
    nome: p.contactName,
    servico: nomeDoServicoDoOrcamento(p.serviceType),
    propostas: propostasCurtasDoPedido(p, notas),
    agora,
    unidade: base === "carga" || base === "hora" ? base : null,
    primeira,
  });
}

/**
 * O CLIENTE, COMO A REGRA O PRECISA: a conversa com uma pessoa (entregue, ou a
 * equipa a escrever à mão há pouco, d73), uma queixa, a língua sem tradução
 * fixa deste texto, o número bloqueado, e se já saiu hoje outra mensagem
 * automática. Na dúvida, o lado que não envia.
 */
async function oCliente(
  pool: Pool,
  telefone: string,
  texto: string,
  agora: Date,
): Promise<{ comUmaPessoa: boolean; queixa: boolean; linguaSemTraducao: string | null; bloqueado: boolean; jaSaiuHoje: boolean }> {
  const db = await import("./db");
  const bloqueado = await db.numeroBloqueadoWhatsApp(telefone).catch(() => true);
  const interrompido = await db.numeroInterrompidoWhatsApp(telefone).catch(() => true);
  const fio = await db.mensagensDoNumeroWhatsApp(telefone, 40).catch(() => null);
  const { aEquipaFalouHaPouco } = await import("./pedido-em-curso");
  const { haQueixaNaConversa } = await import("./queixa-na-conversa");
  // d116: a equipa a escrever já não cala a Vitória (só o «*», que é uma entrega).
  const comUmaPessoa = interrompido || fio == null || aEquipaFalouHaPouco(fio);
  const queixa = fio != null && haQueixaNaConversa(fio);
  // A língua da conversa (a guardada, ou a que a conversa mostra — o #659); sozinha, só com tradução fixa.
  let linguaSemTraducao: string | null = null;
  try {
    const { orcamentoNaLinguaDaConversa } = await import("./lingua-da-conversa");
    const naLingua = await orcamentoNaLinguaDaConversa(telefone, texto, { soFixa: true });
    if (!naLingua.ok) linguaSemTraducao = naLingua.lingua;
  } catch {
    linguaSemTraducao = "?";
  }
  const { jaSaiuHojeUmaMensagemAutomatica } = await import("./uma-mensagem-automatica-por-dia");
  const jaSaiuHoje = await jaSaiuHojeUmaMensagemAutomatica({ telefone }, agora, { pool }).catch(() => true);
  return { comUmaPessoa, queixa, linguaSemTraducao, bloqueado, jaSaiuHoje };
}

/**
 * OS PEDIDOS COM PROPOSTAS POR ENVIAR — os da Mesa (`pedidosComNegociacoes`),
 * pela mesma conta do cartão («Propostas de parceiros por enviar ao cliente»),
 * com o texto do orçamento tal como sai, a melhor proposta (d62) e o estado
 * do envio de cada um. Com `ids`, só esses.
 */
export async function candidatosAoEnvio(agora: Date, ids?: number[], jaLidos?: readonly unknown[]): Promise<CandidatoAoEnvio[]> {
  const pool = await garantirTabelas();
  const db = await import("./db");
  // Os da Mesa que a rota já leu servem (não se lê a base duas vezes); senão, os 200 mais recentes.
  const todos = JSON.parse(JSON.stringify(jaLidos ?? (await db.pedidosComNegociacoes(200)))) as PedidoDaMesa[];
  const alvo = todos.filter((p) => (!ids || ids.includes(Number(p.id))) && propostasPorEnviarDoPedido(p, agora));
  if (alvo.length === 0) return [];

  // O modelo de 15-11 e o regime de cada negociação, como a rota da Mesa (para o número da mensagem ser o do cartão).
  const { negociacoesNoNovoModelo, regimesDasNegociacoes } = await import("./novo-modelo-no-servidor");
  const { agoraDoModelo } = await import("./relogio-do-modelo");
  const negociacoes = alvo.flatMap((p) => p.negociacoes);
  const doNovoModelo = await negociacoesNoNovoModelo(negociacoes, agoraDoModelo()).catch(() => new Set<number>());
  const regimes = await regimesDasNegociacoes([...doNovoModelo]).catch(() => new Map());
  for (const p of alvo) {
    p.negociacoes = p.negociacoes.map((n) => ({
      ...n,
      ...(doNovoModelo.has(Number(n.id)) ? { noNovoModelo: true } : {}),
      ...(doNovoModelo.has(Number(n.id)) && regimes.has(Number(n.id)) ? { regimeParaOTotal: regimes.get(Number(n.id)) } : {}),
    }));
  }
  // A nota que conta de cada parceiro, para a melhor proposta (a mesma da validade, d62).
  const notas = await db
    .parceirosParaOValorUnico(negociacoes.map((n) => Number(n.providerId)))
    .catch(() => new Map<number, { nota: { media: number; quantas: number } | null; verificado: boolean }>());
  const doEnvio = await linhasDoEnvio(pool, alvo.map((p) => Number(p.id)));

  const out: CandidatoAoEnvio[] = [];
  for (const p of alvo) {
    const por = propostasPorEnviarDoPedido(p, agora)!;
    const propostas = propostasParaOCliente(p.negociacoes);
    const providerDe = new Map(p.negociacoes.map((n) => [Number(n.id), Number(n.providerId)]));
    const melhor = melhorProposta(
      propostas.map((x) => ({
        negociacaoId: x.negociacaoId ?? null,
        parceiro: x.profissional,
        semIva: x.semIva,
        total: x.total,
        nota: notas.get(providerDe.get(Number(x.negociacaoId)) ?? -1)?.nota ?? null,
      })),
    );
    const telefone = String(p.contactPhone ?? "");
    const temTelemovel = digitos(telefone).length >= 9;
    const linha = doEnvio.get(Number(p.id)) ?? null;
    const ultimoEnvioEm = linha?.ultimoEnvioEm ?? null;
    // d114: as propostas que o cliente ainda não ouviu (por qualquer caminho).
    const vivas = chavesDasPropostasVivas(p.negociacoes, agora);
    const ditas = await chavesJaDitas(pool, vivas.map((v) => v.chave));
    const novas = vivas.filter((v) => !ditas.has(v.chave)).length;
    const texto = textoDasPropostasDoPedido(p, agora, notas, ultimoEnvioEm == null);
    const cliente = temTelemovel
      ? await oCliente(pool, telefone, texto, agora)
      : { comUmaPessoa: false, queixa: false, linguaSemTraducao: null, bloqueado: false, jaSaiuHoje: false };
    const instantes = [...por.instantes].sort((a, b) => a - b);
    // A equipa mandou o orçamento à mão depois da última mensagem da Vitória (ou sem ela): o resto é dela.
    const enviadoEm = instanteDaBase(p.propostaEnviadaEm ?? null);
    const aMao = enviadoEm != null && (ultimoEnvioEm == null || enviadoEm.getTime() > ultimoEnvioEm.getTime() + 15 * 60_000);
    // O parceiro que aceitou o valor do cliente (d114): a 1.ª mensagem não espera a hora.
    const aceites = p.negociacoes
      .filter((n) => n.estado === "aguarda_contratacao")
      .map((n) => instanteDaBase((n as { actualizadaEm?: string | Date | null }).actualizadaEm ?? null)?.getTime())
      .filter((t): t is number => t != null && (ultimoEnvioEm == null || t > ultimoEnvioEm.getTime()));
    const envio: PedidoParaOEnvio = {
      pedidoId: Number(p.id),
      parceiros: por.parceiros,
      primeiraEm: new Date(instantes[0]),
      segundaEm: por.parceiros >= 2 && instantes.length >= 2 ? new Date(instantes[1]) : null,
      aceitouEm: aceites.length > 0 ? new Date(Math.min(...aceites)) : null,
      ultimaMudancaEm: new Date(instantes[instantes.length - 1]),
      jaEnviado: aMao,
      ultimoEnvioEm,
      novas,
      fechado: trabalhoFechado(p.negociacoes) != null,
      trabalhoClyon: p.valorFixoClyon != null,
      valorUnico: p.valorUnicoCliente != null,
      base: p.baseDoPreco ?? null,
      comUmaPessoa: cliente.comUmaPessoa,
      queixa: cliente.queixa,
      linguaSemTraducao: cliente.linguaSemTraducao,
      melhorComIva: melhor ? melhor.total : null,
      temTelemovel,
      bloqueado: cliente.bloqueado,
    };
    out.push({
      pedido: p,
      envio,
      propostas: propostas.length,
      estado: estadoDoEnvio(envio, agora, { jaSaiuHoje: cliente.jaSaiuHoje }),
      linhaDoEnvio: linha,
      texto,
      chaves: vivas.map(({ chave, negociacaoId }) => ({ chave, negociacaoId })),
    });
  }
  return out;
}

/* ── A linha da Mesa e o ensaio ──────────────────────────────────────────── */

/** A linha de um candidato, com o que a tabela do envio já diz (a enviar, falhou). */
function linhaDoCandidato(c: CandidatoAoEnvio, ligado: boolean): string | null {
  const l = c.linhaDoEnvio;
  if (l?.estado === "falhou") return `o envio automático falhou${l.motivo ? ` (${l.motivo})` : ""}: enviar à mão`;
  if (l?.estado === "a_enviar" || (ligado && l?.estado === "fila" && c.estado.tipo === "sai")) return "a Vitória está a enviar ao cliente";
  return linhaDoEnvioNaMesa(c.estado, ligado);
}

/** As linhas dos cartões da Mesa (pedido → linha). Nunca lança: sem isto, a Mesa serve. */
export async function linhasDoEnvioNaMesa(agora: Date = new Date(), pedidos?: readonly unknown[]): Promise<Map<number, string>> {
  const m = new Map<number, string>();
  try {
    const ligado = await podeDizerAsPropostas();
    for (const c of await candidatosAoEnvio(agora, undefined, pedidos)) {
      const l = linhaDoCandidato(c, ligado);
      if (l) m.set(c.envio.pedidoId, l);
    }
  } catch (e) {
    console.error("[envio-das-propostas] a Mesa não leu o envio automático:", e instanceof Error ? e.message : e);
  }
  return m;
}

export type EnsaioDasPropostas = {
  ligado: boolean;
  pedidos: Array<{ pedidoId: number; propostas: number; linha: string | null }>;
};

/** O ensaio das Configs: os pedidos com propostas por enviar, só o número, quantas e a linha. Só lê. */
export async function ensaioDasPropostas(agora: Date = new Date()): Promise<EnsaioDasPropostas> {
  const ligado = await podeDizerAsPropostas();
  const pedidos = (await candidatosAoEnvio(agora)).map((c) => ({
    pedidoId: c.envio.pedidoId,
    propostas: c.propostas,
    linha: linhaDoCandidato(c, ligado),
  }));
  return { ligado, pedidos };
}

export { MOTIVOS_COM_UMA_PESSOA };

/* ── A rotina: põe na fila os que já podem sair ──────────────────────────── */

export type ResultadoDaRotinaDasPropostas = { ligado: boolean; foraDeHoras?: boolean; naFila: number; ficam: number; esperam: number };

export async function rotinaDasPropostas(agora: Date = new Date()): Promise<ResultadoDaRotinaDasPropostas> {
  const r: ResultadoDaRotinaDasPropostas = { ligado: false, naFila: 0, ficam: 0, esperam: 0 };
  if (!(await podeDizerAsPropostas())) return r;
  r.ligado = true;
  if (!naJanelaDasMensagensAutomaticas(agora)) {
    r.foraDeHoras = true;
    return r;
  }
  const pool = await garantirTabelas();
  for (const c of await candidatosAoEnvio(agora)) {
    if (c.estado.tipo === "fica") r.ficam += 1;
    if (c.estado.tipo !== "sai") continue;
    if (!c.estado.agora) {
      r.esperam += 1;
      continue;
    }
    // Uma linha por pedido: volta à fila o que esperou e, desde a d114, o enviado com propostas novas (uma por dia); nunca o que falhou.
    const [u] = (await pool.execute(
      `INSERT INTO envioDasPropostasAoCliente (pedidoId, estado, naFilaEm) VALUES (?, 'fila', UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE naFilaEm = IF(estado IN ('espera', 'enviado'), UTC_TIMESTAMP(), naFilaEm), estado = IF(estado IN ('espera', 'enviado'), 'fila', estado)`,
      [c.envio.pedidoId],
    )) as [{ affectedRows: number }, unknown];
    if (Number(u.affectedRows) >= 1) r.naFila += 1;
  }
  return r;
}

export function resumoDaRotinaDasPropostas(r: ResultadoDaRotinaDasPropostas): string | null {
  if (!r.ligado) return `desligado (interruptor «${NOME_DO_INTERRUPTOR_DAS_PROPOSTAS}» nas Configs)`;
  if (r.foraDeHoras) return "fora das 9h–20h de Lisboa";
  if (r.naFila === 0 && r.ficam === 0 && r.esperam === 0) return null;
  return `${r.naFila} na fila · ${r.esperam} à espera da hora · ${r.ficam} com uma pessoa`;
}

/* ── A passagem: um orçamento por vez, às rondas da ponte ────────────────── */

export type ResultadoDaPassagemDasPropostas = "desligado" | "fora-da-janela" | "nada" | "nao-e-a-vez" | "feito" | "espera" | "falhou";

export async function passagemDasPropostas(agora: Date = new Date()): Promise<ResultadoDaPassagemDasPropostas> {
  if (!naJanelaDasMensagensAutomaticas(agora)) return "fora-da-janela";
  const pool = await garantirTabelas();
  const [proximos] = (await pool.query(
    "SELECT pedidoId FROM envioDasPropostasAoCliente WHERE estado = 'fila' ORDER BY naFilaEm ASC LIMIT 1",
  )) as [Array<{ pedidoId: number }>, unknown];
  const p = proximos[0];
  if (!p) return "nada";
  if (!(await podeDizerAsPropostas())) return "desligado";
  const { intervaloAoAcaso } = await import("./aviso-aos-profissionais");
  const [vez] = (await pool.execute(
    "UPDATE envioDasPropostasVez SET proximoEm = UTC_TIMESTAMP() + INTERVAL ? SECOND WHERE id = 1 AND proximoEm <= UTC_TIMESTAMP()",
    [intervaloAoAcaso()],
  )) as [{ affectedRows: number }, unknown];
  if (Number(vez.affectedRows) !== 1) return "nao-e-a-vez";
  const r = await enviarAsPropostasAoCliente(Number(p.pedidoId), agora).catch((e) => ({
    ok: false as const,
    porque: e instanceof Error ? e.message : "erro",
  }));
  return r.ok ? "feito" : r.porque === "espera" ? "espera" : "falhou";
}

/* ── Enviar: o caminho do «Enviar pela CLYON» ────────────────────────────── */

export type ResultadoDoEnvio = { ok: true; feito: string } | { ok: false; porque: string };

/**
 * ENVIA O ORÇAMENTO AO CLIENTE, se ainda for a vez dele: lê tudo outra vez (o
 * interruptor, o pedido ainda com propostas por enviar e sem orçamento enviado,
 * o cliente, a uma-por-dia), RESERVA a linha (só uma passagem ganha) e só então
 * envia — o texto e o caminho do «Enviar pela CLYON». O que já não é a vez volta
 * a «espera»; um envio que não sai fica «falhou» (a equipa envia à mão), e não
 * se tenta outra vez sozinho.
 */
export async function enviarAsPropostasAoCliente(pedidoId: number, agora: Date): Promise<ResultadoDoEnvio> {
  if (!(await podeDizerAsPropostas())) return { ok: false, porque: "desligado" };
  const pool = await garantirTabelas();
  const esperar = async (porque: string): Promise<ResultadoDoEnvio> => {
    await pool.execute("UPDATE envioDasPropostasAoCliente SET estado = 'espera', motivo = ? WHERE pedidoId = ? AND estado = 'fila'", [
      porque.slice(0, 160),
      pedidoId,
    ]);
    return { ok: false, porque: "espera" };
  };
  const [c] = await candidatosAoEnvio(agora, [pedidoId]);
  if (!c) return esperar("já não tem propostas por enviar");
  if (c.estado.tipo === "ja_enviado") return esperar("o orçamento já foi ao cliente");
  if (c.estado.tipo === "fica") return esperar(MOTIVOS_COM_UMA_PESSOA[c.estado.motivo]);
  if (!c.estado.agora) return esperar("ainda não é a hora");

  const db = await import("./db");
  // UMA VEZ SÓ (d47): se o orçamento foi há pouco ao cliente, por qualquer caminho, não sai outra vez (d114: a do dia seguinte sai).
  const ha = await db.minutosDesdeAPropostaEnviada(pedidoId).catch(() => 0);
  if (ha != null && ha < db.MINUTOS_PARA_REENVIAR_A_PROPOSTA) return esperar("o orçamento foi há pouco ao cliente");

  // Reservar ANTES de sair: só uma passagem ganha.
  const [reserva] = (await pool.execute(
    "UPDATE envioDasPropostasAoCliente SET estado = 'a_enviar', reservadoEm = UTC_TIMESTAMP(), motivo = NULL WHERE pedidoId = ? AND estado = 'fila'",
    [pedidoId],
  )) as [{ affectedRows: number }, unknown];
  if (Number(reserva.affectedRows) !== 1) return { ok: false, porque: "outra passagem já o reservou" };

  const telefone = String(c.pedido.contactPhone ?? "");
  const texto = c.texto;
  const actualizacao = c.linhaDoEnvio?.ultimoEnvioEm != null;
  // Na língua da conversa, ou não sai (d88, o #659): a língua lida fica guardada para o envio a traduzir.
  const { linguaDaConversa } = await import("./lingua-da-conversa");
  await linguaDaConversa(telefone, { guardar: true }).catch(() => null);
  const { enviarTextoManualWhatsApp } = await import("./whatsapp-cloud");
  const saiu = await enviarTextoManualWhatsApp(telefone, texto, { semLinguaErrada: true }).catch(() => false);
  if (!saiu) {
    await pool.execute("UPDATE envioDasPropostasAoCliente SET estado = 'falhou', motivo = ? WHERE pedidoId = ?", [
      "o WhatsApp não saiu",
      pedidoId,
    ]);
    return { ok: false, porque: "o WhatsApp não saiu" };
  }
  await db.retomarNumeroWhatsApp(telefone).catch(() => {});
  await db.marcarOrcamentoEnviado(pedidoId);
  await pool.execute(
    `UPDATE envioDasPropostasAoCliente
        SET estado = 'enviado', enviadoEm = COALESCE(enviadoEm, UTC_TIMESTAMP()), ultimoEnvioEm = UTC_TIMESTAMP(),
            envios = LEAST(255, envios + 1), propostas = ?
      WHERE pedidoId = ?`,
    [Math.min(255, c.propostas), pedidoId],
  );
  // d114: o cliente ouviu estas propostas — nenhum caminho as volta a dizer sozinho.
  await marcarPropostasDitas(telefone, pedidoId, c.chaves);
  const feito = historicoDoEnvioAutomatico(c.propostas, actualizacao);
  await appendOrderHistory(pedidoId, { type: "note", by: null, message: feito }).catch(() => {});
  return { ok: true, feito };
}
