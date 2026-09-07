"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Sun,
  User,
} from "lucide-react";
import type { ComponentType } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import FichaDaAgenda, { type TrabalhoDaAgenda } from "./FichaDaAgenda";
import RegistarPedido from "./RegistarPedido";
import {
  ETIQUETA,
  CORES,
  PESO_NA_AGENDA,
  quandoPorExtenso,
  type EstadoNaAgenda,
} from "@/lib/agenda-dos-trabalhos";

/**
 * A AGENDA — o que está marcado, e o que já passou do dia.
 *
 * "Quero uma agenda para o admin acompanhar as datas e horários dos trabalhos,
 * para saber se os trabalhos estão no horário ou não."
 *
 * A mesa das negociações responde «quem está à espera de quem». Esta responde
 * QUANDO — e é uma pergunta diferente, que se faz noutra altura do dia.
 *
 * A LISTA ESTÁ DIVIDIDA POR URGÊNCIA, e não por data. Era uma fila só, já
 * ordenada por urgência, mas uma fila de oito linhas onde a etiqueta de cada
 * uma é a única coisa que separa «passou do dia» de «é daqui a três semanas»
 * lê-se como se estivesse tudo junto — "está tudo junto", foi o que ele
 * disse. Agora cada estado é um bloco com título, contagem e o que fazer com
 * ele: atrasados, hoje, sem data, por vir, feitos. A ordem é a mesma de
 * sempre — por quem precisa de um telefonema mais depressa.
 */

/*
 * O tipo é O DA FICHA, e não uma cópia.
 *
 * A linha da lista e a ficha que ela abre são o mesmo trabalho: manter dois
 * tipos paralelos garantia que a coluna seguinte entrava num e não no outro,
 * e a ficha abria sem ela sem ninguém dar por isso.
 */
type Trabalho = TrabalhoDaAgenda;

const SERVICO: Record<string, string> = {
  recolha_moveis: "Recolha de móveis",
  recolha_monos: "Recolha de monos",
  recolha_entulho: "Recolha de entulho",
  esvaziamento_casa: "Esvaziamento de casa",
  esvaziamento_apartamento: "Esvaziamento de apartamento",
  mudanca: "Mudança",
  montagem_moveis: "Montagem de móveis",
};

const euros = (v: number | null) => (v == null ? "—" : v.toFixed(2).replace(".", ",") + " €");

/**
 * OS CINCO BLOCOS, na ordem em que se olha para eles.
 *
 * Cada um diz, numa linha, o que se faz com o que está lá dentro — porque é
 * essa a diferença entre os blocos. Não é a cor da etiqueta: é que um
 * atrasado pede um telefonema e um «por vir» não pede nada.
 */
const GRUPOS: Array<{
  estado: EstadoNaAgenda;
  titulo: string;
  dica: string;
  Icone: ComponentType<{ className?: string }>;
  /** A cor do título e do traço à esquerda. */
  cor: string;
  /** A cor do número no cartão de cima. */
  corDoNumero: string;
  /** A chave no `resumo` que a API devolve. */
  chave: "atrasados" | "hoje" | "semData" | "porVir" | "feitos";
  /** Fechado por omissão — o que já está feito não precisa de ocupar o ecrã. */
  fechadoPorOmissao?: boolean;
}> = [
  {
    estado: "atrasado",
    titulo: "Atrasados",
    dica: "O dia passou e ninguém deu o trabalho por feito. Ligue ao profissional primeiro.",
    Icone: AlertTriangle,
    cor: "text-rose-300 border-rose-500/60",
    corDoNumero: "text-rose-300",
    chave: "atrasados",
  },
  {
    estado: "hoje",
    titulo: "Hoje",
    dica: "É hoje. Se a hora já passou, vale a pena confirmar que está a andar.",
    Icone: Sun,
    cor: "text-amber-300 border-amber-500/60",
    corDoNumero: "text-amber-300",
    chave: "hoje",
  },
  {
    estado: "sem_data",
    titulo: "Sem data",
    dica: "Contratados sem dia marcado — um atraso que ainda não começou a contar. Combine a data.",
    Icone: CalendarX2,
    cor: "text-slate-300 border-slate-500/60",
    corDoNumero: "text-slate-300",
    chave: "semData",
  },
  {
    estado: "por_vir",
    titulo: "Por vir",
    dica: "Marcados para os próximos dias. Não precisam de nada por agora.",
    Icone: CalendarDays,
    cor: "text-cyan-300 border-cyan-500/60",
    corDoNumero: "text-cyan-300",
    chave: "porVir",
  },
  {
    estado: "feito",
    titulo: "Feitos",
    dica: "O trabalho já foi dado por feito. A confirmação e o pagamento tratam-se nas Negociações.",
    Icone: CheckCircle2,
    cor: "text-emerald-300 border-emerald-500/60",
    corDoNumero: "text-emerald-300",
    chave: "feitos",
    fechadoPorOmissao: true,
  },
];

