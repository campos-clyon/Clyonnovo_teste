"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import dynamic from "next/dynamic";
import PropostasSemResposta from "@/components/admin/PropostasSemResposta";
import DinheiroDoInicio from "@/components/admin/DinheiroDoInicio";
import { HORAS_SEM_VALOR, type SemValorNoInicio } from "@/lib/pedido-sem-valor";
import type { OperacaoDoInicio } from "@/lib/desempenho";

/*
 * O DESEMPENHO — d41, 15-11-2026: pedidos que entram, trabalhos feitos,
 * conversão e gráficos, por baixo do «precisa de si». Carregado à parte (os
 * gráficos pesam) para o resumo do dia aparecer primeiro.
 */
const DesempenhoDoInicio = dynamic(() => import("@/components/admin/DesempenhoDoInicio"), { ssr: false });
// O simulador passo a passo (d56, 16-11-2026).
const FunilDoSimulador = dynamic(() => import("@/components/admin/FunilDoSimulador"), { ssr: false });
const FalhasDaIa = dynamic(() => import("@/components/admin/FalhasDaIa"), { ssr: false });

/**
 * O INÍCIO — o que precisa de si, hoje.
 *
 * "Essa tela de início já não condiz com as novas ferramentas, está
 * desactualizada. Vamos colocá-la no modo actual, com informações precisas
 * como num painel bem planeado." — 12-09-2026.
 *
 * COMPACTO, POR HIERARQUIA — d56, 17-11-2026. Quatro andares, por esta ordem:
 *   1. Precisa de si — os alertas de hoje numa faixa de chips pequenos
 *      (número + rótulo; a explicação no `title`). Um zero não aparece.
 *   2. Dinheiro — o lucro de hoje, da semana, do mês e do ano, pela conta das
 *      Finanças (`DinheiroDoInicio`), o que os profissionais devem e o que
 *      está por transferir.
 *   3. Operação — linhas curtas: pedidos entrados, a decorrer, feitos por
 *      confirmar, cancelados no mês, e o assistente do WhatsApp num ponto
 *      (só em destaque quando desligado).
 *   4. Desempenho — os pedidos que entram e os trabalhos realizados lado a
 *      lado numa tabela.
 *
 * As «conversas suas» (entregues à equipa) vivem na secção do WhatsApp, por
 * cima da lista: é lá que se trabalham.
 */

type Resumo = {
  porEnviar: number | null;
  esperamResposta: number | null;
  atrasados: number | null;
  semData: number | null;
  levantamentosPorPagar: number | null;
  levantamentosEmEuros: number | null;
  candidaturas: number | null;
  profissionaisPorAprovar: number | null;
  conversasEntregues: number | null;
  filaDoWhatsApp: number | null;
  whatsappLigado: boolean | null;
  aDecorrer: number | null;
  /** Por enviar há 4 h ou mais sem valor nem pergunta (d50), pelo n.º do pedido. */
  semValor?: SemValorNoInicio[] | null;
  /** Pedidos desde segunda-feira com o custo real fora da grelha (d61, modo sombra). */
  foraDaGrelhaSemana?: number | null;
  /** Aceites pelo cliente e ainda só com a zona (d69). */
  aceitesSemRua?: number | null;
  /** O profissional deu por feito e falta confirmar (d56). */
  feitosPorConfirmar?: number | null;
  /** Os pedidos entrados hoje, na semana e no mês (d56). */
  operacao?: OperacaoDoInicio | null;
};

type Seccao =
  | "pedidos"
  | "negociacoes_clyon"
  | "agenda"
  | "levantamentos"
  | "profissionais"
  | "whatsapp"
  | "pagamentos"
  | "carteiras";

/** Um chip do «precisa de si»: o número, o rótulo curto, o porquê (no `title`) e onde se resolve. */
type Cartao = {
  chave: string;
  n: number | null;
  titulo: string;
  porque: string;
  seccao: Seccao;
  /** Urgente pinta-se de âmbar; o resto fica sóbrio. */
  urgente?: boolean;
};

function euros(v: number): string {
  return v.toFixed(2).replace(".", ",") + " €";
}

