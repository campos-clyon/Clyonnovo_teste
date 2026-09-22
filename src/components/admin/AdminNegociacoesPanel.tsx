"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  Building2,
  Camera,
  CheckCircle2,
  Archive,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserRound,
  XCircle,
  Link as LinkIcon,
  Check,
  Star,
  StickyNote,
} from "lucide-react";
import { quemNegoceia, clyonPodeConfirmar, porqueNaoPodeConfirmar } from "@/lib/quem-negoceia";
/*
 * A REGRA DO PRAZO VEM DE ONDE ELA VIVE — 20-09-2026.
 *
 * A mesa tinha a sua própria ideia do que é uma proposta por responder: «tem
 * `estado: pendente`». O motor tem outra, e é a que manda. As duas discordavam,
 * e via-se:
 *
 *   o #320 mostrava «Revolution · espera resposta · 322,00 €» com um botão
 *   «Aceitar 322,00 €», sobre uma proposta de 14 de Setembro. Carregar dava
 *   409 e «Não há proposta para aceitar» — o servidor tinha razão, e o ecrã
 *   tinha convidado.
 *
 * Uma regra escrita duas vezes acaba sempre com dois comportamentos. Esta
 * passa a ser lida daqui.
 *
 * ⚠️ E NO MESMO DIA O PRAZO FOI-SE. Removido o prazo das 48 horas, o motor
 * passou a responder «não expira» a tudo, e esta mesa acompanhou sem que se lhe
 * tocasse numa linha — é exactamente para isto que a regra vive num sítio só.
 * O aparato do prazo fica de pé, desligado, atrás de `AS_PROPOSTAS_EXPIRAM`.
 */
import { estaExpirada, type Proposta as PropostaDoMotor } from "@/lib/negociacao";
import { combinaComABusca } from "@/lib/procurar-pedido";
import CancelarPedido from "./CancelarPedido";
import { grupoPorIdade, ROTULO_DO_GRUPO, type GrupoDeIdade } from "@/lib/idade-do-pedido";
import {
  categoriaDoPedido,
  CORES_DA_CATEGORIA_ESCURO,
  ETIQUETA_DA_CATEGORIA,
} from "@/lib/assistente-categorias";
import {
  contaDoCliente,
  quantoOProfissionalRecebe,
  comissaoDaClyon,
  taxasDaNegociacao,
  TAXA_CLIENTE,
  TAXA_PROFISSIONAL,
  TAXA_IVA,
  type Taxas,
} from "@/lib/taxas-plataforma";
import { lerForma } from "@/lib/forma-de-pagamento";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import VisorDeFotos from "@/components/VisorDeFotos";
import { Miniatura } from "@/components/Anexo";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import {
  mensagemDasPropostas,
  propostasParaOCliente,
  trabalhoFechado,
} from "@/lib/mensagem-das-propostas";
import { linkDeWhatsApp, numeroParaWhatsApp } from "@/lib/link-de-whatsapp";
import { telefoneLegivel } from "@/lib/telefone-legivel";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import GerarReferencia from "@/components/admin/GerarReferencia";
import RegistarPedido from "./RegistarPedido";
import PedidoDetailModal from "./PedidoDetailModal";
import { PROMESSA } from "@/lib/pagamento-na-plataforma";

type Proposta = {
  por: "cliente" | "profissional";
  valor: number;
  /*
   * `criadaEm`, e nao `em`.
   *
   * Este tipo dizia `em` e o motor grava `criadaEm` — o TypeScript nao tinha
   * como saber, porque isto vem de um JSON.parse. O resultado era a data de
   * cada proposta a sair sempre em branco no painel: via-se quem propos e
   * quanto, nunca quando. Numa troca de quatro propostas em dois dias, a
   * ordem e metade do que interessa.
   */
  criadaEm: string;
  estado: string;
};

type Negociacao = {
  id: number;
  providerId: number;
  profissionalNome: string;
  profissionalEmail: string | null;
  estado: string;
  valorAcordado: string | null;
  propostasJson: string | null;
  execucaoEnviadaEm: string | null;
  /** A nota já dada, se houver. `null` = por avaliar. */
  estrelas?: number | null;
  avaliadoEm?: string | null;
  provaJson: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
  /**
   * O regime de IVA de quem factura.
   *
   * O valor acordado e SEM IVA desde 29-08-2026: sem esta coluna o backoffice
   * mandava cobrar 23% a menos do que ha a cobrar.
   */
  regimeIva?: string | null;
  /** Como o cliente paga esta negociação. Nulo = na plataforma. */
  formaDePagamento?: string | null;
  acrescimoPagamento?: string | number | null;
  taxaCliente?: string | number | null;
  taxaProfissional?: string | number | null;
  criadaEm: string;
  actualizadaEm: string;
};

/**
 * ESTA PROPOSTA AINDA ESTÁ VIVA?
 *
 * Chamava-se «já passaram as 48 horas?» e desde 20-09-2026 a resposta é sempre
 * «não» — ver `AS_PROPOSTAS_EXPIRAM`. A pergunta continua a ser feita aqui, e
 * por aqui volta a valer se o prazo voltar.
 *
 * A conta é do motor — `estaExpirada` — e é aqui que se lhe entrega a
 * proposta. O molde local diz `estado: string` porque vem de um `JSON.parse`
 * e o TypeScript não tem como saber o que lá está; o do motor é a união dos
 * quatro estados possíveis. A conversão é feita NUMA linha, aqui, e não
 * espalhada por cada sítio que precise de saber se o prazo passou.
 *
 * Se o JSON trouxer um estado que não existe, `estaExpirada` responde `false`
 * — não é «pendente», logo não expira. É o lado seguro: mostra-se a mais, e
 * vê-se; ao contrário, escondia-se uma proposta viva.
 */
function expirou(p: Proposta, agora: Date): boolean {
  return estaExpirada(p as PropostaDoMotor, agora);
}

function propostasDe(json: string | null): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

function provaDe(json: string | null): { fotos: string[]; nota: string } | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json);
    return {
      fotos: Array.isArray(p?.fotos) ? p.fotos.filter((f: unknown) => typeof f === "string") : [],
      nota: typeof p?.nota === "string" ? p.nota : "",
    };
  } catch {
    return null;
  }
}

function quando(v: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-PT");
}

/**
 * Ha aqui uma proposta a espera de resposta da CLYON?
 *
 * E a unica pergunta que o painel nao respondia. O profissional contrapropoe,
 * e do lado do backoffice nada mudava: a negociacao continuava a dizer
 * "aberta · 2 propostas", fechada atras de um chevron, no fundo de uma pagina.
 * Quem abrisse o painel nao tinha como saber que alguem estava do outro lado a
 * espera. (Escrevia-se aqui "a contar as horas": desde 20-09-2026 nao ha horas
 * a contar, e a espera nao tem fim a vista — o que torna a pergunta mais
 * urgente, nao menos.)
 *
 * Uma proposta do CLIENTE pendente esta a espera do profissional — nao e
 * connosco. So conta a que veio do profissional.
 */
function esperaResposta(n: Negociacao): boolean {
  if (n.estado === "acordada" || n.estado === "desistida" || n.estado === "morta") {
    return false;
  }
  // `aguarda_contratacao` e o nome do estado a dizer isto: o profissional
  // aceitou, o valor esta fechado dos dois lados, e nao acontece mais nada ate
  // alguem carregar em contratar. Nao ha proposta pendente nenhuma para
  // encontrar — e por isso que tem de ser uma condicao a parte.
  if (n.estado === "aguarda_contratacao") return true;
  /*
   * E NÃO CONTA AS QUE JÁ EXPIRARAM — 20-09-2026.
   *
   * Hoje não expira nenhuma (`AS_PROPOSTAS_EXPIRAM`), pelo que este guarda não
   * deixa cair nada. Fica porque a razão de existir é a de sempre: esta função
   * só olhava para o `estado` gravado, que continua a dizer «pendente» para
   * sempre, e o prazo — quando há — é uma conta sobre a data, não um carimbo
   * na base.
   *
   * O resultado era a mesa a dizer «espera resposta» sobre uma proposta de
   * há seis dias, a pôr o pedido em «Precisa de si», e a oferecer um botão
   * que o servidor recusa. Quem ali estava não esperava por nada: o prazo
   * tinha passado e o que falta é pedir outra proposta.
   */
  const agora = new Date();
  return propostasDe(n.propostasJson).some(
    (x) => x.estado === "pendente" && x.por === "profissional" && !expirou(x, agora),
  );
}

/**
 * A ÚLTIMA PROPOSTA DELE, SE TIVER EXPIRADO.
 *
 * Tirar a proposta expirada de «espera resposta» é metade do trabalho; a
 * outra metade é dizer porquê. Sem isto, o cartão passava a mostrar só
 * «aberta» e ninguém percebia que tinha havido ali um valor em cima da mesa
 * — e que o que falta agora é pedir outro.
 */
function propostaExpiradaDele(n: Negociacao): Proposta | null {
  if (n.estado !== "aberta") return null;
  const agora = new Date();
  const dele = propostasDe(n.propostasJson).filter(
    (x) => x.por === "profissional" && x.estado === "pendente",
  );
  const ultima = dele[dele.length - 1];
  return ultima && expirou(ultima, agora) ? ultima : null;
}

/**
 * O trabalho está feito e ninguém o disse ainda.
 *
 * O profissional carrega em concluir e manda a prova: fica `execucaoEnviadaEm`.
 * Depois disso o trabalho espera por uma confirmação — e é ela, e só ela, que
 * fecha o pedido e liberta o dinheiro cativo.
 *
 * A mesa não olhava para isto. O #226 dizia "✓ Acordada por 170,00 € com
 * Sthefanny Lemos", debaixo de "A CORRER — a bola está do outro lado", com
 * exactamente as mesmas palavras que dizia antes de a Sthefanny lá ir. Ele
 * escreveu-lhe pelo WhatsApp "marca concluído para abrir o pagamento", ela
 * respondeu "já está" — e estava mesmo, na base, às 16:00:47. O ecrã é que
 * não o dizia em lado nenhum sem abrir a negociação uma a uma.
 *
 * E não foi caso único: o #219 tinha a prova enviada desde 25 de Agosto às
 * 09:12 e ninguém confirmou nada. Ficou arquivado com o trabalho do Manuel
 * Martins por reconhecer.
 */
/**
 * O pedido está concluído — pelo trabalho, não só pela coluna.
 *
 * `confirmarExecucao` põe o pedido em `concluido` quando o trabalho é
 * confirmado, mas de propósito não toca em cancelados nem em arquivados: quem
 * arquivou decidiu onde o pedido vive, e uma confirmação tardia não desfaz
 * essa arrumação. Bem visto para um cancelado.
 *
 * Só que a mesa não é o arquivo. Os três níveis dela respondem a uma pergunta
 * — o que preciso de fazer agora? — e um trabalho confirmado não precisa de
 * nada. O #219 estava arquivado desde 25 de Agosto; ele confirmou-o às 16:28 e
 * libertou os 100,00 € ao Manuel Martins, e o ecrã continuou a mostrá-lo em "A
 * CORRER — ✓ Acordada por 100,00 €", como se ainda houvesse alguém a jogar.
 *
 * A verdade sobre um trabalho vive na negociação, e é `confirmadoEm`: é ela
 * que fecha o trabalho, liberta o dinheiro e deixa apagar as contas. Uma
 * coluna de arrumação do backoffice não a contradiz.
 */
function pedidoConcluido(p: Pedido): boolean {
  return p.status === "concluido" || p.negociacoes.some((n) => n.confirmadoEm != null);
}

function esperaConfirmacao(n: Negociacao): boolean {
  if (n.estado === "desistida" || n.estado === "morta") return false;
  return n.execucaoEnviadaEm != null && n.confirmadoEm == null;
}

/**
 * De quem é a vez, na pergunta que a mesa faz: "o que preciso de fazer agora?"
 *
 * Uma proposta por responder e um trabalho por confirmar são coisas
 * diferentes, mas do lado dele são a mesma: nenhuma delas anda sem ele.
 */
function precisaDeSi(n: Negociacao): boolean {
  return esperaConfirmacao(n) || esperaResposta(n);
}

/** O que falta fazer, em duas palavras, para o distintivo do cartao. */
function oQueFalta(n: Negociacao): string {
  if (esperaConfirmacao(n)) return "trabalho feito — falta confirmar";
  return n.estado === "aguarda_contratacao" ? "falta contratar" : "espera resposta";
}

/**
 * O serviço em palavras que o cliente escreveu, e não no código do motor.
 *
 * "recolha_entulho" numa mensagem de WhatsApp é linguagem de base de dados a
 * escapar-se para a frente de quem não a devia ver. Em minúsculas de
 * propósito: entra a meio de uma frase — "propostas para a recolha de entulho
 * em Setúbal".
 */
function nomeDoServico(id: string | null): string | null {
  if (!id) return null;
  const c = SERVICE_CATEGORIES.find((x) => x.id === id);
  return (c?.label ?? id.replace(/_/g, " ")).toLowerCase();
}

const ESTADO_DA_PROPOSTA: Record<string, string> = {
  pendente: "à espera de resposta",
  aceite: "aceite",
  recusada: "recusada",
  expirada: "expirou",
};

type Pedido = {
  id: number;
  serviceType: string | null;
  city: string | null;
  contactName: string | null;
  contactEmail: string | null;
  /** O telemóvel, para o orçamento poder sair daqui direito para o WhatsApp. */
  contactPhone: string | null;
  /**
   * O cliente pediu factura no formulário.
   *
   * Decide o valor da referência de pagamento: com factura acresce o IVA da
   * taxa CLYON. Já vinha na consulta (`o.precisaFatura`) e só faltava dizê-lo
   * aqui.
   */
  precisaFatura?: number | boolean | null;
  /** A morada e o código postal — o que a busca do topo procura. */
  address: string | null;
  postalCode: string | null;
  valorDesejadoCliente: string | null;
  /** "backoffice", "hero_quote_form", "formulario_contactos", ou null. */
  origem: string | null;
  status: string | null;
  /**
   * A NOTA DA EQUIPA SOBRE ESTE PEDIDO.
   *
   * "O Sr. Rui Santos pediu para esperar até segunda para tomar uma decisão;
   * se tivesse como colocarmos uma etiqueta no pedido dele ou uma anotação,
   * seria mais fácil." — 19-09-2026.
   *
   * É a MESMA coluna que o ecrã do pedido já escrevia, e não um campo novo:
   * duas notas sobre a mesma coisa acabam a dizer coisas diferentes, e a que
   * fica por ler é sempre a que tinha a informação.
   */
  notasInternas?: string | null;
  /** Quando o admin abriu o pedido depois de concluído. Null = por ver. */
  concluidoVistoEm: string | null;
  /**
   * A validade do link do cliente — que serve de MARCA DE VERSÃO.
   *
   * Cada token novo põe uma data nova, por isso duas datas diferentes são dois
   * tokens diferentes. É assim que o ecrã sabe que o link que tem na caixa foi
   * substituído por outro caminho, sem ninguém lhe dizer.
   */
  linkExpiraEm: string | null;
  createdAt: string;
  negociacoes: Negociacao[];
};

/*
 * `quemNegoceia` mudou-se para `@/lib/quem-negoceia`.
 *
 * Aqui servia para desenhar dois grupos no ecra. A partir do momento em que a
 * CLYON pode CONFIRMAR um trabalho — o gesto que liberta o dinheiro do
 * profissional — a mesma regra passou a ser um portao no servidor. Um portao
 * que vive so no browser nao e um portao, e copiado em dois sitios acabaria
 * com o ecra a esconder um botao que a rota continuava a aceitar.
 */

/*
 * De onde o pedido entrou, em duas palavras.
 *
 * Os valores vieram da base: simulador (89), hero_quote_form (14),
 * formulario_contactos (10), backoffice (7). Um pedido sem origem gravada é
 * do simulador — foi de lá que vieram todos antes de haver o resto.
 */
const ORIGEM: Record<string, string> = {
  simulador: "Simulador",
  hero_quote_form: "Site",
  formulario_contactos: "Contactos",
  backoffice: "Backoffice",
  plataforma: "Plataforma",
};

const ESTADO_CLS: Record<string, string> = {
  aberta: "bg-blue-500/15 text-blue-300",
  aguarda_contratacao: "bg-amber-500/15 text-amber-300",
  acordada: "bg-emerald-500/15 text-emerald-300",
  desistida: "bg-slate-700 text-slate-300",
  morta: "bg-slate-700 text-slate-400",
};

type PorPromover = {
  id: number;
  serviceType: string | null;
  city: string | null;
  contactName: string | null;
  contactEmail: string | null;
  /** Telemóvel, morada e código postal: só servem à busca do topo. */
  contactPhone: string | null;
  address: string | null;
  postalCode: string | null;
  estimateTotal: string | null;
  urgency: string | null;
  createdAt: string;
};

/*
 * A MESA EM SEIS BLOCOS, POR DE QUEM É A VEZ.
 *
 * "Aqui também precisa de organização." Ele abriu as Negociações logo depois
 * de aprovar a Agenda e viu tudo junto: o cabeçalho, uma faixa verde, um
 * bloco âmbar enorme com a lista inteira dos pedidos do simulador, e só
 * depois os pedidos da plataforma, separados por linhas finas que nem sempre
 * apareciam. Não estava errado — estava empilhado.
 *
 * O eixo não muda: o que separa continua a ser DE QUEM É A VEZ, nunca a
 * origem ("pode mostrar a origem mas não separá-lo por isso") e nunca a data
 * (a idade só arruma os pedidos por promover, por dentro do bloco deles). O
 * que muda é a disposição, copiada do padrão que ele aprovou na Agenda: cada
 * estado é um bloco com título colado ao topo, contagem, uma linha a dizer o
 * que fazer com ele, e um cartão de totais em cima que serve de filtro. O que
 * já está feito nasce fechado.
 *
 * O TÍTULO APARECE SEMPRE, mesmo com um nível só. O separador antigo era "uma
 * linha a dizer o óbvio" e por isso só se desenhava com mais de um nível
 * (`comCoisas > 1`). O cabeçalho novo não é um separador: é um controlo que
 * abre e fecha, fica colado ao rolar e traz a contagem e a instrução — já não
 * é ruído, é o sítio onde se lê o que fazer. A regra `comCoisas > 1` fica no
 * `activosOrdenados` tal e qual, porque esse memo é a regra de ordenação da
 * mesa e está fixada por testes que lêem a fonte; o render deixou de desenhar
 * as entradas de separador que ele produz.
 *
 * As três frases dos níveis existem duas vezes de propósito: no memo (onde os
 * testes as procuram) e aqui (onde o render as lê). Uma fonte só obrigava a
 * mexer no memo, e o memo não se mexe.
 *
 * A caixa "Só o que precisa de atenção" da Agenda NÃO entra neste passo. Não
 * está no que ele enumerou, e ligada por omissão escondia os Contratados que
 * ele pediu para VER separados ("Temos que separar os pedidos já contratados
 * dos à espera de propostas"). Fica como pergunta a fazer-lhe; a receita, se
 * quiser: PRECISAM = [n1, porEnviar, n2] e a caixa desactivada enquanto há um
 * cartão escolhido.
 */
type ChaveDoBloco =
  | "porConfirmar"
  | "n1"
  | "porEnviar"
  | "n2"
  | "n3"
  | "concluidos"
  | "cancelados";
type Mostrar = "tudo" | "clyon" | "clientes";

