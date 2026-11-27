"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PropostasSemResposta from "@/components/admin/PropostasSemResposta";
import { HORAS_SEM_VALOR, type SemValorNoInicio } from "@/lib/pedido-sem-valor";

/**
 * O QUE PRECISA DE SI — NO TOPO DA MESA desde a d139 (27-11-2026, dono).
 *
 * *«Tirar do Início a barra "Precisa de si" e o cartão "Propostas há mais de
 * 24 h sem resposta do cliente". Passam para Pedidos › Mesa (no topo). O
 * Início fica só com números e dados da empresa.»*
 *
 * Os chips (número + rótulo; a explicação no `title`; um zero não aparece),
 * os por enviar sem valor há mais de 4 h (d50) e as propostas há mais de 24 h
 * sem resposta do cliente (d54). É o ecrã onde se trabalham. Cada chip leva
 * ao ecrã que resolve aquilo. Os números vêm do resumo do backoffice
 * (`/api/admin/resumo`), o mesmo de sempre.
 */

export type SeccaoDoPrecisaDeSi =
  | "pedidos"
  | "negociacoes_clyon"
  | "agenda"
  | "levantamentos"
  | "profissionais";

type Resumo = {
  porEnviar: number | null;
  esperamResposta: number | null;
  atrasados: number | null;
  semData: number | null;
  levantamentosPorPagar: number | null;
  levantamentosEmEuros: number | null;
  candidaturas: number | null;
  profissionaisPorAprovar: number | null;
  /** Por enviar há 4 h ou mais sem valor nem pergunta (d50), pelo n.º do pedido. */
  semValor?: SemValorNoInicio[] | null;
  /** Pedidos desde segunda-feira com o custo real fora da grelha (d61, modo sombra). */
  foraDaGrelhaSemana?: number | null;
  /** Aceites pelo cliente e ainda só com a zona (d69). */
  aceitesSemRua?: number | null;
};

/** Um chip do «precisa de si»: o número, o rótulo curto, o porquê (no `title`) e onde se resolve. */
type Cartao = {
  chave: string;
  n: number | null;
  titulo: string;
  porque: string;
  seccao: SeccaoDoPrecisaDeSi;
  /** Urgente pinta-se de âmbar; o resto fica sóbrio. */
  urgente?: boolean;
};

function euros(v: number): string {
  return v.toFixed(2).replace(".", ",") + " €";
}

export default function PrecisaDeSiNaMesa({ onAbrir }: { onAbrir: (s: SeccaoDoPrecisaDeSi) => void }) {
  const { token, ready } = useAdminAuth();
  const [r, setR] = useState<Resumo | null>(null);

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/resumo", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      setR(await res.json());
    } catch {
      /* fica o que havia */
    }
  }, [token]);

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);
  useAutoRefresh(() => carregar(), { enabled: ready && Boolean(token) });

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
          porque: "O custo real do trabalho ficou acima do tecto ou abaixo do chão da grelha, desde segunda-feira. Veja os degraus no cartão do pedido.",
          seccao: "negociacoes_clyon",
        },
      ]
    : [];

  // Um zero não ocupa uma caixa: chips a zero não são informação, são ruído com ar de trabalho.
  const cartoes = todos.filter((c) => c.n != null && c.n > 0);

  return (
    <div className="space-y-3">
      {/* PRECISA DE SI — chips pequenos, cada um leva ao ecrã que resolve aquilo. */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-1 text-sm font-bold text-white">
            {cartoes.length > 0 ? "Precisa de si" : "Nada à espera de si"}
          </h2>
          {!r ? (
            <p className="text-xs text-slate-400">A ver o que precisa de si…</p>
          ) : cartoes.length === 0 ? (
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
            Atualizar
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
    </div>
  );
}
