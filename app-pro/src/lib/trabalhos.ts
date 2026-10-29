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
import { especieDoAnexo, type EspecieDoAnexo } from "../../../src/lib/tipo-ficheiro";
import { sugestaoComOutroTempo } from "../../../src/lib/sugestao-ajustada";
import type { SugestaoParaOProfissional } from "../../../src/lib/sugestao-tipo";
import { diaEmLisboa, horaEmLisboa, instanteDaBase, pecasEmLisboa, somarDiasAoDia } from "../../../src/lib/hora-de-lisboa";
import { IDENTIFICACAO } from "../../../src/lib/identificacao-legal";
import { linkDeWhatsApp } from "../../../src/lib/link-de-whatsapp";
import { pesoDoTrabalho, porQuilometro, type TrabalhoParaAvaliar } from "../../../src/lib/sinais-do-trabalho";
import { DURACAO_PADRAO_MIN, JANELA_PADRAO } from "../../../src/lib/agenda-em-grelha";
// Só a forma: as regras do ajuste correm no site, que manda a vista já decidida.
import type { Ajuste, VistaDoAjuste } from "../../../src/lib/ajuste-no-local";
import {
  DIAS_ATE_LIBERTAR_SOZINHO,
  FOTOGRAFIAS_SAO_OPCIONAIS,
  OBRIGADO_DEPOIS_DE_FEITO,
  QUEM_CONFIRMA_O_TRABALHO,
  quemConfirmaOTrabalho,
} from "../../../src/lib/trabalho";
import { legendaDosConfirmados } from "../../../src/lib/fim-do-trabalho";
import { diaEMes } from "../../../src/lib/historico-negociacao";

export { FOTOGRAFIAS_SAO_OPCIONAIS, MAX_PROPOSTAS_POR_LADO, QUEM_CONFIRMA_O_TRABALHO, quantoOProfissionalRecebe };
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
  /** A conta foi feita com os custos que ele indicou (e não com a referência da CLYON). */
  comOsSeusCustos?: boolean;
  /** Sem distância medida: a conta não sabe quanto anda. */
  semDistancia?: boolean;
  // As parcelas da conta (versão 12): com elas a app muda as horas e as
  // pessoas como o painel (`sugestaoComOutroTempo`). O site manda-as sempre;
  // ficam opcionais para a conta só se refazer quando vêm todas.
  custoHoraPessoa?: number;
  custoKm?: number;
  kmDeCarro?: number | null;
  custoCombustivel?: number;
  custoPessoal?: number;
  custosFixos?: number;
  seguroDeRisco?: number;
  riscoPercent?: number;
  margem?: number;
  taxas?: Taxas;
  pressupostos?: string[];
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
  // ── A29-10 (A13): o que o painel já mostrava e a app não lia ──
  /** A segunda ponta de uma mudança: o elevador e o estacionamento no destino. */
  elevadorDestino?: string | null;
  estacionamentoDestino?: string | null;
  /** O que o cliente disse do entulho, por palavras dele. */
  entulhoQuantidadeDita?: string | null;
  /** «Cliente desde … · N trabalhos confirmados» — só num trabalho que é dele, e só quando é real. */
  clienteContexto?: { desde: string | null; confirmados: number } | null;
  precisaFatura: boolean;
  precisaGuiaTransporte: boolean;
  /**
   * O cliente já pagou à CLYON? `null` = a pergunta não se põe (trabalho
   * CLYON, pago em mão, ou de antes de a plataforma cobrar) — não se mostra nada.
   */
  clientePagou: boolean | null;
  /** O que uma carga vale na carrinha dele, num pedido por carga (`carga-da-carrinha.ts`). */
  cargaNaSuaCarrinha: { titulo: string; texto: string; curto: string } | null;
  /** Para o histórico da negociação: quando o cliente avaliou, e com quantas estrelas. */
  avaliadoEm: string | null;
  estrelas: number | null;
  /** Só quando o trabalho é dele (`acordada`). */
  morada: string | null;
  moradaDestino: string | null;
  contactoNome: string | null;
  contactoTelefone: string | null;
  abertoEm: string | null;
  arquivadoEm: string | null;
  actualizadoEm: string;
  confirmadoEm: string | null;
  /**
   * Quem confirmou — «cliente», «clyon» ou «prazo» (28-10-2026, d4). Os de
   * antes não o têm, e o ecrã diz só «Confirmado» (`tituloDoConfirmado`).
   */
  confirmadoPor: string | null;
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
  /**
   * Dias até ficar confirmado sozinho, depois da prova. `null` em «à espera da
   * confirmação» quer dizer que não há prazo: deu-o por feito sem fotografias,
   * e é a CLYON que confirma com o cliente (26-10-2026).
   */
  diasAteLibertar: number | null;
  /** Quanto tempo leva, em minutos — null são as duas horas do costume. */
  duracaoMinutos: number | null;
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

