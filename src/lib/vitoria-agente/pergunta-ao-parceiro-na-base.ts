/**
 * A PERGUNTA AO PARCEIRO NA BASE E NOS CANAIS — d97 (23-11-2026).
 *
 *  - `vitoriaPerguntasAoParceiro`: uma linha por pedido + proposta + condição
 *    (a chave única faz a pergunta idempotente: a mesma nunca sai duas vezes);
 *  - `perguntarAoParceiroDeVerdade`: manda a pergunta pelo canal dos avisos ao
 *    profissional — o WhatsApp dos avisos (o interruptor «Avisar o
 *    profissional», a vontade dele `whatsappAvisos`, que o «parar» desliga, e
 *    a fila da ponte) e o aviso na app Pro — e regista-a;
 *  - `respostaDoParceiroPeloWhatsApp` (a ponte e o webhook) e
 *    `respostaDoParceiroPeloPainel` (o painel web): a resposta volta ao
 *    cliente pela orquestra pura (`tratarARespostaDoParceiro`);
 *  - `correrOsPrazosDasPerguntas` (a passagem do assistente, de 10 em 10 min):
 *    sem resposta no prazo → uma pessoa da equipa, com o motivo no cartão.
 *
 * Tudo fica em `vitoriaAccoes` (a sério, `ensaio = 0`) e no painel «Ensaio da
 * Vitória» (`vitoriaEnsaios`, estado `vivo_parceiro`). O interruptor é o de
 * sempre: «Vitória agente — aceitar» (sem ele, a ferramenta passa à equipa e
 * nada disto corre).
 */

import { conversaAnonimizada } from "./anonimizar";
import { correrOAgente, clienteDoClaude, type ResultadoDoAgente } from "./cliente";
import { ferramentasDeVerdade, gastoDeHojeUsd, garantirTabelas, lerInterruptor, quemEscreveNoNumero, registarAccao, tectoDiarioUsd } from "./na-base";
import type { PerguntaAoParceiro } from "./pendentes";
import {
  avisoDaPerguntaNaApp,
  chaveDaPergunta,
  obrigadoAoParceiro,
  lerARespostaDoParceiro,
  motivoDoPrazo,
  pedidoDaPergunta,
  prazoDaPergunta,
  prazoEmPalavras,
  tratarARespostaDoParceiro,
  type DesfechoDaResposta,
  type PerguntaRegistada,
} from "./pergunta-ao-parceiro";
import {
  diaDaEscolha,
  diaOferecido,
  JANELA_DA_RONDA,
  mensagemDeDisponibilidade,
  oQueOParceiroDisse,
  PARCEIROS_POR_RONDA,
  respostaAoClienteDaRonda,
  rondaDe,
} from "./disponibilidade";

