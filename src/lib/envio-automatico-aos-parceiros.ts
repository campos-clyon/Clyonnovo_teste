import { JANELA_DE_CONTACTO, naJanelaDeContacto } from "./janela-de-contacto";
import { pecasEmLisboa, diaMesEHoraEmLisboa, diaEmLisboa, horaEmLisboa, instanteDaBase, instanteEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";
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
 * HORÁRIO: os avisos aos parceiros só saem das 9h00 às 20h00 de Lisboa. Fora
 * disso o pedido fica na fila e sai às 9h00, pela rotina de 15 em 15 minutos
 * (`/api/cron/envio-aos-parceiros`), que volta a ver todas as condições.
 *
 * INTERRUPTOR DE EMERGÊNCIA nas Configs, «Envio automático aos parceiros»:
 * LIGADO por omissão (o dono pediu), só o administrador. Desligado, fica tudo
 * nos «por enviar» como hoje e o cartão diz «enviaria a N parceiros».
 *
 * PURO. A base, a reserva e a fila estão em
 * `envio-automatico-aos-parceiros-na-base.ts`.
 */

export { NOME_DO_INTERRUPTOR_DO_ENVIO_AUTOMATICO, NOME_DO_INTERRUPTOR_SO_DA_VITORIA } from "./envio-automatico-nome";

/** Os avisos aos parceiros saem na janela de contacto (das 9h às 20h de Lisboa). */
export const JANELA_DO_ENVIO_AUTOMATICO = JANELA_DE_CONTACTO;

/** Está na janela em que os avisos podem sair? A de contacto, em Lisboa, seja qual for o fuso do servidor. */
export function naJanelaDoEnvioAutomatico(agora: Date): boolean {
  return naJanelaDeContacto(agora);
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
  /* d88 (23-11-2026): os «Orçamentos novos» de todas as origens — os que ficam SEMPRE com uma pessoa. */
  | "origem_fora"
  | "proposta_enviada"
  | "escolhidos_pelo_cliente"
  | "atribuido"
  | "com_nota"
  | "acima_de_500"
  | "com_a_equipa"
  | "so_da_vitoria"
  | "nao_chegou"
  | "interrompido"
  | "falhou"
  /* d2 (23-11-2026): o dia pedido já passou; outro pedido aberto do mesmo contacto; já enviado à mão. */
  | "data_passada"
  | "pedido_repetido"
  | "ja_enviado";

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
  origem_fora: "a origem do pedido não segue sozinha (formulário a meio ou conta de teste)",
  proposta_enviada: "a equipa já enviou uma proposta ao cliente",
  escolhidos_pelo_cliente: "mudança com parceiros escolhidos pelo cliente — vai só a esses",
  atribuido: "alguém da equipa está a tratar dele",
  com_nota: "tem uma nota da equipa",
  acima_de_500: "estimativa acima de 500 € com IVA — fica com uma pessoa",
  com_a_equipa: "a conversa do WhatsApp está com uma pessoa da equipa",
  so_da_vitoria: "o envio automático está só para os da Vitória nas Configs",
  nao_chegou: "não chegou a nenhum parceiro",
  interrompido: "o envio automático não terminou — conferir e enviar à mão",
  falhou: "o envio automático falhou — enviar à mão",
  data_passada: "o dia pedido pelo cliente já passou — confirmar a data com ele",
  pedido_repetido: "o mesmo contacto tem outro pedido aberto nos últimos 7 dias — ver se é o mesmo",
  ja_enviado: "já tinha sido enviado aos parceiros (à mão)",
});

/**
 * O DIA PEDIDO JÁ PASSOU? — conta-se em Lisboa (hora-de-lisboa.ts), nunca no
 * fuso do servidor. Hoje ainda vale; um dia antes de hoje já não. Sem data (ou
 * uma data que não se lê), não passou: a falta de data é a «incompleto» que a
 * vê.
 */
export function dataPedidaJaPassou(dataAgendada: Date | string | null | undefined, agora: Date): boolean {
  const d = instanteDaBase(dataAgendada ?? null);
  if (!d) return false;
  return diaEmLisboa(d) < diaEmLisboa(agora);
}

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
  /** d2: o dia que o cliente pediu e o instante de agora — o dia pedido não pode ter passado. */
  dataAgendada?: Date | string | null;
  agora?: Date;
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
  if (dataPedidaJaPassou(c.dataAgendada, c.agora ?? new Date())) return "data_passada";
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
export function historicoDoQueFicou(motivo: MotivoDoEnvioAutomatico, enviariaA?: number | null, daVitoria = true): string {
  if (motivo === "desligado") {
    return (
      `Completo${daVitoria ? " pela Vitória" : ""}, mas o envio automático aos parceiros está desligado nas Configs` +
      (enviariaA != null && enviariaA > 0 ? ` — enviaria a ${parceiros(enviariaA)}` : "") +
      ". Fica nos «por enviar»."
    );
  }
  return `Não seguiu sozinho para os parceiros: ${MOTIVOS_DO_ENVIO_AUTOMATICO[motivo]}. Fica nos «por enviar».`;
}

