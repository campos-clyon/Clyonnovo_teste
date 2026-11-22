import { diaEmLisboa, instanteEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";
import { eDeTeste } from "./lembrete-do-que-falta";
import { ESPERA_RECENTE_S, haQuanto, type ConversaNaMesa } from "./mesa-das-conversas";

/**
 * A CAIXA DOS CONTACTOS — d85, fase 1 (CEO e dono, 22-11-2026).
 *
 * *«Todos os contactos guardados numa secção, e todos respondidos.»* — o dono.
 * A 17-11 havia 17 conversas por responder, 12 há mais de 3 dias, e os
 * contactos estavam espalhados: a mesa das conversas do WhatsApp, os
 * formulários do site (a tabela `leads`, com o estado mudado à mão noutra
 * secção), a «Suporte CLYON» da app e o email geral@, que nem entra no
 * sistema. Cada sítio sabia de si; nenhum dizia quem estava à espera de nós.
 *
 * Aqui junta-se tudo numa linha por pessoa — pelo telefone (os últimos 9
 * dígitos, como a base em todo o lado) e pelo email quando não há telefone —,
 * com os canais por onde escreveu, o estado, quem respondeu e há quanto tempo
 * espera.
 *
 * NADA SE DECIDE DE NOVO. Cada canal continua a ser quem sabe de si: o estado
 * de uma conversa do WhatsApp é o da mesa (`naMesa`), o de um formulário é o
 * estado do lead, o da Suporte CLYON é quem escreveu por último. A caixa só os
 * traduz para quatro palavras e junta-os. Marcar «Respondido» aqui muda o
 * estado em cada sítio (o «Já respondi» da mesa, o `contactado` do lead), para
 * as secções dizerem todas o mesmo.
 *
 * O PRAZO: dentro do horário (segunda a sábado, 08h–20h em Lisboa), uma
 * pessoa à espera há mais de 2 h fica a vermelho. Fora do horário o relógio
 * não anda: quem escreve às 23h começa a contar às 08h.
 *
 * As contas de teste e os números bloqueados ficam de fora. Nada se apaga.
 *
 * PURO: as entradas vêm da base (`caixa-dos-contactos-na-base.ts`) e o
 * relógio de fora.
 */

export type CanalDoContacto = "whatsapp" | "formulario" | "suporte" | "email";

/** Os canais, pela ordem dos filtros. O email geral@ ainda não entra (ver `EMAIL_GERAL_LIGADO`). */
export const CANAIS_DO_CONTACTO: ReadonlyArray<{ id: CanalDoContacto; titulo: string }> = [
  { id: "whatsapp", titulo: "WhatsApp" },
  { id: "formulario", titulo: "Formulário" },
  { id: "suporte", titulo: "Suporte da app" },
  { id: "email", titulo: "Email geral@" },
];

/**
 * O EMAIL GERAL@ — preparado, por ligar. Ligar a caixa de correio pede uma
 * decisão e as credenciais do dono (um encaminhamento para um endereço de
 * entrada, ou a API do Gmail). Até lá o canal existe, aparece nos filtros com
 * «por ligar», e não traz entradas.
 */
export const EMAIL_GERAL_LIGADO = false;

export type EstadoDoContacto = "por_responder" | "respondido" | "com_pessoa" | "fechado";

export const ROTULO_DO_ESTADO: Record<EstadoDoContacto, string> = {
  por_responder: "Por responder",
  respondido: "Respondido",
  com_pessoa: "Com uma pessoa",
  fechado: "Fechado",
};

/** Quem deu a última resposta: a Vitória, a equipa no backoffice, ou a equipa no telemóvel. */
export type QuemRespondeu = "vitoria" | "equipa_backoffice" | "equipa_telemovel";

export const ROTULO_DE_QUEM_RESPONDEU: Record<QuemRespondeu, string> = {
  vitoria: "Vitória",
  equipa_backoffice: "Equipa pelo backoffice",
  equipa_telemovel: "Equipa pelo telemóvel",
};

/** Mais de 2 h à espera, contadas dentro do horário, é tarde. */
export const PRAZO_DA_RESPOSTA_S = 2 * 3600;

/** O horário em que o prazo anda: segunda a sábado, das 08h às 20h em Lisboa. */
export const HORA_EM_QUE_O_PRAZO_COMECA = 8;
export const HORA_EM_QUE_O_PRAZO_ACABA = 20;

/** Mais de 3 dias à espera — a mesma linha da mesa das conversas (`ESPERA_RECENTE_S`). */
export const ESPERA_ANTIGA_S = ESPERA_RECENTE_S;

/**
 * Uma entrada de um canal: uma conversa do WhatsApp, um formulário, uma
 * Suporte CLYON. Várias entradas da mesma pessoa fazem um contacto.
 */
export type EntradaDoContacto = {
  canal: CanalDoContacto;
  /** Identifica a entrada na sua secção: «wa:<dígitos>», «lead:<id>», «sup:<id>». */
  ref: string;
  telefone: string | null;
  email: string | null;
  nome: string | null;
  /** Os dados de contacto já não existem (conta apagada, formulário sem contacto). */
  anonimizado: boolean;
  deTeste: boolean;
  bloqueado: boolean;
  estado: EstadoDoContacto;
  /** Desde quando esta pessoa espera por nós neste canal — só «Por responder». */
  esperaDesde: Date | null;
  /** O último movimento neste canal, de qualquer dos lados. */
  ultimoEm: Date | null;
  /** Quem falou por último neste canal. */
  quemFalou: "contacto" | "nos" | null;
  quemRespondeu: QuemRespondeu | null;
  /** O nome de quem marcou «Respondido» na caixa, quando foi aí. */
  respondidoPorNome: string | null;
  /** Quando foi a última resposta nossa (ou a marca «Respondido»). */
  respondidoEm: Date | null;
  /** A última mensagem, ou o que o formulário dizia — numa linha. */
  resumo: string | null;
  /** Porque está neste estado, numa frase. */
  porque: string;
  pedidos: number[];
  /** Quem escreve é um profissional registado. */
  profissional: boolean;
};

export type Contacto = {
  /** «t:<9 dígitos>», «e:<email>», ou «r:<ref>» para quem não deixou nenhum dos dois. */
  chave: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  anonimizado: boolean;
  canais: CanalDoContacto[];
  estado: EstadoDoContacto;
  esperaDesde: Date | null;
  /** Há quantos segundos espera, no relógio. */
  esperaS: number | null;
  /** Há quantos segundos espera, contados só dentro do horário. */
  esperaUtilS: number | null;
  /** Por responder há mais de 2 h dentro do horário. */
  atrasado: boolean;
  /** Por responder há mais de 3 dias. */
  antigo: boolean;
  ultimoEm: Date | null;
  quemFalou: "contacto" | "nos" | null;
  quemRespondeu: QuemRespondeu | null;
  respondidoPorNome: string | null;
  respondidoEm: Date | null;
  resumo: string | null;
  porque: string;
  pedidos: number[];
  profissional: boolean;
  entradas: EntradaDoContacto[];
};

/* ── Ajudas ─────────────────────────────────────────────────────────────── */

export const nove = (t: string | null | undefined): string => String(t ?? "").replace(/\D/g, "").slice(-9);

export function emailLimpo(e: string | null | undefined): string | null {
  const x = String(e ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x) ? x : null;
}

const antes = (segundos: number | null | undefined, agora: Date): Date | null =>
  segundos == null || !Number.isFinite(segundos) ? null : new Date(agora.getTime() - Math.max(0, segundos) * 1000);

const maisRecente = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a.getTime() >= b.getTime() ? a : b);
const maisAntiga = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a.getTime() <= b.getTime() ? a : b);

