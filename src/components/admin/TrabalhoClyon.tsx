"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  Coins,
  FileText,
  Loader2,
  MessageCircle,
  Pencil,
  RotateCcw,
  Send,
  StickyNote,
  UserCheck,
  Users,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import type { EstadoFechado } from "@/lib/pedidos-fechados";
import RegistarPedido from "@/components/admin/RegistarPedido";
import { FormularioDaOferta } from "@/components/admin/FormularioDaOferta";
import { servicoEmPalavras } from "@/lib/servico-em-palavras";
import {
  ROTULO_DA_FASE,
  lerValorFixo,
  taxasDoTrabalhoClyon,
  type FaseDaOferta,
  type ModoDaOferta,
} from "@/lib/oferta-clyon";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
import { linkDaPropostaClyon } from "@/lib/proposta-clyon-ao-cliente";
import { linkDaAdjudicacao } from "@/lib/mensagem-de-adjudicacao";
import { contaDoTrabalhoClyon } from "@/lib/conta-do-pagamento";
import ContaDoPagamento from "@/components/ContaDoPagamento";
import ValorETaxaDoTrabalho from "@/components/admin/ValorETaxaDoTrabalho";
import { lerBase, unidadeDaBase, type BaseDoPreco } from "@/lib/base-do-preco";
import { useAvisoDeDataFutura } from "@/components/admin/AvisoDeDataFutura";
import type { CorDoProfissional } from "@/lib/cores-dos-profissionais";
import EtiquetaDaOrigem from "@/components/admin/EtiquetaDaOrigem";
import AvaliarPelaClyon from "@/components/admin/AvaliarPelaClyon";
import TrocarProfissional from "@/components/admin/TrocarProfissional";
import PedidoDetailModal from "@/components/admin/PedidoDetailModal";
import VisorDeFotos from "@/components/VisorDeFotos";
import { telefoneLegivel } from "@/lib/telefone-legivel";
import { MOTIVOS_DE_CANCELAMENTO, avisoDoCancelamento, oQueSeDesfaz } from "@/lib/cancelamento";
import { dataEHoraEmLisboa, instanteDaBase } from "@/lib/hora-de-lisboa";
import { corDaDataDeCriacao } from "@/lib/idade-do-pedido";
import { validarValorDesejado } from "@/lib/pedido-valores";
import TelefoneComWhatsApp from "@/components/admin/TelefoneComWhatsApp";
import { linhaQueAbre } from "@/lib/linha-que-abre";
import { textoDosChoques, type Choque } from "@/lib/choques-de-agenda";

/**
 * OS TRABALHOS CLYON DE VALOR FIXO — o cartão, na Mesa.
 *
 * Foi uma página (o separador «Trabalhos CLYON») de 02-10 a 20-10-2026. A
 * Mesa e os Trabalhos CLYON passaram a um ecrã só — *«que seja recebido e
 * criado tudo num lugar só, em que a gente só decide se ele será um trabalho
 * com valor fixo ou de negociação»* —, e daqui ficam o cartão com as acções
 * (`TrabalhoClyonComAccoes`) e a regra dos blocos (`blocoDoTrabalho`), que a
 * Mesa usa. O que se segue é a história de como nasceram.
 *
 * *«Quero criar uma função no site para gerar trabalhos nas contas dos
 * profissionais (…) são trabalhos que nós já negociámos e já temos os valores,
 * só precisamos de alguém para realizar.»* — 02-10-2026.
 *
 * Três coisas, por esta ordem, que é a ordem em que acontecem:
 *   1. registar o trabalho e oferecê-lo — o «Registar pedido» de sempre, com o
 *      passo do envio trocado pela oferta a valor fixo;
 *   2. escolher quem o faz, entre os que aceitaram;
 *   3. confirmar que está feito — aqui é a CLYON que confirma, e não o cliente.
 *
 * As regras e as decisões do dono estão em `oferta-clyon.ts`.
 */

type NegociacaoDoTrabalho = {
  negociacaoId: number;
  providerId: number;
  profissional: string;
  /** O telefone e quem responde pela empresa — para a adjudicação ao cliente (22-10-2026). */
  telefone?: string | null;
  responsavel?: string | null;
  estado: string;
  modo: ModoDaOferta | null;
  dataCombinada: string | null;
  atribuidaEm: string | null;
  execucaoEnviadaEm: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
  /** A prova do trabalho feito e a nota dada — como na Mesa (19-10-2026). */
  prova: { fotos: string[]; nota: string } | null;
  estrelas: number | null;
  comentario: string | null;
  avaliadoEm: string | null;
  /** Sem factura (21-10-2026): o cliente paga sem IVA. */
  semFactura?: boolean;
  /** Outros trabalhos dele a essa hora (21-10-2026) — ver `choques-de-agenda.ts`. */
  choques?: Choque[];
};

export type TrabalhoClyon = {
  pedidoId: number;
  servico: string | null;
  localidade: string | null;
  morada: string | null;
  dataAgendada: string | null;
  valorFixo: number;
  /** O que o cliente paga, sem IVA — a base da comissão da assistente (08-10-2026). */
  precoAoCliente: number | null;
  /** A taxa (0,10 / 0,15 / 0,20). Nula nos antigos: o valor era o que o pro recebia. */
  taxa: number | null;
  cliente: string | null;
  telefone: string | null;
  estadoDoPedido: string | null;
  criadoEm: string | null;
  /** A nota do pedido — o «Anotar» da Mesa (19-10-2026). */
  notas: string | null;
  /** Quando se abriu, já concluído: sem data, está «por ver». */
  concluidoVistoEm: string | null;
  /** Quando a proposta foi ao cliente (21-10-2026) — nula se ainda não foi, ou se o preço mudou. */
  propostaEnviadaEm?: string | null;
  /** De onde entrou o pedido. */
  origem: string | null;
  /** Pelo trabalho todo, por carga ou por hora (22-10-2026). */
  base?: string | null;
  negociacoes: NegociacaoDoTrabalho[];
  /** O mesmo que `resumoDaOferta` devolve no servidor. */
  resumo: {
    fase: FaseDaOferta;
    enviados: number;
    recusaram: number;
    interessados: NegociacaoDoTrabalho[];
    atribuida: NegociacaoDoTrabalho | null;
  };
};

/**
 * Quem está neste trabalho, para o procurar e filtrar: quem aceitou ou ficou
 * com ele. Oferecido, foi a todos — contar esses punha cada profissional em
 * todos os trabalhos.
 */
export function quemEstaNoTrabalho(t: TrabalhoClyon): NegociacaoDoTrabalho[] {
  return t.negociacoes.filter((n) => n.estado === "aguarda_contratacao" || n.estado === "acordada");
}

/*
 * OS BLOCOS, COMO NA MESA DAS NEGOCIAÇÕES — 19-10-2026.
 *
 * *«Quero que implemente todos os recursos da Mesa das negociações em
 * Trabalhos CLYON.»* — o dono, que escolheu «como a Mesa: cartões + blocos».
 * Eram cinco separadores (Por atribuir, Em curso, Concluídos, Cancelados,
 * Arquivados); passam a blocos, um por cima do outro, pela ordem do que pede
 * alguém: primeiro o que está feito e falta confirmar, depois o que precisa
 * de si (escolher quem o faz, ou ninguém aceitou). Concluídos, Cancelados e
 * Arquivados começam fechados.
 *
 * CONCLUÍDOS, CANCELADOS E ARQUIVADOS SÃO DE TODOS — 17-10-2026. *«Coloque
 * também a opção dos trabalhos arquivados, mas quero que trabalhos
 * arquivados, concluídos e cancelados reúna todos os trabalhos.»* — o dono,
 * que escolheu «todos os pedidos». Nestes três entram também os pedidos
 * normais da plataforma (`estado`), ao lado dos Trabalhos CLYON.
 */
export type Bloco = "feito" | "precisa" | "espera" | "atribuidos" | "concluidos" | "cancelados" | "arquivados";

