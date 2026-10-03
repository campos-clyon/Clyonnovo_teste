"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ChevronDown,
  Loader2,
  Lock,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useAdminAuth, useMexeNoDinheiro } from "@/hooks/useAdminAuth";
import {
  AGRUPAMENTOS,
  NOME_DA_DATA,
  PERIODOS,
  agrupamentoValido,
  agrupar,
  dataDeReferencia,
  dentroDoIntervalo,
  intervaloDoPeriodo,
  type Agrupamento,
  type Periodo,
} from "@/lib/filtros-dos-pagamentos";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import {
  ladoDoCliente,
  ladoDoProfissional,
  nomeDoRecebimento,
  pagouAoProfissional,
  prontoAPagar,
} from "@/lib/dinheiro-do-trabalho";
import { contaDoCliente, quantoOProfissionalRecebe, type Taxas } from "@/lib/taxas-plataforma";
import {
  fraseDaDeclaracao,
  metodoDoRecebimento,
  nomeDeComoPagou,
  type ComoPagou,
  type ParaQue,
} from "@/lib/pagamento-declarado";

/**
 * O QUE ENTROU PELO euPAGO.
 *
 * O número grande deste painel não é o total recebido — é o dos AVISOS POR
 * APLICAR. Cada um é dinheiro que se moveu do lado deles e não se moveu do
 * nosso: um pagamento em duplicado por devolver, um valor que não bate certo.
 * Nenhum deles dá erro em lado nenhum, e é por isso que precisam de um sítio
 * onde se vejam.
 *
 * O resto do ecrã é conferência. Enquanto a porta estiver fechada, diz-se
 * porquê, em vez de mostrar zeros que parecem uma avaria.
 */

type Ligacao = {
  configurado: boolean;
  falta?: string;
  ambiente?: "sandbox" | "producao";
  temSegredoDoWebhook?: boolean;
  aberta?: boolean;
  plataformaCobra: boolean;
  testadores?: number;
};

type Pagamento = {
  id: number;
  metodo: string;
  estado: string;
  valor: number;
  valorPago: number | null;
  comissaoEupago: number | null;
  referencia: string | null;
  entidade: string | null;
  pedidoId: number;
  criadoEm: string;
};

type Aviso = {
  id: number;
  trid: string;
  estado: string;
  pagamentoId: number | null;
  valor: number | null;
  nota: string | null;
  recebidoEm: string;
};

type Estado = {
  ligacao: Ligacao;
  resumo: {
    pendentes: number;
    pagos: number;
    falhados: number;
    avisosPorAplicar: number;
    totalPago: number;
    comissaoDoEupago: number;
  };
  ultimos: Pagamento[];
  avisos: Aviso[];
  webhook?: EstadoDoWebhook;
  trabalhos?: Trabalho[];
};

/**
 * UM TRABALHO, AS DUAS PONTAS DO DINHEIRO.
 *
 * *«Estamos com problema para gerir os pagamentos (…) para podermos gerir quem
 * pagou, como pagou, e se já pagámos os profissionais.»* — 24-09-2026.
 *
 * São três perguntas sobre a MESMA coisa, e viviam em quatro ecrãs: as
 * Carteiras respondem por profissional, os Levantamentos por pedido de
 * levantamento, o Livro por movimento, e este por pagamento do euPago.
 * Nenhum respondia por TRABALHO — que é como a pergunta é feita quando se
 * tem o extracto do banco aberto ao lado.
 */
type Trabalho = {
  negociacaoId: number;
  pedidoId: number;
  /** Conta marcada como de teste nos Profissionais — exclui-se sem restrição. */
  contaDeTeste?: boolean;
  /** Já vinha da rota e ninguém o lia: é o que separa por profissional sem confundir dois com o mesmo nome. */
  providerId: number;
  servico: string | null;
  /** O dia do trabalho — o combinado, o pedido, ou o do «feito». Ver a rota. */
  dataDoTrabalho: string | null;
  feitoEm: string | null;
  cliente: string | null;
  telefoneDoCliente: string | null;
  cidade: string | null;
  profissional: string;
  valorAcordado: number;
  taxas: Taxas;
  clientePaga: number;
  profissionalRecebe: number;
  /** Em dinheiro com IVA incluído: o IVA e a comissão que o profissional deve. 01-10-2026. */
  dividaDoProfissional?: number | null;
  ivaIncluido?: boolean;
  /**
   * O que ficou dito ao dar o trabalho por feito — 29-09-2026. Ver
   * `pagamento-declarado.ts`. É para CONFIRMAR aqui, e não um recebimento.
   */
  declarado?: { paraQue: ParaQue; como: ComoPagou; em: string | null; por: string | null } | null;
  formaDePagamento: string | null;
  comoEntrou: string | null;
  clientePagouEm: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
  fase: string;
};

/**
 * O QUE ANDA A ACONTECER À PORTA DOS AVISOS.
 *
 * *«Me ajude com passo a passo para corrigir isso.»* — 22-09-2026, sobre um
 * pagamento de 42 € que entrou no euPago e nunca chegou aqui.
 *
 * Duas histórias apareciam como o mesmo silêncio: **o euPago não está a
 * chamar** (endereço errado, ou configurado no canal errado) e **está a chamar
 * e nós é que recusamos** (segredo em falta, ou um que já não é o dele). A
 * primeira resolve-se no backoffice deles, a segunda no nosso — e quem procura
 * sem saber qual é passa a tarde a mexer no sítio errado.
 */
type EstadoDoWebhook = {
  ultimoAceite: string | null;
  aceites: number;
  ultimaRecusa: { quando: string; porque: string } | null;
  recusas24h: number;
};

function PortaDosAvisos({ w }: { w: EstadoDoWebhook }) {
  const quando = (iso: string) => new Date(iso).toLocaleString("pt-PT");

  /*
   * A recusa manda sobre tudo. Se chegam avisos e são recusados, isso é o que
   * está a acontecer AGORA — e é nosso, e tem conserto imediato.
   */
  if (w.recusas24h > 0) {
    return (
      <p className="text-amber-300">
        O euPago <strong>está a chamar</strong> e nós estamos a recusar: {w.recusas24h} nas
        últimas 24 h
        {w.ultimaRecusa ? ` · a última às ${quando(w.ultimaRecusa.quando)} — ${w.ultimaRecusa.porque}` : ""}
        . O endereço está certo; o que não bate é o segredo.
      </p>
    );
  }

  if (w.aceites > 0) {
    return (
      <p className="text-emerald-300">
        Avisos recebidos: {w.aceites}
        {w.ultimoAceite ? ` · o último a ${quando(w.ultimoAceite)}` : ""}.
      </p>
    );
  }

  return (
    <p className="text-amber-300">
      <strong>Nunca chegou nenhum aviso</strong>, e nenhum foi recusado — o euPago não está a
      chamar esta morada. Confirme os Webhooks 2.0 no canal de produção.
    </p>
  );
}

const euros = (n: number | null) => (n == null ? "—" : `${n.toFixed(2).replace(".", ",")} €`);

const DIA = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }) : "";

/**
 * O GESTOR: um trabalho por linha, e uma pergunta de cada vez.
 *
 * *«Temos que separar os pagamentos entre os já recebidos, por receber, pagos
 * ao pro e por pagar aos pros.»* — 25-09-2026.
 *
 * Eram quatro montes por FASE, e a fase junta as duas pontas numa resposta
 * só: um trabalho «por receber» também está por pagar ao profissional, e não
 * aparecia nessa lista. Agora são quatro separadores, dois de cada ponta, e
 * cada trabalho aparece num de cada lado — é assim que se confere com o
 * extracto do banco aberto ao lado: primeiro o que entrou, depois o que saiu.
 *
 * Abre em «Por receber»: é o único que representa dinheiro que se pode perder.
 */