function umaLinha(t: string | null | undefined, max = 110): string | null {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/* ── O prazo, em horas de trabalho ──────────────────────────────────────── */

/** O dia da semana de um `YYYY-MM-DD` de Lisboa (0 = domingo), contado no papel. */
function diaDaSemanaDoDia(dia: string): number {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/**
 * QUANTOS SEGUNDOS DE HORÁRIO passaram entre `desde` e `agora` — só de
 * segunda a sábado, das 08h às 20h em Lisboa, seja qual for o fuso do
 * servidor ou de quem olha. Quem escreve no domingo, ou às 23h, começa a
 * contar à abertura seguinte. Mais de 60 dias de espera contam-se como 60 —
 * a essa distância o número já não muda nada.
 */
export function segundosDeHorario(desde: Date, agora: Date): number {
  if (!(desde instanceof Date) || Number.isNaN(desde.getTime()) || desde.getTime() >= agora.getTime()) return 0;
  const doisDigitos = (n: number) => String(n).padStart(2, "0");
  let dia = diaEmLisboa(desde);
  const ultimo = diaEmLisboa(agora);
  let total = 0;
  for (let i = 0; i < 61 && dia <= ultimo; i++, dia = somarDiasAoDia(dia, 1)) {
    if (diaDaSemanaDoDia(dia) === 0) continue;
    const abre = instanteEmLisboa(`${dia}T${doisDigitos(HORA_EM_QUE_O_PRAZO_COMECA)}:00`);
    const fecha = instanteEmLisboa(`${dia}T${doisDigitos(HORA_EM_QUE_O_PRAZO_ACABA)}:00`);
    if (!abre || !fecha) continue;
    const de = Math.max(abre.getTime(), desde.getTime());
    const ate = Math.min(fecha.getTime(), agora.getTime());
    if (ate > de) total += ate - de;
  }
  return Math.floor(total / 1000);
}

/* ── As entradas de cada canal ──────────────────────────────────────────── */

/**
 * UMA CONVERSA DO WHATSAPP — pelo estado da mesa (`naMesa`), que é quem sabe.
 *
 *   · «Por responder» da mesa → por responder (a última palavra foi dele, ou a
 *     Vitória deixou a pergunta anotada para uma pessoa);
 *   · resolvida → fechado;
 *   · entregue a uma pessoa (a Vitória cala-se) → com uma pessoa;
 *   · o resto (a Vitória a recolher, à espera do cliente, com pedido) → respondido.
 *
 * QUEM RESPONDEU: a equipa no telemóvel quando a última palavra veio do
 * telemóvel ou foi escrita à mão lá (a marca «[à mão]» da ponte); a equipa no
 * backoffice quando foi o «Já respondi» do painel, ou a resposta escrita no
 * painel (grava a mensagem e o «Já respondi» no mesmo instante — `respondidaHaS`
 * perto da última mensagem); a Vitória no resto.
 */
export function entradaDoWhatsApp(
  l: Pick<
    ConversaNaMesa,
    "telefone" | "estado" | "porque" | "dono" | "ultimaMensagem" | "haSegundos" | "quemFalou" | "onde" | "pedido" | "profissional"
  >,
  agora: Date,
  extra: { deTeste?: boolean; respondidaHaS?: number | null; marca?: MarcaDeRespondido | null } = {},
): EntradaDoContacto {
  const ultimoEm = antes(l.haSegundos, agora);
  const estado: EstadoDoContacto =
    l.estado === "por_responder"
      ? "por_responder"
      : l.estado === "resolvida"
        ? "fechado"
        : l.dono === "equipa"
          ? "com_pessoa"
          : "respondido";

  let quemRespondeu: QuemRespondeu | null = null;
  if (l.quemFalou === "equipa") {
    quemRespondeu = l.onde === "painel" ? "equipa_backoffice" : "equipa_telemovel";
  } else if (l.quemFalou === "vitoria") {
    const pertoDoJaRespondi =
      extra.respondidaHaS != null && l.haSegundos != null && Math.abs(extra.respondidaHaS - l.haSegundos) <= 300;
    quemRespondeu = pertoDoJaRespondi ? "equipa_backoffice" : "vitoria";
  }
  const nossa = l.quemFalou === "vitoria" || l.quemFalou === "equipa";
  const marca = marcaQueVale(extra.marca, l.quemFalou === "cliente" ? ultimoEm : null, agora);

  return {
    canal: "whatsapp",
    ref: `wa:${String(l.telefone).replace(/\D/g, "")}`,
    telefone: l.telefone,
    email: null,
    nome: l.profissional?.nome ?? null,
    anonimizado: false,
    deTeste: Boolean(extra.deTeste),
    bloqueado: l.estado === "bloqueada",
    estado,
    esperaDesde: estado === "por_responder" ? ultimoEm : null,
    ultimoEm,
    quemFalou: l.quemFalou == null ? null : l.quemFalou === "cliente" ? "contacto" : "nos",
    quemRespondeu,
    respondidoPorNome: nossa && marca ? marca.porQuem : null,
    respondidoEm: nossa ? ultimoEm : null,
    resumo: umaLinha(l.ultimaMensagem),
    porque: l.porque,
    pedidos: l.pedido ? [l.pedido.id] : [],
    profissional: l.profissional != null,
  };
}

/** Um formulário do site, como a base o devolve (`leads`). */
export type FormularioParaACaixa = {
  id: number;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  status: string | null;
  tipoServico: string | null;
  mensagem: string | null;
  origem: string | null;
  /** Há quantos segundos entrou (pela base). */
  haSegundos: number | null;
  /** Há quantos segundos mudou de estado (o `updatedAt`), se a coluna existir. */
  mudadoHaSegundos?: number | null;
};

/** Os estados de um lead (`/api/leads`) e o que querem dizer na caixa. */
export const ESTADO_DO_FORMULARIO: Record<string, EstadoDoContacto> = {
  novo: "por_responder",
  contactado: "respondido",
  orcamento_enviado: "respondido",
  fechado: "fechado",
  perdido: "fechado",
};

/** O estado que a caixa grava num lead ao marcar «Respondido» — o mesmo do botão dos Leads. */
export const ESTADO_DO_LEAD_RESPONDIDO = "contactado";

/** A marca «Respondido» que a caixa grava: quem e há quanto tempo. */
export type MarcaDeRespondido = { porQuem: string | null; haSegundos: number | null };

/** A marca só vale se for depois da última palavra do contacto. */
function marcaQueVale(marca: MarcaDeRespondido | null | undefined, ultimaDoContacto: Date | null, agora: Date) {
  if (!marca || marca.haSegundos == null) return null;
  const em = antes(marca.haSegundos, agora);
  if (!em) return null;
  if (ultimaDoContacto && em.getTime() + 1000 < ultimaDoContacto.getTime()) return null;
  return { porQuem: marca.porQuem, em };
}

/**
 * UM FORMULÁRIO — o estado é o do lead, e só ele. «Novo» é por responder,
 * desde que entrou; «contactado» é respondido. Marcar «Respondido» na caixa
 * passa o lead a «contactado» (`ESTADO_DO_LEAD_RESPONDIDO`); voltar a «novo»
 * nos Leads volta a pô-lo por responder aqui. Quem: o nome de quem marcou na
 * caixa; mudado nos Leads, «a equipa pelo backoffice».
 */
export function entradaDoFormulario(
  f: FormularioParaACaixa,
  agora: Date,
  extra: { marca?: MarcaDeRespondido | null } = {},
): EntradaDoContacto {
  const estado = ESTADO_DO_FORMULARIO[String(f.status ?? "novo")] ?? "por_responder";
  const entrou = antes(f.haSegundos, agora);
  const marca = marcaQueVale(extra.marca, entrou, agora);
  const respondidoEm = estado === "por_responder" ? null : (marca?.em ?? antes(f.mudadoHaSegundos ?? null, agora));
  const telefone = nove(f.telefone).length === 9 ? String(f.telefone) : null;
  const email = emailLimpo(f.email);
  const servico = umaLinha(f.tipoServico, 40);
  return {
    canal: "formulario",
    ref: `lead:${f.id}`,
    telefone,
    email,
    nome: umaLinha(f.nome, 80),
    anonimizado: !telefone && !email,
    deTeste: eDeTeste(f.nome, f.email),
    bloqueado: false,
    estado,
    esperaDesde: estado === "por_responder" ? entrou : null,
    ultimoEm: maisRecente(entrou, respondidoEm),
    quemFalou: estado === "por_responder" ? "contacto" : "nos",
    quemRespondeu: estado === "por_responder" ? null : "equipa_backoffice",
    respondidoPorNome: estado === "por_responder" ? null : (marca?.porQuem ?? null),
    respondidoEm,
    resumo: umaLinha([servico, f.mensagem].filter(Boolean).join(" — ")),
    porque:
      estado === "por_responder"
        ? `Formulário ${haQuanto(f.haSegundos)}${servico ? ` (${servico})` : ""} — ainda ninguém o marcou como respondido`
        : estado === "fechado"
          ? `Formulário ${f.status === "perdido" ? "perdido" : "fechado"} nos Leads`
          : "Formulário respondido",
    pedidos: [],
    profissional: false,
  };
}

/** Uma «Suporte CLYON» da app, como a base a devolve. */
export type SuporteParaACaixa = {
  id: number;
  estado: string | null;
  atendidaPor: string | null;
  ultimoAutor: string | null;
  ultimaMensagem: string | null;
  /** Há quantos segundos foi a última mensagem. */
  ultimaHaSegundos: number | null;
  /** Há quantos segundos o cliente escreveu a primeira mensagem ainda sem resposta. */
  esperaHaSegundos: number | null;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  /** A conta do cliente foi apagada. */
  contaApagada: boolean;
};

/**
 * UMA SUPORTE CLYON — quem escreveu por último. O cliente → por responder,
 * desde a primeira mensagem dele que ficou sem resposta (salvo uma marca
 * «Respondido» da caixa depois dela: respondeu-se por telefone ou por email).
 * Fechada → fechado. Atendida pela equipa → com uma pessoa. O resto → respondido.
 */
export function entradaDoSuporte(
  s: SuporteParaACaixa,
  agora: Date,
  extra: { marca?: MarcaDeRespondido | null } = {},
): EntradaDoContacto {
  const ultimoEm = antes(s.ultimaHaSegundos, agora);
  const doCliente = s.ultimoAutor === "cliente";
  const marca = marcaQueVale(extra.marca, doCliente ? ultimoEm : null, agora);
  const porResponder = doCliente && !marca;
  const estado: EstadoDoContacto =
    s.estado === "fechada"
      ? "fechado"
      : porResponder
        ? "por_responder"
        : s.atendidaPor === "equipa"
          ? "com_pessoa"
          : "respondido";
  const quemRespondeu: QuemRespondeu | null = doCliente
    ? marca
      ? "equipa_backoffice"
      : null
    : s.ultimoAutor === "equipa"
      ? "equipa_backoffice"
      : s.ultimoAutor
        ? "vitoria"
        : null;
  const telefone = nove(s.telefone).length === 9 ? String(s.telefone) : null;
  const email = s.contaApagada ? null : emailLimpo(s.email);
  return {
    canal: "suporte",
    ref: `sup:${s.id}`,
    telefone: s.contaApagada ? null : telefone,
    email,
    nome: s.contaApagada ? null : umaLinha(s.nome, 80),
    anonimizado: s.contaApagada || (!telefone && !email),
    deTeste: eDeTeste(s.nome, s.email),
    bloqueado: false,
    estado,
    esperaDesde: estado === "por_responder" ? (antes(s.esperaHaSegundos, agora) ?? ultimoEm) : null,
    ultimoEm: maisRecente(ultimoEm, marca?.em ?? null),
    quemFalou: s.ultimoAutor == null ? null : doCliente && !marca ? "contacto" : "nos",
    quemRespondeu,
    respondidoPorNome: marca?.porQuem ?? null,
    respondidoEm: doCliente ? (marca?.em ?? null) : ultimoEm,
    resumo: umaLinha(s.ultimaMensagem),
    porque:
      estado === "por_responder"
        ? `Escreveu no Suporte da app ${haQuanto(s.esperaHaSegundos ?? s.ultimaHaSegundos)} — sem resposta`
        : estado === "fechado"
          ? "Suporte fechado"
          : estado === "com_pessoa"
            ? "Pediu uma pessoa no Suporte da app"
            : "Respondido no Suporte da app",
    pedidos: [],
    profissional: false,
  };
}

/* ── Juntar ─────────────────────────────────────────────────────────────── */

/** As chaves por onde uma entrada se junta às outras: o telefone, e o email. */
function chavesDaEntrada(e: EntradaDoContacto): string[] {
  const out: string[] = [];
  const t = nove(e.telefone);
  if (t.length === 9) out.push(`t:${t}`);
  const m = emailLimpo(e.email);
  if (m) out.push(`e:${m}`);
  return out;
}

const PESO_DO_ESTADO: Record<EstadoDoContacto, number> = { por_responder: 3, com_pessoa: 2, respondido: 1, fechado: 0 };

/**
 * JUNTAR AS ENTRADAS EM PESSOAS — pelo telefone, e pelo email: quem deixou o
 * telefone e o email num formulário junta a conversa do WhatsApp (o telefone)
 * à Suporte CLYON da conta (o email). As de teste saem; um número bloqueado
 * tira a pessoa inteira — não é um cliente.
 *
 * O ESTADO DA PESSOA é o que mais espera por nós: basta um canal por responder
 * para ela estar por responder, e a espera é a do mais antigo. Depois, com uma
 * pessoa; depois, respondido; fechado só se tudo estiver fechado.
 */
export function juntarContactos(entradas: readonly EntradaDoContacto[], agora: Date): Contacto[] {
  const validas = entradas.filter((e) => !e.deTeste);
  // Union-find pelas chaves.
  const pai = new Map<string, string>();
  const raiz = (x: string): string => {
    let r = x;
    while (pai.get(r) !== r) r = pai.get(r) as string;
    let y = x;
    while (pai.get(y) !== r) {
      const seguinte = pai.get(y) as string;
      pai.set(y, r);
      y = seguinte;
    }
    return r;
  };
  const unir = (a: string, b: string) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) pai.set(rb, ra);
  };
  const chavesDe = new Map<EntradaDoContacto, string[]>();
  for (const e of validas) {
    const chaves = chavesDaEntrada(e);
    const proprias = chaves.length > 0 ? chaves : [`r:${e.ref}`];
    chavesDe.set(e, proprias);
    for (const c of proprias) if (!pai.has(c)) pai.set(c, c);
    for (let i = 1; i < proprias.length; i++) unir(proprias[0], proprias[i]);
  }
  const grupos = new Map<string, EntradaDoContacto[]>();
  for (const e of validas) {
    const r = raiz((chavesDe.get(e) as string[])[0]);
    const g = grupos.get(r);
    if (g) g.push(e);
    else grupos.set(r, [e]);
  }

  const out: Contacto[] = [];
  for (const lista of grupos.values()) {
    if (lista.some((e) => e.bloqueado)) continue;
    out.push(contactoDe(lista, agora));
  }
  return out;
}