const BLOCOS: Array<{
  id: Bloco;
  rotulo: string;
  dica: string;
  fases: FaseDaOferta[];
  estado?: EstadoFechado;
  /** Começa fechado: o que já acabou não pede nada a ninguém. */
  fechadoPorOmissao?: boolean;
  /** O cartão de resumo fica em alarme quando tem trabalhos. */
  alarme?: boolean;
  cor: string;
  vazio: string;
}> = [
  {
    id: "feito",
    rotulo: "Feito — confirmar",
    dica: "O profissional diz que está feito. Veja a prova e confirme: o valor passa para a carteira dele.",
    fases: ["por_confirmar"],
    alarme: true,
    cor: "text-amber-300",
    vazio: "Nenhum trabalho à espera de confirmação.",
  },
  {
    id: "precisa",
    rotulo: "Precisa de si",
    dica: "Alguém aceitou e falta escolher quem o faz — ou ninguém aceitou, e é preciso mexer no valor.",
    fases: ["escolher", "sem_ninguem"],
    alarme: true,
    cor: "text-amber-300",
    vazio: "Nada à espera de si.",
  },
  {
    id: "espera",
    rotulo: "À espera de resposta",
    dica: "Oferecido aos profissionais; ainda ninguém aceitou.",
    fases: ["a_espera"],
    cor: "text-slate-200",
    vazio: "Nenhum trabalho à espera de resposta.",
  },
  {
    id: "atribuidos",
    rotulo: "Atribuídos",
    dica: "Já têm quem o faça. Falta o trabalho acontecer — e o profissional dizer que está feito.",
    fases: ["atribuida"],
    cor: "text-cyan-300",
    vazio: "Nenhum trabalho atribuído por fazer.",
  },
  {
    id: "concluidos",
    rotulo: "Concluídos",
    dica: "Confirmados — os Trabalhos CLYON e os pedidos da plataforma.",
    fases: ["confirmada", "paga"],
    estado: "concluido",
    fechadoPorOmissao: true,
    cor: "text-emerald-300",
    vazio: "Ainda nenhum trabalho concluído.",
  },
  // Cancelados antes de feitos: saíram dos profissionais (08-10-2026).
  {
    id: "cancelados",
    rotulo: "Cancelados",
    dica: "Saíram dos profissionais. «Restaurar» volta a pô-los como estavam.",
    fases: ["cancelada"],
    estado: "cancelado",
    fechadoPorOmissao: true,
    cor: "text-slate-400",
    vazio: "Nenhum trabalho cancelado.",
  },
  // Os Trabalhos CLYON aqui são os de pedido arquivado — ver `blocoDoTrabalho`.
  {
    id: "arquivados",
    rotulo: "Arquivados",
    dica: "Arrumados — os Trabalhos CLYON e os pedidos da plataforma.",
    fases: [],
    estado: "arquivado",
    fechadoPorOmissao: true,
    cor: "text-slate-400",
    vazio: "Nenhum trabalho arquivado.",
  },
];

/** O bloco de um Trabalho CLYON: o pedido arquivado manda; senão, a fase. */
export function blocoDoTrabalho(t: { estadoDoPedido: string | null; resumo: { fase: FaseDaOferta } }): Bloco | null {
  if (t.estadoDoPedido === "arquivado") return "arquivados";
  return BLOCOS.find((b) => b.fases.includes(t.resumo.fase))?.id ?? null;
}

/*
 * «ONDE ESTÁ A BOLA», NUMA FRASE — como na Mesa (19-10-2026). Saber, sem
 * abrir nada, de quem é a vez: de quem aceitar, de si (escolher, confirmar),
 * ou do profissional (fazer o trabalho).
 */
function ondeEstaABola(t: TrabalhoClyon): string {
  const r = t.resumo;
  const a = r.atribuida;
  if (t.estadoDoPedido === "arquivado") return "Arquivado.";
  switch (r.fase) {
    case "a_espera":
      return (
        `Oferecido a ${r.enviados} ${r.enviados === 1 ? "profissional" : "profissionais"} — à espera que alguém aceite` +
        (r.recusaram > 0 ? ` · ${r.recusaram} ${r.recusaram === 1 ? "recusou" : "recusaram"}` : "")
      );
    case "escolher":
      // Já com a proposta no cliente, a vez é dele (21-10-2026).
      if (t.propostaEnviadaEm) return `Proposta enviada ao cliente ${quando(t.propostaEnviadaEm)} — à espera da resposta dele`;
      return `${r.interessados.map((n) => n.profissional).join(", ")} ${
        r.interessados.length === 1 ? "aceitou" : "aceitaram"
      } — escolha quem o faz`;
    case "sem_ninguem":
      return `${r.enviados === 1 ? "Quem o recebeu recusou" : `Os ${r.enviados} recusaram`} — mexa no valor ou na taxa`;
    case "atribuida":
      return `${a?.profissional ?? "O profissional"} faz${a?.dataCombinada ? ` ${quando(a.dataCombinada)}` : ""} — falta dizer que está feito`;
    case "por_confirmar":
      return `${a?.profissional ?? "O profissional"} diz que está feito — veja a prova e confirme`;
    case "confirmada":
      return `Confirmado — ${a?.profissional ?? "o profissional"} recebe ${euros(ganhosDe(t))}`;
    case "paga":
      return `Pago a ${a?.profissional ?? "o profissional"}`;
    case "cancelada":
      return "Cancelado — saiu dos profissionais.";
  }
}

/** O porquê de um trabalho estar no «Salte para um», em três palavras. */
export function porqueSaltar(t: TrabalhoClyon): string {
  const r = t.resumo;
  if (r.fase === "por_confirmar") return "diz que está feito";
  if (r.fase === "sem_ninguem") return "ninguém aceitou";
  const n = r.interessados.length;
  return `${n} ${n === 1 ? "aceitou" : "aceitaram"}`;
}

const COR_DA_FASE: Record<FaseDaOferta, string> = {
  escolher: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  a_espera: "border-slate-600 bg-slate-800/60 text-slate-300",
  sem_ninguem: "border-red-500/40 bg-red-500/10 text-red-300",
  atribuida: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  por_confirmar: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  confirmada: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  paga: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  cancelada: "border-slate-600 bg-slate-800/60 text-slate-400",
};

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Cada um a quem foi oferecido, em palavras — a lista da Mesa (19-10-2026). */
const ESTADO_DA_OFERTA: Record<string, { rotulo: string; cor: string }> = {
  aberta: { rotulo: "ainda não respondeu", cor: "bg-slate-800 text-slate-300" },
  aguarda_contratacao: { rotulo: "aceitou", cor: "bg-amber-500/15 text-amber-300" },
  acordada: { rotulo: "ficou com ele", cor: "bg-emerald-500/15 text-emerald-300" },
  desistida: { rotulo: "recusou", cor: "bg-red-500/10 text-red-300" },
  morta: { rotulo: "saiu", cor: "bg-slate-800 text-slate-500" },
};

/** O que o profissional recebe: o valor menos a taxa — nos antigos, o valor todo. */
function ganhosDe(t: { valorFixo: number; taxa: number | null }): number {
  return t.taxa != null ? quantoOProfissionalRecebe(t.valorFixo, taxasDoTrabalhoClyon(t.taxa)) : t.valorFixo;
}

