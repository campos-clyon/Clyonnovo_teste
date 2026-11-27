import { appendOrderHistory, assistentePode, getPool, getSimulatorOrderById } from "./db";
import type { AvisoAEquipa } from "./avisos-a-equipa";
import { instanteDaBase, diaEmLisboa } from "./hora-de-lisboa";
import {
  avisoAEquipaDaMensagem,
  avisoAoClienteDaResposta,
  avisoAoParceiroDaAlteracao,
  chaveDoAvisoAoCliente,
  chaveDoAvisoAoParceiro,
  eHojeOuAmanha,
  HORA_DO_PRIMEIRO_AVISO,
  HORA_DO_ULTIMO_AVISO,
  mensagemPorResponder,
  motivoDaEquipa,
  pedeAlteracao,
  quandoAvisarOCliente,
  VITORIA_NO_HISTORICO,
} from "./mensagem-no-suporte";
import { pecasEmLisboa } from "./hora-de-lisboa";
import { urlDeAccao } from "./url-do-site";

/**
 * UMA MENSAGEM NO SUPORTE, NA BASE — d140 (27-11-2026). As regras e as frases
 * estão em `mensagem-no-suporte.ts`; o cérebro da Vitória em
 * `vitoria-agente/resposta-no-suporte.ts`. Corre DEPOIS de a mensagem do
 * cliente estar gravada (com `after`, para o cliente não esperar), e nunca
 * lança: a mensagem já está no pedido.
 *
 * Desliga-se sem deploy: `VITORIA_SUPORTE=desligada` na Vercel cala só a
 * resposta da Vitória (a equipa continua a ser avisada).
 */

