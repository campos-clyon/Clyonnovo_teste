"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Inbox,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  UserCheck,
  Wallet,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * O INÍCIO — o que precisa de si, hoje.
 *
 * "Essa tela de início já não condiz com as novas ferramentas, está
 * desactualizada. Vamos colocá-la no modo actual, com informações precisas
 * como num painel bem planeado." — 12-09-2026.
 *
 * O que lá estava contava os pedidos do simulador por estados que já não se
 * usam — seis caixas a zero, e um «A carregar…» que nunca acabava — mais os
 * leads do site com quatro travessões. Nada sobre a plataforma que entretanto
 * nasceu: negociações, agenda, o assistente do WhatsApp, carteiras,
 * levantamentos, candidaturas.
 *
 * A REGRA DESTE ECRÃ: só entra aqui o que alguém tem de FAZER.
 *
 * Um painel bem planeado não é um painel com muitos números. É um que, se
 * estiver todo a zero, diz que não há nada à espera — e que, quando não está,
 * diz onde carregar. Por isso cada cartão é um link para o ecrã que resolve
 * aquilo, e um zero desaparece em vez de ocupar uma caixa.
 *
 * O que NÃO está aqui, de propósito: totais de negócio, gráficos, «leads
 * desta semana». Isso é para olhar uma vez por mês, e este ecrã é o primeiro
 * que se abre de manhã.
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
};

type Seccao =
  | "pedidos"
  | "negociacoes_clyon"
  | "agenda"
  | "levantamentos"
  | "profissionais"
  | "whatsapp";

