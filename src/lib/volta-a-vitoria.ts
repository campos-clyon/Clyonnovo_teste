/**
 * A CONVERSA RESPONDIDA À MÃO VOLTA À VITÓRIA — 25-11-2026 (decisão d112).
 *
 * Uma resposta escrita à mão no telemóvel entregava a conversa à equipa para
 * sempre, até alguém carregar em «Devolver ao site». Na Mesa, a maior parte
 * das conversas abertas estava assim, e muitos pedidos ficavam parados.
 *
 * A regra, PURA (quem lê a base é `db.ts` e `volta-a-vitoria-na-base.ts`):
 *
 *   · só as entregas feitas porque UMA PESSOA RESPONDEU (`entregaPorResposta`)
 *     têm prazo — nunca as feitas por uma razão: pediu uma pessoa, queixa,
 *     os limites da Vitória (valor alto, mudança à hora, valor único, Trabalho
 *     CLYON, lembretes sem resposta, contraproposta, data, língua, fotografia,
 *     cancelar um trabalho contratado ou pago), o «Assumir» do backoffice;
 *   · o prazo conta-se da ÚLTIMA palavra da equipa nessa conversa (a resposta
 *     à mão no fio, a resposta pelo backoffice e o «Já respondi»), e não do
 *     momento da entrega: se a equipa volta a escrever, o relógio recomeça;
 *   · passadas 24 h sem a equipa, a Vitória volta a
 *     falar nessa conversa. O registo da entrega não se apaga;
 *   · volta só a conversa que já era da Vitória — um número com quem ela já
 *     falou — e nunca a de um profissional registado: a conversa que a equipa
 *     começou com alguém de fora (um fornecedor, um contacto pessoal) continua
 *     dela (a decisão de 10-09-2026).
 *
 * d116 (25-11-2026): o prazo e a excepção «com quem ela nunca falou» caíram —
 * a entrega por uma resposta à mão já não cala a Vitória (fica só a dos
 * profissionais registados). Quem quer a Vitória calada escreve «*». Ver
 * `pausa-da-vitoria.ts`.
 *
 * Quando volta, a última mensagem do cliente sem resposta lê-se e responde-se
 * (`oQueFicouPorResponder`), dentro da janela das mensagens automáticas e com
 * uma por dia — sem nunca dizer ao cliente que «voltou».
 */
import { MOTIVO_DA_RESPOSTA_A_MAO } from "./prazo-da-volta-a-vitoria";

export { MOTIVO_DA_RESPOSTA_A_MAO, VOLTOU_A_VITORIA } from "./prazo-da-volta-a-vitoria";

/** Até quantos dias a mensagem do cliente que ficou sem resposta ainda se responde quando a conversa volta. */
export const DIAS_PARA_RESPONDER_AO_QUE_FICOU = 7;

/** Quem fez a entrega, como fica na base desde a d112 (`null` nas entregas antigas). */
export type QuemEntregou = "vitoria" | "pessoa" | null | undefined;

const plano = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * A ENTREGA ACONTECEU PORQUE UMA PESSOA RESPONDEU? Só a resposta à mão no
 * telemóvel (a ponte). As da Vitória nunca; as de uma pessoa por uma razão (o
 * «Assumir», o fecho desfeito, o cancelamento que fica com a equipa) também
 * não. As entregas antigas, sem `quem`, lêem-se pelo texto do motivo.
 */
export function entregaPorResposta(e: { motivo: string | null | undefined; quem?: QuemEntregou }): boolean {
  if (e.quem === "vitoria") return false;
  return plano(e.motivo) === plano(MOTIVO_DA_RESPOSTA_A_MAO);
}

const idade = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : null;

/**
 * A CONVERSA VOLTOU À VITÓRIA? Entregue porque uma pessoa respondeu à mão, e
 * não é de um profissional registado. Desde 25-11-2026 (decisão d116) volta
 * logo — a resposta à mão já não cala a Vitória (só o «*» a pausa, ver
 * `pausa-da-vitoria.ts`) — e também a de um número com quem ela nunca
 * falou: a excepção da d112 caiu. Era 24 h sem a equipa.
 */
export function voltouAVitoria(e: { motivo: string | null | undefined; quem?: QuemEntregou; profissional: boolean }): boolean {
  if (!entregaPorResposta(e)) return false;
  return !e.profissional;
}

/**
 * A RESPOSTA À MÃO NÃO APAGA UMA RAZÃO — a conversa que a Vitória entregou
 * por uma razão (o cliente pediu uma pessoa, um limite dela), ou que alguém
 * assumiu no backoffice, e a que a equipa responde a seguir à mão, continua
 * entregue por essa razão, sem prazo. Só se escreve por cima uma entrega que
 * também foi por resposta — ou uma que já não vale.
 */
export function guardaOMotivoDeAntes(
  antes: { motivo: string | null | undefined; quem?: QuemEntregou; emVigor: boolean } | null,
  agora: { motivo: string | null | undefined; quem?: QuemEntregou },
): boolean {
  if (!antes || !antes.emVigor) return false;
  return entregaPorResposta(agora) && !entregaPorResposta(antes);
}

/** Uma mensagem do fio, com o id e a idade contada pela base. */
export type MensagemComIdade = { id: number; direccao: string; texto: string; haSegundos: number | null };

/**
 * O QUE O CLIENTE ESCREVEU E FICOU SEM RESPOSTA — as mensagens dele depois da
 * última que saiu (nossa ou da equipa). `null` quando a última palavra foi
 * nossa, ou quando já se tratou até ali (`tratadaAteId`). `antiga` quando a
 * mais nova passa de `dias` — fica para quem a vir, sem resposta automática.
 */
export function oQueFicouPorResponder(
  fio: ReadonlyArray<MensagemComIdade>,
  tratadaAteId: number | null | undefined,
  dias: number = DIAS_PARA_RESPONDER_AO_QUE_FICOU,
): { ateId: number; antiga: boolean } | null {
  let ultimaSaida = -1;
  fio.forEach((m, i) => {
    if (m.direccao === "out") ultimaSaida = i;
  });
  const doCliente = fio.slice(ultimaSaida + 1).filter((m) => m.direccao === "in");
  if (doCliente.length === 0) return null;
  const ateId = Math.max(...doCliente.map((m) => m.id));
  if (typeof tratadaAteId === "number" && Number.isFinite(tratadaAteId) && ateId <= tratadaAteId) return null;
  const maisNova = doCliente.reduce((a, b) => (b.id > a.id ? b : a));
  const ha = idade(maisNova.haSegundos);
  return { ateId, antiga: ha == null || ha > dias * 86400 };
}
