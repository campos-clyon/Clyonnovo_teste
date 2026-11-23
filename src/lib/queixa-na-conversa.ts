import { reclamaDoValor } from "./pedido-em-curso";
import { reclamaDoAtendimento } from "./voz-da-vitoria";

/**
 * O CLIENTE QUEIXOU-SE NA CONVERSA? — d88 (23-11-2026). Um pedido com queixa
 * não recebe as propostas pela Vitória: fica com uma pessoa. Conta uma
 * mensagem DELE, dos últimos 14 dias, que se queixe do valor («muito caro»,
 * «não foi isso que combinámos», «livro de reclamações») ou do atendimento
 * («com esse atendimento fica difícil») — as mesmas leituras da Vitória
 * (`reclamaDoValor`, `reclamaDoAtendimento`). PURA.
 */
export const DIAS_DE_UMA_QUEIXA = 14;

type MensagemDoFio = { direccao?: string; texto?: string; haSegundos?: number | null };

export function haQueixaNaConversa(fio: ReadonlyArray<MensagemDoFio> | null | undefined, dias: number = DIAS_DE_UMA_QUEIXA): boolean {
  return (Array.isArray(fio) ? fio : []).some((m) => {
    if (m?.direccao !== "in" || typeof m.texto !== "string" || !m.texto.trim()) return false;
    if (typeof m.haSegundos === "number" && m.haSegundos > dias * 86_400) return false;
    return reclamaDoValor(m.texto) || reclamaDoAtendimento(m.texto);
  });
}