/**
 * Os vídeos e os PDF do cliente — versão 12. A app mostra as fotografias
 * em grande; o resto abre-se no telemóvel (o leitor de vídeo, o de PDF), como
 * o painel faz com o `Anexo`. Sem isto, um vídeo do que há para levar ficava
 * invisível na app.
 */
export function outrosAnexosDe(json: string | null): Array<{ url: string; especie: Exclude<EspecieDoAnexo, "imagem">; nome: string }> {
  const saida: Array<{ url: string; especie: Exclude<EspecieDoAnexo, "imagem">; nome: string }> = [];
  let videos = 0;
  let pdfs = 0;
  for (const f of fotosDe(json)) {
    const especie = especieDoAnexo(f.name || f.url);
    if (especie === "imagem") continue;
    const n = especie === "video" ? ++videos : ++pdfs;
    saida.push({ url: f.url, especie, nome: especie === "video" ? `Vídeo ${n}` : `PDF ${n}` });
  }
  return saida;
}

/**
 * A sugestão com outro tempo e outra equipa — a conta do painel
 * (`sugestao-ajustada.ts`), refeita no telemóvel sem ir ao site. Só quando a
 * sugestão traz todas as parcelas; senão, `null` e o ecrã não mostra os campos.
 */
export function sugestaoComOutraEquipa(s: Sugestao, horas: number, pessoas: number): Sugestao | null {
  if (
    s.custoHoraPessoa == null || s.custoCombustivel == null || s.custosFixos == null ||
    s.riscoPercent == null || s.margem == null || !Array.isArray(s.pressupostos)
  ) {
    return null;
  }
  return sugestaoComOutroTempo(s as SugestaoParaOProfissional, { horas, pessoas });
}

/** A última lista lida do site, guardada no telemóvel (`lista-guardada.ts`, versão 13). */
export type ListaGuardada = { trabalhos: Trabalho[]; lidaEm: string };

/** Só aceita a forma que se escreveu: um ficheiro estragado conta como nenhum. */
export function listaValida(v: unknown): ListaGuardada | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { trabalhos?: unknown; lidaEm?: unknown };
  if (!Array.isArray(o.trabalhos) || typeof o.lidaEm !== "string" || Number.isNaN(Date.parse(o.lidaEm))) return null;
  return { trabalhos: o.trabalhos as Trabalho[], lidaEm: o.lidaEm };
}

// ── Arquivar e repor (as regras do `arrumar.ts` do painel) ─────────────────
//
// Arquivar não apaga nada: muda o trabalho para «Arquivados», e «Repor» volta
// a pô-lo no separador de onde veio. Um pedido ainda aberto DESISTE PRIMEIRO —
// senão o cliente ficava à espera de quem já o arrumou. Os textos são os do
// painel, palavra a palavra (o teste compara-os).

/** Um pedido onde o cliente ainda espera resposta dele. */
export function negociacaoAberta(t: Pick<Trabalho, "estado">): boolean {
  return t.estado === "aberta" || t.estado === "aguarda_contratacao";
}

/** A pergunta antes de arquivar — só quando arquivar faz mais do que arrumar. */
export function perguntaAntesDeArquivar(t: Pick<Trabalho, "estado" | "confirmadoEm" | "pagoEm">): string | null {
  if (negociacaoAberta(t)) {
    return "Arquivar este pedido diz ao cliente que não está interessado e tira-o da sua vista. Continuar?";
  }
  if (t.estado === "acordada" && !t.confirmadoEm && !t.pagoEm) {
    return "Este trabalho está contratado. Arquivar só o tira da sua vista e da agenda — continua combinado com o cliente. Continuar?";
  }
  return null;
}

/** O que se diz por baixo do botão. */
export function explicacaoDoArquivar(t: Pick<Trabalho, "estado" | "arquivadoEm">): { titulo: string; texto: string } {
  if (t.arquivadoEm) {
    return { titulo: "Este pedido está arquivado", texto: "Repor volta a mostrá-lo no separador de onde veio." };
  }
  return {
    titulo: "Não é para si?",
    texto: negociacaoAberta(t)
      ? "Arquivar diz ao cliente que não tem interesse e tira o pedido da sua lista. Fica em «Arquivados», e não desaparece."
      : "Arquivar tira o pedido da sua lista. Fica em «Arquivados», e não desaparece.",
  };
}

// ── Separadores (as mesmas regras do `separadorDe` do painel) ───────────────

export type Separador = "novos" | "negociacao" | "contratados" | "terminados" | "recusados" | "arquivados";

/**
 * Os nomes são os do painel (`SEPARADORES` em `Trabalhos.tsx`) — 29-10-2026,
 * A14 da especificação v3: «Feed» e «Em negociação», e os Arquivados sempre
 * à vista, como lá. O teste do site compara as duas listas.
 */
