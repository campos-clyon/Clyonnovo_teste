/**
 * O TRABALHO SEM DIA — d138 (27-11-2026, o dono). PURO.
 *
 * *«Não podemos aceitar que os trabalhos fiquem mais de 4 dias sem data nem
 * horário.»* E, na correcção do mesmo dia: *«Os parceiros devem colocar»* a
 * data. Quem marca o dia e a hora é o PARCEIRO, no painel ou na app (o mesmo
 * «Marcar o dia» de sempre, `dataCombinada`), depois de o combinar com o
 * cliente. Contado desde a contratação (`contratadaEm`; sem ela, `atribuidaEm`;
 * sem nenhuma, a abertura da negociação), em dias de Lisboa:
 *
 *   · logo a seguir (e já, para os que existem): o aviso ao parceiro —
 *     «Combine o dia e a hora com o cliente e marque-os no pedido #N»;
 *   · ao 2.º dia sem data: um lembrete curto ao parceiro;
 *   · ao 4.º dia: o cartão fica VERMELHO na Agenda e no «Precisa de si»
 *     («Sem data há N dias — combine já») e a conversa passa à equipa;
 *   · com o dia mas sem a HORA (meia-noite, o que fica de um dia sem hora),
 *     conta da mesma maneira — pede-se a hora.
 *
 * A Vitória só pergunta ao cliente («Que dia e hora lhe dão jeito?») quando o
 * parceiro responde que não o consegue contactar. Quando o parceiro marca, o
 * cliente recebe a confirmação curta do dia pelo caminho de sempre
 * (`aviso-de-data-ao-cliente.ts`).
 *
 * Mensagens só na janela de contacto (d7, 9h–20h); cada etapa uma vez por
 * trabalho; nunca o aviso e o lembrete no mesmo dia; os trabalhos do mesmo
 * parceiro vão juntos numa mensagem. O «não contactar» (d93) cala a pergunta
 * ao cliente.
 */

import { naJanelaDeContacto } from "./janela-de-contacto";
import { diaEmLisboa, instanteDaBase, pecasEmLisboa } from "./hora-de-lisboa";

/** Ao 2.º dia sem data, o lembrete ao parceiro. */
export const DIAS_PARA_O_LEMBRETE = 2;
/** Ao 4.º dia sem data, vermelho e à equipa. */
export const DIAS_PARA_A_EQUIPA = 4;
/** Mensagens a parceiros por passagem (de 10 em 10 min) — muitas de seguida fazem a Meta desconfiar do número. */
export const MENSAGENS_POR_PASSAGEM = 8;

/** O que falta marcar: o dia (e a hora), ou só a hora. */
export type FaltaMarcar = "dia" | "hora";

type Data = string | Date | null | undefined;

/** Falta o dia (sem `dataCombinada`), a hora (meia-noite de Lisboa) ou nada. */
export function oQueFaltaMarcar(dataCombinada: Data): FaltaMarcar | null {
  const d = instanteDaBase(dataCombinada ?? null);
  if (!d) return "dia";
  const p = pecasEmLisboa(d);
  return p.hora === 0 && p.minuto === 0 ? "hora" : null;
}

/** Quando foi contratado: o «contratar» do cliente, a atribuição da CLYON, ou a abertura da negociação. */
export function contratadoEm(t: { contratadaEm?: Data; atribuidaEm?: Data; criadaEm?: Data }): Date | null {
  return instanteDaBase(t.contratadaEm ?? null) ?? instanteDaBase(t.atribuidaEm ?? null) ?? instanteDaBase(t.criadaEm ?? null);
}