export default function AdminInicioPanel({ onAbrir }: { onAbrir: (s: Seccao) => void }) {
  const { token, ready } = useAdminAuth();
  const [r, setR] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");
  const [aCarregar, setACarregar] = useState(true);

  const carregar = useCallback(async (silencioso = false) => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/resumo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível carregar.");
        return;
      }
      setR(dados);
      setErro("");
    } catch {
      if (!silencioso) setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    void carregar();
    // O ciclo está no pulso partilhado (useAutoRefresh), não aqui — 16-09-2026.
  }, [ready, carregar]);

  /*
   * NOVIDADES SEM F5 — 16-09-2026. Silencioso de propósito: não mexe no
   * estado de carregamento, pára com o separador escondido e volta a buscar
   * assim que ele reaparece.
   */
  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token) });

  if (aCarregar && !r) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        A ver o que precisa de si…
      </div>
    );
  }

  // Anotado ANTES do filtro: sem isto o `seccao` de cada literal infere-se como `string`.
  const todos: Cartao[] = r
    ? [
        {
          chave: "atrasados",
          n: r.atrasados,
          titulo: "atrasados",
          porque: "O dia passou e ninguém deu o trabalho por feito. Ligue ao profissional.",
          seccao: "agenda",
          urgente: true,
        },
        {
          chave: "esperam",
          n: r.esperamResposta,
          titulo: "à espera de si",
          porque: "Propostas em que a CLYON responde pelo cliente, e que ficam aqui até alguém responder.",
          seccao: "negociacoes_clyon",
          urgente: true,
        },
        {
          chave: "levantamentos",
          n: r.levantamentosPorPagar,
          titulo: "por transferir",
          porque:
            r.levantamentosEmEuros != null && r.levantamentosEmEuros > 0
              ? `${euros(r.levantamentosEmEuros)} pedidos por profissionais que já fizeram o trabalho.`
              : "Transferências pedidas por profissionais que já fizeram o trabalho.",
          seccao: "levantamentos",
          urgente: true,
        },
        {
          chave: "porEnviar",
          n: r.porEnviar,
          titulo: "por enviar",
          porque: "Pedidos na mesa que ainda não foram a profissional nenhum.",
          seccao: "pedidos",
        },
        {
          chave: "semData",
          n: r.semData,
          titulo: "sem dia marcado",
          porque: "Contratados e sem data. Combine com o cliente.",
          seccao: "agenda",
        },
        {
          chave: "aceitesSemRua",
          n: r.aceitesSemRua ?? null,
          titulo: "aceites sem rua",
          porque: "O cliente aceitou e o pedido só tem a zona. A Vitória pede-lhe a rua pelo WhatsApp; sem resposta em 2 h, é connosco. Veja «Falta a rua» no cartão, na Mesa.",
          seccao: "negociacoes_clyon",
        },
        {
          chave: "candidaturas",
          n: r.candidaturas,
          titulo: "candidaturas",
          porque: "Vieram do formulário do site e ainda não têm conta.",
          seccao: "profissionais",
        },
        {
          chave: "porAprovar",
          n: r.profissionaisPorAprovar,
          titulo: "por aprovar",
          porque: "Profissionais com conta aberta que ainda não recebem pedidos.",
          seccao: "profissionais",
        },
        {
          chave: "foraDaGrelha",
          n: r.foraDaGrelhaSemana ?? null,
          titulo: "fora da grelha (semana)",
          porque: "O custo real do trabalho ficou acima do tecto ou abaixo do chão da grelha, desde segunda-feira. Veja os degraus no cartão do pedido, na Mesa.",
          seccao: "negociacoes_clyon",
        },
      ]
    : [];

  // Um zero não ocupa uma caixa: chips a zero não são informação, são ruído com ar de trabalho.
  const cartoes = todos.filter((c) => c.n != null && c.n > 0);
  const op = r?.operacao ?? null;

  return (
    <div className="space-y-3">
      {erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{erro}</p>
      )}

      {/* 1. PRECISA DE SI — chips pequenos, cada um leva ao ecrã que resolve aquilo. */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-1 text-sm font-bold text-white">
            {cartoes.length > 0 ? "Precisa de si" : "Nada à espera de si"}
          </h2>
          {cartoes.length === 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Está tudo tratado. Nenhum pedido por enviar, nenhuma proposta à espera de resposta, nenhum trabalho atrasado.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {cartoes.map((c) => (
                <li key={c.chave}>
                  <button
                    onClick={() => onAbrir(c.seccao)}
                    title={c.porque}
                    className={`flex items-baseline gap-1 rounded-md border px-2 py-1 text-xs transition ${
                      c.urgente
                        ? "border-amber-500/40 bg-amber-500/[0.08] text-amber-200 hover:bg-amber-500/15"
                        : "border-slate-700 bg-slate-950/40 text-slate-200 hover:bg-slate-800/60"
                    }`}
                  >
                    <span className={`text-sm font-bold tabular-nums ${c.urgente ? "text-amber-300" : "text-white"}`}>
                      {c.n}
                    </span>
                    {c.titulo}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => void carregar()}
            className="ml-auto flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-400 transition hover:bg-slate-800"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Actualizar
          </button>
        </div>
      </section>

      {/*
        SEM VALOR HÁ MAIS DE 4 H — d50, 16-11-2026. Os por enviar a vermelho
        (sem valor nem pergunta ao cliente), pelo n.º do pedido, com o serviço
        e a hora de entrada em Lisboa. A regra é a do selo da Mesa
        (`pedido-sem-valor.ts`).
      */}
      {r?.semValor && r.semValor.length > 0 && (
        <section className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3">
          <h2 className="text-sm font-bold text-white" title="Por enviar, sem valor nem pergunta ao cliente. Do maior n.º para o menor.">
            <span className="text-red-300">{r.semValor.length}</span> sem valor há mais de {HORAS_SEM_VALOR} h
          </h2>
          <ul className="mt-1 grid gap-x-4 divide-y divide-slate-800 md:grid-cols-2 md:divide-y-0 xl:grid-cols-3">
            {r.semValor.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onAbrir("pedidos")}
                  className="flex w-full flex-wrap items-baseline gap-x-2 py-1 text-left text-xs hover:bg-slate-800/40"
                >
                  <span className="text-sm font-bold text-white">#{p.id}</span>
                  <span className="rounded border border-red-500/50 bg-red-500/15 px-1.5 text-[11px] font-semibold text-red-300">
                    por enviar · {p.servico}
                  </span>
                  <span className="ml-auto tabular-nums text-slate-400">
                    entrou {p.entrouEm} · há {p.horas} h
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* PROPOSTAS SEM RESPOSTA DO CLIENTE — d54, 16-11-2026. */}
      <PropostasSemResposta token={token} onAbrir={() => onAbrir("negociacoes_clyon")} />

      {/* 2. DINHEIRO — d56. */}
      <DinheiroDoInicio aPagar={r?.levantamentosEmEuros ?? null} onAbrir={(s) => onAbrir(s)} />

      {/* 3. OPERAÇÃO — linhas curtas; o WhatsApp é um ponto, e só grita desligado. */}
      {r && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
            <h2 className="text-sm font-bold text-white">Operação</h2>
            {op && (
              <button onClick={() => onAbrir("pedidos")} className="hover:text-slate-200" title="Pedidos entrados, sem contas de teste, em dias de Lisboa (a semana começa à segunda).">
                Pedidos entrados: <b className="tabular-nums text-white">{op.entradosHoje}</b> hoje ·{" "}
                <b className="tabular-nums text-white">{op.entradosSemana}</b> semana ·{" "}
                <b className="tabular-nums text-white">{op.entradosMes}</b> mês
              </button>
            )}
            <button onClick={() => onAbrir("agenda")} className="hover:text-slate-200" title="Contratados e ainda por confirmar (inclui os feitos por confirmar).">
              A decorrer: <b className="tabular-nums text-white">{r.aDecorrer ?? "—"}</b>
            </button>
            {r.feitosPorConfirmar != null && (
              <button onClick={() => onAbrir("agenda")} className="hover:text-slate-200" title="O profissional deu o trabalho por feito e falta confirmar.">
                Feitos por confirmar: <b className="tabular-nums text-white">{r.feitosPorConfirmar}</b>
              </button>
            )}
            {op && (
              <span title="Cancelados ou arquivados dos pedidos que entraram este mês.">
                Cancelados no mês: <b className="tabular-nums text-white">{op.canceladosDoMes}</b>
              </span>
            )}
            <button
              onClick={() => onAbrir("whatsapp")}
              title={
                r.filaDoWhatsApp != null && r.filaDoWhatsApp > 0
                  ? `${r.filaDoWhatsApp} mensagem${r.filaDoWhatsApp === 1 ? "" : "s"} por sair`
                  : "Assistente do WhatsApp"
              }
              className={`flex items-center gap-1.5 ${
                r.whatsappLigado === false
                  ? "rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-bold text-red-300"
                  : "hover:text-slate-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  r.whatsappLigado === false ? "bg-red-400" : r.whatsappLigado ? "bg-emerald-400" : "bg-slate-500"
                }`}
                aria-hidden="true"
              />
              {r.whatsappLigado === false ? "WhatsApp DESLIGADO — ninguém recebe nada" : "WhatsApp"}
              {r.filaDoWhatsApp != null && r.filaDoWhatsApp > 0 && (
                <span className="tabular-nums text-slate-500">· {r.filaDoWhatsApp} por sair</span>
              )}
            </button>
          </div>
        </section>
      )}

      {/* 4. DESEMPENHO */}
      <DesempenhoDoInicio />
      <FunilDoSimulador />
      <FalhasDaIa />
    </div>
  );
}
