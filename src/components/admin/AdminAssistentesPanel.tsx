"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Percent,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import TrabalhosDoAssistente from "./TrabalhosDoAssistente";
import {
  ROTULO_DA_SECCAO,
  SECCOES_DO_ASSISTENTE,
  type SeccaoDoAssistente,
} from "@/lib/papel-do-painel";

/**
 * As contas de assistente, geridas pelo administrador.
 *
 * Um assistente entra em clyon.pt/admin/login com o nome e a palavra-passe
 * daqui e cai num painel só dele, com as secções que lhe forem dadas aqui.
 * Desde 03-10-2026 pode dar-se qualquer secção do menu menos «Assistentes»,
 * e uma conta nova nasce sem nenhuma marcada — quem cria escolhe. Não vê o
 * resto e não apaga nada.
 *
 * Cada conta mostra os trabalhos de que foi responsável — concluídos, em
 * curso, cancelados, arquivados — e a comissão: uma percentagem da parte da
 * CLYON nos trabalhos concluídos. As duas percentagens mudam-se aqui.
 *
 * Desde 08-10-2026 a comissão conta-se por PERÍODOS — 23/09 a 15/10, depois
 * quinzenas — e cada conta ganha sobre todos os trabalhos ou só sobre os
 * seus. O cartão mostra este período, o que está por pagar e o que já foi
 * pago; o detalhe (`TrabalhosDoAssistente`) lista os períodos e marca-os
 * como pagos.
 *
 * Cria-se a conta aqui e entrega-se a palavra-passe à pessoa por fora — o
 * sistema nunca a volta a mostrar, porque nunca a guarda: guarda o hash.
 * Desactivar fecha a porta no acto: a sessão dela deixa de valer na chamada
 * seguinte.
 */

type Estatisticas = {
  concluidos: number;
  emCurso: number;
  cancelados: number;
  arquivados: number;
};

type TotaisDasComissoes = {
  periodoActual: string | null;
  estePeriodo: number;
  porPagar: number;
  pago: number;
  trabalhos: number;
};

type Assistente = {
  id: number;
  nome: string;
  activo: boolean;
  seccoes: SeccaoDoAssistente[];
  comissaoPercent: number;
  comissaoSobre: "todos" | "seus";
  estatisticas: Estatisticas;
  comissoes: { totais: TotaisDasComissoes };
  createdAt: string | null;
  updatedAt: string | null;
};

const CAIXA =
  "w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";

function dataCurta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-PT");
}

function euros(v: number): string {
  return v.toFixed(2).replace(".", ",") + " €";
}

function percent(v: number): string {
  return (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",")) + " %";
}

