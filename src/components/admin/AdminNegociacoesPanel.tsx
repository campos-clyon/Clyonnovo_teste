"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Camera,
  CheckCircle2,
  Archive,
  ChevronDown,
  Clock,
  Copy,
  Eye,
  Loader2,
  Mail,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { quemNegoceia, clyonPodeConfirmar, porqueNaoPodeConfirmar } from "@/lib/quem-negoceia";
import { grupoPorIdade, ROTULO_DO_GRUPO, type GrupoDeIdade } from "@/lib/idade-do-pedido";
import {
  quantoOClientePaga,
  quantoOProfissionalRecebe,
  comissaoDaClyon,
} from "@/lib/taxas-plataforma";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import RegistarPedido from "./RegistarPedido";
import PedidoDetailModal from "./PedidoDetailModal";

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
  provaJson: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
  criadaEm: string;
  actualizadaEm: string;
};

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
 * a proposta dura 48 horas, e do lado do backoffice nada mudava: a negociacao
 * continuava a dizer "aberta · 2 propostas", fechada atras de um chevron, no
 * fundo de uma pagina. Quem abrisse o painel nao tinha como saber que alguem
 * estava do outro lado a contar as horas.
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
  return propostasDe(n.propostasJson).some(
    (x) => x.estado === "pendente" && x.por === "profissional",
  );
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
  valorDesejadoCliente: string | null;
  /** "backoffice", "hero_quote_form", "formulario_contactos", ou null. */
  origem: string | null;
  status: string | null;
  /** Quando o admin abriu o pedido depois de concluído. Null = por ver. */
  concluidoVistoEm: string | null;
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
  estimateTotal: string | null;
  urgency: string | null;
  createdAt: string;
};

