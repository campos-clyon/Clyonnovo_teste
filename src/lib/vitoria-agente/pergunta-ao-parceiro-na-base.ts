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

let pronta = false;
async function pool() {
  const p = await garantirTabelas();
  if (!pronta) {
    await p.execute(SQL_DAS_PERGUNTAS_AO_PARCEIRO);
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
  const prazo = prazoDaPergunta(agora);
  const [ins] = (await base.execute(
    `INSERT IGNORE INTO vitoriaPerguntasAoParceiro
       (chave, pedidoId, negociacaoId, telefoneCliente, parceiro, condicao, mensagem, estado, perguntadoEm, prazoEm)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'a_sair', ?, ?)`,
    [chaveDaPergunta(p), p.pedidoId, p.negociacaoId, digitos(telefoneCliente), p.parceiro.slice(0, 160), p.condicao.slice(0, 255), p.mensagem, paraABase(agora), paraABase(prazo)],
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
      message: `A Vitória perguntou a ${p.parceiro} (${canais.join(" e ")}) se consegue «${p.condicao}», a pedido do cliente. Sem resposta até ${ate}, passa à equipa.`,
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
      await enviarAvisoWhatsApp(telefone, obrigadoAoParceiro(p.pedidoId, lerARespostaDoParceiro(texto))).catch(() => false);
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
    for (const r of rows) {
      const p = lerLinha(r);
      const [u] = (await base.execute("UPDATE vitoriaPerguntasAoParceiro SET estado = 'expirou' WHERE id = ? AND estado = 'aberta'", [p.id])) as [
        { affectedRows?: number },
        unknown,
      ];
      if (Number(u.affectedRows ?? 0) !== 1) continue;
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
  } catch (e) {
    console.error("[vitoria-agente] os prazos das perguntas falharam:", e instanceof Error ? e.message : e);
  }
  return { linhas };
}