/** Dias de calendário de Lisboa entre a contratação e hoje (0 = contratado hoje). */
export function diasDesde(desde: Date, agora: Date): number {
  const a = Date.parse(`${diaEmLisboa(desde)}T00:00:00Z`);
  const b = Date.parse(`${diaEmLisboa(agora)}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export type SemDia = {
  falta: FaltaMarcar;
  /** Dias sem data, desde a contratação. */
  dias: number;
  /** A contratação (ISO). */
  desde: string;
  /** 4 dias ou mais: vermelho e à equipa. */
  vermelho: boolean;
  /** «Sem data há 5 dias — combine já», «sem data há 1 dia». */
  etiqueta: string;
};

const haDias = (n: number) => (n === 0 ? "desde hoje" : `há ${n} dia${n === 1 ? "" : "s"}`);

/** O texto do cartão: a vermelho, «Sem data há N dias — combine já»; antes disso, só os dias. */
export function etiquetaSemDia(falta: FaltaMarcar, dias: number): string {
  const o = falta === "dia" ? "data" : "hora";
  return dias >= DIAS_PARA_A_EQUIPA ? `Sem ${o} há ${dias} dias — combine já` : `Sem ${o} ${haDias(dias)}`;
}

/**
 * ESTE TRABALHO ESTÁ SEM DIA? Só os contratados por fazer (o feito, o
 * confirmado e o pago já não esperam dia nenhum). null = tem dia e hora.
 */
export function semDiaDoTrabalho(
  t: { dataCombinada?: Data; contratadaEm?: Data; atribuidaEm?: Data; criadaEm?: Data; feito?: boolean },
  agora: Date,
): SemDia | null {
  if (t.feito) return null;
  const falta = oQueFaltaMarcar(t.dataCombinada);
  if (!falta) return null;
  const desde = contratadoEm(t) ?? agora;
  const dias = diasDesde(desde, agora);
  return { falta, dias, desde: desde.toISOString(), vermelho: dias >= DIAS_PARA_A_EQUIPA, etiqueta: etiquetaSemDia(falta, dias) };
}

/** Do mais antigo para o mais recente (o que espera há mais, primeiro). */
export function doMaisAntigo<T extends { semDia?: SemDia | null }>(a: T, b: T): number {
  const x = a.semDia ? Date.parse(a.semDia.desde) : Infinity;
  const y = b.semDia ? Date.parse(b.semDia.desde) : Infinity;
  return x - y;
}

/* ── O que fazer em cada passagem ───────────────────────────────────────── */

/** O que já se fez a este trabalho (a linha de `trabalhosSemDia`). */
export type EtapasDoSemDia = {
  avisoEm?: Data;
  lembreteEm?: Data;
  equipaEm?: Data;
  /** O parceiro disse que não consegue contactar o cliente: a Vitória pergunta-lhe. */
  clientePedidoEm?: Data;
  clientePerguntadoEm?: Data;
};

export type OQueFazer = { avisar: boolean; lembrar: boolean; equipa: boolean; perguntarAoCliente: boolean };

/**
 * A DECISÃO DE UMA PASSAGEM. As mensagens só na janela de contacto; cada etapa
 * uma vez; o lembrete nunca no dia do aviso; a equipa ao 4.º dia (é por
 * dentro, não espera pela janela); a pergunta ao cliente só depois de o
 * parceiro a pedir, e não com a conversa já na equipa.
 */
export function oQueFazerAoTrabalho(s: SemDia, e: EtapasDoSemDia | null | undefined, agora: Date): OQueFazer {
  const et = e ?? {};
  const janela = naJanelaDeContacto(agora);
  const aviso = instanteDaBase(et.avisoEm ?? null);
  const hoje = diaEmLisboa(agora);
  const equipaJa = instanteDaBase(et.equipaEm ?? null) != null;
  return {
    avisar: janela && !aviso,
    lembrar:
      janela && aviso != null && diaEmLisboa(aviso) !== hoje && !instanteDaBase(et.lembreteEm ?? null) && s.dias >= DIAS_PARA_O_LEMBRETE,
    equipa: s.dias >= DIAS_PARA_A_EQUIPA && !equipaJa,
    perguntarAoCliente:
      janela && !equipaJa && s.dias < DIAS_PARA_A_EQUIPA && instanteDaBase(et.clientePedidoEm ?? null) != null && !instanteDaBase(et.clientePerguntadoEm ?? null),
  };
}

/* ── Os textos ──────────────────────────────────────────────────────────── */

const lista = (ids: readonly number[]) => {
  const n = ids.map((i) => `#${i}`);
  return n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} e ${n[n.length - 1]}`;
};

/** O aviso ao parceiro, logo a seguir à contratação. Vários trabalhos dele, uma mensagem. */
export function avisoAoParceiro(pedidos: readonly number[], falta: FaltaMarcar): string {
  const um = pedidos.length === 1;
  if (falta === "hora") {
    return um
      ? `CLYON · O pedido ${lista(pedidos)} já tem dia, falta a hora. Combine-a com o cliente e marque-a no pedido ${lista(pedidos)} (app ou painel).`
      : `CLYON · Os pedidos ${lista(pedidos)} já têm dia, falta a hora. Combine-a com os clientes e marque-a em cada pedido (app ou painel).`;
  }
  return um
    ? `CLYON · Combine o dia e a hora com o cliente e marque-os no pedido ${lista(pedidos)} (app ou painel).`
    : `CLYON · Combine o dia e a hora com os clientes e marque-os nos pedidos ${lista(pedidos)} (app ou painel).`;
}

/** O lembrete ao 2.º dia. */
export function lembreteAoParceiro(pedidos: readonly number[], falta: FaltaMarcar): string {
  const um = pedidos.length === 1;
  if (falta === "hora") {
    return um
      ? `CLYON · O trabalho ${lista(pedidos)} ainda não tem hora marcada. Marque-a hoje na app.`
      : `CLYON · Os trabalhos ${lista(pedidos)} ainda não têm hora marcada. Marque-a hoje na app.`;
  }
  return um
    ? `CLYON · O trabalho ${lista(pedidos)} ainda não tem dia marcado. Marque-o hoje na app.`
    : `CLYON · Os trabalhos ${lista(pedidos)} ainda não têm dia marcado. Marque-os hoje na app.`;
}

/** O título do aviso na app Pro. */
export function tituloNaApp(pedidos: readonly number[], falta: FaltaMarcar): string {
  return `${falta === "dia" ? "Falta marcar o dia" : "Falta marcar a hora"} — ${pedidos.length === 1 ? "pedido" : "pedidos"} ${lista(pedidos)}`;
}

/** O motivo no cartão da conversa que passa à equipa. */
export function motivoParaAEquipa(p: { pedidoId: number; parceiro: string; falta: FaltaMarcar; dias: number }): string {
  return `${etiquetaSemDia(p.falta, Math.max(p.dias, DIAS_PARA_A_EQUIPA))} — trabalho #${p.pedidoId} com ${p.parceiro}`;
}

