/**
 * OS TRABALHOS DO PROFISSIONAL, COMO A APP OS LÊ.
 *
 * O tipo é a resposta de `GET /api/profissionais/meus-pedidos` (o mesmo que o
 * painel no navegador recebe). As regras que decidem o que se pode fazer — de
 * quem é a vez, quantas propostas restam, quanto ele recebe — NÃO estão
 * copiadas: vêm dos ficheiros do site (`src/lib/negociacao.ts`,
 * `taxas-plataforma.ts`, `service-categories.ts`), que não dependem de nada.
 * Uma regra que mude no site muda na app no build seguinte.
 *
 * Este ficheiro é puro (sem React Native): os testes do site importam-no —
 * ver `src/lib/app-pro.test.ts` na raiz do repositório.
 */
import {
  accoesDisponiveis,
  MAX_PROPOSTAS_POR_LADO,
  propostasRestantes,
  type Accao,
  type EstadoDaNegociacao,
  type Proposta,
} from "../../../src/lib/negociacao";
import { quantoOProfissionalRecebe, type Taxas } from "../../../src/lib/taxas-plataforma";
import { SERVICE_CATEGORIES } from "../../../src/lib/service-categories";
import { especieDoAnexo } from "../../../src/lib/tipo-ficheiro";
import { diaEmLisboa, horaEmLisboa, somarDiasAoDia } from "../../../src/lib/hora-de-lisboa";
import { IDENTIFICACAO } from "../../../src/lib/identificacao-legal";
import { linkDeWhatsApp } from "../../../src/lib/link-de-whatsapp";
// Só a forma: as regras do ajuste correm no site, que manda a vista já decidida.
import type { Ajuste, VistaDoAjuste } from "../../../src/lib/ajuste-no-local";

export { MAX_PROPOSTAS_POR_LADO, quantoOProfissionalRecebe };
export type { Accao, Ajuste, Proposta, Taxas, VistaDoAjuste };

export type Fase = "a_negociar" | "a_executar" | "a_confirmar" | "confirmado" | "pago";

export type Sugestao = {
  horas: number;
  pessoas: number;
  custoMinimo: number;
  precoSugerido: number;
  recebeSePropuser: number;
  lucroEstimado: number;
  porCarga: boolean;
  porHora?: boolean;
};

export type Trabalho = {
  negociacaoId: number;
  pedidoId: number;
  estado: EstadoDaNegociacao;
  fase: Fase;
  /** Texto JSON de `Proposta[]`. */
  propostas: string | null;
  valorAcordado: number | null;
  querPagar: number | null;
  recebeSeAceitar: number | null;
  recebeSeFechado: number | null;
  valorDaClyon: number | null;
  sugestao: Sugestao | null;
  taxas: Taxas;
  formaDePagamento: "na_plataforma" | "dinheiro" | "pos_recolha";
  ofertaClyon: "distribuida" | "directa" | null;
  valorFixo: number | null;
  concorrentes: number;
  pedidoCancelado: boolean;
  serviceType: string | null;
  city: string | null;
  description: string | null;
  /** Texto JSON de `[{url, name?}]`. */
  filesJson: string | null;
  urgency: string | null;
  dataAgendada: string | null;
  dataCombinada: string | null;
  /** Quando o pedido foi feito pelo cliente. */
  criadoEm: string | null;
  /** Quando o trabalho lhe chegou (a negociação nasceu) — a «ordem de chegada». */
  criadaEm: string | null;
  floor: string | null;
  hasElevator: string | null;
  parkingDistance: string | null;
  localidadeDestino: string | null;
  andarDestino: string | null;
  percursoKm: number | null;
  entulhoEstado: string | null;
  entulhoQuantidade: string | null;
  baseDoPreco: "total" | "carga" | "hora" | null;
  distanciaKm: number | null;
  minutosDeCarro: number | null;
  distanciaMedidaPor: "estrada" | "estimativa" | null;
  precisaFatura: boolean;
  precisaGuiaTransporte: boolean;
  /** Só quando o trabalho é dele (`acordada`). */
  morada: string | null;
  moradaDestino: string | null;
  contactoNome: string | null;
  contactoTelefone: string | null;
  abertoEm: string | null;
  arquivadoEm: string | null;
  actualizadoEm: string;
  confirmadoEm: string | null;
  pagoEm: string | null;
  // ── O trabalho no terreno (fase 3) — só quando o trabalho é dele ──
  aCaminhoEm: string | null;
  chegouEm: string | null;
  /** O ajuste no local, já decidido no site: o pendente, o último, o que resta. */
  ajuste: VistaDoAjuste | null;
  /** Quando deu o trabalho por feito. */
  execucaoEnviadaEm: string | null;
  /** Texto JSON de `{fotos, nota, em}` — a prova do trabalho feito. */
  provaJson: string | null;
  /** Dias até ficar confirmado sozinho, depois da prova. */
  diasAteLibertar: number | null;
};

