/**
 * AS REGRAS NOVAS DA RETENÇÃO, NA BASE E NO BLOB — 26-10-2026 (d32).
 *
 * As decisões estão em `regras-novas-da-retencao.ts` (puro, testado com linhas
 * escritas à mão). Aqui está o que lê a base para as tomar e o que as executa.
 *
 * UMA SÓ FUNÇÃO PARA CONTAR E PARA FAZER: `regrasNovasDaNoite({ aSerio })`.
 * Em ensaio (`aSerio: false`) lê, decide e conta — e sai antes de qualquer
 * UPDATE, DELETE ou chamada ao Blob que apague. A sério faz exactamente o que
 * contou. Duas funções podiam divergir, e a divergência que importa é a pior:
 * o ensaio a dizer um número e a noite a sério a fazer outro.
 *
 * QUEM DECIDE SE É A SÉRIO NÃO É ESTE FICHEIRO: é o cron da purga, que só
 * passa `aSerio: true` com a purga armada E o interruptor das regras novas
 * ligado (`regrasNovasValem` em db.ts). O painel chama sempre em ensaio.
 */

import {
  apagarFotosDoBlob,
  deleteSimulatorOrder,
  ensureArquivoDePedidosTable,
  ensureLeadsExtended,
  ensureMovimentosTable,
  ensureNegociacoesTable,
  ensureRegistoTable,
  ensureSimulatorOrdersTable,
  getPool,
  guardarEventoPorApagar,
  PEDIDOS_POR_PASSAGEM_DA_PURGA,
  registarNaTransaccao,
  semAsQueOutroPedidoUsa,
  type ResultadoDaPurga,
} from "./db";
import {
  ajustesSemFotografias,
  apagariaHoje,
  COLUNAS_QUE_A_ANONIMIZACAO_REESCREVE,
  decidirComAsRegrasNovas,
  DIAS_ATE_ANONIMIZAR_OS_TRABALHOS,
  DIAS_DO_TELEMOVEL_NAS_REGRAS_NOVAS,
  DIAS_DOS_CONTACTOS,
  DIAS_DOS_FICHEIROS_ORFAOS,
  ficheirosDoPedido,
  fotografiasDaProvaAnonimizavel,
  fotografiasDosAjustes,
  PREFIXOS_DOS_FICHEIROS_DE_PEDIDOS,
  primeiroNome,
  provaAnonimizada,
  valoresDoPedidoAnonimizado,
  type Decisao,
  type NegociacaoParaRetencao,
  type PedidoParaRetencao,
} from "./regras-novas-da-retencao";
import { DADOS_JA_ANONIMOS, dadosDoArquivoAnonimizados, motivoQueFicaNoArquivo } from "./arquivo-anonimo";
import { DIAS_DE_RETENCAO_DOS_PEDIDOS, DIAS_PARA_OS_ABANDONADOS } from "./retencao";

/** Quantos pedidos se anonimizam por noite. O que sobrar fica para a seguinte, e diz-se. */
export const PEDIDOS_ANONIMIZADOS_POR_NOITE = 40;
/** Quantos ficheiros sem referência saem por noite. */
export const FICHEIROS_ORFAOS_POR_NOITE = 300;

type Linha = Record<string, unknown>;