/** O histórico do pedido quando fica na fila (fora das 9h–20h). */
export function historicoDaFila(enviariaA: number, daVitoria = true): string {
  return (
    `Completo${daVitoria ? " pela Vitória" : ""} fora das 9h–20h: o envio automático aos parceiros (${parceiros(enviariaA)}) ` +
    "fica na fila e sai às 9h00."
  );
}

/** O histórico do pedido que espera os 10 minutos (d88): sai à hora dita. */
export function historicoDaEspera(enviariaA: number, saida: Date, agora: Date): string {
  return (
    `Completo: segue sozinho para os parceiros (${parceiros(enviariaA)}) ${quandoSai(saida, agora)}, ` +
    `depois de ${MINUTOS_DE_ESPERA} minutos sem mensagens do cliente.`
  );
}

/** Uma linha da tabela do envio automático, como a Mesa a lê. */
export type LinhaDoEnvioAutomatico = {
  estado: "a_enviar" | "enviado" | "na_fila" | "ficou";
  motivo: MotivoDoEnvioAutomatico | null;
  enviariaA: number | null;
  mudadoEm: Date | null;
  /** d88: na fila à espera dos 10 minutos — não sai antes disto. */
  seguirApos?: Date | null;
  /** d88: posto na fila pela rotina dos «Orçamentos novos» (todas as origens), e não pela Vitória. */
  doVarrimento?: boolean;
};

/**
 * A LINHA NO CARTÃO DOS «POR ENVIAR» — o que aconteceu ao envio automático
 * deste pedido, ou null. Com o interruptor desligado, «enviaria a N parceiros».
 */
export function linhaDoEnvioAutomaticoNaMesa(
  l: LinhaDoEnvioAutomatico | null | undefined,
  ligado: boolean,
  opcoes: { soDaVitoria?: boolean; agora?: Date } = {},
): string | null {
  if (!l) return null;
  const quando = l.mudadoEm ? ` (${diaMesEHoraEmLisboa(l.mudadoEm)})` : "";
  const n = l.enviariaA != null && l.enviariaA > 0 ? l.enviariaA : null;
  if (l.estado === "enviado") return null;
  if (l.estado === "a_enviar") return `Envio automático aos parceiros a correr${quando}.`;
  if (l.estado === "na_fila") {
    if (!ligado) return `Envio automático desligado nas Configs${n ? ` — enviaria a ${parceiros(n)}` : ""}.`;
    if (l.doVarrimento && opcoes.soDaVitoria) {
      return `Envio automático só para os da Vitória nas Configs${n ? ` — enviaria a ${parceiros(n)}` : ""}.`;
    }
    // d88: «Segue sozinho às HH:MM» — a passagem da rotina em que sai (9h–20h, de 15 em 15 minutos).
    const agora = opcoes.agora ?? new Date();
    return `Segue sozinho ${quandoSai(horaDeSaida(l.seguirApos ?? agora), agora)}${n ? `, para ${parceiros(n)}` : ""}.`;
  }
  if (l.motivo === "desligado") return `Envio automático desligado nas Configs${n ? ` — enviaria a ${parceiros(n)}` : ""}${quando}.`;
  const motivo = l.motivo ? MOTIVOS_DO_ENVIO_AUTOMATICO[l.motivo] : MOTIVOS_DO_ENVIO_AUTOMATICO.falhou;
  return `Não seguiu sozinho para os parceiros: ${motivo}${quando}.`;
}

/** Lê um motivo gravado na base; o que não se conhece fica null. */
export function lerMotivo(v: unknown): MotivoDoEnvioAutomatico | null {
  return typeof v === "string" && v in MOTIVOS_DO_ENVIO_AUTOMATICO ? (v as MotivoDoEnvioAutomatico) : null;
}

/* ── d88 (23-11-2026): todo o pedido completo, de qualquer origem ────────── */

