"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import {
  AlertTriangle,
  CalendarX,
  Camera,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Loader2,
  MessageSquare,
  Power,
  ShieldCheck,
  Trash2,
  Archive,
  Download,
} from "lucide-react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";

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
 * ESTE ECRÃ NÃO ARMA A PURGA, E É DE PROPÓSITO. Arma-se numa variável de
 * ambiente com um redeploy pelo meio, e essa lentidão é a última coisa que
 * separa uma tarde má de uma base vazia.
 *
 * O QUE ELE LIGA, DESDE 26-10-2026 (d32), É OUTRA COISA: as regras novas da
 * retenção — anonimizar os trabalhos fechados, a guarda pelo dinheiro, os
 * ficheiros sem referência, os contactos. Nascem em ensaio (contam e não mudam
 * nada) e só o administrador as liga, escrevendo «LIGAR». Ver
 * `regras-novas-da-retencao.ts`.
 */

type Interruptor = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

type Noite = {
  id: number;
  ocorridoEm: string;
  resumo: string | null;
  autorNome: string | null;
};

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
  regrasNovas: Interruptor;
  noites: Noite[];
  noitesTotal: number;
  pagina: number;
};

const NOITES_POR_PAGINA = 20;

function quando(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-PT", {
        timeZone: "Europe/Lisbon",
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
  const [pagina, setPagina] = useState(1);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!token) return;
      if (!silencioso) setACarregar(true);
      try {
        const res = await fetch(`/api/admin/retencao?pagina=${pagina}`, {
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
    },
    [token, pagina],
  );

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

  const paginas = Math.max(1, Math.ceil((estado.noitesTotal ?? 0) / NOITES_POR_PAGINA));

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

      <RegrasNovas
        interruptor={estado.regrasNovas}
        armada={estado.armada}
        aoMudar={() => void carregar(true)}
      />

      <p className="text-xs font-semibold text-slate-400">Com as regras de hoje:</p>
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

        UMA LINHA POR NOITE — 26-10-2026 (d32, parte G). Eram as últimas vinte
        linhas da purga, com uma por cada pedido apagado: uma noite de 31
        empurrava os resumos para fora. Agora é o resumo de cada noite (e a
        purga escreve um todas as noites, mesmo com zero), vinte de cada vez,
        com as mais antigas a uma página de distância.

        `<details>` e não estado em React: fecha e abre sozinho, o browser
        lembra-se do foco, e funciona sem JavaScript nenhum.
      */}
      <details className="rounded-xl border border-slate-800 bg-slate-950/60">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-xs font-semibold text-slate-300 hover:text-white">
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />O que a purga escreveu no registo
          permanente — uma linha por noite
          <span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
            {estado.noitesTotal}
          </span>
        </summary>
        <div className="px-4 pb-4">
          {estado.noites.length === 0 ? (
            <p className="text-xs text-slate-500">
              Ainda nada. O cron corre às 04:30; a primeira linha aparece amanhã.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {estado.noites.map((l) => (
                <li key={l.id} className="text-xs leading-relaxed text-slate-400">
                  <span className="text-slate-500">{quando(l.ocorridoEm)}</span> — {l.resumo}
                </li>
              ))}
            </ul>
          )}
          {paginas > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <button
                type="button"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina <= 1}
                className="flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-700 px-2.5 hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Mais recentes
              </button>
              <span>
                Página {pagina} de {paginas}
              </span>
              <button
                type="button"
                onClick={() => setPagina((p) => Math.min(paginas, p + 1))}
                disabled={pagina >= paginas}
                className="flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-700 px-2.5 hover:bg-slate-800 disabled:opacity-40"
              >
                Mais antigas
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
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

/* ──────────────────────────────────────────────────────────────────────────
 * AS REGRAS NOVAS (d32) — o ensaio e o interruptor
 * ────────────────────────────────────────────────────────────────────────── */

type Ensaio = {
  a: {
    pedidos: number;
    ficheiros: number;
    fotografiasDaProva: number;
    fotografiasDosAjustes: number;
    ficheirosPartilhados: number;
    eventos: number;
    ficamPorDinheiro: number;
    ficamComAcordoVivo: number;
    aindaNoPrazo: number;
    jaAnonimizados: number;
    ids: number[];
  };
  b: { comAsNovas: number; hoje: number; semTrabalhoNemDinheiro: number; rejeitados: number; ids: number[] };
  d: { concluidosComPrecoProtegidos: number };
  c: { arquivo: number; registo: number };
  e: { ficheiros: number; bytes: number; maisAntigo: string | null; lista: string[]; erro: string | null };
  f: { contactos: number };
  g: { telemovel: number };
};

type RespostaDoEnsaio = {
  prazos: { anonimizar: number; orfaos: number; contactos: number; rejeitados: number; telemovel: number };
  ensaio: Ensaio;
};

