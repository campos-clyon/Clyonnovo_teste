"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import {
  AlertTriangle,
  CalendarX,
  Camera,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Trash2,
  Archive,
  Download,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * A RETENÇÃO — o que a purga apagaria, antes de a armar.
 *
 * "Pode confirmar se os pedidos estão a ser excluídos automaticamente após 60
 * dias?" A resposta, a 14-09-2026, era: não. A purga existe, corre todas as
 * noites, e está em MODO SECO desde que foi construída — conta e não apaga.
 *
 * O número que ela conta ia para o registo permanente, que era escrito e nunca
 * lido: três funções para o consultar, nenhuma chamada em lado nenhum. Ou
 * seja, a única coisa que se precisava de ver antes de armar era a única que
 * não se via.
 *
 * ESTE ECRÃ NÃO TEM BOTÃO DE ARMAR, E É DE PROPÓSITO. Arma-se numa variável de
 * ambiente com um redeploy pelo meio, e essa lentidão é a última coisa que
 * separa uma tarde má de uma base vazia.
 */

type Estado = {
  armada: boolean;
  diasDosTerminados: number;
  diasDosAbandonados: number;
  elegiveis: number;
  naProximaPassagem: number;
  fotografias: number;
  eventos: number;
  recolhasAbandonadas: number;
  recolhasOrfas: number;
  diasDasRecolhas: number;
  restantes: number;
  naMira: number[];
  ultimas: Array<{
    id: number;
    ocorridoEm: string;
    resumo: string | null;
    autorNome: string | null;
  }>;
};