/**
 * TODO O PEDIDO COMPLETO, DE QUALQUER ORIGEM, SEGUE SOZINHO — 23-11-2026
 * (decisão d88, passo 2, CEO e dono: «Aprovo a d88»).
 *
 * A d87 só mandava sozinhos os que a Vitória completava pelo WhatsApp. Os do
 * simulador, do formulário do site e os registados à mão na Mesa ficavam nos
 * «Orçamentos novos» à espera da equipa. Agora a rotina de 15 em 15 minutos
 * (a mesma da d87, a mesma tabela de reserva, o mesmo interruptor) varre os
 * abertos e manda pela MESMA função do botão «Negociação» da Mesa
 * (`enviarAosProfissionais`, com a conta da CLYON como valor de partida),
 * com todas as condições da d87 MAIS estas — basta uma para ficar com uma
 * pessoa, com o motivo no cartão:
 *
 *   · a origem é uma das que seguem (simulador, formulário, WhatsApp,
 *     registado na Mesa) — nunca o «formulário a meio» nem a plataforma de teste;
 *   · não é Trabalho CLYON nem tem «Valor fixo» (já da d87), nem a equipa já
 *     enviou uma proposta ao cliente;
 *   · não é uma mudança com parceiros escolhidos pelo cliente (vão só a esses,
 *     por `enviarAosEscolhidos`);
 *   · a estimativa não passa dos 500 € com IVA;
 *   · não tem nota da equipa, nem está atribuído a uma pessoa, nem a conversa
 *     do WhatsApp está com a equipa;
 *   · ESPERA: só 10 minutos depois de o pedido entrar, e nunca com mensagem na
 *     conversa do cliente há menos de 10 minutos (pode estar a mandar
 *     fotografias). Até lá fica na fila, e o cartão diz «Segue sozinho às HH:MM».
 *
 * Os da Vitória (a resposta ao «Pedir o que falta» e o registo já completo)
 * continuam como na d87: seguem logo, sem a espera — ela acabou de falar com o cliente.
 */

/** A espera mínima (d88): depois de o pedido entrar, e depois da última mensagem do cliente. */
export const MINUTOS_DE_ESPERA = 10;

/** Acima disto (estimativa com IVA) fica com uma pessoa. */
export const TECTO_COM_IVA_DO_ENVIO_AUTOMATICO = 500;

/** De onde vem o pedido, para o envio automático. */
export type OrigemNoEnvioAutomatico = "simulador" | "formulario" | "whatsapp" | "backoffice";

const ORIGENS_DO_FORMULARIO = new Set(["hero_quote_form", "formulario_site", "formulario_contactos", "quero_contratar", "quero_contratar_header"]);

/**
 * A origem pelo slug do pedido (`origemPedido` / `_source` / `source`, como
 * em `acesso.ts`: sem slug é o simulador). Fora (null): o «formulário a meio»
 * (a pessoa não enviou — é para a equipa ligar), a plataforma de teste e o que
 * não se conhece.
 */
export function origemNoEnvioAutomatico(slug: string | null | undefined): OrigemNoEnvioAutomatico | null {
  const s = (slug ?? "").trim();
  if (!s || s === "simulador") return "simulador";
  if (ORIGENS_DO_FORMULARIO.has(s)) return "formulario";
  if (s === "whatsapp") return "whatsapp";
  if (s === "backoffice") return "backoffice";
  return null;
}

/** O slug guardado no JSON do pedido (a mesma ordem de `origemDoPedido`). */
export function slugDaOrigem(rawOrderJson: string | null | undefined): string {
  try {
    const raw = JSON.parse(rawOrderJson || "{}") as Record<string, unknown>;
    const bruto = raw.origemPedido ?? raw._source ?? raw.source ?? null;
    return typeof bruto === "string" ? bruto.trim() : "";
  } catch {
    return "";
  }
}

/** O que as condições das origens novas precisam de saber do pedido. */
export type CandidatoDasOrigensNovas = {
  origem: string | null | undefined;
  propostaEnviadaEm?: unknown;
  escolhaDosParceirosJson?: unknown;
  /** A estimativa gravada, COM IVA (a maior das duas colunas). */
  estimativaComIva?: number | null;
  notasInternas?: string | null;
  assignedToId?: unknown;
};

const preenchido = (v: unknown) => v != null && String(v).trim() !== "";

/** A estimativa com IVA: a maior das que estão gravadas, ou null. */
export function estimativaComIva(...valores: unknown[]): number | null {
  const n = valores.map((v) => (v == null || v === "" ? Number.NaN : Number(v))).filter((v) => Number.isFinite(v) && v > 0);
  return n.length > 0 ? Math.max(...n) : null;
}