type Separador = "por_receber" | "recebidos" | "por_pagar" | "pagos";

const SEPARADORES: Array<{
  id: Separador;
  rotulo: string;
  cor: string;
  vazio: string;
}> = [
  {
    id: "por_receber",
    rotulo: "Por receber",
    cor: "text-amber-300",
    vazio: "Nenhum cliente por pagar.",
  },
  {
    id: "recebidos",
    rotulo: "Recebidos",
    cor: "text-emerald-300",
    vazio: "Ainda não entrou nenhum pagamento.",
  },
  {
    id: "por_pagar",
    rotulo: "Por pagar aos pros",
    cor: "text-cyan-300",
    vazio: "Não se deve nada a nenhum profissional.",
  },
  {
    id: "pagos",
    rotulo: "Pagos aos pros",
    cor: "text-emerald-300",
    vazio: "Ainda não se pagou a nenhum profissional.",
  },
];

function pertence(t: Trabalho, s: Separador): boolean {
  switch (s) {
    case "por_receber":
      return ladoDoCliente(t) === "por_receber";
    case "recebidos":
      return ladoDoCliente(t) === "recebido";
    case "por_pagar":
      return ladoDoProfissional(t) === "por_pagar";
    case "pagos":
      return ladoDoProfissional(t) === "pago";
  }
}

/**
 * A SOMA É DO DINHEIRO QUE PASSA PELA CLYON.
 *
 * Do lado do cliente conta o que ele paga; do lado do profissional, o que ele
 * recebe. O dinheiro em mão fica de fora das duas: está na lista, para se
 * saber que existe, mas não entrou nem saiu da conta — e uma soma que não bate
 * com o extracto é uma soma em que se deixa de confiar.
 */
function somaDe(linhas: Trabalho[], s: Separador): number {
  const doCliente = s === "por_receber" || s === "recebidos";
  /*
   * A DÍVIDA DO PROFISSIONAL ENTRA DO LADO DE QUEM PAGA À CLYON — 01-10-2026.
   * Em dinheiro com IVA incluído, o que entra na conta é o IVA e a comissão
   * que ele entrega por referência; o resto ficou com ele, e não conta.
   */
  const soma = linhas
    .filter((t) => !pagouAoProfissional(t) || (doCliente && t.dividaDoProfissional != null))
    .reduce(
      (n, t) =>
        n +
        (pagouAoProfissional(t)
          ? (t.dividaDoProfissional ?? 0)
          : doCliente
            ? t.clientePaga
            : t.profissionalRecebe),
      0,
    );
  return Math.round(soma * 100) / 100;
}

/** Os feitos, do mais recente para trás; o dinheiro em mão, que não tem data, no fim. */
function porData(s: Separador) {
  const quando = (t: Trabalho) =>
    (s === "recebidos" ? t.clientePagouEm : s === "pagos" ? t.pagoEm : null) ?? "";
  return (a: Trabalho, b: Trabalho) => quando(b).localeCompare(quando(a));
}

const POR_PAGINA = 40;

/** A maneira de separar a lista fica guardada no próprio browser. Os filtros não. */
const CHAVE_DO_AGRUPAMENTO = "clyon:pagamentos:separar-por";

/** Para os `<select>` e campos de data do escuro do backoffice. */
const CAMPO_DO_FILTRO =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500";

/** O nome do serviço, como na lista de categorias — `recolha_monos` não é para ler. */
function nomeDoServico(id: string | null): string | null {
  if (!id) return null;
  return SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id.replace(/_/g, " ");
}

