"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Wallet,
  AlertTriangle,
  Smartphone,
  Landmark,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * Quem tem dinheiro a receber, e por onde lho mandar.
 *
 * "Todos esses pedidos já foram concluídos e recebemos os pagamentos, mas não
 * tenho acesso aos dados dos pros para efectuar o pagamento deles manual."
 *
 * O ecrã dos Levantamentos mostra quem PEDIU para receber, e estava vazio — a
 * dizer "nada por transferir" com 570 € por transferir. Para pedir é preciso ter
 * IBAN gravado, e dois dos três profissionais com trabalho por pagar não o têm:
 * a fila estava vazia porque ninguém conseguia entrar nela.
 *
 * Este ecrã faz a pergunta ao contrário — não quem pediu, mas quem TEM A
 * RECEBER — que é a única que interessa enquanto o pagamento for feito à mão.
 */

type Trabalho = {
  negociacaoId: number;
  pedidoId: number;
  servico: string | null;
  cidade: string | null;
  valorAcordado: number;
  recebe: number;
  confirmadoEm: string | null;
  aguardaConfirmacao: boolean;
};

type Ficha = {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  nif: string | null;
  activo: boolean;
  iban: string | null;
  ibanTitular: string | null;
  mbway: string | null;
  moradaFiscal: string | null;
  codigoPostalFiscal: string | null;
  localidadeFiscal: string | null;
  regimeIva: string | null;
  emiteFatura: boolean;
  porPagar: Trabalho[];
  porFinalizar: Trabalho[];
  jaPago: number;
  totalPorPagar: number;
  totalPorFinalizar: number;
};

const euros = (v: number) => v.toFixed(2).replace(".", ",") + " €";

const SERVICO: Record<string, string> = {
  recolha_moveis: "Recolha de móveis",
  recolha_monos: "Recolha de monos",
  recolha_entulho: "Recolha de entulho",
  esvaziamento_casa: "Esvaziamento de casa",
  esvaziamento_apartamento: "Esvaziamento de apartamento",
  mudanca: "Mudança",
  montagem_moveis: "Montagem de móveis",
};

/** Copiar sem transcrever: um IBAN à mão são 25 caracteres para enganar. */
function Copiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [feito, setFeito] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(valor);
          setFeito(true);
          setTimeout(() => setFeito(false), 2000);
        } catch {
          /* sem área de transferência: fica o texto à vista para copiar */
        }
      }}
      title={`Copiar ${rotulo}`}
      className="flex shrink-0 items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-800"
    >
      {feito ? (
        <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
      ) : (
        <Copy className="h-3 w-3" aria-hidden="true" />
      )}
      {feito ? "Copiado" : "Copiar"}
    </button>
  );
}