/**
 * OS QUE FICAM SEMPRE COM UMA PESSOA (d88) — o primeiro motivo, ou null. Só
 * para a rotina dos «Orçamentos novos»; os da Vitória seguem as da d87.
 */
export function porqueFicaComUmaPessoa(c: CandidatoDasOrigensNovas): MotivoDoEnvioAutomatico | null {
  if (!origemNoEnvioAutomatico(c.origem)) return "origem_fora";
  if (preenchido(c.propostaEnviadaEm)) return "proposta_enviada";
  if (preenchido(c.escolhaDosParceirosJson)) return "escolhidos_pelo_cliente";
  if (Number(c.assignedToId) > 0) return "atribuido";
  if (typeof c.notasInternas === "string" && c.notasInternas.trim() !== "") return "com_nota";
  if (c.estimativaComIva != null && c.estimativaComIva > TECTO_COM_IVA_DO_ENVIO_AUTOMATICO) return "acima_de_500";
  return null;
}

/** O histórico diz que a Vitória o registou sem o SIM do cliente (whatsapp-negociacao.ts)? */
export function registadoSozinhoNoHistorico(historyJson: unknown): boolean {
  return typeof historyJson === "string" && historyJson.includes("Registado sozinho pela Vitória");
}

/**
 * A ESPERA (d88): até quando o pedido não sai — 10 minutos depois de entrar e
 * 10 minutos depois da última mensagem da conversa do cliente. Null: já pode.
 */
export function seguirSoDepoisDe(
  criadoEm: Date | null,
  ultimaMensagemHaSegundos: number | null | undefined,
  agora: Date,
): Date | null {
  const espera = MINUTOS_DE_ESPERA * 60_000;
  const fins: number[] = [];
  if (criadoEm && Number.isFinite(criadoEm.getTime())) fins.push(criadoEm.getTime() + espera);
  if (ultimaMensagemHaSegundos != null && Number.isFinite(ultimaMensagemHaSegundos)) {
    fins.push(agora.getTime() - Math.max(0, ultimaMensagemHaSegundos) * 1000 + espera);
  }
  if (fins.length === 0) return null;
  const fim = Math.max(...fins);
  return fim > agora.getTime() ? new Date(fim) : null;
}

/**
 * A HORA A QUE SAI: a primeira passagem da rotina (de 15 em 15 minutos) a
 * partir de `desde`, dentro das 9h–20h de Lisboa — fora delas, às 9h00.
 */
export function horaDeSaida(desde: Date): Date {
  const quarto = 15 * 60_000;
  const t = new Date(Math.ceil(desde.getTime() / quarto) * quarto);
  if (naJanelaDoEnvioAutomatico(t)) return t;
  // Fora das 9h–20h: as 9h00 de Lisboa desse dia, ou do dia seguinte se já passou das 20h.
  const hoje = diaEmLisboa(t);
  const dia = pecasEmLisboa(t).hora >= JANELA_DO_ENVIO_AUTOMATICO.fecha ? somarDiasAoDia(hoje, 1) : hoje;
  return instanteEmLisboa(`${dia}T${String(JANELA_DO_ENVIO_AUTOMATICO.abre).padStart(2, "0")}:00`) ?? t;
}

/** «às 14:15» (hoje, em Lisboa) ou «a 24/11 às 08:00». */
export function quandoSai(saida: Date, agora: Date): string {
  const hora = horaEmLisboa(saida);
  if (diaEmLisboa(saida) === diaEmLisboa(agora)) return `às ${hora}`;
  const p = pecasEmLisboa(saida);
  return `a ${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")} às ${hora}`;
}

/**
 * POR ONDE SE AVISA O CLIENTE (d88) — pelo canal que ele usou. Quem falou pelo
 * WhatsApp (o pedido do WhatsApp, ou o registado na Mesa a partir da conversa
 * dele) leva a mensagem da d87 por lá. O do simulador e o do formulário levam
 * o email que a Mesa já manda (`enviarLinkDoPedido`, a ligação do pedido) —
 * não se duplica.
 */
export function canalDoAvisoAoCliente(
  origem: OrigemNoEnvioAutomatico | null,
  falouPeloWhatsApp: boolean,
): "whatsapp" | "email_da_mesa" {
  return (origem === "whatsapp" || origem === "backoffice") && falouPeloWhatsApp ? "whatsapp" : "email_da_mesa";
}
