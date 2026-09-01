"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Loader2, MapPin, Phone, RefreshCw, User } from "lucide-react";
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
 * A LISTA ESTÁ ORDENADA POR URGÊNCIA, e não por data. Cronológica punha o
 * trabalho de daqui a três semanas por cima do que passou do dia a semana
 * passada, e é este que precisa de um telefonema. A ordem é: atrasado, hoje,
 * sem data, por vir, feito.
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

export default function AdminAgendaPanel() {
  const { token } = useAdminAuth();
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [resumo, setResumo] = useState({ atrasados: 0, hoje: 0, semData: 0, porVir: 0, feitos: 0 });
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState("");
  /* Ver tudo, ou só o que precisa de alguém hoje. */
  const [soOsQuePrecisam, setSoOsQuePrecisam] = useState(true);
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
  const precisam: EstadoNaAgenda[] = ["atrasado", "hoje", "sem_data"];
  const visiveis = (soOsQuePrecisam ? trabalhos.filter((t) => precisam.includes(t.estado)) : trabalhos)
    .slice()
    .sort((a, b) => {
      const p = PESO_NA_AGENDA[a.estado] - PESO_NA_AGENDA[b.estado];
      if (p !== 0) return p;
      // Dentro do mesmo estado, o mais antigo primeiro: é o que espera há mais.
      if (!a.quando) return 1;
      if (!b.quando) return -1;
      return new Date(a.quando).getTime() - new Date(b.quando).getTime();
    });

  const montes: Array<{ chave: keyof typeof resumo; rotulo: string; cor: string }> = [
    { chave: "atrasados", rotulo: "Atrasados", cor: "text-rose-300" },
    { chave: "hoje", rotulo: "Hoje", cor: "text-amber-300" },
    { chave: "semData", rotulo: "Sem data", cor: "text-slate-300" },
    { chave: "porVir", rotulo: "Por vir", cor: "text-cyan-300" },
  ];

  return (
    <section className="rounded-[28px] border border-slate-700/60 bg-slate-900/80 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Plataforma</p>
          <h2 className="mt-1 font-[Poppins] text-2xl font-bold text-white">Agenda</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Os trabalhos contratados, por ordem de quem precisa de si mais depressa — e
            não por data. Um trabalho que passou do dia vem sempre à frente do que está
            marcado para a semana que vem.
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

      {/* Os montes, e o dos atrasados a puxar o olho. */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {montes.map((m) => (
          <div
            key={m.chave}
            className={`rounded-xl border px-4 py-2.5 ${
              m.chave === "atrasados" && resumo.atrasados > 0
                ? "border-rose-500/50 bg-rose-500/10"
                : "border-slate-700 bg-slate-950/50"
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {m.rotulo}
            </p>
            <p className={`text-xl font-bold ${m.cor}`}>{resumo[m.chave]}</p>
          </div>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={soOsQuePrecisam}
            onChange={(e) => setSoOsQuePrecisam(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900"
          />
          Só o que precisa de atenção
        </label>
      </div>

      {erro && (
        <p className="mt-4 rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
          {erro}
        </p>
      )}

      {aCarregar ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A carregar…
        </p>
      ) : visiveis.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-400">
          {soOsQuePrecisam
            ? "Nada atrasado, nada para hoje, nada por marcar. Está tudo em dia."
            : "Nenhum trabalho contratado neste momento."}
        </p>
      ) : (
        <div className="mt-5 space-y-2">
          {visiveis.map((t) => {
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
              new Date(t.dataCombinada).toDateString() !==
                new Date(t.dataDoCliente).toDateString();

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
                key={t.negociacaoId}
                role="button"
                tabIndex={0}
                onClick={() => setAVer(t.negociacaoId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setAVer(t.negociacaoId);
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
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${CORES[t.estado]}`}
                      >
                        {ETIQUETA[t.estado]}
                        {t.estado === "atrasado" &&
                          ` · ${t.diasDeAtraso} dia${t.diasDeAtraso === 1 ? "" : "s"}`}
                      </span>
                      {t.estado === "hoje" && t.horaJaPassou && (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                          a hora já passou
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
                        O cliente tinha pedido{" "}
                        {new Date(t.dataDoCliente!).toLocaleDateString("pt-PT")}.
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
          })}
        </div>
      )}

      <p className="mt-5 text-xs leading-relaxed text-slate-500">
        Toque numa linha para abrir o pedido — e corrigir a data, a hora ou o valor. O dia
        marca-o o profissional no painel dele, ou a CLYON aqui, depois de o trabalho ser
        contratado; é a mesma data, não são duas. O que aparece como{" "}
        <strong className="text-slate-400">pedido pelo cliente</strong> é a data do
        formulário e ainda não foi combinada com ninguém.
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