function contactoDe(lista: EntradaDoContacto[], agora: Date): Contacto {
  const porOrdem = [...lista].sort((a, b) => (b.ultimoEm?.getTime() ?? 0) - (a.ultimoEm?.getTime() ?? 0));
  const estado = lista.reduce<EstadoDoContacto>(
    (melhor, e) => (PESO_DO_ESTADO[e.estado] > PESO_DO_ESTADO[melhor] ? e.estado : melhor),
    "fechado",
  );
  const aEsperar = lista.filter((e) => e.estado === "por_responder");
  const esperaDesde = aEsperar.reduce<Date | null>((d, e) => maisAntiga(d, e.esperaDesde), null);
  const esperaS = esperaDesde ? Math.max(0, Math.floor((agora.getTime() - esperaDesde.getTime()) / 1000)) : null;
  const esperaUtilS = esperaDesde ? segundosDeHorario(esperaDesde, agora) : null;
  const respondida = [...lista]
    .filter((e) => e.quemRespondeu != null)
    .sort((a, b) => (b.respondidoEm?.getTime() ?? 0) - (a.respondidoEm?.getTime() ?? 0))[0];
  const primeiro = <T>(f: (e: EntradaDoContacto) => T | null): T | null => {
    for (const e of porOrdem) {
      const v = f(e);
      if (v != null && v !== "") return v;
    }
    return null;
  };
  const telefone = primeiro((e) => (nove(e.telefone).length === 9 ? e.telefone : null));
  const email = primeiro((e) => emailLimpo(e.email));
  const chave = telefone ? `t:${nove(telefone)}` : email ? `e:${email}` : `r:${porOrdem[0].ref}`;
  // O porquê e o resumo vêm do canal que espera há mais tempo — ou, sem espera, do mais recente.
  const quemDiz =
    aEsperar.sort((a, b) => (a.esperaDesde?.getTime() ?? 0) - (b.esperaDesde?.getTime() ?? 0))[0] ?? porOrdem[0];
  const canais = [...new Set(lista.map((e) => e.canal))].sort(
    (a, b) => CANAIS_DO_CONTACTO.findIndex((c) => c.id === a) - CANAIS_DO_CONTACTO.findIndex((c) => c.id === b),
  );
  return {
    chave,
    nome: primeiro((e) => e.nome),
    telefone,
    email,
    anonimizado: !telefone && !email,
    canais,
    estado,
    esperaDesde,
    esperaS,
    esperaUtilS,
    atrasado: estado === "por_responder" && (esperaUtilS ?? 0) > PRAZO_DA_RESPOSTA_S,
    antigo: estado === "por_responder" && (esperaS ?? 0) > ESPERA_ANTIGA_S,
    ultimoEm: porOrdem[0]?.ultimoEm ?? null,
    quemFalou: porOrdem[0]?.quemFalou ?? null,
    quemRespondeu: respondida?.quemRespondeu ?? null,
    respondidoPorNome: respondida?.respondidoPorNome ?? null,
    respondidoEm: respondida?.respondidoEm ?? null,
    resumo: quemDiz.resumo,
    porque: quemDiz.porque,
    pedidos: [...new Set(lista.flatMap((e) => e.pedidos))].sort((a, b) => b - a),
    profissional: lista.some((e) => e.profissional),
    entradas: porOrdem,
  };
}