function GestorDoDinheiro({
  trabalhos,
  token,
  onMudou,
  mexeNoDinheiro,
}: {
  trabalhos: Trabalho[];
  token: string | null;
  onMudou: () => void;
  /**
   * «Só ver» para o assistente — 03-10-2026. Sem isto não aparecem: marcar e
   * excluir, a conta de teste, «já recebemos», «já pagámos» e corrigir o
   * valor. O servidor recusa-os ao assistente na mesma.
   */
  mexeNoDinheiro: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [separador, setSeparador] = useState<Separador>("por_receber");
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [quantos, setQuantos] = useState(POR_PAGINA);

  /*
   * MARCAR E EXCLUIR VÁRIOS — 01-10-2026.
   *
   * *«O Fred é uma conta teste… quero poder excluir tudo sem restrição, posso
   * marcar todos e excluir.»*
   *
   * A marca é por trabalho e sobrevive a mudar de separador ou de filtro. Por
   * isso a barra diz sempre quantos e quais estão marcados: nunca se exclui o
   * que não se está a ver sem o saber. Quem decide o que pode sair é a rota —
   * os de contas de teste saem sempre; os de contas reais com dinheiro ficam,
   * e a resposta diz porquê.
   */
  const [marcados, setMarcados] = useState<Set<number>>(() => new Set());
  const [motivoDoLote, setMotivoDoLote] = useState("");
  const [aExcluirLote, setAExcluirLote] = useState(false);
  const [resultadoDoLote, setResultadoDoLote] = useState("");

  function marcar(ids: number[], valor: boolean) {
    setMarcados((antes) => {
      const novo = new Set(antes);
      for (const id of ids) {
        if (valor) novo.add(id);
        else novo.delete(id);
      }
      return novo;
    });
  }

  // Só os marcados que ainda existem: depois de recarregar, os que saíram já cá não estão.
  const marcadosAqui = trabalhos.filter((t) => marcados.has(t.negociacaoId));

  /*
   * MARCAR A CONTA DE TESTE AQUI MESMO — 01-10-2026.
   *
   * O botão vivia só nos Profissionais, e lá «não mudou»: o dono marcou, voltou
   * aqui, e os seis trabalhos do Fred continuaram recusados. No cabeçalho do
   * grupo não há engano possível sobre QUAL conta é — é a destes trabalhos — e
   * um erro aparece ao lado, e não no topo de outro ecrã.
   */
  const [aMarcarTeste, setAMarcarTeste] = useState<number | null>(null);

  async function marcarContaDeTeste(providerId: number, nome: string, valor: boolean) {
    if (!token) return;
    if (
      !window.confirm(
        valor
          ? `Marcar ${nome} como conta de teste?\n\nOs trabalhos desta conta passam a poder ser excluídos mesmo com dinheiro registado.`
          : `${nome} deixa de ser conta de teste?`,
      )
    )
      return;
    setAMarcarTeste(providerId);
    setResultadoDoLote("");
    try {
      const r = await fetch(`/api/admin/profissionais/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contaDeTeste: valor }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setResultadoDoLote(`Não foi possível marcar ${nome}: ${d.error ?? "erro desconhecido"}.`);
        return;
      }
      onMudou();
    } catch {
      setResultadoDoLote("Erro de rede.");
    } finally {
      setAMarcarTeste(null);
    }
  }

  async function excluirMarcados() {
    const lista = marcadosAqui;
    if (!token || lista.length === 0 || motivoDoLote.trim().length < 3) return;
    const pedidos = [...new Set(lista.map((t) => `#${t.pedidoId}`))];
    if (
      !window.confirm(
        `Excluir ${lista.length} ${lista.length === 1 ? "trabalho" : "trabalhos"} (${pedidos.join(", ")})?\n\n` +
          "Não se desfaz: os pedidos saem da base e ficam só no arquivo dos apagados. " +
          "Os de contas de teste saem mesmo com dinheiro registado; os de contas reais com dinheiro ficam.",
      )
    )
      return;
    setAExcluirLote(true);
    setResultadoDoLote("");
    try {
      const r = await fetch("/api/admin/pagamentos/excluir", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          negociacaoIds: lista.map((t) => t.negociacaoId),
          motivo: motivoDoLote.trim(),
        }),
      });
      const d = await r.json().catch(() => ({}));
      const saidos = Array.isArray(d.apagados) ? d.apagados.length : 0;
      const ficaram = (Array.isArray(d.recusados) ? d.recusados : []) as Array<{
        negociacaoId: number;
        motivo: string;
      }>;
      if (!r.ok) {
        setResultadoDoLote([d.error, d.detalhe].filter(Boolean).join(" — ") || "Não foi possível.");
        if (saidos > 0) onMudou();
        return;
      }
      setResultadoDoLote(
        `${saidos} ${saidos === 1 ? "pedido excluído" : "pedidos excluídos"}.` +
          (ficaram.length > 0
            ? ` Ficaram ${ficaram.length}: ${ficaram.map((f) => f.motivo).join(" ")}` +
              " Se a conta é de teste, carregue em «Marcar como conta de teste» no cabeçalho do grupo e volte a excluir."
            : ""),
      );
      // Os que ficaram continuam marcados, para se ver quais são.
      setMarcados(new Set(ficaram.map((f) => f.negociacaoId)));
      setMotivoDoLote("");
      onMudou();
    } catch {
      setResultadoDoLote("Erro de rede.");
    } finally {
      setAExcluirLote(false);
    }
  }

  /*
   * OS FILTROS — 01-10-2026.
   *
   * *«Coloque filtros para ser mais fácil de identificar, separe por
   * profissional e datas.»*
   *
   * Ao lado da busca de texto: o profissional, o período, e como se separa a
   * lista. O período conta pela data que faz sentido em CADA separador — o que
   * entrou, pelo dia em que entrou; o que se transferiu, pelo dia da
   * transferência (ver `filtros-dos-pagamentos.ts`) — e o ecrã diz qual é.
   *
   * Os filtros não se guardam: um filtro esquecido de ontem escondia hoje um
   * pagamento sem ninguém dar por isso, e este é o ecrã do dinheiro. Guarda-se
   * só a maneira de separar, que não esconde nada.
   */
  const [profissional, setProfissional] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  const [entreDe, setEntreDe] = useState("");
  const [entreAte, setEntreAte] = useState("");
  const [agrupamento, setAgrupamentoCru] = useState<Agrupamento>("profissional");

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CHAVE_DO_AGRUPAMENTO);
      if (agrupamentoValido(guardado)) setAgrupamentoCru(guardado);
    } catch {
      /* sem armazenamento: fica por profissional */
    }
  }, []);

  function mudarAgrupamento(g: Agrupamento) {
    setAgrupamentoCru(g);
    try {
      window.localStorage.setItem(CHAVE_DO_AGRUPAMENTO, g);
    } catch {
      /* a escolha vale só para esta visita */
    }
  }

  const agora = new Date();
  const intervalo = intervaloDoPeriodo(periodo, agora, { de: entreDe, ate: entreAte });
  const q = busca.trim().toLowerCase();
  const aFiltrar = Boolean(q || profissional || intervalo);

  /* A busca e o profissional valem para os quatro separadores por igual. */
  const filtrados = trabalhos.filter(
    (t) =>
      (!profissional || String(t.providerId) === profissional) &&
      (!q ||
        [t.cliente, t.telefoneDoCliente, t.profissional, t.cidade, `#${t.pedidoId}`]
          .filter(Boolean)
          .some((c) => String(c).toLowerCase().includes(q))),
  );

  /* O período, esse, conta pela data de cada separador — ver `dataDeReferencia`. */
  const contas = SEPARADORES.map((s) => {
    const linhas = filtrados.filter(
      (t) => pertence(t, s.id) && dentroDoIntervalo(dataDeReferencia(t, s.id), intervalo),
    );
    return { ...s, linhas, soma: somaDe(linhas, s.id) };
  });
  const actual = contas.find((c) => c.id === separador) ?? contas[0];

  /*
   * Um trabalho sem data não cabe em período nenhum, e sai quando há período.
   * Diz-se quantos são: um filtro que esconde dinheiro em silêncio é pior do
   * que não haver filtro.
   */
  const semDataDeFora = intervalo
    ? filtrados.filter((t) => pertence(t, separador) && !dataDeReferencia(t, separador)).length
    : 0;

  /* A lista dos profissionais para o filtro — os que têm trabalho aqui, com quantos. */
  const profissionais = (() => {
    const m = new Map<number, { nome: string; n: number }>();
    for (const t of trabalhos) {
      const atual = m.get(t.providerId);
      m.set(t.providerId, { nome: t.profissional || `Profissional #${t.providerId}`, n: (atual?.n ?? 0) + 1 });
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  })();

  function limparFiltros() {
    setBusca("");
    setProfissional("");
    setPeriodo("todos");
    setEntreDe("");
    setEntreAte("");
    setQuantos(POR_PAGINA);
  }

  /*
   * POR PAGAR: primeiro o que se pode pagar JÁ.
   *
   * Um trabalho por pagar nem sempre está pronto — pagar antes de o cliente
   * pagar é adiantar dinheiro da CLYON. Por isso a lista parte-se em duas, e
   * a de cima é a que tem botão.
   */
  const grupos =
    separador === "por_pagar"
      ? [
          { titulo: "Prontos a pagar", linhas: actual.linhas.filter(prontoAPagar) },
          {
            titulo: "À espera do cliente — pagar ou confirmar",
            linhas: actual.linhas.filter((t) => !prontoAPagar(t)),
          },
        ]
      : [
          {
            titulo: "",
            linhas:
              separador === "recebidos" || separador === "pagos"
                ? [...actual.linhas].sort(porData(separador))
                : actual.linhas,
          },
        ];

  function escolher(s: Separador) {
    setSeparador(s);
    setAberto(null);
    setErro("");
    setQuantos(POR_PAGINA);
  }

  async function agir(t: Trabalho, url: string, corpo: Record<string, unknown>) {
    if (!token) return;
    setOcupado(t.negociacaoId);
    setErro("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ negociacaoId: t.negociacaoId, ...corpo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro([d.error, d.detalhe].filter(Boolean).join(" — ") || "Não foi possível.");
        return;
      }
      setAberto(null);
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  let mostradas = 0;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Trabalho a trabalho
        </p>
        {aFiltrar && (
          <button
            onClick={limparFiltros}
            className="flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Limpar filtros
          </button>
        )}
      </div>

      {/*
        A BARRA DOS FILTROS: a busca, o profissional, o período e como separar.
        Os três primeiros escondem linhas; o último só as arruma.
      */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]">
        <input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setQuantos(POR_PAGINA);
          }}
          type="search"
          aria-label="Procurar"
          placeholder="cliente, telemóvel, cidade ou #pedido"
          className={`${CAMPO_DO_FILTRO} placeholder:text-slate-600`}
        />
        <select
          value={profissional}
          onChange={(e) => {
            setProfissional(e.target.value);
            setQuantos(POR_PAGINA);
          }}
          aria-label="Filtrar por profissional"
          className={`${CAMPO_DO_FILTRO} ${profissional ? "border-cyan-500 text-cyan-100" : ""}`}
        >
          <option value="">Todos os profissionais</option>
          {profissionais.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.nome} ({p.n})
            </option>
          ))}
        </select>
        <select
          value={periodo}
          onChange={(e) => {
            setPeriodo(e.target.value as Periodo);
            setQuantos(POR_PAGINA);
          }}
          aria-label="Filtrar por período"
          className={`${CAMPO_DO_FILTRO} ${periodo !== "todos" ? "border-cyan-500 text-cyan-100" : ""}`}
        >
          {PERIODOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.rotulo}
            </option>
          ))}
        </select>
        <div
          role="group"
          aria-label="Separar a lista por"
          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 p-0.5 sm:col-span-2 lg:col-span-1"
        >
          <span className="px-1.5 text-[11px] text-slate-500">Separar por</span>
          {AGRUPAMENTOS.map((g) => (
            <button
              key={g.id}
              onClick={() => mudarAgrupamento(g.id)}
              aria-pressed={agrupamento === g.id}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                agrupamento === g.id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {g.rotulo}
            </button>
          ))}
        </div>
      </div>

      {periodo === "entre" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <label className="flex items-center gap-1.5">
            De
            <input
              type="date"
              value={entreDe}
              onChange={(e) => setEntreDe(e.target.value)}
              className={`${CAMPO_DO_FILTRO} w-auto [color-scheme:dark]`}
            />
          </label>
          <label className="flex items-center gap-1.5">
            até
            <input
              type="date"
              value={entreAte}
              onChange={(e) => setEntreAte(e.target.value)}
              className={`${CAMPO_DO_FILTRO} w-auto [color-scheme:dark]`}
            />
          </label>
          <span className="text-slate-500">(o último dia conta inteiro)</span>
        </div>
      )}

      {intervalo && (
        <p className="mt-2 text-[11px] text-slate-500">
          Em «{actual.rotulo}», o período conta {NOME_DA_DATA[separador]}.
          {semDataDeFora > 0 &&
            ` ${semDataDeFora} ${semDataDeFora === 1 ? "trabalho sem data ficou" : "trabalhos sem data ficaram"} de fora.`}
        </p>
      )}

      {/*
        OS QUATRO SEPARADORES, as duas pontas lado a lado: o cliente à
        esquerda, o profissional à direita. O número e o total estão no próprio
        separador — é a pergunta que se faz antes de abrir qualquer um.
      */}
      <div role="tablist" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {contas.map((c) => {
          const activo = c.id === separador;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={activo}
              onClick={() => escolher(c.id)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                activo
                  ? "border-cyan-500/60 bg-cyan-500/10"
                  : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
              }`}
            >
              <span className={`block text-[11px] font-semibold uppercase tracking-wide ${c.cor}`}>
                {c.rotulo} · {c.linhas.length}
              </span>
              <span className="mt-0.5 block text-sm font-bold tabular-nums text-white">
                {euros(c.soma)}
              </span>
            </button>
          );
        })}
      </div>

      {erro && !aberto && <p className="mt-2 text-xs text-red-300">{erro}</p>}

      {mexeNoDinheiro && actual.linhas.length > 0 && (
        <label className="mt-3 flex w-fit items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={actual.linhas.every((t) => marcados.has(t.negociacaoId))}
            onChange={(e) => marcar(actual.linhas.map((t) => t.negociacaoId), e.target.checked)}
            className="h-3.5 w-3.5 accent-red-500"
          />
          Marcar os {actual.linhas.length} desta lista
        </label>
      )}

      {mexeNoDinheiro && (marcadosAqui.length > 0 || resultadoDoLote) && (
        <div className="mt-3 rounded-lg border border-red-800/60 bg-red-950/30 p-3">
          {marcadosAqui.length > 0 && (
            <>
              <p className="text-xs font-semibold text-red-200">
                {marcadosAqui.length} {marcadosAqui.length === 1 ? "trabalho marcado" : "trabalhos marcados"}:{" "}
                <span className="font-normal text-red-200/80">
                  {[...new Set(marcadosAqui.map((t) => `#${t.pedidoId}`))].join(", ")}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={motivoDoLote}
                  onChange={(e) => setMotivoDoLote(e.target.value)}
                  maxLength={120}
                  aria-label="Motivo da exclusão"
                  placeholder="motivo (obrigatório) — ex.: conta de teste"
                  className="min-w-[14rem] flex-1 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white placeholder:text-slate-600"
                />
                <button
                  onClick={() => void excluirMarcados()}
                  disabled={aExcluirLote || motivoDoLote.trim().length < 3}
                  className="flex items-center gap-1.5 rounded-lg bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40"
                >
                  {aExcluirLote && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                  Excluir marcados
                </button>
                <button
                  onClick={() => setMarcados(new Set())}
                  className="text-[11px] text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                >
                  Desmarcar
                </button>
              </div>
            </>
          )}
          {resultadoDoLote && (
            <p className={`text-xs text-red-100 ${marcadosAqui.length > 0 ? "mt-2" : ""}`}>
              {resultadoDoLote}
            </p>
          )}
        </div>
      )}

      {actual.linhas.length === 0 && (
        <p className="mt-3 text-xs text-slate-500">
          {aFiltrar ? "Nada com estes filtros." : actual.vazio}
        </p>
      )}

      {grupos.map((g) => {
        if (g.linhas.length === 0) return null;
        /*
         * DENTRO de cada bloco, separado por profissional ou por dia, com o
         * total de cada um. Por profissional é como se paga (uma transferência
         * a cada um); por dia é como se lê o extracto do banco.
         */
        const subgrupos = agrupar(
          g.linhas,
          agrupamento,
          {
            profissional: (t) => ({ id: t.providerId, nome: t.profissional }),
            data: (t) => dataDeReferencia(t, separador),
          },
          agora,
        );
        return (
          <div key={g.titulo || "todos"} className="mt-4">
            {g.titulo && (
              <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span>
                  {g.titulo} · {g.linhas.length}
                </span>
                <span className="tabular-nums">{euros(somaDe(g.linhas, separador))}</span>
              </p>
            )}
            {subgrupos.map((sg) => {
              const resto = Math.max(0, quantos - mostradas);
              if (resto === 0) return null;
              const aMostrar = sg.linhas.slice(0, resto);
              mostradas += aMostrar.length;
              return (
                <div key={sg.chave} className={agrupamento === "nada" ? "" : "mt-3"}>
                  {agrupamento !== "nada" && (
                    <p className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1 text-xs font-semibold text-slate-200">
                      <span className="flex items-center gap-2">
                        {mexeNoDinheiro && (
                        <input
                          type="checkbox"
                          aria-label={`Marcar os ${sg.linhas.length} de ${sg.titulo}`}
                          checked={sg.linhas.every((t) => marcados.has(t.negociacaoId))}
                          onChange={(e) =>
                            marcar(
                              sg.linhas.map((t) => t.negociacaoId),
                              e.target.checked,
                            )
                          }
                          className="h-3.5 w-3.5 accent-red-500"
                        />
                        )}
                        {sg.titulo}
                        <span className="font-normal text-slate-500">
                          {" "}
                          · {sg.linhas.length} {sg.linhas.length === 1 ? "trabalho" : "trabalhos"}
                        </span>
                        {mexeNoDinheiro && agrupamento === "profissional" && sg.linhas[0] && (
                          <button
                            onClick={() =>
                              void marcarContaDeTeste(
                                sg.linhas[0].providerId,
                                sg.titulo,
                                !sg.linhas[0].contaDeTeste,
                              )
                            }
                            disabled={aMarcarTeste === sg.linhas[0].providerId}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide disabled:opacity-50 ${
                              sg.linhas[0].contaDeTeste
                                ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                                : "border border-slate-700 text-slate-400 hover:border-amber-500 hover:text-amber-200"
                            }`}
                          >
                            {sg.linhas[0].contaDeTeste
                              ? "conta de teste · desfazer"
                              : "Marcar como conta de teste"}
                          </button>
                        )}
                      </span>
                      <span className="tabular-nums">{euros(somaDe(sg.linhas, separador))}</span>
                    </p>
                  )}
                  <div className="mt-2 space-y-2">
                    {aMostrar.map((t) => (
                      <Linha
                        key={t.negociacaoId}
                        t={t}
                        ocupado={ocupado === t.negociacaoId}
                        aberto={aberto === t.negociacaoId}
                        erro={aberto === t.negociacaoId ? erro : ""}
                        onAbrir={() => {
                          setErro("");
                          setAberto((a) => (a === t.negociacaoId ? null : t.negociacaoId));
                        }}
                        onEntrou={(metodo) => void agir(t, "/api/admin/pagamentos/recebido", { metodo })}
                        onPaguei={() =>
                          void agir(t, "/api/admin/pagamentos/pago-ao-profissional", {})
                        }
                        onCorrigir={(valor, motivo) =>
                          void agir(t, "/api/admin/negociacoes/valor", {
                            valor,
                            motivo: motivo || undefined,
                          })
                        }
                        onExcluir={(motivo) => void agir(t, "/api/admin/pagamentos/excluir", { motivo })}
                        marcado={marcados.has(t.negociacaoId)}
                        onMarcar={(v) => marcar([t.negociacaoId], v)}
                        mexeNoDinheiro={mexeNoDinheiro}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {actual.linhas.length > quantos && (
        <button
          onClick={() => setQuantos((n) => n + POR_PAGINA)}
          className="mt-3 w-full rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500"
        >
          Mostrar mais ({actual.linhas.length - quantos})
        </button>
      )}
    </div>
  );
}

/** As três formas de dizer o que aconteceu quando não foi pelo euPago. */
const A_MAO: Array<{ id: string; rotulo: string; ajuda: string }> = [
  { id: "transferencia", rotulo: "Transferência", ajuda: "Entrou na conta da CLYON" },
  { id: "numerario", rotulo: "Numerário", ajuda: "Entregue à CLYON em dinheiro" },
  {
    id: "ao_profissional",
    rotulo: "Pagou ao profissional",
    ajuda: "Em mão, no local. Não passou pela CLYON",
  },
];

function Linha({
  t,
  ocupado,
  aberto,
  erro,
  onAbrir,
  onEntrou,
  onPaguei,
  onCorrigir,
  onExcluir,
  marcado,
  onMarcar,
  mexeNoDinheiro,
}: {
  t: Trabalho;
  ocupado: boolean;
  aberto: boolean;
  erro: string;
  onAbrir: () => void;
  onEntrou: (metodo: string) => void;
  onPaguei: () => void;
  onCorrigir: (valor: number, motivo: string) => void;
  onExcluir: (motivo: string) => void;
  marcado: boolean;
  onMarcar: (valor: boolean) => void;
  mexeNoDinheiro: boolean;
}) {
  const emMao = pagouAoProfissional(t);
  const [comoEntrou, setComoEntrou] = useState(false);

  return (
    <div
      className={`rounded-lg border bg-slate-900/60 p-3 ${
        marcado ? "border-red-700/60" : aberto ? "border-cyan-600/50" : "border-slate-800"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {mexeNoDinheiro && (
          <input
            type="checkbox"
            checked={marcado}
            onChange={(e) => onMarcar(e.target.checked)}
            aria-label={`Marcar o pedido #${t.pedidoId}`}
            className="h-3.5 w-3.5 self-center accent-red-500"
          />
          )}
          <span className="text-sm font-semibold text-white">#{t.pedidoId}</span>
          {t.contaDeTeste && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
              conta de teste
            </span>
          )}
          <span className="text-sm text-slate-200">{t.cliente ?? "—"}</span>
          {t.telefoneDoCliente && (
            <a
              href={`tel:${t.telefoneDoCliente.replace(/\s/g, "")}`}
              className="font-mono text-xs tabular-nums text-cyan-400 hover:underline"
            >
              {t.telefoneDoCliente}
            </a>
          )}
          {t.cidade && <span className="text-xs text-slate-500">{t.cidade}</span>}
          {/*
            O SERVIÇO E O DIA do trabalho, para se reconhecer sem abrir: «#264
            Francisco Ávila» não diz se era a recolha de monos de terça ou o
            esvaziamento de sábado.
          */}
          {nomeDoServico(t.servico) && (
            <span className="text-xs text-slate-400">· {nomeDoServico(t.servico)}</span>
          )}
          {t.dataDoTrabalho && (
            <span className="text-xs text-slate-400">· dia {DIA(t.dataDoTrabalho)}</span>
          )}
          <span className="text-xs text-slate-500">· trabalho {euros(t.valorAcordado)}</span>
        </div>
        <button
          onClick={() => {
            setComoEntrou(false);
            onAbrir();
          }}
          aria-expanded={aberto}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-cyan-500 hover:text-cyan-200"
        >
          {aberto ? "Fechar" : "Abrir"}
          <ChevronDown
            className={`h-3 w-3 transition ${aberto ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/*
        AS DUAS PONTAS, uma por linha e sempre na mesma ordem: primeiro o que
        entrou, depois o que saiu. É a ordem em que o dinheiro anda, e é a
        ordem em que a pergunta se faz.
      */}
      <p className="mt-1.5 text-xs text-slate-300">
        <span className="text-slate-500">Cliente:</span>{" "}
        {emMao ? (
          <span className="text-slate-300">
            pagou {euros(t.clientePaga)} ao profissional, em mão
            {t.dividaDoProfissional != null && (
              /* E ele deve à CLYON o IVA e a comissão — 01-10-2026. */
              <span className={t.clientePagouEm ? "text-emerald-300" : "text-amber-300"}>
                {" · "}
                {t.clientePagouEm
                  ? `o profissional pagou-nos ${euros(t.dividaDoProfissional)} de IVA e comissão`
                  : `o profissional deve-nos ${euros(t.dividaDoProfissional)} de IVA e comissão`}
              </span>
            )}
          </span>
        ) : t.clientePagouEm ? (
          <span className="text-emerald-300">
            pagou {euros(t.clientePaga)} · {nomeDoRecebimento(t.comoEntrou)}
            {DIA(t.clientePagouEm) ? ` · ${DIA(t.clientePagouEm)}` : ""}
          </span>
        ) : t.declarado && metodoDoRecebimento(t.declarado.como) ? (
          /*
            DISSE QUE PAGOU, e falta ver. Lê-se na lista sem abrir nada: é a
            fila do que se vai conferir com o extracto do banco ao lado.
          */
          <span className="text-amber-300">
            {euros(t.clientePaga)} · disse que pagou por {nomeDeComoPagou(t.declarado.como)} —{" "}
            <strong className="font-semibold">confirmar</strong>
          </span>
        ) : (
          <span className="text-amber-300">por receber {euros(t.clientePaga)}</span>
        )}
      </p>

      <p className="mt-0.5 text-xs text-slate-300">
        <span className="text-slate-500">{t.profissional}:</span>{" "}
        {emMao ? (
          <span className="text-slate-400">recebeu em mão — não há nada a transferir</span>
        ) : t.pagoEm ? (
          <span className="text-emerald-300">
            pago {euros(t.profissionalRecebe)} · {DIA(t.pagoEm)}
          </span>
        ) : prontoAPagar(t) ? (
          <span className="text-cyan-300">a receber {euros(t.profissionalRecebe)}</span>
        ) : !t.clientePagouEm ? (
          <span className="text-slate-500">
            {euros(t.profissionalRecebe)} — à espera que o cliente pague
          </span>
        ) : (
          <span className="text-slate-500">
            {euros(t.profissionalRecebe)} — à espera da confirmação do cliente
          </span>
        )}
      </p>

      {/*
        O TRABALHO ABERTO: cada ponta anota-se por si — 25-09-2026.

        *«Tem trabalhos que já recebemos mas ainda não pagámos os pros, e tem
        pedidos que ainda não pagaram mas já pagámos os pros.»* As duas pontas
        não andam por ordem, e o ecrã não as obriga a andar: o cliente anota-se
        sem olhar ao profissional, e o profissional sem esperar pelo cliente.
      */}
      {aberto && !mexeNoDinheiro && (
        <p className="mt-3 border-t border-slate-800 pt-3 text-[11px] text-slate-400">
          Registar o que entrou, o que se pagou ao profissional, corrigir o valor ou excluir é
          com o administrador.
        </p>
      )}
      {aberto && mexeNoDinheiro && (
        <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
          {erro && <p className="text-[11px] text-red-300">{erro}</p>}

          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              O cliente pagou-nos?
            </p>
            {emMao && t.dividaDoProfissional != null ? (
              /*
                EM DINHEIRO COM IVA INCLUÍDO — 01-10-2026. O cliente pagou o
                preço inteiro ao profissional; quem nos paga é ele, o IVA e a
                comissão, pela referência gerada ao confirmar. Se pagar por
                outro caminho (transferência, numerário), regista-se aqui.
              */
              t.clientePagouEm ? (
                <p className="mt-1 text-[11px] text-emerald-300">
                  O profissional pagou-nos {euros(t.dividaDoProfissional)} de IVA e comissão
                  {t.comoEntrou ? ` por ${nomeDoRecebimento(t.comoEntrou)}` : ""}
                  {DIA(t.clientePagouEm) ? `, a ${DIA(t.clientePagouEm)}` : ""}.
                </p>
              ) : !comoEntrou ? (
                <>
                  <p className="mt-1 text-[11px] text-slate-400">
                    O cliente pagou {euros(t.clientePaga)} ao profissional, em mão.{" "}
                    {t.profissional} deve à CLYON {euros(t.dividaDoProfissional)} (IVA e comissão) —
                    a referência gera-se ao confirmar o trabalho, ou no cartão dele em Negociações.
                  </p>
                  <button
                    onClick={() => setComoEntrou(true)}
                    disabled={ocupado}
                    className="mt-1 rounded-lg border border-amber-600/60 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    Já recebemos {euros(t.dividaDoProfissional)} dele
                  </button>
                </>
              ) : (
                <div className="mt-1 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5">
                  <p className="text-[11px] leading-relaxed text-amber-200/90">
                    Como é que entraram os {euros(t.dividaDoProfissional)}? Só se regista o que já
                    aconteceu.
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {A_MAO.filter((m) => m.id !== "ao_profissional").map((m) => (
                      <button
                        key={m.id}
                        onClick={() => onEntrou(m.id)}
                        disabled={ocupado}
                        title={m.ajuda}
                        className="rounded border border-slate-600 px-2 py-1 text-[11px] font-medium text-slate-200 hover:border-amber-500 hover:text-amber-200 disabled:opacity-50"
                      >
                        {m.rotulo}
                      </button>
                    ))}
                  </div>
                </div>
              )
            ) : emMao ? (
              <p className="mt-1 text-[11px] text-slate-400">
                Pago em mão ao profissional — não passa pela CLYON.
              </p>
            ) : t.clientePagouEm ? (
              <p className="mt-1 text-[11px] text-emerald-300">
                Sim — {euros(t.clientePaga)} por {nomeDoRecebimento(t.comoEntrou)}
                {DIA(t.clientePagouEm) ? `, a ${DIA(t.clientePagouEm)}` : ""}.
              </p>
            ) : t.declarado && metodoDoRecebimento(t.declarado.como) && !comoEntrou ? (
              /*
                A DECLARAÇÃO À FRENTE — 29-09-2026.

                Quem deu o trabalho por feito já disse para que foi o pagamento e
                como o cliente pagou. Aqui só falta a parte que se vê no banco:
                entrou, ou não. Um toque grava-o com o método declarado e o
                valor certo — com ou sem IVA, conforme a resposta.

                Se entrou de outra forma, escolhe-se à mão, como antes.
              */
              <div className="mt-1 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5">
                <p className="text-[11px] leading-relaxed text-amber-200/90">
                  Declarado ao dar o trabalho por feito
                  {t.declarado.por ? `, por ${t.declarado.por}` : ""}
                  {DIA(t.declarado.em) ? `, a ${DIA(t.declarado.em)}` : ""}:
                </p>
                <p className="mt-0.5 text-xs font-semibold text-amber-100">
                  {fraseDaDeclaracao(t.declarado.paraQue, t.declarado.como, t.clientePaga)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      const metodo = metodoDoRecebimento(t.declarado?.como ?? null);
                      if (
                        metodo &&
                        window.confirm(
                          `Confirmar que entraram ${euros(t.clientePaga)} do pedido #${t.pedidoId}?\n\n` +
                            "Veja PRIMEIRO na conta. Isto desbloqueia o dinheiro do profissional.",
                        )
                      )
                        onEntrou(metodo);
                    }}
                    disabled={ocupado}
                    className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    Confirmar que entrou
                  </button>
                  <button
                    onClick={() => setComoEntrou(true)}
                    disabled={ocupado}
                    className="text-[11px] text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline disabled:opacity-50"
                  >
                    Entrou de outra forma
                  </button>
                </div>
              </div>
            ) : !comoEntrou ? (
              /*
                ⚠️ Isto DESBLOQUEIA DINHEIRO: um registo aqui move o trabalho de
                «por cobrar» para «disponível» na carteira do profissional. Por
                isso é um segundo clique, e cada opção diz o que quer dizer.
              */
              <>
                {t.declarado && t.declarado.como === "ainda_nao" && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Ao dar o trabalho por feito
                    {t.declarado.por ? `, por ${t.declarado.por}` : ""}
                    {DIA(t.declarado.em) ? `, a ${DIA(t.declarado.em)}` : ""}:{" "}
                    {fraseDaDeclaracao(t.declarado.paraQue, t.declarado.como, t.clientePaga)}
                  </p>
                )}
                <button
                  onClick={() => setComoEntrou(true)}
                  disabled={ocupado}
                  className="mt-1 rounded-lg border border-amber-600/60 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                >
                  Já recebemos {euros(t.clientePaga)}
                </button>
              </>
            ) : (
              <div className="mt-1 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5">
                <p className="text-[11px] leading-relaxed text-amber-200/90">
                  Como é que entraram os {euros(t.clientePaga)}? Isto desbloqueia o dinheiro do
                  profissional — só se regista o que já aconteceu.
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {A_MAO.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onEntrou(m.id)}
                      disabled={ocupado}
                      title={m.ajuda}
                      className="rounded border border-slate-600 px-2 py-1 text-[11px] font-medium text-slate-200 hover:border-amber-500 hover:text-amber-200 disabled:opacity-50"
                    >
                      {m.rotulo}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Já pagámos a {t.profissional}?
            </p>
            {emMao ? (
              <p className="mt-1 text-[11px] text-slate-400">
                Recebeu do cliente, em mão — não há nada a transferir.
              </p>
            ) : t.pagoEm ? (
              <p className="mt-1 text-[11px] text-emerald-300">
                Sim — {euros(t.profissionalRecebe)} a {DIA(t.pagoEm)}.
              </p>
            ) : (
              <>
                {!prontoAPagar(t) && (
                  <p className="mt-1 text-[11px] text-amber-300">
                    {t.clientePagouEm
                      ? "O cliente ainda não confirmou o trabalho."
                      : "O cliente ainda não pagou."}{" "}
                    Marque só se a transferência já saiu — fica no histórico como adiantado.
                  </p>
                )}
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Marcar como pago a ${t.profissional}?\n\n` +
                          `${euros(t.profissionalRecebe)} pelo pedido #${t.pedidoId}.\n\n` +
                          "Faça a transferência PRIMEIRO no banco. Isto só regista que ela saiu.",
                      )
                    )
                      onPaguei();
                  }}
                  disabled={ocupado}
                  className="mt-1 flex items-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {ocupado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                  Já pagámos {euros(t.profissionalRecebe)}
                </button>
              </>
            )}
          </section>

          <section>
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <Pencil className="h-3 w-3" aria-hidden="true" />
              Corrigir o valor
            </p>
            <CorrigirValor t={t} ocupado={ocupado} onGravar={onCorrigir} />
          </section>

          <section>
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <Trash2 className="h-3 w-3" aria-hidden="true" />
              Excluir trabalho
            </p>
            <ExcluirTrabalho t={t} ocupado={ocupado} onExcluir={onExcluir} />
          </section>
        </div>
      )}
    </div>
  );
}

