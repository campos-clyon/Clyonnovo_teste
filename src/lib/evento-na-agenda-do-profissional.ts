import type { FaseDoTrabalho } from "./trabalho";
import { contactoJaNaoServe } from "./contacto-so-enquanto-ha-trabalho";
import { pecasEmLisboa } from "./hora-de-lisboa";
import { andarPorExtenso, elevadorPorExtenso, estacionamentoPorExtenso } from "./campos-na-descricao";
import { DURACAO_PADRAO_MIN, duracaoPorExtenso } from "./agenda-em-grelha";
import { SERVICE_CATEGORIES } from "./service-categories";

/**
 * O TRABALHO NA AGENDA DO PROFISSIONAL — d144 (dono, 27-11-2026).
 *
 * *«Os trabalhos marcados devem ir para a agenda de cada parceiro, não para a
 * do dono.»* Num trabalho contratado com dia marcado, o botão «Adicionar à
 * minha agenda» do painel e da app CLYON Pro põe-no no calendário DELE, de duas
 * maneiras, com o mesmo evento:
 *
 *   - a ligação do Google Agenda (`calendar.google.com/calendar/render?
 *     action=TEMPLATE`), com a hora escrita em Lisboa e `ctz=Europe/Lisbon`;
 *   - um ficheiro .ics (Apple, Outlook e os outros), servido por uma rota
 *     autenticada — nunca um `data:` montado no navegador.
 *
 * Tudo puro: o servidor junta os dados (só os que a vista do contratado deixa
 * ver) e isto escreve o evento. As horas são SEMPRE as de Lisboa
 * (`hora-de-lisboa-sempre`), nunca as do servidor nem as do telemóvel.
 */

export const FUSO_DA_AGENDA = "Europe/Lisbon";

/** O que o evento precisa do trabalho. Os campos do cliente só chegam depois de contratado. */
export type TrabalhoParaAAgenda = {
  negociacaoId: number;
  pedidoId: number;
  serviceType: string | null;
  dataCombinada: Date | string | null;
  duracaoMinutos: number | null;
  morada: string | null;
  city: string | null;
  moradaDestino: string | null;
  contactoNome: string | null;
  contactoTelefone: string | null;
  description: string | null;
  floor: string | null;
  hasElevator: string | null;
  parkingDistance: string | null;
  andarDestino?: string | null;
  elevadorDestino?: string | null;
  estacionamentoDestino?: string | null;
};

export type EventoDaAgenda = {
  /** O mesmo para o mesmo trabalho: importar outra vez actualiza o evento, em vez de o duplicar. */
  uid: string;
  titulo: string;
  inicio: Date;
  fim: Date;
  local: string;
  descricao: string;
  ligacaoDoPedido: string;
};

/**
 * SÓ DEPOIS DE CONTRATADO, E SÓ ENQUANTO HÁ TRABALHO POR FAZER — e com o dia
 * marcado. É a regra do contacto (`contactoJaNaoServe`: confirmado, pago,
 * arquivado ou morto, o contacto sai) mais a fase: um trabalho já marcado como
 * feito não tem nada para pôr na agenda.
 */
export function podeIrParaAAgenda(t: {
  estado: string;
  fase: FaseDoTrabalho;
  arquivadoEm?: unknown;
  dataCombinada: Date | string | null | undefined;
}): boolean {
  if (t.fase !== "a_executar") return false;
  if (contactoJaNaoServe(t)) return false;
  return instanteDe(t.dataCombinada) != null;
}

/** O nome do serviço como os ecrãs o mostram (`servicoDe` da app). */
export function nomeDoServico(serviceType: string | null | undefined): string {
  return SERVICE_CATEGORIES.find((c) => c.id === serviceType)?.label ?? (serviceType || "Serviço");
}

/** A ligação para o pedido no painel do profissional — abre o trabalho. */
export function ligacaoDoPedidoNoPainel(negociacaoId: number, site = "https://clyon.pt"): string {
  return `${site}/profissionais/painel?ecra=trabalhos&trabalho=${negociacaoId}`;
}