/** Um cartão do «precisa de si»: o número, o que é, e onde se resolve. */
type Cartao = {
  chave: string;
  n: number | null;
  titulo: string;
  porque: string;
  seccao: Seccao;
  icone: typeof Inbox;
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

  const carregar = useCallback(async () => {
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
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    void carregar();
    // O painel fica aberto o dia todo numa secretária. De dois em dois
    // minutos chega — não é um monitor de sala de controlo.
    const t = setInterval(() => void carregar(), 120_000);
    return () => clearInterval(t);
  }, [ready, carregar]);

  if (aCarregar && !r) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        A ver o que precisa de si…
      </div>
    );
  }

  const cartoes: Cartao[] = r
    ? [
        {
          chave: "atrasados",
          n: r.atrasados,
          titulo: "atrasados",
          porque: "O dia passou e ninguém deu o trabalho por feito. Ligue ao profissional.",
          seccao: "agenda",
          icone: AlertTriangle,
          urgente: true,
        },
        {
          chave: "esperam",
          n: r.esperamResposta,
          titulo: "à espera de si",
          porque: "Propostas em que a CLYON responde pelo cliente. Uma expira em 48 horas.",
          seccao: "negociacoes_clyon",
          icone: MessageCircle,
          urgente: true,
        },
        {
          chave: "porEnviar",
          n: r.porEnviar,
          titulo: "por enviar",
          porque: "Pedidos na mesa que ainda não foram a profissional nenhum.",
          seccao: "pedidos",
          icone: Send,
        },
        {
          chave: "semData",
          n: r.semData,
          titulo: "sem dia marcado",
          porque: "Contratados e sem data. Combine com o cliente.",
          seccao: "agenda",
          icone: CalendarClock,
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
          icone: Wallet,
          urgente: true,
        },
        {
          chave: "candidaturas",
          n: r.candidaturas,
          titulo: "candidaturas",
          porque: "Vieram do formulário do site e ainda não têm conta.",
          seccao: "profissionais",
          icone: Inbox,
        },
        {
          chave: "porAprovar",
          n: r.profissionaisPorAprovar,
          titulo: "por aprovar",
          porque: "Profissionais com conta aberta que ainda não recebem pedidos.",
          seccao: "profissionais",
          icone: UserCheck,
        },
        {
          chave: "entregues",
          n: r.conversasEntregues,
          titulo: "conversas suas",
          porque: "O assistente está calado nestas — é você a responder.",
          seccao: "whatsapp",
          icone: MessageCircle,
        },
      ].filter((c) => c.n != null && c.n > 0)
    : [];

  return (
    <div className="space-y-4">
      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {erro}
        </p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-white">
            {cartoes.length > 0 ? "Precisa de si" : "Nada à espera de si"}
          </h2>
          <button
            onClick={() => void carregar()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Actualizar
          </button>
        </div>

        {/*
          O ECRÃ VAZIO É UMA RESPOSTA, e não um erro.

          Um painel que não tem nada a dizer deve dizer isso com todas as
          letras. Oito caixas a zero não são informação — são ruído com ar de
          trabalho.
        */}
        {cartoes.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Está tudo tratado. Nenhum pedido por enviar, nenhuma proposta à espera de resposta,
            nenhum trabalho atrasado.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {cartoes.map((c) => {
              const Icone = c.icone;
              return (
                <li key={c.chave}>
                  <button
                    onClick={() => onAbrir(c.seccao)}
                    className={`group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                      c.urgente
                        ? "border-amber-500/30 bg-amber-500/[0.06] hover:bg-amber-500/10"
                        : "border-slate-700 bg-slate-950/40 hover:bg-slate-800/60"
                    }`}
                  >
                    <Icone
                      className={`mt-0.5 h-4 w-4 shrink-0 ${c.urgente ? "text-amber-400" : "text-slate-400"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span
                          className={`text-xl font-bold ${c.urgente ? "text-amber-300" : "text-white"}`}
                        >
                          {c.n}
                        </span>
                        <span className="text-sm font-semibold text-slate-200">{c.titulo}</span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                        {c.porque}
                      </span>
                    </span>
                    <ArrowRight
                      className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover:text-slate-300"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/*
        O ESTADO DAS COISAS — o que não pede nada, mas convém saber.

        Separado de propósito do «precisa de si»: são números que se lêem de
        passagem, não tarefas. O WhatsApp desligado é a excepção — esse pede.
      */}
      {r && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-sm font-bold text-white">O estado das coisas</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button
              onClick={() => onAbrir("whatsapp")}
              className={`rounded-xl border p-3 text-left transition ${
                r.whatsappLigado === false
                  ? "border-red-500/30 bg-red-500/[0.07] hover:bg-red-500/10"
                  : "border-slate-700 bg-slate-950/40 hover:bg-slate-800/60"
              }`}
            >
              <p className="text-xs text-slate-400">Assistente do WhatsApp</p>
              <p
                className={`mt-0.5 text-sm font-bold ${
                  r.whatsappLigado === false
                    ? "text-red-300"
                    : r.whatsappLigado
                      ? "text-emerald-300"
                      : "text-slate-400"
                }`}
              >
                {r.whatsappLigado === false
                  ? "DESLIGADO — ninguém recebe nada"
                  : r.whatsappLigado
                    ? "Ligado"
                    : "—"}
              </p>
              {r.filaDoWhatsApp != null && r.filaDoWhatsApp > 0 && (
                <p className="mt-0.5 text-xs text-slate-500">
                  {r.filaDoWhatsApp} mensagem{r.filaDoWhatsApp === 1 ? "" : "s"} por sair
                </p>
              )}
            </button>

            <button
              onClick={() => onAbrir("agenda")}
              className="rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-left transition hover:bg-slate-800/60"
            >
              <p className="text-xs text-slate-400">Trabalhos a decorrer</p>
              <p className="mt-0.5 text-sm font-bold text-white">{r.aDecorrer ?? "—"}</p>
              <p className="mt-0.5 text-xs text-slate-500">Contratados e ainda por confirmar.</p>
            </button>

            <button
              onClick={() => onAbrir("levantamentos")}
              className="rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-left transition hover:bg-slate-800/60"
            >
              <p className="text-xs text-slate-400">Por transferir</p>
              <p className="mt-0.5 text-sm font-bold text-white">
                {r.levantamentosEmEuros != null ? euros(r.levantamentosEmEuros) : "—"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                O que a CLYON deve a profissionais que já pediram.
              </p>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