const euros = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(2).replace(".", ",")} €`;

/** «sex., 2 out., 09:00» — em Lisboa, onde o trabalho acontece. */
function quando(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * UM TRABALHO CLYON, COM AS ACÇÕES DELE — 20-10-2026 (a Mesa e os Trabalhos
 * CLYON num só, fase 2). O cartão e tudo o que ele faz — escolher, confirmar,
 * o valor, cancelar com motivo, restaurar, a nota, o «porquê?», voltar a
 * oferecer, avaliar, a proposta, a ficha e o editor — num componente só, para
 * a Mesa o pôr nos blocos dela. Cada acção vai pela rota
 * dos Trabalhos CLYON e diz a quem o mostra o que aconteceu (`onAviso`,
 * `onErro`); as janelas são dele.
 */
export function TrabalhoClyonComAccoes({
  t,
  cor = null,
  corDoBloco,
  abrirAoInicio = false,
  marcado,
  onMarcar,
  comTipo = false,
  onMudou,
  onAviso,
  onErro,
  onRestaurado,
}: {
  t: TrabalhoClyon;
  cor?: CorDoProfissional | null;
  /** Na Mesa: a cor do bloco onde está, como as negociações (`corDoCartao`). */
  corDoBloco?: string;
  abrirAoInicio?: boolean;
  marcado?: boolean;
  onMarcar?: () => void;
  /** Na Mesa, ao lado das negociações: a etiqueta «Valor fixo». */
  comTipo?: boolean;
  /** Mudou alguma coisa — quem o mostra volta a ler a lista. */
  onMudou: () => void;
  onAviso: (texto: string) => void;
  onErro: (texto: string) => void;
  /** Restaurado: quem o mostra leva o ecrã até ele. */
  onRestaurado?: (pedidoId: number) => void;
}) {
  const { token } = useAdminAuth();
  const [ocupado, setOcupado] = useState<number | null>(null);
  // A tela vermelha dos trabalhos que ainda não estão na data — 14-10-2026.
  const { confirmarSeFuturo, aviso: avisoDeData } = useAvisoDeDataFutura();
  /** A nota e o «visto» mudam já no ecrã, antes de a lista voltar. */
  const [notaAqui, setNotaAqui] = useState<string | null | undefined>(undefined);
  const [vistoAqui, setVistoAqui] = useState(false);
  useEffect(() => setNotaAqui(undefined), [t.notas]);
  const tAqui: TrabalhoClyon = {
    ...t,
    notas: notaAqui === undefined ? t.notas : notaAqui,
    concluidoVistoEm: t.concluidoVistoEm ?? (vistoAqui ? new Date().toISOString() : null),
  };

  async function agir(url: string, corpo: Record<string, unknown>, negociacaoId: number, feito: string) {
    if (!token) return;
    setOcupado(negociacaoId);
    onErro("");
    onAviso("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        onErro(dados.error ?? "Não foi possível.");
        return;
      }
      onAviso(feito);
      onMudou();
    } catch {
      onErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  function escolher(n: NegociacaoDoTrabalho) {
    const outros = t.resumo.interessados.length - 1;
    if (
      !window.confirm(
        `Dar o trabalho #${t.pedidoId} a ${n.profissional}? Recebe ${euros(ganhosDe(t))}.` +
          (outros > 0 ? `\n\n${outros === 1 ? "O outro que aceitou fica" : `Os outros ${outros} que aceitaram ficam`} de fora.` : ""),
      )
    ) {
      return;
    }
    void agir(
      "/api/admin/trabalhos-clyon/escolher",
      { negociacaoId: n.negociacaoId },
      n.negociacaoId,
      `#${t.pedidoId} atribuído a ${n.profissional}. Foi avisado por email e WhatsApp.`,
    );
  }

  async function confirmar(n: NegociacaoDoTrabalho, semProva: boolean) {
    if (
      !(await confirmarSeFuturo(
        [{ pedidoId: t.pedidoId, quando: n.dataCombinada ?? t.dataAgendada }],
        "confirmar que este trabalho está feito",
      ))
    )
      return;
    if (
      !window.confirm(
        semProva
          ? `${n.profissional} ainda não deu o #${t.pedidoId} por feito. Confirmar mesmo assim?\n\nO que recebe (${euros(ganhosDe(t))}) fica disponível na carteira dele.`
          : `Confirmar que o #${t.pedidoId} está feito?\n\nO que recebe (${euros(ganhosDe(t))}) fica disponível na carteira de ${n.profissional}.`,
      )
    ) {
      return;
    }
    void agir(
      "/api/admin/trabalhos-clyon/confirmar",
      { negociacaoId: n.negociacaoId, semProva },
      n.negociacaoId,
      `#${t.pedidoId} confirmado. O valor está na carteira de ${n.profissional}.`,
    );
  }

  /*
   * MEXER NUM TRABALHO JÁ OFERECIDO — 08-10-2026. O valor e a taxa (quem já
   * o tinha aceite volta a ter de aceitar), o cancelamento (todos avisados),
   * e o preço ao cliente dos antigos. A rota escreve no histórico do pedido
   * quem mudou, de quanto para quanto.
   */
  async function mexer(corpo: Record<string, unknown>, feito: (d: Record<string, unknown>) => string): Promise<boolean> {
    if (!token) return false;
    setOcupado(t.pedidoId);
    onErro("");
    onAviso("");
    try {
      const res = await fetch("/api/admin/trabalhos-clyon", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId: t.pedidoId, ...corpo }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        onErro(dados.error ?? "Não foi possível guardar.");
        return false;
      }
      onAviso(feito(dados));
      onMudou();
      return true;
    } catch {
      onErro("Erro de rede.");
      return false;
    } finally {
      setOcupado(null);
    }
  }

  const guardarPreco = (texto: string) =>
    mexer({ accao: "preco", precoAoCliente: texto }, (d) =>
      `#${t.pedidoId}: preço ao cliente ${euros(Number(d.precoAoCliente))} sem IVA.`,
    );

  const guardarValor = (valor: string, taxa: number, base: BaseDoPreco) =>
    mexer({ accao: "valor", valor, taxa, base }, (d) => String(d.feito ?? `#${t.pedidoId}: valor mudado.`));

  /*
   * RESTAURAR — 16-10-2026, *«coloque a opção de restaurar pedido cancelado»*.
   * O outro lado do cancelar: volta como estava, a quem o tinha ou a quem
   * estava oferecido, com o mesmo valor — e sem avisar ninguém (decisão do
   * dono). Depois quem o mostra leva o ecrã até ele (`onRestaurado`).
   */
  function restaurar(t: TrabalhoClyon) {
    if (
      !window.confirm(
        `Restaurar o trabalho #${t.pedidoId}?\n\nVolta como estava antes de ser cancelado: a quem o tinha, ou aos profissionais a quem estava oferecido, com o mesmo valor. Ninguém é avisado.`,
      )
    ) {
      return;
    }
    void mexer({ accao: "restaurar" }, (d) => `#${t.pedidoId}: ${String(d.feito ?? "restaurado.")}`).then((ok) => {
      if (ok) onRestaurado?.(t.pedidoId);
    });
  }

  /*
   * O «ANOTAR» — a mesma nota do pedido que a Mesa escreve (`notasInternas`),
   * pela mesma rota. 19-10-2026.
   */
  async function guardarNota(texto: string): Promise<boolean> {
    if (!token) return false;
    const limpo = texto.trim().slice(0, 500);
    setNotaAqui(limpo || null);
    try {
      const res = await fetch(`/api/admin/pedidos/${t.pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notasInternas: limpo || null }),
      });
      if (!res.ok) {
        onErro("Não foi possível guardar a nota.");
        return false;
      }
      return true;
    } catch {
      onErro("Erro de rede.");
      return false;
    } finally {
      onMudou();
    }
  }

  /*
   * «PORQUÊ?» — quantos profissionais o trabalho alcança hoje e porque não
   * chega aos outros, pela mesma rota da Mesa. Só quando se pergunta.
   */
  const [alcance, setAlcance] = useState<string | undefined>(undefined);
  async function porquePoucos(pedidoId: number) {
    if (!token || alcance === "a-ler") return;
    setAlcance("a-ler");
    try {
      const res = await fetch(`/api/admin/negociacoes/alcance?pedidoId=${pedidoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) {
        setAlcance(d.error ?? "Não foi possível calcular.");
        return;
      }
      const chegam = d.elegiveis?.length ?? 0;
      const fora = (d.candidatos ?? 0) - chegam;
      setAlcance(
        fora > 0 && d.porque
          ? `Hoje chegaria a ${chegam} de ${d.candidatos}. Os outros ${fora}: ${d.porque}.`
          : `Hoje chegaria a ${chegam} de ${d.candidatos} — não há ninguém de fora.`,
      );
    } catch {
      setAlcance("Erro de rede.");
    }
  }

  /*
   * O CONCLUÍDO «POR VER» — como na Mesa: abrir um concluído que ainda não
   * se viu é vê-lo; o carimbo grava-se e o destaque apaga-se.
   */
  function marcarVisto() {
    if (!token) return;
    // Pela rota dos Trabalhos CLYON: um assistente só com esta secção não abre a da Mesa.
    void fetch("/api/admin/trabalhos-clyon", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ accao: "visto", pedidoId: t.pedidoId }),
    }).catch(() => {});
    setVistoAqui(true);
  }

  /*
   * OS RECURSOS DA MESA NO TRABALHO — 19-10-2026: voltar a oferecer a quem
   * recusou, dar a nota, mandar a proposta pela CLYON, cancelar com motivo e
   * abrir a ficha com o histórico.
   */
  const reoferecer = (negociacaoId: number | null) => {
    const quem = negociacaoId == null ? "a todos os que recusaram" : `a ${t.negociacoes.find((n) => n.negociacaoId === negociacaoId)?.profissional ?? "esse profissional"}`;
    if (!window.confirm(`Voltar a oferecer o #${t.pedidoId} ${quem}, com o mesmo valor?\n\nVolta a aparecer-lhe para aceitar ou recusar, e é avisado por WhatsApp.`)) return;
    void mexer({ accao: "reoferecer", negociacaoId }, (d) => String(d.feito ?? `#${t.pedidoId} oferecido outra vez.`));
  };

  async function avaliar(n: NegociacaoDoTrabalho, estrelas: number, comentario: string | undefined): Promise<string | null> {
    if (!token) return "Sem sessão.";
    try {
      const res = await fetch("/api/admin/trabalhos-clyon", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId: t.pedidoId, accao: "avaliar", negociacaoId: n.negociacaoId, estrelas, comentario }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return d.error ?? "Não foi possível avaliar.";
      onAviso(`#${t.pedidoId}: nota de ${estrelas} ${estrelas === 1 ? "estrela" : "estrelas"} dada a ${n.profissional}.`);
      onMudou();
      return null;
    } catch {
      return "Erro de rede.";
    }
  }

  // O link do WhatsApp abriu: conta como enviada (21-10-2026).
  const propostaAberta = () => {
    void mexer({ accao: "proposta_aberta" }, (d) => String(d.feito ?? "Proposta enviada."));
  };

  // «Já enviei»: a proposta seguiu por telefone ou noutro canal (21-10-2026).
  const jaEnviei = () => {
    void mexer({ accao: "ja_enviei" }, (d) => String(d.feito ?? "Marcado como enviado."));
  };

  const enviarProposta = () => {
    if (!window.confirm(`Enviar a proposta do #${t.pedidoId} ao cliente, pelo WhatsApp da CLYON?\n\nA conversa fica com a CLYON.`)) return;
    void mexer({ accao: "proposta" }, (d) => String(d.feito ?? "Proposta enviada."));
  };

  // Cancelar abre a janela com os motivos da Mesa (19-10-2026).
  const [aCancelar, setACancelar] = useState<TrabalhoClyon | null>(null);
  async function cancelarComMotivo(t: TrabalhoClyon, motivo: string): Promise<string | null> {
    if (!token) return "Sem sessão.";
    try {
      const res = await fetch("/api/admin/trabalhos-clyon", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId: t.pedidoId, accao: "cancelar", motivo }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return d.error ?? "Não foi possível cancelar.";
      onAviso(String(d.feito ?? `#${t.pedidoId} cancelado.`));
      onMudou();
      return null;
    } catch {
      return "Erro de rede.";
    }
  }

  /*
   * PASSAR A NEGOCIAÇÃO — 20-10-2026 (a Mesa e os Trabalhos CLYON num só, fase
   * 4). Ninguém aceitou o valor fixo: a oferta sai (`para_negociacao`), e o
   * pedido vai aos profissionais pela rota de sempre do «Negociação» — cada um
   * propõe o seu valor.
   *
   * O VALOR DE PARTIDA PERGUNTA-SE — 20-10-2026. Ia sempre a conta da CLYON,
   * e o #469 (300 € fixo, o cliente aceitou 250 €) saiu a 70 €: foi preciso
   * editar o pedido, e editar recomeçou-o do zero e avisou toda a gente outra
   * vez. A caixa vem com o preço ao cliente que o trabalho tinha; vazia, vai a
   * conta da CLYON, como no «Negociação».
   */
  async function passarANegociacao() {
    if (!token) return;
    const tinha = t.precoAoCliente ?? (t.taxa != null ? t.valorFixo : null);
    const escrito = window.prompt(
      `Passar o #${t.pedidoId} a negociação?

A oferta a valor fixo sai dos profissionais, e o pedido vai-lhes como negociação — cada um propõe o seu valor.

Valor de partida, sem IVA (o que o cliente paga). Corrija-o se o cliente aceitou outro; vazio, vai a conta da CLYON.`,
      tinha != null ? String(tinha).replace(".", ",") : "",
    );
    if (escrito === null) return;
    // Antes de a oferta sair: um valor que a rota recusa deixava o pedido a meio.
    const valor = escrito.trim() === "" ? null : validarValorDesejado(escrito);
    if (valor && !valor.ok) {
      onErro(`#${t.pedidoId}: ${valor.erros[0].mensagem} Não mudou nada.`);
      return;
    }
    if (!(await mexer({ accao: "para_negociacao" }, (d) => String(d.feito ?? "")))) return;
    setOcupado(t.pedidoId);
    try {
      const res = await fetch("/api/admin/negociacoes/promover", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pedidoId: t.pedidoId,
          ...(valor?.ok ? { valor: valor.valores.valorDesejadoCliente } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) onAviso(`#${t.pedidoId} passou a negociação e foi enviado aos profissionais.`);
      else onErro(`#${t.pedidoId} passou a negociação, mas não foi enviado: ${d.error ?? "não foi possível"}. Use «Reenviar aos profissionais» na Mesa.`);
    } catch {
      onErro(`#${t.pedidoId} passou a negociação, mas não foi enviado (erro de rede). Use «Reenviar aos profissionais» na Mesa.`);
    } finally {
      setOcupado(null);
      onMudou();
    }
  }

  /** A ficha do pedido, com o histórico — a mesma da Mesa. */
  const [fichaId, setFichaId] = useState<number | null>(null);
  /** O editor do pedido, por cima de tudo. */
  const [aEditar, setAEditar] = useState<number | null>(null);

  return (
    <CartaoDoTrabalho
      t={tAqui}
      cor={cor}
      corDoBloco={corDoBloco}
      abrirAoInicio={abrirAoInicio}
      onPassarANegociacao={() => void passarANegociacao()}
      ocupado={ocupado}
      comTipo={comTipo}
      onEscolher={escolher}
      onConfirmar={(n, semProva) => void confirmar(n, semProva)}
      onEditar={() => setAEditar(t.pedidoId)}
      onPreco={guardarPreco}
      onValor={guardarValor}
      onCancelar={() => setACancelar(t)}
      onRestaurar={() => restaurar(t)}
      onNota={guardarNota}
      alcance={alcance}
      onPorque={() => void porquePoucos(t.pedidoId)}
      onVisto={marcarVisto}
      onReoferecer={reoferecer}
      onAvaliar={avaliar}
      onEnviarProposta={enviarProposta}
      onPropostaAberta={propostaAberta}
      onJaEnviei={jaEnviei}
      onFicha={() => setFichaId(t.pedidoId)}
      onMudou={onMudou}
      marcado={marcado}
      onMarcar={onMarcar}
      janelas={
        <>
          {avisoDeData}
          {aCancelar && (
            <JanelaDeCancelarTrabalho
              t={aCancelar}
              onFechar={() => setACancelar(null)}
              onCancelar={async (motivo) => {
                const falhou = await cancelarComMotivo(aCancelar, motivo);
                if (!falhou) setACancelar(null);
                return falhou;
              }}
            />
          )}

          {/* A ficha e o histórico do pedido — a mesma da Mesa (19-10-2026). */}
          {fichaId != null && token && (
            <PedidoDetailModal
              id={fichaId}
              token={token}
              isAdmin
              permitirApagar={false}
              onClose={() => setFichaId(null)}
              onUpdated={() => onMudou()}
            />
          )}

          {/*
            EDITAR O PEDIDO — 07-10-2026, «deixe a opção de editar o pedido».

            O mesmo editor da Agenda e das Negociações, por cima da lista. Num
            Trabalho CLYON gravar não recomeça nada: a oferta segue com quem a
            recebeu, com o mesmo valor fixo (`recomecar-do-zero.ts`).

            Fecha pelo botão, e só pelo botão: são catorze campos e fotografias, e
            um clique ao lado não pode deitá-los fora.
          */}
          {aEditar != null && (
            <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#0B1220] p-4 sm:p-8">
              <div className="mx-auto max-w-5xl">
                <RegistarPedido
                  editarId={aEditar}
                  onCriado={() => onMudou()}
                  onFechar={() => {
                    setAEditar(null);
                    onMudou();
                  }}
                  /*
                    A CÓPIA, E SÓ A CÓPIA — 16-10-2026 («Duplicar»). O pedido em
                    edição não se reoferece daqui; a cópia é um pedido novo, e
                    oferece-se como um Trabalho CLYON novo, com o valor e a taxa
                    do original já escritos.
                  */
                  ofertaDaCopia={(r, original) => (
                    <FormularioDaOferta
                      token={token}
                      pedidoId={r.id}
                      alcance={r.alcance}
                      referencia={r.valorDePartida}
                      baseInicial={r.base}
                      valorInicial={original.valor}
                      taxaInicial={original.taxa}
                      onOferecido={(msg) => {
                        onAviso(msg);
                        onMudou();
                      }}
                    />
                  )}
                />
              </div>
            </div>
          )}
        </>
      }
    />
  );
}