function megas(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1).replace(".", ",");
}

/** Um número e o que ele quer dizer, no mesmo cartão. */
function Numero({ valor, texto, nota }: { valor: number | string; texto: string; nota?: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <p className="text-xl font-bold text-white">{valor}</p>
      <p className="mt-1 text-xs text-slate-400">{texto}</p>
      {nota && <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{nota}</p>}
    </div>
  );
}

function RegrasNovas({
  interruptor,
  armada,
  aoMudar,
}: {
  interruptor: Interruptor;
  armada: boolean;
  aoMudar: () => void;
}) {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [resposta, setResposta] = useState<RespostaDoEnsaio | null>(null);
  const [aContar, setAContar] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [palavra, setPalavra] = useState("");
  const [aMudar, setAMudar] = useState(false);

  /*
   * O ENSAIO PEDE-SE À PARTE e só quando se abre o ecrã (ou se carrega no
   * botão): lista o Blob inteiro e procura cada ficheiro na base. Não entra no
   * refrescar de minuto a minuto do resto.
   */
  const contar = useCallback(async () => {
    if (!token) return;
    setAContar(true);
    try {
      const res = await fetch("/api/admin/retencao/ensaio", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível contar as regras novas.");
        return;
      }
      setResposta(dados);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAContar(false);
    }
  }, [token]);

  useEffect(() => {
    if (ready) void contar();
  }, [ready, contar]);

  async function mudar(ligar: boolean) {
    if (!token) return;
    setAMudar(true);
    try {
      const res = await fetch("/api/admin/retencao/interruptor", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ligar, confirmacao: palavra }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível mudar.");
        return;
      }
      setConfirmar(false);
      setPalavra("");
      setErro("");
      aoMudar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAMudar(false);
    }
  }

  const e = resposta?.ensaio;
  const p = resposta?.prazos;
  const ligadas = interruptor.ligado;

  return (
    <div
      className={`rounded-xl border p-4 ${
        ligadas ? "border-red-500/40 bg-red-500/[0.06]" : "border-amber-500/30 bg-amber-500/[0.05]"
      }`}
    >
      <p className="flex items-center gap-2 text-sm font-bold text-white">
        {ligadas ? (
          <Power className="h-4 w-4 text-red-400" aria-hidden="true" />
        ) : (
          <FlaskConical className="h-4 w-4 text-amber-300" aria-hidden="true" />
        )}
        {ligadas ? "Regras novas LIGADAS — valem a sério" : "Regras novas em ensaio — contam e não mudam nada"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-300">
        {ligadas
          ? `Ligadas${interruptor.mudadoEm ? ` a ${quando(interruptor.mudadoEm)}` : ""}${
              interruptor.porQuem ? ` por ${interruptor.porQuem}` : ""
            }.${armada ? " Cada noite anonimizam, apagam e limpam o que está contado abaixo." : " A purga não está armada: até estar, nada se faz."}`
          : "Anonimizar os trabalhos fechados, guardar pelo dinheiro e não pelo acordo, limpar os ficheiros sem pedido e os contactos antigos. Até o administrador as ligar, a purga só conta o que fariam — aqui e numa linha por noite no registo."}
      </p>

      {aContar && !e && (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />A contar (lê o
          armazenamento das fotografias inteiro)…
        </p>
      )}
      {erro && <p className="mt-3 text-xs text-red-300">{erro}</p>}

      {e && p && (
        <>
          <p className="mt-3 text-xs font-semibold text-slate-300">
            {ligadas ? "O que ainda está por fazer:" : "O que fariam hoje:"}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Numero
              valor={e.a.pedidos}
              texto={`pedidos com trabalho anonimizados (${p.anonimizar} dias depois de fechados)`}
              nota={
                `${e.a.ficheiros + e.a.fotografiasDaProva + e.a.fotografiasDosAjustes} ficheiros saem do Blob` +
                (e.a.ficheirosPartilhados > 0 ? ` (menos ${e.a.ficheirosPartilhados} que outro pedido usa)` : "") +
                `, ${e.a.eventos} eventos da agenda. Ficam o primeiro nome, a localidade, as datas e os valores. ` +
                `${e.a.ficamPorDinheiro} ficam por terem dinheiro por acertar, ${e.a.aindaNoPrazo} ainda não fizeram ${p.anonimizar} dias.`
              }
            />
            <Numero
              valor={`${e.b.comAsNovas} (hoje ${e.b.hoje})`}
              texto="pedidos que a purga apagaria"
              nota={`${e.b.semTrabalhoNemDinheiro} cancelados ou arquivados com acordo mas sem trabalho nem dinheiro; ${e.b.rejeitados} rejeitados aos ${p.rejeitados} dias. Um concluído com preço nunca se apaga${e.d.concluidosComPrecoProtegidos > 0 ? ` (${e.d.concluidosComPrecoProtegidos} protegidos)` : ""}.`}
            />
            <Numero
              valor={e.e.erro ? "—" : e.e.ficheiros}
              texto={`ficheiros sem pedido nenhum, com mais de ${p.orfaos} dias`}
              nota={
                e.e.erro
                  ? `Não contados: ${e.e.erro}. Nessa noite nada sai.`
                  : `${megas(e.e.bytes)} MB${e.e.maisAntigo ? `, o mais antigo de ${quando(e.e.maisAntigo)}` : ""}.`
              }
            />
            <Numero valor={e.f.contactos} texto={`contactos (leads) com mais de ${p.contactos} dias`} />
            <Numero
              valor={e.c.arquivo + e.c.registo}
              texto="linhas antigas com o nome inteiro ou o email"
              nota={`${e.c.arquivo} no arquivo dos apagados, ${e.c.registo} no registo da purga. Fica o primeiro nome.`}
            />
            <Numero
              valor={e.g.telemovel}
              texto={`conversas lidas do telemóvel com mais de ${p.telemovel} dias`}
            />
          </div>

          {(e.a.ids.length > 0 || e.b.ids.length > 0) && (
            <details className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60">
              <summary className="cursor-pointer list-none p-3 text-xs font-semibold text-slate-300 hover:text-white">
                Os números dos pedidos — abra um ou dois antes de decidir
              </summary>
              <div className="space-y-2 px-3 pb-3 font-mono text-xs leading-relaxed text-slate-400">
                {e.a.ids.length > 0 && <p>Anonimizar: {e.a.ids.map((id) => `#${id}`).join("  ")}</p>}
                {e.b.ids.length > 0 && <p>Apagar: {e.b.ids.map((id) => `#${id}`).join("  ")}</p>}
              </div>
            </details>
          )}

          {!e.e.erro && e.e.lista.length > 0 && (
            <details className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60">
              <summary className="cursor-pointer list-none p-3 text-xs font-semibold text-slate-300 hover:text-white">
                Os ficheiros sem referência — só os nomes, sem abrir nenhum
              </summary>
              <ul className="max-h-60 space-y-0.5 overflow-y-auto px-3 pb-3 font-mono text-[11px] text-slate-500">
                {e.e.lista.map((nome) => (
                  <li key={nome} className="break-all">
                    {nome}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void contar()}
          disabled={aContar}
          className="flex min-h-[36px] items-center gap-2 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
        >
          {aContar && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Contar as regras novas outra vez
        </button>

        {eAdministrador && !ligadas && !confirmar && (
          <button
            type="button"
            onClick={() => setConfirmar(true)}
            className="flex min-h-[36px] items-center gap-2 rounded-lg border border-red-500/50 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500/10"
          >
            <Power className="h-3.5 w-3.5" aria-hidden="true" />
            Ligar as regras novas…
          </button>
        )}
        {eAdministrador && ligadas && (
          <button
            type="button"
            onClick={() => void mudar(false)}
            disabled={aMudar}
            className="flex min-h-[36px] items-center gap-2 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
          >
            Voltar ao ensaio
          </button>
        )}
      </div>

      {/*
        LIGAR PEDE A PALAVRA ESCRITA. Anonimizar e apagar não têm volta, e o
        botão vive num ecrã que se abre para ver números. Um clique perdido não
        pode ser o que muda as regras.
      */}
      {eAdministrador && !ligadas && confirmar && (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/[0.06] p-3">
          <p className="text-xs leading-relaxed text-slate-200">
            A partir da próxima noite (04:30) a purga passa a anonimizar, apagar e limpar o que está
            contado acima — sem volta, e não há cópia automática da base. Fica escrito no registo
            quem ligou e quando. Para continuar, escreva <strong>LIGAR</strong>.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={palavra}
              onChange={(ev) => setPalavra(ev.target.value)}
              aria-label="Escreva LIGAR para confirmar"
              className="min-h-[36px] w-32 rounded-lg border border-slate-600 bg-slate-950 px-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => void mudar(true)}
              disabled={aMudar || palavra.trim().toUpperCase() !== "LIGAR"}
              className="flex min-h-[36px] items-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
            >
              {aMudar && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Ligar
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmar(false);
                setPalavra("");
              }}
              className="min-h-[36px] rounded-lg px-3 text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
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
 * O QUE ELE ERA: com as regras de hoje, o pedido, as negociações e as
 * fotografias que tinha; com as regras novas (d32), só o primeiro nome, a
 * localidade, o estado, as datas e os valores.
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
          O que cada pedido era antes de a purga passar: o pedido e as negociações. Guardado na base
          e não num endereço público. Com as regras novas ligadas, cada cópia nasce só com o primeiro
          nome, a localidade, o estado e os valores.
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