export default function AdminNegociacoesPanel({
  mostrar = "tudo",
}: {
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
  const [linksEmClaro, setLinksEmClaro] = useState<Record<string, string>>({});
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
  const [valorDe, setValorDe] = useState<Record<number, string>>({});
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
  const carregar = useCallback(async (silencioso = false) => {
    if (!token) return;
    if (!silencioso) setACarregar(true);
    try {
      const res = await fetch("/api/admin/negociacoes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setPedidos(dados.pedidos ?? []);
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
  useAutoRefresh(() => carregar(true), { intervalMs: 30_000 });

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
  async function verComoCliente(p: Pedido) {
    const chave = `c${p.id}`;
    const jaTem = linksEmClaro[chave];
    if (jaTem) {
      window.open(`/pedido/${jaTem}`, "_blank", "noopener");
      return;
    }
    if (p.contactEmail?.trim()) {
      const avanca = window.confirm(
        "Este cliente tem email e pode ter guardado o link antigo. Abrir a página gera um link novo e o dele deixa de funcionar. Continuar?",
      );
      if (!avanca) return;
    }
    const t = await reenviar(chave, { pedidoId: p.id, para: "cliente" });
    if (t) window.open(`/pedido/${t}`, "_blank", "noopener");
  }

  async function promover(pedidoId: number) {
    if (!token) return;
    setOcupado(`p${pedidoId}`);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/promover", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId, valor: valorDe[pedidoId] }),
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
    if (!token || ids.length === 0) return;
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

  async function redistribuir(pedidoId: number) {
    if (!token) return;
    setOcupado(`r${pedidoId}`);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/redistribuir", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId }),
      });
      const dados = await res.json();
      if (!res.ok) {
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
        setErro(
          `Continua sem chegar a ninguém de ${dados.candidatos} profissionais activos.` +
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
  const aEsperar =
    mostrar === "clientes"
      ? []
      : pedidos.filter(
          (p) => quemNegoceia(p) === "clyon" && p.negociacoes.some(precisaDeSi),
        );
  const ordenados = [...pedidos].sort(
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
  const concluidos = ordenados.filter(pedidoConcluido);
  const activos = ordenados.filter((p) => !pedidoConcluido(p));
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
   *      nível onde a demora custa dinheiro: uma proposta expira em 48 horas,
   *      e um trabalho por confirmar é dinheiro que fica cativo e um
   *      profissional que já lá foi e ainda não recebeu.
   *   2. A correr — a bola está do outro lado, com o profissional ou com o
   *      cliente que responde pelo link. Estão aqui para vigiar, não para agir.
   *
   * Dentro de cada nível, do mais recente para o mais antigo.
   */
  const activosOrdenados = useMemo(() => {
    const visiveis =
      mostrar === "clyon" ? daClyon : mostrar === "clientes" ? dosClientes : activos;
    const porData = (a: Pedido, b: Pedido) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    const precisam = visiveis.filter((p) => p.negociacoes.some(precisaDeSi)).sort(porData);
    const correm = visiveis.filter((p) => !p.negociacoes.some(precisaDeSi)).sort(porData);

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
      // O separador só aparece quando há DOIS níveis para separar: com uma
      // lista só, uma linha a dizer o óbvio é ruído.
      if (precisam.length > 0 && correm.length > 0) {
        saida.push({ chave, separador: true, titulo, quantos: lista.length, nota, tom });
      }
      for (const p of lista) saida.push({ chave: `p${p.id}`, separador: false, pedido: p });
    };
    // "Resposta" ficou curto: um trabalho já feito não espera uma resposta,
    // espera que alguém o reconheça e liberte o dinheiro. As duas coisas
    // param aqui à espera dele, e a nota tem de as caber às duas.
    bloco("n1", "Precisa de si", "nada avança sem si", "text-emerald-300", precisam);
    bloco("n2", "A correr", "a bola está do outro lado", "text-sky-300", correm);
    return saida;
  }, [activos, daClyon, dosClientes, mostrar]);

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
     * lê: o cartão verde do topo já aponta o dedo, e o "Responder (N)" da
     * linha abre num toque.
     */
    const aberto = negociacoesVisiveis.has(p.id);
    const concluido = pedidoConcluido(p);
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
    const bola = concluido
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
        className={`scroll-mt-24 rounded-2xl border bg-slate-900 p-4 shadow-sm ${
          porVer
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
            <p className="truncate text-sm font-semibold text-slate-100">{p.contactName ?? "—"}</p>
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
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
            </p>
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
              ? `Responder (${aEsperarLista.length})`
              : aberto
                ? "Fechar"
                : "Abrir"}
          </button>
        </div>

        {aberto && (
          <>
        {concluido && acordada && acordada.valorAcordado != null && (
          // O dinheiro completo, à cabeça: o que o cliente pagou, a taxa, o
          // que o profissional recebe. Abrir um concluído é para conferir
          // contas — não para as reconstruir proposta a proposta.
          <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3 text-sm">
            <p className="font-semibold text-emerald-300">
              Trabalho concluído com {acordada.profissionalNome}
            </p>
            <p className="mt-1 text-slate-300">
              Acordado: <strong>{euros(Number(acordada.valorAcordado))}</strong>
              {" · "}o cliente paga{" "}
              <strong>{euros(quantoOClientePaga(Number(acordada.valorAcordado)))}</strong>{" "}
              (taxa CLYON{" "}
              {euros(quantoOClientePaga(Number(acordada.valorAcordado)) - Number(acordada.valorAcordado))})
              {" · "}o profissional recebe{" "}
              <strong>{euros(quantoOProfissionalRecebe(Number(acordada.valorAcordado)))}</strong>
              {" · "}comissão CLYON {euros(comissaoDaClyon(Number(acordada.valorAcordado)))}
            </p>
          </div>
        )}
        {/*
          O TRABALHO FEITO, À CABEÇA DO CARTÃO.

          Isto existia — a prova, as contas, o botão que liberta o pagamento —
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
              O valor fica cativo até alguém confirmar — e é a confirmação que
              fecha o pedido e liberta o pagamento dele.
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
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Prova ${i + 1}`}
                            className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-700"
                          />
                        </a>
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
          <button
            onClick={() => setAEditar(p.id)}
            title="A ficha completa do backoffice — inclui a Distribuição e o histórico"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60"
          >
            Ficha e distribuição
          </button>
          <button
            onClick={() => verComoCliente(p)}
            disabled={ocupado === `c${p.id}`}
            title="Abre a página verdadeira do pedido, a mesma que o cliente vê"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60 disabled:opacity-50"
          >
            {ocupado === `c${p.id}` ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Ver como o cliente
          </button>
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

        {linksEmClaro[chaveCliente] && (
          <LinkEmClaro
            caminho={`/pedido/${linksEmClaro[chaveCliente]}`}
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
    if (!token || marcados.size === 0) return;
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
      <header className="mb-6 flex items-start justify-between gap-4">
        <p className="text-sm text-slate-400">
          {mostrar === "clyon"
            ? `${daClyon.length} negociação(ões) da CLYON.`
            : mostrar === "clientes"
              ? `${dosClientes.length} negociação(ões) de clientes.`
              : `${pedidos.length} pedidos na plataforma.`}
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
        <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-950/70 px-4 py-3 backdrop-blur">
          <p className="text-sm font-semibold text-red-100">
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
            <button
              onClick={apagarMarcados}
              disabled={aApagar}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {aApagar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Apagar
            </button>
          </div>
        </div>
      )}

      {mostrar !== "clientes" && (
        <RegistarPedido
          onCriado={() => carregar(true)}
          onEditar={(id) => setAEditarPlataforma(id)}
        />
      )}

      {/* ── Propostas à espera de nós ───────────────────────────────────────
          O profissional contrapropõe e a proposta expira em 48 horas. Até
          aqui nada dizia isso: a negociação ficava fechada num cartão no fundo
          da página, a dizer "aberta · 2 propostas" como todas as outras.

          Este bloco existe para essa resposta não se perder por ninguém a ter
          visto. Salta para o pedido e a negociação já lá está aberta. */}
      {aEsperar.length > 0 && (
        <section className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {aEsperar.length === 1
              ? "Um pedido está à espera de si"
              : `${aEsperar.length} pedidos estão à espera de si`}
          </h3>
          <p className="mt-1 text-xs text-emerald-200/70">
            Uma proposta expira 48 horas depois de ser feita. Responda — ou feche o
            negócio — em nome do cliente, dentro do pedido.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
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
        </section>
      )}

      {/* ── Do simulador, ainda fora da plataforma ─────────────────────────
          Estes entraram pelo formulário de orçamento do site: têm estimativa,
          não têm valor pedido pelo cliente, e nunca foram distribuídos. Um
          profissional não os vê.

          Promover é decidido pedido a pedido, e não por omissão: quem
          preencheu o simulador pediu um orçamento à CLYON, não pediu para
          entrar num mercado — a partir daqui passa a receber propostas de
          terceiros. */}
      {mostrar !== "clyon" && porPromover.length > 0 && (
        <PedidosPorPromover
          pedidos={porPromover}
          valorDe={valorDe}
          setValorDe={setValorDe}
          ocupado={ocupado}
          onPromover={promover}
          onArquivar={arquivarPedido}
          onArquivarVarios={arquivarPedidos}
          onApagar={apagarPedidos}
          aApagar={aApagar}
          onEditar={setAEditarPlataforma}
        />
      )}

      {mostrar === "clyon" && daClyon.length === 0 && (
        <p className="rounded-xl border border-slate-800 bg-slate-800/60 px-4 py-8 text-center text-sm text-slate-500">
          Nenhuma negociação da CLYON em curso. Registe um pedido do WhatsApp ou
          telefone aqui em cima e envie-o — aparece nesta lista.
        </p>
      )}
      {mostrar !== "clyon" && pedidos.length === 0 && (
        <p className="rounded-xl border border-slate-800 bg-slate-800/60 px-4 py-8 text-center text-sm text-slate-500">
          Ainda nenhum pedido foi enviado a profissionais.
        </p>
      )}

      {/*
        UMA LISTA SÓ, ORDENADA POR QUEM ESPERA.

        Havia duas: "Negociações da CLYON" e "Negociações dos clientes" —
        separadas por DE ONDE o pedido tinha entrado. Decisão dele: "coloque
        todos os pedidos num único lugar, independente de onde venha; pode
        mostrar a origem mas não separá-lo por isso". A origem passou a ser
        uma etiqueta na linha; o que agora agrupa é a única pergunta que
        interessa a quem gere — de quem é a vez.

        Dentro de cada nível, do mais recente para o mais antigo, como ele
        pediu. As linhas finas separam níveis, não secções: a lista é uma só.
      */}
      {activosOrdenados.length > 0 && (
        <section className="mb-6">
          {cabecalhoDaMesa}
          <div className="space-y-3">
            {activosOrdenados.map((entrada) =>
              entrada.separador ? (
                <div key={entrada.chave} className="flex items-center gap-3 pt-2">
                  <span className={`text-[11px] font-bold uppercase tracking-[0.15em] ${entrada.tom}`}>
                    {entrada.titulo} · {entrada.quantos}
                  </span>
                  <span className="text-[11px] text-slate-500">{entrada.nota}</span>
                  <span className="h-px flex-1 bg-slate-800" />
                </div>
              ) : (
                cartaoDoPedido(entrada.pedido!)
              ),
            )}
          </div>
        </section>
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
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-[#0B1220] p-4 sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAEditarPlataforma(null);
          }}
        >
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

      {/* No ecrã da CLYON não se escondem as dos clientes em silêncio: uma
          linha diz quantas são e onde estão. O contrário também. */}
      {concluidos.length > 0 && (
        <section>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-400">
            Concluídos
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
              {concluidos.length}
            </span>
            {concluidosPorVer > 0 && (
              <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-xs font-bold text-slate-950">
                {concluidosPorVer} por ver
              </span>
            )}
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Trabalhos confirmados e fechados. Um cartão em realce ainda não foi
            aberto desde a conclusão — abrir mostra as contas completas e apaga o
            realce.
          </p>
          {cabecalhoDaMesa}
          <div className="space-y-3">{concluidos.map(cartaoDoPedido)}</div>
        </section>
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

  const pendenteDoProfissional = propostas.find(
    (x) => x.estado === "pendente" && x.por === "profissional",
  );

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
 */


function PedidosPorPromover({
  pedidos,
  valorDe,
  setValorDe,
  ocupado,
  onPromover,
  onArquivar,
  onArquivarVarios,
  onApagar,
  aApagar,
  onEditar,
}: {
  pedidos: PorPromover[];
  valorDe: Record<number, string>;
  setValorDe: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  ocupado: string | null;
  onPromover: (id: number) => void;
  onArquivar: (id: number) => void;
  onArquivarVarios: (ids: number[]) => void;
  onApagar: (ids: number[]) => void;
  aApagar: boolean;
  /** Abre o pedido para corrigir — o mesmo editor da mesa. */
  onEditar: (id: number) => void;
}) {
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  // Os antigos nascem fechados: são os que menos merecem atenção, e são quase
  // sempre os mais numerosos.
  const [antigosAbertos, setAntigosAbertos] = useState(false);

  const agora = new Date();

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return pedidos;
    return pedidos.filter((p) =>
      [p.contactName, p.city, p.serviceType, String(p.id)]
        .filter(Boolean)
        .some((c) => String(c).toLowerCase().includes(termo)),
    );
  }, [pedidos, busca]);

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
          {p.estimateTotal ? ` · estimativa ${euros(p.estimateTotal)}` : " · sem estimativa"}
          {" · "}
          {new Date(p.createdAt).toLocaleDateString("pt-PT")}
        </p>
      </div>

      <input
        value={valorDe[p.id] ?? ""}
        onChange={(e) => setValorDe((v) => ({ ...v, [p.id]: e.target.value }))}
        placeholder={p.estimateTotal ? Number(p.estimateTotal).toFixed(0) : "valor"}
        inputMode="decimal"
        aria-label={`Valor de partida do pedido ${p.id}`}
        className="w-24 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
      />

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

      <button
        onClick={() => onPromover(p.id)}
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
    <section className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <Send className="h-4 w-4" aria-hidden="true" />
            Pedidos do simulador, fora da plataforma
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] tabular-nums text-amber-200">
              {pedidos.length}
            </span>
          </h3>
          <p className="mt-1 text-xs text-amber-200/70">
            Enviar aos profissionais fixa o valor de partida, envia o link ao cliente e
            distribui. Sem valor indicado, usa a estimativa.
          </p>
        </div>

        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Procurar por nome, cidade, serviço ou número…"
          aria-label="Procurar nos pedidos por promover"
          className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 sm:w-72"
        />
      </div>

      {/*
        Marcar todos marca OS VISIVEIS — o que a busca deixou passar, grupos
        fechados incluidos. Se a busca diz "entulho", "todos" sao os de
        entulho: marcar o que nao esta no ecra seria apagar as escuras.
      */}
      {visiveis.length > 0 && (
        <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-xs text-slate-400">
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
    </section>
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
function ConfirmarPelaClyon({
  negociacaoId,
  pedidoId,
  valorAcordado,
  onMudou,
}: {
  negociacaoId: number;
  pedidoId: number;
  valorAcordado: number | null;
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

      {valorAcordado != null && (
        <dl className="mt-2.5 space-y-1 rounded-md bg-slate-950/60 px-3 py-2.5 text-xs">
          <div className="flex items-center justify-between">
            <dt className="text-slate-400">Cobrar ao cliente</dt>
            <dd className="font-semibold tabular-nums text-slate-100">
              {euros(quantoOClientePaga(valorAcordado))}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-400">O profissional recebe</dt>
            <dd className="font-semibold tabular-nums text-slate-100">
              {euros(quantoOProfissionalRecebe(valorAcordado))}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-slate-800 pt-1">
            <dt className="text-slate-500">Fica para a CLYON</dt>
            <dd className="tabular-nums text-slate-400">{euros(comissaoDaClyon(valorAcordado))}</dd>
          </div>
        </dl>
      )}

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
}: {
  negociacao: Negociacao;
  pedidoId: number;
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
                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Prova ${i + 1}`}
                    className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-700"
                  />
                </a>
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

function LinkEmClaro({ caminho, aviso }: { caminho: string; aviso: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${caminho}` : caminho;

  return (
    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
      <p className="text-xs font-semibold text-amber-200">{aviso}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-300">
          {url}
        </code>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(url);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1500);
          }}
          className="flex items-center gap-1 rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white"
        >
          <Copy className="h-3 w-3" aria-hidden="true" />
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
