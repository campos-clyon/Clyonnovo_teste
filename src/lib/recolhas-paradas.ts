import type { DadosDaRecolha, PassoDaRecolha } from "./whatsapp-recolha";
import { eDaEquipa } from "./rajada-do-whatsapp";

/**
 * AS RECOLHAS QUE PARAM — 23-10-2026.
 *
 * *«Se o cliente demorar mais de 10 minutos a responder a uma pergunta, que
 * ela passe para a próxima — já faça o que seria a próxima pergunta. E caso o
 * cliente não responda, não confirme os dados que foram recolhidos no final
 * do pedido, que ele seja criado automaticamente após 30 minutos.»* — o dono.
 *
 * Corre na passagem do assistente, de 10 em 10 minutos: por isso o salto
 * acontece entre os 10 e os 20 minutos de silêncio, e o registo entre os 30 e
 * os 40.
 *
 * O QUE NÃO FAZ, de propósito:
 *   - não salta o serviço — sem ele não há pedido, e é ele que decide as
 *     perguntas seguintes;
 *   - não salta duas seguidas — com o cliente calado depois de um salto, não
 *     se lhe manda a pergunta seguinte, e a seguinte, até ao resumo: uma vez
 *     só, e espera-se por ele;
 *   - não mexe em conversas com mais de `HORAS_DE_LIMITE` paradas — ao ligar
 *     isto, um cliente de há uma semana não recebe de repente «Pedido
 *     registado»;
 *   - não fala onde a última mensagem foi de uma pessoa da equipa.
 */

export const MINUTOS_PARA_SALTAR = 10;
export const MINUTOS_PARA_REGISTAR = 30;
export const HORAS_DE_LIMITE = 6;

export type DecisaoDaRecolhaParada = "nada" | "saltar" | "registar";

/** O que fazer com uma recolha a meio, pela última mensagem da conversa. Pura. */
export function oQueFazerComARecolha(
  r: { passo: PassoDaRecolha; dados: DadosDaRecolha },
  ultima: { direccao: string; texto: string; haSegundos: number | null } | null,
  saltoDaPergunta: string,
): DecisaoDaRecolhaParada {
  if (!ultima || ultima.direccao !== "out" || ultima.haSegundos == null) return "nada";
  const s = ultima.haSegundos;
  if (s > HORAS_DE_LIMITE * 3600) return "nada";
  if (eDaEquipa(ultima.texto)) return "nada";
  if (r.passo === "confirmar") return s >= MINUTOS_PARA_REGISTAR * 60 ? "registar" : "nada";
  if (r.passo === "servico") return "nada";
  if (ultima.texto.trim().startsWith(saltoDaPergunta)) return "nada";
  return s >= MINUTOS_PARA_SALTAR * 60 ? "saltar" : "nada";
}

export type PassagemDasRecolhas = { saltadas: number; registadas: number; linhas: string[] };

/**
 * A passagem: cada recolha em curso, a decisão, e o gesto. Só com o WhatsApp
 * ligado e a recolha do assistente ligada; um número entregue a uma pessoa ou
 * bloqueado fica de fora (`podeOWhatsAppFalarCom`).
 */
export async function correrAsRecolhasParadas(): Promise<PassagemDasRecolhas> {
  const r: PassagemDasRecolhas = { saltadas: 0, registadas: 0, linhas: [] };
  const db = await import("./db");
  if (!(await db.whatsappLigado().catch(() => false))) return r;
  if (!(await db.assistentePode("recolher").catch(() => false))) return r;
  const { saltarAPergunta, SALTO_DA_PERGUNTA } = await import("./whatsapp-recolha");
  const { registarARecolha } = await import("./whatsapp-negociacao");
  const { enviarTextoWhatsApp } = await import("./whatsapp-cloud");

  const emCurso = await db.listarRecolhasWhatsAppEmCurso().catch(() => []);
  for (const { telefone } of emCurso) {
    try {
      if (!(await db.podeOWhatsAppFalarCom(telefone))) continue;
      const guardada = await db.recolhaWhatsApp(telefone);
      if (!guardada || guardada.pedidoId != null) continue;
      const fio = await db.mensagensDoNumeroWhatsApp(telefone, 5);
      const ultima = fio.length > 0 ? fio[fio.length - 1] : null;
      const estado = {
        passo: guardada.passo as PassoDaRecolha,
        dados: (guardada.dados ?? {}) as DadosDaRecolha,
      };
      const decisao = oQueFazerComARecolha(estado, ultima, SALTO_DA_PERGUNTA);
      if (decisao === "saltar") {
        const salto = saltarAPergunta(estado);
        await db.guardarRecolhaWhatsApp(telefone, salto.estado.passo, salto.estado.dados);
        await enviarTextoWhatsApp(telefone, salto.resposta);
        r.saltadas += 1;
        r.linhas.push(`${telefone}: «${estado.passo}» ficou para depois → ${salto.estado.passo}`);
      } else if (decisao === "registar") {
        const id = await registarARecolha(telefone, estado.dados, { sozinho: true });
        if (id != null) {
          r.registadas += 1;
          r.linhas.push(`${telefone}: pedido #${id} registado sozinho (sem resposta ao resumo)`);
        }
      }
    } catch (e) {
      console.error("[recolhas-paradas]", telefone, e instanceof Error ? e.message : e);
    }
  }
  return r;
}
