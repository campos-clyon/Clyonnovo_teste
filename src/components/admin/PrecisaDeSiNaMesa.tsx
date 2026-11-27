"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PropostasSemResposta from "@/components/admin/PropostasSemResposta";
import { HORAS_SEM_VALOR, type SemValorNoInicio } from "@/lib/pedido-sem-valor";
import {
  BOTAO_ABERTO,
  BOTAO_DA_LINHA,
  BOTAO_NEUTRO,
  BOTAO_URGENTE,
  BOTAO_VERMELHO,
  PAINEL_DA_LINHA,
} from "@/components/admin/linhaDaMesa";

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
 *
 * d142 (27-11-2026, dono): já não é uma barra nem cartões — são botões pequenos
 * na linha discreta da Mesa (`linhaDaMesa.ts`), depois do filtro; a mesa de
 * trabalho fica em primeiro. Nada se perdeu: os mesmos chips, contadores e
 * selos, e as listas abrem por baixo ao carregar.
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
  const [semValorAberto, setSemValorAberto] = useState(false);

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
  const semValor = r?.semValor ?? [];

  /*
   * d142 (27-11-2026, dono): um FRAGMENTO para a linha discreta do topo da
   * Mesa (`linhaDaMesa.ts`). Os chips continuam a levar ao ecrã que resolve
   * aquilo; os sem valor e as propostas abrem por baixo da linha.
   */
  return (
    <>
      {!r ? (
        <span className="text-[11px] text-slate-400">A ver o que precisa de si…</span>
      ) : cartoes.length === 0 ? (
        <span
          className="flex items-center gap-1 text-[11px] text-emerald-300"
          title="Está tudo tratado. Nenhum pedido por enviar, nenhuma proposta à espera de resposta, nenhum trabalho atrasado."
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Nada à espera de si
        </span>
      ) : (
        <ul aria-label="Precisa de si" className="contents">
          {cartoes.map((c) => (
            <li key={c.chave} className="contents">
              <button
                type="button"
                onClick={() => onAbrir(c.seccao)}
                title={c.porque}
                className={`${BOTAO_DA_LINHA} ${c.urgente ? BOTAO_URGENTE : BOTAO_NEUTRO}`}
              >
                {c.urgente && <span aria-hidden="true">⚠</span>}
                <span className={`font-bold tabular-nums ${c.urgente ? "text-amber-300" : "text-white"}`}>{c.n}</span>
                {c.titulo}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/*
        SEM VALOR HÁ MAIS DE 4 H — d50, 16-11-2026. Os por enviar a vermelho
        (sem valor nem pergunta ao cliente), pelo n.º do pedido, com o serviço
        e a hora de entrada em Lisboa. A regra é a do selo da Mesa
        (`pedido-sem-valor.ts`). Desde a d142, um botão que abre a lista.
      */}
      {semValor.length > 0 && (
        <button
          type="button"
          onClick={() => setSemValorAberto((a) => !a)}
          aria-expanded={semValorAberto}
          title="Por enviar, sem valor nem pergunta ao cliente. Carregue para ver a lista."
          className={`${BOTAO_DA_LINHA} ${semValorAberto ? BOTAO_ABERTO : BOTAO_VERMELHO}`}
        >
          <span className="font-bold tabular-nums">{semValor.length}</span>
          sem valor &gt;{HORAS_SEM_VALOR} h
        </button>
      )}
      {semValor.length > 0 && semValorAberto && (
        <section className={PAINEL_DA_LINHA}>
          <h2 className="text-sm font-bold text-white" title="Por enviar, sem valor nem pergunta ao cliente. Do maior n.º para o menor.">
            <span className="text-red-300">{semValor.length}</span> sem valor há mais de {HORAS_SEM_VALOR} h
          </h2>
          <ul className="mt-1 grid gap-x-4 divide-y divide-slate-800 md:grid-cols-2 md:divide-y-0 xl:grid-cols-3">
            {semValor.map((p) => (
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

      {/* PROPOSTAS SEM RESPOSTA DO CLIENTE — d54, 16-11-2026; um botão na linha desde a d142. */}
      <PropostasSemResposta token={token} onAbrir={() => onAbrir("negociacoes_clyon")} />

      <button
        type="button"
        onClick={() => void carregar()}
        title="Atualizar o que precisa de si"
        aria-label="Atualizar"
        className="flex items-center rounded-md border border-slate-700 px-1.5 py-1 text-slate-400 transition hover:bg-slate-800"
      >
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
      </button>
    </>
  );
}