function CartaoDoTrabalho({
  t,
  cor = null,
  abrirAoInicio = false,
  ocupado,
  onEscolher,
  onConfirmar,
  onEditar,
  onPreco,
  onValor,
  onCancelar,
  onRestaurar,
  onNota,
  alcance,
  onPorque,
  onVisto,
  onReoferecer,
  onAvaliar,
  onEnviarProposta,
  onPropostaAberta,
  onJaEnviei,
  onFicha,
  onMudou,
  marcado = false,
  onMarcar,
  comTipo = false,
  corDoBloco,
  onPassarANegociacao,
  janelas,
}: {
  t: TrabalhoClyon;
  /** A cor deste trabalho na lista — contorno, faixa, fundo e título. */
  cor?: CorDoProfissional | null;
  /** Abre já com o detalhe — quando é o único na lista. */
  abrirAoInicio?: boolean;
  ocupado: number | null;
  onEscolher: (n: NegociacaoDoTrabalho) => void;
  onConfirmar: (n: NegociacaoDoTrabalho, semProva: boolean) => void;
  onEditar: () => void;
  onPreco: (texto: string) => Promise<boolean>;
  onValor: (valor: string, taxa: number, base: BaseDoPreco) => Promise<boolean>;
  onCancelar: () => void;
  onRestaurar: () => void;
  /** O «Anotar» da Mesa — 19-10-2026. */
  onNota: (texto: string) => Promise<boolean>;
  /** O «porquê?» do alcance: undefined (não perguntado), «a-ler», ou a resposta. */
  alcance?: string;
  onPorque: () => void;
  /** Abrir um concluído por ver é vê-lo. */
  onVisto: () => void;
  /** Voltar a oferecer a quem recusou — a um, ou a todos (`null`). */
  onReoferecer: (negociacaoId: number | null) => void;
  onAvaliar: (n: NegociacaoDoTrabalho, estrelas: number, comentario: string | undefined) => Promise<string | null>;
  onEnviarProposta: () => void;
  onPropostaAberta: () => void;
  onJaEnviei: () => void;
  onFicha: () => void;
  onMudou: () => void;
  /** Marcado para as acções em lote — 19-10-2026, como na Mesa. */
  marcado?: boolean;
  onMarcar?: () => void;
  /** Na Mesa: a etiqueta «Valor fixo» (20-10-2026). */
  comTipo?: boolean;
  /** Na Mesa: a cor do bloco, com o traço à esquerda (20-10-2026). */
  corDoBloco?: string;
  /** Ninguém aceitou: passa a negociação (20-10-2026, fase 4). */
  onPassarANegociacao?: () => void;
  /** As janelas do cartão (cancelar, a ficha, o editor) — `TrabalhoClyonComAccoes`. */
  janelas?: ReactNode;
}) {
  const r = t.resumo;
  const a = r.atribuida;
  const dia = quando(a?.dataCombinada ?? t.dataAgendada);
  /*
   * FECHADO ATÉ SE CLICAR — 17-10-2026, *«Vamos deixar por padrão os pedidos
   * fechados e só abrir com as informações detalhadas quando forem
   * clicados.»* Fechado, vê-se a linha de cima: o número, o serviço, o
   * cliente, o estado e o valor. A conta, os profissionais e os botões ficam
   * por baixo, ao abrir.
   */
  const [aberto, setAberto] = useState(abrirAoInicio);
  useEffect(() => {
    if (abrirAoInicio) setAberto(true);
  }, [abrirAoInicio]);
  const porVer = (r.fase === "confirmada" || r.fase === "paga") && !t.concluidoVistoEm;
  const [aEscreverNota, setAEscreverNota] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [aGuardarNota, setAGuardarNota] = useState(false);
  /** A fotografia aberta da prova, ou nenhuma. */
  const [fotoAberta, setFotoAberta] = useState<number | null>(null);
  const guardar = async (texto: string) => {
    setAGuardarNota(true);
    if (await onNota(texto)) setAEscreverNota(false);
    setAGuardarNota(false);
  };
  const entrou = instanteDaBase(t.criadoEm);
  const telefone = telefoneLegivel(t.telefone) || t.telefone;
  const [aMudarPreco, setAMudarPreco] = useState(false);
  const [precoEscrito, setPrecoEscrito] = useState("");
  const [aMudarValor, setAMudarValor] = useState(false);
  const [valorEscrito, setValorEscrito] = useState("");
  const [taxaEscolhida, setTaxaEscolhida] = useState<number | null>(null);
  const [baseEscolhida, setBaseEscolhida] = useState<BaseDoPreco>("total");
  /*
   * MUDA-SE ATÉ ESTAR FEITO — 08-10-2026. Depois de o profissional dar o
   * trabalho por feito, o dinheiro já tem dono, e o valor não se mexe aqui.
   */
  const aindaSeMuda = (["escolher", "a_espera", "sem_ninguem", "atribuida"] as FaseDaOferta[]).includes(r.fase);
  const ganhos = ganhosDe(t);
  /*
   * A PROPOSTA NO WHATSAPP DO CLIENTE — 08-10-2026. Sem preço ao cliente (um
   * antigo sem ele) ou sem telemóvel que abra no WhatsApp, não há botão; e
   * num cancelado não há proposta nenhuma a fazer.
   */
  const proposta =
    r.fase === "cancelada"
      ? null
      : linkDaPropostaClyon({ ...t, quando: a?.dataCombinada ?? t.dataAgendada }, new Date());
  /*
   * A ADJUDICAÇÃO NO WHATSAPP DO CLIENTE — 21-10-2026. Há profissional e o
   * trabalho ainda está por fazer: «Excelente, Daniela! O serviço fica então
   * agendado e adjudicado…», com os métodos de pagamento. Ver
   * `mensagem-de-adjudicacao.ts`.
   */
  const adjudicacao =
    r.fase === "atribuida" && a && !a.confirmadoEm
      ? linkDaAdjudicacao(
          {
            ...t,
            quando: a.dataCombinada ?? t.dataAgendada,
            empresa: a.profissional,
            responsavel: a.responsavel ?? null,
            telefoneDaEmpresa: a.telefone ?? null,
          },
          new Date(),
        )
      : null;
  /*
   * Para onde vai o dinheiro, degrau a degrau (15-10-2026): num cancelado, a
   * lado nenhum. Concluído (confirmado ou já pago ao profissional), o
   * dinheiro do cliente conta como recebido — é o que a carteira já assume
   * de um Trabalho CLYON (`oClientePagou`).
   */
  const conta =
    r.fase === "cancelada" ? null : contaDoTrabalhoClyon(t, r.fase === "confirmada" || r.fase === "paga", Boolean(a?.semFactura));

  return (
    <li id={`trabalho-${t.pedidoId}`} className={`scroll-mt-16 rounded-2xl border px-3 py-2 ${cor ? `border-l-4 ${cor.grupo}` : corDoBloco ? `border-l-4 ${corDoBloco}` : "border-slate-800 bg-slate-900/60"}${porVer ? " ring-2 ring-emerald-400/60" : ""}`}>
      <div className="flex items-start gap-2.5">
      {/* Marcar, para as acções em lote — fora do botão que abre o cartão. */}
      {onMarcar && (
        <input
          type="checkbox"
          checked={marcado}
          onChange={onMarcar}
          aria-label={`Seleccionar o trabalho #${t.pedidoId}`}
          className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-slate-600 bg-slate-950 accent-cyan-500"
        />
      )}
      {/*
        A LINHA QUE ABRE — um botão até 21-10-2026; passou a `linhaQueAbre`,
        como na Mesa, para o telemóvel dentro dela poder ser um link (abre o
        WhatsApp do cliente) sem abrir o cartão.
      */}
      <div
        {...linhaQueAbre(() => {
          if (porVer && !aberto) onVisto();
          setAberto((v) => !v);
        }, `${aberto ? "Fechar" : "Abrir"} o trabalho #${t.pedidoId}`)}
        aria-expanded={aberto}
        className="flex min-w-0 flex-1 cursor-pointer flex-wrap items-start justify-between gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
      >
        <div className="min-w-0">
          {/*
            O NÚMERO E O NOME À FRENTE — 21-10-2026. *«Coloque o nome dos clientes depois do número do pedido; a categoria (mudança, recolha de monos…) coloque-a em baixo — o número do pedido e o nome do cliente com mais destaque.»* — o dono.
          */}
          <p className={`flex items-center gap-1.5 text-[15px] font-bold ${cor ? cor.nome : "text-white"}`}>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${aberto ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
            #{t.pedidoId} · {t.cliente || "Cliente sem nome"}
            {/* «POR VER» ESCRITO — 22-10-2026: o realce verde não se via no bloco verde dos Concluídos. */}
            {porVer && (
              <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-950">
                Por ver
              </span>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-200">{maiuscula(servicoEmPalavras(t.servico))}</span>
            <span>
              {[t.localidade, dia ? `${a?.dataCombinada ? "Dia marcado" : "Dia pedido"}: ${dia}` : "Sem dia"]
                .filter(Boolean)
                .map((x) => `· ${x}`)
                .join(" ")}
            </span>
            {/* O telemóvel abre o WhatsApp do cliente (21-10-2026). */}
            {telefone && (
              <>
                <span aria-hidden="true">·</span>
                <TelefoneComWhatsApp telefone={t.telefone} className="tabular-nums text-cyan-300" />
              </>
            )}
            {/* O tipo, na Mesa ao lado das negociações (20-10-2026). */}
            {comTipo && (
              <span className="rounded-full border border-ciano/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ciano-texto">
                Valor fixo
              </span>
            )}
            {/* De onde entrou, e quando — como na Mesa (19-10-2026). */}
            <EtiquetaDaOrigem slug={t.origem} />
          </p>
        </div>
        {/*
          A DIREITA EM DUAS LINHAS — 23-10-2026, *«aproveitar o espaço»*: eram
          quatro (a fase, o valor, a conta, a data), e o cartão crescia para
          caber nelas com o meio vazio. Em cima a fase e o valor; em baixo a
          conta e a data, ainda em destaque.
        */}
        <div className="text-right">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${COR_DA_FASE[r.fase]}`}>
              {ROTULO_DA_FASE[r.fase]}
            </span>
            {r.fase === "escolher" && (
              <span className="inline-block rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                {r.interessados.length} {r.interessados.length === 1 ? "aceitou" : "aceitaram"}
              </span>
            )}
            <span className={`text-[15px] font-bold tabular-nums ${t.taxa != null ? "text-white" : "text-emerald-300"}`}>
              {euros(t.valorFixo)}
              {lerBase(t.base) !== "total" && <span className="text-xs text-amber-300">{unidadeDaBase(lerBase(t.base))}</span>}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {t.taxa != null ? (
              <>
                valor sem IVA · taxa {Math.round(t.taxa * 100)} % · o pro recebe{" "}
                <span className="font-semibold text-emerald-300">{euros(ganhos)}</span>
              </>
            ) : (
              "valor fixo · o que o pro recebe"
            )}
            {/* QUANDO ENTROU, À DIREITA E EM DESTAQUE — 20-10-2026: branco até 7 dias, depois vermelho. */}
            {entrou && (
              <>
                {" · "}
                <span
                  title="Data em que o pedido foi criado"
                  className={`whitespace-nowrap text-xs font-bold tabular-nums ${corDaDataDeCriacao(t.criadoEm, new Date())}`}
                >
                  {dataEHoraEmLisboa(entrou)}
                </span>
              </>
            )}
          </p>
        </div>
      </div>
      </div>

      {/* Onde está a bola, sempre à vista — como na Mesa (19-10-2026). E o «Anotar» ao lado (23-10-2026). */}
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <p className="text-[11px] text-slate-300">
        {ondeEstaABola(t)}
        {(r.fase === "a_espera" || r.fase === "sem_ninguem") && (
          <>
            {" · "}
            <button
              type="button"
              onClick={onPorque}
              className="font-semibold text-cyan-400 underline decoration-cyan-700 underline-offset-2 hover:text-cyan-300"
            >
              {alcance === "a-ler" ? "a ver…" : "porquê?"}
            </button>
          </>
        )}
      </p>
      {!aEscreverNota && !t.notas && (
        <button
          onClick={() => {
            setRascunho("");
            setAEscreverNota(true);
          }}
          className="flex items-center gap-1 text-[10px] text-slate-500 transition hover:text-amber-300"
        >
          <StickyNote className="h-3 w-3" aria-hidden="true" />
          Anotar
        </button>
      )}
      </div>
      {alcance && alcance !== "a-ler" && <p className="mt-1 text-xs leading-relaxed text-amber-300/90">{alcance}</p>}

      {/* O «Anotar» — a mesma nota do pedido que a Mesa escreve (19-10-2026). */}
      {aEscreverNota ? (
        <div className="mt-1.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-2.5">
          <textarea
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => {
              // Enter guarda, Shift+Enter muda de linha — como na Mesa.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void guardar(rascunho);
              }
              if (e.key === "Escape") setAEscreverNota(false);
            }}
            rows={2}
            autoFocus
            maxLength={500}
            placeholder="Ex.: o cliente prefere de manhã"
            className="w-full resize-none rounded-lg border border-slate-600 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => void guardar(rascunho)}
              disabled={aGuardarNota}
              className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {aGuardarNota ? "A guardar…" : "Guardar"}
            </button>
            <button
              onClick={() => setAEscreverNota(false)}
              disabled={aGuardarNota}
              className="rounded-lg border border-slate-600 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800 disabled:opacity-50"
            >
              Cancelar
            </button>
            {t.notas && (
              <button
                onClick={() => void guardar("")}
                disabled={aGuardarNota}
                className="text-[11px] text-slate-500 underline hover:text-red-300 disabled:opacity-50"
              >
                Apagar a nota
              </button>
            )}
            <span className="ml-auto text-[10px] text-slate-500">A mesma nota da Mesa e do ecrã do pedido.</span>
          </div>
        </div>
      ) : t.notas ? (
        <button
          onClick={() => {
            setRascunho(t.notas ?? "");
            setAEscreverNota(true);
          }}
          className="mt-1.5 flex w-full items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-2.5 py-1 text-left transition hover:border-amber-400/50"
        >
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
          <span className="whitespace-pre-line break-words text-xs leading-relaxed text-amber-200/90">{t.notas}</span>
        </button>
      ) : null}

      {aberto && (
        <>
      {/*
        PARA ONDE VAI O DINHEIRO — 15-10-2026. *«Deixe aqui quanto foi pago
        pelo cliente, quanto vamos passar à empresa parceira e quanto a CLYON
        fica.»* Dizia só «fica para a CLYON», e o que o pro recebe mais o que
        a CLYON fica não dava o que o cliente paga: faltava o IVA, que passa
        para a empresa parceira que emite a factura. As quatro partes somam o
        total ao cêntimo (`contas-do-trabalho-clyon.ts`).

        Num trabalho antigo (o valor era o que o pro recebia) a conta sai do
        preço ao cliente escrito à parte — sem ele não há conta, e a comissão
        da assistente conta zero aqui e o período dela não se pode marcar
        como pago. Por isso continua o «Escrever» e o «mudar».
      */}
      {aMudarPreco ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Preço ao cliente, sem IVA</span>
          <input
            inputMode="decimal"
            autoFocus
            value={precoEscrito}
            onChange={(e) => setPrecoEscrito(e.target.value)}
            placeholder="400,00"
            aria-label={`Preço ao cliente do #${t.pedidoId}, sem IVA`}
            className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm font-semibold tabular-nums text-white outline-none focus:border-cyan-500"
          />
          <span className="text-slate-400">€</span>
          <button
            onClick={async () => {
              if (await onPreco(precoEscrito)) setAMudarPreco(false);
            }}
            disabled={ocupado === t.pedidoId || precoEscrito.trim() === ""}
            className="rounded-lg bg-acao px-2.5 py-1 font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
          >
            Guardar
          </button>
          <button
            onClick={() => setAMudarPreco(false)}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </button>
        </div>
      ) : conta ? (
        <div className="mt-3 sm:max-w-xl">
          <ContaDoPagamento conta={conta} />
          {t.taxa == null && (
            <p className="mt-1.5 text-xs text-slate-400">
              Trabalho antigo — preço ao cliente {euros(conta.semIva)} sem IVA ·{" "}
              <button
                onClick={() => {
                  setPrecoEscrito(conta.semIva.toFixed(2).replace(".", ","));
                  setAMudarPreco(true);
                }}
                className="underline decoration-slate-600 underline-offset-2 hover:text-slate-200"
              >
                mudar
              </button>
            </p>
          )}
        </div>
      ) : t.taxa == null && r.fase !== "cancelada" ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-200">
            Falta o preço ao cliente
          </span>
          <button
            onClick={() => {
              setPrecoEscrito("");
              setAMudarPreco(true);
            }}
            className="rounded-lg border border-amber-500/40 px-2.5 py-1 font-semibold text-amber-200 hover:bg-amber-500/10"
          >
            Escrever
          </button>
        </div>
      ) : null}

      {aMudarValor && (
        <div className="mt-3 space-y-3 rounded-xl border border-cyan-900/60 bg-slate-950/60 p-3">
          <ValorETaxaDoTrabalho
            valor={valorEscrito}
            taxa={taxaEscolhida}
            onValor={setValorEscrito}
            onTaxa={setTaxaEscolhida}
            base={baseEscolhida}
            onBase={setBaseEscolhida}
          />
          {t.taxa == null && (
            <p className="rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
              Trabalho antigo: {euros(t.valorFixo)} era o que o profissional recebia. Ao gravar com uma
              taxa, o valor passa a ser o preço ao cliente, sem IVA — e o profissional recebe o que
              aparece em cima.
            </p>
          )}
          <p className="text-[11px] text-slate-400">
            {a
              ? `${a.profissional} já o tem: fica com ele se aceitar o valor novo — e é avisado. Se recusar, volta a ser oferecido aos outros.`
              : "Quem já o aceitou volta a ter de aceitar o valor novo, e é avisado por WhatsApp."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (taxaEscolhida != null && (await onValor(valorEscrito, taxaEscolhida, baseEscolhida))) setAMudarValor(false);
              }}
              disabled={ocupado === t.pedidoId || !lerValorFixo(valorEscrito).ok || taxaEscolhida == null}
              className="rounded-lg bg-acao px-3 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
            >
              Guardar valor e taxa
            </button>
            <button
              onClick={() => setAMudarValor(false)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/*
        A QUEM FOI OFERECIDO — 19-10-2026, a lista da Mesa: cada um com o que
        fez, e «Voltar a oferecer» a quem recusou, enquanto ninguém o tem.
      */}
      {t.negociacoes.length > 0 && (
        <details className="mt-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs" open={r.fase === "sem_ninguem"}>
          <summary className="cursor-pointer font-semibold text-slate-300">
            A quem foi oferecido · {t.negociacoes.length}
          </summary>
          <ul className="mt-2 space-y-1.5">
            {t.negociacoes.map((n) => {
              const e = ESTADO_DA_OFERTA[n.estado] ?? { rotulo: n.estado, cor: "bg-slate-800 text-slate-300" };
              const recusou = n.estado === "desistida" || n.estado === "morta";
              return (
                <li key={n.negociacaoId} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-200">{n.profissional}</span>
                  <span className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.cor}`}>{e.rotulo}</span>
                    {!a && recusou && r.fase !== "cancelada" && (
                      <button
                        type="button"
                        onClick={() => onReoferecer(n.negociacaoId)}
                        disabled={ocupado === t.pedidoId}
                        className="rounded-lg border border-cyan-500/40 px-2 py-0.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-40"
                      >
                        Voltar a oferecer
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {!a && r.recusaram > 1 && r.fase !== "cancelada" && (
            <button
              type="button"
              onClick={() => onReoferecer(null)}
              disabled={ocupado === t.pedidoId}
              className="mt-2 rounded-lg border border-cyan-500/40 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-40"
            >
              Voltar a oferecer a todos os que recusaram
            </button>
          )}
        </details>
      )}

      {!a && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Oferecido a {r.enviados} {r.enviados === 1 ? "profissional" : "profissionais"}
          {r.recusaram > 0 ? ` · ${r.recusaram} recusaram` : ""}
          {r.enviados === 1 && t.negociacoes[0]?.modo === "directa" ? " · se aceitar, fica com ele" : ""}
        </p>
      )}


      {r.fase === "escolher" && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold text-amber-200">
            Aceitaram — escolha quem o faz:
          </p>
          <ul className="mt-2 space-y-1.5">
            {r.interessados.map((n) => (
              <li key={n.negociacaoId} className="flex flex-wrap items-center justify-between gap-2">
                {/* Já tem outro trabalho a essa hora: a vermelho, para se escolher outro (21-10-2026). */}
                {n.choques?.length ? (
                  <span className="text-sm font-semibold text-red-400" title="Já tem um trabalho a essa hora — escolha outro">
                    {n.profissional}
                    <span className="ml-2 text-xs font-normal text-red-300">{textoDosChoques(n.choques)}</span>
                  </span>
                ) : (
                  <span className="text-sm text-white">{n.profissional}</span>
                )}
                <button
                  onClick={() => onEscolher(n)}
                  disabled={ocupado != null}
                  className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-xs font-bold text-white transition hover:bg-acao-hover disabled:opacity-50"
                >
                  {ocupado === n.negociacaoId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Escolher
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.fase === "sem_ninguem" && (
        <p className="mt-2 text-xs text-red-300">
          Todos os que o receberam recusaram. Em «Alterar valor ou taxa», o valor novo volta a ser
          oferecido a eles.
        </p>
      )}

      {a && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-sm text-slate-200">
            <span className="text-slate-400">Profissional:</span> <strong className="text-white">{a.profissional}</strong>
            {a.confirmadoEm ? (
              <span className="text-slate-400"> · confirmado {quando(a.confirmadoEm)}</span>
            ) : a.execucaoEnviadaEm ? (
              <span className="text-amber-300"> · diz que está feito ({quando(a.execucaoEnviadaEm)})</span>
            ) : null}
            {a.pagoEm ? <span className="text-emerald-300"> · pago {quando(a.pagoEm)}</span> : null}
          </p>
          {!a.confirmadoEm && (
            <div className="flex flex-wrap gap-2">
              {a.execucaoEnviadaEm ? (
                <button
                  onClick={() => onConfirmar(a, false)}
                  disabled={ocupado != null}
                  className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-xs font-bold text-white transition hover:bg-acao-hover disabled:opacity-50"
                >
                  {ocupado === a.negociacaoId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Confirmar trabalho feito
                </button>
              ) : (
                <button
                  onClick={() => onConfirmar(a, true)}
                  disabled={ocupado != null}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Já está feito — confirmar
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* A prova do trabalho feito: a nota e as fotografias do profissional (19-10-2026, como na Mesa). */}
      {a?.prova && (a.prova.nota || a.prova.fotos.length > 0) && (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">O que {a.profissional} mandou</p>
          {a.prova.nota && <p className="mt-1.5 whitespace-pre-line text-sm text-slate-200">{a.prova.nota}</p>}
          {a.prova.fotos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {a.prova.fotos.map((f, i) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFotoAberta(i)}
                  className="h-16 w-16 overflow-hidden rounded-lg border border-slate-700 hover:border-cyan-500"
                  aria-label={`Ver a fotografia ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {fotoAberta != null && a?.prova && (
        <VisorDeFotos fotos={a.prova.fotos} indiceInicial={fotoAberta} onFechar={() => setFotoAberta(null)} />
      )}

      {/* A nota da CLYON: o cliente de um Trabalho CLYON não tem link para dar estrelas. */}
      {a?.confirmadoEm && a.estrelas == null && (
        <AvaliarPelaClyon
          profissionalNome={a.profissional}
          onMudou={onMudou}
          guardar={(estrelas, comentario) => onAvaliar(a, estrelas, comentario)}
        />
      )}
      {a?.estrelas != null && (
        <p className="mt-2 text-xs text-slate-300">
          Nota: <span className="text-amber-300">{"★".repeat(a.estrelas)}{"☆".repeat(Math.max(0, 5 - a.estrelas))}</span>
          {a.comentario ? <span className="text-slate-400"> — «{a.comentario}»</span> : null}
        </p>
      )}

      {/* Trocar quem o faz, antes de estar confirmado — o «Trocar empresa» da Mesa. */}
      {a && !a.confirmadoEm && !a.pagoEm && (
        <TrocarProfissional pedidoId={t.pedidoId} actualProviderId={a.providerId} actualNome={a.profissional} onMudou={onMudou} />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
        {/* Um link, e não `window.open`: abre sempre, sem o browser o bloquear. */}
        {proposta && (
          <a
            href={proposta.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onPropostaAberta}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-600/50 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Enviar proposta ao cliente · {euros(proposta.total)}
          </a>
        )}
        {/* Pelo WhatsApp da CLYON — a conversa fica com a plataforma (19-10-2026). */}
        {proposta && (
          <button
            onClick={onEnviarProposta}
            disabled={ocupado === t.pedidoId}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-600/50 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Enviar pela CLYON
          </button>
        )}
        {/* A proposta já seguiu por outro lado — passa para «A aguardar cliente» (21-10-2026). */}
        {proposta && !t.propostaEnviadaEm && (
          <button
            onClick={onJaEnviei}
            disabled={ocupado === t.pedidoId}
            title="A proposta já foi ao cliente por telefone ou noutro canal"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60 disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Já enviei
          </button>
        )}
        <button
          onClick={onFicha}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          Ficha e histórico
        </button>
        <button
          onClick={onEditar}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Editar pedido
        </button>
        {aindaSeMuda && (
          <>
            <button
              onClick={() => {
                // Num trabalho antigo o valor era o que o pro recebia, e o valor
                // novo é o preço ao cliente: parte-se do preço, se o houver.
                const partida = t.taxa != null ? t.valorFixo : t.precoAoCliente;
                setValorEscrito(partida != null ? partida.toFixed(2).replace(".", ",") : "");
                setTaxaEscolhida(t.taxa);
                setBaseEscolhida(lerBase(t.base));
                setAMudarValor(true);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
            >
              <Coins className="h-3.5 w-3.5" aria-hidden="true" />
              Alterar valor ou taxa
            </button>
            {/* Ao lado, como o dono pediu — ver `adjudicacao`. */}
            {adjudicacao && (
              <a
                href={adjudicacao}
                target="_blank"
                rel="noopener noreferrer"
                title="Abre o WhatsApp do cliente com a mensagem de adjudicação e os métodos de pagamento"
                className="flex items-center gap-1.5 rounded-lg border border-emerald-600/50 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Enviar adjudicação ao cliente
              </a>
            )}
            {/*
              PASSAR A NEGOCIAÇÃO — 20-10-2026 (fase 4). Só enquanto ninguém o
              aceitou: a oferta sai, e vai aos profissionais para proporem.
            */}
            {onPassarANegociacao && (r.fase === "a_espera" || r.fase === "sem_ninguem") && (
              <button
                onClick={onPassarANegociacao}
                disabled={ocupado === t.pedidoId}
                title="Ninguém aceitou o valor fixo — vai aos profissionais para cada um propor o seu valor"
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60 disabled:opacity-40"
              >
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                Passar a negociação
              </button>
            )}
            <button
              onClick={onCancelar}
              disabled={ocupado === t.pedidoId}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-40"
            >
              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
              Cancelar trabalho
            </button>
          </>
        )}
        {r.fase === "cancelada" && (
          <button
            onClick={onRestaurar}
            disabled={ocupado === t.pedidoId}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
          >
            {ocupado === t.pedidoId ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Restaurar
          </button>
        )}
      </div>
        </>
      )}
      {janelas}
    </li>
  );
}

/**
 * CANCELAR UM TRABALHO CLYON, COM O MOTIVO — 19-10-2026, os mesmos motivos e
 * o mesmo aviso do «Cancelar pedido» da Mesa (`cancelamento.ts`), mas pela
 * rota dos Trabalhos CLYON: avisa quem o tinha, e quem só tem esta secção
 * não precisa da rota da Mesa.
 */
function JanelaDeCancelarTrabalho({
  t,
  onFechar,
  onCancelar,
}: {
  t: TrabalhoClyon;
  onFechar: () => void;
  /** Devolve o erro, ou `null` se cancelou. */
  onCancelar: (motivo: string) => Promise<string | null>;
}) {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [outro, setOutro] = useState("");
  const [aCancelar, setACancelar] = useState(false);
  const [erro, setErro] = useState("");
  const desfaz = oQueSeDesfaz(
    t.negociacoes.map((n) => ({
      estado: n.estado,
      valorAcordado: n.estado === "acordada" ? ganhosDe(t) : null,
      profissionalNome: n.profissional,
      execucaoEnviadaEm: n.execucaoEnviadaEm,
      confirmadoEm: n.confirmadoEm,
      pagoEm: n.pagoEm,
    })),
  );
  const aviso = avisoDoCancelamento(desfaz);
  const ehOutro = escolhido === "Outro motivo";
  const motivo = ehOutro ? outro.trim() : (escolhido ?? "");
  const podeCancelar = desfaz.motivoObrigatorio ? motivo.length > 0 : true;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <h3 className="text-base font-bold text-white">
          Cancelar o trabalho #{t.pedidoId}
          {t.cliente ? ` de ${t.cliente}` : ""}?
        </h3>
        {aviso && (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
            {aviso}
          </p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Sai dos profissionais a quem foi oferecido, e quem o tinha é avisado por WhatsApp. Não é apagado:
          fica o histórico, e pode restaurá-lo.
        </p>
        <p className="mt-4 text-xs font-semibold text-slate-300">
          Porquê?{" "}
          {desfaz.motivoObrigatorio ? (
            <span className="text-amber-300">(obrigatório — é o que {desfaz.profissional} vai ler)</span>
          ) : (
            <span className="text-slate-500">(fica escrito)</span>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[...MOTIVOS_DE_CANCELAMENTO, "Outro motivo"].map((m) => (
            <button
              key={m}
              onClick={() => {
                setEscolhido(m);
                setErro("");
              }}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                escolhido === m ? "border-amber-500 bg-amber-500/15 text-amber-200" : "border-slate-600 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        {ehOutro && (
          <input
            value={outro}
            onChange={(e) => setOutro(e.target.value)}
            autoFocus
            placeholder="Escreva o motivo…"
            className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
        )}
        {erro && <p className="mt-3 text-xs text-red-300">{erro}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            onClick={onFechar}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            Voltar atrás
          </button>
          <button
            onClick={async () => {
              setACancelar(true);
              setErro("");
              const falhou = await onCancelar(motivo);
              setACancelar(false);
              if (falhou) setErro(falhou);
            }}
            disabled={aCancelar || !podeCancelar}
            className="flex items-center gap-2 rounded-lg bg-red-500/90 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-40"
          >
            {aCancelar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Cancelar o trabalho
          </button>
        </div>
      </div>
    </div>
  );
}