/* ── Filtrar, ordenar, contar ───────────────────────────────────────────── */

export type FiltroDaCaixa = "por_responder" | "todos";

/**
 * A lista que se vê. «Por responder» (por omissão): quem espera há mais tempo
 * primeiro, MAS SÓ DENTRO DOS ÚLTIMOS 3 DIAS — a regra da mesa das conversas
 * (`ordenarNaMesa`): uma espera de há semanas pode ter sido respondida por
 * telefone, e não pode empurrar as de hoje para baixo; as antigas vêm depois.
 * «Todos»: o movimento mais recente primeiro.
 */
export function contactosAVer(
  lista: readonly Contacto[],
  filtro: FiltroDaCaixa,
  canal: CanalDoContacto | null = null,
): Contacto[] {
  const doCanal = canal ? lista.filter((c) => c.canais.includes(canal)) : [...lista];
  if (filtro === "todos") {
    return doCanal.sort((a, b) => (b.ultimoEm?.getTime() ?? 0) - (a.ultimoEm?.getTime() ?? 0));
  }
  return doCanal
    .filter((c) => c.estado === "por_responder")
    .sort((a, b) => {
      if (a.antigo !== b.antigo) return a.antigo ? 1 : -1;
      const ea = a.esperaS ?? 0;
      const eb = b.esperaS ?? 0;
      return a.antigo ? ea - eb : eb - ea;
    });
}