/** O evento do trabalho, ou `null` sem dia marcado. */
export function eventoDoTrabalho(t: TrabalhoParaAAgenda, site = "https://clyon.pt"): EventoDaAgenda | null {
  const inicio = instanteDe(t.dataCombinada);
  if (!inicio) return null;
  const minutos = t.duracaoMinutos != null && Number(t.duracaoMinutos) > 0 ? Number(t.duracaoMinutos) : DURACAO_PADRAO_MIN;
  const fim = new Date(inicio.getTime() + minutos * 60_000);
  const ligacaoDoPedido = ligacaoDoPedidoNoPainel(t.negociacaoId, site);

  const linhas: string[] = [];
  if (t.contactoNome) linhas.push(`Cliente: ${t.contactoNome}`);
  if (t.contactoTelefone) linhas.push(`Telefone: ${t.contactoTelefone}`);
  if (t.morada) linhas.push(`Morada: ${t.morada}`);
  if (t.moradaDestino) linhas.push(`Destino: ${t.moradaDestino}`);
  const acesso = acessoPorExtenso(t.floor, t.hasElevator, t.parkingDistance);
  if (acesso) linhas.push(`Acesso: ${acesso}`);
  const acessoNoDestino = acessoPorExtenso(t.andarDestino, t.elevadorDestino, t.estacionamentoDestino);
  if (acessoNoDestino) linhas.push(`Acesso no destino: ${acessoNoDestino}`);
  linhas.push(`Duração prevista: ${duracaoPorExtenso(minutos)}`);
  const oQue = (t.description ?? "").trim();
  if (oQue) linhas.push("", "O que é para fazer:", oQue);
  linhas.push("", `Pedido CLYON #${t.pedidoId}: ${ligacaoDoPedido}`);

  return {
    uid: `clyon-trabalho-${t.negociacaoId}@clyon.pt`,
    titulo: `CLYON #${t.pedidoId} · ${nomeDoServico(t.serviceType)}`,
    inicio,
    fim,
    local: (t.morada ?? t.city ?? "").trim(),
    descricao: linhas.join("\n"),
    ligacaoDoPedido,
  };
}

/** «3.º andar · sem elevador · estacionar à porta» — só o que o cliente disse. */
export function acessoPorExtenso(
  andar: string | null | undefined,
  elevador: string | null | undefined,
  estacionamento: string | null | undefined,
): string | null {
  const partes = [
    andarPorExtenso(andar),
    elevadorPorExtenso(elevador),
    estacionamentoPorExtenso(estacionamento) ? `estacionar ${estacionamentoPorExtenso(estacionamento)}` : null,
  ].filter((p): p is string => !!p);
  return partes.length ? partes.join(" · ") : null;
}

// ── Google Agenda ────────────────────────────────────────────────────────────

/** O tecto do texto na ligação: um endereço longo demais o Google recusa. O .ics leva tudo. */
export const MAXIMO_DA_DESCRICAO_NO_GOOGLE = 1500;

/**
 * A LIGAÇÃO DO GOOGLE AGENDA. As horas vão escritas no relógio de Lisboa, sem
 * «Z», com `ctz=Europe/Lisbon`: assim o Google mostra-as certas esteja o
 * telemóvel noutro fuso, e no dia da mudança da hora também.
 */