export type MeusPedidos = { nome: string; pedidos: Trabalho[] };

// ── Textos ──────────────────────────────────────────────────────────────────
// Iguais aos do painel (`src/app/profissionais/painel/tipos.ts`). O teste do
// site compara-os, para não divergirem.

export const URGENCIA: Record<string, string> = {
  today: "Hoje",
  tomorrow: "Amanhã",
  this_week: "Esta semana",
  next_week: "Próxima semana",
  flexible: "Sem pressa",
  flexivel: "Sem pressa",
};

export const ELEVADOR: Record<string, string> = {
  yes: "Com elevador",
  small: "Elevador pequeno",
  no: "Sem elevador",
  sim: "Com elevador",
  unknown: "Não sabemos",
};

export const ESTACIONAMENTO: Record<string, string> = {
  door: "Encosta-se à porta",
  under_20m: "Até 20 m da porta",
  over_30m: "Mais de 30 m da porta",
  difficult: "Estacionamento difícil",
  easy: "Sem dificuldade",
  porta: "Encosta-se à porta",
  near: "Estaciona perto da porta",
  far: "Estaciona longe da porta",
  unknown: "Não sabemos",
};

export const ESTADO_DO_ENTULHO: Record<string, string> = {
  ensacado: "já ensacado",
  chao: "no chão, por ensacar",
  misto: "misto",
  bigbags: "em big bags",
};

/** Traduz, e cala-se quando não há nada útil a dizer (como `emPortugues` do painel). */
export function emPortugues(dicionario: Record<string, string>, valor: string | null | undefined) {
  if (!valor) return null;
  const limpo = valor.trim();
  if (!limpo || limpo === "unknown") return null;
  return dicionario[limpo] ?? limpo;
}

export function servicoDe(t: Pick<Trabalho, "serviceType">): string {
  return SERVICE_CATEGORIES.find((c) => c.id === t.serviceType)?.label ?? t.serviceType ?? "Serviço";
}

export function euros(v: number): string {
  return `${v.toFixed(2).replace(".", ",")} €`;
}

// ── Leitura dos campos em JSON ──────────────────────────────────────────────

export function propostasDe(json: string | null): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