export type MedidaDaCaixa = {
  /** Pessoas por responder. */
  porResponder: number;
  /** Por responder há mais de 2 h dentro do horário. */
  maisDeDuasHoras: number;
  /** Por responder há mais de 3 dias. */
  maisDeTresDias: number;
  /** Todas as pessoas na caixa. */
  total: number;
  /** Quantas por responder, em cada canal. */
  porCanal: Record<CanalDoContacto, number>;
};

/** Os números do topo — e o que se grava por dia, para comparar daqui a 14 dias. */
export function medirACaixa(lista: readonly Contacto[]): MedidaDaCaixa {
  const porCanal: Record<CanalDoContacto, number> = { whatsapp: 0, formulario: 0, suporte: 0, email: 0 };
  let porResponder = 0;
  let maisDeDuasHoras = 0;
  let maisDeTresDias = 0;
  for (const c of lista) {
    if (c.estado !== "por_responder") continue;
    porResponder++;
    if (c.atrasado) maisDeDuasHoras++;
    if (c.antigo) maisDeTresDias++;
    for (const e of c.entradas) if (e.estado === "por_responder") porCanal[e.canal]++;
  }
  return { porResponder, maisDeDuasHoras, maisDeTresDias, total: lista.length, porCanal };
}

/**
 * O PONTO DE ENCAIXE DO ACOLHIMENTO — para o I&D, depois da fase 0. Quem
 * precisa de uma primeira resposta: por responder, e sem ninguém nosso a ter
 * falado no canal onde espera. A caixa não responde a ninguém; só diz quem.
 */
