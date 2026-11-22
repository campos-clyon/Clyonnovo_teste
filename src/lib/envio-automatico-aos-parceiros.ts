import { pecasEmLisboa, diaMesEHoraEmLisboa } from "./hora-de-lisboa";
import { pedidoFechado } from "./pedido-arrumado";
import { eDeTeste } from "./lembrete-do-que-falta";
import { arrumarAsFaltas, type ChaveDaFalta } from "./mensagem-do-que-falta";
import { IDS_DA_LISTA } from "./servicos-da-vitoria";
import { FORA_DO_PLANO, grupoDoServico } from "./service-categories";
import { eDaEquipa } from "./rajada-do-whatsapp";
import { eEnvioDeModelo } from "./envio-de-modelo";
import { haQuantoFalouAEquipa, HORAS_SEM_PISAR_A_EQUIPA } from "./pedido-em-curso";

/**
 * OS PEDIDOS COMPLETOS PELA VITÓRIA SEGUEM SOZINHOS PARA OS PARCEIROS —
 * 22-11-2026 (decisão d87, CEO e dono: «Sim, seguem sozinhos»).
 *
 * Até aqui, o pedido que a Vitória deixava completo — o que o cliente
 * completou ao responder ao «Pedir o que falta» ou a um lembrete do que falta
 * (d86), e o que ela registou do zero pelo WhatsApp já com tudo — ficava nos
 * «por enviar», à espera de alguém carregar em «Enviar aos profissionais».
 * Agora segue sozinho, pela MESMA função da Mesa (`enviarAosProfissionais`,
 * em enviar-aos-profissionais.ts) — sem distribuição nova —, quando TODAS as
 * condições daqui se cumprem. Basta uma falhar para ficar nos «por enviar»
 * como hoje, com o motivo no cartão.
 *
 *   · já não falta nada (`oQueFaltaNoPedido`, a lista do «Pedir o que falta»);
 *   · código postal válido e a morada com coordenadas válidas (sem elas a
 *     distribuição não mede o raio de ninguém);
 *   · serviço da lista que a CLYON faz (recolhas, esvaziamentos, mudanças,
 *     manutenção da casa) — nunca a montagem, a jardinagem ou o «outro»;
 *   · não é de uma conta de teste, o número não está bloqueado, e o pedido não
 *     está cancelado, arquivado, rejeitado nem concluído (nem em «precisa
 *     info», à espera de outra coisa que a equipa pediu à mão);
 *   · não é já um Trabalho CLYON de valor fixo, e não foi já enviado
 *     (idempotente: reserva-se na base antes de enviar, e só quem a ganha envia);
 *   · a equipa não escreveu à mão na conversa depois do último envio de modelo
 *     (a regra d73; sem modelo, nas últimas 12 horas);
 *   · há pelo menos um parceiro elegível (senão: «sem parceiros na zona»);
 *   · e duas que vêm de outras decisões: a descrição não ficou por traduzir
 *     (d46 — traduz-se antes de ir aos parceiros) e o pedido não foi registado
 *     sozinho, sem o SIM do cliente ao resumo (o histórico pede à equipa que
 *     confirme os dados com ele).
 *
 * HORÁRIO: os avisos aos parceiros só saem das 8h00 às 21h00 de Lisboa. Fora
 * disso o pedido fica na fila e sai às 8h00, pela rotina de 15 em 15 minutos
 * (`/api/cron/envio-aos-parceiros`), que volta a ver todas as condições.
 *
 * INTERRUPTOR DE EMERGÊNCIA nas Configs, «Envio automático aos parceiros»:
 * LIGADO por omissão (o dono pediu), só o administrador. Desligado, fica tudo
 * nos «por enviar» como hoje e o cartão diz «enviaria a N parceiros».
 *
 * PURO. A base, a reserva e a fila estão em
 * `envio-automatico-aos-parceiros-na-base.ts`.
 */

export { NOME_DO_INTERRUPTOR_DO_ENVIO_AUTOMATICO } from "./envio-automatico-nome";

/** Os avisos aos parceiros saem das 8h00 às 21h00 de Lisboa. */
export const JANELA_DO_ENVIO_AUTOMATICO = { abre: 8, fecha: 21 } as const;

/** Está na janela em que os avisos podem sair? 8h00–21h00 em Lisboa, seja qual for o fuso do servidor. */
export function naJanelaDoEnvioAutomatico(agora: Date): boolean {
  const h = pecasEmLisboa(agora).hora;
  return h >= JANELA_DO_ENVIO_AUTOMATICO.abre && h < JANELA_DO_ENVIO_AUTOMATICO.fecha;
}