/** Os números de pedido de uma mensagem deste aviso (o aviso ou o lembrete), ou []. */
export function pedidosDoAvisoSemDia(texto: string | null | undefined): number[] {
  const t = String(texto ?? "");
  if (!/^CLYON · /.test(t) || !/\b(marque-os|marque-a|marque-o)\b/i.test(t) || !/\b(dia|hora)\b/.test(t)) return [];
  return [...t.matchAll(/#(\d{1,9})/g)].map((m) => Number(m[1])).filter((n, i, a) => a.indexOf(n) === i);
}

const plano = (s: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** O parceiro diz que não consegue falar com o cliente? */
export function naoConsegueContactar(texto: string | null | undefined): boolean {
  const t = plano(String(texto ?? ""));
  if (!t) return false;
  return (
    /\bnao (?:o |a |lhe )?(?:consigo|consegui|conseguimos|estou a conseguir|tenho conseguido)(?: o | a | lhe )?\s*(?:contactar|contatar|falar|ligar|chegar|apanhar|entrar em contacto|entrar em contato|o contactar|a contactar)/.test(t) ||
    /\b(?:o cliente|a cliente|ele|ela|cliente)? ?nao (?:me )?(?:atende|responde|atendeu|respondeu|diz nada)\b/.test(t) ||
    /\bsem (?:resposta|contacto|contato) d[oa] cliente\b/.test(t) ||
    /\bnao tenho o (?:contacto|contato|numero|telefone|telemovel)\b/.test(t)
  );
}

/** A pergunta da Vitória ao cliente, quando o parceiro não o consegue contactar. */
export function perguntaAoCliente(pedidoId: number): string {
  return `Olá! O parceiro do seu pedido #${pedidoId} ainda não conseguiu falar consigo para combinar o dia. Que dia e hora lhe dão jeito?`;
}

/** O obrigado ao parceiro que disse que não consegue contactar o cliente. */
export function obrigadoAoParceiroSemContacto(pedidos: readonly number[]): string {
  return `Obrigada! Vou perguntar ao cliente ${pedidos.length === 1 ? "do pedido" : "dos pedidos"} ${lista(pedidos)} que dia e hora lhe dão jeito, e digo-lhe.`;
}

/** …e quando a conversa do cliente já está com a equipa (o 4.º dia passou). */
export function obrigadoAoParceiroComAEquipa(pedidos: readonly number[]): string {
  return `Obrigada! Uma pessoa da equipa da CLYON vai falar com o cliente ${pedidos.length === 1 ? "do pedido" : "dos pedidos"} ${lista(pedidos)} para combinar o dia.`;
}

/* ── A passagem, com o mundo de fora fingível ───────────────────────────── */

export type TrabalhoParaOSemDia = {
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  parceiro: string;
  telefoneParceiro: string | null;
  emailParceiro: string | null;
  /** A vontade dele (`whatsappAvisos`, que o «parar» desliga). */
  querWhatsApp: boolean;
  telefoneCliente: string | null;
  dataCombinada: Data;
  contratadaEm?: Data;
  atribuidaEm?: Data;
  criadaEm?: Data;
};

export type EtapaDoSemDia = "aviso" | "lembrete" | "equipa" | "cliente";

export type DependenciasDoSemDia = {
  agora: Date;
  trabalhos: () => Promise<TrabalhoParaOSemDia[]>;
  /** As etapas já feitas, por `${negociacaoId}:${falta}`. */
  etapas: (chaves: string[]) => Promise<Map<string, EtapasDoSemDia>>;
  /** Reserva a etapa (uma vez só). false = já estava: não se faz outra vez. */
  reservar: (t: TrabalhoParaOSemDia, falta: FaltaMarcar, etapa: EtapaDoSemDia) => Promise<boolean>;
  /** Manda ao parceiro (WhatsApp dos avisos e app Pro): os canais por onde saiu. */
  enviarAoParceiro: (t: TrabalhoParaOSemDia, texto: string, titulo: string, pedidos: number[]) => Promise<string[]>;
  passarAEquipa: (t: TrabalhoParaOSemDia, motivo: string) => Promise<void>;
  naoContactar: (telefone: string) => Promise<boolean>;
  enviarAoCliente: (telefone: string, texto: string) => Promise<boolean>;
  historico: (pedidoId: number, linha: string) => Promise<void>;
};

export const chaveDoSemDia = (negociacaoId: number, falta: FaltaMarcar) => `${negociacaoId}:${falta}`;

/** UMA PASSAGEM: avisos, lembretes, a equipa e a pergunta ao cliente. Devolve as linhas do que fez. */
export async function correrOSemDia(d: DependenciasDoSemDia): Promise<{ linhas: string[] }> {
  const linhas: string[] = [];
  const todos = await d.trabalhos();
  const comFalta = todos
    .map((t) => ({ t, s: semDiaDoTrabalho(t, d.agora) }))
    .filter((x): x is { t: TrabalhoParaOSemDia; s: SemDia } => x.s != null);
  if (comFalta.length === 0) return { linhas };
  const etapas = await d.etapas(comFalta.map((x) => chaveDoSemDia(x.t.negociacaoId, x.s.falta)));

  // As mensagens ao parceiro juntam-se por parceiro, por tipo e pelo que falta.
  const grupos = new Map<string, { tipo: "aviso" | "lembrete"; falta: FaltaMarcar; t: TrabalhoParaOSemDia; membros: TrabalhoParaOSemDia[] }>();
  for (const { t, s } of comFalta) {
    const e = etapas.get(chaveDoSemDia(t.negociacaoId, s.falta));
    const o = oQueFazerAoTrabalho(s, e, d.agora);
    if (o.equipa && (await d.reservar(t, s.falta, "equipa"))) {
      const motivo = motivoParaAEquipa({ pedidoId: t.pedidoId, parceiro: t.parceiro, falta: s.falta, dias: s.dias });
      await d.passarAEquipa(t, motivo).catch(() => {});
      await d.historico(t.pedidoId, `${motivo}: passou à equipa.`).catch(() => {});
      linhas.push(`#${t.pedidoId} à equipa (${s.dias} dias)`);
    }
    const tipo = o.avisar ? "aviso" : o.lembrar ? "lembrete" : null;
    if (tipo) {
      const k = `${t.providerId}:${tipo}:${s.falta}`;
      const g = grupos.get(k) ?? { tipo, falta: s.falta, t, membros: [] };
      g.membros.push(t);
      grupos.set(k, g);
    }
    if (o.perguntarAoCliente && t.telefoneCliente && (await d.reservar(t, s.falta, "cliente"))) {
      if (await d.naoContactar(t.telefoneCliente).catch(() => true)) {
        await d.historico(t.pedidoId, "O parceiro não consegue contactar o cliente, mas o número está em «não contactar»: a Vitória não lhe escreve.").catch(() => {});
        linhas.push(`#${t.pedidoId} cliente em «não contactar»`);
      } else {
        const ok = await d.enviarAoCliente(t.telefoneCliente, perguntaAoCliente(t.pedidoId)).catch(() => false);
        await d.historico(t.pedidoId, ok ? "A Vitória perguntou ao cliente que dia e hora lhe dão jeito (o parceiro não o conseguia contactar)." : "A pergunta do dia ao cliente não saiu.").catch(() => {});
        linhas.push(`#${t.pedidoId} pergunta ao cliente ${ok ? "saiu" : "não saiu"}`);
      }
    }
  }
  // Um tecto por passagem (como os avisos de data): o que sobra sai na seguinte.
  for (const g of [...grupos.values()].slice(0, MENSAGENS_POR_PASSAGEM)) {
    const reservados: number[] = [];
    for (const m of g.membros) if (await d.reservar(m, g.falta, g.tipo)) reservados.push(m.pedidoId);
    if (reservados.length === 0) continue;
    const pedidos = [...new Set(reservados)].sort((a, b) => a - b);
    const texto = g.tipo === "aviso" ? avisoAoParceiro(pedidos, g.falta) : lembreteAoParceiro(pedidos, g.falta);
    const canais = await d.enviarAoParceiro(g.t, texto, tituloNaApp(pedidos, g.falta), pedidos).catch(() => [] as string[]);
    const o = g.tipo === "aviso" ? "O aviso para marcar" : "O lembrete para marcar";
    for (const id of pedidos) {
      await d
        .historico(id, canais.length ? `${o} ${g.falta === "dia" ? "o dia" : "a hora"} saiu a ${g.t.parceiro} (${canais.join(" e ")}).` : `${o} ${g.falta === "dia" ? "o dia" : "a hora"} NÃO saiu a ${g.t.parceiro}: sem os avisos do WhatsApp ligados nem a app.`)
        .catch(() => {});
    }
    linhas.push(`${g.tipo} ${pedidos.map((p) => `#${p}`).join(",")} (${canais.join("+") || "sem canal"})`);
  }
  return { linhas };
}