export type PrecisaDePrimeiraResposta = {
  chave: string;
  canal: CanalDoContacto;
  ref: string;
  telefone: string | null;
  email: string | null;
  esperaDesde: Date | null;
  dentroDoHorario: boolean;
};

export function quemPrecisaDePrimeiraResposta(lista: readonly Contacto[], agora: Date): PrecisaDePrimeiraResposta[] {
  const out: PrecisaDePrimeiraResposta[] = [];
  for (const c of lista) {
    if (c.estado !== "por_responder") continue;
    for (const e of c.entradas) {
      if (e.estado !== "por_responder" || e.quemRespondeu != null) continue;
      out.push({
        chave: c.chave,
        canal: e.canal,
        ref: e.ref,
        telefone: e.telefone,
        email: e.email,
        esperaDesde: e.esperaDesde,
        dentroDoHorario: emHorarioDoPrazo(agora),
      });
    }
  }
  return out;
}

/** Estamos dentro do horário do prazo? Segunda a sábado, 08h–20h em Lisboa. */
export function emHorarioDoPrazo(agora: Date): boolean {
  const dia = diaEmLisboa(agora);
  if (diaDaSemanaDoDia(dia) === 0) return false;
  return segundosDeHorario(new Date(agora.getTime() - 1000), agora) > 0;
}