export const SEPARADORES: Array<{ id: Separador; rotulo: string; vazio: string }> = [
  {
    id: "novos",
    rotulo: "Feed",
    vazio: "Nenhum pedido novo. Assim que entrar um dentro do seu raio e nos serviços que faz, aparece aqui — e avisamos no telemóvel.",
  },
  { id: "negociacao", rotulo: "Em negociação", vazio: "Não há nenhuma negociação a decorrer." },
  { id: "contratados", rotulo: "Contratados", vazio: "Nenhum trabalho seu por fazer neste momento." },
  {
    id: "terminados",
    rotulo: "Terminados",
    vazio: "Ainda não terminou nenhum trabalho. Assim que o cliente confirmar, aparece aqui.",
  },
  { id: "recusados", rotulo: "Recusados", vazio: "Nada recusado nem perdido. É bom sinal." },
  {
    id: "arquivados",
    rotulo: "Arquivados",
    vazio: "Nada arquivado. Use o botão de arquivar para arrumar o que já não precisa de ver.",
  },
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

/**
 * Os cartões com «Novo» e a borda a brilhar: os CINCO mais recentes por abrir
 * dos Novos — a regra do painel (`Trabalhos.tsx`, `porAbrir`). Vinte cartões
 * marcados não destacam nada; cinco é o que se vê de uma vez sem contar.
 */
export function cincoPorAbrir(lista: Trabalho[]): Set<number> {
  return new Set(
    lista
      .filter((t) => separadorDe(t) === "novos" && !t.abertoEm)
      .sort((a, b) => Date.parse(b.actualizadoEm) - Date.parse(a.actualizadoEm))
      .slice(0, 5)
      .map((t) => t.negociacaoId),
  );
}

export function contarPorSeparador(lista: Trabalho[]): Record<Separador, number> {
  const contas = { novos: 0, negociacao: 0, contratados: 0, terminados: 0, recusados: 0, arquivados: 0 };
  for (const t of lista) contas[separadorDe(t)]++;
  return contas;
}

// ── A lista como o painel a mostra (A14, 29-10-2026) ────────────────────────

/** O instante de `actualizadoEm`, ou 0 se não se ler. */
function actualizado(t: Pick<Trabalho, "actualizadoEm">): number {
  const ms = Date.parse(t.actualizadoEm);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * «RECENTES» É A REGRA DO PAINEL: o que mexeu há menos tempo em cima
 * (`maisRecentePrimeiro`, por `actualizadoEm`). Era a ordem de chegada
 * (`criadaEm`), e a mesma conta via a lista por outra ordem no telemóvel e
 * no navegador — B2, linha 17.
 */
export function maisRecentePrimeiro(lista: Trabalho[]): Trabalho[] {
  return [...lista].sort((a, b) => actualizado(b) - actualizado(a) || b.negociacaoId - a.negociacaoId);
}

/**
 * Nos separadores sem escolha de ordem, o painel mostra a lista como a rota a
 * manda: pelo estado (aberta, à espera, acordada, desistida, morta) e, dentro
 * de cada um, pelo `updatedAt` mais recente (`negociacoesDoProfissional`).
 */
const ORDEM_DO_ESTADO = ["aberta", "aguarda_contratacao", "acordada", "desistida", "morta"];
export function naOrdemDaRota(lista: Trabalho[]): Trabalho[] {
  const posicao = (t: Trabalho) => {
    const i = ORDEM_DO_ESTADO.indexOf(t.estado);
    return i < 0 ? ORDEM_DO_ESTADO.length : i;
  };
  return [...lista].sort((a, b) => posicao(a) - posicao(b) || actualizado(b) - actualizado(a) || b.negociacaoId - a.negociacaoId);
}

/**
 * Em que grupo da lista cai o cartão — a `chaveDoGrupo` do painel: a fase,
 * num trabalho que é dele; o porquê, num perdido.
 */
export function chaveDoGrupo(t: Pick<Trabalho, "estado" | "fase" | "pedidoCancelado">): string {
  if (t.estado === "acordada") return t.fase;
  if (t.estado === "desistida") return "desistida";
  if (t.estado === "morta") return t.pedidoCancelado ? "cancelado" : "outro";
  return t.estado;
}

export type TomDoGrupo = "aviso" | "violeta" | "bom" | "azul" | "rosa" | "laranja" | "neutro";
export type GrupoDaLista = { chave: string; titulo: string; legenda: string; tom: TomDoGrupo };

/**
 * OS GRUPOS DE CADA SEPARADOR, pela ordem e com os títulos e legendas do
 * painel (`GRUPOS` em `Trabalhos.tsx`, 08-10-2026). A legenda dos Confirmados
 * diz, caso a caso, onde está o dinheiro (`legendaDosGrupos`).
 */
export const GRUPOS: Partial<Record<Separador, GrupoDaLista[]>> = {
  contratados: [
    { chave: "a_executar", titulo: "Por fazer", legenda: "contratados, ainda por fazer", tom: "aviso" },
    { chave: "a_confirmar", titulo: "À espera da confirmação", legenda: "já os deu por feitos — falta a confirmação", tom: "violeta" },
  ],
  terminados: [
    { chave: "confirmado", titulo: "Confirmados", legenda: "abra cada um para ver onde está o valor", tom: "bom" },
    { chave: "pago", titulo: "Pagos", legenda: "já transferidos para si", tom: "azul" },
  ],
  recusados: [
    { chave: "outro", titulo: "Ficou com outro", legenda: "o trabalho foi para outro profissional", tom: "rosa" },
    { chave: "desistida", titulo: "Desistências", legenda: "um dos lados desistiu", tom: "laranja" },
    { chave: "cancelado", titulo: "Cancelados", legenda: "o pedido foi cancelado ou arquivado", tom: "neutro" },
  ],
};

/**
 * O PORQUÊ, NO CARTÃO DOS RECUSADOS — o `RECUSA` do painel (B2, linha 19):
 * «ficou com outro», «desistência», «pedido cancelado».
 */
export const RECUSA: Record<string, { texto: string; tom: TomDoGrupo }> = {
  outro: { texto: "ficou com outro", tom: "rosa" },
  desistida: { texto: "desistência", tom: "laranja" },
  cancelado: { texto: "pedido cancelado", tom: "neutro" },
};

export type LinhaDaLista =
  | { tipo: "grupo"; grupo: GrupoDaLista; quantos: number; legenda: string }
  | { tipo: "trabalho"; trabalho: Trabalho };

/**
 * A lista de um separador, com o título de cada grupo antes do seu primeiro
 * cartão — a forma do painel. Os grupos vão pela ordem de `GRUPOS`; dentro de
 * cada um, a ordem que a lista já trazia (o `sort` é estável). Um separador
 * sem grupos é a lista tal como veio.
 */
export function linhasDaLista(lista: Trabalho[], separador: Separador): LinhaDaLista[] {
  const grupos = GRUPOS[separador];
  if (!grupos) return lista.map((trabalho) => ({ tipo: "trabalho", trabalho }));
  const ordem = (t: Trabalho) => {
    const i = grupos.findIndex((g) => g.chave === chaveDoGrupo(t));
    return i < 0 ? grupos.length : i;
  };
  const ordenada = [...lista].sort((a, b) => ordem(a) - ordem(b));
  const saida: LinhaDaLista[] = [];
  let anterior: string | null = null;
  for (const t of ordenada) {
    const chave = chaveDoGrupo(t);
    if (chave !== anterior) {
      const grupo = grupos.find((g) => g.chave === chave);
      if (grupo) {
        const doGrupo = ordenada.filter((x) => chaveDoGrupo(x) === chave);
        saida.push({
          tipo: "grupo",
          grupo,
          quantos: doGrupo.length,
          legenda: chave === "confirmado" ? legendaDosConfirmados(doGrupo) : grupo.legenda,
        });
      }
      anterior = chave;
    }
    saida.push({ tipo: "trabalho", trabalho: t });
  }
  return saida;
}

/**
 * HÁ QUANTO TEMPO, NO CARTÃO — a `haQuantoTempo` do painel, igual: minutos
 * para baixo, «há 1 dia», e nada para uma data que não se lê.
 */
export function haQuantoTempoNoCartao(iso: string, agora: Date = new Date()): string {
  const minutos = Math.floor((agora.getTime() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutos) || minutos < 0) return "";
  if (minutos < 60) return `há ${Math.max(1, minutos)} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

/**
 * O tempo à direita do cartão (B2, linha 26): num terminado, quando foi
 * concluído («concluído 28/10»: quando ele o marcou como feito, ou a
 * confirmação); nos outros, há quanto tempo mexeu.
 */
export function tempoDoCartao(
  t: Pick<Trabalho, "arquivadoEm" | "estado" | "confirmadoEm" | "pagoEm" | "execucaoEnviadaEm" | "actualizadoEm" | "propostas">,
  agora: Date = new Date(),
): string {
  const terminado = !t.arquivadoEm && t.estado === "acordada" && (t.confirmadoEm || t.pagoEm);
  if (terminado && (t.execucaoEnviadaEm || t.confirmadoEm)) {
    return `concluído ${diaEMes(t.execucaoEnviadaEm ?? t.confirmadoEm)}`;
  }
  return haQuantoTempoNoCartao(t.actualizadoEm, agora);
}

// ── As novidades dentro da app (A16, 29-10-2026) ─────────────────────────────

export type Novidade = { id: string; texto: string; negociacaoId: number };

/**
 * O QUE MUDOU DESDE A ÚLTIMA LEITURA — as novidades do painel
 * (`PainelDoProfissional.tsx`), com as mesmas frases: um pedido novo, «Foi
 * contratado», «confirmado — X € já estão disponíveis na carteira» e
 * «Transferência … processada». Só as mudanças que são notícia PARA ELE:
 * passar a «à espera da confirmação» foi ele a dar o trabalho por feito.
 *
 * `anterior` é a fase de cada negociação na leitura anterior; na primeira
 * leitura não há novidades — há passado, e o passado não é notícia.
 */
export function novidadesEntre(anterior: ReadonlyMap<number, string> | null, novos: Trabalho[]): Novidade[] {
  if (!anterior) return [];
  const saida: Novidade[] = [];
  for (const pd of novos) {
    const faseAntiga = anterior.get(pd.negociacaoId);
    if (faseAntiga === undefined) {
      saida.push({
        id: `novo-${pd.negociacaoId}`,
        texto: `Pedido novo dentro do seu raio — #${pd.pedidoId}. Abra para propor.`,
        negociacaoId: pd.negociacaoId,
      });
    } else if (faseAntiga !== pd.fase) {
      if (pd.fase === "a_executar") {
        saida.push({
          id: `contratado-${pd.negociacaoId}`,
          texto: `Foi contratado — pedido #${pd.pedidoId}. A morada e o contacto já estão abertos.`,
          negociacaoId: pd.negociacaoId,
        });
      } else if (pd.fase === "confirmado") {
        const liquido = pd.recebeSeFechado;
        saida.push({
          id: `confirmado-${pd.negociacaoId}`,
          texto:
            `Trabalho #${pd.pedidoId} confirmado` +
            (liquido != null
              ? ` — ${liquido.toFixed(2).replace(".", ",")} € já estão disponíveis na carteira.`
              : " — o valor já está disponível na carteira."),
          negociacaoId: pd.negociacaoId,
        });
      } else if (pd.fase === "pago") {
        saida.push({
          id: `pago-${pd.negociacaoId}`,
          texto: `Transferência do trabalho #${pd.pedidoId} processada.`,
          negociacaoId: pd.negociacaoId,
        });
      }
    }
  }
  return saida;
}