/** As caixas de verificação das secções — usadas ao criar e ao editar. */
function EscolhaDeSeccoes({
  valor,
  onChange,
  disabled,
}: {
  valor: SeccaoDoAssistente[];
  onChange: (v: SeccaoDoAssistente[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SECCOES_DO_ASSISTENTE.map((s) => {
        const marcada = valor.includes(s);
        return (
          <label
            key={s}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              marcada
                ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-100"
                : "border-slate-600 text-slate-400 hover:bg-slate-800"
            } ${disabled ? "opacity-50" : ""}`}
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-cyan-500"
              checked={marcada}
              disabled={disabled}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? SECCOES_DO_ASSISTENTE.filter((x) => x === s || valor.includes(x))
                    : valor.filter((x) => x !== s),
                )
              }
            />
            {ROTULO_DA_SECCAO[s]}
          </label>
        );
      })}
    </div>
  );
}

export default function AdminAssistentesPanel() {
  const { token, ready } = useAdminAuth();
  const [assistentes, setAssistentes] = useState<Assistente[]>([]);
  const [comissaoClyon, setComissaoClyon] = useState<number>(11);
  const [comissaoPorOmissao, setComissaoPorOmissao] = useState<number>(40);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<number | "novo" | "clyon" | null>(null);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");

  // Formulário de criação
  const [nome, setNome] = useState("");
  const [palavraPasse, setPalavraPasse] = useState("");
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  // Desmarcadas ao criar — 03-10-2026. Com o menu inteiro na lista, vir tudo
  // marcado era dar carteiras e configurações a quem só ia tratar de pedidos.
  const [seccoesNovas, setSeccoesNovas] = useState<SeccaoDoAssistente[]>([]);
  const [comissaoNova, setComissaoNova] = useState<string>("40");

  // Edição da percentagem da CLYON
  const [clyonRascunho, setClyonRascunho] = useState<string>("");
  const [aEditarClyon, setAEditarClyon] = useState(false);

  // Qual conta está com os detalhes abertos
  const [aberto, setAberto] = useState<number | null>(null);
  const [comissaoRascunho, setComissaoRascunho] = useState<Record<number, string>>({});

  const carregar = useCallback(async (silencioso = false) => {
    if (!token) return;
    if (!silencioso) setACarregar(true);
    try {
      const res = await fetch("/api/admin/assistentes", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setAssistentes(dados.assistentes ?? []);
      if (typeof dados.comissaoClyonPercent === "number") {
        setComissaoClyon(dados.comissaoClyonPercent);
        setClyonRascunho(String(dados.comissaoClyonPercent));
      }
      if (typeof dados.comissaoAssistentePorOmissao === "number") {
        setComissaoPorOmissao(dados.comissaoAssistentePorOmissao);
      }
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (ready) carregar();
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

  useEffect(() => {
    setComissaoNova(String(comissaoPorOmissao));
  }, [comissaoPorOmissao]);

  async function agir(corpo: Record<string, unknown>, quem: number | "novo" | "clyon") {
    setOcupado(quem);
    setErro("");
    setFeito("");
    try {
      const res = await fetch("/api/admin/assistentes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return false;
      }
      setFeito(dados.feito ?? "Feito.");
      await carregar();
      return true;
    } catch {
      setErro("Erro de rede.");
      return false;
    } finally {
      setOcupado(null);
    }
  }

  async function criar() {
    const certo = await agir(
      { nome, palavraPasse, seccoes: seccoesNovas, comissaoPercent: comissaoNova },
      "novo",
    );
    if (certo) {
      setNome("");
      setPalavraPasse("");
      setSenhaVisivel(false);
      setSeccoesNovas([]);
      setComissaoNova(String(comissaoPorOmissao));
    }
  }

  function reporSenha(a: Assistente) {
    const nova = window.prompt(
      `Nova palavra-passe para ${a.nome} (mínimo 8 caracteres, com letra e número):`,
    );
    if (nova) agir({ id: a.id, palavraPasse: nova }, a.id);
  }

  function alternarEstado(a: Assistente) {
    if (
      a.activo &&
      !window.confirm(`Desactivar ${a.nome}? Deixa de conseguir entrar no painel de imediato.`)
    ) {
      return;
    }
    agir({ id: a.id, activo: !a.activo }, a.id);
  }

  if (!ready || aCarregar) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const activos = assistentes.filter((a) => a.activo).length;
  const totalPorPagar = assistentes.reduce((s, a) => s + a.comissoes.totais.porPagar, 0);
  const totalPago = assistentes.reduce((s, a) => s + a.comissoes.totais.pago, 0);

  return (
    <div>
      {erro && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}
      {feito && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          <Check className="h-4 w-4" aria-hidden="true" />
          {feito}
        </p>
      )}

      {/* ── A percentagem da CLYON ─────────────────────────────────────────── */}
      <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Percent className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            Comissão da CLYON por trabalho
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            A parte da CLYON em cada trabalho concluído. A comissão de cada assistente é uma
            percentagem desta parte. Hoje: <strong className="text-slate-300">{percent(comissaoClyon)}</strong>.
          </p>
        </div>
        {aEditarClyon ? (
          <div className="flex items-center gap-2">
            <input
              className={`${CAIXA} w-24`}
              inputMode="decimal"
              value={clyonRascunho}
              onChange={(e) => setClyonRascunho(e.target.value)}
              aria-label="Percentagem da CLYON"
            />
            <span className="text-sm text-slate-400">%</span>
            <button
              onClick={async () => {
                const ok = await agir({ comissaoClyonPercent: clyonRascunho }, "clyon");
                if (ok) setAEditarClyon(false);
              }}
              disabled={ocupado === "clyon"}
              className="rounded-lg bg-acao px-3 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
            >
              Guardar
            </button>
            <button
              onClick={() => {
                setAEditarClyon(false);
                setClyonRascunho(String(comissaoClyon));
              }}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAEditarClyon(true)}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Alterar percentagem
          </button>
        )}
      </section>

      {/* ── Criar ─────────────────────────────────────────────────────────── */}
      <section className="mb-5 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <UserPlus className="h-4 w-4 text-cyan-400" aria-hidden="true" />
          Nova conta de assistente
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className={`${CAIXA} uppercase`}
            placeholder="NOME (sem espaços)"
            value={nome}
            onChange={(e) => setNome(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
          />
          <div className="relative">
            <input
              className={`${CAIXA} pr-10`}
              type={senhaVisivel ? "text" : "password"}
              placeholder="palavra-passe (8+, letra e número)"
              value={palavraPasse}
              onChange={(e) => setPalavraPasse(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setSenhaVisivel((v) => !v)}
              aria-label={senhaVisivel ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              {senhaVisivel ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Acessos desta conta
          </p>
          <EscolhaDeSeccoes valor={seccoesNovas} onChange={setSeccoesNovas} />
          <p className="mt-1.5 text-[11px] text-slate-500">
            Nenhuma vem marcada: escolha o que esta conta pode ver. Só aparecem no painel dela as
            secções marcadas — «Assistentes» nunca. Pode mudar depois, a qualquer altura.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Comissão</p>
          <input
            className={`${CAIXA} w-24`}
            inputMode="decimal"
            value={comissaoNova}
            onChange={(e) => setComissaoNova(e.target.value)}
            aria-label="Percentagem da comissão do assistente"
          />
          <span className="text-xs text-slate-400">
            % da parte da CLYON ({percent(comissaoClyon)}) em cada trabalho concluído
          </span>
        </div>

        <button
          onClick={criar}
          disabled={
            ocupado === "novo" ||
            nome.trim().length < 3 ||
            palavraPasse.length < 8 ||
            seccoesNovas.length === 0
          }
          className="mt-4 flex items-center gap-2 rounded-lg bg-acao px-4 py-2 text-sm font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
        >
          {ocupado === "novo" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Criar assistente
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Entrega a palavra-passe à pessoa por fora — não voltamos a mostrá-la. Ela entra em{" "}
          <code className="font-mono">clyon.pt/admin/login</code> com este nome.
        </p>
      </section>

      {/* ── Lista ─────────────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">
          {assistentes.length} conta{assistentes.length === 1 ? "" : "s"}
          {assistentes.length > 0 ? ` · ${activos} activa${activos === 1 ? "" : "s"}` : ""}
          {assistentes.length > 0
            ? ` · comissões por pagar ${euros(totalPorPagar)} · pagas ${euros(totalPago)}`
            : ""}
        </p>
        <button
          onClick={() => carregar()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Actualizar
        </button>
      </div>

      <div className="space-y-2">
        {assistentes.map((a) => {
          const e = a.estatisticas;
          const c = a.comissoes.totais;
          const estaAberto = aberto === a.id;
          const rascunho = comissaoRascunho[a.id] ?? String(a.comissaoPercent);
          return (
            <article
              key={a.id}
              className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{a.nome}</span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                      assistente · {percent(a.comissaoPercent)} da comissão ·{" "}
                      {a.comissaoSobre === "todos" ? "todos os trabalhos" : "só os dela"}
                    </span>
                    {!a.activo && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">
                        desactivado
                      </span>
                    )}
                    {a.seccoes.length < SECCOES_DO_ASSISTENTE.length && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
                        {a.seccoes.length} de {SECCOES_DO_ASSISTENTE.length} secções
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    criado a {dataCurta(a.createdAt)}
                    {a.updatedAt && a.updatedAt !== a.createdAt ? ` · alterado a ${dataCurta(a.updatedAt)}` : ""}
                  </p>
                </div>

                {/* Os números, sempre visíveis — o dinheiro, por períodos (desde 23/09). */}
                <dl className="grid grid-cols-4 gap-x-4 text-center">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-500">Trabalhos</dt>
                    <dd className="text-sm font-bold text-white" title="Concluídos desde 23/09 que contam para esta conta">
                      {c.trabalhos}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-500">Este período</dt>
                    <dd className="text-sm font-bold text-cyan-300" title={c.periodoActual ?? undefined}>
                      {euros(c.estePeriodo)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-500">Por pagar</dt>
                    <dd className={`text-sm font-bold ${c.porPagar > 0 ? "text-amber-300" : "text-slate-400"}`}>
                      {euros(c.porPagar)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-500">Pago</dt>
                    <dd className="text-sm font-bold text-emerald-300">{euros(c.pago)}</dd>
                  </div>
                </dl>

                <button
                  onClick={() => setAberto(estaAberto ? null : a.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  aria-expanded={estaAberto}
                >
                  {estaAberto ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                  Gerir
                </button>
              </div>

              {estaAberto && (
                <div className="mt-3 space-y-4 border-t border-slate-700/60 pt-3">
                  {/* Acessos */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Acessos
                    </p>
                    <EscolhaDeSeccoes
                      valor={a.seccoes}
                      disabled={ocupado === a.id}
                      onChange={(seccoes) => {
                        if (seccoes.length === 0) {
                          setErro("Uma conta tem de ter pelo menos uma secção.");
                          return;
                        }
                        agir({ id: a.id, seccoes }, a.id);
                      }}
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Vale na próxima chamada que ela fizer — não precisa de sair e entrar.
                    </p>
                  </div>

                  {/* Comissão */}
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Comissão</p>
                    <input
                      className={`${CAIXA} w-24`}
                      inputMode="decimal"
                      value={rascunho}
                      onChange={(ev) => setComissaoRascunho((r) => ({ ...r, [a.id]: ev.target.value }))}
                      aria-label={`Comissão de ${a.nome}`}
                    />
                    <span className="text-xs text-slate-400">% da parte da CLYON</span>
                    {rascunho !== String(a.comissaoPercent) && (
                      <button
                        onClick={() => agir({ id: a.id, comissaoPercent: rascunho }, a.id)}
                        disabled={ocupado === a.id}
                        className="rounded-lg bg-acao px-3 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
                      >
                        Guardar
                      </button>
                    )}
                  </div>

                  {/* Sobre que trabalhos ganha — 08-10-2026 */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Ganha sobre
                    </p>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Sobre que trabalhos ganha ${a.nome}`}>
                      {(
                        [
                          ["todos", "Todos os trabalhos"],
                          ["seus", "Só os dela"],
                        ] as const
                      ).map(([valor, rotulo]) => {
                        const escolhido = a.comissaoSobre === valor;
                        return (
                          <button
                            key={valor}
                            role="radio"
                            aria-checked={escolhido}
                            disabled={ocupado === a.id || escolhido}
                            onClick={() => agir({ id: a.id, comissaoSobre: valor }, a.id)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                              escolhido
                                ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-100"
                                : "border-slate-600 text-slate-400 hover:bg-slate-800"
                            }`}
                          >
                            {rotulo}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      «Todos» conta todos os trabalhos concluídos desde 23/09, de quem quer que os tenha
                      tratado. «Só os dela» conta os que ela aceitou ou em que foi a primeira a agir. Os
                      períodos já pagos não mudam.
                    </p>
                  </div>

                  {/* Trabalhos, por extenso */}
                  <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                    <p>
                      Dela, de sempre: <strong className="text-slate-200">{e.concluidos}</strong> concluídos ·{" "}
                      <strong className="text-slate-200">{e.emCurso}</strong> em curso ·{" "}
                      <strong className="text-slate-200">{e.cancelados}</strong> cancelados ou rejeitados ·{" "}
                      <strong className="text-slate-200">{e.arquivados}</strong> arquivados
                    </p>
                    <p>
                      Comissão desde 23/09: este período{c.periodoActual ? ` (${c.periodoActual})` : ""}{" "}
                      <strong className="text-cyan-300">{euros(c.estePeriodo)}</strong> · por pagar{" "}
                      <strong className="text-amber-300">{euros(c.porPagar)}</strong> · pago{" "}
                      <strong className="text-emerald-300">{euros(c.pago)}</strong>
                    </p>
                  </div>

                  {/*
                    Os períodos e os trabalhos por trás de cada número — ver
                    TrabalhosDoAssistente. A `key` faz-o reler quando muda o que
                    entra na conta.
                  */}
                  <TrabalhosDoAssistente
                    key={`${a.id}-${a.comissaoPercent}-${a.comissaoSobre}-${comissaoClyon}`}
                    id={a.id}
                    token={token}
                    onMudou={(texto) => {
                      setErro("");
                      setFeito(texto);
                      carregar(true);
                    }}
                  />

                  {/* Conta */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => reporSenha(a)}
                      disabled={ocupado === a.id}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                    >
                      <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                      Repor senha
                    </button>
                    <button
                      onClick={() => alternarEstado(a)}
                      disabled={ocupado === a.id}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                        a.activo
                          ? "border border-slate-600 text-slate-300 hover:bg-slate-800"
                          : "bg-emerald-600 text-white hover:bg-emerald-500"
                      }`}
                    >
                      {ocupado === a.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : a.activo ? (
                        "Desactivar"
                      ) : (
                        "Reactivar"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {assistentes.length === 0 && (
          <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
            Ainda não há assistentes. Crie a primeira conta acima.
          </p>
        )}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
        A comissão conta-se por períodos — de 23/09 a 15/10, depois de 1 a 15 e de 16 ao fim de cada
        mês —, pelo dia em que cada trabalho ficou concluído. Uma conta em «todos os trabalhos» ganha
        sobre tudo o que foi concluído; uma em «só os dela», sobre os que aceitou ou em que foi a
        primeira a agir. A comissão é sobre o valor acordado com o profissional (ou o preço final que
        a CLYON fechou), na percentagem da CLYON, e depois na percentagem do assistente. Mudar uma
        percentagem recalcula os períodos por pagar; um período marcado como pago fica como foi pago.
        Trabalhos de contas de teste não contam.
      </p>
    </div>
  );
}