/* ── O que «Respondido» faz em cada canal ───────────────────────────────── */

/** Uma ref que a caixa aceita do painel — e só estas. */
export function refValida(ref: unknown): ref is string {
  return typeof ref === "string" && /^(wa:\d{9,15}|lead:\d{1,10}|sup:\d{1,10})$/.test(ref);
}

export type AccaoDoRespondido =
  | { canal: "whatsapp"; telefone: string }
  | { canal: "formulario"; leadId: number }
  | { canal: "suporte"; conversaId: number };

/**
 * O que marcar «Respondido» faz a uma entrada: o «Já respondi» da mesa do
 * WhatsApp, o lead a «contactado», a Suporte CLYON lida pela equipa. Só as
 * entradas por responder mudam — um lead fechado não volta a «contactado».
 */
export function accaoDoRespondido(ref: string): AccaoDoRespondido | null {
  if (!refValida(ref)) return null;
  const [tipo, valor] = ref.split(":");
  if (tipo === "wa") return { canal: "whatsapp", telefone: valor };
  if (tipo === "lead") return { canal: "formulario", leadId: Number(valor) };
  return { canal: "suporte", conversaId: Number(valor) };
}

/* ── Os avisos à equipa ─────────────────────────────────────────────────── */

/**
 * O QUE A CAIXA PÕE NOS AVISOS À EQUIPA — sem repetir o «Do nosso lado».
 *
 * As conversas do WhatsApp por responder há mais de 2 h já avisam pelo «Do
 * nosso lado» da Mesa (o grupo «conversa», com os pedidos em seguimento d83
 * de fora). A caixa só acrescenta o que lá não está: os formulários e a
 * Suporte da app por responder há mais de 2 h dentro do horário. Um por
 * pessoa, a contar da espera mais antiga desses canais.
 */