const BLOCOS: Array<{
  chave: ChaveDoBloco;
  titulo: string;
  /** UMA frase a dizer o que fazer com o bloco. */
  dica: string;
  Icone: ComponentType<{ className?: string }>;
  /** A cor do título e do traço à esquerda — DUAS classes numa string, partidas no render. */
  cor: string;
  /** A cor do número no cartão de cima. */
  corDoNumero: string;
  /** Fechado por omissão — o que já está feito não precisa de ocupar o ecrã. */
  fechadoPorOmissao?: boolean;
  /** A regra dos três modos do painel, num sítio só. */
  visivelEm: (mostrar: Mostrar) => boolean;
}> = [
  /*
   * Primeiro de cima para baixo porque é o único nível onde a demora custa
   * dinheiro: há um profissional à espera de resposta, e um trabalho por
   * confirmar é dinheiro cativo. Até aqui vivia debaixo do bloco âmbar. (Dizia-se
   * «uma proposta expira em 48 horas» — já não expira, e a demora custa o mesmo:
   * o que se perde é o profissional, não a proposta.)
   */
  /*
   * TRABALHO FEITO NÃO É PROPOSTA POR RESPONDER — 17-09-2026.
   *
   * "Os trabalhos concluídos à espera de validação estão misturados com os à
   * espera dos clientes."
   *
   * Os dois precisavam dele, e por isso viviam no mesmo bloco — mas precisam
   * de COISAS DIFERENTES. Num, alguém tem de responder a uma proposta antes
   * de ela expirar. No outro, o trabalho já foi feito, o profissional já lá
   * esteve, e o que falta é o cliente reconhecê-lo para o dinheiro se
   * libertar. Misturados, a linha do #325 — «Trabalho feito por Manuel
   * Martins, falta confirmar 75 €» — lia-se como mais uma à espera de
   * resposta, e ficava para depois.
   *
   * PRIMEIRO DE TODOS, e é a única coisa que passa à frente do «Precisa de
   * si»: aqui está dinheiro de um profissional preso à espera de um gesto
   * que ninguém fez. Uma proposta que expira perde-se um negócio; isto
   * segura o que já foi ganho.
   */
  {
    chave: "porConfirmar",
    titulo: "Feitos, à espera de confirmação",
    dica:
      "O trabalho está feito e o dinheiro do profissional está preso até alguém o confirmar. Abra o pedido e confirme, ou lembre o cliente.",
    Icone: CheckCircle2,
    cor: "text-amber-300 border-amber-500/60",
    corDoNumero: "text-amber-300",
    visivelEm: () => true,
  },
  {
    chave: "n1",
    titulo: "Precisa de si",
    dica:
      "Nada avança sem si. A proposta fica de pé até alguém responder — responda, ou feche o negócio, em nome do cliente, dentro do pedido.",
    Icone: Clock,
    cor: "text-emerald-300 border-emerald-500/60",
    corDoNumero: "text-emerald-300",
    visivelEm: () => true,
  },
  /*
   * ── Do simulador, ainda fora da plataforma ─────────────────────────
   * Estes entraram pelo formulário de orçamento do site: têm estimativa,
   * não têm valor pedido pelo cliente, e nunca foram distribuídos. Um
   * profissional não os vê.
   *
   * Promover é decidido pedido a pedido, e não por omissão: quem
   * preencheu o simulador pediu um orçamento à CLYON, não pediu para
   * entrar num mercado — a partir daqui passa a receber propostas de
   * terceiros.
   *
   * Segundo de cima para baixo: é o maior e o mais colorido, mas espera
   * triagem, não um prazo. Não aparece no ecrã "clyon" — esse só vê o que
   * a CLYON já negoceia.
   */
  {
    chave: "porEnviar",
    titulo: "Por enviar",
    dica:
      "Pedidos do simulador, ainda fora da plataforma — um profissional não os vê. Enviar aos profissionais parte da conta da CLYON (custos + margem, sem IVA) ou do valor que escrever na caixa, envia o link ao cliente e distribui; cada profissional vê a conta com os quilómetros dele.",
    Icone: Send,
    cor: "text-amber-300 border-amber-500/60",
    corDoNumero: "text-amber-300",
    visivelEm: (mostrar) => mostrar !== "clyon",
  },
  {
    chave: "n2",
    titulo: "À espera de propostas",
    dica:
      "A bola está com os profissionais. Um pedido sem nenhuma proposta morre de silêncio — «porquê?» na linha diz quem foi alcançado; redistribua se ninguém foi notificado.",
    Icone: UserRound,
    cor: "text-sky-300 border-sky-500/60",
    corDoNumero: "text-sky-300",
    visivelEm: () => true,
  },
  /*
   * Continua VISÍVEL à entrada: ele pediu para os ver separados, não
   * escondidos. O QUANDO destes é pergunta da Agenda, não desta mesa.
   */
  {
    chave: "n3",
    titulo: "Contratados",
    dica:
      "Já têm quem faça — falta o trabalho acontecer. O dia e a hora vêem-se na Agenda; quando o profissional der o trabalho por feito, o pedido sobe para «Precisa de si».",
    Icone: Check,
    cor: "text-violet-300 border-violet-500/60",
    corDoNumero: "text-violet-300",
    visivelEm: () => true,
  },
  /*
   * Fechado por omissão, como os "Feitos" da Agenda — mas a pílula "N por
   * ver" fica no título, visível com o bloco fechado. É isso que torna o
   * fechar compatível com "caso o admin ainda não tenha aberto deve ficar
   * destacado": dinheiro que entrou merece ser visto, não descoberto por
   * acaso. Mostra os de todos os modos, como antes — a arrumação não é de
   * quem negoceia.
   */
  {
    chave: "concluidos",
    titulo: "Concluídos",
    dica:
      "Trabalhos confirmados e fechados. Um cartão em realce ainda não foi aberto desde a conclusão — abrir mostra as contas completas e apaga o realce.",
    Icone: CheckCircle2,
    cor: "text-emerald-400 border-emerald-500/60",
    corDoNumero: "text-emerald-400",
    fechadoPorOmissao: true,
    visivelEm: () => true,
  },
  /*
   * OS CANCELADOS, EM BAIXO E EM CINZENTO.
   *
   * Não são concluídos — não houve trabalho nenhum — e não estão a correr,
   * porque já ninguém espera nada. Ficam à vista na mesma: o pedido não é
   * apagado, e daqui a um mês a pergunta "o que aconteceu ao #225?" tem de
   * ter resposta sem ir a base nenhuma. Nascem fechados pelo mesmo motivo
   * dos concluídos; mostram os de todos os modos.
   */
  {
    chave: "cancelados",
    titulo: "Cancelados",
    dica:
      "O cliente desistiu antes de haver trabalho. Ficam aqui com o histórico inteiro — abrir mostra o motivo e as propostas que chegaram a existir.",
    Icone: XCircle,
    cor: "text-slate-500 border-slate-600",
    corDoNumero: "text-slate-400",
    fechadoPorOmissao: true,
    visivelEm: () => true,
  },
];