export const SQL_DAS_PERGUNTAS_AO_PARCEIRO = `CREATE TABLE IF NOT EXISTS vitoriaPerguntasAoParceiro (
      id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      chave             VARCHAR(80) NOT NULL,
      pedidoId          INT UNSIGNED NOT NULL,
      negociacaoId      INT UNSIGNED NOT NULL,
      providerId        INT UNSIGNED NULL DEFAULT NULL,
      telefoneCliente   VARCHAR(20) NOT NULL,
      telefoneParceiro  VARCHAR(9) NULL DEFAULT NULL,
      parceiro          VARCHAR(160) NOT NULL,
      condicao          VARCHAR(255) NOT NULL,
      mensagem          TEXT NULL,
      estado            VARCHAR(20) NOT NULL DEFAULT 'a_sair',
      canais            VARCHAR(40) NULL DEFAULT NULL,
      perguntadoEm      DATETIME NOT NULL,
      prazoEm           DATETIME NOT NULL,
      respondidoEm      DATETIME NULL DEFAULT NULL,
      leitura           VARCHAR(10) NULL DEFAULT NULL,
      resposta          VARCHAR(500) NULL DEFAULT NULL,
      UNIQUE KEY uq_pergunta (chave),
      KEY idx_pergunta_parceiro (telefoneParceiro, estado),
      KEY idx_pergunta_prazo (estado, prazoEm),
      KEY idx_pergunta_provider (providerId, estado)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

export const SQL_DA_RONDA = "ALTER TABLE vitoriaPerguntasAoParceiro ADD COLUMN ronda VARCHAR(80) NULL DEFAULT NULL";

let pronta = false;
async function pool() {
  const p = await garantirTabelas();
  if (!pronta) {
    await p.execute(SQL_DAS_PERGUNTAS_AO_PARCEIRO);
    // d136: a ronda das datas (a mesma pergunta a vários parceiros, a resposta junta ao cliente).
    await p.execute(SQL_DA_RONDA).catch((e: { code?: string; errno?: number }) => {
      if (e?.code !== "ER_DUP_FIELDNAME" && e?.errno !== 1060) throw e;
    });
    pronta = true;
  }
  return p;
}

const digitos = (t: string | null | undefined) => String(t ?? "").replace(/\D/g, "").slice(-20);
const noves = (t: string | null | undefined) => String(t ?? "").replace(/\D/g, "").slice(-9);
const paraABase = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");


/* ── A ida: a pergunta sai ───────────────────────────────────────────────── */

/**
 * MANDA A PERGUNTA AO PARCEIRO (a sério). Idempotente: a mesma pergunta (pedido,
 * proposta, condição) só sai uma vez. Sem nenhum canal (sem os avisos do
 * WhatsApp ligados e sem a app), não sai — e diz porquê, para passar à equipa.
 */
export async function perguntarAoParceiroDeVerdade(
  telefoneCliente: string,
  p: PerguntaAoParceiro,
  agora: Date = new Date(),
): Promise<{ ok: true; jaPerguntado?: boolean; ate?: string } | { ok: false; porque: string }> {
  const db = await import("../db");
  const base = await pool();
  // d136: a ronda das datas conta as 2 h na janela de contacto (d7).
  const prazo = p.rondaId ? prazoDaPergunta(agora, undefined, JANELA_DA_RONDA) : prazoDaPergunta(agora);
  const [ins] = (await base.execute(
    `INSERT IGNORE INTO vitoriaPerguntasAoParceiro
       (chave, pedidoId, negociacaoId, telefoneCliente, parceiro, condicao, mensagem, estado, perguntadoEm, prazoEm, ronda)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'a_sair', ?, ?, ?)`,
    [
      chaveDaPergunta(p),
      p.pedidoId,
      p.negociacaoId,
      digitos(telefoneCliente),
      p.parceiro.slice(0, 160),
      p.condicao.slice(0, 255),
      p.mensagem,
      paraABase(agora),
      paraABase(prazo),
      p.rondaId ? p.rondaId.slice(0, 60) : null,
    ],
  )) as [{ affectedRows?: number; insertId?: number }, unknown];
  if (Number(ins.affectedRows ?? 0) === 0) return { ok: true, jaPerguntado: true };
  const id = Number(ins.insertId);

  const linhas = await db.negociacoesDoPedido(p.pedidoId);
  const neg = linhas.find((n) => Number(n.id) === p.negociacaoId) as (Record<string, unknown> & { providerId?: unknown; profissionalTelefone?: string | null }) | undefined;
  const providerId = neg ? Number(neg.providerId) : null;
  const perfil = providerId ? await db.perfilDoProfissional(providerId).catch(() => undefined) : undefined;
  const canais: string[] = [];

  // O WhatsApp: o interruptor de quem manda, a vontade dele (o «parar» desliga-a) e um telemóvel.
  const { enviarAvisoWhatsApp, telemovelParaWhatsApp } = await import("../whatsapp-cloud");
  const telemovel = telemovelParaWhatsApp((neg?.profissionalTelefone as string | null | undefined) ?? (perfil?.phone as string | null | undefined) ?? null);
  const querWhatsApp = Number(perfil?.whatsappAvisos ?? 0) === 1;
  if (telemovel && querWhatsApp && (await db.assistentePode("avisar_profissional").catch(() => false))) {
    if (await enviarAvisoWhatsApp(telemovel, p.mensagem).catch(() => false)) canais.push("whatsapp");
  }
  // A app Pro (e o navegador, se não tiver a app).
  const email = typeof perfil?.email === "string" ? perfil.email : "";
  if (email) {
    const { sendPushToUser } = await import("../webpush");
    const { urlDeAccao } = await import("../url-do-site");
    const aviso = avisoDaPerguntaNaApp(p);
    const n = await sendPushToUser(
      email,
      {
        title: aviso.titulo,
        body: aviso.corpo,
        url: `${urlDeAccao().replace(/\/+$/, "")}/profissionais/painel`,
        tag: `pergunta-do-cliente-${p.pedidoId}`,
        negociacaoId: p.negociacaoId,
        pedidoId: p.pedidoId,
        tipo: "pergunta_do_cliente",
      },
      "pro",
    ).catch(() => 0);
    if (n > 0) canais.push("app");
  }

  if (canais.length === 0) {
    await base.execute("UPDATE vitoriaPerguntasAoParceiro SET estado = 'sem_canal', providerId = ? WHERE id = ?", [providerId, id]);
    const porque = !querWhatsApp ? "o parceiro não tem os avisos do WhatsApp ligados nem a app" : "não saiu por nenhum canal";
    await registarAccao({ ferramenta: "pergunta_ao_parceiro", resultado: { pedidoId: p.pedidoId, parceiro: p.parceiro, saiu: false, porque }, telefone: telefoneCliente, pedidoId: p.pedidoId, ensaio: false });
    return { ok: false, porque };
  }
  await base.execute(
    "UPDATE vitoriaPerguntasAoParceiro SET estado = 'aberta', canais = ?, providerId = ?, telefoneParceiro = ? WHERE id = ?",
    [canais.join(","), providerId, telemovel ? noves(telemovel) : null, id],
  );
  const ate = prazoEmPalavras(prazo, agora);
  await db
    .appendOrderHistory(p.pedidoId, {
      type: "note",
      by: null,
      message: p.rondaId
        ? `A Vitória perguntou a ${p.parceiro} (${canais.join(" e ")}) se consegue «${p.condicao}» (as datas, a todos os parceiros com proposta). As respostas vão juntas ao cliente, até ${ate}.`
        : `A Vitória perguntou a ${p.parceiro} (${canais.join(" e ")}) se consegue «${p.condicao}», a pedido do cliente. Sem resposta até ${ate}, passa à equipa.`,
    })
    .catch(() => {});
  await registarAccao({
    ferramenta: "pergunta_ao_parceiro",
    resultado: { pedidoId: p.pedidoId, negociacaoId: p.negociacaoId, parceiro: p.parceiro, condicao: p.condicao, canais, prazoEm: prazo.toISOString(), saiu: true },
    telefone: telefoneCliente,
    pedidoId: p.pedidoId,
    ensaio: false,
  });
  return { ok: true, ate };
}

/* ── A volta: a resposta do parceiro ────────────────────────────────────── */

function lerLinha(r: Record<string, unknown>): PerguntaRegistada {
  return {
    id: Number(r.id),
    tipo: "parceiro",
    pedidoId: Number(r.pedidoId),
    negociacaoId: Number(r.negociacaoId),
    parceiro: String(r.parceiro ?? ""),
    condicao: String(r.condicao ?? ""),
    mensagem: String(r.mensagem ?? ""),
    propostoEm: String(r.perguntadoEm ?? ""),
    telefoneCliente: String(r.telefoneCliente ?? ""),
    ...(r.ronda ? { rondaId: String(r.ronda) } : {}),
  };
}

/** Uma volta do agente para o CLIENTE, com a nota da resposta do parceiro. Regista no painel (`vivo_parceiro`). */
async function oAgenteComANota(telefoneCliente: string, agora: Date, nota: string, ensaio: { id: number | null }): Promise<ResultadoDoAgente | null> {
  if (!(await lerInterruptor("conversa")).ligado) return null;
  const cliente = clienteDoClaude();
  if (!cliente) return null;
  const db = await import("../db");
  const fio = await db.mensagensDoNumeroWhatsApp(telefoneCliente, 40);
  const { pedidos, quem } = await quemEscreveNoNumero(telefoneCliente);
  const aceitar = (await lerInterruptor("aceitar")).ligado;
  return correrOAgente(
    { conversa: conversaAnonimizada(fio, quem), pedidos, agora, prazoMs: 22_000, nota },
    {
      cliente,
      ferramentas: await ferramentasDeVerdade(telefoneCliente, agora, quem, { aoVivo: true, aceitarLigado: aceitar }),
      gastoETecto: async () => ({ gastoUsd: await gastoDeHojeUsd(agora), tectoUsd: await tectoDiarioUsd() }),
      registar: (l) => registarAccao({ ...l, ensaioId: ensaio.id, telefone: telefoneCliente, pedidoId: pedidos[0] ?? null, ensaio: false }),
    },
  );
}

/** A RESPOSTA DO PARCEIRO, venha de onde vier. Nunca lança. */
async function responderComARespostaDoParceiro(p: PerguntaRegistada, texto: string, origem: "whatsapp" | "painel", agora: Date): Promise<DesfechoDaResposta | null> {
  // d136: a resposta a uma ronda das datas junta-se às dos outros parceiros.
  if (p.rondaId) return responderNaRonda(p, texto, origem, agora);
  try {
    const db = await import("../db");
    const base = await pool();
    const leituraCurta = (() => {
      const l = lerARespostaDoParceiro(texto);
      return l.tipo === "sim" ? `SIM${l.quando ? ` (${l.quando})` : ""}` : l.tipo === "nao" ? "NÃO" : "ambígua";
    })();
    const [novo] = (await base.execute(
      "INSERT INTO vitoriaEnsaios (telefone, pedidoId, mensagemDoCliente, estado) VALUES (?, ?, ?, 'vivo_parceiro')",
      [digitos(p.telefoneCliente), p.pedidoId, `[resposta do parceiro, ${origem === "painel" ? "no painel" : "no WhatsApp"}] ${leituraCurta}`],
    )) as [{ insertId: number }, unknown];
    const ensaio = { id: Number(novo.insertId) as number | null };
    const accoes = await import("./accoes-na-base");
    return await tratarARespostaDoParceiro(
      p,
      texto,
      {
        agora,
        marcarRespondida: async (leitura, t) => {
          const [r] = (await base.execute(
            `UPDATE vitoriaPerguntasAoParceiro SET estado = 'respondida', respondidoEm = UTC_TIMESTAMP(), leitura = ?, resposta = ?
              WHERE id = ? AND estado = 'aberta'`,
            [leitura.tipo, t.replace(/\s+/g, " ").trim().slice(0, 500), p.id],
          )) as [{ affectedRows?: number }, unknown];
          return Number(r.affectedRows ?? 0) === 1;
        },
        historico: (linha) => db.appendOrderHistory(p.pedidoId, { type: "note", by: null, message: linha }),
        clienteInterrompido: () => db.numeroInterrompidoWhatsApp(p.telefoneCliente).catch(() => true),
        propostas: () => accoes.propostasParaEscolherDeVerdade(p.pedidoId),
        pedidoParaOFecho: async () => {
          const { haQueixaNaConversa } = await import("../queixa-na-conversa");
          const fio = await db.mensagensDoNumeroWhatsApp(p.telefoneCliente, 40).catch(() => []);
          return { ...(await accoes.pedidoParaOFechoDeVerdade(p.pedidoId)), queixa: haQueixaNaConversa(fio) };
        },
        correrOAgente: (nota) => oAgenteComANota(p.telefoneCliente, agora, nota, ensaio),
        enviarAoCliente: async (t) => (await import("../whatsapp-cloud")).enviarTextoWhatsApp(p.telefoneCliente, t),
        gravarPendente: (f) => accoes.gravarPendente(p.telefoneCliente, f, false, ensaio.id),
        // d131: a condição confirmada é o dia que o cliente quer — fica já na «Data e hora desejada».
        gravarODiaDesejado: async (d) => {
          await db.updateSimulatorOrder(p.pedidoId, { dataAgendada: new Date(d.em) } as unknown as Parameters<typeof db.updateSimulatorOrder>[1]);
        },
        passarAEquipa: async (motivo, mensagem) => {
          if (mensagem) await (await import("../whatsapp-cloud")).enviarTextoWhatsApp(p.telefoneCliente, mensagem).catch(() => false);
          await db.interromperNumeroWhatsApp(p.telefoneCliente, motivo.slice(0, 480)).catch(() => {});
        },
        registar: async (l) => {
          const r = l.resultado ?? null;
          await base
            .execute(
              `UPDATE vitoriaEnsaios SET respostaDoAgente = ?, teriaFeitoJson = ?, motivo = ?, modelo = ?,
                 tokensEntrada = ?, tokensSaida = ?, tokensCacheLidos = ?, tokensCacheEscritos = ?, custoUsd = ? WHERE id = ?`,
              [
                l.texto ? l.texto.slice(0, 4000) : null,
                JSON.stringify(l.teriaFeito).slice(0, 4000),
                l.motivo ? l.motivo.slice(0, 255) : null,
                r?.modelo ?? null,
                r?.uso.entrada ?? 0,
                r?.uso.saida ?? 0,
                r?.uso.cacheLidos ?? 0,
                r?.uso.cacheEscritos ?? 0,
                r?.custoUsd ?? 0,
                ensaio.id,
              ],
            )
            .catch(() => {});
          await registarAccao({
            ferramenta: "resposta_do_parceiro",
            resultado: { pedidoId: p.pedidoId, parceiro: p.parceiro, leitura: leituraCurta, origem, teriaFeito: l.teriaFeito },
            texto: l.texto,
            telefone: p.telefoneCliente,
            pedidoId: p.pedidoId,
            ensaioId: ensaio.id,
            ensaio: false,
          });
        },
      },
      origem,
    );
  } catch (e) {
    console.error("[vitoria-agente] a resposta do parceiro falhou:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * O PARCEIRO ESCREVEU NO WHATSAPP: é a resposta a uma pergunta da Vitória? Só
 * quando a última mensagem que lhe saiu é a pergunta desse pedido (e ela está
 * aberta). Devolve true se tratou (a mensagem não segue para mais nada).
 * Numa conversa que uma pessoa da equipa tem com ele, trata em silêncio (não
 * lhe escreve o obrigado). Nunca lança.
 */
export async function respostaDoParceiroPeloWhatsApp(telefone: string, texto: string, opcoes: { interrompido?: boolean } = {}): Promise<boolean> {
  try {
    if (!String(texto ?? "").trim() || noves(telefone).length !== 9) return false;
    const base = await pool();
    const [rows] = (await base.execute(
      `SELECT * FROM vitoriaPerguntasAoParceiro WHERE telefoneParceiro = ? AND estado = 'aberta' ORDER BY id DESC LIMIT 5`,
      [noves(telefone)],
    )) as [Array<Record<string, unknown>>, unknown];
    if (rows.length === 0) return false;
    const db = await import("../db");
    const [ultima] = (await db.saidasDoNumeroWhatsApp(telefone, 1)).slice(-1);
    const pedidoId = pedidoDaPergunta(ultima?.texto);
    const linha = rows.find((r) => Number(r.pedidoId) === pedidoId);
    if (!linha) return false;
    const p = lerLinha(linha);
    const desfecho = await responderComARespostaDoParceiro(p, texto, "whatsapp", new Date());
    if (desfecho == null) return false;
    if (desfecho !== "ja_respondida" && !opcoes.interrompido) {
      const { enviarAvisoWhatsApp } = await import("../whatsapp-cloud");
      const obrigado = p.rondaId ? obrigadoNaRonda(p.pedidoId) : obrigadoAoParceiro(p.pedidoId, lerARespostaDoParceiro(texto));
      await enviarAvisoWhatsApp(telefone, obrigado).catch(() => false);
    }
    return true;
  } catch (e) {
    console.error("[vitoria-agente] não li a resposta do parceiro:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** As perguntas em aberto a este parceiro (para o painel web). */
export async function perguntasAbertasDoParceiro(providerId: number): Promise<Array<{ id: number; pedidoId: number; condicao: string; perguntadoEm: string; prazoEm: string }>> {
  const base = await pool();
  const [rows] = (await base.execute(
    `SELECT id, pedidoId, condicao, perguntadoEm, prazoEm FROM vitoriaPerguntasAoParceiro
      WHERE providerId = ? AND estado = 'aberta' ORDER BY id DESC LIMIT 10`,
    [providerId],
  )) as [Array<Record<string, unknown>>, unknown];
  const { instanteDaBase } = await import("../hora-de-lisboa");
  return rows.map((r) => ({
    id: Number(r.id),
    pedidoId: Number(r.pedidoId),
    condicao: String(r.condicao ?? ""),
    perguntadoEm: instanteDaBase(r.perguntadoEm as string | Date | null)?.toISOString() ?? "",
    prazoEm: instanteDaBase(r.prazoEm as string | Date | null)?.toISOString() ?? "",
  }));
}

/** O parceiro respondeu no painel (SIM / NÃO, e quando). Só a pergunta dele, e só aberta. */
export async function respostaDoParceiroPeloPainel(
  providerId: number,
  perguntaId: number,
  resposta: "sim" | "nao",
  quando: string | null,
): Promise<{ ok: true; texto: string } | { ok: false; porque: string; estado: number }> {
  const base = await pool();
  const [rows] = (await base.execute("SELECT * FROM vitoriaPerguntasAoParceiro WHERE id = ? AND providerId = ? LIMIT 1", [perguntaId, providerId])) as [
    Array<Record<string, unknown>>,
    unknown,
  ];
  const linha = rows[0];
  if (!linha) return { ok: false, porque: "Esta pergunta não é sua.", estado: 404 };
  if (String(linha.estado) !== "aberta") return { ok: false, porque: "Esta pergunta já foi respondida ou passou à equipa.", estado: 409 };
  const q = String(quando ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const texto = resposta === "sim" ? `sim${q ? `, ${q}` : ""}` : "não";
  const desfecho = await responderComARespostaDoParceiro(lerLinha(linha), texto, "painel", new Date());
  if (desfecho == null) return { ok: false, porque: "Não foi possível passar a resposta. Tente de novo ou responda no WhatsApp.", estado: 500 };
  if (desfecho === "ja_respondida") return { ok: false, porque: "Esta pergunta já foi respondida.", estado: 409 };
  return {
    ok: true,
    texto: desfecho === "equipa" ? "Obrigado! Uma pessoa da equipa confirma a sua resposta com o cliente." : "Obrigado! A sua resposta já seguiu para o cliente.",
  };
}

/* ── O prazo ────────────────────────────────────────────────────────────── */

/**
 * AS PERGUNTAS SEM RESPOSTA NO PRAZO (2 h dentro das 9h–20h) passam à equipa:
 * a conversa do cliente fica para uma pessoa, com o motivo («À espera do
 * parceiro há 2 h — …») no cartão. Uma vez por pergunta. Nunca lança.
 */
export async function correrOsPrazosDasPerguntas(): Promise<{ linhas: string[] }> {
  const linhas: string[] = [];
  try {
    const base = await pool();
    const db = await import("../db");
    const [rows] = (await base.execute(
      "SELECT * FROM vitoriaPerguntasAoParceiro WHERE estado = 'aberta' AND prazoEm <= UTC_TIMESTAMP() ORDER BY id ASC LIMIT 20",
    )) as [Array<Record<string, unknown>>, unknown];
    const rondas = new Set<string>();
    for (const r of rows) {
      const p = lerLinha(r);
      const [u] = (await base.execute("UPDATE vitoriaPerguntasAoParceiro SET estado = 'expirou' WHERE id = ? AND estado = 'aberta'", [p.id])) as [
        { affectedRows?: number },
        unknown,
      ];
      if (Number(u.affectedRows ?? 0) !== 1) continue;
      // d136: na ronda das datas, o prazo não passa à equipa: o cliente lê o que já respondeu (abaixo).
      if (p.rondaId) {
        rondas.add(p.rondaId);
        linhas.push(`#${p.pedidoId} (${p.parceiro}, datas)`);
        continue;
      }
      const motivo = motivoDoPrazo(p);
      await db.interromperNumeroWhatsApp(p.telefoneCliente, motivo.slice(0, 480)).catch(() => {});
      await db.appendOrderHistory(p.pedidoId, { type: "note", by: null, message: `${p.parceiro} não respondeu à pergunta da Vitória «${p.condicao}» a tempo: passou à equipa.` }).catch(() => {});
      await base
        .execute("INSERT INTO vitoriaEnsaios (telefone, pedidoId, mensagemDoCliente, teriaFeitoJson, estado, motivo) VALUES (?, ?, ?, ?, 'vivo_parceiro', ?)", [
          digitos(p.telefoneCliente),
          p.pedidoId,
          "[sem resposta do parceiro]",
          JSON.stringify([`o parceiro não respondeu em 2 h — #${p.pedidoId}, ${p.parceiro}`, `passou à equipa: ${motivo}`]),
          motivo.slice(0, 255),
        ])
        .catch(() => {});
      await registarAccao({ ferramenta: "pergunta_sem_resposta", resultado: { pedidoId: p.pedidoId, parceiro: p.parceiro, motivo }, telefone: p.telefoneCliente, pedidoId: p.pedidoId, ensaio: false });
      linhas.push(`#${p.pedidoId} (${p.parceiro})`);
    }
    for (const ronda of rondas) await responderAoClienteDaRonda(ronda).catch(() => {});
  } catch (e) {
    console.error("[vitoria-agente] os prazos das perguntas falharam:", e instanceof Error ? e.message : e);
  }
  return { linhas };
}