export function ligacaoDoGoogle(e: EventoDaAgenda): string {
  let detalhes = e.descricao;
  if (detalhes.length > MAXIMO_DA_DESCRICAO_NO_GOOGLE) {
    // A ligação do pedido fica sempre: é a última linha, e é ela que leva ao resto.
    const fimDoTexto = `\n…\n\nPedido: ${e.ligacaoDoPedido}`;
    detalhes = detalhes.slice(0, MAXIMO_DA_DESCRICAO_NO_GOOGLE - fimDoTexto.length) + fimDoTexto;
  }
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.titulo,
    dates: `${emLisboa(e.inicio)}/${emLisboa(e.fim)}`,
    ctz: FUSO_DA_AGENDA,
    details: detalhes,
    location: e.local,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

// ── O ficheiro .ics (RFC 5545) ───────────────────────────────────────────────

/** As regras de Lisboa: hora de Verão do último domingo de Março ao último de Outubro. */
const FUSO_DE_LISBOA_ICS = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Lisbon",
  "X-LIC-LOCATION:Europe/Lisbon",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0000",
  "TZOFFSETTO:+0100",
  "TZNAME:WEST",
  "DTSTART:19700329T010000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0000",
  "TZNAME:WET",
  "DTSTART:19701025T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/**
 * O FICHEIRO .ics. `agora` entra no DTSTAMP e no SEQUENCE: com o mesmo UID e
 * um SEQUENCE maior, o Apple e o Outlook actualizam o evento que ele já tinha
 * (o dia mudou) em vez de criarem outro.
 */
export function ficheiroIcs(e: EventoDaAgenda, agora: Date = new Date()): string {
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CLYON//Agenda do profissional//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...FUSO_DE_LISBOA_ICS,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${emUtc(agora)}`,
    `SEQUENCE:${Math.max(0, Math.floor(agora.getTime() / 60_000))}`,
    `DTSTART;TZID=${FUSO_DA_AGENDA}:${emLisboa(e.inicio)}`,
    `DTEND;TZID=${FUSO_DA_AGENDA}:${emLisboa(e.fim)}`,
    `SUMMARY:${textoIcs(e.titulo)}`,
    ...(e.local ? [`LOCATION:${textoIcs(e.local)}`] : []),
    `DESCRIPTION:${textoIcs(e.descricao)}`,
    `URL:${e.ligacaoDoPedido}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return linhas.map(dobrarLinha).join("\r\n") + "\r\n";
}

/** Um TEXT do iCalendar: barra, ponto e vírgula e vírgula escapados; mudanças de linha como «\n». */
export function textoIcs(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Linhas de no máximo 75 octetos (RFC 5545 §3.1): as seguintes começam com um
 * espaço. Conta-se em UTF-8 e nunca se parte um carácter a meio — «ç» são dois
 * octetos, e partido ao meio o Outlook mostra lixo.
 */
export function dobrarLinha(linha: string): string {
  const partes: string[] = [];
  let actual = "";
  let octetos = 0;
  for (const ch of linha) {
    const n = octetosDe(ch);
    const limite = partes.length === 0 ? 75 : 74; // as dobradas já levam o espaço
    if (octetos + n > limite) {
      partes.push(actual);
      actual = "";
      octetos = 0;
    }
    actual += ch;
    octetos += n;
  }
  partes.push(actual);
  return partes.join("\r\n ");
}

function octetosDe(ch: string): number {
  const c = ch.codePointAt(0) ?? 0;
  return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
}

// ── Horas ────────────────────────────────────────────────────────────────────

const dois = (n: number) => String(n).padStart(2, "0");

/** `AAAAMMDDTHHMMSS` no relógio de Lisboa. */
export function emLisboa(d: Date): string {
  const p = pecasEmLisboa(d);
  return `${p.ano}${dois(p.mes)}${dois(p.dia)}T${dois(p.hora)}${dois(p.minuto)}${dois(p.segundo)}`;
}

/** `AAAAMMDDTHHMMSSZ` em UTC. */
function emUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Um instante da base ou da API; as datas sem fuso da base lêem-se em UTC (`a-base-e-lida-em-utc`). */
function instanteDe(v: Date | string | null | undefined): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const t = String(v).trim();
  const semFuso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(t);
  const d = new Date(semFuso ? `${t.replace(" ", "T")}Z` : t);
  return Number.isNaN(d.getTime()) ? null : d;
}
