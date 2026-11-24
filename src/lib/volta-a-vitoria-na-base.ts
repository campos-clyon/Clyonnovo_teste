/**
 * QUANDO A CONVERSA VOLTA À VITÓRIA, A MENSAGEM QUE FICOU RESPONDE-SE — 25-11-2026
 * (decisão d112). Ver `volta-a-vitoria.ts`.
 *
 * A conversa respondida à mão volta à Vitória ao fim de 24 h sem a equipa. Se
 * a última mensagem é do cliente e ficou sem resposta, a Vitória lê-a e
 * responde pelas regras de sempre (`tratarMensagemDoCliente`) — ou passa a
 * conversa à equipa, se for o caso. Corre na passagem do assistente (10 em 10
 * minutos), só das 9h às 20h de Lisboa, e nunca a quem já recebeu hoje uma
 * mensagem automática (nem a quem pediu para não ser contactado). Não diz ao
 * cliente que «voltou»: responde ao que ele escreveu, e mais nada.
 *
 * Cada mensagem trata-se uma vez (`retomadaAteId`); a que passou de 7 dias fica
 * para quem a vir na Mesa. Nunca lança: uma falha numa conversa não estraga as
 * outras nem a passagem.
 */
import { naJanelaDasMensagensAutomaticas } from "./janela-das-mensagens-automaticas";
import { oQueFicouPorResponder, type MensagemComIdade } from "./volta-a-vitoria";

/** Quantas conversas se tratam, no máximo, em cada passagem. */
export const VOLTAS_POR_PASSAGEM = 5;

export type ResultadoDasVoltas = { vistas: number; respondidas: number; antigas: number; linhas: string[] };

async function fioComIdade(telefone: string): Promise<MensagemComIdade[]> {
  const { getPool } = await import("./db");
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute(
    `SELECT id, direccao, texto, TIMESTAMPDIFF(SECOND, criadoEm, CURRENT_TIMESTAMP) AS haSegundos
       FROM whatsappMensagens
      WHERE RIGHT(telefone, 9) = RIGHT(?, 9)
      ORDER BY id DESC
      LIMIT 40`,
    [telefone.replace(/\D/g, "")],
  )) as [Array<Record<string, unknown>>, unknown];
  return rows.reverse().map((r) => ({
    id: Number(r.id),
    direccao: String(r.direccao),
    texto: String(r.texto ?? ""),
    haSegundos: Number.isFinite(Number(r.haSegundos)) ? Number(r.haSegundos) : null,
  }));
}

export async function responderAsQueVoltaramAVitoria(agora: Date = new Date()): Promise<ResultadoDasVoltas> {
  const r: ResultadoDasVoltas = { vistas: 0, respondidas: 0, antigas: 0, linhas: [] };
  if (!naJanelaDasMensagensAutomaticas(agora)) return r;
  const db = await import("./db");
  if (!(await db.whatsappLigado().catch(() => false))) return r;
  const voltaram = (await db.listarNumerosInterrompidosWhatsApp().catch(() => [])).filter((e) => e.voltouAVitoria);
  const { jaSaiuHojeUmaMensagemAutomatica } = await import("./uma-mensagem-automatica-por-dia");
  const { textoDaRajada, imagensDaRajada, oQueSeViuNaRajada } = await import("./rajada-do-whatsapp");
  for (const e of voltaram) {
    if (r.respondidas >= VOLTAS_POR_PASSAGEM) break;
    const fim = `…${e.telefone.slice(-3)}`;
    try {
      if (await db.numeroBloqueadoWhatsApp(e.telefone).catch(() => true)) continue;
      const fio = await fioComIdade(e.telefone);
      const ficou = oQueFicouPorResponder(fio, e.retomadaAteId);
      if (!ficou) continue;
      r.vistas++;
      if (ficou.antiga) {
        await db.marcarRetomadaWhatsApp(e.telefone, ficou.ateId);
        r.antigas++;
        r.linhas.push(`${fim}: voltou à Vitória; a última mensagem do cliente tem mais de 7 dias — fica na Mesa`);
        continue;
      }
      // Uma mensagem automática por dia (e o «não contactar» da d93): se já saiu hoje, fica para amanhã.
      if (await jaSaiuHojeUmaMensagemAutomatica({ telefone: e.telefone }, agora).catch(() => true)) continue;
      // A resposta e a marca na mesma tranca: duas passagens não respondem duas vezes.
      await db.comTrancaDoNumeroWhatsApp(e.telefone, async () => {
        const agoraFio = await fioComIdade(e.telefone);
        const aindaFicou = oQueFicouPorResponder(agoraFio, e.retomadaAteId);
        if (!aindaFicou || aindaFicou.ateId !== ficou.ateId) return;
        await db.marcarRetomadaWhatsApp(e.telefone, ficou.ateId);
        if (!(await db.podeOWhatsAppFalarCom(e.telefone).catch(() => false))) return;
        const { tratarMensagemDoCliente } = await import("./whatsapp-negociacao");
        await tratarMensagemDoCliente(e.telefone, {
          tipo: "texto",
          texto: textoDaRajada(agoraFio),
          imagens: imagensDaRajada(agoraFio),
          visto: oQueSeViuNaRajada(agoraFio),
        });
        r.respondidas++;
        r.linhas.push(`${fim}: voltou à Vitória (24 h sem a equipa) — leu a mensagem que tinha ficado`);
      });
    } catch (err) {
      console.error(`[volta-a-vitoria] ${fim}:`, err instanceof Error ? err.message : err);
    }
  }
  return r;
}