/**
 * CORRIGIR O VALOR FINAL, sem sair deste ecrã — 25-09-2026.
 *
 * Escreve-se o valor do TRABALHO, sem taxas, e a conta refaz-se à frente de
 * quem escreve: o que o cliente paga e o que o profissional recebe. É a mesma
 * rota das Carteiras e da Agenda, e é ela que decide — o que aqui se mostra é
 * só a pré-visualização, com as taxas desta negociação.
 *
 * Um trabalho já pago ao profissional pede motivo: depois da transferência o
 * número é um facto contabilístico, e muda-se, mas não em silêncio.
 */
function CorrigirValor({
  t,
  ocupado,
  onGravar,
}: {
  t: Trabalho;
  ocupado: boolean;
  onGravar: (valor: number, motivo: string) => void;
}) {
  const [texto, setTexto] = useState(t.valorAcordado.toFixed(2).replace(".", ","));
  const [motivo, setMotivo] = useState("");

  const valor = Number(texto.replace(/\s/g, "").replace(",", "."));
  const valido = Number.isFinite(valor) && valor > 0;
  const igual = valido && Math.abs(valor - t.valorAcordado) < 0.005;
  const faltaMotivo = Boolean(t.pagoEm) && !motivo.trim();
  const emMao = pagouAoProfissional(t);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valido && !igual && !faltaMotivo) onGravar(Math.round(valor * 100) / 100, motivo.trim());
      }}
      className="mt-2 space-y-2 rounded-lg border border-slate-700 bg-slate-950/60 p-2.5"
    >
      <label className="block text-[11px] text-slate-400">
        Valor do trabalho, sem taxas (era {euros(t.valorAcordado)})
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          inputMode="decimal"
          className="mt-1 block w-36 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm tabular-nums text-white"
        />
      </label>

      {valido && (
        <p className="text-[11px] text-slate-300">
          O cliente passa a pagar{" "}
          <strong className="text-white">{euros(contaDoCliente(valor, t.taxas).total)}</strong>{" "}
          (era {euros(t.clientePaga)}) · {t.profissional} passa a receber{" "}
          <strong className="text-white">{euros(quantoOProfissionalRecebe(valor, t.taxas))}</strong>{" "}
          (era {euros(t.profissionalRecebe)})
        </p>
      )}

      {!emMao && t.clientePagouEm && (
        <p className="text-[11px] text-amber-300">
          O cliente já pagou {euros(t.clientePaga)}. Isto não mexe no que entrou — uma diferença
          acerta-se com ele à parte.
        </p>
      )}

      <label className="block text-[11px] text-slate-400">
        Motivo {t.pagoEm ? "(obrigatório — o profissional já foi pago)" : "(opcional, fica no histórico)"}
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={300}
          placeholder="ex.: orçamento fechado no local"
          className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white placeholder:text-slate-600"
        />
      </label>

      <button
        type="submit"
        disabled={ocupado || !valido || igual || faltaMotivo}
        className="flex items-center gap-1.5 rounded-lg bg-acao px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
      >
        {ocupado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
        Gravar {valido ? euros(Math.round(valor * 100) / 100) : ""}
      </button>
    </form>
  );
}