/** Porque é que um pedido completo não seguiu sozinho. */
export type MotivoDoEnvioAutomatico =
  | "fechado"
  | "precisa_info"
  | "trabalho_clyon"
  | "servico_fora"
  | "de_teste"
  | "incompleto"
  | "sem_codigo_postal"
  | "por_traduzir"
  | "registado_sozinho"
  | "equipa_escreveu"
  | "bloqueado"
  | "sem_coordenadas"
  | "sem_parceiros"
  | "desligado"
  | "nao_chegou"
  | "interrompido"
  | "falhou";

/** Os motivos, como o cartão da Mesa e o histórico os dizem. */
export const MOTIVOS_DO_ENVIO_AUTOMATICO: Readonly<Record<MotivoDoEnvioAutomatico, string>> = Object.freeze({
  fechado: "o pedido está fechado",
  precisa_info: "está em «precisa info», à espera do que a equipa pediu",
  trabalho_clyon: "já é um Trabalho CLYON de valor fixo",
  servico_fora: "o serviço não é da lista da CLYON",
  de_teste: "é de uma conta de teste",
  incompleto: "ainda falta informação no pedido",
  sem_codigo_postal: "sem código postal válido",
  por_traduzir: "a descrição ficou por traduzir",
  registado_sozinho: "registado sem o SIM do cliente ao resumo — confirmar os dados com ele",
  equipa_escreveu: "a equipa escreveu à mão na conversa",
  bloqueado: "o número está bloqueado",
  sem_coordenadas: "a morada não tem coordenadas válidas",
  sem_parceiros: "sem parceiros na zona",
  desligado: "o envio automático está desligado nas Configs",
  nao_chegou: "não chegou a nenhum parceiro",
  interrompido: "o envio automático não terminou — conferir e enviar à mão",
  falhou: "o envio automático falhou — enviar à mão",
});

/** O que as regras puras precisam de saber do pedido. */
export type CandidatoAoEnvioAutomatico = {
  status: string | null | undefined;
  serviceType: string | null | undefined;
  contactName: string | null | undefined;
  contactEmail: string | null | undefined;
  /** O que falta, pela lista do «Pedir o que falta» (`oQueFaltaNoPedido`). */
  faltas: readonly ChaveDaFalta[];
  codigoPostal: string | null | undefined;
  valorFixoClyon?: unknown;
  /** A descrição ficou na língua do cliente — o tradutor falhou (d46). */
  porTraduzir?: boolean;
  /** Registado sem o SIM do cliente, 30 minutos depois do resumo. */
  registadoSozinho?: boolean;
};

/** Um código postal português: «1234-567». */
export function codigoPostalValido(cp: string | null | undefined): boolean {
  return typeof cp === "string" && /^[1-9]\d{3}-\d{3}$/.test(cp.trim());
}

/** Coordenadas dentro de Portugal continental (com folga) — nem nulas, nem o (0, 0) de uma leitura falhada. */
export function coordenadasValidas(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= 36.8 && lat <= 42.3 && lng >= -9.7 && lng <= -6.0;
}

/** Um serviço que a CLYON faz hoje: da lista do site e da Vitória, com grupo de parceiros. */
export function servicoDaListaDaClyon(servico: string | null | undefined): boolean {
  if (!servico) return false;
  if (FORA_DO_PLANO.has(servico)) return false;
  return IDS_DA_LISTA.includes(servico) && grupoDoServico(servico) != null;
}

/**
 * AS REGRAS PURAS, pela ordem — o primeiro motivo que falha, ou null. As que
 * precisam da base (o bloqueio, as coordenadas, os parceiros, o interruptor, a
 * reserva) vêm depois, em `seguirSozinhoParaOsParceiros`.
 */
export function porqueNaoSegueSozinho(
  c: CandidatoAoEnvioAutomatico,
  emailsDeTeste: ReadonlySet<string> = new Set(),
): MotivoDoEnvioAutomatico | null {
  if (pedidoFechado(c.status)) return "fechado";
  if (String(c.status ?? "").trim() === "precisa_info") return "precisa_info";
  if (c.valorFixoClyon != null) return "trabalho_clyon";
  if (!servicoDaListaDaClyon(c.serviceType)) return "servico_fora";
  if (eDeTeste(c.contactName, c.contactEmail, emailsDeTeste)) return "de_teste";
  if (arrumarAsFaltas(c.faltas).length > 0) return "incompleto";
  if (!codigoPostalValido(c.codigoPostal)) return "sem_codigo_postal";
  if (c.porTraduzir) return "por_traduzir";
  if (c.registadoSozinho) return "registado_sozinho";
  return null;
}

type MensagemDoFio = { direccao?: string; texto?: string; haSegundos?: number | null };