function quando(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function AdminRetencaoPanel() {
  const { token, ready } = useAdminAuth();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [aCarregar, setACarregar] = useState(false);

  const carregar = useCallback(async (silencioso = false) => {
    if (!token) return;
    if (!silencioso) setACarregar(true);
    try {
      const res = await fetch("/api/admin/retencao", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível contar.");
        return;
      }
      setEstado(dados);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);

  /*
   * NOVIDADES SEM F5 — 16-09-2026.
   *
   * "sempre que quero ver as novidades tenho que ficar atualizando tudo, mas
   * isso não devia acontecer (…) como no WhatsApp, quando alguém envia
   * mensagem." Catorze dos dezasseis painéis deste backoffice não tinham
   * ciclo nenhum.
   *
   * Silencioso de propósito: não mexe no estado de carregamento, não grita
   * erros de rede, pára com o separador escondido e volta a buscar assim que
   * ele reaparece.
   */
  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token) });

  if (!estado && !erro) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A contar o que seria
        apagado…
      </p>
    );
  }
  if (erro) return <p className="text-sm text-red-300">{erro}</p>;
  if (!estado) return null;

  return (
    <div className="space-y-4">
      {/*
        O ESTADO, primeiro e em cores diferentes: «conta e não apaga» e «apaga
        mesmo» são dois mundos, e quem abre este ecrã tem de saber em qual está
        antes de olhar para qualquer número.
      */}
      <div
        className={`rounded-xl border p-4 ${
          estado.armada
            ? "border-red-500/40 bg-red-500/[0.08]"
            : "border-emerald-500/30 bg-emerald-500/[0.06]"
        }`}
      >
        <p className="flex items-center gap-2 text-sm font-bold text-white">
          {estado.armada ? (
            <>
              <AlertTriangle className="h-4 w-4 text-red-400" aria-hidden="true" />A purga está
              ARMADA — apaga todas as noites
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              Modo seco — conta e não apaga nada
            </>
          )}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          {estado.armada
            ? "Para travar, apague a variável PURGA_ARMADA na Vercel e faça um redeploy."
            : "Para armar: PURGA_ARMADA=sim na Vercel, e um redeploy. Confirme antes que há cópia de segurança da base — a purga não tem volta."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-2xl font-bold text-white">{estado.elegiveis}</p>
          <p className="mt-1 text-xs text-slate-400">
            pedidos cumprem a regra hoje
            <span className="mt-1 block text-[11px] text-slate-500">
              {estado.diasDosTerminados} dias os terminados, {estado.diasDosAbandonados} os
              abandonados
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-2xl font-bold text-white">{estado.naProximaPassagem}</p>
          <p className="mt-1 text-xs text-slate-400">
            iriam na próxima passagem
            {estado.restantes > 0 && (
              <span className="mt-1 block text-[11px] text-amber-300">
                e {estado.restantes} ficariam para a noite seguinte
              </span>
            )}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="flex items-center gap-2 text-2xl font-bold text-white">
            <Camera className="h-5 w-5 text-slate-400" aria-hidden="true" />
            {estado.fotografias}
          </p>
          <p className="mt-1 text-xs text-slate-400">fotografias sairiam com eles</p>
        </div>
        {/*
          OS EVENTOS DA AGENDA, ao lado das fotografias e pela mesma razão.

          Cada evento leva o nome do cliente, o telefone, a morada e o andar.
          Até 14-09-2026 nada os apagava: o pedido ia-se, o `calendarEventId`
          ia-se com ele, e o evento ficava numa agenda sem ninguém saber que lá
          estava. Este número é o que sai da agenda na primeira passagem a
          sério.
        */}
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="flex items-center gap-2 text-2xl font-bold text-white">
            <CalendarX className="h-5 w-5 text-slate-400" aria-hidden="true" />
            {estado.eventos}
          </p>
          <p className="mt-1 text-xs text-slate-400">eventos sairiam da agenda do Google</p>
        </div>
      </div>

      {/*
        O BLOCO DE NOTAS DO ASSISTENTE, à parte dos pedidos porque não é um
        pedido: é a conversa do WhatsApp a meio, com o nome e a morada de quem
        respondeu e nunca chegou ao fim. Nada a apagava pela idade até
        14-09-2026. As órfãs são piores do que as abandonadas — essas apontam
        para um pedido que a purga já levou, e eram a cópia que sobrevivia.
      */}
      {(estado.recolhasAbandonadas > 0 || estado.recolhasOrfas > 0) && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span>
            No assistente do WhatsApp:{" "}
            <strong className="text-white">{estado.recolhasAbandonadas}</strong> conversa(s) parada(s)
            há mais de {estado.diasDasRecolhas} dias
            {estado.recolhasOrfas > 0 && (
              <>
                {" "}e <strong className="text-amber-300">{estado.recolhasOrfas}</strong> de pedidos
                que já não existem
              </>
            )}
            . Guardam nome e morada, e saem na mesma passagem.
          </span>
        </p>
      )}

      {/*
        OS NÚMEROS DOS PEDIDOS, e não só a contagem. Antes de armar uma coisa
        irreversível, quem decide tem de poder abrir dois ou três e ver se são
        mesmo o que pensa que são.
      */}
      {estado.naMira.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-xs font-semibold text-slate-300">
            Os que iriam na próxima passagem — abra um ou dois antes de decidir:
          </p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-slate-400">
            {estado.naMira.map((id) => `#${id}`).join("  ")}
          </p>
        </div>
      )}

      {/*
        O REGISTO FECHA-SE — 16-09-2026.
        "Organize essa tela, coloque as informações dentro de botões para não
        poluir a tela."

        Eram vinte linhas de «Pedido apagado — retenção de 60 dias», todas
        iguais, a empurrar para baixo tudo o que interessa ler primeiro: os
        números e o aviso de a purga estar armada. Um registo serve para se ir
        lá quando se desconfia de alguma coisa — não para estar aberto sempre.

        `<details>` e não estado em React: fecha e abre sozinho, o browser
        lembra-se do foco, e funciona sem JavaScript nenhum.
      */}
      <details className="rounded-xl border border-slate-800 bg-slate-950/60">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-xs font-semibold text-slate-300 hover:text-white">
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />O que a purga escreveu no registo
          permanente
          <span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
            {estado.ultimas.length}
          </span>
        </summary>
        <div className="px-4 pb-4">
          {estado.ultimas.length === 0 ? (
            <p className="text-xs text-slate-500">
              Ainda nada. O cron corre às 04:30; a primeira linha aparece amanhã.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {estado.ultimas.map((l) => (
                <li key={l.id} className="text-xs leading-relaxed text-slate-400">
                  <span className="text-slate-500">{quando(l.ocorridoEm)}</span> — {l.resumo}
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <ArquivoDosApagados />

      <button
        onClick={() => void carregar()}
        disabled={aCarregar}
        className="flex min-h-[36px] items-center gap-2 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
      >
        {aCarregar && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        Contar outra vez
      </button>
    </div>
  );
}

type LinhaDoArquivo = {
  id: number;
  pedidoId: number;
  motivo: string | null;
  clienteNome: string | null;
  clienteEmail: string | null;
  criadoEm: string;
  tamanho: number;
};

/** Kilobytes redondos: ninguém precisa de saber que são 12 438 bytes. */
function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} kB`;
}

/**
 * O ARQUIVO DOS PEDIDOS APAGADOS.
 *
 * "leve os arquivos dos nossos históricos de pedidos que foram apagados para
 * as configs, assim o admin pode baixar e visualizar quando necessário."
 * — 16-09-2026.
 *
 * O registo permanente, ali em cima, diz QUE um pedido foi apagado. Isto guarda
 * O QUE ELE ERA: a descrição, as negociações todas e o histórico — incluindo as
 * conversas de suporte que tinham sido escritas dentro dele, que até agora se
 * iam com a linha.
 *
 * Fechado por omissão, como o registo. Uma lista de duzentos ficheiros que
 * ninguém abre num mês normal não pode ser a primeira coisa deste ecrã.
 */
function ArquivoDosApagados() {
  const { token, ready } = useAdminAuth();
  const [linhas, setLinhas] = useState<LinhaDoArquivo[]>([]);
  const [aCarregar, setACarregar] = useState(false);
  const [erro, setErro] = useState("");
  const [jaPediu, setJaPediu] = useState(false);

  /*
   * Só se vai buscar quando ele abre.
   *
   * Está fechado na esmagadora maioria das visitas: pedir a lista ao carregar
   * o ecrã era uma consulta por cada entrada nas Configs, para nada.
   */
  async function abrir() {
    if (jaPediu || !token) return;
    setJaPediu(true);
    setACarregar(true);
    try {
      const res = await fetch("/api/admin/arquivo", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível ler o arquivo.");
        return;
      }
      setLinhas(dados.arquivos ?? []);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }

  return (
    <details
      className="rounded-xl border border-slate-800 bg-slate-950/60"
      onToggle={(ev) => {
        if ((ev.currentTarget as HTMLDetailsElement).open && ready) void abrir();
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-xs font-semibold text-slate-300 hover:text-white">
        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
        Arquivo dos pedidos apagados — para descarregar
        {linhas.length > 0 && (
          <span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
            {linhas.length}
          </span>
        )}
      </summary>
      <div className="px-4 pb-4">
        <p className="mb-3 text-xs leading-relaxed text-slate-500">
          O que cada pedido era antes de a purga passar: descrição, negociações e histórico,
          conversas de suporte incluídas. Guardado na base e não num endereço público — leva
          dados pessoais de clientes.
        </p>

        {aCarregar && (
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />A ler…
          </p>
        )}
        {erro && <p className="text-xs text-red-300">{erro}</p>}

        {!aCarregar && !erro && linhas.length === 0 && jaPediu && (
          <p className="text-xs text-slate-500">
            Ainda nada aqui. Os pedidos apagados antes de 16-09-2026 não deixaram cópia — só a
            linha no registo permanente.
          </p>
        )}

        {linhas.length > 0 && (
          <ul className="space-y-1.5">
            {linhas.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-800/80 px-3 py-2 text-xs"
              >
                <span className="font-semibold text-slate-200">#{l.pedidoId}</span>
                <span className="text-slate-400">{l.clienteNome ?? "sem nome"}</span>
                <span className="text-slate-600">{quando(l.criadoEm)}</span>
                <span className="text-slate-600">{tamanhoLegivel(l.tamanho)}</span>
                <span className="ml-auto flex gap-2">
                  <a
                    href={`/api/admin/arquivo/${l.id}?ver=1`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-600 px-2.5 py-1 font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Ver
                  </a>
                  <a
                    href={`/api/admin/arquivo/${l.id}`}
                    className="flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1 font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    <Download className="h-3 w-3" aria-hidden="true" />
                    Descarregar
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