/* ── d136: as datas a todos os parceiros (a ronda) ──────────────────────── */

/** O obrigado ao parceiro que respondeu às datas. */
export function obrigadoNaRonda(pedidoId: number): string {
  return `Obrigada! Já anotei a sua resposta sobre o pedido #${pedidoId} — digo ao cliente quem pode e quando.`;
}

/**
 * A RONDA SAI: a pergunta das datas, uma por parceiro (a mesma ida da d97 —
 * o WhatsApp dos avisos e a app Pro —, cada uma registada com a `ronda`).
 * Devolve quem a recebeu e quem não tinha canal.
 */
export async function perguntarARondaDeVerdade(
  telefoneCliente: string,
  p: PerguntaAoParceiro,
  agora: Date = new Date(),
): Promise<{ ok: true; saiu: string[]; naoSaiu: string[] } | { ok: false; porque: string }> {
  const ronda = (p.ronda ?? []).slice(0, PARCEIROS_POR_RONDA);
  if (ronda.length === 0) return { ok: false, porque: "sem parceiros na ronda" };
  const rondaId = p.rondaId ?? rondaDe(p.pedidoId, p.propostoEm);
  const saiu: string[] = [];
  const naoSaiu: string[] = [];
  for (const x of ronda) {
    const um: PerguntaAoParceiro = {
      tipo: "parceiro",
      pedidoId: p.pedidoId,
      negociacaoId: x.negociacaoId,
      parceiro: x.parceiro,
      condicao: p.condicao,
      mensagem: x.mensagem,
      propostoEm: p.propostoEm,
      rondaId,
    };
    const q = await perguntarAoParceiroDeVerdade(telefoneCliente, um, agora).catch(() => ({ ok: false as const, porque: "falhou" }));
    (q.ok ? saiu : naoSaiu).push(x.parceiro);
  }
  return { ok: true, saiu, naoSaiu };
}