/**
 * A EQUIPA ESCREVEU À MÃO NA CONVERSA DEPOIS DO ÚLTIMO ENVIO DE MODELO? — a
 * regra d73. O envio de modelo (o «Pedir o que falta», os lembretes da d71)
 * não conta como a equipa a conversar; o que ela escreveu à mão depois dele,
 * sim. Sem envio de modelo no fio, conta a regra das 12 horas da d73.
 */
export function aEquipaEscreveuDepoisDoModelo(
  fio: ReadonlyArray<MensagemDoFio> | null | undefined,
  horas: number = HORAS_SEM_PISAR_A_EQUIPA,
): boolean {
  const lista = Array.isArray(fio) ? fio : [];
  let ultimoModelo = -1;
  for (let i = lista.length - 1; i >= 0; i--) {
    const m = lista[i];
    if (m?.direccao === "out" && typeof m.texto === "string" && eEnvioDeModelo(m.texto)) {
      ultimoModelo = i;
      break;
    }
  }
  if (ultimoModelo >= 0) {
    return lista
      .slice(ultimoModelo + 1)
      .some((m) => m?.direccao === "out" && typeof m.texto === "string" && eDaEquipa(m.texto) && !eEnvioDeModelo(m.texto));
  }
  const ha = haQuantoFalouAEquipa(lista);
  return ha != null && ha <= horas * 3600;
}

/* ── O que fica escrito ──────────────────────────────────────────────────── */

const parceiros = (n: number) => `${n} ${n === 1 ? "parceiro" : "parceiros"}`;

/** O histórico do pedido quando fica nos «por enviar». */
export function historicoDoQueFicou(motivo: MotivoDoEnvioAutomatico, enviariaA?: number | null): string {
  if (motivo === "desligado") {
    return (
      `Completo pela Vitória, mas o envio automático aos parceiros está desligado nas Configs` +
      (enviariaA != null && enviariaA > 0 ? ` — enviaria a ${parceiros(enviariaA)}` : "") +
      ". Fica nos «por enviar»."
    );
  }
  return `Não seguiu sozinho para os parceiros: ${MOTIVOS_DO_ENVIO_AUTOMATICO[motivo]}. Fica nos «por enviar».`;
}

/** O histórico do pedido quando fica na fila (fora das 8h–21h). */
export function historicoDaFila(enviariaA: number): string {
  return (
    `Completo pela Vitória fora das 8h–21h: o envio automático aos parceiros (${parceiros(enviariaA)}) ` +
    "fica na fila e sai às 8h00."
  );
}

/** Uma linha da tabela do envio automático, como a Mesa a lê. */
export type LinhaDoEnvioAutomatico = {
  estado: "a_enviar" | "enviado" | "na_fila" | "ficou";
  motivo: MotivoDoEnvioAutomatico | null;
  enviariaA: number | null;
  mudadoEm: Date | null;
};

/**
 * A LINHA NO CARTÃO DOS «POR ENVIAR» — o que aconteceu ao envio automático
 * deste pedido, ou null. Com o interruptor desligado, «enviaria a N parceiros».
 */
export function linhaDoEnvioAutomaticoNaMesa(l: LinhaDoEnvioAutomatico | null | undefined, ligado: boolean): string | null {
  if (!l) return null;
  const quando = l.mudadoEm ? ` (${diaMesEHoraEmLisboa(l.mudadoEm)})` : "";
  const n = l.enviariaA != null && l.enviariaA > 0 ? l.enviariaA : null;
  if (l.estado === "enviado") return null;
  if (l.estado === "a_enviar") return `Envio automático aos parceiros a correr${quando}.`;
  if (l.estado === "na_fila") {
    if (!ligado) return `Envio automático desligado nas Configs${n ? ` — enviaria a ${parceiros(n)}` : ""}.`;
    return `Envio automático aos parceiros na fila: sai às 8h00${n ? `, para ${parceiros(n)}` : ""}${quando}.`;
  }
  if (l.motivo === "desligado") return `Envio automático desligado nas Configs${n ? ` — enviaria a ${parceiros(n)}` : ""}${quando}.`;
  const motivo = l.motivo ? MOTIVOS_DO_ENVIO_AUTOMATICO[l.motivo] : MOTIVOS_DO_ENVIO_AUTOMATICO.falhou;
  return `Não seguiu sozinho para os parceiros: ${motivo}${quando}.`;
}

/** Lê um motivo gravado na base; o que não se conhece fica null. */
export function lerMotivo(v: unknown): MotivoDoEnvioAutomatico | null {
  return typeof v === "string" && v in MOTIVOS_DO_ENVIO_AUTOMATICO ? (v as MotivoDoEnvioAutomatico) : null;
}