/** Os que aparecem com «Só o que precisa de atenção» ligado. */
const PRECISAM: EstadoNaAgenda[] = ["atrasado", "hoje", "sem_data"];

export default function AdminAgendaPanel() {
  const { token } = useAdminAuth();
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [resumo, setResumo] = useState({ atrasados: 0, hoje: 0, semData: 0, porVir: 0, feitos: 0 });
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState("");
  /* Ver tudo, ou só o que precisa de alguém hoje. */
  const [soOsQuePrecisam, setSoOsQuePrecisam] = useState(true);
  /*
   * UM BLOCO SÓ, quando se carrega no cartão de cima.
   *
   * Os cartões dos totais eram só números. Passam a ser filtros: carregar em
   * «Atrasados» deixa só os atrasados no ecrã, e carregar outra vez volta a
   * mostrar todos. Não substitui a caixa de «só o que precisa de atenção» —
   * afina-a.
   */
  const [soOBloco, setSoOBloco] = useState<EstadoNaAgenda | null>(null);
  /* Que blocos estão fechados. «Feitos» nasce fechado. */
  const [fechados, setFechados] = useState<Set<EstadoNaAgenda>>(
    () => new Set(GRUPOS.filter((g) => g.fechadoPorOmissao).map((g) => g.estado)),
  );
  /*
   * A FICHA ABERTA, e o editor do pedido por cima dela.
   *
   * Guarda-se o número da negociação e não o trabalho todo: depois de gravar
   * uma data ou um valor, a lista recarrega e o objecto antigo ficaria a
   * mostrar o número velho numa ficha que já o mudou.
   */
  const [aVer, setAVer] = useState<number | null>(null);
  const [aEditarPedido, setAEditarPedido] = useState<number | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!token) return;
    /* Gravar uma data com a ficha aberta recarrega a lista por baixo. Pôr
       "A carregar…" no lugar dela fazia a ficha saltar do ecrã. */
    if (!silencioso) setACarregar(true);
    try {
      const res = await fetch("/api/admin/agenda", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível ler a agenda.");
        return;
      }
      setTrabalhos(dados.trabalhos ?? []);
      setResumo(dados.resumo ?? resumo);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
    // `resumo` só serve de valor por omissão — incluí-lo recarregaria em ciclo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const agora = new Date();

  /*
   * Que blocos se mostram: um só se estiver escolhido em cima; senão os que
   * precisam de atenção, ou todos.
   */
  const estadosVisiveis: EstadoNaAgenda[] = soOBloco
    ? [soOBloco]
    : soOsQuePrecisam
      ? PRECISAM
      : GRUPOS.map((g) => g.estado);

  /* Cada trabalho no seu bloco, e dentro do bloco o mais antigo primeiro: é o que espera há mais. */
  const porEstado = new Map<EstadoNaAgenda, Trabalho[]>();
  for (const t of trabalhos) {
    const lista = porEstado.get(t.estado) ?? [];
    lista.push(t);
    porEstado.set(t.estado, lista);
  }
  for (const lista of porEstado.values()) {
    lista.sort((a, b) => {
      const p = PESO_NA_AGENDA[a.estado] - PESO_NA_AGENDA[b.estado];
      if (p !== 0) return p;
      if (!a.quando) return 1;
      if (!b.quando) return -1;
      return new Date(a.quando).getTime() - new Date(b.quando).getTime();
    });
  }

  const gruposVisiveis = GRUPOS.filter((g) => estadosVisiveis.includes(g.estado));
  const totalVisivel = gruposVisiveis.reduce((s, g) => s + (porEstado.get(g.estado)?.length ?? 0), 0);

  function alternarFechado(estado: EstadoNaAgenda) {
    setFechados((f) => {
      const novo = new Set(f);
      if (novo.has(estado)) novo.delete(estado);
      else novo.add(estado);
      return novo;
    });
  }

  return (
    <section className="rounded-[28px] border border-slate-700/60 bg-slate-900/80 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Plataforma</p>
          <h2 className="mt-1 font-[Poppins] text-2xl font-bold text-white">Agenda</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Os trabalhos contratados, separados por urgência: primeiro o que passou do dia,
            depois o de hoje, o que ainda não tem dia marcado, e só então o que vem aí.
            Carregue num cartão para ver só esse bloco.
          </p>
        </div>
        <button
          onClick={() => carregar()}
          className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Actualizar
        </button>
      </div>

      {/* Os cartões dos totais — cada um é um filtro, e o dos atrasados puxa o olho. */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {GRUPOS.map((g) => {
          const n = resumo[g.chave];
          const escolhido = soOBloco === g.estado;
          const alarme = g.estado === "atrasado" && n > 0;
          return (
            <button
              key={g.estado}
              type="button"
              onClick={() => setSoOBloco(escolhido ? null : g.estado)}
              aria-pressed={escolhido}
              title={escolhido ? "Voltar a mostrar todos os blocos" : `Ver só ${g.titulo.toLowerCase()}`}
              className={`rounded-xl border px-4 py-2.5 text-left transition hover:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                escolhido
                  ? "border-cyan-400 bg-cyan-500/10 ring-1 ring-cyan-400/60"
                  : alarme
                    ? "border-rose-500/50 bg-rose-500/10"
                    : "border-slate-700 bg-slate-950/50"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {g.titulo}
              </p>
              <p className={`text-xl font-bold ${g.corDoNumero}`}>{n}</p>
            </button>
          );
        })}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={soOsQuePrecisam}
            disabled={soOBloco !== null}
            onChange={(e) => setSoOsQuePrecisam(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 disabled:opacity-40"
          />
          Só o que precisa de atenção
        </label>
      </div>

      {soOBloco && (
        <p className="mt-3 text-xs text-slate-400">
          A mostrar só{" "}
          <strong className="text-slate-200">
            {GRUPOS.find((g) => g.estado === soOBloco)?.titulo.toLowerCase()}
          </strong>
          .{" "}
          <button
            type="button"
            onClick={() => setSoOBloco(null)}
            className="underline decoration-slate-600 underline-offset-2 hover:text-slate-200"
          >
            Ver todos os blocos
          </button>
        </p>
      )}

      {erro && (
        <p className="mt-4 rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
          {erro}
        </p>
      )}

      {aCarregar ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A carregar…
        </p>
      ) : totalVisivel === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-400">
          {soOBloco
            ? `Nenhum trabalho em «${GRUPOS.find((g) => g.estado === soOBloco)?.titulo}».`
            : soOsQuePrecisam
              ? "Nada atrasado, nada para hoje, nada por marcar. Está tudo em dia."
              : "Nenhum trabalho contratado neste momento."}
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {gruposVisiveis.map((g) => {
            const lista = porEstado.get(g.estado) ?? [];
            /*
             * Um bloco vazio não aparece — a não ser que tenha sido escolhido
             * em cima, e aí diz que está vazio em vez de desaparecer.
             */
            if (lista.length === 0 && soOBloco !== g.estado) return null;
            const fechado = fechados.has(g.estado);
            const [corTexto, corBorda] = g.cor.split(" ");
            return (
              <section key={g.estado} aria-labelledby={`agenda-${g.estado}`}>
                {/*
                  O TÍTULO DO BLOCO fica colado ao topo enquanto o bloco rola:
                  com doze atrasados, a pessoa a meio da lista continua a saber
                  em que bloco está.
                */}
                <button
                  type="button"
                  onClick={() => alternarFechado(g.estado)}
                  aria-expanded={!fechado}
                  className={`sticky top-0 z-10 flex w-full items-center gap-3 rounded-xl border-l-4 bg-slate-900 px-3 py-2 text-left ${corBorda} hover:bg-slate-800/80`}
                >
                  <g.Icone className={`h-4 w-4 shrink-0 ${corTexto}`} aria-hidden="true" />
                  <h3 id={`agenda-${g.estado}`} className={`text-sm font-bold uppercase tracking-wider ${corTexto}`}>
                    {g.titulo}
                  </h3>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-200">
                    {lista.length}
                  </span>
                  <span className="hidden min-w-0 flex-1 truncate text-xs text-slate-500 sm:block">
                    {g.dica}
                  </span>
                  {fechado ? (
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  )}
                </button>

                {!fechado && (
                  <div className="mt-2 space-y-2 pl-1">
                    {lista.length === 0 ? (
                      <p className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-4 text-center text-sm text-slate-500">
                        Nada aqui.
                      </p>
                    ) : (
                      lista.map((t) => (
                        <LinhaDaAgenda
                          key={t.negociacaoId}
                          t={t}
                          agora={agora}
                          onAbrir={() => setAVer(t.negociacaoId)}
                        />
                      ))
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-5 text-xs leading-relaxed text-slate-500">
        Toque numa linha para abrir o pedido — e corrigir a data, a hora ou o valor. O dia
        marca-o o profissional no painel dele, ou a CLYON aqui, depois de o trabalho ser
        contratado; é a mesma data, não são duas. O que aparece como{" "}
        <strong className="text-slate-400">pedido pelo cliente</strong> é a data do
        formulário e ainda não foi combinada com ninguém. Um trabalho sai de{" "}
        <strong className="text-slate-400">Atrasados</strong> quando o profissional o dá
        por feito no painel dele; a confirmação e o pagamento são nas Negociações.
      </p>

      {/*
        A FICHA lê-se sempre da lista recarregada, e não de uma cópia guardada
        no momento do clique: depois de gravar 230 € por cima de 135 €, a ficha
        tem de passar a dizer 230.
      */}
      {aVer != null && token && (() => {
        const t = trabalhos.find((x) => x.negociacaoId === aVer);
        if (!t) return null;
        return (
          <FichaDaAgenda
            t={t}
            token={token}
            onFechar={() => setAVer(null)}
            onMudou={() => carregar(true)}
            onEditarPedido={(id) => setAEditarPedido(id)}
          />
        );
      })()}

      {/*
        O editor do pedido, por cima da ficha e não no lugar dela: fechá-lo
        devolve a pessoa ao sítio de onde saiu.

        NÃO FECHA COM UM CLIQUE AO LADO — são catorze campos e fotografias.
      */}
      {aEditarPedido != null && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#0B1220] p-4 sm:p-8">
          <div className="mx-auto max-w-5xl">
            <RegistarPedido
              editarId={aEditarPedido}
              onCriado={() => carregar(true)}
              onFechar={() => {
                setAEditarPedido(null);
                carregar(true);
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * UMA LINHA DA AGENDA — a mesma em todos os blocos.
 *
 * Saiu do corpo do painel para poder ser desenhada cinco vezes, uma por
 * bloco, sem copiar o código cinco vezes. O que ela mostra e faz é o que já
 * fazia: a linha inteira abre a ficha, os dois telefones ligam.
 */
function LinhaDaAgenda({
  t,
  agora,
  onAbrir,
}: {
  t: Trabalho;
  agora: Date;
  onAbrir: () => void;
}) {
  const a = {
    estado: t.estado,
    quando: t.quando ? new Date(t.quando) : null,
    origem: t.origem,
    diasDeAtraso: t.diasDeAtraso,
    horaJaPassou: t.horaJaPassou,
  };
  /*
    PEDIDO PARA UM DIA, COMBINADO PARA OUTRO.

    É metade da razão de existir deste ecrã. Quando as duas datas
    existem e não batem certo, diz-se — porque um cliente que pediu
    quinta e vai ser atendido no sábado é uma conversa que alguém
    tem de ter tido, e às vezes não teve.
  */
  const desencontro =
    t.dataCombinada &&
    t.dataDoCliente &&
    new Date(t.dataCombinada).toDateString() !== new Date(t.dataDoCliente).toDateString();

  return (
    /*
      A LINHA INTEIRA ABRE A FICHA — e os dois telefones não mudaram.

      Estava escrito aqui que não havia botão de abrir de propósito:
      quem chega já sabe que vai ligar, e um botão era mais um toque
      entre a pergunta e a resposta. Continua verdade para a chamada,
      e passou a ser meia verdade para o resto — ele desliga o
      telefone com uma data nova na mão e não tinha onde a pôr.

      Por isso a ficha não roubou o lugar a ninguém: os telefones
      ficam onde estavam, com `stopPropagation` para o toque neles
      não abrir nada, e o resto da linha abre.
    */
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
      aria-label={`Abrir o pedido #${t.pedidoId}`}
      className={`cursor-pointer rounded-xl border px-4 py-3 transition hover:border-cyan-600/60 focus:outline-none focus-visible:border-cyan-500 ${
        t.estado === "atrasado"
          ? "border-rose-500/40 bg-rose-500/5"
          : "border-slate-800 bg-slate-950/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-100">
            <span className="text-slate-400">#{t.pedidoId}</span>
            {SERVICO[t.servico ?? ""] ?? t.servico ?? "Trabalho"}
            {/*
              Dentro de um bloco só de atrasados a palavra «Atrasado» é
              redundante; o que interessa é HÁ QUANTO TEMPO. A etiqueta
              mantém-se pelos dias, e pelo caso de o bloco estar fechado e a
              linha aparecer noutro contexto.
            */}
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${CORES[t.estado]}`}>
              {t.estado === "atrasado"
                ? `${t.diasDeAtraso} dia${t.diasDeAtraso === 1 ? "" : "s"} de atraso`
                : ETIQUETA[t.estado]}
            </span>
            {t.estado === "hoje" && t.horaJaPassou && (
              <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                <Clock className="h-3 w-3" aria-hidden="true" />a hora já passou
              </span>
            )}
          </p>

          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-300">
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
            {quandoPorExtenso(a, agora)}
            {t.origem === "do_cliente" && t.quando && (
              <span className="text-[11px] text-slate-500">
                (o cliente pediu — ainda não foi confirmado com ele)
              </span>
            )}
          </p>

          {desencontro && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              O cliente tinha pedido {new Date(t.dataDoCliente!).toLocaleDateString("pt-PT")}.
            </p>
          )}

          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" aria-hidden="true" />
              {t.profissionalNome}
            </span>
            {t.cidade && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {t.cidade}
              </span>
            )}
            <span>{euros(t.valorAcordado)}</span>
          </p>
        </div>

        {/*
          OS DOIS TELEFONES, e não um botão de abrir.

          Quem chega aqui já sabe o que quer fazer: ligar a um dos
          dois e perguntar o que aconteceu. Um botão que abre uma
          ficha é mais um toque entre a pergunta e a resposta.
        */}
        <div className="flex shrink-0 flex-wrap gap-2">
          {t.profissionalTelefone && (
            <a
              href={`tel:${t.profissionalTelefone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-600 hover:text-cyan-300"
            >
              <Phone className="h-3 w-3" aria-hidden="true" />
              {t.profissionalNome.split(" ")[0]}
            </a>
          )}
          {t.clienteTelefone && (
            <a
              href={`tel:${t.clienteTelefone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-600 hover:text-cyan-300"
            >
              <Phone className="h-3 w-3" aria-hidden="true" />
              {t.clienteNome?.split(" ")[0] ?? "Cliente"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