/**
 * EXCLUIR, PARA O QUE NUNCA FOI A SÉRIO — 01-10-2026.
 *
 * *«Esse trabalho 200 foi um teste, quero excluir.»*
 *
 * Apaga o pedido e o trabalho, pelo mesmo caminho do «Apagar pedido»: cópia no
 * arquivo dos apagados, retrato no registo. A diferença é que este deixa passar
 * um trabalho fechado e por confirmar — e é por isso que a regra é o dinheiro.
 * Onde já entrou ou saiu dinheiro, o botão nem aparece, e a rota recusa na
 * mesma (inclusive uma referência do euPago por pagar, que daqui não se vê).
 *
 * Fechado por omissão, e com motivo obrigatório: é o único botão deste ecrã
 * que não se desfaz.
 */
function ExcluirTrabalho({
  t,
  ocupado,
  onExcluir,
}: {
  t: Trabalho;
  ocupado: boolean;
  onExcluir: (motivo: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");

  // Uma conta de teste sai sempre: o dinheiro dela é a fingir (01-10-2026).
  if (!t.contaDeTeste && (t.clientePagouEm || t.pagoEm || pagouAoProfissional(t))) {
    return (
      <p className="mt-1 text-[11px] text-slate-500">
        Não se exclui: neste trabalho já entrou ou saiu dinheiro. Um trabalho a sério que correu
        mal cancela-se nas Negociações.
      </p>
    );
  }

  if (!aberto) {
    return (
      <>
        {t.contaDeTeste && (
          <p className="mt-1 text-[11px] text-amber-300/90">
            Conta de teste: sai mesmo com dinheiro registado, e leva com ela as linhas da carteira e
            os recebimentos anotados à mão.
          </p>
        )}
        <button
          onClick={() => setAberto(true)}
          disabled={ocupado}
          className="mt-1 rounded-lg border border-red-700/60 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
        >
          Excluir este trabalho…
        </button>
      </>
    );
  }

  const pronto = motivo.trim().length >= 3;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pronto) return;
        if (
          window.confirm(
            `Excluir o pedido #${t.pedidoId} e o trabalho com ${t.profissional} (${euros(t.valorAcordado)})?\n\n` +
              "Não se desfaz: sai da base e fica só no arquivo dos apagados.",
          )
        )
          onExcluir(motivo.trim());
      }}
      className="mt-2 space-y-2 rounded-lg border border-red-800/60 bg-red-950/20 p-2.5"
    >
      <p className="text-[11px] leading-relaxed text-red-200/90">
        Apaga o pedido #{t.pedidoId} e o trabalho com {t.profissional}. Fica uma cópia no arquivo
        dos apagados (Configs → Retenção), e {t.profissional} vê no histórico que o pedido foi
        apagado. É para testes e enganos — um trabalho a sério que correu mal cancela-se nas
        Negociações.
      </p>

      <label className="block text-[11px] text-slate-400">
        Motivo (obrigatório — fica no arquivo e no histórico)
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={120}
          placeholder="ex.: era um pedido de teste"
          className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white placeholder:text-slate-600"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={ocupado || !pronto}
          className="flex items-center gap-1.5 rounded-lg bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40"
        >
          {ocupado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          Excluir #{t.pedidoId}
        </button>
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setMotivo("");
          }}
          className="text-[11px] text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
        >
          Não excluir
        </button>
      </div>
    </form>
  );
}

