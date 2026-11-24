/**
 * «O CLIENTE PERGUNTA SE CONSEGUE…» NA APP CLYON PRO — d3 (CEO e dono, 24-11-2026).
 *
 * O cliente quer escolher a proposta do parceiro com uma condição («até
 * quinta», «só de manhã»). A Vitória pergunta-lho pelo WhatsApp dos avisos e
 * pelo painel (d97); a app mostra a mesma pergunta e responde-se com um toque,
 * SIM (e quando, se quiser) ou NÃO, pela mesma rota do painel. Puro (sem React
 * Native): o teste do site importa-o.
 *
 * A app não escreve números nem prazos: a pergunta e o prazo vêm do servidor
 * e a frase de agradecimento é a que a rota devolve.
 */
import { diaMesEHoraEmLisboa } from "../../../src/lib/hora-de-lisboa";

export const ROTA_DA_PERGUNTA_DO_CLIENTE = "/api/profissionais/pergunta-do-cliente";

export type PerguntaDoCliente = { id: number; pedidoId: number; condicao: string; prazoEm: string };

/** O que `GET` devolve, só com as perguntas bem formadas (um site antigo ou lixo não mostram nada). */
export function perguntasLidas(v: unknown): PerguntaDoCliente[] {
  const lista = (v as { perguntas?: unknown } | null)?.perguntas;
  if (!Array.isArray(lista)) return [];
  return lista.filter(
    (p): p is PerguntaDoCliente =>
      !!p && Number.isInteger((p as PerguntaDoCliente).id) && Number.isInteger((p as PerguntaDoCliente).pedidoId) && typeof (p as PerguntaDoCliente).condicao === "string",
  ).map((p) => ({ id: p.id, pedidoId: p.pedidoId, condicao: p.condicao, prazoEm: typeof p.prazoEm === "string" ? p.prazoEm : "" }));
}

/** «Responda até 25/11, 15:00, para o cliente não ficar à espera.» — em hora de Lisboa; sem prazo, nada. */
export function fraseDoPrazo(prazoEm: string): string | null {
  const d = prazoEm ? new Date(prazoEm) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `Responda até ${diaMesEHoraEmLisboa(d)}, para o cliente não ficar à espera.`;
}

/** O corpo do POST: o `quando` só segue com o SIM. */
export function corpoDaResposta(perguntaId: number, resposta: "sim" | "nao", quando: string): { perguntaId: number; resposta: "sim" | "nao"; quando: string | null } {
  return { perguntaId, resposta, quando: resposta === "sim" ? quando.trim() || null : null };
}