export type ContactoParaOAviso = {
  chave: string;
  /** O primeiro pedido ligado, se houver. */
  pedidoId: number | null;
  canais: CanalDoContacto[];
  desde: Date;
  esperaUtilS: number;
};

const CANAIS_QUE_O_NOSSO_LADO_JA_AVISA: readonly CanalDoContacto[] = ["whatsapp"];

export function contactosParaOAviso(lista: readonly Contacto[], agora: Date): ContactoParaOAviso[] {
  const out: ContactoParaOAviso[] = [];
  for (const c of lista) {
    if (c.estado !== "por_responder") continue;
    const foraDoNossoLado = c.entradas.filter(
      (e) => e.estado === "por_responder" && !CANAIS_QUE_O_NOSSO_LADO_JA_AVISA.includes(e.canal) && e.esperaDesde,
    );
    if (foraDoNossoLado.length === 0) continue;
    const desde = foraDoNossoLado.reduce<Date | null>((d, e) => maisAntiga(d, e.esperaDesde), null) as Date;
    const esperaUtilS = segundosDeHorario(desde, agora);
    if (esperaUtilS <= PRAZO_DA_RESPOSTA_S) continue;
    out.push({
      chave: c.chave,
      pedidoId: c.pedidos[0] ?? null,
      canais: [...new Set(foraDoNossoLado.map((e) => e.canal))],
      desde,
      esperaUtilS,
    });
  }
  return out;
}

/** O rótulo de um canal. */
export function rotuloDoCanal(c: CanalDoContacto): string {
  return CANAIS_DO_CONTACTO.find((x) => x.id === c)?.titulo ?? c;
}