function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numeroOuNulo(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** As tabelas que existem, das pedidas. Uma tabela que ainda não nasceu não tem nada para contar. */
async function tabelasQueExistem(nomes: string[]): Promise<Set<string>> {
  const pool = await getPool();
  if (!pool || nomes.length === 0) return new Set();
  const [linhas] = (await pool.execute(
    `SELECT TABLE_NAME AS t FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${nomes.map(() => "?").join(", ")})`,
    nomes,
  )) as [Array<{ t: string }>, unknown];
  return new Set(linhas.map((l) => String(l.t)));
}

/* ──────────────────────────────────────────────────────────────────────────
 * LER OS PEDIDOS COMO A DECISÃO OS QUER
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Todos os pedidos, com as negociações, os pagamentos e os movimentos de cada
 * uma. São centenas de linhas, não milhares: lê-se tudo de uma vez e decide-se
 * em JavaScript, onde a regra está escrita e testada.
 *
 * O RELÓGIO é a última mexida — no pedido, nas negociações ou nos pagamentos —
 * e é o do MySQL dos dois lados (`NOW()` e as colunas que ele escreve), como
 * na purga de hoje. Um pagamento a mexer atrasa a anonimização, nunca a
 * adianta.
 */
export async function lerPedidosParaRetencao(): Promise<PedidoParaRetencao[]> {
  await ensureSimulatorOrdersTable();
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const existem = await tabelasQueExistem(["pagamentos", "movimentosDaCarteira"]);
  const comPagamentos = existem.has("pagamentos");

  const [pedidos] = (await pool.execute(
    `SELECT o.id, o.status,
            (o.anonimizadoEm IS NOT NULL) AS anonimizado,
            (o.scheduledDate IS NULL OR o.scheduledDate < CURDATE()) AS dataPassou,
            (o.precoFinal IS NOT NULL OR o.lucroManual IS NOT NULL
               OR o.valorFixoClyon IS NOT NULL OR o.precoClienteClyon IS NOT NULL) AS temPreco,
            FLOOR(TIMESTAMPDIFF(SECOND, GREATEST(
              o.updatedAt,
              COALESCE((SELECT MAX(g.updatedAt) FROM negociacoes g WHERE g.pedidoId = o.id), o.updatedAt)
              ${comPagamentos ? ", COALESCE((SELECT MAX(p.actualizadoEm) FROM pagamentos p WHERE p.pedidoId = o.id), o.updatedAt)" : ""}
            ), NOW()) / 86400) AS diasParado
       FROM simulatorOrders o`,
  )) as [Linha[], unknown];

  const [negs] = (await pool.execute(
    `SELECT n.id, n.pedidoId, n.estado, n.valorAcordado, n.execucaoEnviadaEm, n.confirmadoEm, n.pagoEm,
            n.formaDePagamento, n.ofertaClyon, n.semFactura, n.createdAt AS negociacaoCriadaEm
       FROM negociacoes n`,
  )) as [Linha[], unknown];

  type Pagamento = { id: number; negociacaoId: number; negociacaoPaga: number | null; estado: string; metodo: string; pagoEm: unknown; viva: number };
  let pagamentos: Pagamento[] = [];
  if (comPagamentos) {
    const [p] = (await pool.execute(
      `SELECT id, negociacaoId, negociacaoPaga, estado, metodo, pagoEm,
              (estado = 'pendente' AND (expiraEm IS NULL OR expiraEm > NOW())) AS viva
         FROM pagamentos`,
    )) as [Linha[], unknown];
    pagamentos = p.map((l) => ({
      id: numero(l.id),
      negociacaoId: numero(l.negociacaoId),
      negociacaoPaga: numeroOuNulo(l.negociacaoPaga),
      estado: String(l.estado ?? ""),
      metodo: String(l.metodo ?? ""),
      pagoEm: l.pagoEm ?? null,
      viva: numero(l.viva),
    }));
  }

  const movimentos = new Map<number, number>();
  if (existem.has("movimentosDaCarteira")) {
    const [m] = (await pool.execute(
      `SELECT negociacaoId, COUNT(*) AS n FROM movimentosDaCarteira
        WHERE negociacaoId IS NOT NULL GROUP BY negociacaoId`,
    )) as [Linha[], unknown];
    for (const l of m) movimentos.set(numero(l.negociacaoId), numero(l.n));
  }

  const porNegociacao = new Map<number, Pagamento[]>();
  for (const p of pagamentos) {
    for (const alvo of new Set([p.negociacaoId, p.negociacaoPaga].filter((x): x is number => x != null && x > 0))) {
      const lista = porNegociacao.get(alvo) ?? [];
      lista.push(p);
      porNegociacao.set(alvo, lista);
    }
  }

  const negociacoesDoPedido = new Map<number, NegociacaoParaRetencao[]>();
  for (const n of negs) {
    const id = numero(n.id);
    const pags = porNegociacao.get(id) ?? [];
    // Um pagamento devolvido não é dinheiro que ficou: conta à parte.
    const recebidos = pags.filter((p) => (p.negociacaoPaga === id || p.estado === "pago") && p.estado !== "reembolsado");
    const paga = recebidos.find((p) => p.negociacaoPaga === id) ?? null;
    const negociacao: NegociacaoParaRetencao = {
      id,
      estado: String(n.estado ?? ""),
      valorAcordado: numeroOuNulo(n.valorAcordado),
      execucaoEnviadaEm: (n.execucaoEnviadaEm as Date | string | null) ?? null,
      confirmadoEm: (n.confirmadoEm as Date | string | null) ?? null,
      pagoEm: (n.pagoEm as Date | string | null) ?? null,
      formaDePagamento: (n.formaDePagamento as string | null) ?? null,
      ofertaClyon: typeof n.ofertaClyon === "string" && n.ofertaClyon !== "" ? n.ofertaClyon : null,
      semFactura: n.semFactura,
      negociacaoCriadaEm: (n.negociacaoCriadaEm as Date | string | null) ?? null,
      clientePagouEm: paga ? ((paga.pagoEm as Date | string | null) ?? "pago") : null,
      comoEntrou: paga?.metodo ?? null,
      referenciasVivas: pags.filter((p) => p.viva === 1).length,
      pagamentosRecebidos: recebidos.length,
      pagamentosDevolvidos: pags.filter((p) => p.estado === "reembolsado").length,
      movimentos: movimentos.get(id) ?? 0,
    };
    const pedidoId = numero(n.pedidoId);
    const lista = negociacoesDoPedido.get(pedidoId) ?? [];
    lista.push(negociacao);
    negociacoesDoPedido.set(pedidoId, lista);
  }

  return pedidos.map((o) => ({
    id: numero(o.id),
    status: (o.status as string | null) ?? null,
    diasParado: numero(o.diasParado),
    dataMarcadaPassou: numero(o.dataPassou) === 1,
    temPreco: numero(o.temPreco) === 1,
    anonimizado: numero(o.anonimizado) === 1,
    negociacoes: negociacoesDoPedido.get(numero(o.id)) ?? [],
  }));
}

/* ──────────────────────────────────────────────────────────────────────────
 * A: ANONIMIZAR UM PEDIDO
 * ────────────────────────────────────────────────────────────────────────── */

export type PedidoAnonimizado = {
  pedidoId: number;
  fotografias: number;
  fotografiasApagadas: number;
  eventoApagado: boolean;
};

/**
 * TIRA O CLIENTE DE UM PEDIDO, E DEIXA A LINHA DE PÉ.
 *
 * Numa transacção: o pedido (pela lista `COMO_SE_ANONIMIZA_O_PEDIDO`), as
 * provas e os ajustes das negociações (sem as fotografias), o bloco de notas
 * da Vitória com a morada, e a linha no registo. O `updatedAt` fica como
 * estava — as comissões contam pela data da conclusão e, nos antigos, por ele.
 *
 * Depois do commit, e fora da ligação: as fotografias saem do Blob — menos as
 * que outro pedido ainda usa (`semAsQueOutroPedidoUsa`, o «Duplicar») — e o
 * evento sai da agenda do Google (leva o nome, o telefone e a morada); se a
 * Google recusar, fica na lista de arrumação que o cron tenta todas as noites.
 *
 * NÃO MEXE NO DINHEIRO: as colunas das negociações que a carteira, os
 * Pagamentos, as Finanças e as comissões lêem não são tocadas. Devolve `null`
 * se o pedido já não existir ou já tiver sido anonimizado.
 */
export async function anonimizarPedido(pedidoId: number): Promise<PedidoAnonimizado | null> {
  await ensureSimulatorOrdersTable();
  await ensureNegociacoesTable();
  await ensureRegistoTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const existem = await tabelasQueExistem(["whatsappRecolhas"]);

  const lidas = [...new Set([...COLUNAS_QUE_A_ANONIMIZACAO_REESCREVE, "serviceType", "city", "calendarEventId", "calendarTargetId"])];
  const conn = await pool.getConnection();
  let fotos: string[] = [];
  let evento: { id: string | null; agenda: string | null } = { id: null, agenda: null };
  try {
    await conn.beginTransaction();
    const [rows] = (await conn.execute(
      `SELECT ${lidas.join(", ")} FROM simulatorOrders WHERE id = ? AND anonimizadoEm IS NULL FOR UPDATE`,
      [pedidoId],
    )) as [Linha[], unknown];
    const pedido = rows[0];
    if (!pedido) {
      await conn.rollback();
      return null;
    }
    const [negs] = (await conn.execute(
      "SELECT id, provaJson, ajustesJson FROM negociacoes WHERE pedidoId = ? FOR UPDATE",
      [pedidoId],
    )) as [Linha[], unknown];

    fotos = [
      ...ficheirosDoPedido(pedido.filesJson, pedido.rawOrderJson),
      ...negs.flatMap((n) => [...fotografiasDaProvaAnonimizavel(n.provaJson), ...fotografiasDosAjustes(n.ajustesJson)]),
    ];
    evento = {
      id: (pedido.calendarEventId as string | null) ?? null,
      agenda: (pedido.calendarTargetId as string | null) ?? null,
    };

    const novos = valoresDoPedidoAnonimizado(pedido);
    const colunas = Object.keys(novos);
    await conn.execute(
      `UPDATE simulatorOrders
          SET ${colunas.map((c) => `${c} = ?`).join(", ")},
              anonimizadoEm = NOW(), updatedAt = updatedAt
        WHERE id = ? AND anonimizadoEm IS NULL`,
      [...colunas.map((c) => novos[c] as string | null), pedidoId],
    );

    for (const n of negs) {
      if (n.provaJson == null && n.ajustesJson == null) continue;
      await conn.execute(
        "UPDATE negociacoes SET provaJson = ?, ajustesJson = ?, updatedAt = updatedAt WHERE id = ?",
        [provaAnonimizada(n.provaJson), n.ajustesJson == null ? null : ajustesSemFotografias(n.ajustesJson), numero(n.id)],
      );
    }

    if (existem.has("whatsappRecolhas")) {
      await conn.execute("DELETE FROM whatsappRecolhas WHERE pedidoId = ?", [pedidoId]);
    }

    await registarNaTransaccao(conn, {
      acontecimento: "pedido_anonimizado",
      pedidoId,
      autorTipo: "sistema",
      autorNome: "retenção",
      estadoDepois: "anonimizado",
      servicoTipo: (pedido.serviceType as string | null) ?? null,
      zona: (pedido.city as string | null) ?? null,
      resumo:
        `Pedido anonimizado, ${DIAS_ATE_ANONIMIZAR_OS_TRABALHOS} dias depois de fechado (d32): ficam o serviço, ` +
        `a localidade, o primeiro nome, as datas e os valores; saíram os contactos, a morada, a descrição e ${fotos.length} ficheiro(s).`,
      detalhe: { fotografias: fotos.length },
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

  const fotografiasApagadas = await apagarFotosDoBlob(await semAsQueOutroPedidoUsa(fotos));

  let eventoApagado = false;
  if (evento.id && !evento.id.startsWith("clyon-order-")) {
    const { apagarEventoDoCalendario } = await import("./apagar-evento-do-calendario");
    const fim = await apagarEventoDoCalendario(evento.id, evento.agenda);
    eventoApagado = Boolean(fim.apagado);
    if (fim.erro || fim.naoEncontrado) {
      await guardarEventoPorApagar(evento.id, evento.agenda, pedidoId, fim.erro ?? "404 — evento ou agenda");
    }
  }

  return { pedidoId, fotografias: fotos.length, fotografiasApagadas, eventoApagado };
}

/* ──────────────────────────────────────────────────────────────────────────
 * B (e D, e o «rejeitado» de G): A PURGA COM AS REGRAS NOVAS
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * A VERIFICAÇÃO DE ÚLTIMA HORA, EM SQL, ANTES DE CADA APAGAR.
 *
 * A decisão é tomada em JavaScript; o apagar não tem volta. Por isso, mesmo
 * antes de cada `deleteSimulatorOrder`, a base é perguntada outra vez — com a
 * mesma regra escrita à maneira dela: sem trabalho (entregue, confirmado,
 * pago), sem acordo de pé, sem pagamento (recebido, devolvido ou por pagar),
 * sem movimento na carteira, e nunca um concluído com preço. Se a resposta
 * mudou entretanto, o pedido fica.
 */
async function aindaSePodeApagar(pedidoId: number): Promise<boolean> {
  const pool = await getPool();
  if (!pool) return false;
  const existem = await tabelasQueExistem(["pagamentos", "movimentosDaCarteira"]);
  const [r] = (await pool.execute(
    `SELECT o.id FROM simulatorOrders o
      WHERE o.id = ? AND o.anonimizadoEm IS NULL
        AND (o.scheduledDate IS NULL OR o.scheduledDate < CURDATE())
        AND NOT EXISTS (
          SELECT 1 FROM negociacoes g
           WHERE g.pedidoId = o.id
             AND (g.estado IN ('acordada', 'aguarda_contratacao')
                  OR g.execucaoEnviadaEm IS NOT NULL
                  OR g.confirmadoEm IS NOT NULL
                  OR g.pagoEm IS NOT NULL
                  OR (g.valorAcordado IS NOT NULL
                      AND COALESCE(o.status, 'pendente') NOT IN ('cancelado', 'arquivado', 'rejeitado'))))
        AND NOT (COALESCE(o.status, 'pendente') = 'concluido'
                 AND (o.precoFinal IS NOT NULL OR o.lucroManual IS NOT NULL
                      OR o.valorFixoClyon IS NOT NULL OR o.precoClienteClyon IS NOT NULL))
        ${
          existem.has("pagamentos")
            ? `AND NOT EXISTS (
          SELECT 1 FROM pagamentos p
           WHERE (p.pedidoId = o.id OR p.negociacaoId IN (SELECT g3.id FROM negociacoes g3 WHERE g3.pedidoId = o.id))
             AND (p.negociacaoPaga IS NOT NULL OR p.estado IN ('pago', 'reembolsado')
                  OR (p.estado = 'pendente' AND (p.expiraEm IS NULL OR p.expiraEm > NOW()))))`
            : ""
        }
        ${
          existem.has("movimentosDaCarteira")
            ? `AND NOT EXISTS (
          SELECT 1 FROM movimentosDaCarteira m
           WHERE m.pedidoId = o.id OR m.negociacaoId IN (SELECT g4.id FROM negociacoes g4 WHERE g4.pedidoId = o.id))`
            : ""
        }
      LIMIT 1`,
    [pedidoId],
  )) as [Linha[], unknown];
  return r.length > 0;
}

/**
 * A PURGA DA NOITE COM AS REGRAS NOVAS — em vez de `purgarPedidosTerminados`,
 * e só quando o cron decide que valem.
 *
 * Pela mesma porta de sempre: um de cada vez, por `deleteSimulatorOrder`, que
 * escreve o arquivo e o retrato no registo, apaga as fotografias e o evento —
 * e que tem a sua própria guarda por cima desta (um trabalho em curso não
 * sai). A guarda de dentro NÃO se desarma aqui.
 */
export async function purgarComAsRegrasNovas(opcoes: { aSerio: boolean }): Promise<ResultadoDaPurga> {
  const pedidos = await lerPedidosParaRetencao();
  const aApagar = pedidos
    .map((p) => ({ p, d: decidirComAsRegrasNovas(p) }))
    .filter((x) => x.d.faz === "apagar")
    .sort((a, b) => b.p.diasParado - a.p.diasParado);
  const ids = aApagar.slice(0, PEDIDOS_POR_PASSAGEM_DA_PURGA).map((x) => x.p.id);
  const base = {
    elegiveis: aApagar.length,
    restantes: Math.max(0, aApagar.length - ids.length),
    eventosQueFicaram: 0,
    eventosNaoEncontrados: 0,
  };
  if (!opcoes.aSerio) {
    return { ...base, expurgados: ids.length, falhados: [], fotosApagadas: 0, eventosApagados: 0, aSerio: false, naMira: ids };
  }

  let expurgados = 0;
  let fotosApagadas = 0;
  let eventosApagados = 0;
  let eventosQueFicaram = 0;
  let eventosNaoEncontrados = 0;
  const falhados: Array<{ pedidoId: number; erro: string }> = [];
  for (const { p, d } of aApagar.slice(0, PEDIDOS_POR_PASSAGEM_DA_PURGA)) {
    try {
      if (!(await aindaSePodeApagar(p.id))) {
        falhados.push({ pedidoId: p.id, erro: "a verificação de última hora encontrou trabalho, acordo ou dinheiro — ficou" });
        continue;
      }
      const dias = d.faz === "apagar" && d.regra === "abandonado" ? DIAS_PARA_OS_ABANDONADOS : DIAS_DE_RETENCAO_DOS_PEDIDOS;
      const r = await deleteSimulatorOrder(p.id, {
        motivo: `retenção de ${dias} dias`,
        autorTipo: "sistema",
        autorNome: "retenção",
        acontecimento: "pedido_expurgado",
      });
      expurgados += 1;
      fotosApagadas += r.fotosApagadas;
      if (r.eventoApagado) eventosApagados += 1;
      if (r.eventoNaAgenda) eventosQueFicaram += 1;
      if (r.eventoNaoEncontrado) eventosNaoEncontrados += 1;
    } catch (e) {
      falhados.push({ pedidoId: p.id, erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return {
    ...base,
    expurgados,
    falhados,
    fotosApagadas,
    eventosApagados,
    eventosQueFicaram,
    eventosNaoEncontrados,
    aSerio: true,
    naMira: [],
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * E: OS FICHEIROS QUE NADA REFERENCIA
 * ────────────────────────────────────────────────────────────────────────── */

export type FicheiroNoBlob = { url: string; pathname: string; size: number; uploadedAt: Date };

/**
 * ESTE FICHEIRO É REFERIDO NALGUM SÍTIO DO TEXTO DA BASE?
 *
 * Procura-se o NOME do ficheiro (a última parte do caminho, que leva um UUID,
 * uma hora em milissegundos ou um sufixo aleatório — não há dois iguais), e não
 * o caminho inteiro extraído com uma expressão: um nome com uma vírgula ou um
 * parêntese partia a extracção, e um ficheiro referido passava por órfão. Tal
 * como está, codificado para URL, e descodificado — se qualquer das três
 * formas aparecer, fica.
 */
export function referidoNoTexto(texto: string, pathname: string): boolean {
  const nome = pathname.split("/").pop() ?? pathname;
  if (!nome) return true;
  const formas = new Set<string>([nome, encodeURIComponent(nome), encodeURI(nome)]);
  try {
    formas.add(decodeURIComponent(nome));
  } catch {
    /* um nome que não se descodifica fica só nas outras formas */
  }
  for (const f of formas) if (f && texto.includes(f)) return true;
  return false;
}

/**
 * O QUE ESTÁ REFERENCIADO — em QUALQUER coluna de texto de QUALQUER tabela.
 *
 * Não há lista escrita à mão das tabelas que guardam endereços de ficheiros:
 * pedidos, negociações, provas, ajustes, fotografias pendentes do WhatsApp,
 * anexos das Finanças (que também vão para `simulador/`), fotografias dos
 * profissionais, galeria, arquivo, mensagens. Uma lista assim falha no dia em
 * que alguém guardar um endereço numa tabela nova, e falha apagando. Por isso
 * pergunta-se ao MySQL que colunas de texto há, e procura-se em todas.
 *
 * NA DÚVIDA, FICA: se uma só tabela não se deixar ler, a função atira — e quem
 * chama não apaga nada nessa noite.
 *
 * Devolve o texto das linhas que falam de `simulador/` ou de `trabalhos/`,
 * tudo junto — é nele que `referidoNoTexto` procura cada ficheiro.
 */
export async function textoQueReferenciaFicheiros(): Promise<string> {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [cols] = (await pool.execute(
    `SELECT c.TABLE_NAME AS t, c.COLUMN_NAME AS c
       FROM information_schema.COLUMNS c
       JOIN information_schema.TABLES tb
         ON tb.TABLE_SCHEMA = c.TABLE_SCHEMA AND tb.TABLE_NAME = c.TABLE_NAME AND tb.TABLE_TYPE = 'BASE TABLE'
      WHERE c.TABLE_SCHEMA = DATABASE()
        AND c.DATA_TYPE IN ('char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext', 'json')
        AND (c.CHARACTER_MAXIMUM_LENGTH IS NULL OR c.CHARACTER_MAXIMUM_LENGTH >= 20)`,
  )) as [Array<{ t: string; c: string }>, unknown];

  const porTabela = new Map<string, string[]>();
  for (const { t, c } of cols) {
    const lista = porTabela.get(t) ?? [];
    lista.push(c);
    porTabela.set(t, lista);
  }
  /*
   * SE A LISTA DAS COLUNAS VIER COMPRIDA DE MENOS, NÃO SE CONFIA NELA.
   *
   * Uma lista vazia (sem permissão para o information_schema, outra base, um
   * erro calado) dava um texto vazio — e todos os ficheiros passavam por
   * órfãos. As duas colunas onde vive a maioria deles têm de lá estar.
   */
  for (const [tabela, coluna] of [
    ["simulatorOrders", "filesJson"],
    ["negociacoes", "provaJson"],
  ]) {
    if (!(porTabela.get(tabela) ?? []).includes(coluna)) {
      throw new Error(`a lista das colunas não trouxe ${tabela}.${coluna} — não se confia nela`);
    }
  }

  const partes: string[] = [];
  const q = (nome: string) => "`" + nome.replace(/`/g, "``") + "`";
  for (const [tabela, colunas] of porTabela) {
    // «trabalhos» sozinho é palavra corrente: só com a barra, escrita ou codificada (%2F).
    const onde = colunas
      .map((c) => `${q(c)} LIKE '%simulador%' OR ${q(c)} LIKE '%trabalhos/%' OR ${q(c)} LIKE '%trabalhos%2F%'`)
      .join(" OR ");
    const [linhas] = (await pool.execute(
      `SELECT CONCAT_WS(' ', ${colunas.map(q).join(", ")}) AS texto FROM ${q(tabela)} WHERE ${onde}`,
    )) as [Array<{ texto: string | null }>, unknown];
    for (const l of linhas) if (l.texto) partes.push(String(l.texto));
  }
  return partes.join("\n");
}

/** Os ficheiros dos prefixos dos pedidos, como o Blob os lista. */
export async function ficheirosNoBlob(): Promise<FicheiroNoBlob[]> {
  const { obterTokenDoBlob } = await import("./blob-token");
  const credencial = obterTokenDoBlob();
  if (!credencial.ok) throw new Error(`sem acesso ao Blob: ${credencial.motivo}`);
  const { list } = await import("@vercel/blob");
  const todos: FicheiroNoBlob[] = [];
  for (const prefix of PREFIXOS_DOS_FICHEIROS_DE_PEDIDOS) {
    let cursor: string | undefined;
    for (let pagina = 0; pagina < 50; pagina++) {
      const r = await list({
        prefix,
        cursor,
        limit: 1000,
        ...(credencial.modo === "token" ? { token: credencial.token } : { storeId: credencial.storeId }),
      });
      for (const b of r.blobs) {
        todos.push({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: new Date(b.uploadedAt) });
      }
      if (!r.hasMore || !r.cursor) break;
      cursor = r.cursor;
    }
  }
  return todos;
}

/** Puro: os órfãos com mais de N dias, dados a lista do Blob e o texto da base que fala de ficheiros. */
export function orfaosDe(
  ficheiros: FicheiroNoBlob[],
  texto: string,
  agora: Date,
  dias = DIAS_DOS_FICHEIROS_ORFAOS,
): FicheiroNoBlob[] {
  const limite = agora.getTime() - dias * 86_400_000;
  return ficheiros
    .filter((f) => f.uploadedAt.getTime() < limite)
    .filter((f) => !referidoNoTexto(texto, f.pathname))
    .sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
}

/* ──────────────────────────────────────────────────────────────────────────
 * A NOITE INTEIRA — contar, e (só ligadas) fazer
 * ────────────────────────────────────────────────────────────────────────── */

export type RegrasNovasDaNoite = {
  aSerio: boolean;
  pedidosLidos: number;
  a: {
    pedidos: number;
    feitos: number;
    restantes: number;
    ids: number[];
    ficheiros: number;
    fotografiasDaProva: number;
    fotografiasDosAjustes: number;
    ficheirosPartilhados: number;
    eventos: number;
    ficamPorDinheiro: number;
    ficamComAcordoVivo: number;
    aindaNoPrazo: number;
    jaAnonimizados: number;
    falhados: Array<{ pedidoId: number; erro: string }>;
  };
  b: {
    comAsNovas: number;
    hoje: number;
    semTrabalhoNemDinheiro: number;
    rejeitados: number;
    ids: number[];
  };
  d: { concluidosComPrecoProtegidos: number };
  c: { arquivo: number; registo: number; feitas: number };
  e: { ficheiros: number; bytes: number; maisAntigo: string | null; apagados: number; lista: string[]; erro: string | null };
  f: { contactos: number; apagados: number };
  g: { telemovel: number; apagadas: number };
};

/** Conta os ficheiros de A sem lhes tocar — as mesmas leituras da anonimização. */
async function contarFicheirosDeA(ids: number[]): Promise<{
  ficheiros: number;
  prova: number;
  ajustes: number;
  partilhados: number;
  eventos: number;
}> {
  const r = { ficheiros: 0, prova: 0, ajustes: 0, partilhados: 0, eventos: 0 };
  if (ids.length === 0) return r;
  const pool = await getPool();
  if (!pool) return r;
  const alvo = new Set(ids);
  const [pedidos] = (await pool.execute(
    "SELECT id, filesJson, rawOrderJson, calendarEventId FROM simulatorOrders",
  )) as [Linha[], unknown];
  // Um ficheiro de um pedido de A que outro pedido também usa (o «Duplicar») fica no Blob.
  const usadosPorOutros = new Set<string>();
  for (const o of pedidos) {
    if (alvo.has(numero(o.id))) continue;
    for (const u of ficheirosDoPedido(o.filesJson, o.rawOrderJson)) usadosPorOutros.add(u);
  }
  for (const o of pedidos) {
    if (!alvo.has(numero(o.id))) continue;
    const fs = ficheirosDoPedido(o.filesJson, o.rawOrderJson);
    r.ficheiros += fs.length;
    r.partilhados += fs.filter((u) => usadosPorOutros.has(u)).length;
    const ev = String(o.calendarEventId ?? "").trim();
    if (ev && !ev.startsWith("clyon-order-")) r.eventos += 1;
  }
  const marcas = ids.map(() => "?").join(", ");
  const [negs] = (await pool.execute(
    `SELECT provaJson, ajustesJson FROM negociacoes WHERE pedidoId IN (${marcas})`,
    ids,
  )) as [Linha[], unknown];
  for (const n of negs) {
    r.prova += fotografiasDaProvaAnonimizavel(n.provaJson).length;
    r.ajustes += fotografiasDosAjustes(n.ajustesJson).length;
  }
  return r;
}

/** C: as linhas antigas que ainda têm o cliente. A mesma condição para contar e para fazer. */
const ARQUIVO_COM_CLIENTE = `anonimizadoEm IS NULL AND (clienteEmail IS NOT NULL OR clienteNome LIKE '% %' OR dados NOT LIKE '${DADOS_JA_ANONIMOS}%')`;
const REGISTO_DA_PURGA_COM_CLIENTE = `acontecimento = 'pedido_expurgado' AND anonimizadoEm IS NULL AND (clienteEmail IS NOT NULL OR clienteNome LIKE '% %')`;

/**
 * AS REGRAS NOVAS NUMA NOITE — A, C, E, F e G (a B corre na purga).
 *
 * `aSerio: false` (o ensaio, e o painel): lê e conta, e não muda nada.
 * `aSerio: true` (só com o interruptor ligado e a purga armada): faz.
 *
 * Cada parte isolada das outras: uma que falhe fica com o erro escrito e não
 * leva as seguintes.
 */
export async function regrasNovasDaNoite(opcoes: { aSerio: boolean; agora?: Date }): Promise<RegrasNovasDaNoite> {
  const aSerio = opcoes.aSerio === true;
  const agora = opcoes.agora ?? new Date();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const pedidos = await lerPedidosParaRetencao();
  const decisoes = pedidos.map((p) => ({ p, d: decidirComAsRegrasNovas(p) as Decisao }));
  const porque = (motivo: string) => decisoes.filter((x) => x.d.faz === "fica" && x.d.porque === motivo);
  const paraAnonimizar = decisoes
    .filter((x) => x.d.faz === "anonimizar")
    .sort((a, b) => b.p.diasParado - a.p.diasParado)
    .map((x) => x.p.id);
  const aApagar = decisoes.filter((x) => x.d.faz === "apagar");
  const aindaNoPrazoComTrabalho = decisoes.filter(
    (x) =>
      x.d.faz === "fica" &&
      x.d.porque === "no_prazo" &&
      ["concluido", "cancelado", "arquivado", "rejeitado"].includes(String(x.p.status)) &&
      (x.p.temPreco || x.p.negociacoes.some((n) => n.valorAcordado != null || n.execucaoEnviadaEm || n.pagoEm)),
  );

  const contados = await contarFicheirosDeA(paraAnonimizar);
  const r: RegrasNovasDaNoite = {
    aSerio,
    pedidosLidos: pedidos.length,
    a: {
      pedidos: paraAnonimizar.length,
      feitos: 0,
      restantes: 0,
      ids: paraAnonimizar.slice(0, 200),
      ficheiros: contados.ficheiros,
      fotografiasDaProva: contados.prova,
      fotografiasDosAjustes: contados.ajustes,
      ficheirosPartilhados: contados.partilhados,
      eventos: contados.eventos,
      ficamPorDinheiro: porque("dinheiro_por_acertar").length,
      ficamComAcordoVivo: porque("acordo_vivo").length,
      aindaNoPrazo: aindaNoPrazoComTrabalho.length,
      jaAnonimizados: porque("ja_anonimizado").length,
      falhados: [],
    },
    b: {
      comAsNovas: aApagar.length,
      hoje: pedidos.filter((p) => !p.anonimizado && apagariaHoje(p)).length,
      semTrabalhoNemDinheiro: aApagar.filter((x) => x.d.faz === "apagar" && x.d.regra === "sem_trabalho_nem_dinheiro").length,
      rejeitados: aApagar.filter((x) => x.d.faz === "apagar" && x.d.regra === "rejeitado").length,
      ids: aApagar.map((x) => x.p.id).slice(0, 200),
    },
    d: {
      // Os que a regra de hoje levaria se não fosse a parte D (que já vale).
      concluidosComPrecoProtegidos: pedidos.filter(
        (p) =>
          !p.anonimizado &&
          (p.status ?? "") === "concluido" &&
          p.temPreco &&
          p.dataMarcadaPassou &&
          p.diasParado >= DIAS_DE_RETENCAO_DOS_PEDIDOS &&
          !p.negociacoes.some(
            (n) =>
              n.estado === "acordada" ||
              n.estado === "aguarda_contratacao" ||
              n.valorAcordado != null ||
              n.execucaoEnviadaEm ||
              n.confirmadoEm ||
              n.pagoEm,
          ),
      ).length,
    },
    c: { arquivo: 0, registo: 0, feitas: 0 },
    e: { ficheiros: 0, bytes: 0, maisAntigo: null, apagados: 0, lista: [], erro: null },
    f: { contactos: 0, apagados: 0 },
    g: { telemovel: 0, apagadas: 0 },
  };

  // ── A ──
  if (aSerio) {
    for (const id of paraAnonimizar.slice(0, PEDIDOS_ANONIMIZADOS_POR_NOITE)) {
      try {
        if (await anonimizarPedido(id)) r.a.feitos += 1;
      } catch (e) {
        r.a.falhados.push({ pedidoId: id, erro: e instanceof Error ? e.message : String(e) });
      }
    }
    r.a.restantes = Math.max(0, paraAnonimizar.length - r.a.feitos - r.a.falhados.length);
  }

  // ── C ──
  try {
    await ensureArquivoDePedidosTable();
    await ensureRegistoTable();
    const [ca] = (await pool.execute(`SELECT COUNT(*) AS n FROM arquivoDePedidos WHERE ${ARQUIVO_COM_CLIENTE}`)) as [Linha[], unknown];
    const [cr] = (await pool.execute(`SELECT COUNT(*) AS n FROM registoPermanente WHERE ${REGISTO_DA_PURGA_COM_CLIENTE}`)) as [Linha[], unknown];
    r.c.arquivo = numero(ca[0]?.n);
    r.c.registo = numero(cr[0]?.n);
    if (aSerio) {
      const [linhasA] = (await pool.execute(
        `SELECT id, motivo, clienteNome, dados FROM arquivoDePedidos WHERE ${ARQUIVO_COM_CLIENTE} ORDER BY id ASC LIMIT 1000`,
      )) as [Linha[], unknown];
      for (const l of linhasA) {
        const [u] = (await pool.execute(
          `UPDATE arquivoDePedidos
              SET clienteNome = ?, clienteEmail = NULL, motivo = ?, dados = ?
            WHERE id = ? AND anonimizadoEm IS NULL`,
          [primeiroNome(l.clienteNome), motivoQueFicaNoArquivo(l.motivo), dadosDoArquivoAnonimizados(l.dados), numero(l.id)],
        )) as [{ affectedRows?: number }, unknown];
        r.c.feitas += numero(u?.affectedRows);
      }
      const [linhasR] = (await pool.execute(
        `SELECT id, clienteNome FROM registoPermanente WHERE ${REGISTO_DA_PURGA_COM_CLIENTE} ORDER BY id ASC LIMIT 2000`,
      )) as [Linha[], unknown];
      for (const l of linhasR) {
        /*
         * O SEGUNDO UPDATE DO REGISTO (o primeiro é `anonimizarRegisto`).
         * Só nas linhas da purga, e só o nome e o email do cliente: o resto
         * da linha — e a visibilidade para o profissional — fica como estava.
         */
        const [u] = (await pool.execute(
          `UPDATE registoPermanente SET clienteEmail = NULL, clienteNome = ?
            WHERE id = ? AND acontecimento = 'pedido_expurgado' AND anonimizadoEm IS NULL`,
          [primeiroNome(l.clienteNome), numero(l.id)],
        )) as [{ affectedRows?: number }, unknown];
        r.c.feitas += numero(u?.affectedRows);
      }
    }
  } catch (e) {
    console.error("[regras novas] C:", e instanceof Error ? e.message : e);
  }

  // ── E ──
  try {
    const [ficheiros, texto] = await Promise.all([ficheirosNoBlob(), textoQueReferenciaFicheiros()]);
    const orfaos = orfaosDe(ficheiros, texto, agora);
    /*
     * UM TRAVÃO DE BOM SENSO: a auditoria de 26-10 contou ~130 sem pedido em
     * ~970. Se de repente mais de metade parecer órfã, o mais provável é a
     * leitura ter falhado de uma forma que ninguém previu — e nessa noite
     * não sai nada, e diz-se.
     */
    if (ficheiros.length >= 20 && orfaos.length > ficheiros.length / 2) {
      throw new Error(
        `${orfaos.length} de ${ficheiros.length} ficheiros pareciam sem referência — demasiados para ser verdade; nada apagado`,
      );
    }
    r.e.ficheiros = orfaos.length;
    r.e.bytes = orfaos.reduce((s, f) => s + f.size, 0);
    r.e.maisAntigo = orfaos[0] ? orfaos[0].uploadedAt.toISOString() : null;
    r.e.lista = orfaos.slice(0, 100).map((f) => f.pathname);
    if (aSerio && orfaos.length > 0) {
      r.e.apagados = await apagarFotosDoBlob(orfaos.slice(0, FICHEIROS_ORFAOS_POR_NOITE).map((f) => f.url));
    }
  } catch (e) {
    r.e.erro = e instanceof Error ? e.message : String(e);
    console.error("[regras novas] E (nada apagado):", r.e.erro);
  }

  // ── F ──
  try {
    await ensureLeadsExtended();
    const [c] = (await pool.execute(
      `SELECT COUNT(*) AS n FROM leads WHERE createdAt < NOW() - INTERVAL ${DIAS_DOS_CONTACTOS} DAY`,
    )) as [Linha[], unknown];
    r.f.contactos = numero(c[0]?.n);
    if (aSerio && r.f.contactos > 0) {
      const [d] = (await pool.execute(
        `DELETE FROM leads WHERE createdAt < NOW() - INTERVAL ${DIAS_DOS_CONTACTOS} DAY`,
      )) as [{ affectedRows?: number }, unknown];
      r.f.apagados = numero(d?.affectedRows);
    }
  } catch (e) {
    console.error("[regras novas] F:", e instanceof Error ? e.message : e);
  }

  // ── G (o telemóvel; o «rejeitado» está na decisão de B) ──
  try {
    const existem = await tabelasQueExistem(["whatsappNoTelemovel"]);
    if (existem.has("whatsappNoTelemovel")) {
      const [c] = (await pool.execute(
        `SELECT COUNT(*) AS n FROM whatsappNoTelemovel WHERE quandoUnix < UNIX_TIMESTAMP() - ${DIAS_DO_TELEMOVEL_NAS_REGRAS_NOVAS} * 86400`,
      )) as [Linha[], unknown];
      r.g.telemovel = numero(c[0]?.n);
      if (aSerio && r.g.telemovel > 0) {
        const [d] = (await pool.execute(
          `DELETE FROM whatsappNoTelemovel WHERE quandoUnix < UNIX_TIMESTAMP() - ${DIAS_DO_TELEMOVEL_NAS_REGRAS_NOVAS} * 86400`,
        )) as [{ affectedRows?: number }, unknown];
        r.g.apagadas = numero(d?.affectedRows);
      }
    }
  } catch (e) {
    console.error("[regras novas] G:", e instanceof Error ? e.message : e);
  }

  return r;
}

/** Em MB, com uma casa — para o resumo da noite e o painel. */
export function megas(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1).replace(".", ",");
}

/**
 * O ENSAIO DITO POR PALAVRAS — a frase que entra no resumo de cada noite.
 *
 * *«A purga CONTA e REGISTA o que faria com as regras novas («anonimizaria N
 * pedidos, apagaria N, N ficheiros…»), sem mudar nada.»*
 */
export function regrasNovasEmPalavras(r: RegrasNovasDaNoite): string {
  // Curta de propósito: o resumo do registo tem 500 caracteres, e os números inteiros vão no detalhe.
  const ficheirosDeA = r.a.ficheiros + r.a.fotografiasDaProva + r.a.fotografiasDosAjustes;
  const partes = r.aSerio
    ? [
        `anonimizou ${r.a.feitos} de ${r.a.pedidos} (${ficheirosDeA} ficheiros)`,
        `a purga levou ${r.b.comAsNovas}`,
        r.e.erro ? `órfãos não contados` : `${r.e.apagados} ficheiros órfãos apagados (${megas(r.e.bytes)} MB)`,
        `${r.f.apagados} contactos`,
        `${r.c.feitas} linhas sem nome/email`,
        `${r.g.apagadas} conversas`,
      ]
    : [
        `anonimizaria ${r.a.pedidos} (${ficheirosDeA} ficheiros, ${r.a.eventos} eventos; ${r.a.ficamPorDinheiro} com dinheiro por acertar)`,
        `apagaria ${r.b.comAsNovas} em vez de ${r.b.hoje} (${r.b.semTrabalhoNemDinheiro} sem trabalho nem dinheiro, ${r.b.rejeitados} rejeitados)`,
        r.e.erro ? `órfãos não contados` : `${r.e.ficheiros} ficheiros órfãos (${megas(r.e.bytes)} MB)`,
        `${r.f.contactos} contactos > ${DIAS_DOS_CONTACTOS} dias`,
        `nome/email: ${r.c.arquivo} no arquivo, ${r.c.registo} no registo`,
        `${r.g.telemovel} conversas > ${DIAS_DO_TELEMOVEL_NAS_REGRAS_NOVAS} dias`,
      ];
  return (r.aSerio ? "Regras novas LIGADAS: " : "Regras novas em ENSAIO (nada mudou): ") + partes.join(" · ");
}