/**
 * AS DATAS PELO CAMINHO DAS REGRAS (sem o agente): o cliente escreveu um dia e
 * uma hora sem ter escolhido. As propostas abertas do pedido (até 4) recebem
 * a pergunta. Devolve se saiu para alguém.
 */
export async function perguntarDatasATodosDeVerdade(telefoneCliente: string, pedidoId: number, quando: string, agora: Date = new Date()): Promise<boolean> {
  try {
    if (!(await lerInterruptor("aceitar")).ligado) return false;
    const accoes = await import("./accoes-na-base");
    const lista = (await accoes.propostasParaEscolherDeVerdade(pedidoId)).slice(0, PARCEIROS_POR_RONDA);
    if (lista.length === 0) return false;
    const mensagem = mensagemDeDisponibilidade(pedidoId, quando);
    const propostoEm = agora.toISOString();
    const p: PerguntaAoParceiro = {
      tipo: "parceiro",
      pedidoId,
      negociacaoId: lista[0].negociacaoId,
      parceiro: lista.map((x) => x.parceiro).join(", "),
      condicao: quando.replace(/\s+/g, " ").trim().slice(0, 160) || "quando pode fazer o serviço",
      mensagem,
      propostoEm,
      ronda: lista.map((x) => ({ negociacaoId: x.negociacaoId, parceiro: x.parceiro, mensagem })),
      rondaId: rondaDe(pedidoId, propostoEm),
    };
    const r = await perguntarARondaDeVerdade(telefoneCliente, p, agora);
    return r.ok && r.saiu.length > 0;
  } catch (e) {
    console.error("[vitoria-agente] as datas aos parceiros não saíram:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** A resposta de um parceiro da ronda: regista-a e, se for a última, responde ao cliente. Nunca lança. */
async function responderNaRonda(p: PerguntaRegistada, texto: string, origem: "whatsapp" | "painel", agora: Date): Promise<DesfechoDaResposta | null> {
  try {
    const db = await import("../db");
    const base = await pool();
    const leitura = lerARespostaDoParceiro(texto);
    const [r] = (await base.execute(
      `UPDATE vitoriaPerguntasAoParceiro SET estado = 'respondida', respondidoEm = UTC_TIMESTAMP(), leitura = ?, resposta = ?
        WHERE id = ? AND estado = 'aberta'`,
      [leitura.tipo, texto.replace(/\s+/g, " ").trim().slice(0, 500), p.id],
    )) as [{ affectedRows?: number }, unknown];
    if (Number(r.affectedRows ?? 0) !== 1) return "ja_respondida";
    const disse = oQueOParceiroDisse(texto);
    await db
      .appendOrderHistory(p.pedidoId, {
        type: "note",
        by: null,
        message: `${p.parceiro} respondeu à pergunta das datas da Vitória «${p.condicao}»: ${disse} (${origem === "painel" ? "no painel" : "no WhatsApp"}).`,
      })
      .catch(() => {});
    await registarAccao({
      ferramenta: "resposta_do_parceiro",
      resultado: { pedidoId: p.pedidoId, parceiro: p.parceiro, leitura: disse, origem, ronda: p.rondaId },
      telefone: p.telefoneCliente,
      pedidoId: p.pedidoId,
      ensaio: false,
    });
    if (p.rondaId) await responderAoClienteDaRonda(p.rondaId, agora);
    return leitura.tipo === "nao" ? "nao" : "sim";
  } catch (e) {
    console.error("[vitoria-agente] a resposta da ronda falhou:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * A RONDA ACABOU? Quando nenhuma pergunta dela está aberta (todos
 * responderam, ou o prazo passou), o cliente lê numa mensagem curta quem pode
 * e quando, e qual prefere. Uma vez por ronda (a ronda ganha um «!» quando a
 * mensagem sai). Ninguém respondeu: passa à equipa. Uma pessoa com a conversa:
 * fica no histórico, e não se escreve ao cliente.
 */
async function responderAoClienteDaRonda(rondaId: string, agora: Date = new Date()): Promise<void> {
  const base = await pool();
  const db = await import("../db");
  const [rows] = (await base.execute(
    `SELECT id, pedidoId, parceiro, estado, resposta, telefoneCliente, condicao FROM vitoriaPerguntasAoParceiro
      WHERE ronda = ? AND estado IN ('aberta', 'respondida', 'expirou') ORDER BY id ASC`,
    [rondaId],
  )) as [Array<Record<string, unknown>>, unknown];
  if (rows.length === 0 || rows.some((r) => String(r.estado) === "aberta")) return;
  const [u] = (await base.execute("UPDATE vitoriaPerguntasAoParceiro SET ronda = ? WHERE ronda = ?", [`${rondaId.slice(0, 78)}!`, rondaId])) as [
    { affectedRows?: number },
    unknown,
  ];
  if (Number(u.affectedRows ?? 0) === 0) return;
  const pedidoId = Number(rows[0].pedidoId);
  const telefone = String(rows[0].telefoneCliente ?? "");
  const condicao = String(rows[0].condicao ?? "");
  const respostas = rows.map((r) => ({ parceiro: String(r.parceiro ?? ""), resposta: String(r.estado) === "respondida" ? String(r.resposta ?? "") : null }));
  if (respostas.every((r) => r.resposta == null)) {
    const motivo = `À espera dos parceiros há 2 h — pedido #${pedidoId}: nenhum respondeu se consegue «${condicao}». Responder ao cliente`;
    await db.interromperNumeroWhatsApp(telefone, motivo.slice(0, 480)).catch(() => {});
    await db.appendOrderHistory(pedidoId, { type: "note", by: null, message: `Nenhum parceiro respondeu à pergunta das datas «${condicao}» a tempo: passou à equipa.` }).catch(() => {});
    await registarAccao({ ferramenta: "pergunta_sem_resposta", resultado: { pedidoId, ronda: rondaId, motivo }, telefone, pedidoId, ensaio: false });
    return;
  }
  const texto = respostaAoClienteDaRonda(pedidoId, respostas);
  if (await db.numeroInterrompidoWhatsApp(telefone).catch(() => true)) {
    await db.appendOrderHistory(pedidoId, { type: "note", by: null, message: `As respostas dos parceiros às datas (uma pessoa tem a conversa — dizer ao cliente): ${texto}` }).catch(() => {});
    return;
  }
  const saiu = await (await import("../whatsapp-cloud")).enviarTextoWhatsApp(telefone, texto).catch(() => false);
  await db.appendOrderHistory(pedidoId, { type: "note", by: null, message: `A Vitória disse ao cliente as respostas dos parceiros às datas${saiu ? "" : " (não saiu)"}.` }).catch(() => {});
  await base
    .execute("INSERT INTO vitoriaEnsaios (telefone, pedidoId, mensagemDoCliente, respostaDoAgente, teriaFeitoJson, estado) VALUES (?, ?, ?, ?, ?, 'vivo_parceiro')", [
      digitos(telefone),
      pedidoId,
      "[as respostas dos parceiros às datas]",
      texto.slice(0, 4000),
      JSON.stringify([`disse ao cliente as respostas da ronda das datas (#${pedidoId}, ${respostas.length} parceiros)`]),
    ])
    .catch(() => {});
  await registarAccao({ ferramenta: "ronda_das_datas", resultado: { pedidoId, ronda: rondaId, saiu, quantos: respostas.length }, texto, telefone, pedidoId, ensaio: false });
  void agora;
}

/**
 * O DIA DA ESCOLHA DEPOIS DA RONDA: o parceiro escolhido respondeu às datas
 * (nos últimos 7 dias)? Então o fecho leva o dia — o que o cliente disse ao
 * escolher, ou o que o parceiro ofereceu. Sem ronda: null (o fecho de sempre).
 */
export async function diaOferecidoNaRonda(
  pedidoId: number,
  negociacaoId: number,
  textoDoCliente: string,
  agora: Date = new Date(),
): Promise<{ em: string; dito: string } | null> {
  try {
    const base = await pool();
    const [rows] = (await base.execute(
      `SELECT resposta, respondidoEm FROM vitoriaPerguntasAoParceiro
        WHERE pedidoId = ? AND negociacaoId = ? AND ronda IS NOT NULL AND estado = 'respondida'
          AND respondidoEm >= UTC_TIMESTAMP() - INTERVAL 7 DAY
        ORDER BY id DESC LIMIT 1`,
      [pedidoId, negociacaoId],
    )) as [Array<Record<string, unknown>>, unknown];
    const r = rows[0];
    if (!r) return null;
    const { instanteDaBase } = await import("../hora-de-lisboa");
    const em = instanteDaBase(r.respondidoEm as string | Date | null) ?? agora;
    return diaDaEscolha(textoDoCliente, diaOferecido(String(r.resposta ?? ""), em), agora);
  } catch {
    return null;
  }
}