/** A fotografia de cada leitura, para a seguinte: a fase de cada negociação. */
export function fasesDe(lista: Trabalho[]): Map<number, string> {
  return new Map(lista.map((t) => [t.negociacaoId, t.fase]));
}

/** Junta sem repetir: o mesmo acontecimento não vira duas linhas. */
export function juntarNovidades(antes: Novidade[], chegadas: Novidade[]): Novidade[] {
  const ids = new Set(antes.map((n) => n.id));
  return [...antes, ...chegadas.filter((n) => !ids.has(n.id))];
}

// ── O detalhe do pedido (A13, 29-10-2026) ────────────────────────────────────

/**
 * SEM DESCRIÇÃO É UM AVISO — a frase do painel (B2, linha 40): não há nada
 * para ler, há uma coisa a fazer antes de propor um valor.
 */
export const SEM_DESCRICAO =
  "O cliente não escreveu uma descrição. Veja as fotografias, e se faltar alguma coisa para dar um preço justo, peça à CLYON antes de propor.";

/**
 * «Cliente desde outubro de 2026 · 3 trabalhos confirmados» — a linha do
 * painel (B2, linha 49). Só o que é real: sem data nem confirmados, nada.
 */
export function clienteDesde(ctx: Trabalho["clienteContexto"]): string | null {
  if (!ctx) return null;
  const partes: string[] = [];
  if (ctx.desde) {
    const d = new Date(ctx.desde);
    if (Number.isFinite(d.getTime())) {
      partes.push(`Cliente desde ${d.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon", month: "long", year: "numeric" })}`);
    }
  }
  if (ctx.confirmados > 0) {
    partes.push(`${ctx.confirmados} trabalho${ctx.confirmados === 1 ? "" : "s"} confirmado${ctx.confirmados === 1 ? "" : "s"}`);
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}

/** O mapa da morada, pela rota do site (a chave do Google não sai do servidor) — B2, linha 50. */
export function caminhoDoMapa(morada: string | null | undefined): string | null {
  const m = morada?.trim();
  return m ? `/api/mapa?q=${encodeURIComponent(m)}&w=640&h=200` : null;
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
  /**
   * O que a caixa de propor traz escrito: o valor do cliente em cima da mesa.
   * Na primeira proposta, nada — como no painel («O seu valor a propor», a
   * caixa vazia e os atalhos por baixo). Vinha a sugestão CLYON, que é a conta
   * dos custos dele: no #469 a caixa dizia 80,36 € com o cliente nos 250 €, e
   * um toque em «Enviar proposta» deitava fora a diferença (20-10-2026).
   */
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
    referenciaParaPropor: aberturaDoCliente ? null : (pendente?.valor ?? null),
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
 * MARCAR O DIA COMO NO PAINEL — 25-10-2026.
 *
 * A app só deixava escolher das 07:00 às 21:30 e até 21 dias à frente; o
 * painel marca qualquer dia e hora, e desde 22-10 a agenda vai até à
 * meia-noite. Uma mudança às 22h, ou daqui a um mês, obrigava a ir ao painel.
 * Agora: 120 dias à frente, e as horas da janela da agenda (`JANELA_PADRAO`,
 * das 07:00 à meia-noite, de meia em meia hora).
 */
export const DIAS_PARA_MARCAR = 120;

/**
 * Os dias que ele pode escolher para marcar: hoje e os seguintes, em Lisboa.
 * O site lê «AAAA-MM-DDTHH:MM» como hora de Lisboa — a app não faz contas de fusos.
 */
export function diasParaMarcar(
  agora: Date = new Date(),
  quantos = DIAS_PARA_MARCAR,
): Array<{ dia: string; rotulo: string }> {
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

/** As horas para marcar, de meia em meia hora, da janela da agenda: das 07:00 às 23:30. */
export const HORAS_PARA_MARCAR: string[] = Array.from({ length: (JANELA_PADRAO.ate - JANELA_PADRAO.de) * 2 }, (_, i) => {
  const h = JANELA_PADRAO.de + Math.floor(i / 2);
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

/*
 * O «ESTÁ FEITO» SEM FOTOGRAFIAS — 26-10-2026 (d22). As fotografias passaram
 * a opcionais: sem elas o trabalho não fecha sozinho, e é um colega da CLYON
 * que confirma com o cliente. As frases são as do painel (src/lib/trabalho.ts),
 * também a da espera desde 28-10-2026 (d4): `aEsperaDaConfirmacao`.
 */

/** A resposta de `POST /api/profissionais/trabalho` — `confirmacaoAutomaticaEmDias` é `null` sem fotografias. */
export type RespostaDoFeito = {
  ok?: boolean;
  mensagem?: unknown;
  fotografias?: unknown;
  confirmacaoAutomaticaEmDias?: unknown;
};

/** O que a app diz depois de marcar como feito: a frase da rota, ou a mesma do site se não vier. */
export function obrigadoDoFeito(r: RespostaDoFeito | null | undefined): string {
  return typeof r?.mensagem === "string" && r.mensagem.trim() !== "" ? r.mensagem : OBRIGADO_DEPOIS_DE_FEITO;
}

/**
 * Por feito, sem prazo a correr: à espera de a CLYON falar com o cliente. O
 * site decide (`diasAteLibertar` vem `null` quando `prazoCorre` diz que não);
 * a app só lê. É o `semFotografias` de `aEsperaDaConfirmacao` (28-10-2026,
 * d4) — o `porConfirmarComOCliente` do painel.
 */
export function esperaPelaClyon(t: Pick<Trabalho, "fase" | "diasAteLibertar">): boolean {
  return t.fase === "a_confirmar" && t.diasAteLibertar == null;
}

/**
 * QUANDO ELE O DEU POR FEITO — 27-10-2026 (decisão d5).
 *
 * «Marcou como feito a 27/10/2026, às 14:05.» — a mesma frase e o mesmo
 * formato do painel (`dataEHora` em Trabalhos.tsx), à hora de Lisboa seja
 * qual for o fuso do telemóvel. A data vem da API (`execucaoEnviadaEm`, em
 * UTC na base); sem data, não há linha.
 */
export function marcouComoFeito(execucaoEnviadaEm: string | null | undefined): string | null {
  const d = instanteDaBase(execucaoEnviadaEm ?? null);
  if (!d) return null;
  const p = pecasEmLisboa(d);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `Marcou como feito a ${dois(p.dia)}/${dois(p.mes)}/${p.ano}, às ${dois(p.hora)}:${dois(p.minuto)}.`;
}

/**
 * A FRASE DO TRABALHO CLYON — 27-10-2026 (frase-padrão 5 do Produto).
 *
 * Quem faz o trabalho é o profissional; a CLYON fecha o preço, fala com o
 * cliente e paga depois de confirmado. Nunca a CLYON como quem faz.
 * Sem «você» desde 28-10-2026 (d8): «O trabalho é seu» diz o mesmo em
 * português de Portugal.
 */
export const TRABALHO_COM_PRECO_FECHADO =
  "Trabalho com preço fechado pela CLYON. O trabalho é seu; a CLYON fala com o cliente e paga-lhe depois de o trabalho estar confirmado.";

/**
 * O que acontece depois do «Sim, está feito» — sem fotografias, o cliente não é avisado.
 *
 * Quem confirma é o de `quemConfirmaOTrabalho` (src/lib/trabalho.ts), a regra
 * da rota, e com fotografias diz-se o prazo, como `mensagemDepoisDeFeito` o
 * dirá a seguir (28-10-2026, d4): o cliente, ou ninguém ao fim de 7 dias; num
 * Trabalho CLYON, a CLYON, até 7 dias no máximo.
 */
export function depoisDeMarcar(quem: "o cliente" | "a CLYON", fotografias: number): string {
  if (fotografias === 0) return `Depois disto o valor já não muda. ${QUEM_CONFIRMA_O_TRABALHO}`;
  const confirma = quemConfirmaOTrabalho({ comFotografias: true, ofertaClyon: quem === "a CLYON" });
  return confirma === "cliente"
    ? `Depois disto o valor já não muda, e o cliente é avisado para confirmar — se não disser nada, fica confirmado ao fim de ${DIAS_ATE_LIBERTAR_SOZINHO} dias.`
    : `Depois disto o valor já não muda, e a CLYON é avisada para confirmar — fica confirmado ao fim de ${DIAS_ATE_LIBERTAR_SOZINHO} dias no máximo.`;
}

/*
 * «A CAMINHO» E «CHEGUEI» DIZEM SÓ O QUE É VERDADE — 28-10-2026 (d11).
 *
 * A app dizia «O cliente recebe um WhatsApp na hora» antes de saber se o
 * aviso saía. A rota da etapa responde agora `{ ok, primeiraVez, whatsapp }`:
 * `whatsapp` é true só se o aviso ao cliente saiu. Num segundo toque não se
 * avisa outra vez (`primeiraVez` false) e a app não diz nada. Num Trabalho
 * CLYON, `whatsapp` é sempre false, de propósito — o cliente desses não
 * recebe mensagens automáticas, e a app não promete nada.
 */

/** A resposta de `POST /api/profissionais/trabalho/etapa`. */
export type RespostaDaEtapa = { ok?: boolean; primeiraVez?: unknown; whatsapp?: unknown };

export const CLIENTE_AVISADO_POR_WHATSAPP = "O cliente foi avisado por WhatsApp.";
export const CLIENTE_SEM_AVISO_POR_WHATSAPP = "Não conseguimos avisar o cliente pelo WhatsApp — ligue-lhe.";

/** «avisado», «ligue» (com o botão Ligar), ou nada a dizer. */
export function avisoDaEtapa(
  r: RespostaDaEtapa | null | undefined,
  t: Pick<Trabalho, "ofertaClyon">,
): "avisado" | "ligue" | null {
  if (t.ofertaClyon || r?.primeiraVez !== true) return null;
  return r.whatsapp === true ? "avisado" : "ligue";
}

/** Quem responde ao ajuste: o cliente, ou a CLYON num trabalho dela. */
export function quemResponde(t: Pick<Trabalho, "ofertaClyon">): "o cliente" | "a CLYON" {
  return t.ofertaClyon ? "a CLYON" : "o cliente";
}

/** A conversa com o apoio da CLYON, com o número do pedido já escrito. */
export function whatsAppDaClyon(texto: string): string | null {
  return linkDeWhatsApp(IDENTIFICACAO.telefone, texto);
}

// ── Os sinais do cartão, como no painel ──────────────────────────────────────
// `valorNoCartao` e `bomPorKmDe` são os do painel (`sinais-do-cartao.ts`), que
// vive fora do src/lib e não se pode importar daqui. O teste do site compara
// os dois, caso a caso, para não divergirem.

/** O número grande do cartão nos novos: o valor da CLYON, ou a conta feita para ele. */
export function valorNoCartao(t: Pick<Trabalho, "valorDaClyon" | "sugestao">, separador: Separador): number | null {
  if (separador !== "novos") return null;
  return t.valorDaClyon ?? t.sugestao?.recebeSePropuser ?? null;
}

/** O limiar de «bem pago» DELE, em €/km — ou null, e vale o da casa. */
export function bomPorKmDe(t: Pick<Trabalho, "valorDaClyon" | "sugestao" | "distanciaKm">, separador: Separador): number | null {
  const s = t.sugestao;
  if (!s || !s.comOsSeusCustos || s.semDistancia) return null;
  if (valorNoCartao(t, separador) != null && t.valorDaClyon == null) return null;
  return porQuilometro({ recebeSeAceitar: s.recebeSePropuser, distanciaKm: t.distanciaKm });
}

/** O trabalho como os sinais («perto», «hoje», «bem pago», «com fotos») o lêem. */
export function paraOsSinaisDe(t: Trabalho, separador: Separador): TrabalhoParaAvaliar {
  const emCima = valorNoCartao(t, separador);
  return {
    distanciaKm: t.distanciaKm,
    urgency: t.urgency,
    dataAgendada: t.dataAgendada,
    criadoEm: t.criadoEm,
    recebeSeAceitar: emCima ?? t.recebeSeAceitar,
    quantasFotos: imagensDe(t.filesJson).length,
    bomPorKm: bomPorKmDe(t, separador),
  };
}

/**
 * A ORDEM DA LISTA — as do painel, nos Novos e na Negociação. «Recentes» é a
 * do painel desde 29-10-2026 (A14): o que mexeu há menos tempo em cima
 * (`actualizadoEm`); nas outras, os empates ficam por essa mesma ordem.
 */
export type Ordem = "recentes" | "perto" | "porKm" | "sinais";

export const ORDENS: Array<{ id: Ordem; rotulo: string }> = [
  { id: "recentes", rotulo: "Recentes" },
  { id: "perto", rotulo: "Mais perto" },
  { id: "porKm", rotulo: "€/km" },
  { id: "sinais", rotulo: "Com sinais" },
];

export function ordenarTrabalhos(lista: Trabalho[], ordem: Ordem, separador: Separador): Trabalho[] {
  // «Recentes» e os empates: o que mexeu há menos tempo em cima, como no painel (A14).
  const recentes = maisRecentePrimeiro(lista);
  if (ordem === "recentes") return recentes;
  const posicao = new Map(recentes.map((t, i) => [t.negociacaoId, i]));
  const chave = (t: Trabalho): number => {
    if (ordem === "perto") return t.distanciaKm != null && Number.isFinite(t.distanciaKm) ? t.distanciaKm : Infinity;
    if (ordem === "porKm") return -(porQuilometro(paraOsSinaisDe(t, separador)) ?? -1);
    return -pesoDoTrabalho(paraOsSinaisDe(t, separador));
  };
  return [...recentes].sort((a, b) => chave(a) - chave(b) || (posicao.get(a.negociacaoId) ?? 0) - (posicao.get(b.negociacaoId) ?? 0));
}

// ── A agenda: os trabalhos por fazer, pelo dia ───────────────────────────────

export type DiaDaAgenda = { dia: string; rotulo: string; passou: boolean; trabalhos: Trabalho[] };
export type Agenda = { semData: Trabalho[]; dias: DiaDaAgenda[]; marcados: number };

/** O instante do trabalho: o dia combinado com ele, ou, sem esse, o que o cliente pediu. */
export function quandoNaAgenda(t: Pick<Trabalho, "dataCombinada" | "dataAgendada">): Date | null {
  const v = t.dataCombinada ?? t.dataAgendada;
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** A hora do trabalho em Lisboa — só quando a há (uma data sem hora vem à meia-noite UTC). */
export function horaNaAgenda(t: Pick<Trabalho, "dataCombinada" | "dataAgendada">): string | null {
  const v = t.dataCombinada ?? t.dataAgendada;
  if (!v || !/T\d{2}:\d{2}/.test(v) || /T00:00(:00)?(\.000)?Z?$/.test(v)) return null;
  return horaCurta(v);
}

/** «Terça-feira, 21 de outubro». */
export function diaPorExtenso(dia: string): string {
  const t = new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-PT", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * A agenda dele: os trabalhos contratados por fazer, pelo dia em Lisboa (os
 * que já passaram do dia primeiro — são os que precisam de um telefonema), e
 * à parte os que ainda não têm dia. Os feitos não entram: já não há nada a
 * combinar.
 */
export function agendaDe(lista: Trabalho[], agora: Date = new Date()): Agenda {
  const porFazer = lista.filter((t) => t.estado === "acordada" && t.fase === "a_executar" && !t.arquivadoEm);
  const hoje = diaEmLisboa(agora);
  const amanha = somarDiasAoDia(hoje, 1);
  const ontem = somarDiasAoDia(hoje, -1);
  const semData: Trabalho[] = [];
  const porDia = new Map<string, Trabalho[]>();
  for (const t of porFazer) {
    const d = quandoNaAgenda(t);
    if (!d) {
      semData.push(t);
      continue;
    }
    const dia = diaEmLisboa(d);
    porDia.set(dia, [...(porDia.get(dia) ?? []), t]);
  }
  const instante = (t: Trabalho) => quandoNaAgenda(t)?.getTime() ?? 0;
  const dias = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, trabalhos]) => ({
      dia,
      rotulo: dia === hoje ? "Hoje" : dia === amanha ? "Amanhã" : dia === ontem ? "Ontem" : diaPorExtenso(dia),
      passou: dia < hoje,
      trabalhos: [...trabalhos].sort((a, b) => instante(a) - instante(b)),
    }));
  return { semData, dias, marcados: porFazer.length - semData.length };
}

/** «2 h», «1 h 30», «45 min» — null são as duas horas do costume. */
export function duracaoDe(t: Pick<Trabalho, "duracaoMinutos">): number {
  return t.duracaoMinutos ?? DURACAO_PADRAO_MIN;
}

/**
 * «Pôr no calendário do telemóvel» — o mesmo link do painel: um evento do
 * Google Calendar com a hora de Lisboa e a duração do trabalho. Só quando há
 * hora combinada; sem ela, não há evento que se marque.
 */
export function linkDoCalendario(t: Trabalho): string | null {
  if (!t.dataCombinada || !horaNaAgenda(t)) return null;
  const inicio = new Date(t.dataCombinada);
  if (!Number.isFinite(inicio.getTime())) return null;
  const fim = new Date(inicio.getTime() + duracaoDe(t) * 60_000);
  const z = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `CLYON · ${servicoDe(t)} (pedido #${t.pedidoId})`,
    dates: `${z(inicio)}/${z(fim)}`,
    details: [t.contactoNome, t.contactoTelefone].filter(Boolean).join(" · "),
    location: t.morada ?? t.city ?? "",
    ctz: "Europe/Lisbon",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