export default function AdminNegociacoesPanel({
  mostrar = "tudo",
  podeApagar = true,
}: {
  /**
   * Apagar é do administrador. O assistente vê a mesma mesa e arquiva; o
   * botão de apagar não lhe aparece — e o servidor recusava-o na mesma, mas
   * um botão que responde sempre "não" é um botão que não devia estar lá.
   */
  podeApagar?: boolean;
  /*
   * O ecrã pode mostrar só metade do painel.
   *
   * As negociações da CLYON — pedidos de telefone, clientes sem email — são
   * trabalho DIÁRIO de quem opera: há propostas à espera de resposta nossa.
   * As dos clientes são vigilância. Misturadas num ecrã só, o que exige acção
   * vivia no meio do que não exige nenhuma — passaram a ecrãs separados no
   * menu, e o painel é o MESMO componente para não haver duas versões da
   * mesma lógica a divergirem.
   */
  mostrar?: "tudo" | "clyon" | "clientes";
}) {
  const { token, ready } = useAdminAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  /*
   * A FOTOGRAFIA ABRE POR CIMA, e não noutro separador.
   *
   * "Ao clicar em imagens para abrir não quero que abra uma nova janela."
   *
   * Cada prova aberta deixava um separador do domínio do armazenamento por
   * fechar, e voltar à mesa era procurá-la entre sete. O visor já existia — é
   * o mesmo que o profissional usa — e só faltava chamá-lo aqui.
   */
  const [aVer, setAVer] = useState<{ lista: string[]; i: number } | null>(null);
  const [linksEmClaro, setLinksEmClaro] = useState<Record<string, string>>({});
  /**
   * O pedido que está prestes a ser cancelado.
   *
   * ERA UM `window.prompt` COM O MOTIVO À MÃO. Escrever a razão dá trabalho
   * precisamente na hora em que se quer despachar, e um ano depois ninguém
   * consegue contar quantos pedidos se perderam por desistência — cada pessoa
   * escreveu a mesma coisa de maneira diferente. Passou a ser uma caixa com os
   * motivos em botões, e é a MESMA da agenda: cancelar num sítio ou no outro é
   * o mesmo gesto, e não duas versões da mesma pergunta.
   */
  const [aCancelar, setACancelar] = useState<Pedido | null>(null);
  /*
   * Quais as negociações abertas em ecrã.
   *
   * Era uma só de cada vez — abrir todas dava uma parede de valores onde não
   * se distinguia a que interessa. O problema é que a que interessa costuma
   * ser a que tem uma proposta à espera de resposta, e essa ficava fechada
   * como as outras: era preciso adivinhar em qual carregar.
   *
   * Agora as que esperam por nós abrem sozinhas, uma vez cada, e as outras
   * continuam fechadas. `jaAbertas` é o que impede a lista de se reabrir por
   * cima de quem acabou de a fechar — sem isso, cada actualização automática
   * de 60 segundos voltava a abrir tudo na cara de quem estava a ler.
   */
  const [abertas, setAbertas] = useState<Set<number>>(new Set());
  const jaAbertas = useRef<Set<number>>(new Set());
  const [porPromover, setPorPromover] = useState<PorPromover[]>([]);
  /** Qual dos pedidos esta aberto em detalhe, para editar. */
  const [aEditar, setAEditar] = useState<number | null>(null);
  /*
   * O editor DA PLATAFORMA, por cima do ecrã.
   *
   * "Abrir e editar tudo" abria o modal dos Pedidos — o painel do modelo
   * executante, com "Aceitar pedido" e preço final com IVA. A edição da
   * plataforma acontece no formulário da plataforma: os mesmos campos que os
   * profissionais leem, com re-localização da morada e alcance recalculado.
   * O título do cartão continua a abrir a ficha completa (com a Distribuição).
   */
  const [aEditarPlataforma, setAEditarPlataforma] = useState<number | null>(null);
  /*
   * A lista por profissional deixou de estar sempre aberta.
   *
   * Com quatro ainda se lia; com mil era uma parede — e a parede repetia-se
   * em cada pedido. Fecha-se por omissão atrás de um resumo, e abre-se
   * SOZINHA quando há uma proposta à espera de resposta: o que é accionável
   * não pode ficar atrás de um toque.
   */
  const [negociacoesVisiveis, setNegociacoesVisiveis] = useState<Set<number>>(new Set());
  /** Os que estao com a caixa marcada, para apagar em conjunto. */
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  /*
   * UM BLOCO SÓ, quando se carrega no cartão de cima.
   *
   * Os cartões dos totais são filtros, como na Agenda: carregar em «Precisa
   * de si» deixa só esse bloco no ecrã, e carregar outra vez volta a mostrar
   * todos. Vive em `useState` de propósito — sobrevive ao `carregar(true)` de
   * 30 em 30 segundos e nunca é derivado de "há coisas à espera".
   */
  const [soOBloco, setSoOBloco] = useState<ChaveDoBloco | null>(null);
  /*
   * A BUSCA DA MESA — e procura mesmo em toda a mesa.
   *
   * "Crie uma barra de pesquisa para que eu possa pesquisar com número, nome
   * ou pedido. Até mesmo por morada ou região." — 13-09-2026.
   *
   * Havia uma busca, dentro do bloco «Por enviar», e o comentário dela dizia
   * porquê: «pô-la no topo da mesa prometia procurar em toda a mesa». A
   * objecção estava certa; a resposta a ela não é não haver busca no topo — é
   * a do topo cumprir o que promete. Esta atravessa os seis blocos, e a do
   * bloco saiu para não haver duas caixas a fazer coisas diferentes.
   *
   * ENQUANTO SE PROCURA, O FILTRO DOS CARTÕES CALA-SE. Quem escreve um número
   * de telefone não sabe — nem tem de saber — se aquele pedido está em «Precisa
   * de si» ou em «Concluídos». Uma busca que só olhasse para o bloco escolhido
   * dava «não encontrei» sobre um pedido que está ali à frente. Pela mesma
   * razão, um bloco fechado abre-se quando tem resultados.
   */
  const [busca, setBusca] = useState("");
  /*
   * Já foi buscar a mesa inteira? Uma vez por sessão chega: procura-se várias
   * vezes seguidas, e ir buscar quinhentos pedidos a cada tecla era pôr o
   * ecrã a trabalhar contra quem escreve.
   */
  const [temTudo, setTemTudo] = useState(false);
  /*
   * A NOTA QUE ESTÁ A SER ESCRITA, e o pedido a que pertence.
   *
   * Uma de cada vez: num ecrã que se actualiza sozinho de trinta em trinta
   * segundos, duas caixas abertas é como se perde o que se estava a escrever.
   */
  const [notaAberta, setNotaAberta] = useState<number | null>(null);
  const [rascunhoDaNota, setRascunhoDaNota] = useState("");
  const [aGuardarNota, setAGuardarNota] = useState(false);
  /* Que blocos estão fechados. «Concluídos» e «Cancelados» nascem fechados. */
  const [fechados, setFechados] = useState<Set<ChaveDoBloco>>(
    () => new Set(BLOCOS.filter((b) => b.fechadoPorOmissao).map((b) => b.chave)),
  );
  function alternarFechado(chave: ChaveDoBloco) {
    setFechados((f) => {
      const novo = new Set(f);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }
  /*
   * A única porta para mudar o filtro. Limpa os marcados porque os cartões
   * dos blocos filtrados saem do DOM, e a barra não pode ficar a oferecer
   * Arquivar/Apagar sobre o que não se vê — "marcar o que não está no ecrã
   * seria apagar às escuras". Fechar um bloco pelo título NÃO limpa nada: é
   * o comportamento que já havia, com um Set só para toda a mesa.
   */
  function escolherBloco(chave: ChaveDoBloco | null) {
    setSoOBloco(chave);
    setMarcados(new Set());
  }
  /* Qual o link que acabou de ser copiado, para o botão o confirmar. */
  const [copiado, setCopiado] = useState<string | null>(null);
  /* A versão do link que temos em mão, por pedido — ver `linkExpiraEm`. */
  const [versaoDoLink, setVersaoDoLink] = useState<Record<string, string>>({});

  /*
   * O QUE CORREU MAL AO MANDAR O ORÇAMENTO, DITO NO CARTÃO.
   *
   * Isto vivia no `erro` geral, que se mostra no TOPO do painel. Quem carrega
   * em «Enviar orçamento» está a meio de uma lista de catorze pedidos, a
   * dezenas de linhas do topo: a explicação aparecia num sítio que ele não
   * estava a olhar, e o botão ficava com ar de não fazer nada.
   */
  const [avisoDoOrcamento, setAvisoDoOrcamento] = useState<Record<number, string>>({});

  /* A explicação do alcance, por pedido, quando alguém a pede. */
  const [alcances, setAlcances] = useState<Record<number, string>>({});

  /**
   * Porque é que este pedido chegou a tão poucos.
   *
   * Responde com a regra de HOJE, e não com a de quando o pedido saiu. É de
   * propósito: quem faz esta pergunta quer saber o que tem conserto agora —
   * aprovar aquele profissional, ou pedir-lhe a fatura, muda quem o recebe da
   * próxima. O histórico do envio guarda o que aconteceu na altura.
   */
  async function porquePoucos(pedidoId: number) {
    if (!token || alcances[pedidoId] === "a-ler") return;
    setAlcances((a) => ({ ...a, [pedidoId]: "a-ler" }));
    try {
      const res = await fetch(`/api/admin/negociacoes/alcance?pedidoId=${pedidoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) {
        setAlcances((a) => ({ ...a, [pedidoId]: d.error ?? "Não foi possível calcular." }));
        return;
      }
      const chegam = d.elegiveis?.length ?? 0;
      const fora = (d.candidatos ?? 0) - chegam;
      setAlcances((a) => ({
        ...a,
        [pedidoId]:
          fora > 0 && d.porque
            ? `Hoje chegaria a ${chegam} de ${d.candidatos}. Os outros ${fora}: ${d.porque}.`
            : `Hoje chegaria a ${chegam} de ${d.candidatos} — não há ninguém de fora.`,
      }));
    } catch {
      setAlcances((a) => ({ ...a, [pedidoId]: "Erro de rede." }));
    }
  }
  const [aApagar, setAApagar] = useState(false);
  /*
   * Duas peças para a linha "actualizado há X": quando os dados foram lidos,
   * e um relógio que anda de meio em meio minuto. Sem o relógio, a frase
   * congelava em "agora" até algo mais fazer o ecrã redesenhar-se — e uma
   * frase que mente sobre a hora é pior do que frase nenhuma.
   */
  const [lidoEm, setLidoEm] = useState<number | null>(null);
  const [agoraParaOReloginho, setAgoraParaOReloginho] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgoraParaOReloginho(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const [recusados, setRecusados] = useState<Array<{ id: number; motivo: string }>>([]);

  /*
   * `silencioso` existe por uma razão concreta.
   *
   * Este painel devolve um spinner enquanto `aCarregar` for verdadeiro — e um
   * spinner no lugar do painel DESMONTA tudo o que está dentro dele, incluindo
   * o formulário de registar pedido e o resumo que ele acabou de mostrar.
   *
   * Resultado: criava-se um pedido, o resumo com o preço e o alcance aparecia
   * durante um instante, e desaparecia junto com o formulário. Quem carregou
   * no botão ficava a olhar para a lista sem saber se tinha corrido bem.
   *
   * Uma actualização que acontece POR CAUSA de uma acção do utilizador não
   * pode apagar o ecrã onde ele está. A lista renova-se por baixo; o que ele
   * está a ler fica.
   */
  const carregar = useCallback(async (silencioso = false, tudo = false) => {
    if (!token) return;
    if (!silencioso) setACarregar(true);
    try {
      /*
       * COM BUSCA ESCRITA, A MESA INTEIRA.
       *
       * A busca filtra o que está carregado, e o que está carregado são os
       * mais recentes. Um trabalho contratado há dois meses não se encontrava
       * por número, por morada, nem por nada — não estava cá.
       */
      const res = await fetch(`/api/admin/negociacoes${tudo ? "?tudo=1" : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setPedidos(dados.pedidos ?? []);
      if (tudo) setTemTudo(true);
      setLidoEm(Date.now());
      setErro("");

      // Os do simulador que ainda não são da plataforma. Falha em silêncio: é
      // uma lista de conveniência, não pode derrubar o painel todo.
      try {
        const r2 = await fetch("/api/admin/negociacoes/promover", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r2.ok) setPorPromover((await r2.json()).pedidos ?? []);
      } catch {
        /* sem lista, o resto continua a servir */
      }
    } catch {
      setErro("Erro de rede.");
    } finally {
      if (!silencioso) setACarregar(false);
    }
  }, [token]);

  /*
   * ACTUALIZAR SEM DAR POR ISSO.
   *
   * Trinta segundos, em silêncio: `carregar(true)` não acende estados de "a
   * carregar", por isso a lista não pisca nem salta e quem está a escrever
   * um valor num campo não o perde. O ciclo pára com o separador escondido e
   * vai buscar mal ele volte — e cala-se quando falha, porque uma falha de
   * rede a meio de uma actualização automática não é notícia para quem está
   * a trabalhar.
   *
   * É a mesma cadência do painel do profissional e da conta do cliente: as
   * três pontas da mesma negociação a ver o mesmo estado ao mesmo tempo.
   */
  /*
   * A BATIDA NÃO ENCOLHE A LISTA POR BAIXO DE QUEM ESTÁ A PROCURAR.
   *
   * Sem o `temTudo`, trinta segundos depois de escrever na caixa a mesa
   * voltava aos mais recentes e o pedido encontrado desaparecia do ecrã — sem
   * nada a explicar porquê.
   */
  /*
   * E PÁRA ENQUANTO ELE ESCREVE UMA NOTA.
   *
   * Sem isto, a lista renovava-se por baixo de uma frase a meio — e o que ele
   * estava a escrever voltava ao que estava.
   */
  useAutoRefresh(() => carregar(true, temTudo), { paused: notaAberta !== null });

  /**
   * GUARDAR A NOTA DE UM PEDIDO.
   *
   * Vai pela rota do pedido, que é a que o ecrã do detalhe já usa: é a mesma
   * coluna, e duas rotas a escrever o mesmo campo acabam com regras
   * diferentes sobre ele.
   *
   * A lista muda ANTES da rede responder. Quem escreve uma nota espera vê-la
   * ficar; meio segundo de espera lê-se como «não guardou». Se falhar, o
   * `carregar` do fim traz a de antes de volta.
   */
  async function guardarNota(id: number, texto: string) {
    if (!token) return;
    const limpo = texto.trim().slice(0, 500);
    setAGuardarNota(true);
    setErro("");
    setPedidos((lista) =>
      lista.map((p) => (p.id === id ? { ...p, notasInternas: limpo || null } : p)),
    );
    try {
      const res = await fetch(`/api/admin/pedidos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notasInternas: limpo || null }),
      });
      if (!res.ok) setErro("Não foi possível guardar a nota.");
      setNotaAberta(null);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGuardarNota(false);
      await carregar(true, temTudo);
    }
  }

  /** Há quanto tempo o que está no ecrã foi lido da base. */
  const quandoFoiLido = (() => {
    if (!lidoEm) return "";
    const seg = Math.round((agoraParaOReloginho - lidoEm) / 1000);
    if (seg < 45) return "actualizado agora";
    const min = Math.round(seg / 60);
    return `actualizado há ${min} min`;
  })();

  useEffect(() => {
    if (ready && token) carregar();
  }, [ready, token, carregar]);

  // Abrir sozinha a negociação que está à espera de nós — uma vez por
  // negociação. Se o profissional contrapuser outra vez, o id é o mesmo e não
  // volta a abrir; o destaque no cartão continua lá a dizer que há resposta
  // por dar.
  useEffect(() => {
    const novas: number[] = [];
    for (const p of pedidos) {
      for (const n of p.negociacoes) {
        if (precisaDeSi(n) && !jaAbertas.current.has(n.id)) {
          jaAbertas.current.add(n.id);
          novas.push(n.id);
        }
      }
    }
    if (novas.length > 0) setAbertas((a) => new Set([...a, ...novas]));
  }, [pedidos]);

  function alternar(id: number) {
    setAbertas((a) => {
      const c = new Set(a);
      if (c.has(id)) c.delete(id);
      else c.add(id);
      return c;
    });
  }

  async function reenviar(
    chave: string,
    corpo: Record<string, unknown>,
  ): Promise<string | null> {
    if (!token) return null;
    setOcupado(chave);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/reenviar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível reenviar.");
        return null;
      }
      // Quando o email não sai, o token vem na resposta — é a única forma de
      // lá chegar, porque na base só existe o hash.
      if (dados.token) {
        setLinksEmClaro((l) => ({ ...l, [chave]: dados.token }));
        /*
         * Guardar QUAL a versão do link que temos na mão.
         *
         * Sem isto, a caixa mostrava um texto para sempre — e qualquer coisa
         * que rodasse o token noutro sítio deixava-a a mentir em silêncio. Foi
         * o que matou o link da D. Sónia: uma proposta da Sthefanny rodou o
         * token três horas antes de ele copiar o que estava no ecrã.
         */
        if (dados.expiraEm) {
          setVersaoDoLink((v) => ({ ...v, [chave]: String(dados.expiraEm) }));
        }
        return dados.token as string;
      }
      setLinksEmClaro((l) => {
        const c = { ...l };
        delete c[chave];
        return c;
      });
      return null;
    } catch {
      setErro("Erro de rede.");
      return null;
    } finally {
      setOcupado(null);
    }
  }

  /*
   * Abrir a página do pedido COMO O CLIENTE A VÊ.
   *
   * Não é uma pré-visualização desenhada à parte: é a página verdadeira,
   * `/pedido/[token]`, aberta noutro separador. Uma cópia "só para ver"
   * divergia da real na primeira alteração à página — e o que interessa é
   * ver EXACTAMENTE o que ele vê.
   *
   * O preço disto: o link é de uso rotativo, e gerar um novo INVALIDA o
   * anterior. Nos pedidos deste ecrã o cliente quase nunca tem link nenhum
   * (chegou por telefone) — mas quando tem, o botão avisa antes.
   */
  /**
   * O LINK PARA ELE MANDAR, e mais nada.
   *
   * "Sempre que clico em VER COMO CLIENTE ele abre para mim e deixa o link
   * visível. Eu copio e envio ao cliente, porém já não serve. Dê-me a opção
   * apenas de gerar link para enviar ao cliente."
   *
   * O link do cliente vive na base só em resumo criptográfico: o texto não se
   * recupera, e por isso QUALQUER pedido de link gera um novo e mata o
   * anterior. Isso é uma boa propriedade — serve para revogar um link
   * reencaminhado por engano — mas transformava «espreitar» num acto
   * destrutivo, e ninguém espera isso de um botão que se chama «ver».
   *
   * Foi o que aconteceu à D. Sónia do #234: ele abriu para conferir, o link
   * que lhe tinha mandado morreu, e ela respondeu «este link já não abre
   * nenhum pedido» — com uma proposta de 170 € à espera do outro lado.
   *
   * Aqui gera-se uma vez, com aviso, e copia-se para a área de transferência
   * no mesmo gesto. É o que ele faz a seguir, todas as vezes.
   */
  async function linkParaOCliente(p: Pedido) {
    const chave = `c${p.id}`;
    if (
      !window.confirm(
        `Gerar o link do pedido #${p.id} para mandar ao cliente?

` +
          `Se já lhe mandou um link antes, esse deixa de funcionar — o novo passa ` +
          `a ser o único que abre este pedido.

` +
          `O email não é enviado: o link fica aqui para copiar.`,
      )
    )
      return;

    const t = await reenviar(chave, { pedidoId: p.id, para: "cliente", paraCopiar: true });
    if (!t) return;

    /*
     * RECARREGAR, OU A CAIXA NUNCA APARECE.
     *
     * "Ele gera o link mas não disponibiliza aqui para copiar e enviar."
     *
     * A caixa só se mostra quando o marcador de versão que temos em mão bate
     * certo com o `linkExpiraEm` da lista. `reenviar` guarda o marcador NOVO —
     * mas a lista continuava com o `linkExpiraEm` ANTIGO, da última vez que
     * foi carregada. As duas datas nunca coincidiam, o ecrã concluía que o
     * link tinha morrido, e escondia exactamente aquilo que ele acabara de
     * gerar. Para sempre, a cada tentativa.
     *
     * O guarda continua a servir para o que foi feito — apanhar um token
     * rodado NOUTRO sítio. Só precisa de comparar com dados frescos.
     */
    await carregar(true);

    try {
      await navigator.clipboard.writeText(`${window.location.origin}/pedido/${t}`);
      setCopiado(chave);
      setTimeout(() => setCopiado((c) => (c === chave ? null : c)), 2500);
    } catch {
      /* Sem área de transferência, fica a caixa por baixo para copiar à mão. */
    }
  }

  /**
   * MANDAR O ORÇAMENTO AO CLIENTE, NUM GESTO.
   *
   * "Coloque nessa tela a opção de enviar o orçamento direto para o cliente."
   * — 11-09-2026, com uma conversa de WhatsApp aberta ao lado onde tinha
   * acabado de prometer resposta «até amanhã às 11h».
   *
   * A mensagem com as propostas já existia e já estava bem escrita, mas só
   * aparecia DEPOIS de carregar em «Link para o cliente», dentro de uma caixa
   * âmbar cujo título fala de emails que não saíram. Para a usar era preciso
   * gerar o link, encontrar a caixa, copiar o texto, abrir o WhatsApp, procurar
   * a conversa e colar. Seis passos, e metade destes clientes nem sequer tem
   * email — o do #303 está marcado «sem email» no próprio ecrã.
   *
   * Agora é um: gera o link, monta a mensagem com as propostas e abre a
   * conversa no WhatsApp com tudo escrito. Ele lê, e carrega em enviar.
   *
   * O QUE ISTO NÃO FAZ: não envia sozinho. O último toque é dele, dentro do
   * WhatsApp, com o texto à frente — uma mensagem a um cliente não sai desta
   * casa sem alguém a ter lido.
   *
   * ⚠️ O SEPARADOR ABRE-SE NO GESTO, E NÃO NO FIM.
   *
   * "Por que o botão «Enviar orçamento» não funciona?" — 21-09-2026.
   *
   * Fazia o trabalho todo e não se via nada. `window.open` só é permitido
   * enquanto o browser ainda se lembra do clique — cinco segundos —, e aqui
   * vinha DEPOIS de uma caixa de confirmação para ler e de duas idas ao
   * servidor, uma delas a recarregar a mesa inteira. Passado esse tempo o
   * Chrome recusa a janela em silêncio: nenhum separador, nenhum erro.
   *
   * E o pior não era o separador que faltava: o link do cliente JÁ tinha sido
   * rodado. Carregar parecia não fazer nada, e tinha feito exactamente a parte
   * destrutiva — o link que ele lhe mandara ontem passava a dar erro.
   *
   * Agora o separador abre-se no instante do clique, com uma linha a dizer que
   * está a ir, e só é levado para a conversa quando a mensagem está pronta. A
   * mesa recarrega no fim, fora do caminho. E se mesmo assim não abrir, diz-se
   * no cartão — a mensagem fica na caixa de baixo, que é o caminho à mão.
   */
  async function enviarOrcamento(p: Pedido) {
    const chave = `c${p.id}`;
    const propostas = propostasParaOCliente(p.negociacoes);
    if (propostas.length === 0) {
      setAvisoDoOrcamento((a) => ({
        ...a,
        [p.id]: "Este pedido ainda não tem nenhuma proposta para mandar ao cliente.",
      }));
      return;
    }

    /*
     * Sem telemóvel que abra no WhatsApp, isto deixou de ser um beco.
     *
     * Antes recusava-se e mandava-se a pessoa usar outro botão. Mas o que vale
     * nesta acção é a MENSAGEM — os valores certos, o imposto dito, o link lá
     * dentro. O WhatsApp é só o transporte. Sem número, prepara-se na mesma e
     * fica à mão para copiar e mandar por SMS, email ou o que for.
     */
    const temNumero = Boolean(numeroParaWhatsApp(p.contactPhone));

    if (
      !window.confirm(
        (temNumero
          ? `Abrir o WhatsApp com o orçamento do pedido #${p.id} escrito?\n\n`
          : `Preparar o orçamento do pedido #${p.id} para copiar?\n\n` +
            `Este cliente não tem um telemóvel que abra no WhatsApp — a mensagem ` +
            `fica aqui em baixo, pronta a copiar.\n\n`) +
          `Gera um link novo do pedido — se já lhe mandou um antes, esse deixa de funcionar.\n\n` +
          `A mensagem não sai sozinha: fica à sua frente para enviar.`,
      )
    )
      return;

    /*
     * O SEPARADOR PRIMEIRO, ainda dentro do gesto — é esta linha que conserta
     * o botão. Vazio por enquanto: leva-se lá a conversa daqui a um segundo.
     *
     * Sem `noopener` de propósito: com ele o browser devolve `null` e ficava-se
     * sem a mão para o levar ao WhatsApp. Corta-se o `opener` logo a seguir,
     * que dá a mesma garantia e deixa-nos a referência.
     */
    const janela = temNumero ? window.open("", "_blank") : null;
    if (janela) {
      try {
        janela.opener = null;
        janela.document.write(
          '<!doctype html><meta charset="utf-8"><title>A abrir o WhatsApp</title>' +
            '<body style="margin:0;display:flex;align-items:center;justify-content:center;' +
            'height:100vh;font:15px system-ui,sans-serif;background:#0f172a;color:#cbd5e1">' +
            "A preparar o orçamento para o WhatsApp…",
        );
        janela.document.close();
      } catch {
        /* Um separador em branco também serve — o que conta é já existir. */
      }
    }

    const t = await reenviar(chave, { pedidoId: p.id, para: "cliente", paraCopiar: true });
    if (!t) {
      /* O erro já está dito por `reenviar`; o separador vazio não fica para trás. */
      janela?.close();
      return;
    }

    const url = `${window.location.origin}/pedido/${t}`;
    const texto = mensagemDasPropostas({
      nomeCliente: p.contactName,
      servico: nomeDoServico(p.serviceType),
      cidade: p.city,
      propostas,
      fechado: trabalhoFechado(p.negociacoes),
      link: url,
    });
    const destino = linkDeWhatsApp(p.contactPhone, texto);

    if (janela && destino) {
      janela.location.href = destino;
      setAvisoDoOrcamento((a) => {
        const c = { ...a };
        delete c[p.id];
        return c;
      });
    } else {
      /*
       * Não abriu — e isso diz-se, em vez de deixar o ecrã calado com o link
       * já rodado. O trabalho não se perdeu: a mensagem está pronta na caixa.
       */
      setAvisoDoOrcamento((a) => ({
        ...a,
        [p.id]: destino
          ? "O browser bloqueou o separador do WhatsApp. A mensagem está pronta aqui em baixo — " +
            "carregue em “Do meu WhatsApp” ou “Copiar mensagem”."
          : "Este cliente não tem um telemóvel que abra no WhatsApp. A mensagem está pronta aqui " +
            "em baixo, para copiar e mandar por onde quiser.",
      }));
    }

    /*
     * A MESA RECARREGA NO FIM, e não a meio.
     *
     * Continua a ser precisa — a caixa da mensagem só se mostra quando o
     * `linkExpiraEm` da lista bate certo com o marcador que acabámos de
     * guardar. Mas é a chamada mais lenta deste ecrã, e tê-la ANTES de abrir o
     * separador era o que fazia o browser esquecer-se do clique.
     */
    await carregar(true);
  }

  /**
   * Espreitar o que o cliente vê — sem matar o link dele.
   *
   * Abre APENAS um link já gerado nesta sessão. Sem ele, deixou de gerar um
   * novo por conta própria: era esse o passo que apagava o link que o cliente
   * tinha na mão, e fazia-o em silêncio, ao carregar num botão que promete
   * mostrar e não mexer.
   */
  /*
   * `verComoCliente` saiu daqui, e não foi arrumação.
   *
   * Era uma função que só sabia dizer que não: abria a página se alguém já
   * tivesse gerado um link nesta sessão, e caso contrário explicava porque é
   * que não podia — porque gerar um link novo mata o do cliente.
   *
   * Deixou de haver nada para explicar. O botão é agora uma ligação para
   * `/admin/pedido/<id>`, que mostra a mesma vista sem token nenhum, provada
   * pela sessão de administrador. Ver deixou de custar o acesso de ninguém.
   */

  async function promover(pedidoId: number, valor?: string) {
    if (!token) return;
    setOcupado(`p${pedidoId}`);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/promover", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        // Sem valor, a partida é a conta da CLYON, feita na rota; com valor,
        // é o que a mesa escreveu.
        body: JSON.stringify({ pedidoId, valor }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível promover.");
        return;
      }
      /*
       * `receberam`, não `avisados`.
       *
       * Este ecrã dizia "não chegou a ninguém" sempre que o email falhava, e o
       * profissional estava com o trabalho aberto no painel dele. São duas
       * avarias diferentes e corrigem-se em sítios diferentes — uma é a regra
       * de alcance, a outra é o Resend.
       */
      if (dados.receberam === 0) {
        const motivos = Object.entries(dados.motivos ?? {})
          .filter(([, n]) => Number(n) > 0)
          .map(([m, n]) => `${m.replace(/_/g, " ")}: ${n}`)
          .join(", ");
        setErro(
          `Promovido, mas não chegou a nenhum de ${dados.candidatos} profissionais activos.` +
            (motivos ? ` Motivos — ${motivos}.` : ""),
        );
      } else if (dados.avisados < dados.receberam) {
        setErro(
          `Chegou a ${dados.receberam} profissional(is), mas ${dados.receberam - dados.avisados} ` +
            `não recebeu o email de aviso. Tem o trabalho no painel e não sabe. Use "Reenviar".`,
        );
      }
      if (dados.link) {
        setLinksEmClaro((l) => ({ ...l, [`c${pedidoId}`]: dados.link.split("/pedido/")[1] }));
      }
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  /**
   * Arquivar um pedido que nunca vai ser enviado.
   *
   * Arquivar e nao apagar, como accao normal do dia a dia. Um pedido arquivado
   * sai desta lista — `pedidosPorPromover` ja exclui o estado "arquivado" — e
   * continua a existir: daqui a tres meses ainda se sabe que houve um pedido de
   * moveis em Almada que ninguem enviou, e o historico do cliente nao muda.
   *
   * Apagar fica para o que nao devia ter existido, e por isso e o botao
   * pequeno e cinzento com a caixa de marcar.
   */
  async function arquivarPedido(id: number) {
    if (!token) return;
    setOcupado(`a${id}`);
    setErro("");
    try {
      const res = await fetch(`/api/admin/pedidos/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}));
        setErro(dados.error ?? "Nao foi possivel arquivar.");
        return;
      }
      await carregar(true);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  /**
   * Arquivar varios de uma vez.
   *
   * Sequencial de proposito: sao pedidos individuais a rota de arquivar, e
   * vinte em paralelo num serverless partilhado e pedir throttling. Quem
   * arquiva um lote de vinte espera dois segundos; quem ve metade falhar em
   * paralelo nao sabe qual metade.
   */
  async function arquivarPedidos(ids: number[]) {
    if (!token || ids.length === 0) return;
    setOcupado("lote-arquivar");
    setErro("");
    let falhados = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/admin/pedidos/${id}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        if (!res.ok) falhados += 1;
      } catch {
        falhados += 1;
      }
    }
    if (falhados > 0) {
      setErro(`${falhados} de ${ids.length} pedido(s) não foram arquivados. Tente de novo os que ficaram.`);
    }
    await carregar(true);
    setOcupado(null);
  }

  /**
   * Apagar pedidos por promover.
   *
   * Mesma rota que apaga os outros: os guardas vivem la — um pedido com
   * trabalho contratado por confirmar recusa-se a sair, e volta na lista de
   * `recusados` com o motivo.
   */
  async function apagarPedidos(ids: number[]) {
    if (!token || ids.length === 0 || !podeApagar) return;
    setAApagar(true);
    setErro("");
    setRecusados([]);
    try {
      const res = await fetch("/api/admin/negociacoes/apagar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Nao foi possivel apagar.");
        setRecusados(dados.recusados ?? []);
        return;
      }
      setRecusados(dados.recusados ?? []);
      await carregar(true);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAApagar(false);
    }
  }

  /**
   * Um pedido fechado que o dono quer voltar a pôr à venda. Fica aqui, e não
   * num `confirm()` do browser, para a pergunta ter o nome do profissional e
   * o botão dizer o que faz.
   */
  const [reabrirPendente, setReabrirPendente] = useState<{
    pedidoId: number;
    nome: string;
  } | null>(null);

  async function redistribuir(pedidoId: number, reabrir = false, voltarAMandar?: number) {
    if (!token) return;
    setOcupado(`r${pedidoId}`);
    setErro("");
    setReabrirPendente(null);
    try {
      const res = await fetch("/api/admin/negociacoes/redistribuir", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pedidoId,
          ...(reabrir ? { reabrir: true } : {}),
          ...(voltarAMandar ? { voltarAMandar } : {}),
        }),
      });
      const dados = await res.json();
      if (!res.ok) {
        /*
         * FECHADO COM ALGUÉM: em vez de um erro, uma pergunta — 21-09-2026.
         * A rota diz com quem está fechado e se se pode reabrir; o cartão
         * mostra o botão «Reabrir e redistribuir» só nesse caso.
         */
        if (res.status === 409 && dados.podeReabrir === true && typeof dados.fechadaCom === "string") {
          setReabrirPendente({ pedidoId, nome: dados.fechadaCom });
          return;
        }
        setErro(dados.error ?? "Não foi possível redistribuir.");
        return;
      }
      if (dados.receberam === 0) {
        // Sem isto, carregar no botão e não acontecer nada parecia avaria.
        // Os motivos vêm da mesma regra que decidiu, portanto são exactos.
        const motivos = Object.entries(dados.motivos ?? {})
          .filter(([, n]) => Number(n) > 0)
          .map(([m, n]) => `${m.replace(/_/g, " ")}: ${n}`)
          .join(", ");
        /*
         * ⚠️ «NINGUÉM NOVO» NÃO É «NINGUÉM».
         *
         * Esta frase dizia «continua sem chegar a ninguém de 9 profissionais
         * activos» quando o pedido estava nas mãos dos nove — só não havia
         * mais nenhum para acrescentar. Lia-se como avaria, e mandava alguém
         * procurar um problema que não existia.
         *
         * O resumo que vai para o histórico já distinguia as duas coisas há
         * dias; era só este ecrã que deitava fora o número.
         */
        const jaTinham = Number(dados.jaTinham ?? 0);
        setErro(
          jaTinham > 0
            ? `Nenhum profissional NOVO para avisar — ${jaTinham} já tinha(m) este pedido e não ` +
              `foi(ram) tocado(s).` + (motivos ? ` Dos restantes: ${motivos}.` : "")
            : `Continua sem chegar a ninguém de ${dados.candidatos} profissionais activos.` +
              (motivos ? ` Motivos — ${motivos}.` : ""),
        );
      } else if (dados.avisados < dados.receberam) {
        setErro(
          `Chegou a ${dados.receberam} profissional(is), mas ${dados.receberam - dados.avisados} ` +
            `não recebeu o email de aviso. Use "Reenviar" na linha dele.`,
        );
      }
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  /*
   * Quem espera por nos sobe ao topo.
   *
   * A ordem era so por data. Um pedido de ha tres dias com uma proposta a
   * expirar ficava debaixo de dois pedidos novos sem nada por fazer — e as 48
   * horas passavam sem ninguem olhar.
   */
  /*
   * "À espera de SI" só é verdade nas negociações da CLYON — nas dos clientes
   * quem tem de responder é o cliente. No modo "clientes" o aviso não existe.
   */
  /*
   * O que a busca deixou passar. Sem termo escrito, é a mesa inteira — a busca
   * só filtra quando há o que procurar.
   *
   * O nome do profissional entra na procura: muita vez o que se tem em mão é
   * «quem é que estava a tratar do da senhora de Cascais».
   */
  const aProcurar = busca.trim().length > 0;

  /*
   * BASTA COMEÇAR A ESCREVER PARA A MESA INTEIRA VIR.
   *
   * "Não encontro esse trabalho." — o #298 estava contratado e por fazer, e
   * a mesa carrega os mais recentes: ele tinha caído do fim da lista, e a
   * busca só filtra o que está carregado.
   *
   * Uma vez por sessão, e não a cada tecla: quem procura escreve, apaga e
   * escreve outra vez, e cada uma dessas teclas seria uma viagem à base.
   */
  useEffect(() => {
    if (aProcurar && !temTudo && token) void carregar(true, true);
  }, [aProcurar, temTudo, token, carregar]);

  const pedidosNaMesa = useMemo(
    () =>
      aProcurar
        ? pedidos.filter((p) =>
            combinaComABusca(
              { ...p, profissionais: p.negociacoes.map((n) => n.profissionalNome) },
              busca,
            ),
          )
        : pedidos,
    [pedidos, busca, aProcurar],
  );
  const porPromoverNaMesa = useMemo(
    () => (aProcurar ? porPromover.filter((p) => combinaComABusca(p, busca)) : porPromover),
    [porPromover, busca, aProcurar],
  );
  const encontrados = pedidosNaMesa.length + porPromoverNaMesa.length;

  const aEsperar =
    mostrar === "clientes"
      ? []
      : pedidosNaMesa.filter(
          (p) => quemNegoceia(p) === "clyon" && p.negociacoes.some(precisaDeSi),
        );
  const ordenados = [...pedidosNaMesa].sort(
    (a, b) =>
      Number(b.negociacoes.some(precisaDeSi)) - Number(a.negociacoes.some(precisaDeSi)),
  );

  /*
   * Tres grupos, e nao uma lista so.
   *
   * Sao tres trabalhos diferentes, com donos diferentes:
   *
   *   · os da CLYON esperam por NOS — se ninguem responder, a proposta expira;
   *   · os dos clientes esperam pelo CLIENTE — intrometermo-nos e tirar-lhe a
   *     negociacao das maos;
   *   · os de baixo ainda nao sairam daqui — nao ha ninguem a espera de nada.
   *
   * Misturados numa lista unica ordenada por data, o primeiro grupo — o unico
   * onde a demora nos custa dinheiro — ficava indistinguivel dos outros.
   */
  /*
   * Os concluídos saem das listas de trabalho — já ninguém espera nada — e
   * ganham prateleira própria em baixo. Um que o admin ainda não tenha
   * ABERTO desde a conclusão fica em destaque: dinheiro que entrou merece
   * ser visto, não descoberto por acaso.
   */
  const cancelados = ordenados.filter((p) => p.status === "cancelado");
  const concluidos = ordenados.filter((p) => p.status !== "cancelado" && pedidoConcluido(p));
  const activos = ordenados.filter(
    (p) => p.status !== "cancelado" && !pedidoConcluido(p),
  );
  const concluidosPorVer = concluidos.filter((p) => !p.concluidoVistoEm).length;
  const daClyon = activos.filter((p) => quemNegoceia(p) === "clyon");
  const dosClientes = activos.filter((p) => quemNegoceia(p) === "cliente");

  /*
   * A LISTA ÚNICA, POR NÍVEL DE QUEM ESPERA.
   *
   * `daClyon` e `dosClientes` continuam a existir — as contagens do topo e o
   * atalho "está à espera de si" lêem-nos — mas deixaram de desenhar duas
   * listas. O que separa agora é de quem é a vez:
   *
   *   1. Precisa de si — há uma proposta pendente e a CLYON é que responde,
   *      OU um trabalho já executado à espera de ser confirmado. É o único
   *      nível onde a demora custa dinheiro: há um profissional à espera de
   *      resposta, e um trabalho por confirmar é dinheiro que fica cativo e um
   *      profissional que já lá foi e ainda não recebeu.
   *   2. À espera de propostas — o pedido saiu e ainda ninguém fechou nada.
   *      É o nível que pode morrer de silêncio: se os profissionais não
   *      responderem, o cliente fica sem resposta e nós não damos por isso.
   *   3. Contratados — já tem profissional e valor fechados; falta o trabalho
   *      acontecer. Não há nada a fazer senão esperar pelo dia.
   *
   * "Temos que separar os pedidos já contratados dos à espera de propostas."
   *
   * Os dois estavam juntos em "A correr" porque nos dois a bola está do outro
   * lado — mas o outro lado não é o mesmo. Num deles o pedido pode morrer
   * sozinho por falta de resposta; no outro está tudo combinado e só falta a
   * data chegar. Misturados, um #242 à espera de dois profissionais lia-se
   * igual a um #239 já fechado com a TRSul, e o que precisava de vigilância
   * desaparecia no meio do que não precisava de nada.
   *
   * Dentro de cada nível, do mais recente para o mais antigo.
   */
  const activosOrdenados = useMemo(() => {
    const visiveis =
      mostrar === "clyon" ? daClyon : mostrar === "clientes" ? dosClientes : activos;
    const porData = (a: Pedido, b: Pedido) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    /*
     * Os que precisam dele partem-se em dois — ver a nota do bloco
     * `porConfirmar`. Um pedido com as duas coisas a acontecer ao mesmo tempo
     * fica no dos feitos: é lá que está o dinheiro preso.
     */
    const precisamDeSi = visiveis.filter((p) => p.negociacoes.some(precisaDeSi)).sort(porData);
    const porConfirmar = precisamDeSi.filter((p) => p.negociacoes.some(esperaConfirmacao));
    const precisam = precisamDeSi.filter((p) => !p.negociacoes.some(esperaConfirmacao));
    const restantes = visiveis.filter((p) => !p.negociacoes.some(precisaDeSi));
    /* Fechado com alguém é outra coisa: já não se espera proposta nenhuma. */
    const contratados = restantes
      .filter((p) => p.negociacoes.some((n) => n.estado === "acordada"))
      .sort(porData);
    const aoAr = restantes
      .filter((p) => !p.negociacoes.some((n) => n.estado === "acordada"))
      .sort(porData);

    const comCoisas = [precisam, aoAr, contratados].filter((l) => l.length > 0).length;

    type Entrada = {
      chave: string;
      separador: boolean;
      titulo?: string;
      quantos?: number;
      nota?: string;
      tom?: string;
      pedido?: Pedido;
    };
    const saida: Entrada[] = [];
    const bloco = (
      chave: string,
      titulo: string,
      nota: string,
      tom: string,
      lista: Pedido[],
    ) => {
      if (lista.length === 0) return;
      // O separador só aparece quando há mais do que um nível para separar:
      // com uma lista só, uma linha a dizer o óbvio é ruído.
      if (comCoisas > 1) {
        saida.push({ chave, separador: true, titulo, quantos: lista.length, nota, tom });
      }
      for (const p of lista) saida.push({ chave: `p${p.id}`, separador: false, pedido: p });
    };
    // "Resposta" ficou curto: um trabalho já feito não espera uma resposta,
    // espera que alguém o reconheça e liberte o dinheiro. As duas coisas
    // param aqui à espera dele, e a nota tem de as caber às duas.
    bloco(
      "porConfirmar",
      "Feitos, à espera de confirmação",
      "o trabalho está feito — falta confirmar para o dinheiro sair",
      "text-amber-300",
      porConfirmar,
    );
    bloco("n1", "Precisa de si", "nada avança sem si", "text-emerald-300", precisam);
    bloco("n2", "À espera de propostas", "a bola está com os profissionais", "text-sky-300", aoAr);
    bloco(
      "n3",
      "Contratados",
      "já têm quem faça — falta o trabalho acontecer",
      "text-violet-300",
      contratados,
    );
    return saida;
  }, [activos, daClyon, dosClientes, mostrar]);

  /*
   * OS BLOCOS DERIVAM-SE DO MEMO, SEM REPETIR A ORDENAÇÃO.
   *
   * O `activosOrdenados` é a regra de ordenação da mesa e está fixada por
   * testes que lêem a fonte — aqui só se distribui o que ele já ordenou. Mas
   * é preciso recontar o nível de cada pedido cá fora: com um nível só o memo
   * não emite separador (`comCoisas > 1`), e os cartões de cima precisam das
   * três contagens na mesma. `nivelDe` usa as DUAS mesmas condições do memo,
   * pela mesma ordem, e tem de andar a par com ele.
   */
  function nivelDe(p: Pedido): "porConfirmar" | "n1" | "n2" | "n3" {
    // Os feitos primeiro, e na mesma ordem do memo acima — as duas listas têm
    // de andar a par, senão os cartões de cima contam uma coisa e os blocos
    // mostram outra.
    if (p.negociacoes.some(esperaConfirmacao)) return "porConfirmar";
    if (p.negociacoes.some(precisaDeSi)) return "n1";
    if (p.negociacoes.some((n) => n.estado === "acordada")) return "n3";
    return "n2";
  }
  const porNivel: Record<"porConfirmar" | "n1" | "n2" | "n3", Pedido[]> = {
    porConfirmar: [],
    n1: [],
    n2: [],
    n3: [],
  };
  for (const e of activosOrdenados) {
    // A ordem interna — mais recente primeiro — vem preservada do memo; as
    // entradas de separador continuam a ser produzidas e deixam de ser desenhadas.
    if (!e.separador && e.pedido) porNivel[nivelDe(e.pedido)].push(e.pedido);
  }
  /*
   * Concluídos e Cancelados não filtram por `mostrar` — mostram os de todos
   * os modos, como já faziam. A arrumação não é de quem negoceia.
   */
  function pedidosDoBloco(chave: Exclude<ChaveDoBloco, "porEnviar">): Pedido[] {
    if (chave === "concluidos") return concluidos;
    if (chave === "cancelados") return cancelados;
    return porNivel[chave];
  }
  function quantosNoBloco(chave: ChaveDoBloco): number {
    return chave === "porEnviar" ? porPromoverNaMesa.length : pedidosDoBloco(chave).length;
  }
  const blocosDoModo = BLOCOS.filter((b) => b.visivelEm(mostrar));
  /*
   * A procurar, mostram-se todos os blocos: o filtro dos cartões esconderia o
   * pedido que se está a procurar, e quem escreve um telefone não sabe em que
   * bloco ele caiu.
   */
  const blocosVisiveis =
    soOBloco && !aProcurar ? blocosDoModo.filter((b) => b.chave === soOBloco) : blocosDoModo;

  /*
   * O cartao de um pedido, desenhado uma vez e usado nos dois grupos.
   *
   * Estava dentro do `.map()` da lista unica. Ao separar as negociacoes da
   * CLYON das dos clientes, o mesmo desenho passou a ser preciso em dois
   * sitios — e duas copias do mesmo JSX divergem sempre: corrige-se uma e
   * esquece-se a outra. Vive aqui dentro do componente de proposito, para
   * continuar a alcancar `ocupado`, `abertas`, `reenviar` e `carregar` sem
   * ter de os passar todos por prop.
   */
  /** O cabeçalho da mesa — as mesmas colunas da linha, com os mesmos px. */
  const cabecalhoDaMesa = (
    <div
      aria-hidden="true"
      className="hidden items-center gap-3 px-4 pb-1 md:grid md:grid-cols-[auto_72px_minmax(0,1fr)_96px_minmax(0,1.5fr)_128px]"
    >
      <span className="w-4" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Pedido</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Cliente</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Pede</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
        Onde está a bola
      </span>
      <span />
    </div>
  );

  function cartaoDoPedido(p: Pedido) {
    const chaveCliente = `c${p.id}`;
    const espera = p.negociacoes.some(esperaResposta);
    const aEsperarLista = p.negociacoes.filter(esperaResposta);
    // O trabalho que já está feito e espera pela confirmação dele.
    const feito = p.negociacoes.find(esperaConfirmacao);
    const acordada = p.negociacoes.find((n) => n.estado === "acordada");
    const quantasAbertas = p.negociacoes.filter((n) => n.estado === "aberta").length;
    const totalPropostas = p.negociacoes.reduce(
      (soma, n) => soma + propostasDe(n.propostasJson).length,
      0,
    );
    /*
     * FECHADO POR OMISSÃO, SEMPRE — decisão dele: "quando faço reset eles
     * ficam mostrando todas as propostas e não quero; tem que ser abertas
     * apenas pelo admin". O auto-abrir dos à-espera trabalhava contra quem
     * lê: o cartão verde do topo já aponta o dedo, e o "Abrir Pedido (N)" da
     * linha abre num toque.
     */
    const aberto = negociacoesVisiveis.has(p.id);
    const cancelado = p.status === "cancelado";
    const concluido = !cancelado && pedidoConcluido(p);
    const porVer = concluido && !p.concluidoVistoEm;
    const alternarAberto = () => {
      // Abrir um concluído por ver É vê-lo: o carimbo grava-se no servidor e
      // o destaque apaga-se — sem botão próprio para "marcar como visto".
      if (porVer && !negociacoesVisiveis.has(p.id) && token) {
        void fetch("/api/admin/negociacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ accao: "concluido_visto", pedidoId: p.id }),
        }).catch(() => {});
        setPedidos((lista) =>
          lista.map((x) =>
            x.id === p.id ? { ...x, concluidoVistoEm: new Date().toISOString() } : x,
          ),
        );
      }
      setNegociacoesVisiveis((v) => {
        const c = new Set(v);
        if (c.has(p.id)) c.delete(p.id);
        else c.add(p.id);
        return c;
      });
    };

    /*
     * "ONDE ESTÁ A BOLA", numa frase.
     *
     * Era isto que faltava ao ecrã: saber qual pedido recebeu proposta, de
     * quem e por quanto, sem abrir nada. A linha di-lo sempre; abrir é para
     * agir, não para descobrir.
     */
    const primeiro = aEsperarLista[0];
    const valorDoPrimeiro = primeiro
      ? (propostasDe(primeiro.propostasJson).at(-1)?.valor ?? null)
      : null;
    const bola = cancelado
      ? {
          tom: "text-slate-500",
          texto: "✕ Cancelado — o cliente desistiu",
        }
      : concluido
      ? {
          tom: "text-emerald-400",
          texto: `✓ Concluído${acordada ? ` — ${euros(acordada.valorAcordado)} com ${acordada.profissionalNome}` : ""}`,
        }
      : feito
      ? {
          // Antes de qualquer outra coisa: o trabalho está FEITO. Uma proposta
          // por responder noutra negociação do mesmo pedido já não interessa —
          // este pedido tem alguém que lá foi, e dinheiro à espera de sair.
          tom: "text-amber-300",
          texto:
            `Trabalho feito por ${feito.profissionalNome} — falta confirmar` +
            (feito.valorAcordado != null ? ` ${euros(feito.valorAcordado)}` : ""),
        }
      : espera
      ? {
          tom: "text-emerald-300",
          texto: `● ${primeiro?.profissionalNome}${
            aEsperarLista.length > 1 ? ` e mais ${aEsperarLista.length - 1}` : ""
          } — ${valorDoPrimeiro != null ? euros(valorDoPrimeiro) : "proposta"} à espera de resposta`,
        }
      : acordada
        ? {
            tom: "text-emerald-400",
            texto: `✓ Acordada por ${euros(acordada.valorAcordado)} com ${acordada.profissionalNome}`,
          }
        : quantasAbertas > 0
          ? {
              tom: "text-sky-300",
              texto: `À espera de ${quantasAbertas} profissiona${quantasAbertas === 1 ? "l" : "is"}`,
            }
          : { tom: "text-slate-500", texto: "Sem acordo — propostas expiradas ou desistidas" };

    return (
      <article
        key={p.id}
        id={`pedido-${p.id}`}
        /*
          O QUE ESTÁ ABERTO É AZUL, e ganha a tudo o resto.

          "Mude a cor da borda do pedido que eu estiver com ele aberto para não
          me confundir, pois fica tudo verde." — 17-09-2026.

          O verde marcava duas coisas ao mesmo tempo — «concluído por ver» e
          «tem proposta à espera de si» — e num bloco de dez pedidos à espera
          era verde de cima a baixo. Aberto um deles, ele crescia para meio
          ecrã com as negociações todas lá dentro, e a borda continuava igual à
          dos outros: quem descia perdia de vista onde tinha entrado.

          O azul não compete com nada nesta lista: o verde é o estado do
          negócio e o azul é onde ELE está. Por isso vem primeiro na cadeia —
          um pedido aberto deixa de mostrar o estado na borda, e não faz falta,
          porque está aberto à frente dele com tudo escrito por dentro.
        */
        className={`scroll-mt-24 rounded-2xl border bg-slate-900 p-4 shadow-sm ${
          aberto
            ? "border-sky-400 ring-2 ring-sky-400/40"
            : porVer
              ? "border-emerald-400 ring-2 ring-emerald-400/40"
              : espera
                ? "border-emerald-500/50 ring-1 ring-emerald-500/20"
                : "border-slate-800"
        }`}
      >
        {/*
          A LINHA DA MESA — opção B, escolhida por ele no canvas.
          Uma grelha por pedido: número, cliente, o que pede, onde está a
          bola, acção. Tudo o resto vive atrás do abrir.
        */}
        <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[auto_72px_minmax(0,1fr)_96px_minmax(0,1.5fr)_128px] md:gap-3">
          <Caixa marcado={marcados.has(p.id)} onMarcar={() => marcar(p.id)} />
          <span className="text-sm font-bold text-white">#{p.id}</span>
          <div className="min-w-0">
            {/*
              O NOME E O NÚMERO, NA MESMA LINHA.

              "Passe a colocar o número à frente dos nomes, para a fácil
              identificação do pedido." — 21-09-2026.

              Metade destes clientes não tem email: a conversa acontece toda no
              WhatsApp, e o que o telemóvel mostra é um número, não um nome.
              Sem ele aqui, encontrar o pedido de quem acabou de escrever era
              abrir a busca e colar — vinte vezes por dia.

              Não quebra: o nome encolhe e o número fica inteiro. Um número
              cortado a meio é pior do que nenhum, porque parece um número.
            */}
            <p className="flex min-w-0 items-baseline gap-2">
              <span className="truncate text-sm font-semibold text-slate-100">
                {p.contactName ?? "—"}
              </span>
              {telefoneLegivel(p.contactPhone) && (
                <span
                  title="Telemóvel do cliente"
                  className="shrink-0 font-mono text-xs tabular-nums text-cyan-300/90"
                >
                  {telefoneLegivel(p.contactPhone)}
                </span>
              )}
            </p>
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
              {/*
                A FASE, derivada e não guardada — e na linha das etiquetas, não
                por baixo do número.

                Esteve na coluna do número, que tem 72 px. "Orçamento enviado"
                não cabe lá: partia-se em duas linhas dentro da pílula e o que
                se via era um botão deformado, não um rótulo. Aqui tem a
                largura da linha inteira e nunca quebra.

                É a mesma etiqueta da lista de Pedidos, calculada pela mesma
                função. Tem de estar à vista de quem pode parar o assistente:
                um assistente a falar de «orçamento enviado» sobre um pedido
                que o painel chama outra coisa não se consegue vigiar.
              */}
              <span
                className={`shrink-0 whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-semibold ${CORES_DA_CATEGORIA_ESCURO[categoriaDoPedido(p)] ?? "border-slate-700 text-slate-400"}`}
              >
                {ETIQUETA_DA_CATEGORIA[categoriaDoPedido(p)]}
              </span>
              {/*
                A ORIGEM COMO ETIQUETA, NÃO COMO GAVETA.

                Decisão dele: "pode mostrar a origem mas não separá-lo por
                isso". Antes, de onde o pedido vinha decidia em que caixa ele
                caía — e quem gere não pergunta de onde veio, pergunta o que
                falta fazer. Agora é um rótulo pequeno, ao lado da cidade.
              */}
              <span className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                {ORIGEM[p.origem ?? "simulador"] ?? "Simulador"}
              </span>
              <span className="truncate">
                {p.city ?? "—"} · {p.serviceType ?? "—"}
                {!p.contactEmail && " · sem email"}
              </span>
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-slate-200">
            {p.valorDesejadoCliente ? euros(p.valorDesejadoCliente) : "—"}
          </span>
          <div className="min-w-0">
            <p className={`truncate text-sm ${bola.tom}`}>{bola.texto}</p>
            <p className="text-xs text-slate-500">
              {p.negociacoes.length} profissiona{p.negociacoes.length === 1 ? "l" : "is"} ·{" "}
              {totalPropostas} proposta{totalPropostas === 1 ? "" : "s"}
              {/*
                «Porquê?» — a pergunta que ele teve de me fazer.

                A mesa dizia «1 profissional · 1 proposta» e calava-se. A
                resposta existia, mas só se chegava lá a correr a regra à mão
                contra a base de dados.

                É um pedido de cada vez, e só quando alguém pergunta: calcular
                o alcance é medir a distância de cada profissional a cada
                pedido, e a lista tem dezenas.
              */}
              {p.negociacoes.length > 0 && (
                <>
                  {" · "}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void porquePoucos(p.id);
                    }}
                    className="font-semibold text-cyan-400 underline decoration-cyan-700 underline-offset-2 hover:text-cyan-300"
                  >
                    {alcances[p.id] === "a-ler" ? "a ver…" : "porquê?"}
                  </button>
                </>
              )}
            </p>
            {typeof alcances[p.id] === "string" && alcances[p.id] !== "a-ler" && (
              <p className="mt-1 text-xs leading-relaxed text-amber-300/90">{alcances[p.id]}</p>
            )}
          </div>
          <button
            onClick={alternarAberto}
            aria-expanded={aberto}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
              espera
                ? "bg-emerald-700 text-white hover:bg-emerald-600"
                : "border border-slate-700 text-slate-300 hover:bg-slate-800/60"
            }`}
          >
            {espera
              ? `Abrir Pedido (${aEsperarLista.length})`
              : aberto
                ? "Fechar"
                : "Abrir"}
          </button>
        </div>

        {/*
          A NOTA DO PEDIDO — à vista na linha, sem abrir nada.

          "O Sr. Rui Santos pediu para esperar até segunda para tomar uma
          decisão; se tivesse como colocarmos uma etiqueta no pedido dele ou
          uma anotação, seria mais fácil." — 19-09-2026.

          É a MESMA coluna que o ecrã do pedido já escrevia (`notasInternas`) e
          não um campo novo: duas notas sobre a mesma coisa acabam a dizer
          coisas diferentes, e a que fica por ler é sempre a que tinha a
          informação.

          Âmbar, e não a cor de um estado: isto não é o que o pedido É, é o que
          nós sabemos sobre ele. Sobre o bloco verde de quem espera por si, uma
          linha âmbar lê-se como um papel colado por cima — que é exactamente
          o que ela é.
        */}
        {notaAberta === p.id ? (
          <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-2.5">
            <textarea
              value={rascunhoDaNota}
              onChange={(e) => setRascunhoDaNota(e.target.value)}
              onKeyDown={(e) => {
                // Enter guarda, Shift+Enter muda de linha. Uma nota é uma
                // linha; obrigar ao rato para a gravar é um passo a mais.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void guardarNota(p.id, rascunhoDaNota);
                }
                if (e.key === "Escape") setNotaAberta(null);
              }}
              rows={2}
              autoFocus
              maxLength={500}
              placeholder="Ex.: pediu para esperar até segunda-feira"
              className="w-full resize-none rounded-lg border border-slate-600 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <button
                onClick={() => void guardarNota(p.id, rascunhoDaNota)}
                disabled={aGuardarNota}
                className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {aGuardarNota ? "A guardar…" : "Guardar"}
              </button>
              <button
                onClick={() => setNotaAberta(null)}
                disabled={aGuardarNota}
                className="rounded-lg border border-slate-600 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              {p.notasInternas && (
                <button
                  onClick={() => void guardarNota(p.id, "")}
                  disabled={aGuardarNota}
                  className="text-[11px] text-slate-500 underline hover:text-red-300 disabled:opacity-50"
                >
                  Apagar a nota
                </button>
              )}
              <span className="ml-auto text-[10px] text-slate-500">
                A mesma nota do ecrã do pedido.
              </span>
            </div>
          </div>
        ) : p.notasInternas ? (
          <button
            onClick={() => {
              setRascunhoDaNota(p.notasInternas ?? "");
              setNotaAberta(p.id);
            }}
            className="mt-2 flex w-full items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-2.5 py-1.5 text-left transition hover:border-amber-400/50"
          >
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
            <span className="whitespace-pre-line break-words text-xs leading-relaxed text-amber-200/90">
              {p.notasInternas}
            </span>
          </button>
        ) : (
          <button
            onClick={() => {
              setRascunhoDaNota("");
              setNotaAberta(p.id);
            }}
            className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600 transition hover:text-amber-300"
          >
            <StickyNote className="h-3 w-3" aria-hidden="true" />
            Anotar
          </button>
        )}

        {aberto && (
          <>
        {/*
          AS CONTAS APARECEM AO FECHAR O NEGÓCIO, E NÃO SÓ NO FIM — 19-09-2026.

          "Após aceitar uma proposta deveria ter a opção de gerar referências
          para pagamento dos valores."

          Este bloco — as contas e o botão de cobrar — só existia quando o
          trabalho já estava CONCLUÍDO. Mas é no instante em que o negócio
          fecha que o valor deixa de mudar, e é aí que se cobra: a CLYON
          recebe, guarda, e paga ao profissional depois de o trabalho estar
          feito e confirmado. Esperar pelo fim para pedir o dinheiro é ficar
          sem a garantia que o modelo inteiro assenta em ter.

          O que continua preso ao concluído é a AVALIAÇÃO, lá em baixo: pedir
          uma nota sobre um trabalho que ainda não aconteceu não faz sentido
          nenhum.
        */}
        {acordada && acordada.valorAcordado != null && (
          // O dinheiro completo, à cabeça: o que o cliente paga, a taxa, o
          // que o profissional recebe. Abrir um trabalho fechado é para
          // conferir contas — não para as reconstruir proposta a proposta.
          <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3 text-sm">
            <p className="font-semibold text-emerald-300">
              {concluido
                ? `Trabalho concluído com ${acordada.profissionalNome}`
                : `Fechado com ${acordada.profissionalNome} — falta o trabalho acontecer`}
            </p>
            {(() => {
              /*
                QUEM RECEBE O QUÊ, e não um total só.

                "O IVA quem cobra são os pros." Dizia "o cliente paga 387 €
                (IVA 69 € + taxa 18 €)" e lia-se como se a CLYON cobrasse o
                imposto. Não cobra: o IVA é do profissional, vai na factura
                dele, e é a ele que o cliente o paga. O que vai à CLYON é só a
                taxa. Separa-se, para o dinheiro se ler como circula.
              */
              const emDinheiro = lerForma(acordada.formaDePagamento) === "dinheiro";
              const taxasDela = taxasDaNegociacao(acordada);
              const conta = contaDoCliente(
                Number(acordada.valorAcordado),
                taxasDela,
              );
              /*
                AS DUAS FACTURAS, com o número de cada uma — 14-09-2026.

                "O cliente pagou 107,52 mas a factura é de apenas 103,32." A
                diferença eram os 4,20 € de taxa, que o cliente pagava e que
                não apareciam em documento nenhum. A CLYON passou a assumir as
                facturas, e esta linha passa a dizer QUEM FACTURA O QUÊ — que é
                a pergunta que se faz aqui e para a qual era preciso ir buscar
                uma calculadora.
              */
              return (
                <p className="mt-1 text-slate-300">
                  {/*
                    A CONTA DITA PELA ORDEM EM QUE SE FAZ — 22-09-2026.

                    "Essas telas estão muito confusas e erradas. Temos que ser
                    simples e directo para mesmo um senhor de 80 anos
                    entender: valor do trabalho mais taxa 5 % = X, mais IVA
                    caso deseje 23 % = Y."

                    Estava tudo numa linha só com nove números e duas
                    facturas: «o cliente paga 47,77 €, em duas facturas —
                    45,00 € do profissional (isento de IVA) e 2,77 € da CLYON
                    (taxa 2,25 € + IVA 0,52 €)». Para saber quanto o cliente
                    tinha de transferir era preciso uma calculadora.

                    Agora são duas somas, escritas com os sinais à vista.
                  */}
                  Trabalho <strong>{euros(conta.servico)}</strong>
                  {" + taxa "}{pct(taxasDela.cliente)}{" "}
                  <strong>{euros(conta.taxa)}</strong>
                  {" = "}
                  <strong className="text-slate-100">{euros(conta.semIva)}</strong> a pagar
                  {" · com factura, + IVA "}{pct(TAXA_IVA)}{" "}
                  <strong>{euros(conta.iva)}</strong>
                  {" = "}
                  <strong className="text-slate-100">{euros(conta.total)}</strong>
                  {" · "}o profissional recebe{" "}
                  <strong>{euros(quantoOProfissionalRecebe(Number(acordada.valorAcordado), taxasDela))}</strong>
                  {/*
                    A COMISSÃO, SEM A REPARTIÇÃO — 22-09-2026.

                    Dizia «comissão CLYON 4,95 € (2,25 € do cliente + 2,70 € a
                    facturar ao profissional)». Os dois números estão certos e
                    estavam a mais: a caixa de confirmar, logo por baixo, já
                    diz de onde vem a comissão, e esta linha só precisa de
                    dizer quanto é.

                    Em dinheiro fica a ressalva, porque aí o caminho do
                    dinheiro é outro: o profissional recebe em mão e a CLYON
                    cobra ao cliente por referência.
                  */}
                  {emDinheiro
                    ? ` · em dinheiro: ele recebe ${euros(Number(acordada.valorAcordado))} em mão e a CLYON cobra ${euros(conta.taxa)} ao cliente por referência`
                    : ` · fica para a CLYON ${euros(comissaoDaClyon(Number(acordada.valorAcordado), taxasDela))}`}
                </p>
              );
            })()}

            {/*
              COBRAR O CLIENTE — 18-09-2026.

              "Vamos colocar apenas para o admin gerar as referências e enviar
              individualmente para cada pedido."

              Fica AQUI, no bloco do trabalho fechado, e não numa secção
              própria: a pergunta «quanto é que este cliente tem a pagar»
              responde-se três linhas acima, e é essa conta que a referência
              vai cobrar. Noutro ecrã era preciso trazer o número na cabeça.

              Fechado por omissão — ver o componente. Abrir um trabalho
              concluído é, na maior parte das vezes, para conferir contas.
            */}
            {(() => {
              /*
                AS TAXAS DESTA NEGOCIAÇÃO, e não as de hoje — 21-09-2026. Era
                daqui que saía o número da referência euPago sem taxas, ou
                seja, com as constantes: num trabalho em dinheiro pedia
                126,00 € a quem já tinha dado 120,00 € em notas.
              */
              const taxasDela = taxasDaNegociacao(acordada);
              const emDinheiro = lerForma(acordada.formaDePagamento) === "dinheiro";
              const acrescimo = Number(acordada.acrescimoPagamento ?? 0) || 0;
              const conta = contaDoCliente(
                Number(acordada.valorAcordado),
                taxasDela,
                acrescimo,
              );
              const soAClyon = Math.round((conta.taxa + conta.acrescimo) * 100) / 100;
              return (
                <GerarReferencia
                  negociacaoId={acordada.id}
                  telefoneDoCliente={p.contactPhone ?? null}
                  precisaFatura={Boolean(p.precisaFatura)}
                  semFactura={emDinheiro ? soAClyon : conta.semIva}
                  comFacturaValor={
                    emDinheiro ? Math.round((soAClyon + conta.ivaDaTaxa) * 100) / 100 : conta.total
                  }
                />
              );
            })()}

            {/*
              A NOTA DO PROFISSIONAL, aqui e não noutro sítio.

              É o único ecrã onde alguém olha para um trabalho já feito, e o
              único momento em que a memória do que correu bem ainda está
              fresca. Pedi-la noutra altura é pedi-la a quem já não se lembra.

              E SÓ DEPOIS DE CONCLUÍDO — 19-09-2026, quando este bloco passou a
              aparecer logo ao fechar o negócio. Pedir uma nota sobre um
              trabalho que ainda não aconteceu não faz sentido nenhum.
            */}
            {!concluido ? null : acordada.avaliadoEm ? (
              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-300">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                {acordada.estrelas} de 5 · avaliado a {quando(acordada.avaliadoEm)}
              </p>
            ) : clyonPodeConfirmar(p) ? (
              <AvaliarPelaClyon
                negociacaoId={acordada.id}
                pedidoId={p.id}
                profissionalNome={acordada.profissionalNome}
                onMudou={() => carregar(true)}
              />
            ) : (
              <p className="mt-2.5 text-xs text-slate-500">
                Por avaliar — a nota é do cliente, que recebeu o link.
              </p>
            )}
          </div>
        )}
        {/*
          O TRABALHO FEITO, À CABEÇA DO CARTÃO.

          Isto existia — a prova, as contas, o botão que fecha o trabalho —
          mas vivia dentro da negociação, atrás de um segundo toque no nome do
          profissional. Abrir o pedido não chegava: o cartão do #226 mostrava
          quatro linhas de nomes e estados e nem uma palavra sobre a Sthefanny
          já lá ter ido.

          "Deveria ver com as opções de confirmação de conclusão e os detalhes
          acordados, e um botão para que eu, caso fale com o cliente e ele
          confirme a conclusão, possa fechar o pedido 100%."

          O botão é o mesmo — é ele que grava `confirmadoEm`, que fecha o
          pedido, que liberta o dinheiro do profissional e que lhe manda o
          email a dizer que já pode contar com ele. Só mudou de sítio: agora
          está onde a pergunta se faz.
        */}
        {feito && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
            <p className="text-sm font-semibold text-amber-200">
              {feito.profissionalNome} deu o trabalho por feito
            </p>
            <p className="mt-0.5 text-xs text-amber-200/70">
              {feito.execucaoEnviadaEm ? `Prova enviada a ${quando(feito.execucaoEnviadaEm)}. ` : ""}
              {PROMESSA.backofficeAConfirmar}
            </p>

            {/* A prova, sem ter de a ir procurar: clicar abre a fotografia. */}
            {(() => {
              const prova = provaDe(feito.provaJson);
              if (!prova) return null;
              return (
                <>
                  {prova.nota && (
                    <p className="mt-2 text-xs italic text-slate-300">&ldquo;{prova.nota}&rdquo;</p>
                  )}
                  {prova.fotos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {prova.fotos.map((url, i) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setAVer({ lista: prova.fotos, i })}
                          aria-label={`Ver prova ${i + 1}`}
                        >
                          {/* Foto, video ou PDF — a especie decide-se em `Anexo.tsx`. */}
                          <Miniatura
                            url={url}
                            className="h-16 w-16 ring-1 ring-slate-700 transition hover:ring-cyan-500"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            {clyonPodeConfirmar(p) ? (
              <ConfirmarPelaClyon
                negociacaoId={feito.id}
                pedidoId={p.id}
                valorAcordado={feito.valorAcordado != null ? Number(feito.valorAcordado) : null}
                taxas={taxasDaNegociacao(feito)}
                onMudou={() => carregar(true)}
              />
            ) : (
              // Nem sempre é ele que confirma. Quando o cliente tem email,
              // recebeu o link e é dele a decisão — dizer porquê é melhor do
              // que mostrar um botão que a rota recusa com 403.
              <p className="mt-2.5 rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
                {porqueNaoPodeConfirmar({
                  origem: p.origem ?? null,
                  contactEmail: p.contactEmail ?? null,
                })}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
          <button
            onClick={() => setAEditarPlataforma(p.id)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Editar pedido
          </button>
          {/*
            REDISTRIBUIR, À VISTA E EM QUALQUER ESTADO — 21-09-2026.

            "Eu quero redistribuir esse pedido, mude o botão «Ficha e
            distribuição» para fazer isso."

            O botão de redistribuir já existia, mas só aparecia quando NINGUÉM
            tinha sido notificado — o caso raro. No caso comum (chegou a oito,
            dois responderam, nenhum serve) o dono via «Ficha e distribuição»,
            abria a ficha, e não encontrava lá o botão. O que se pedia era
            «mandar a mais gente», e é isso que o botão passa a fazer daqui.

            O que acontece ao carregar depende do pedido, e a resposta diz-o:
            quem já tem a negociação aberta não é tocado; quem a perdeu para
            outro (morta) volta a recebê-la; quem disse que não (desistida)
            fica em paz. E um pedido FECHADO não se redistribui — a rota
            recusa e diz com quem está fechado e o que fazer primeiro.
          */}
          <button
            onClick={() => redistribuir(p.id)}
            disabled={ocupado === `r${p.id}`}
            title="Voltar a enviar este pedido aos profissionais elegíveis que ainda não o têm"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60 disabled:opacity-50"
          >
            {ocupado === `r${p.id}` ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Redistribuir
          </button>
          <button
            onClick={() => setAEditar(p.id)}
            title="A ficha completa do backoffice — inclui o histórico"
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
          >
            Ficha
          </button>
          {reabrirPendente?.pedidoId === p.id && (
            <div className="basis-full rounded-lg border border-amber-500/40 bg-amber-950/30 p-3">
              <p className="text-xs leading-relaxed text-amber-200">
                Este pedido está fechado com <strong>{reabrirPendente.nome}</strong>. Reabrir
                desfaz esse fecho em nome do cliente — fica no histórico com o seu nome — e põe o
                pedido outra vez na fila de todos os profissionais elegíveis,{" "}
                <strong>incluindo {reabrirPendente.nome}</strong>. A proposta dele desaparece: a
                negociação recomeça do zero.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => redistribuir(p.id, true)}
                  disabled={ocupado === `r${p.id}`}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Reabrir e redistribuir
                </button>
                <button
                  onClick={() => setReabrirPendente(null)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-200/80 hover:bg-amber-900/40"
                >
                  Deixar como está
                </button>
              </div>
            </div>
          )}
          {/*
            GERAR O LINK, que é o que ele faz noventa por cento das vezes.

            Vem antes de «ver» de propósito: é a acção real, e a outra é a
            curiosidade. Copia no mesmo gesto — copiar era sempre o passo a
            seguir, e obrigá-lo a caçar a caixa por baixo era um passo a mais
            no meio de uma conversa de WhatsApp.
          */}
          {/*
            ENVIAR O ORÇAMENTO, que é o fim de toda esta mesa.

            Vem antes de «Link para o cliente» porque é a acção de que ele
            precisa quando tem uma proposta em mão e um cliente à espera. O
            link sozinho obriga-o a escrever a mensagem à volta; isto abre a
            conversa com ela feita.

            Só aparece quando há mesmo uma proposta — um botão que promete
            mandar um orçamento e abre o WhatsApp com uma mensagem vazia é
            pior do que não existir.
          */}
          {propostasParaOCliente(p.negociacoes).length > 0 && (
            <button
              onClick={() => enviarOrcamento(p)}
              disabled={ocupado === `c${p.id}`}
              title={
                numeroParaWhatsApp(p.contactPhone)
                  ? "Gera o link e abre o WhatsApp com as propostas escritas. Não envia sozinho."
                  : "Sem WhatsApp neste cliente: prepara a mensagem aqui em baixo, para copiar"
              }
              className="flex items-center gap-1.5 rounded-lg border border-emerald-600/60 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {ocupado === `c${p.id}` ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Enviar orçamento
            </button>
          )}
          <button
            onClick={() => linkParaOCliente(p)}
            disabled={ocupado === `c${p.id}`}
            title="Gera o link do pedido para lhe mandar por WhatsApp ou SMS. O anterior deixa de funcionar."
            className="flex items-center gap-1.5 rounded-lg border border-cyan-700/60 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {ocupado === `c${p.id}` ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : copiado === `c${p.id}` ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copiado === `c${p.id}` ? "Copiado" : "Link para o cliente"}
          </button>
          {/*
            VER SEM GASTAR O LINK DO CLIENTE.

            Este botão esteve cinzento até alguém gerar um link de propósito, e
            a razão era boa: o acesso do cliente vive só em hash, abrir a página
            dele obrigava a emitir um token novo, e cada token novo MATA o
            anterior. Espreitar aqui partia o link que ele tem no email.

            Deixou de precisar de token nenhum. `/admin/pedido/<id>` mostra a
            MESMA vista, provada pela sessão de administrador — que é prova
            melhor do que um token, e que não se gasta. Abre noutro separador
            para não perder a mesa de quem está a trabalhar.
          */}
          <a
            href={`/admin/pedido/${p.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Abre o pedido como o cliente o vê. Não gera link nenhum e não altera nada."
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Ver como o cliente
          </a>
          {/*
            CANCELAR — o cliente desistiu e o trabalho não vai acontecer.

            O #225 é o caso: duas propostas na mesa, 250 € e 350 €, e o Sr. Rui
            a responder pelo WhatsApp que arranjou mais barato. Sem isto, o
            pedido ficava em "A correr" ao lado dos contratados, como se ainda
            houvesse alguém a decidir, e o profissional com a proposta aberta
            continuava à espera de uma resposta que nunca ia chegar.

            Discreto de propósito: não é um passo do trabalho, é a saída. E não
            aparece em concluídos nem em já-cancelados, onde não faz nada.
          */}
          {!concluido && !cancelado && (
            <button
              onClick={() => setACancelar(p)}
              disabled={ocupado === `x${p.id}`}
              title="O cliente desistiu — encerra as negociações e tira o pedido da mesa, sem o apagar"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
            >
              {ocupado === `x${p.id}` ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Cancelar pedido
            </button>
          )}
          <button
            onClick={() => reenviar(chaveCliente, { pedidoId: p.id, para: "cliente" })}
            disabled={ocupado === chaveCliente}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {ocupado === chaveCliente ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Reenviar ao cliente
          </button>
        </div>

        {/*
          O QUE ACONTECEU AO ORÇAMENTO, À VISTA DE QUEM CARREGOU.

          No cartão, e não no topo do painel: quem carrega em «Enviar
          orçamento» está a meio de uma lista longa, e um aviso a cinquenta
          linhas de distância é um aviso que ninguém lê.
        */}
        {avisoDoOrcamento[p.id] && (
          <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
            {avisoDoOrcamento[p.id]}
          </p>
        )}

        {/*
          O LINK, E SE AINDA ESTÁ VIVO.

          "Continua a dar erro." E dava: o link que ele copiou do ecrã já
          estava morto há três horas. Uma proposta da Sthefanny tinha rodado o
          token — cada aviso de proposta a um cliente sem conta gera um link
          novo, e cada link novo mata o anterior — e a caixa continuou a
          mostrar o velho, sem nada que o denunciasse.

          Comparar a validade resolve-o com exactidão: cada token novo põe uma
          data nova, por isso datas diferentes são tokens diferentes. Se a que
          temos em mão já não é a da base, o link morreu, e diz-se em vez de o
          deixar copiar.
        */}
        {linksEmClaro[chaveCliente] &&
          versaoDoLink[chaveCliente] &&
          p.linkExpiraEm &&
          String(p.linkExpiraEm) !== versaoDoLink[chaveCliente] && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-200">
                Este link já não serve — foi substituído entretanto.
              </p>
              <p className="mt-0.5 text-xs text-amber-300/80">
                Um profissional respondeu e o aviso ao cliente gerou um link novo, que matou
                este. Carregue em &ldquo;Link para o cliente&rdquo; e mande o novo.
              </p>
            </div>
          )}

        {linksEmClaro[chaveCliente] &&
          (!versaoDoLink[chaveCliente] ||
            !p.linkExpiraEm ||
            String(p.linkExpiraEm) === versaoDoLink[chaveCliente]) && (
          <LinkEmClaro
            caminho={`/pedido/${linksEmClaro[chaveCliente]}`}
            telefone={p.contactPhone}
            token={token}
            mensagem={mensagemDasPropostas({
              nomeCliente: p.contactName,
              servico: nomeDoServico(p.serviceType),
              cidade: p.city,
              propostas: propostasParaOCliente(p.negociacoes),
              fechado: trabalhoFechado(p.negociacoes),
              link: `${typeof window !== "undefined" ? window.location.origin : "https://clyon.pt"}/pedido/${linksEmClaro[chaveCliente]}`,
            })}
            /*
              Duas historias, duas frases. "O email nao saiu" para quem NAO TEM
              email poe quem le a procurar uma avaria de envio que nao existe —
              nao ha para onde enviar, e o remedio e outro: mandar por WhatsApp.
            */
            aviso={
              p.contactEmail?.trim()
                ? "O email não saiu. Use este link."
                : "Este cliente não tem email — mande-lhe o link por WhatsApp ou SMS. Abre o pedido dele sem palavra-passe."
            }
          />
        )}

        <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
          {p.negociacoes.length === 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs font-semibold text-amber-200">
                Nenhum profissional foi notificado.
              </p>
              <p className="mt-0.5 text-xs text-amber-300">
                O histórico do pedido diz o motivo — categoria, distância, fatura ou
                guia. Depois de corrigir, redistribua.
              </p>
              <button
                onClick={() => redistribuir(p.id)}
                disabled={ocupado === `r${p.id}`}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {ocupado === `r${p.id}` ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Redistribuir
              </button>
            </div>
          )}
          {/* As negociações, direitas — a linha da mesa já resumiu; aqui
              vê-se QUEM fez cada proposta e os VALORES, como ele pediu. */}
          {p.negociacoes.map((n) => {

            const chave = `n${n.id}`;
            return (
              <div key={n.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* A linha inteira abre a troca — o alvo do rato é a
                      linha, não um triângulo de doze píxeis. */}
                  <button
                    onClick={() => alternar(n.id)}
                    aria-expanded={abertas.has(n.id)}
                    className="flex flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-800/60"
                  >
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                        abertas.has(n.id) ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium text-slate-100">
                      {n.profissionalNome}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        ESTADO_CLS[n.estado] ?? "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {n.estado}
                    </span>
                    {precisaDeSi(n) && (
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                          esperaConfirmacao(n)
                            ? "bg-amber-500/20 text-amber-200"
                            : "bg-emerald-500/20 text-emerald-200"
                        }`}
                      >
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {oQueFalta(n)}
                      </span>
                    )}
                    {/*
                      E QUANDO O PRAZO PASSOU, DIZ-SE.

                      Tirar a proposta caduca do «espera resposta» é metade do
                      trabalho; a outra é não deixar a linha calada. Sem isto,
                      o cartão passava a mostrar só «aberta» e ninguém
                      percebia que tinha havido ali um valor.
                    */}
                    {propostaExpiradaDele(n) && (
                      <span className="flex items-center gap-1 rounded-full bg-slate-700/60 px-2 py-0.5 text-xs font-semibold text-slate-400">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        proposta expirada
                      </span>
                    )}
                    {/*
                      O valor em cima da mesa, SEMPRE — e de quem é. Era isto
                      que faltava: sabia-se que havia "1 proposta" e não se via
                      o número sem abrir a troca.
                    */}
                    {(() => {
                      const ultima = propostasDe(n.propostasJson).at(-1);
                      if (n.valorAcordado) {
                        return (
                          <span className="text-xs font-semibold text-emerald-300">
                            {euros(n.valorAcordado)}
                          </span>
                        );
                      }
                      if (!ultima) return null;
                      return (
                        <span className="text-xs text-slate-300">
                          {euros(ultima.valor)}{" "}
                          <span className="text-slate-500">
                            ({ultima.por === "profissional" ? "dele" : "nosso"})
                          </span>
                        </span>
                      );
                    })()}
                    <span className="text-xs text-slate-600">
                      {propostasDe(n.propostasJson).length} proposta
                      {propostasDe(n.propostasJson).length === 1 ? "" : "s"}
                    </span>
                  </button>
                  {/*
                    VOLTAR A MANDAR A QUEM JÁ SAIU.

                    "Ele foi para recusados mas devia voltar para a fila para
                    todos." — 22-09-2026.

                    «Reenviar» manda o link da negociação como ela está: a quem
                    saiu, isso é um email para um ecrã que diz que já não é
                    para ele. Isto põe-no outra vez na fila — e é a
                    distribuição que decide se ele continua elegível.

                    Vive na linha DELE e não no botão geral de propósito: a
                    regra de que quem recusou fica em paz mantém-se para a
                    distribuição automática. Isto é uma pessoa a decidir sobre
                    um caso que está a ver.
                  */}
                  {(n.estado === "desistida" || n.estado === "morta") && (
                    <button
                      onClick={() => redistribuir(p.id, false, n.id)}
                      disabled={ocupado === `r${p.id}`}
                      title={`Põe o pedido outra vez na fila de ${n.profissionalNome}, com um link novo.`}
                      className="flex items-center gap-1.5 rounded-lg border border-cyan-700/60 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
                    >
                      {ocupado === `r${p.id}` ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      )}
                      Voltar a mandar
                    </button>
                  )}
                  <button
                    onClick={() =>
                      reenviar(chave, { pedidoId: p.id, negociacaoId: n.id })
                    }
                    disabled={ocupado === chave}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-400 hover:bg-slate-800/60 disabled:opacity-50"
                  >
                    {ocupado === chave ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <Mail className="h-3 w-3" aria-hidden="true" />
                    )}
                    Reenviar
                  </button>
                </div>
                {linksEmClaro[chave] && (
                  <LinkEmClaro
                    caminho={`/profissionais/pedidos/${linksEmClaro[chave]}`}
                    aviso="O email não saiu. Use este link."
                  />
                )}

                {abertas.has(n.id) && (
                  <TrocaDePropostas
                    negociacao={n}
                    pedidoId={p.id}
                    onVerFotos={(lista, i) => setAVer({ lista, i })}
                    podeConfirmar={clyonPodeConfirmar(p)}
                    onMudou={carregar}
                  />
                )}
              </div>
            );
          })}

        </div>
          </>
        )}
      </article>
    );
  }

  function marcar(id: number) {
    setMarcados((m) => {
      const c = new Set(m);
      if (c.has(id)) c.delete(id);
      else c.add(id);
      return c;
    });
  }

  /**
   * Arquiva os que estao marcados.
   *
   * Pergunta, como o apagar — mas com outras palavras, porque nao e a mesma
   * coisa. Arquivar tira da mesa; apagar tira do mundo. Confundir os dois num
   * so aviso e como escrever "tem a certeza?" nos dois e esperar que quem le
   * saiba a diferenca de cor.
   */
  async function arquivarMarcados() {
    if (!token || marcados.size === 0) return;
    const quantos = marcados.size;
    if (
      !window.confirm(
        `Arquivar ${quantos} pedido${quantos === 1 ? "" : "s"}?

` +
          `Saem da mesa e ficam no backoffice, com o histórico inteiro. ` +
          `Não são apagados.`,
      )
    )
      return;
    await arquivarPedidos([...marcados]);
    setMarcados(new Set());
  }

  /**
   * REENVIAR OS MARCADOS AOS PROFISSIONAIS.
   *
   * "Eu marquei, agora preciso da opção de reenviar pedido." — 12-09-2026,
   * depois de acrescentar profissionais novos que nunca viram os pedidos
   * parados. Um a um eram sete visitas à ficha de cada pedido.
   *
   * UM DE CADA VEZ, e não em paralelo: cada redistribuição mede a distância de
   * cada profissional ao pedido e manda emails. Seis ao mesmo tempo num
   * serverless partilhado é pedir throttling — e quem vê metade falhar em
   * paralelo não sabe qual metade. É a mesma decisão que o arquivar em lote já
   * tinha tomado.
   *
   * NÃO TOCA EM QUEM JÁ TEM O PEDIDO. Isso é garantido do lado do servidor
   * desde 12-09-2026 — antes disso, redistribuir mandava a toda a gente um
   * link novo que nunca era gravado, e o link antigo deles morria. Ver
   * `distribuir-pedido.ts`.
   */
  async function redistribuirMarcados() {
    if (!token || marcados.size === 0) return;
    const ids = [...marcados];
    if (
      !window.confirm(
        `Reenviar ${ids.length} pedido${ids.length === 1 ? "" : "s"} aos profissionais?

` +
          `Só entram os que ainda não o têm — quem já o recebeu não é avisado ` +
          `outra vez e mantém o link que tem.`,
      )
    )
      return;

    setOcupado("lote-redistribuir");
    setErro("");
    let novos = 0;
    let semNinguem = 0;
    let falhados = 0;
    for (const id of ids) {
      try {
        const res = await fetch("/api/admin/negociacoes/redistribuir", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pedidoId: id }),
        });
        const dados = await res.json();
        if (!res.ok) {
          falhados += 1;
          continue;
        }
        const chegou = Number(dados.receberam ?? 0);
        novos += chegou;
        if (chegou === 0) semNinguem += 1;
      } catch {
        falhados += 1;
      }
    }

    /*
     * O resultado dito em números, e não num "feito".
     *
     * Reenviar seis pedidos e ver a barra fechar-se não diz se alguém os
     * recebeu. O que interessa é quantas negociações NOVAS nasceram — se
     * forem zero, o problema não é o botão: é que os profissionais novos não
     * estão aprovados, ou o pedido não lhes serve. O «porquê?» de cada linha
     * diz qual das duas.
     */
    const partes: string[] = [];
    if (novos > 0) {
      partes.push(`${novos} envio(s) novo(s) a profissionais`);
    }
    if (semNinguem > 0) {
      partes.push(
        `${semNinguem} pedido(s) não chegaram a ninguém novo — veja o «porquê?» na linha`,
      );
    }
    if (falhados > 0) partes.push(`${falhados} falharam`);
    setErro(
      partes.length > 0
        ? `Reenvio: ${partes.join("; ")}.`
        : "Reenvio feito, e não havia nenhum profissional novo para avisar.",
    );

    await carregar(true);
    setOcupado(null);
    setMarcados(new Set());
  }

  /**
   * Apaga os que estao marcados.
   *
   * A confirmacao diz o NUMERO e nao so "tem a certeza". Quem marcou doze
   * cartoes num ecra que rola nao tem como saber quantos ficaram marcados —
   * e "tem a certeza?" nao lhe diz nada que ele ja nao soubesse.
   *
   * A base pode recusar alguns: um pedido com trabalho fechado e por
   * confirmar nao se apaga, porque o profissional ainda precisa da morada e
   * tem o valor cativo. Esses voltam com o motivo escrito e ficam a vista,
   * em vez de sumirem no meio de um "apagados 10 de 12".
   */
  async function apagarMarcados() {
    if (!token || marcados.size === 0 || !podeApagar) return;
    const quantos = marcados.size;
    if (
      !confirm(
        `Apagar ${quantos} pedido${quantos === 1 ? "" : "s"}?

` +
          `As negociacoes, propostas e valores acordados vao junto. ` +
          `Fica registo permanente do que foi apagado, sem as fotos.`,
      )
    ) {
      return;
    }
    setAApagar(true);
    setErro("");
    setRecusados([]);
    try {
      const res = await fetch("/api/admin/negociacoes/apagar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: [...marcados] }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Nao foi possivel apagar.");
        setRecusados(dados.recusados ?? []);
        return;
      }
      setRecusados(dados.recusados ?? []);
      setMarcados(new Set());
      await carregar(true);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAApagar(false);
    }
  }

  if (!ready || aCarregar) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div>
      {/* Por cima de tudo, e sem sair da mesa. */}
      {aVer && (
        <VisorDeFotos
          fotos={aVer.lista}
          indiceInicial={aVer.i}
          onFechar={() => setAVer(null)}
        />
      )}
      <header className="mb-6 flex items-start justify-between gap-4">
        <p className="text-sm text-slate-400">
          {mostrar === "clyon"
            ? `${daClyon.length} negociação(ões) da CLYON.`
            : mostrar === "clientes"
              ? `${dosClientes.length} negociação(ões) de clientes.`
              : temTudo
                ? `${pedidos.length} pedidos na plataforma.`
                : `${pedidos.length} pedidos na mesa — os mais recentes. Escreva na busca para procurar em todos.`}{" "}
          Carregue num cartão para ver só esse bloco; o título de cada bloco abre e fecha.
        </p>
        {/*
          O botão "Actualizar" saiu daqui.

          O ecrã passou a ir buscar dados sozinho de 30 em 30 segundos, e um
          botão de recarregar ao lado disso só semeia dúvida: quem o vê
          assume que o que está no ecrã está velho. No lugar dele fica a
          única coisa que ele realmente respondia — há quanto tempo isto foi
          lido — que se pode ignorar quando não interessa.
        */}
        <span className="text-xs text-slate-500" aria-live="polite">
          {quandoFoiLido}
        </span>
      </header>

      {/*
        A BUSCA, ANTES DOS CARTÕES.

        Fica acima dos totais de propósito: os cartões são um filtro, e a busca
        manda sobre eles — pô-la por baixo sugeria o contrário, que era
        procurar dentro do que o cartão deixou. A lupa e o «limpar» vivem
        dentro da caixa; o resultado é dito por palavras logo abaixo, porque
        uma lista que encolhe sem explicação lê-se como uma avaria.
      */}
      <div className="mb-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            type="search"
            placeholder="Procurar por número, nome, telefone, morada ou região…"
            aria-label="Procurar em toda a mesa"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-24 text-sm text-white outline-none transition focus:border-cyan-500"
          />
          {aProcurar && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              Limpar
            </button>
          )}
        </div>
        {aProcurar && (
          <p className="mt-2 text-xs text-slate-400" aria-live="polite">
            {encontrados === 0
              ? "Nenhum pedido com isso — experimente só o apelido, os últimos dígitos do telemóvel, ou o número do pedido."
              : `${encontrados} pedido${encontrados === 1 ? "" : "s"} em toda a mesa` +
                (soOBloco ? ", incluindo os de fora do bloco escolhido" : "") +
                "."}
          </p>
        )}
      </div>

      {/*
        Os cartões dos totais — cada um é um filtro, como na Agenda. O de
        «Precisa de si» puxa o olho quando há alguém à espera; em EMERALD e não
        em rose, porque nesta mesa o verde já é "está à espera de si" (a
        faixa, o anel do cartão, o botão Responder) e ele conhece-o.
      */}
      {/* `mb-6` aqui e não nos vizinhos: o que vem a seguir (erro, recusados,
          barra dos marcados, o registo) só tem margem por baixo, e sem esta a
          fila dos cartões colava-se ao primeiro deles — o "tudo junto" outra vez. */}
      <div className="mb-6 mt-5 flex flex-wrap items-center gap-3">
        {blocosDoModo.map((b) => {
          const n = quantosNoBloco(b.chave);
          const escolhido = soOBloco === b.chave;
          const alarme = b.chave === "n1" && n > 0;
          return (
            <button
              key={b.chave}
              type="button"
              onClick={() => escolherBloco(escolhido ? null : b.chave)}
              aria-pressed={escolhido}
              title={escolhido ? "Voltar a mostrar todos os blocos" : `Ver só ${b.titulo.toLowerCase()}`}
              className={`rounded-xl border px-4 py-2.5 text-left transition hover:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                escolhido
                  ? "border-cyan-400 bg-cyan-500/10 ring-1 ring-cyan-400/60"
                  : alarme
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-950/50"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {b.titulo}
              </p>
              <p className={`text-xl font-bold ${b.corDoNumero}`}>{n}</p>
              {b.chave === "concluidos" && concluidosPorVer > 0 && (
                <p className="text-[11px] font-semibold text-emerald-300">{concluidosPorVer} por ver</p>
              )}
            </button>
          );
        })}
      </div>

      {soOBloco && (
        <p className="-mt-3 mb-6 text-xs text-slate-400">
          A mostrar só{" "}
          <strong className="text-slate-200">
            {BLOCOS.find((b) => b.chave === soOBloco)?.titulo.toLowerCase()}
          </strong>
          .{" "}
          <button
            type="button"
            onClick={() => escolherBloco(null)}
            className="underline decoration-slate-600 underline-offset-2 hover:text-slate-200"
          >
            Ver todos os blocos
          </button>
        </p>
      )}

      {erro && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* Os que a base se recusou a apagar, com o motivo de cada um.
          Um "apagados 10 de 12" nao diz quais sao os dois nem porque. */}
      {recusados.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-amber-200">
            {recusados.length} pedido{recusados.length === 1 ? " não foi" : "s não foram"} apagado
            {recusados.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-1 space-y-1">
            {recusados.map((r) => (
              <li key={r.id} className="text-xs text-amber-200/80">
                <strong>#{r.id}</strong> — {r.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* A barra so aparece quando ha algo marcado. Um botao de apagar sempre
          visivel e um botao de apagar a espera de um clique distraido. */}
      {marcados.size > 0 && (
        // Neutra, e não vermelha. A barra era vermelha por só ter uma saída
        // que agia — apagar — e a cor era o aviso. Com arquivar ao lado, o
        // vermelho passou a gritar sobre a acção normal: o alarme fica no
        // botão que o merece, não na barra inteira.
        <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-3 backdrop-blur">
          <p className="text-sm font-semibold text-slate-100">
            {marcados.size} pedido{marcados.size === 1 ? "" : "s"} seleccionado
            {marcados.size === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMarcados(new Set())}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
            >
              Desmarcar
            </button>
            {/*
              REENVIAR, E É O PRIMEIRO A AGIR.

              "Eu marquei, agora preciso da opção de reenviar pedido." A barra
              tinha três saídas — desmarcar, arquivar, apagar — e todas tiravam
              pedidos da frente. Nenhuma os punha a andar, que é o que se quer
              fazer a seis pedidos parados quando entram profissionais novos.

              Fica antes das outras duas porque é a única construtiva: as que
              tiram ficam do lado onde já estão, ao pé do vermelho.
            */}
            <button
              onClick={redistribuirMarcados}
              disabled={ocupado === "lote-redistribuir" || ocupado === "lote-arquivar" || aApagar}
              title="Manda-os aos profissionais que ainda não os têm. Quem já os recebeu não é avisado outra vez."
              className="flex items-center gap-1.5 rounded-lg border border-cyan-600/60 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {ocupado === "lote-redistribuir" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Reenviar aos profissionais
            </button>
            {/*
              ARQUIVAR, AO LADO DE APAGAR E ANTES DELE.

              A barra dava duas saídas: desmarcar, ou apagar. Quem tem seis
              pedidos velhos na mesa e os quer tirar da frente não os quer
              APAGAR — quer arrumá-los. Sem esta opção, ou ficavam na mesa a
              ocupar a vista, ou desapareciam para sempre por ser o único botão
              à mão.

              A rota é a mesma de arquivar um a um, e vai um de cada vez de
              propósito: vinte em paralelo num serverless partilhado é pedir
              throttling, e quem vê metade falhar em paralelo não sabe qual
              metade.
            */}
            <button
              onClick={arquivarMarcados}
              disabled={ocupado === "lote-arquivar" || aApagar}
              title="Tira-os da mesa sem os apagar — ficam no backoffice, com o histórico"
              className="flex items-center gap-1.5 rounded-lg border border-slate-500 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {ocupado === "lote-arquivar" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Arquivar
            </button>
            {podeApagar && (
              <button
                onClick={apagarMarcados}
                disabled={aApagar || ocupado === "lote-arquivar"}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {aApagar ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Apagar
              </button>
            )}
          </div>
        </div>
      )}

      {mostrar !== "clientes" && (
        <RegistarPedido
          onCriado={() => carregar(true)}
          onEditar={(id) => setAEditarPlataforma(id)}
        />
      )}

      {/*
        UMA LISTA SÓ, ORDENADA POR QUEM ESPERA — AGORA EM BLOCOS.

        Havia duas: "Negociações da CLYON" e "Negociações dos clientes" —
        separadas por DE ONDE o pedido tinha entrado. Decisão dele: "coloque
        todos os pedidos num único lugar, independente de onde venha; pode
        mostrar a origem mas não separá-lo por isso". A origem passou a ser
        uma etiqueta na linha; o que agrupa é a única pergunta que interessa a
        quem gere — de quem é a vez.

        "Aqui também precisa de organização." Os níveis eram linhas finas no
        meio de uma lista corrida, a faixa verde e o bloco âmbar viviam por
        cima dela, e Concluídos e Cancelados por baixo, cada um com o seu
        desenho. Passam a ser seis blocos iguais (ver BLOCOS), com o padrão da
        Agenda: título colado ao topo que abre e fecha, contagem, a linha do
        que fazer, e o cabeçalho das colunas uma vez por bloco aberto. Dentro
        de cada bloco, do mais recente para o mais antigo, como ele pediu.
      */}
      <div className="mt-6 space-y-6">
        {blocosVisiveis.map((b) => {
          const quantos = quantosNoBloco(b.chave);
          /*
           * Um bloco vazio não aparece — a não ser que tenha sido escolhido
           * em cima, e aí diz que está vazio em vez de desaparecer.
           */
          if (quantos === 0 && soOBloco !== b.chave) return null;
          /*
           * Escolher um cartão é um pedido para VER: o bloco abre sem mexer
           * em `fechados`. Ao voltar a todos, Concluídos volta a estar como
           * estava — fechado, se ninguém o abriu pelo título.
           */
          /*
           * A procurar, um bloco com resultados abre-se sozinho — e um sem
           * resultados fica fechado, para a lista não encher de cabeçalhos
           * vazios. «Concluídos» nasce fechado, e é lá que muitas vezes está o
           * pedido que se anda a procurar.
           */
          const fechado = aProcurar
            ? quantosNoBloco(b.chave) === 0
            : soOBloco === b.chave
              ? false
              : fechados.has(b.chave);
          const [corTexto, corBorda] = b.cor.split(" ");
          return (
            <section key={b.chave} aria-labelledby={`mesa-${b.chave}`}>
              {/*
                O TÍTULO DO BLOCO fica colado ao topo enquanto o bloco rola:
                com doze pedidos à espera, a pessoa a meio da lista continua a
                saber em que bloco está. A barra dos marcados (`z-20`) fica por
                cima dele quando as duas estão presas — a barra ganha, porque é
                a que age.
              */}
              <button
                type="button"
                onClick={() => alternarFechado(b.chave)}
                aria-expanded={!fechado}
                className={`sticky top-0 z-10 flex w-full items-center gap-3 rounded-xl border-l-4 bg-slate-900 px-3 py-2 text-left ${corBorda} hover:bg-slate-800/80`}
              >
                <b.Icone className={`h-4 w-4 shrink-0 ${corTexto}`} aria-hidden="true" />
                <h3 id={`mesa-${b.chave}`} className={`text-sm font-bold uppercase tracking-wider ${corTexto}`}>
                  {b.titulo}
                </h3>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-200">
                  {quantos}
                </span>
                {/* Visível com o bloco fechado — é o "deve ficar destacado" dele. */}
                {b.chave === "concluidos" && concluidosPorVer > 0 && (
                  <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-xs font-bold text-slate-950">
                    {concluidosPorVer} por ver
                  </span>
                )}
                <span className="hidden min-w-0 flex-1 truncate text-xs text-slate-500 sm:block">
                  {b.dica}
                </span>
                {fechado ? (
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                ) : (
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                )}
              </button>

              {b.chave === "porEnviar" ? (
                /*
                  Montado SEMPRE que o bloco é visível, fechado ou não: o
                  componente guarda a busca, os marcados e o "Mais antigos"
                  aberto, e fechar o bloco pelo título não os pode perder.
                  Ele é que decide não desenhar nada quando `aberto` é falso.
                */
                <>
                  <PedidosPorPromover
                    aberto={!fechado}
                    pedidos={porPromoverNaMesa}
                    ocupado={ocupado}
                    onPromover={promover}
                    onArquivar={arquivarPedido}
                    onArquivarVarios={arquivarPedidos}
                    onApagar={apagarPedidos}
                    podeApagar={podeApagar}
                    aApagar={aApagar}
                    onEditar={setAEditarPlataforma}
                  />
                  {/* Só o pai diz "Nada aqui.": o filho, sem pedidos, não desenha
                      nada — senão apareciam duas mensagens de vazio empilhadas. */}
                  {!fechado && quantos === 0 && (
                    <p className="mt-2 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-4 text-center text-sm text-slate-500">
                      Nada aqui.
                    </p>
                  )}
                </>
              ) : (
                !fechado && (
                  <div className="mt-2 pl-1">
                    {/* No cabeçalho a dica é `hidden sm:block`; em ecrãs estreitos
                        a instrução não pode desaparecer. */}
                    <p className="mb-3 text-xs text-slate-500 sm:hidden">{b.dica}</p>
                    {quantos === 0 ? (
                      <p className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-4 text-center text-sm text-slate-500">
                        Nada aqui.
                      </p>
                    ) : (
                      <>
                        {/* ── Propostas à espera de nós ─────────────────────────
                            O profissional contrapropõe e fica à espera. Até aqui
                            nada dizia isso: a negociação ficava fechada num cartão
                            no fundo da página, a dizer "aberta · 2 propostas" como
                            todas as outras. (Dizia-se aqui que a proposta expirava
                            em 48 horas — já não expira, ver `AS_PROPOSTAS_EXPIRAM`,
                            e por isso pode ficar à espera sem fim.)

                            Estes atalhos existem para essa resposta não se perder
                            por ninguém a ter visto. Saltam para o pedido e a
                            negociação já lá está aberta. Era uma faixa inteira por
                            cima da mesa; a explicação das 48 horas passou para a
                            dica do bloco e ficou só a fila de chips — a única coisa
                            que mais nada faz. "À espera de SI" só é verdade nas
                            negociações da CLYON, por isso a conta dos chips pode ser
                            menor do que a do bloco: o bloco também tem pedidos
                            conduzidos pelo cliente com trabalho por confirmar. */}
                        {b.chave === "n1" && aEsperar.length > 0 && (
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Clock className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                            <span className="text-xs text-emerald-200">
                              {aEsperar.length === 1
                                ? "Um pedido está à espera de si"
                                : `${aEsperar.length} pedidos estão à espera de si`}{" "}
                              — a CLYON responde pelo cliente; salte e a negociação abre.
                            </span>
                            {aEsperar.map((p) => {
                              const pendentes = p.negociacoes.filter(precisaDeSi);
                              const proposta = pendentes
                                .flatMap((n) => propostasDe(n.propostasJson))
                                .find((x) => x.estado === "pendente" && x.por === "profissional");
                              // Num pedido que so espera a contratacao nao ha proposta
                              // pendente — o valor que interessa mostrar e o ja acordado.
                              const valor =
                                proposta?.valor ??
                                (pendentes.find((n) => n.valorAcordado)?.valorAcordado != null
                                  ? Number(pendentes.find((n) => n.valorAcordado)!.valorAcordado)
                                  : null);
                              return (
                                <a
                                  key={p.id}
                                  href={`#pedido-${p.id}`}
                                  onClick={() =>
                                    // Sem o auto-abrir, o salto aterrava numa linha fechada —
                                    // abrir aqui é o que faz o atalho valer alguma coisa.
                                    setNegociacoesVisiveis((v) => new Set([...v, p.id]))
                                  }
                                  className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/50"
                                >
                                  #{p.id} · {p.contactName ?? "—"}
                                  {valor != null && (
                                    <span className="ml-2 font-bold text-white">
                                      {valor.toFixed(2).replace(".", ",")} €
                                    </span>
                                  )}
                                </a>
                              );
                            })}
                          </div>
                        )}
                        {cabecalhoDaMesa}
                        <div className="space-y-3">{pedidosDoBloco(b.chave).map(cartaoDoPedido)}</div>
                      </>
                    )}
                  </div>
                )
              )}
            </section>
          );
        })}
      </div>

      {/*
        Os vazios de sempre, com as frases que ele conhece. Só quando não há
        cartão escolhido — com um escolhido, o bloco diz "Nada aqui." sozinho.
        O segundo pode aparecer com o bloco Por enviar cheio: é literalmente
        verdade, nenhum foi enviado a profissionais.
      */}
      {soOBloco === null && mostrar === "clyon" && daClyon.length === 0 && (
        <p className="mt-6 rounded-xl border border-slate-800 bg-slate-800/60 px-4 py-8 text-center text-sm text-slate-500">
          Nenhuma negociação da CLYON em curso. Registe um pedido do WhatsApp ou
          telefone aqui em cima e envie-o — aparece nesta lista.
        </p>
      )}
      {soOBloco === null && !aProcurar && mostrar !== "clyon" && pedidos.length === 0 && (
        <p className="mt-6 rounded-xl border border-slate-800 bg-slate-800/60 px-4 py-8 text-center text-sm text-slate-500">
          Ainda nenhum pedido foi enviado a profissionais.
        </p>
      )}

      {/* O detalhe do pedido, por cima de tudo.
          O componente vai buscar os dados sozinho — so precisa do id e do
          token — por isso nao ha nada para carregar aqui antes de o abrir.

          `permitirApagar={false}` de proposito: o apagar deste painel esta na
          lista, com as caixas de seleccao e com a guarda que recusa levar
          trabalho fechado por confirmar. O botao de dentro do modal nao tem
          essa guarda, e duas portas para a mesma accao — uma com guarda e
          outra sem — e' ter a guarda a fingir. */}
      {aEditarPlataforma != null && (
        /*
          FECHA-SE PELO BOTÃO, E SÓ PELO BOTÃO.

          "Uma coisa que está a stressar-me muito: ao clicar sem querer fora
          dessa tela ela fecha e perco o que estava a fazer."

          Fechar ao clicar fora é um hábito de janelas pequenas — uma
          confirmação, um menu — onde não há nada dentro para perder. Isto é um
          formulário de catorze campos, com fotografias, e gravá-lo recomeça o
          pedido do zero. O gesto mais barato que existe, um clique ao lado,
          apagava o trabalho todo sem perguntar nada.

          A margem escura à volta é grande de propósito, para o formulário
          respirar. Isso torna o clique ao lado MAIS provável, não menos.
        */
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B1220] p-4 sm:p-8">
          <div className="mx-auto max-w-5xl">
            <RegistarPedido
              editarId={aEditarPlataforma}
              onCriado={() => carregar(true)}
              onFechar={() => {
                setAEditarPlataforma(null);
                carregar(true);
              }}
            />
          </div>
        </div>
      )}

      {aEditar != null && token && (
        <PedidoDetailModal
          id={aEditar}
          token={token}
          isAdmin
          permitirApagar={false}
          onClose={() => setAEditar(null)}
          onUpdated={() => carregar(true)}
        />
      )}

      {aCancelar && (
        <CancelarPedido
          pedidoId={aCancelar.id}
          nomeDoCliente={aCancelar.contactName}
          negociacoes={aCancelar.negociacoes}
          token={token ?? ""}
          onFechar={() => setACancelar(null)}
          onCancelado={() => {
            setACancelar(null);
            void carregar();
          }}
        />
      )}
    </div>
  );
}

