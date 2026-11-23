import { linguaClara, linguaPedida, NOME_DA_LINGUA, PORTUGUES, type Lingua } from "./lingua-do-cliente";

/**
 * O ORÇAMENTO NA LÍNGUA DA CONVERSA — d88 (23-11-2026), o caso do #659: o dono
 * carregou em «Enviar pela CLYON» para uma cliente que escreveu sempre em
 * inglês, e a mensagem saiu em português (o envio à mão, quando o tradutor
 * falha e a mensagem das propostas não tem tradução fixa, manda o português).
 *
 * Agora o orçamento — o do botão e o que a Vitória envia sozinha — sai SEMPRE
 * na língua da conversa:
 *
 *   · a língua é a que o WhatsApp guardou para o número (a mesma da Vitória e
 *     do tradutor); se ainda não há nenhuma guardada, lê-se a conversa — a
 *     última mensagem do cliente que pede uma língua ou está escrita nela de
 *     forma clara (`linguaPedida`, `linguaClara`) — e guarda-se;
 *   · noutra língua, a mensagem traduz-se como a da Vitória: o tradutor, e
 *     depois as traduções fixas (`traducoes-fixas-da-vitoria.json`); sem
 *     nenhuma das duas, NÃO SAI, e diz-se à equipa porquê («cliente noutra
 *     língua»). Nunca o português a quem escreve noutra língua.
 */

type MensagemDoFio = { direccao?: string; texto?: string };

/** A língua que a conversa mostra: a da última mensagem dele que a diga, ou null (português). Pura. */
export function linguaDoFio(fio: ReadonlyArray<MensagemDoFio> | null | undefined): Lingua | null {
  const lista = Array.isArray(fio) ? fio : [];
  for (let i = lista.length - 1; i >= 0; i--) {
    const m = lista[i];
    if (m?.direccao !== "in" || typeof m.texto !== "string" || !m.texto.trim()) continue;
    const l = linguaPedida(m.texto) ?? linguaClara(m.texto);
    if (l) return l === PORTUGUES ? null : l;
  }
  return null;
}

/**
 * A LÍNGUA DA CONVERSA COM ESTE NÚMERO — a guardada, ou a que a conversa
 * mostra (e, com `guardar`, fica guardada, para o envio e a Vitória a usarem).
 * Português (ou sem saber): null.
 */
export async function linguaDaConversa(telefone: string, opcoes: { guardar?: boolean } = {}): Promise<Lingua | null> {
  const db = await import("./db");
  const guardada = await db.linguaDoNumero(telefone).catch(() => null);
  if (guardada) return guardada === PORTUGUES ? null : guardada;
  const fio = await db.mensagensDoNumeroWhatsApp(telefone, 40).catch(() => []);
  const lida = linguaDoFio(fio);
  if (lida && opcoes.guardar) await db.guardarLinguaDoNumero(telefone, lida).catch(() => {});
  return lida;
}

/** O motivo, dito à equipa: «cliente noutra língua (inglês)…». */
export function motivoDaLingua(lingua: Lingua): string {
  return `cliente noutra língua (${NOME_DA_LINGUA[lingua].toLowerCase()}): a mensagem não tem tradução, escrever-lhe à mão na língua dele`;
}

/**
 * O ORÇAMENTO PODE SAIR NA LÍNGUA DELE? — antes de qualquer envio do orçamento
 * (o botão e a Vitória). Em português, sim. Noutra língua, só se houver
 * tradução: o tradutor ou, sem ele, a tradução fixa (com `soFixa`, só a fixa —
 * o envio automático decide sem gastar o tradutor). Guarda a língua lida.
 */
export async function orcamentoNaLinguaDaConversa(
  telefone: string,
  texto: string,
  opcoes: { soFixa?: boolean; guardar?: boolean } = {},
): Promise<{ ok: true; lingua: Lingua | null } | { ok: false; lingua: Lingua; motivo: string }> {
  const lingua = await linguaDaConversa(telefone, { guardar: opcoes.guardar });
  if (!lingua) return { ok: true, lingua: null };
  const { paraTeclado } = await import("./whatsapp-cloud");
  const emPortugues = paraTeclado(texto);
  let traduzido: string | null = null;
  if (opcoes.soFixa) {
    const { traducaoFixa } = await import("./traducoes-fixas-da-vitoria");
    traduzido = traducaoFixa(emPortugues, lingua);
  } else {
    const { traduzirSemLinguaErrada } = await import("./traduzir-para-o-cliente");
    traduzido = await traduzirSemLinguaErrada(emPortugues, lingua).catch(async () => {
      const { traducaoFixa } = await import("./traducoes-fixas-da-vitoria");
      return traducaoFixa(emPortugues, lingua);
    });
  }
  return traduzido != null ? { ok: true, lingua } : { ok: false, lingua, motivo: motivoDaLingua(lingua) };
}