const CORES: Record<string, string> = {
  pago: "text-emerald-300",
  pendente: "text-amber-300",
  falhado: "text-red-300",
  expirado: "text-slate-400",
  cancelado: "text-slate-400",
  substituido: "text-slate-400",
  reembolsado: "text-cyan-300",
};

type Prova = {
  ok: boolean;
  temSegredoDoWebhook?: boolean;
  ambiente?: string;
  base?: string;
  entidade?: string | null;
  referencia?: string | null;
  codigo?: string | null;
  porque?: string;
  pista?: string | null;
};

export default function AdminPagamentosPanel() {
  const { token, ready } = useAdminAuth();
  // «Só ver» para o assistente — 03-10-2026. Ver `useMexeNoDinheiro`.
  const mexeNoDinheiro = useMexeNoDinheiro();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [aCarregar, setACarregar] = useState(false);
  const [prova, setProva] = useState<Prova | null>(null);
  const [aProvar, setAProvar] = useState(false);

  // O ciclo partilhado não pode acender o estado de carregamento: o ecrã
  // piscava de vinte em vinte segundos enquanto alguém lê uma linha.
  const carregar = useCallback(
    async (silencioso = false) => {
      if (!token) return;
      if (!silencioso) setACarregar(true);
      try {
        const r = await fetch("/api/admin/pagamentos", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        if (!r.ok) {
          // O detalhe vem junto, e é ele que diz por onde começar. Ver a nota
          // na rota: isto é backoffice, não um ecrã de cliente.
          setErro([d.error, d.detalhe].filter(Boolean).join(" — ") || "Não foi possível ler.");
          return;
        }
        setEstado(d);
        setErro("");
      } catch {
        if (!silencioso) setErro("Erro de rede.");
      } finally {
        setACarregar(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);

  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token) });

  /**
   * A prova de ligação: pede uma referência de 1 € que ninguém paga.
   *
   * Não cobra a ninguém e não escreve nada — serve só para responder à única
   * pergunta que não se consegue responder olhando: **a chave serve?**
   */
  async function provar() {
    setAProvar(true);
    setProva(null);
    try {
      const r = await fetch("/api/admin/pagamentos/testar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setProva((await r.json()) as Prova);
    } catch {
      setProva({ ok: false, porque: "Erro de rede." });
    } finally {
      setAProvar(false);
    }
  }

  if (!estado && (aCarregar || !erro)) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A ler os pagamentos…
      </p>
    );
  }
  if (erro && !estado) return <p className="text-sm text-red-300">{erro}</p>;
  if (!estado) return null;

  const { ligacao, resumo } = estado;
  const alarme = resumo.avisosPorAplicar > 0;

  return (
    <div className="space-y-4">
      {/* ── A resposta primeiro: há alguma coisa por resolver? ───────────── */}
      {alarme ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/[0.08] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-white">
            <AlertTriangle className="h-4 w-4 text-red-400" aria-hidden="true" />
            {resumo.avisosPorAplicar} aviso(s) do euPago por aplicar
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            Cada um é dinheiro que se moveu do lado deles e não se moveu do nosso. Não se resolvem
            sozinhos. O contrato dá dois dias úteis para comunicar uma operação não autorizada.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-white">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            Tudo o que o euPago disse está aplicado
          </p>
        </div>
      )}

      {/* ── Onde está a ligação ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
          Ligação ao euPago
        </p>
        {!ligacao.configurado ? (
          <p className="mt-2 text-sm text-amber-300">{ligacao.falta}</p>
        ) : (
          <div className="mt-2 space-y-1 text-xs text-slate-300">
            <p>
              Ambiente:{" "}
              <strong className={ligacao.ambiente === "producao" ? "text-red-300" : "text-cyan-300"}>
                {ligacao.ambiente === "producao" ? "PRODUÇÃO — dinheiro a sério" : "sandbox"}
              </strong>
            </p>
            <p>
              Segredo do webhook:{" "}
              {ligacao.temSegredoDoWebhook ? (
                <strong className="text-emerald-300">configurado</strong>
              ) : (
                <strong className="text-red-300">
                  EM FALTA — sem ele o webhook recusa todos os avisos
                </strong>
              )}
            </p>
            {estado.webhook && <PortaDosAvisos w={estado.webhook} />}
            {!ligacao.aberta && (
              <p className="flex items-start gap-1.5 text-amber-300">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {/*
                  A RAZÃO MUDOU A 29-09-2026: dizia «os ecrãs dizem-lhe hoje que
                  paga ao profissional no fim», e deixaram de o dizer a quem paga
                  pela plataforma. O que está fechado é só a caixa do cliente.
                */}
                <span>
                  O cliente não paga sozinho pelo link: em produção, isso só abre com
                  A_PLATAFORMA_COBRA ligado. As referências geram-se aqui, pedido a pedido.
                </span>
              </p>
            )}
            {/*
              O portão de testador é uma excepção nomeada, e uma excepção que
              se esquece aberta deixa de ser excepção. Por isso aparece sempre
              que existe — e some sozinha quando a variável for apagada.
            */}
            {!ligacao.aberta && (ligacao.testadores ?? 0) > 0 && (
              <p className="text-cyan-300">
                Portão de testador ABERTO para {ligacao.testadores} email(s) — esses pagam a sério,
                até {5} € por pagamento. Apague a EUPAGO_EMAILS_DE_TESTE quando acabar de testar.
              </p>
            )}
          </div>
        )}

        {/*
          A ÚNICA PERGUNTA QUE NÃO SE RESPONDE A OLHAR: a chave serve?
          O erro mais provável é `EUPAGO_AMBIENTE=sandbox` com a chave de
          produção — as duas casas do euPago têm contas separadas.
        */}
        {ligacao.configurado && mexeNoDinheiro && (
          <div className="mt-3 border-t border-slate-700/60 pt-3">
            <button
              type="button"
              onClick={() => void provar()}
              disabled={aProvar}
              className="rounded-[14px] border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40"
            >
              {aProvar ? "A perguntar ao euPago…" : "Provar a ligação"}
            </button>
            <span className="ml-2 text-[11px] text-slate-500">
              pede uma referência de 1 € que ninguém paga — não cobra nem grava nada
            </span>

            {prova?.ok && (
              <p className="mt-2 text-xs text-emerald-300">
                A chave serve. Referência de teste {prova.entidade} / {prova.referencia} criada em{" "}
                {prova.base}.
                {prova.temSegredoDoWebhook === false &&
                  " Falta o segredo do webhook — sem ele nenhum pagamento chega a ser dado por pago."}
              </p>
            )}
            {prova && !prova.ok && (
              <div className="mt-2 text-xs text-red-300">
                <p>{prova.porque}</p>
                {prova.pista && <p className="mt-1 text-amber-300">{prova.pista}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <GestorDoDinheiro
        trabalhos={estado.trabalhos ?? []}
        token={token}
        onMudou={() => void carregar(true)}
        mexeNoDinheiro={mexeNoDinheiro}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { n: resumo.pagos, t: "pagos" },
          { n: resumo.pendentes, t: "por pagar" },
          { n: resumo.falhados, t: "falhados" },
          { n: null, t: "recebido", v: euros(resumo.totalPago) },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <p className="text-2xl font-bold text-white">{c.v ?? c.n}</p>
            <p className="mt-1 text-xs text-slate-400">{c.t}</p>
          </div>
        ))}
      </div>

      {resumo.comissaoDoEupago > 0 && (
        <p className="text-xs text-slate-500">
          O euPago levou {euros(resumo.comissaoDoEupago)} — sai da parte da CLYON, não da do
          profissional.
        </p>
      )}

      {estado.avisos.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-slate-950/40 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-300">
            Por aplicar
          </p>
          <div className="space-y-1 text-xs text-slate-300">
            {estado.avisos.map((a) => (
              <p key={a.id}>
                <strong className="text-white">{a.estado}</strong> · trid {a.trid} ·{" "}
                {euros(a.valor)}
                {a.pagamentoId ? ` · pagamento #${a.pagamentoId}` : ""}
                {a.nota ? ` — ${a.nota}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}

      {estado.ultimos.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Últimos pagamentos
          </p>
          <div className="space-y-1 text-xs text-slate-300">
            {estado.ultimos.map((p) => (
              <p key={p.id}>
                <span className={CORES[p.estado] ?? "text-slate-400"}>{p.estado}</span> · pedido #
                {p.pedidoId} · {p.metodo === "mbway" ? "MB WAY" : "Multibanco"} ·{" "}
                {euros(p.valorPago ?? p.valor)}
                {p.entidade && p.referencia ? ` · ${p.entidade} / ${p.referencia}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