export function fotosDe(json: string | null): Array<{ url: string; name?: string }> {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? l.filter((f) => f && typeof f.url === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Só imagens — o pedido pode trazer também vídeo ou PDF. A regra é a do painel
 * (`especieDoAnexo`), pelo nome do ficheiro quando o há: o endereço guardado
 * muitas vezes não tem extensão.
 */
export function imagensDe(json: string | null): string[] {
  return fotosDe(json)
    .filter((f) => especieDoAnexo(f.name || f.url) === "imagem")
    .map((f) => f.url);
}

// ── Separadores (as mesmas regras do `separadorDe` do painel) ───────────────

export type Separador = "novos" | "negociacao" | "contratados" | "terminados" | "recusados" | "arquivados";

export const SEPARADORES: Array<{ id: Separador; rotulo: string; vazio: string }> = [
  {
    id: "novos",
    rotulo: "Novos",
    vazio: "Nenhum pedido novo. Assim que entrar um na sua zona e nos serviços que faz, aparece aqui — e avisamos no telemóvel.",
  },
  { id: "negociacao", rotulo: "Negociação", vazio: "Não há nenhuma negociação a decorrer." },
  { id: "contratados", rotulo: "Contratados", vazio: "Nenhum trabalho seu por fazer neste momento." },
  {
    id: "terminados",
    rotulo: "Terminados",
    vazio: "Ainda não terminou nenhum trabalho. Assim que o cliente confirmar, aparece aqui.",
  },
  { id: "recusados", rotulo: "Recusados", vazio: "Nada recusado nem perdido. É bom sinal." },
  { id: "arquivados", rotulo: "Arquivados", vazio: "Nada arquivado." },
];

export function separadorDe(t: Trabalho): Separador {
  if (t.arquivadoEm) return "arquivados";
  if (t.estado === "acordada") return t.confirmadoEm || t.pagoEm ? "terminados" : "contratados";
  if (t.estado === "desistida" || t.estado === "morta") return "recusados";
  const jaRespondeu = propostasDe(t.propostas).some((p) => p.por === "profissional");
  return jaRespondeu || t.estado === "aguarda_contratacao" ? "negociacao" : "novos";
}

/** Os pedidos novos que ele ainda não abriu — o número do separador e da aba. */
export function novosPorAbrir(lista: Trabalho[]): number {
  return lista.filter((t) => separadorDe(t) === "novos" && !t.abertoEm).length;
}

/**
 * Por ordem de chegada: o último a chegar em cima, o mais antigo em baixo.
 * «Chegar» é quando o trabalho lhe foi enviado; sem essa data, o pedido.
 */
export function porOrdemDeChegada(lista: Trabalho[]): Trabalho[] {
  const quando = (t: Trabalho) => {
    const ms = new Date(t.criadaEm ?? t.criadoEm ?? t.actualizadoEm).getTime();
    return Number.isFinite(ms) ? ms : 0;
  };
  return [...lista].sort((a, b) => quando(b) - quando(a) || b.negociacaoId - a.negociacaoId);
}

export function contarPorSeparador(lista: Trabalho[]): Record<Separador, number> {
  const contas = { novos: 0, negociacao: 0, contratados: 0, terminados: 0, recusados: 0, arquivados: 0 };
  for (const t of lista) contas[separadorDe(t)]++;
  return contas;
}

// ── De quem é a vez, e o que ele pode fazer ─────────────────────────────────

/** A última proposta pendente decide — como o `deQuemEAVez` do painel. */
export function deQuemEAVez(t: Pick<Trabalho, "propostas">): "sua" | "cliente" | null {
  const pendente = [...propostasDe(t.propostas)].reverse().find((p) => p?.estado === "pendente");
  if (!pendente) return null;
  return pendente.por === "profissional" ? "cliente" : "sua";
}

export function propostaPendente(t: Pick<Trabalho, "propostas">): Proposta | null {
  return [...propostasDe(t.propostas)].reverse().find((p) => p.estado === "pendente") ?? null;
}

export type Escolhas = {
  /** Trabalho CLYON de valor fixo: só aceitar ou recusar. */
  valorFixo: boolean;
  /** Ele ainda não disse nada: mostra-se a sugestão CLYON e pede-se a proposta dele. */
  primeiraProposta: boolean;
  podeAceitar: boolean;
  podePropor: boolean;
  podeDesistir: boolean;
  propostasPorUsar: number;
  /** O valor bruto (sem IVA) que está em cima da mesa para ele aceitar. */
  valorParaAceitar: number | null;
  /** Para propor: a sugestão CLYON enquanto ele ainda não disse nada. */
  referenciaParaPropor: number | null;
};

export function escolhasDe(t: Trabalho, agora: Date = new Date()): Escolhas {
  const n = { estado: t.estado, propostas: propostasDe(t.propostas), valorAcordado: t.valorAcordado };
  const accoes = accoesDisponiveis(n, "profissional", agora);
  const pendente = propostaPendente(t);
  const valorFixo = t.ofertaClyon != null;
  const jaRespondeu = n.propostas.some((p) => p.por === "profissional");
  /*
   * A abertura do cliente é uma sugestão, e não um valor para aceitar: com a
   * mesa ainda sem resposta dele, o painel pede-lhe a proposta. Num Trabalho
   * CLYON é ao contrário — o valor é fixo e só se aceita ou recusa.
   */
  const aberturaDoCliente = !valorFixo && !jaRespondeu;
  const podeAceitar = accoes.includes("aceitar") && !aberturaDoCliente && pendente?.por === "cliente";
  return {
    valorFixo,
    primeiraProposta: aberturaDoCliente,
    podeAceitar: valorFixo ? accoes.includes("aceitar") : podeAceitar,
    podePropor: !valorFixo && accoes.includes("propor"),
    podeDesistir: accoes.includes("desistir"),
    propostasPorUsar: propostasRestantes(n, "profissional", agora),
    valorParaAceitar: pendente?.por === "cliente" ? pendente.valor : null,
    referenciaParaPropor: aberturaDoCliente
      ? (t.sugestao?.precoSugerido ?? pendente?.valor ?? null)
      : (pendente?.valor ?? null),
  };
}

// ── O número grande do cartão ───────────────────────────────────────────────

export type ValorDoCartao = { valor: number; legenda: string } | null;

/** O que ele recebe, já com a taxa e sem IVA — a mesma escolha do cartão do painel. */
export function valorDoCartao(t: Trabalho): ValorDoCartao {
  if (t.estado === "acordada" && t.recebeSeFechado != null) {
    return { valor: t.recebeSeFechado, legenda: "recebe, sem IVA" };
  }
  if (separadorDe(t) === "novos") {
    if (t.valorDaClyon != null) {
      return { valor: t.valorDaClyon, legenda: t.ofertaClyon ? "valor fixo · CLYON" : "valor CLYON" };
    }
    if (t.sugestao) return { valor: t.sugestao.recebeSePropuser, legenda: "sugestão CLYON" };
    return null;
  }
  if (t.recebeSeAceitar != null) return { valor: t.recebeSeAceitar, legenda: "recebe se aceitar" };
  return null;
}

export function etiquetaDoEstado(t: Trabalho): string | null {
  if (t.estado === "aguarda_contratacao") return "à espera do cliente";
  if (t.estado === "acordada") {
    return { a_executar: "por fazer", a_confirmar: "à espera da confirmação", confirmado: "confirmado", pago: "pago", a_negociar: null }[t.fase];
  }
  if (t.estado === "aberta") {
    const vez = deQuemEAVez(t);
    return vez === "sua" ? "à espera da sua resposta" : vez === "cliente" ? "à espera do cliente" : null;
  }
  return null;
}

/**
 * O estado em poucas letras, para o cartão da lista (o detalhe diz por extenso).
 * O tom diz se é a vez dele (aviso) ou se só está à espera (neutro).
 */
export function estadoCurto(t: Trabalho): { texto: string; tom: "aviso" | "neutro" | "bom" } | null {
  if (t.estado === "aguarda_contratacao") return { texto: "Com o cliente", tom: "neutro" };
  if (t.estado === "acordada") {
    const fase = {
      a_executar: { texto: "Por fazer", tom: "aviso" as const },
      a_confirmar: { texto: "Por confirmar", tom: "neutro" as const },
      confirmado: { texto: "Confirmado", tom: "bom" as const },
      pago: { texto: "Pago", tom: "bom" as const },
      a_negociar: null,
    }[t.fase];
    return fase;
  }
  if (t.estado === "aberta") {
    const vez = deQuemEAVez(t);
    if (vez === "sua") return { texto: "Responder", tom: "aviso" };
    if (vez === "cliente") return { texto: "Com o cliente", tom: "neutro" };
  }
  return null;
}

// ── Tempo, dito como quem fala ──────────────────────────────────────────────

/** O dia numa linha curta: «qua 28/10 · 09:00», ou a urgência («Amanhã»). */
export function quandoCurto(t: Pick<Trabalho, "dataCombinada" | "dataAgendada" | "urgency">): string | null {
  const data = t.dataCombinada ?? t.dataAgendada;
  if (data) {
    const d = new Date(data);
    if (Number.isFinite(d.getTime())) {
      const fuso = { timeZone: "Europe/Lisbon" } as const;
      const semana = d.toLocaleDateString("pt-PT", { ...fuso, weekday: "short" }).replace(".", "").slice(0, 3);
      const dia = d.toLocaleDateString("pt-PT", { ...fuso, day: "2-digit", month: "2-digit" });
      const temHora = /T\d{2}:\d{2}/.test(data) && !/T00:00(:00)?(\.000)?Z?$/.test(data);
      const hora = temHora ? d.toLocaleTimeString("pt-PT", { ...fuso, hour: "2-digit", minute: "2-digit" }) : null;
      return hora ? `${semana} ${dia} · ${hora}` : `${semana} ${dia}`;
    }
  }
  return emPortugues(URGENCIA, t.urgency);
}

/** «há 5 min», «há 3 h», «há 2 dias». */
export function haQuanto(iso: string | null, agora: Date = new Date()): string | null {
  if (!iso) return null;
  const ms = agora.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

/** O dia do trabalho: o combinado, o pedido, ou a urgência que o cliente escolheu. */
export function quandoE(t: Pick<Trabalho, "dataCombinada" | "dataAgendada" | "urgency">): string | null {
  const data = t.dataCombinada ?? t.dataAgendada;
  if (data) {
    const d = new Date(data);
    if (Number.isFinite(d.getTime())) {
      const dia = d.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon", weekday: "short", day: "numeric", month: "short" });
      // Uma data sem hora vem à meia-noite UTC; só se mostra a hora quando a houver.
      const temHora = /T\d{2}:\d{2}/.test(data) && !/T00:00(:00)?(\.000)?Z?$/.test(data);
      const hora = temHora
        ? d.toLocaleTimeString("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit" })
        : null;
      return hora ? `${dia}, às ${hora}` : dia;
    }
  }
  return emPortugues(URGENCIA, t.urgency);
}

export function distanciaDe(t: Pick<Trabalho, "distanciaKm" | "distanciaMedidaPor">): string | null {
  if (t.distanciaKm == null || !Number.isFinite(t.distanciaKm)) return null;
  const km = t.distanciaKm < 10 ? t.distanciaKm.toFixed(1).replace(".", ",") : String(Math.round(t.distanciaKm));
  return t.distanciaMedidaPor === "estrada" ? `${km} km` : `cerca de ${km} km`;
}

/** «0» e «rc» são o rés-do-chão; o resto passa como veio («4», «2.º Esq.»). */
export function andarPorExtenso(andar: string | null | undefined): string | null {
  const limpo = (andar ?? "").trim();
  if (!limpo) return null;
  return /^(0|rc|r\/c|r\.c\.?|rés-do-chão)$/i.test(limpo) ? "Rés-do-chão" : limpo;
}

/** Lê «120,50» ou «120.5» como número, ou null. */
export function lerValor(texto: string): number | null {
  const limpo = texto.replace(/\s|€/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  const v = Number(limpo);
  return v > 0 ? v : null;
}

// ── O trabalho contratado: o dia, o terreno, o ajuste e a prova (fase 3) ─────

/** «08:52» — a hora em Lisboa de um instante, ou null. */
export function horaCurta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? horaEmLisboa(d) : null;
}

/**
 * Os dias que ele pode escolher para marcar: hoje e os seguintes, em Lisboa.
 * O site lê «AAAA-MM-DDTHH:MM» como hora de Lisboa — a app não faz contas de fusos.
 */
export function diasParaMarcar(agora: Date = new Date(), quantos = 21): Array<{ dia: string; rotulo: string }> {
  const hoje = diaEmLisboa(agora);
  return Array.from({ length: quantos }, (_, i) => {
    const dia = somarDiasAoDia(hoje, i);
    if (i === 0) return { dia, rotulo: "Hoje" };
    if (i === 1) return { dia, rotulo: "Amanhã" };
    const semana = new Date(`${dia}T12:00:00Z`)
      .toLocaleDateString("pt-PT", { timeZone: "UTC", weekday: "short" })
      .replace(".", "")
      .slice(0, 3);
    return { dia, rotulo: `${semana} ${dia.slice(8, 10)}/${dia.slice(5, 7)}` };
  });
}

/** As horas para marcar, de meia em meia hora, das 07:00 às 21:30. */
export const HORAS_PARA_MARCAR: string[] = Array.from({ length: 30 }, (_, i) => {
  const h = 7 + Math.floor(i / 2);
  return `${String(h).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
});

/** Onde o seletor começa: o dia já combinado, ou amanhã às 09:00. */
export function marcacaoInicial(dataCombinada: string | null, agora: Date = new Date()): { dia: string; hora: string } {
  const d = dataCombinada ? new Date(dataCombinada) : null;
  if (d && Number.isFinite(d.getTime())) {
    const hora = horaEmLisboa(d);
    return { dia: diaEmLisboa(d), hora: HORAS_PARA_MARCAR.includes(hora) ? hora : "09:00" };
  }
  return { dia: somarDiasAoDia(diaEmLisboa(agora), 1), hora: "09:00" };
}

/** A prova do trabalho feito, como o site a guardou. */
export function provaDe(json: string | null): { fotos: string[]; nota: string } | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json) as { fotos?: unknown; nota?: unknown };
    const fotos = Array.isArray(p.fotos) ? p.fotos.filter((u): u is string => typeof u === "string") : [];
    return { fotos, nota: typeof p.nota === "string" ? p.nota : "" };
  } catch {
    return null;
  }
}

/**
 * Em que pé está o ajuste, para o ecrã:
 *   · «pendente» — à espera do cliente (ou da CLYON);
 *   · «sem_resposta» — o último foi recusado ou expirou: mostram-se as três saídas;
 *   · «livre» — pode pedir; «fechado» — já não pode (e `porqueNao` diz porquê).
 */
export function situacaoDoAjuste(t: Pick<Trabalho, "estado" | "fase" | "ajuste">): "pendente" | "sem_resposta" | "livre" | "fechado" | null {
  if (t.estado !== "acordada" || t.fase !== "a_executar" || !t.ajuste) return null;
  if (t.ajuste.pendente) return "pendente";
  const ultimo = t.ajuste.ultimo?.estado;
  if (ultimo === "recusado" || ultimo === "expirado") return "sem_resposta";
  return t.ajuste.porqueNao ? "fechado" : "livre";
}

/** Quem responde ao ajuste: o cliente, ou a CLYON num trabalho dela. */
export function quemResponde(t: Pick<Trabalho, "ofertaClyon">): "o cliente" | "a CLYON" {
  return t.ofertaClyon ? "a CLYON" : "o cliente";
}

/** A conversa com o apoio da CLYON, com o número do pedido já escrito. */
export function whatsAppDaClyon(texto: string): string | null {
  return linkDeWhatsApp(IDENTIFICACAO.telefone, texto);
}