/**
 * A troca de propostas de uma negociação, e o que veio depois.
 *
 * O painel mostrava o desfecho — "acordada, 300 €" — e escondia como se lá
 * chegou. É precisamente o caminho que interessa quando alguém liga a
 * reclamar: quem propôs o quê, quando, e onde é que uma das partes desistiu.
 *
 * Os valores são os brutos, os que os dois viram. A taxa não entra aqui: não
 * fazia parte da conversa deles.
 */
/**
 * A CLYON responde, em nome do cliente.
 *
 * Esta vista era estritamente de leitura: mostrava as propostas do
 * profissional e não havia um único botão. Para os pedidos que chegam por
 * WhatsApp ou por telefone isso era um beco — o cliente não tem conta nem
 * link, e portanto ninguém do lado dele podia responder. O profissional
 * propunha e a proposta morria às 48 horas.
 *
 * Fica escrito no histórico do pedido quem carregou no botão. Uma proposta
 * feita pela CLYON e uma feita pelo cliente não são a mesma coisa, e no dia
 * de um desacordo é o registo que responde.
 */
function RespostaDaClyon({
  negociacao,
  pedidoId,
  propostas,
  onMudou,
}: {
  negociacao: Negociacao;
  pedidoId: number;
  propostas: Proposta[];
  onMudou: () => void;
}) {
  const { token: authToken } = useAdminAuth();
  const [aEnviar, setAEnviar] = useState("");
  const [erro, setErro] = useState("");
  const [valor, setValor] = useState("");

  // Fechado é fechado: depois do acordo não há nada para propor, e um botão
  // que não faz nada é pior do que botão nenhum.
  const fechado =
    negociacao.estado === "acordada" ||
    negociacao.estado === "desistida" ||
    negociacao.estado === "morta";
  if (fechado) return null;

  /*
   * SÓ AS QUE AINDA ESTÃO DE PÉ — ver `esperaResposta`.
   *
   * O botão «Aceitar 322,00 €» estava a ser desenhado sobre uma proposta de
   * 14 de Setembro, e o servidor respondia 409. Um botão que o servidor
   * recusa é pior do que botão nenhum: ensina a pessoa a desconfiar do ecrã.
   */
  const agora = new Date();
  const pendenteDoProfissional = propostas.find(
    (x) => x.estado === "pendente" && x.por === "profissional" && !expirou(x, agora),
  );
  /* A que caducou, para o ecrã dizer o que aconteceu em vez de ficar calado. */
  const expiradaDoProfissional = pendenteDoProfissional
    ? null
    : propostas.filter((x) => x.estado === "pendente" && x.por === "profissional").at(-1);

  async function agir(accao: string, v?: string) {
    if (!authToken) return;
    setAEnviar(accao);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/agir", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ pedidoId, negociacaoId: negociacao.id, accao, valor: v }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível registar.");
        return;
      }
      setValor("");
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar("");
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-cyan-900/60 bg-cyan-950/20 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
        Responder como CLYON
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
        Em nome do cliente. Fica registado no histórico do pedido com o seu nome.
      </p>

      {erro && (
        <p className="mt-2 rounded-md border border-red-900 bg-red-950/40 px-2 py-1.5 text-xs text-red-300">
          {erro}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* O profissional já aceitou. Falta fechar.

            `aguarda_contratacao` significa exactamente isto: o valor está
            combinado dos dois lados e ninguém pode fazer mais propostas — só
            falta alguém carregar em contratar para o trabalho existir. A
            acção estava na API desde o princípio e nunca teve botão, e o
            #204 ficou aqui parado com o valor aceite e sem forma de avançar.

            É irreversível: fecha as outras negociações do mesmo pedido. Por
            isso pergunta antes. */}
        {negociacao.estado === "aguarda_contratacao" && (
          <button
            onClick={() => {
              if (
                confirm(
                  "Contratar este profissional? As outras negociações deste pedido fecham.",
                )
              ) {
                agir("contratar");
              }
            }}
            disabled={aEnviar !== ""}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {aEnviar === "contratar" && (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            )}
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Contratar
            {negociacao.valorAcordado
              ? ` por ${Number(negociacao.valorAcordado).toFixed(2).replace(".", ",")} €`
              : ""}
          </button>
        )}

        {pendenteDoProfissional && (
          <button
            onClick={() => agir("aceitar")}
            disabled={aEnviar !== ""}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {aEnviar === "aceitar" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            Aceitar {Number(pendenteDoProfissional.valor).toFixed(2).replace(".", ",")} €
          </button>
        )}

        {/*
          O QUE ACONTECEU AO VALOR QUE ELE TINHA POSTO.

          Em vez do botão que o servidor recusava. Dizer «expirou» e mostrar o
          número responde à pergunta que a pessoa tem à frente — «então e os
          322 €?» — e aponta para o que há a fazer: contrapor, ou pedir-lhe
          outra proposta pelo «Reenviar» ao lado.
        */}
        {expiradaDoProfissional && (
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            Os {Number(expiradaDoProfissional.valor).toFixed(2).replace(".", ",")} € dele
            expiraram — contraponha, ou peça-lhe outra proposta.
          </span>
        )}

        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="contrapropor €"
          inputMode="decimal"
          className="h-8 w-32 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white outline-none focus:border-cyan-600"
        />
        <button
          onClick={() => agir("propor", valor)}
          disabled={aEnviar !== "" || valor.trim() === ""}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-700 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-40"
        >
          {aEnviar === "propor" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          Contrapropor
        </button>

        <button
          onClick={() => {
            if (confirm("Desistir desta negociação? O profissional deixa de poder propor.")) {
              agir("desistir");
            }
          }}
          disabled={aEnviar !== ""}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60 disabled:opacity-50"
        >
          Desistir
        </button>
      </div>
    </div>
  );
}

/**
 * Os pedidos que ainda não foram a lado nenhum.
 *
 * O QUE ESTAVA MAL
 *
 * Uma lista corrida, sem fim e sem hierarquia. O cabeçalho dizia "1 pedidos na
 * plataforma" e por baixo despejava quinze pedidos de dez dias atrás, todos com
 * o mesmo aspecto e o mesmo botão cor de laranja. O que interessava — o pedido
 * de hoje — ficava enterrado no meio dos que já morreram.
 *
 * E não havia forma de tirar nenhum dali. Um pedido que nunca vai ser enviado
 * ficava na lista para sempre, a ocupar a atenção de quem abre o painel todas
 * as manhãs.
 *
 * PORQUE É QUE A IDADE É A CATEGORIA CERTA
 *
 * Podia agrupar-se por serviço, por cidade, por urgência. Nenhuma dessas muda
 * o que se faz a seguir. A idade muda: um pedido de hoje ainda se ganha, um de
 * há dez dias já foi para outro lado — e o que a lista precisava era de dizer
 * quais são quais sem obrigar a ler quinze datas.
 *
 * Os antigos ficam fechados, com a conta à frente. Continuam a existir, mas
 * deixam de gritar tão alto como os de hoje.
 *
 * "AQUI TAMBÉM PRECISA DE ORGANIZAÇÃO"
 *
 * A caixa âmbar inteira, com título, pílula e descrição próprios, era o bloco
 * mais alto da mesa e não fechava. Passou a ser um bloco como os outros (ver
 * BLOCOS no pai): o título, a contagem e a dica vivem no cabeçalho colado ao
 * topo que o pai desenha, e este componente devolve só o interior — o marcar
 * todos, a barra de lote e os grupos por idade, textualmente iguais.
 *
 * `aberto` vem do pai e, quando é falso, o componente devolve null DEPOIS dos
 * hooks: fica montado com o bloco fechado, e os marcados e o "Mais
 * antigos" aberto não se perdem ao fechar e reabrir. Escolher OUTRO cartão em
 * cima desmonta-o e perde-os — aceitável: já hoje `promover()` recarrega a
 * descoberto e o spinner remonta tudo.
 */


function PedidosPorPromover({
  aberto,
  pedidos,
  ocupado,
  onPromover,
  onArquivar,
  onArquivarVarios,
  onApagar,
  podeApagar = true,
  aApagar,
  onEditar,
}: {
  /** O bloco está aberto no pai; fechado, o componente fica montado e não desenha nada. */
  aberto: boolean;
  pedidos: PorPromover[];
  ocupado: string | null;
  onPromover: (id: number, valor?: string) => void;
  onArquivar: (id: number) => void;
  onArquivarVarios: (ids: number[]) => void;
  onApagar: (ids: number[]) => void;
  /** O assistente arquiva mas não apaga. */
  podeApagar?: boolean;
  aApagar: boolean;
  /** Abre o pedido para corrigir — o mesmo editor da mesa. */
  onEditar: (id: number) => void;
}) {
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  // Os antigos nascem fechados: são os que menos merecem atenção, e são quase
  // sempre os mais numerosos.
  const [antigosAbertos, setAntigosAbertos] = useState(false);
  /*
   * O VALOR DE PARTIDA, ESCRITO À MÃO — de volta a pedido do dono.
   *
   * Esteve aqui, saiu quando o envio passou a usar a conta da CLYON, e volta
   * porque há um caso que a fórmula não conhece: o que já foi combinado ao
   * telefone. Quem atendeu sabe mais do que a conta.
   *
   * Vazio é o normal, e vazio manda a conta da CLYON. Um por pedido, e não um
   * só partilhado: escrever num pedido não pode encher a caixa do de baixo.
   */
  const [valorDe, setValorDe] = useState<Record<number, string>>({});

  const agora = new Date();

  /*
   * A BUSCA DESTE BLOCO SUBIU PARA O TOPO DA MESA.
   *
   * Estava aqui porque, nas palavras do comentário que a acompanhava, uma
   * busca no topo «prometia procurar em toda a mesa» e não procurava. Agora
   * procura — e duas caixas, uma a filtrar seis blocos e outra a filtrar um,
   * seriam duas respostas diferentes à mesma pergunta.
   *
   * O que ela procurava também ficou pelo caminho: nome, cidade, serviço e
   * número. Nem telefone, nem morada, nem código postal.
   *
   * `pedidos` já chega filtrado pelo pai, por isso «marcar todos» continua a
   * marcar exactamente o que está no ecrã — que era a razão de isto existir.
   */
  const visiveis = pedidos;

  const grupos = useMemo(() => {
    const g: Record<GrupoDeIdade, PorPromover[]> = {
      hoje: [],
      semana: [],
      antigo: [],
    };
    for (const p of visiveis) g[grupoPorIdade(p.createdAt, agora)].push(p);
    return g;
    // `agora` muda a cada render e não é uma dependência útil: a idade em dias
    // não se mexe entre dois desenhos do mesmo ecrã.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiveis]);

  // Depois de TODOS os hooks, de propósito: um return antes deles mudava a
  // ordem dos hooks entre desenhos e o React perdia o estado.
  if (!aberto) return null;
  // Sem pedidos nenhuns o vazio é do pai — e, a procurar, é o pai que diz que
  // não encontrou nada. Aqui não se desenha um cabeçalho vazio.
  if (pedidos.length === 0) return null;

  const alternar = (id: number) =>
    setMarcados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const linha = (p: PorPromover) => (
    <div
      key={p.id}
      className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 p-3"
    >
      <input
        type="checkbox"
        checked={marcados.has(p.id)}
        onChange={() => alternar(p.id)}
        aria-label={`Marcar o pedido ${p.id}`}
        className="h-4 w-4 shrink-0 cursor-pointer accent-cyan-500"
      />

      <div className="min-w-0 flex-1">
        <span className="font-semibold text-white">
          #{p.id} · {p.serviceType ?? "—"}
        </span>
        <p className="mt-0.5 text-xs text-slate-400">
          {p.contactName} · {p.city ?? "—"}
          {p.estimateTotal ? ` · estimativa ${euros(p.estimateTotal)} c/IVA` : " · sem estimativa"}
          {" · "}
          {new Date(p.createdAt).toLocaleDateString("pt-PT")}
        </p>
      </div>

      {/*
        A CAIXA DO VALOR SAIU.

        Escrevia-se aqui o valor de partida, e sem nada escrito valia a
        estimativa. Ele pediu que a CLYON desse uma sugestão em vez de um
        valor a aceitar, e disse que sim a usar a mesma conta ao enviar: a
        partida passa a ser a conta da CLYON, feita na rota com os quilómetros
        da base da CLYON — e cada profissional vê a conta com os dele.
      */}

      {/*
        CORRIGIR ANTES DE ENVIAR.

        Esta lista só sabia enviar ou arquivar. Um pedido registado ao
        telefone chega com erros — uma morada trocada, um andar a mais — e as
        fotografias aparecem no WhatsApp cinco minutos depois de o pedido
        estar gravado. Sem isto, a única forma de corrigir era enviar primeiro
        e editar já depois de os profissionais terem lido o erro.

        Fica à ESQUERDA do enviar de propósito: corrigir vem antes de mandar.
      */}
      <button
        onClick={() => onEditar(p.id)}
        title="Corrigir informações ou juntar fotografias"
        className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        Editar
      </button>

      {/*
        Vazio = a conta da CLYON. Escrito = o que lá está.
        O `title` diz a regra a quem passar o rato, para não ser preciso
        adivinhar o que faz uma caixa vazia.
      */}
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
          €
        </span>
        <input
          value={valorDe[p.id] ?? ""}
          onChange={(e) => setValorDe((v) => ({ ...v, [p.id]: e.target.value }))}
          inputMode="decimal"
          placeholder="conta CLYON"
          title="Deixe vazio para enviar a conta da CLYON. Escreva um valor para mandar esse."
          aria-label={`Valor de partida do pedido ${p.id}`}
          className="w-28 rounded-lg border border-slate-600 bg-slate-950 py-2 pl-5 pr-2 text-xs text-white outline-none focus:border-amber-500"
        />
      </div>

      <button
        onClick={() => onPromover(p.id, valorDe[p.id]?.trim() || undefined)}
        disabled={ocupado === `p${p.id}`}
        className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
      >
        {ocupado === `p${p.id}` ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Enviar aos profissionais
      </button>

      {/*
        Arquivar e não apagar, como acção normal.
        Um pedido arquivado sai desta lista e continua a existir: o histórico
        do cliente não muda, e daqui a três meses ainda se sabe que houve um
        pedido de móveis em Almada que ninguém enviou. Apagar é para o que não
        devia ter existido — e por isso é o botão pequeno e cinzento.
      */}
      <button
        onClick={() => onArquivar(p.id)}
        disabled={ocupado === `a${p.id}`}
        title="Arquivar — sai da lista, mantém o registo"
        className="rounded-lg border border-slate-700 px-2.5 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800/60 disabled:opacity-50"
      >
        {ocupado === `a${p.id}` ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );

  const seccao = (chave: GrupoDeIdade) => {
    const lista = grupos[chave];
    if (lista.length === 0) return null;
    const fechavel = chave === "antigo";
    const aberto = !fechavel || antigosAbertos;

    return (
      <div key={chave} className="mt-4 first:mt-3">
        {fechavel ? (
          <button
            onClick={() => setAntigosAbertos((v) => !v)}
            aria-expanded={aberto}
            className="flex w-full items-center gap-1.5 rounded-md border-none bg-transparent px-0 py-1 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${aberto ? "" : "-rotate-90"}`}
              aria-hidden="true"
            />
            {ROTULO_DO_GRUPO[chave]} ({lista.length})
          </button>
        ) : (
          <p className="px-0 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {ROTULO_DO_GRUPO[chave]} ({lista.length})
          </p>
        )}
        {aberto && <div className="mt-1.5 space-y-2">{lista.map(linha)}</div>}
      </div>
    );
  };

  return (
    <div className="mt-2 pl-1">
      {/*
        Marcar todos marca OS VISIVEIS — grupos fechados incluidos. Se a busca
        do topo diz "entulho", "todos" sao os de entulho: marcar o que nao esta
        no ecra seria apagar as escuras.

        A caixa de procurar que vivia aqui a direita subiu para o topo da mesa,
        onde procura nos seis blocos e tambem por telefone, morada e codigo
        postal. Ver a nota em `visiveis`.
      */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {visiveis.length > 0 && (
          <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={visiveis.length > 0 && visiveis.every((p) => marcados.has(p.id))}
              onChange={(e) =>
                setMarcados(e.target.checked ? new Set(visiveis.map((p) => p.id)) : new Set())
              }
              className="h-4 w-4 cursor-pointer accent-cyan-500"
            />
            Marcar todos ({visiveis.length})
          </label>
        )}
      </div>

      {marcados.size > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2">
          <span className="text-xs text-slate-300">
            {marcados.size} marcado{marcados.size === 1 ? "" : "s"}
          </span>
          {/*
            Arquivar primeiro e apagar depois — pela mesma hierarquia das
            linhas: arquivar mantem o registo e e a arrumação normal; apagar
            e a excepção, e fica com a cor de excepção.
          */}
          <button
            onClick={() => {
              onArquivarVarios([...marcados]);
              setMarcados(new Set());
            }}
            disabled={ocupado === "lote-arquivar" || aApagar}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            {ocupado === "lote-arquivar" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Arquivar
          </button>
          {podeApagar && (
            <button
              onClick={() => {
                onApagar([...marcados]);
                setMarcados(new Set());
              }}
              disabled={aApagar || ocupado === "lote-arquivar"}
              className="flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
            >
              {aApagar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Apagar
            </button>
          )}
          <button
            onClick={() => setMarcados(new Set())}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60"
          >
            Desmarcar
          </button>
        </div>
      )}

      {visiveis.length === 0 ? (
        <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center text-sm text-slate-500">
          Nada com essa procura.
        </p>
      ) : (
        <>
          {seccao("hoje")}
          {seccao("semana")}
          {seccao("antigo")}
        </>
      )}
    </div>
  );
}

/**
 * Dinheiro em português.
 *
 * O painel escrevia `{n.valorAcordado} €` — o valor cru da base de dados — e
 * saía "200.00 €", com ponto. Em português o separador decimal é a vírgula, e
 * este ecrã é lido por quem está ao telefone a dizer um valor em voz alta.
 */
function euros(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(2).replace(".", ",")} €`;
}

/**
 * A CLYON confirma o trabalho, em nome de quem não tem como o fazer.
 *
 * E mostra as contas.
 *
 * Faltavam os números: o painel dizia "200,00 €" e mais nada. Esse valor é o
 * ACORDADO, e não é o que nenhuma das partes vê. O cliente paga mais do que
 * isso e o profissional recebe menos — e quem está ao telefone com a cliente
 * a combinar o pagamento precisa do número certo à frente, não de uma conta
 * de cabeça sobre percentagens.
 *
 * Os três números saem de `taxas-plataforma`, que é onde as comissões vivem.
 * Escritos à mão aqui, mudavam quando a taxa mudasse — ou pior, não mudavam.
 */
/**
 * A NOTA, DADA PELA CLYON EM NOME DO CLIENTE.
 *
 * "Eu devia ter a opção de abrir o pedido, sendo admin, ver toda a troca e
 * inclusive abrir o perfil do pro e dar a nota, já que foi criado o pedido
 * aqui."
 *
 * O mesmo beco do confirmar, um passo mais à frente. Um pedido que chegou por
 * WhatsApp, com o cliente sem email, não tem quem avalie — a estrela é dada no
 * link do cliente, e ele não tem link nem conta. O trabalho fica feito, pago e
 * confirmado, e o profissional continua com «sem avaliações» para sempre.
 *
 * É isso que abre a porta ao cliente seguinte: quem escolhe entre dois nomes
 * numa lista escolhe pelas estrelas, e um profissional que só trabalha por
 * WhatsApp nunca chega a ter nenhuma.
 *
 * Só aparece onde a CLYON responde MESMO pelo lado do cliente — a mesma regra
 * do confirmar, decidida pela mesma função. E fica escrito que foi ela: uma
 * nota da CLYON e uma do cliente não são a mesma coisa.
 */
function AvaliarPelaClyon({
  negociacaoId,
  pedidoId,
  profissionalNome,
  onMudou,
}: {
  negociacaoId: number;
  pedidoId: number;
  profissionalNome: string;
  onMudou: () => void;
}) {
  const { token: authToken } = useAdminAuth();
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");

  const avaliar = async () => {
    if (!authToken || estrelas < 1) return;
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/agir", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          pedidoId,
          negociacaoId,
          accao: "avaliar",
          estrelas,
          comentario: comentario.trim() || undefined,
        }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível avaliar.");
        return;
      }
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/20 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
        Dar a nota como CLYON
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
        Este cliente não tem como avaliar sozinho. Sem isto, {profissionalNome} fica sem
        estrelas — e são elas que decidem quem o próximo cliente escolhe.
      </p>

      <div className="mt-2.5 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setEstrelas(n)}
            aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
            aria-pressed={estrelas === n}
            className="p-0.5 transition"
          >
            <Star
              className={`h-6 w-6 ${
                n <= estrelas ? "fill-amber-400 text-amber-400" : "text-slate-600"
              }`}
              aria-hidden="true"
            />
          </button>
        ))}
        {estrelas > 0 && (
          <span className="ml-2 text-xs font-semibold text-amber-200">
            {estrelas} de 5
          </span>
        )}
      </div>

      <input
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="O que correu bem, em duas linhas (opcional)"
        maxLength={600}
        className="mt-2.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-amber-600"
      />

      {erro && (
        <p className="mt-2 rounded-md border border-red-900 bg-red-950/40 px-2 py-1.5 text-xs text-red-300">
          {erro}
        </p>
      )}

      <button
        onClick={avaliar}
        disabled={aEnviar || estrelas < 1}
        className="mt-2.5 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
      >
        {aEnviar ? "A guardar…" : "Guardar a nota"}
      </button>
    </div>
  );
}

/** "5 %" — a taxa como se lê, a partir da constante. */
function pct(taxa: number): string {
  return `${Math.round(taxa * 100)} %`;
}

function ConfirmarPelaClyon({
  negociacaoId,
  pedidoId,
  valorAcordado,
  taxas,
  onMudou,
}: {
  negociacaoId: number;
  pedidoId: number;
  valorAcordado: number | null;
  /**
   * AS TAXAS DESTA NEGOCIAÇÃO, e já não o regime do profissional.
   *
   * O regime saiu porque deixou de contar: quem factura é a parceira. As taxas
   * entraram porque faltavam — esta caixa calculava com as de hoje enquanto a
   * linha de cima usava as congeladas na negociação, e as duas mostravam
   * números diferentes para o mesmo trabalho, uma por cima da outra.
   */
  taxas: Taxas;
  onMudou: () => void;
}) {
  const { token: authToken } = useAdminAuth();
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [aConfirmar, setAConfirmar] = useState(false);

  const confirmar = async () => {
    if (!authToken) return;
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/agir", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ pedidoId, negociacaoId, accao: "confirmar" }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível confirmar.");
        return;
      }
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
        Confirmar como CLYON
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
        Este cliente não tem como confirmar sozinho — chegou por WhatsApp ou telefone.
        Confirme depois de falar com ele e de o trabalho estar pago.
      </p>

      {valorAcordado != null &&
        (() => {
          /*
            QUEM RECEBE O QUÊ.

            "O IVA quem cobra são os pros." Isto dizia «Cobrar ao cliente —
            acordado + IVA + taxa — 387,00 €», e lia-se como se a CLYON fosse
            cobrar 387 € com imposto dentro. Não é: o cliente paga ao
            PROFISSIONAL o valor acordado mais o IVA que ele factura (se
            facturar), e paga à CLYON só a taxa. O total é a soma das duas
            transferências, e é assim que se mostra — duas linhas debaixo do
            total, uma por destinatário.
          */
          const conta = contaDoCliente(valorAcordado, taxas);
          /*
           * O IMPOSTO É POR VENDEDOR, E ESTA LINHA TINHA-O SOMADO — 21-09-2026.
           *
           * Dizia `conta.servico + conta.iva`, e `conta.iva` é o imposto TODO:
           * o do serviço, que é do profissional, mais o da taxa, que é da
           * CLYON. Num trabalho de 120 € com profissional isento, o ecrã mandava
           * pagar-lhe 121,38 € e etiquetava «+ IVA 1,38 €, na factura dele» —
           * a um homem do artigo 53.º, que não pode emitir imposto nenhum. E
           * dizia «à CLYON 6,00 €» quando a CLYON tem de receber 7,38 €.
           *
           * As duas linhas somavam o total certo, e foi por isso que ninguém
           * deu por isso. É o erro de 14-09-2026 ressuscitado — o dos 107,52 €
           * contra a factura de 103,32 € — na definição que
           * `as-duas-facturas.test.ts` já guardava: a factura do profissional é
           * `servico + ivaDoServico`, a da CLYON é `taxa + ivaDaTaxa`.
           */
          /*
            A CONTA POR ORDEM, UMA PARCELA POR LINHA — 22-09-2026.

            "Temos que ser simples e directo para mesmo um senhor de 80 anos
            entender: valor do trabalho mais taxa 5 % = X, mais IVA caso
            deseje 23 % = Y."

            A tabela começava pelo fim — «O cliente paga, no total» — e só
            depois dizia de onde vinha, repartido por duas facturas e com uma
            nota sobre a isenção do profissional no meio. Quem a lia tinha de
            a ler de baixo para cima.

            Agora lê-se como se soma: as parcelas primeiro, o total a seguir,
            e o imposto como a linha que se acrescenta só a quem pedir factura.
          */
          const linha = (
            rotulo: React.ReactNode,
            valor: number,
            destaque = false,
            borda = false,
          ) => (
            <div
              className={`flex items-center justify-between${borda ? " border-t border-slate-800 pt-1" : ""}`}
            >
              <dt className={destaque ? "text-slate-200" : "text-slate-500"}>{rotulo}</dt>
              <dd
                className={`tabular-nums ${destaque ? "font-semibold text-slate-100" : "text-slate-300"}`}
              >
                {euros(valor)}
              </dd>
            </div>
          );
          return (
            <dl className="mt-2.5 space-y-1 rounded-md bg-slate-950/60 px-3 py-2.5 text-xs">
              {linha("O trabalho", conta.servico)}
              {linha(`Taxa CLYON (${pct(taxas.cliente)})`, conta.taxa)}
              {conta.acrescimo > 0 && linha("Pagamento após a recolha", conta.acrescimo)}
              {linha("O cliente paga", conta.semIva, true, true)}
              {linha(`Se quiser factura — IVA (${pct(TAXA_IVA)})`, conta.iva)}
              {linha("Com factura, paga", conta.total, true)}
              <div className="flex items-center justify-between border-t border-slate-800 pt-1">
                <dt className="text-slate-200">
                  O profissional recebe
                  <span className="block text-[10px] text-slate-500">
                    o trabalho menos {pct(taxas.profissional)}
                  </span>
                </dt>
                <dd className="font-semibold tabular-nums text-slate-100">
                  {euros(quantoOProfissionalRecebe(valorAcordado, taxas))}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">
                  Fica para a CLYON
                  <span className="block text-[10px] text-slate-600">
                    {pct(taxas.cliente)} do cliente + {pct(taxas.profissional)} do profissional
                  </span>
                </dt>
                <dd className="tabular-nums text-slate-400">
                  {euros(comissaoDaClyon(valorAcordado, taxas))}
                </dd>
              </div>
            </dl>
          );
        })()}

      {erro && (
        <p className="mt-2 rounded-md border border-red-900 bg-red-950/40 px-2 py-1.5 text-xs text-red-300">
          {erro}
        </p>
      )}

      {/*
        Dois toques, e não um. Confirmar liberta o dinheiro do profissional e
        não tem volta — e o botão vive ao lado de outros que se carregam sem
        pensar.
      */}
      {!aConfirmar ? (
        <button
          onClick={() => setAConfirmar(true)}
          className="mt-2.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
        >
          Está feito — libertar o pagamento
        </button>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-300">Confirma que o trabalho está feito e pago?</span>
          <button
            onClick={confirmar}
            disabled={aEnviar}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {aEnviar ? "A confirmar…" : "Sim, libertar"}
          </button>
          <button
            onClick={() => setAConfirmar(false)}
            disabled={aEnviar}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

function TrocaDePropostas({
  negociacao,
  pedidoId,
  podeConfirmar,
  onMudou,
  onVerFotos,
}: {
  negociacao: Negociacao;
  pedidoId: number;
  /** Abre a fotografia POR CIMA da mesa, sem sair da página. */
  onVerFotos: (fotos: string[], i: number) => void;
  /** A CLYON responde pelo lado do cliente NESTE pedido — ver quem-negoceia.ts. */
  podeConfirmar: boolean;
  onMudou: () => void;
}) {
  const propostas = propostasDe(negociacao.propostasJson);
  const prova = provaDe(negociacao.provaJson);

  return (
    <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      {propostas.length === 0 ? (
        <p className="text-xs text-slate-500">
          Ainda não houve propostas — o profissional foi avisado a{" "}
          {quando(negociacao.criadaEm)} e não respondeu.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {propostas.map((p, i) => (
            <li key={i} className="flex items-center gap-3 text-xs">
              <span
                className={`w-24 shrink-0 font-semibold ${
                  p.por === "cliente" ? "text-cyan-300" : "text-amber-300"
                }`}
              >
                {p.por === "cliente" ? "Cliente" : "Profissional"}
              </span>
              <span
                className={`w-20 shrink-0 font-bold ${
                  p.estado === "pendente" ? "text-white" : "text-slate-500 line-through"
                }`}
              >
                {Number(p.valor).toFixed(2).replace(".", ",")} €
              </span>
              <span className="w-40 shrink-0 text-slate-500">
                {ESTADO_DA_PROPOSTA[p.estado] ?? p.estado}
              </span>
              <span className="text-slate-600">{quando(p.criadaEm)}</span>
            </li>
          ))}
        </ol>
      )}

      <RespostaDaClyon
        negociacao={negociacao}
        pedidoId={pedidoId}
        propostas={propostas}
        onMudou={onMudou}
      />

      {/* Depois do acordo: a prova e a confirmação. */}
      {(negociacao.execucaoEnviadaEm || negociacao.confirmadoEm) && (
        <div className="mt-3 border-t border-slate-800 pt-3">
          {negociacao.execucaoEnviadaEm && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <Camera className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              Prova enviada a {quando(negociacao.execucaoEnviadaEm)}
              {prova?.nota ? ` — "${prova.nota}"` : ""}
            </p>
          )}
          {prova && prova.fotos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {prova.fotos.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => onVerFotos(prova.fotos, i)}
                  aria-label={`Ver prova ${i + 1}`}
                >
                  {/* Foto, video ou PDF — a especie decide-se em `Anexo.tsx`. */}
                  <Miniatura
                    url={url}
                    className="h-16 w-16 ring-1 ring-slate-700 transition hover:ring-cyan-500"
                  />
                </button>
              ))}
            </div>
          )}
          {/*
            O BECO QUE ESTAVA AQUI.

            Um pedido registado pela equipa — chegado por WhatsApp, com a
            cliente sem email — nao tinha ninguem que pudesse confirmar. O
            profissional fazia o trabalho, mandava a prova, e ficava ali: sem
            botao no painel, sem link no email dela, sem conta onde entrar.
            `confirmadoEm` nunca era preenchido, e e essa data que fecha o
            trabalho, que deixa apagar o pedido, e que deixa apagar a conta
            dele ou a dela.

            So aparece quando a CLYON responde MESMO pelo lado do cliente. Se
            ele tem email e recebeu o link, e ele que confirma — e o botao nao
            existe. A rota recusa na mesma; isto e so nao mostrar uma porta que
            nao abre.
          */}
          {!negociacao.confirmadoEm && negociacao.execucaoEnviadaEm && podeConfirmar && (
            <ConfirmarPelaClyon
              negociacaoId={negociacao.id}
              pedidoId={pedidoId}
              valorAcordado={
                negociacao.valorAcordado != null ? Number(negociacao.valorAcordado) : null
              }
              taxas={taxasDaNegociacao(negociacao)}
              onMudou={onMudou}
            />
          )}

          {negociacao.confirmadoEm && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Cliente confirmou a {quando(negociacao.confirmadoEm)}
              {negociacao.pagoEm ? ` · pago a ${quando(negociacao.pagoEm)}` : " · saldo disponível"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A caixa de marcar de um pedido.
 *
 * `stopPropagation` porque a linha inteira e clicavel para abrir o pedido, e
 * marcar nao pode abrir. Sem isto, marcar doze cartoes abria doze vezes o
 * detalhe pelo caminho.
 */
function Caixa({ marcado, onMarcar }: { marcado: boolean; onMarcar: () => void }) {
  return (
    <input
      type="checkbox"
      checked={marcado}
      onChange={onMarcar}
      onClick={(e) => e.stopPropagation()}
      aria-label="Seleccionar este pedido"
      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-600 bg-slate-950 accent-cyan-500"
    />
  );
}

function LinkEmClaro({
  caminho,
  aviso,
  mensagem,
  telefone,
  token,
}: {
  caminho: string;
  aviso: string;
  /** O telemóvel do cliente, se der para abrir a conversa no WhatsApp. */
  telefone?: string | null;
  /** Para enviar pela CLYON. Sem ele o botão não aparece — não há envio anónimo. */
  token?: string | null;
  /**
   * A mensagem pronta a mandar, já com as propostas e o link lá dentro.
   *
   * "Gostaria que ele viesse já com uma mensagem resumida para enviar ao
   * cliente sobre as propostas que ele recebeu."
   *
   * Ele escrevia-a à mão, uma a uma. Escrever à mão vinte vezes por semana é
   * onde nascem os enganos que custam dinheiro: um valor trocado, o nome de
   * outro profissional, e — o mais caro de todos — não dizer que ao número
   * acresce imposto.
   */
  mensagem?: string;
}) {
  const [copiado, setCopiado] = useState<"link" | "mensagem" | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erroDoEnvio, setErroDoEnvio] = useState("");
  const url = typeof window !== "undefined" ? `${window.location.origin}${caminho}` : caminho;

  /**
   * Manda a mensagem pelo número da CLYON e devolve a conversa ao assistente.
   *
   * O `token` vem de quem chama: este componente vive dentro do painel, que já
   * está autenticado. Sem ele o botão não aparece — não há envio anónimo.
   */
  async function enviarPelaClyon(para: string, texto: string) {
    if (!token) return;
    setAEnviar(true);
    setErroDoEnvio("");
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accao: "enviarPelaClyon", telefone: para, nota: texto }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErroDoEnvio(dados.error ?? "Não foi possível enviar.");
        return;
      }
      setEnviado(true);
      // Um aviso não é um erro: a mensagem saiu, mas há uma condição que
      // impede o assistente de continuar — e quem carregou tem de a saber.
      if (dados.aviso) setErroDoEnvio(dados.aviso);
    } catch {
      setErroDoEnvio("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  function copiar(o: "link" | "mensagem", texto: string) {
    navigator.clipboard?.writeText(texto);
    setCopiado(o);
    setTimeout(() => setCopiado((c) => (c === o ? null : c)), 1800);
  }

  return (
    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
      <p className="text-xs font-semibold text-amber-200">{aviso}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-300">
          {url}
        </code>
        <button
          onClick={() => copiar("link", url)}
          className="flex shrink-0 items-center gap-1 rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white"
        >
          <Copy className="h-3 w-3" aria-hidden="true" />
          {copiado === "link" ? "Copiado" : "Copiar"}
        </button>
      </div>

      {/*
        A MENSAGEM INTEIRA, com o link já lá dentro.

        Fica por baixo e não por cima: quem só quer o endereço não tem de
        passar por um bloco de texto para lá chegar. Mas é este o botão que ele
        vai usar quase sempre — o link sozinho obriga-o a escrever tudo à volta.
      */}
      {mensagem && (
        <div className="mt-2 border-t border-amber-500/20 pt-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-200/80">
              Mensagem pronta a enviar
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              {/*
                ENVIAR PELA CLYON — e o assistente fica com a conversa.

                "Esse botão devia passar para o bot do WhatsApp enviar, e
                continuar a conversa caso seja necessário."

                É a diferença que importa: o botão do lado sai do telemóvel de
                quem carrega, e o assistente não fica a saber de nada — quando
                o cliente responder «aceito», a resposta cai numa conversa que
                a plataforma nunca começou. Este sai pelo número da CLYON, fica
                no fio, e devolve o número ao assistente.
              */}
              {telefone && (
                <button
                  onClick={() => void enviarPelaClyon(telefone, mensagem)}
                  disabled={aEnviar}
                  title="Sai pelo número da CLYON e o assistente fica a tratar da conversa."
                  className="flex items-center gap-1 rounded bg-cyan-600 px-2 py-1 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {aEnviar ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-3 w-3" aria-hidden="true" />
                  )}
                  {enviado ? "A caminho" : "Enviar pela CLYON"}
                </button>
              )}
              {/* Abrir a conversa com isto escrito poupa copiar, trocar de
                  aplicação e procurar o contacto. O envio continua a ser dele. */}
              {linkDeWhatsApp(telefone, mensagem) && (
                <a
                  href={linkDeWhatsApp(telefone, mensagem) as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abre o SEU WhatsApp com o texto escrito. A mensagem sai do seu número."
                  className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                >
                  <MessageCircle className="h-3 w-3" aria-hidden="true" />
                  Do meu WhatsApp
                </a>
              )}
              <button
                onClick={() => copiar("mensagem", mensagem)}
                className="flex items-center gap-1 rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white"
              >
                <Copy className="h-3 w-3" aria-hidden="true" />
                {copiado === "mensagem" ? "Copiada" : "Copiar mensagem"}
              </button>
            </div>
          </div>
          {/*
            Mostra-se INTEIRA, e não cortada. É texto que vai sair em nome da
            casa para um cliente: quem o manda tem de o poder ler antes.
          */}
          {/*
            O que aconteceu ao envio, dito por extenso.

            Um verde silencioso não chega: pela ponte, «saiu» quer dizer «ficou
            na fila», e com o interruptor geral desligado a mensagem sai mas o
            assistente não responde ao que vier a seguir.
          */}
          {enviado && !erroDoEnvio && (
            <p className="mt-1.5 text-[11px] text-cyan-300">
              A caminho pelo número da CLYON. O assistente fica a tratar desta conversa —
              responde ao que ele disser.
            </p>
          )}
          {erroDoEnvio && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-red-300">{erroDoEnvio}</p>
          )}
          <pre className="mt-1.5 max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-slate-950 px-2.5 py-2 font-sans text-[11px] leading-relaxed text-slate-300">
            {mensagem}
          </pre>
        </div>
      )}
    </div>
  );
}