let tabelaPronta = false;
async function pool() {
  const p = await getPool();
  if (!p) throw new Error("DB not available");
  if (!tabelaPronta) {
    await p.execute(`
      CREATE TABLE IF NOT EXISTS avisosDoSuporte (
        id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        chave      VARCHAR(120) NOT NULL,
        tipo       VARCHAR(12)  NOT NULL,
        pedidoId   INT UNSIGNED NOT NULL,
        telefone   VARCHAR(32)  NOT NULL,
        texto      VARCHAR(600) NOT NULL,
        enviarEmMs BIGINT       NOT NULL,
        enviadoMs  BIGINT       NULL,
        comoFicou  VARCHAR(12)  NULL,
        criadoEm   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_chave (chave),
        KEY idx_por_enviar (enviadoMs, enviarEmMs)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    tabelaPronta = true;
  }
  return p;
}

/** Guarda o aviso; `false` se já houver um com esta chave (um por pedido e por dia). */
async function guardarOAviso(a: { chave: string; tipo: "cliente" | "parceiro"; pedidoId: number; telefone: string; texto: string; enviarEm: Date }): Promise<boolean> {
  const p = await pool();
  try {
    await p.execute(
      "INSERT INTO avisosDoSuporte (chave, tipo, pedidoId, telefone, texto, enviarEmMs) VALUES (?, ?, ?, ?, ?, ?)",
      [a.chave.slice(0, 120), a.tipo, a.pedidoId, a.telefone.slice(0, 32), a.texto.slice(0, 600), a.enviarEm.getTime()],
    );
    return true;
  } catch (e) {
    if ((e as { code?: string })?.code === "ER_DUP_ENTRY") return false;
    throw e;
  }
}

async function marcar(chave: string, como: "enviado" | "falhou"): Promise<void> {
  const p = await pool();
  await p.execute("UPDATE avisosDoSuporte SET enviadoMs = ?, comoFicou = ? WHERE chave = ?", [Date.now(), como, chave]);
}

function emHorarioDoCliente(agora: Date): boolean {
  const h = pecasEmLisboa(agora).hora;
  return h >= HORA_DO_PRIMEIRO_AVISO && h < HORA_DO_ULTIMO_AVISO;
}

async function enviarWhatsApp(telefone: string, texto: string): Promise<boolean> {
  const { enviarAvisoWhatsApp } = await import("./whatsapp-cloud");
  return enviarAvisoWhatsApp(telefone, texto).catch(() => false);
}

/** O parceiro contratado do pedido (uma negociação acordada e não retirada), com o dia. */
async function parceiroAtribuido(pedidoId: number): Promise<{ providerId: number; negociacaoId: number; telefone: string | null; dia: Date | string | null } | null> {
  const p = await getPool();
  if (!p) return null;
  const [linhas] = (await p.execute(
    `SELECT n.id, n.providerId, n.dataCombinada, pr.phone AS telefone
       FROM negociacoes n
       JOIN providers pr ON pr.id = n.providerId
      WHERE n.pedidoId = ? AND n.estado = 'acordada' AND n.retiradaEm IS NULL
      ORDER BY n.id DESC LIMIT 1`,
    [pedidoId],
  )) as [Array<{ id: number; providerId: number; dataCombinada: Date | string | null; telefone: string | null }>, unknown];
  const l = linhas[0];
  return l ? { providerId: Number(l.providerId), negociacaoId: Number(l.id), telefone: l.telefone ?? null, dia: l.dataCombinada ?? null } : null;
}

/** O aviso à equipa de uma mensagem no pedido. */
function avisoDoPedido(pedidoId: number, desde: Date, passou: boolean, motivo: string | null): AvisoAEquipa {
  const { titulo, corpo } = avisoAEquipaDaMensagem({ origem: "pedido", id: pedidoId, quem: "cliente", passouAEquipa: passou, motivo });
  return {
    chave: `suporte:p${pedidoId}`,
    tipo: "suporte",
    pedidoId,
    telefone: null,
    desde,
    seccao: "suporte",
    titulo,
    corpo,
    url: "/admin?section=suporte",
  };
}

export type ResultadoDaMensagemNoPedido = {
  respondeu: "vitoria" | "equipa" | "nada";
  motivo: string | null;
  avisoAoCliente: "enviado" | "guardado" | "repetido" | "sem_telefone" | "nao";
  parceiroAvisado: boolean;
};

/**
 * O CLIENTE ESCREVEU NO PEDIDO. A Vitória responde (ou passa à equipa), a
 * resposta fica no histórico, o cliente é avisado no telemóvel, a equipa é
 * avisada, e — trabalho hoje ou amanhã com uma alteração — o parceiro também.
 */
export async function depoisDaMensagemNoPedido(pedidoId: number, texto: string, agora: Date = new Date()): Promise<ResultadoDaMensagemNoPedido> {
  const r: ResultadoDaMensagemNoPedido = { respondeu: "nada", motivo: null, avisoAoCliente: "nao", parceiroAvisado: false };
  try {
    const pedido = await getSimulatorOrderById(pedidoId);
    if (!pedido) return r;
    const porResponder = mensagemPorResponder(pedido.historyJson ?? null);
    // Já respondida (o «pedir o que falta» respondeu, ou alguém da equipa): nada a fazer.
    if (!porResponder) return r;
    const desde = instanteDaBase(porResponder.desde) ?? agora;

    // 1. A Vitória.
    const motivoDasRegras = motivoDaEquipa(texto);
    const { decidirNoSuporte, lerNoSuporte } = await import("./vitoria-agente/resposta-no-suporte");
    let leitura = null as Awaited<ReturnType<typeof lerNoSuporte>>["leitura"];
    let erro: string | null = null;
    const ligada = String(process.env.VITORIA_SUPORTE ?? "").trim().toLowerCase() !== "desligada";
    if (ligada) {
      const { clienteDoClaude } = await import("./vitoria-agente/cliente");
      const cliente = clienteDoClaude();
      const { dentroDoTecto } = await import("./vitoria-agente/custo");
      const { gastoDeHojeUsd, tectoDiarioUsd, registarAccao } = await import("./vitoria-agente/na-base");
      if (!cliente) erro = "sem a chave do Claude";
      else if (!dentroDoTecto(await gastoDeHojeUsd(agora), await tectoDiarioUsd())) erro = "tecto diário atingido";
      else {
        const { conversaAnonimizada } = await import("./vitoria-agente/anonimizar");
        const { mensagensDoPedido } = await import("./historico-para-o-cliente");
        const quem = [{ contactName: pedido.contactName ?? null, address: (pedido as { address?: string | null }).address ?? null }];
        const fio = conversaAnonimizada(
          mensagensDoPedido(pedido.historyJson ?? null).map((m) => ({ direccao: m.de === "Eu" ? "in" : "out", texto: m.texto })),
          quem,
        );
        const ultima = conversaAnonimizada([{ direccao: "in", texto }], quem)[0].texto;
        const atribuido = await parceiroAtribuido(pedidoId).catch(() => null);
        const dia = instanteDaBase((atribuido?.dia ?? (pedido as { dataAgendada?: Date | string | null }).dataAgendada ?? null) as never);
        const lido = await lerNoSuporte(
          {
            agora,
            pedido: {
              id: pedidoId,
              servico: pedido.serviceType ?? null,
              estado: pedido.status ?? null,
              dia: dia ? diaEmLisboa(dia) : null,
              contratado: atribuido != null,
            },
            conversa: fio.slice(0, -1).map((l) => ({ de: l.direccao === "in" ? ("cliente" as const) : ("clyon" as const), texto: l.texto })),
            ultima,
          },
          cliente,
        );
        leitura = lido.leitura;
        erro = lido.erro;
        await registarAccao({
          ferramenta: "suporte_no_pedido",
          pedidoId,
          ensaio: false,
          resultado: { leitura: lido.leitura, motivoDasRegras },
          modelo: lido.modelo,
          uso: lido.uso,
          custoUsd: lido.custoUsd,
          erro: lido.erro,
          texto: lido.leitura?.resposta ?? null,
        }).catch(() => {});
      }
    } else erro = "a resposta no Suporte está desligada";
    const decisao = decidirNoSuporte(leitura, { pedidoId, motivoDasRegras, erro });

    // 2. A resposta, no histórico do pedido (onde o cliente escreveu).
    const passou = decisao.tipo === "equipa";
    await appendOrderHistory(pedidoId, {
      type: "message_to_client",
      by: { ...VITORIA_NO_HISTORICO },
      message: decisao.texto,
      ...(passou ? { passaAEquipa: true, motivo: decisao.motivo } : {}),
    });
    r.respondeu = passou ? "equipa" : "vitoria";
    r.motivo = passou ? decisao.motivo : null;
    const { avisarDaRespostaDaClyon } = await import("./conversa-com-a-clyon");
    await avisarDaRespostaDaClyon(pedidoId).catch(() => {});

    // 3. O aviso curto no WhatsApp: um por pedido e por dia, das 9h às 20h.
    const { telemovelParaWhatsApp } = await import("./whatsapp-cloud");
    const telefone = telemovelParaWhatsApp(pedido.contactPhone ?? null);
    if (!telefone) r.avisoAoCliente = "sem_telefone";
    else {
      const enviarEm = quandoAvisarOCliente(agora);
      const chave = chaveDoAvisoAoCliente(pedidoId, enviarEm);
      const textoDoAviso = avisoAoClienteDaResposta(pedidoId, new URL("/conta", urlDeAccao()).toString());
      if (!(await guardarOAviso({ chave, tipo: "cliente", pedidoId, telefone, texto: textoDoAviso, enviarEm }))) r.avisoAoCliente = "repetido";
      else if (!emHorarioDoCliente(agora)) r.avisoAoCliente = "guardado";
      else {
        const ok = await enviarWhatsApp(telefone, textoDoAviso);
        // Falhou: fica guardado, e a passagem seguinte tenta uma vez mais.
        if (ok) await marcar(chave, "enviado");
        r.avisoAoCliente = ok ? "enviado" : "guardado";
      }
    }

    // 4. A equipa, já.
    const { avisarAEquipaDoSuporte } = await import("./avisos-a-equipa-na-base");
    await avisarAEquipaDoSuporte(avisoDoPedido(pedidoId, desde, passou, r.motivo), agora);

    // 5. O parceiro, se o trabalho é hoje ou amanhã e a mensagem pede uma alteração.
    if (pedeAlteracao(texto)) {
      const atribuido = await parceiroAtribuido(pedidoId).catch(() => null);
      const dia = atribuido?.dia ?? (pedido as { dataAgendada?: Date | string | null }).dataAgendada ?? null;
      if (atribuido && eHojeOuAmanha(dia as never, agora)) {
        const chave = chaveDoAvisoAoParceiro(pedidoId, agora);
        const textoAoParceiro = avisoAoParceiroDaAlteracao(pedidoId, texto);
        const tel = telemovelParaWhatsApp(atribuido.telefone);
        if (await guardarOAviso({ chave, tipo: "parceiro", pedidoId, telefone: tel ?? "", texto: textoAoParceiro, enviarEm: agora })) {
          let ok = false;
          if (tel && (await assistentePode("avisar_profissional").catch(() => false))) ok = await enviarWhatsApp(tel, textoAoParceiro);
          const { avisarProfissional } = await import("./avisos-do-backoffice");
          await avisarProfissional(atribuido.providerId, "alteracao_pedida", { pedidoId, negociacaoId: atribuido.negociacaoId }).catch(() => {});
          await marcar(chave, ok ? "enviado" : "falhou");
          r.parceiroAvisado = true;
        }
      }
    }
    return r;
  } catch (e) {
    console.error("[mensagem no suporte] pedido", pedidoId, e instanceof Error ? e.message : e);
    return r;
  }
}

/** ALGUÉM PEDIU AJUDA NA PLATAFORMA (o Suporte do parceiro): a equipa sabe já. Nunca lança. */
export async function depoisDaAjudaDaPlataforma(ajudaId: number, quem: "cliente" | "parceiro", agora: Date = new Date()): Promise<void> {
  try {
    const { titulo, corpo } = avisoAEquipaDaMensagem({ origem: "plataforma", id: ajudaId, quem, passouAEquipa: true, motivo: null });
    const { avisarAEquipaDoSuporte } = await import("./avisos-a-equipa-na-base");
    await avisarAEquipaDoSuporte(
      { chave: `suporte:a${ajudaId}`, tipo: "suporte", pedidoId: null, telefone: null, desde: agora, seccao: "suporte", titulo, corpo, url: "/admin?section=suporte" },
      agora,
    );
  } catch (e) {
    console.error("[mensagem no suporte] ajuda", ajudaId, e instanceof Error ? e.message : e);
  }
}

/** Um aviso guardado fora de horas continua por responder? (a passagem das 08h pergunta). */
export async function suporteAindaPorResponder(chave: string, pedidoId: number | null): Promise<boolean> {
  if (pedidoId != null) {
    const pedido = await getSimulatorOrderById(pedidoId);
    return !!pedido && mensagemPorResponder(pedido.historyJson ?? null) != null;
  }
  const m = /^suporte:a(\d+)$/.exec(chave);
  if (!m) return true;
  const { ajudaPorId } = await import("./db");
  const a = await ajudaPorId(Number(m[1]));
  return !!a && a.estado === "open";
}

/**
 * A PASSAGEM DO CRON (de 10 em 10 min): os avisos ao cliente guardados fora
 * de horas saem das 9h às 20h. Um que tenha mais de um dia já não se envia.
 */
export async function enviarOsAvisosDoSuportePendentes(agora: Date = new Date()): Promise<{ enviados: number; linhas: string[] }> {
  const out = { enviados: 0, linhas: [] as string[] };
  if (!emHorarioDoCliente(agora)) return out;
  try {
    const p = await pool();
    const [linhas] = (await p.execute(
      `SELECT chave, pedidoId, telefone, texto, enviarEmMs FROM avisosDoSuporte
        WHERE enviadoMs IS NULL AND tipo = 'cliente' AND enviarEmMs <= ?
        ORDER BY enviarEmMs ASC LIMIT 30`,
      [agora.getTime()],
    )) as [Array<{ chave: string; pedidoId: number; telefone: string; texto: string; enviarEmMs: number | string }>, unknown];
    for (const l of linhas) {
      if (agora.getTime() - Number(l.enviarEmMs) > 24 * 3600 * 1000) {
        await marcar(l.chave, "falhou");
        continue;
      }
      const ok = await enviarWhatsApp(l.telefone, l.texto);
      await marcar(l.chave, ok ? "enviado" : "falhou");
      if (ok) {
        out.enviados++;
        out.linhas.push(`Aviso da resposta no pedido #${l.pedidoId} enviado.`);
      }
    }
  } catch (e) {
    console.error("[mensagem no suporte] pendentes:", e instanceof Error ? e.message : e);
  }
  return out;
}

/** Os pedidos com uma mensagem no pedido por responder — para a Mesa («Precisa de si»). */
export async function mensagensNoPedidoPorResponder(): Promise<Array<{ pedidoId: number; desde: string; motivo: string | null }>> {
  const { pedidosComConversa } = await import("./db");
  const pedidos = await pedidosComConversa(200);
  const out: Array<{ pedidoId: number; desde: string; motivo: string | null }> = [];
  for (const p of pedidos) {
    const m = mensagemPorResponder(p.historyJson);
    if (!m) continue;
    const d = instanteDaBase(m.desde);
    out.push({ pedidoId: p.id, desde: d ? d.toISOString() : m.desde, motivo: m.motivo });
  }
  return out;
}