export default function AdminCarteirasPanel() {
  const { token } = useAdminAuth();
  const [carteiras, setCarteiras] = useState<Ficha[]>([]);
  const [total, setTotal] = useState(0);
  const [porFinalizar, setPorFinalizar] = useState(0);
  const [jaPago, setJaPago] = useState(0);
  const [clyon, setClyon] = useState({ porFinalizar: 0, ganha: 0, fechada: 0, faturado: 0 });
  const [semComoPagar, setSemComoPagar] = useState(0);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!token) return;
      if (!silencioso) setACarregar(true);
      try {
        const res = await fetch("/api/admin/carteiras", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dados = await res.json();
        if (!res.ok) {
          setErro(dados.error ?? "Não foi possível ler as carteiras.");
          return;
        }
        setCarteiras(dados.carteiras ?? []);
        setTotal(dados.total ?? 0);
        setPorFinalizar(dados.totalPorFinalizar ?? 0);
        setJaPago(dados.totalJaPago ?? 0);
        setClyon(dados.clyon ?? { porFinalizar: 0, ganha: 0, fechada: 0, faturado: 0 });
        setSemComoPagar(dados.semComoPagar ?? 0);
        setErro("");
      } catch {
        setErro("Erro de rede.");
      } finally {
        setACarregar(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function marcarPago(t: Trabalho, nome: string) {
    if (!token) return;
    if (
      !window.confirm(
        `Marcar como pago a ${nome}?\n\n` +
          `${euros(t.recebe)} pelo pedido #${t.pedidoId}.\n\n` +
          `Faça a transferência PRIMEIRO no banco. Isto só regista que ela saiu — ` +
          `depois disto, o painel dele deixa de mostrar este valor como disponível.`,
      )
    )
      return;

    setOcupado(t.negociacaoId);
    setErro("");
    try {
      const res = await fetch("/api/admin/carteiras", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ negociacaoId: t.negociacaoId }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível marcar como pago.");
        return;
      }
      await carregar(true);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  const comSaldo = carteiras.filter((c) => c.totalPorPagar > 0);
  /* Quem tem trabalho a decorrer não é «sem nada»: tem dinheiro a caminho. */
  const aDecorrer = carteiras.filter((c) => c.totalPorPagar === 0 && c.totalPorFinalizar > 0);
  const parados = carteiras.filter((c) => c.totalPorPagar === 0 && c.totalPorFinalizar === 0);

  return (
    <section className="rounded-[28px] border border-slate-700/60 bg-slate-900/80 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Plataforma
          </p>
          <h2 className="mt-1 font-[Poppins] text-2xl font-bold text-white">Carteiras</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Quem tem dinheiro a receber, e por onde lho mandar. Faça a transferência no banco
            e marque como pago aqui — enquanto não houver ligação directa, é isto que fecha
            o dinheiro no painel dele.
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

      {/* O número que interessa, em cima. */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {/*
          TRÊS MONTES, e cada trabalho está exactamente num deles.

          "A carteira deve mostrar os valores já pagos, por pagar, e por
          finalizar — seriam os trabalhos acordados mas ainda não realizados."

          O do meio é o que exige acção hoje, e por isso é o que tem cor. O da
          esquerda diz o que aí vem — é o que decide se vale a pena esperar
          pela próxima transferência ou fazer já esta. O da direita é a conta
          feita, e serve para conferir.
        */}
        <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Por finalizar
          </p>
          <p className="font-[Poppins] text-2xl font-bold text-slate-300">
            {euros(porFinalizar)}
          </p>
          <p className="text-xs text-slate-500">acordado, ainda por fazer</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
            Por transferir
          </p>
          <p className="font-[Poppins] text-2xl font-bold text-white">{euros(total)}</p>
          <p className="text-xs text-emerald-300/70">
            {comSaldo.length} {comSaldo.length === 1 ? "profissional" : "profissionais"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Já pagos
          </p>
          <p className="font-[Poppins] text-2xl font-bold text-slate-300">{euros(jaPago)}</p>
          <p className="text-xs text-slate-500">desde o início</p>
        </div>

        {/*
          O aviso que explica o ecrã vazio dos Levantamentos: sem IBAN nem MB
          WAY, o profissional não consegue sequer PEDIR para receber. O dinheiro
          fica parado e ninguém vê porquê.
        */}
        {semComoPagar > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-amber-200">
                {semComoPagar} {semComoPagar === 1 ? "não tem" : "não têm"} para onde receber
              </p>
              <p className="text-xs text-amber-300/80">
                Sem IBAN nem MB WAY. Peça-lhos antes de transferir seja o que for.
              </p>
            </div>
          </div>
        )}
      </div>

      {/*
        A CONTA DA CASA.

        "Coloque também os ganhos da CLYON."

        A comissão vem das duas pontas — 6% que o cliente paga a mais e 5% que
        se desconta ao profissional — e por isso não se lê nem do que entra nem
        do que sai. É a diferença entre os dois, e não estava em lado nenhum.

        Segue os mesmos três estados do dinheiro deles, de propósito: uma
        comissão de um trabalho por fazer ainda não é ganho, é uma promessa.
        Só o número da direita está fechado dos dois lados.
      */}
      <div className="mt-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
            A comissão da CLYON
          </p>
          <p className="text-xs text-slate-400">
            {euros(clyon.faturado)} facturados aos clientes até hoje
          </p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] text-slate-500">A caminho</p>
            <p className="font-[Poppins] text-lg font-bold text-slate-300">
              {euros(clyon.porFinalizar)}
            </p>
            <p className="text-[11px] text-slate-600">de trabalho por fazer</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Ganha, por liquidar</p>
            <p className="font-[Poppins] text-lg font-bold text-slate-300">
              {euros(clyon.ganha)}
            </p>
            <p className="text-[11px] text-slate-600">falta transferir a parte dele</p>
          </div>
          <div>
            <p className="text-[11px] text-cyan-300">Fechada</p>
            <p className="font-[Poppins] text-xl font-bold text-white">{euros(clyon.fechada)}</p>
            <p className="text-[11px] text-cyan-300/70">trabalho feito e pago</p>
          </div>
        </div>
      </div>

      {erro && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {erro}
        </p>
      )}

      {aCarregar ? (
        <p className="mt-6 text-sm text-slate-500">A ler…</p>
      ) : carteiras.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-8 text-center text-sm text-slate-500">
          Ainda não há profissionais com trabalho fechado.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {[...comSaldo, ...aDecorrer, ...parados].map((c) => (
            <article
              key={c.id}
              className={`rounded-2xl border bg-slate-900 p-4 ${
                c.totalPorPagar > 0
                  ? "border-slate-700"
                  : c.totalPorFinalizar > 0
                    ? "border-slate-800"
                    : "border-slate-800 opacity-60"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-base font-bold text-white">
                    <Wallet className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    {c.nome}
                    {!c.activo && (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                        inactivo
                      </span>
                    )}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.nif ? `NIF ${c.nif}` : "sem NIF"}
                    {" · "}
                    {c.emiteFatura ? `passa fatura (${c.regimeIva ?? "regime por indicar"})` : "não passa fatura"}
                    {c.telefone ? ` · ${c.telefone}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-[Poppins] text-xl font-bold text-white">
                    {euros(c.totalPorPagar)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    por transferir
                    {c.totalPorFinalizar > 0
                      ? ` · ${euros(c.totalPorFinalizar)} por finalizar`
                      : ""}
                    {c.jaPago > 0 ? ` · ${euros(c.jaPago)} já pagos` : ""}
                  </p>
                </div>
              </div>

              {/* ── Por onde lhe pagar ──────────────────────────────────── */}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <Landmark className="h-3.5 w-3.5" aria-hidden="true" />
                    Transferência
                  </p>
                  {c.iban ? (
                    <>
                      <div className="mt-1.5 flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate font-mono text-sm text-slate-100">
                          {c.iban}
                        </code>
                        <Copiar valor={c.iban} rotulo="o IBAN" />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {c.ibanTitular ? (
                          <>
                            Titular: <span className="text-slate-300">{c.ibanTitular}</span>
                          </>
                        ) : (
                          /* Um nome que não bate com o IBAN é transferência devolvida. */
                          <span className="text-amber-400">Sem titular indicado.</span>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1.5 text-sm text-amber-400">Sem IBAN.</p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                    MB WAY
                  </p>
                  {c.mbway ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="min-w-0 flex-1 font-mono text-sm text-slate-100">
                        {c.mbway}
                      </code>
                      <Copiar valor={c.mbway} rotulo="o MB WAY" />
                    </div>
                  ) : (
                    <p className="mt-1.5 text-sm text-slate-500">Sem MB WAY.</p>
                  )}
                </div>
              </div>

              {/* A morada fiscal é para o documento, não para o pagamento —
                  por isso vem depois, e mais discreta. */}
              <p className="mt-2 text-xs text-slate-500">
                {c.moradaFiscal ? (
                  <>
                    Morada fiscal:{" "}
                    <span className="text-slate-400">
                      {[c.moradaFiscal, c.codigoPostalFiscal, c.localidadeFiscal]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </>
                ) : (
                  <span className="text-amber-500/80">Morada fiscal por indicar.</span>
                )}
              </p>

              {/* ── Os trabalhos por pagar, um a um ─────────────────────── */}
              {c.porPagar.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-slate-800 pt-3">
                  {c.porPagar.map((t) => (
                    <div
                      key={t.negociacaoId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200">
                          #{t.pedidoId} · {SERVICO[t.servico ?? ""] ?? t.servico ?? "Trabalho"}
                          {t.cidade ? ` · ${t.cidade}` : ""}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Acordado {euros(t.valorAcordado)} · ele recebe {euros(t.recebe)}
                        </p>
                      </div>
                      <button
                        onClick={() => marcarPago(t, c.nome)}
                        disabled={ocupado === t.negociacaoId}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {ocupado === t.negociacaoId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        Já paguei
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/*
                O QUE ESTÁ A DECORRER — sem botão de pagar.

                Não é dinheiro dele ainda: está cativo do lado do cliente e só
                se solta quando o trabalho for confirmado. Um botão aqui seria
                um convite a pagar por trabalho que ainda não foi feito.
              */}
              {c.porFinalizar.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-slate-800 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    A decorrer
                  </p>
                  {c.porFinalizar.map((t) => (
                    <div
                      key={t.negociacaoId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-400">
                          #{t.pedidoId} · {SERVICO[t.servico ?? ""] ?? t.servico ?? "Trabalho"}
                          {t.cidade ? ` · ${t.cidade}` : ""}
                        </p>
                        <p className="text-[11px] text-slate-600">
                          Acordado {euros(t.valorAcordado)} · ele recebe {euros(t.recebe)}
                        </p>
                      </div>
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          t.aguardaConfirmacao
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {t.aguardaConfirmacao ? "falta confirmar" : "por fazer"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
