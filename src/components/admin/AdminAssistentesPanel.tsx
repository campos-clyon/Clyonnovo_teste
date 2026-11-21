"use client";

import { useProcuraDoBackoffice } from "@/components/admin/NoutrosSitios";
import { combinaComOsCampos } from "@/lib/procurar-pedido";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { Check, ChevronDown, ChevronUp, Loader2, RefreshCw, UserPlus } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import TrabalhosDoAssistente from "./TrabalhosDoAssistente";
import AdminPresencaPanel from "./AdminPresencaPanel";
import Ajuda from "./Ajuda";
import {
  CodigoMostradoUmaVez,
  EstadoDoCodigo,
  RegistoDasTrocas,
  TextoDosCodigos,
  useCodigosParaEntrar,
  type ContaDoPainel,
} from "./CodigosParaEntrar";
import { INICIO_DAS_COMISSOES, diaEscrito } from "@/lib/periodos-de-comissao";
import { rotuloDaSaida } from "@/lib/saida-da-assistente";

/** «23/09» — o primeiro dia que conta, escrito como se lê. */
const INICIO_ESCRITO = diaEscrito(INICIO_DAS_COMISSOES).slice(0, 5);
import {
  ROTULO_DA_SECCAO,
  SECCOES_DA_MESA,
  SECCOES_DO_ASSISTENTE,
  normalizarSeccoes,
  type SeccaoDoAssistente,
} from "@/lib/papel-do-painel";

/** As caixas que se mostram: a Mesa é uma só (20-10-2026) — o «valor fixo» vai com ela. */
const SECCOES_A_ESCOLHER: readonly SeccaoDoAssistente[] = SECCOES_DO_ASSISTENTE.filter((s) => s !== "trabalhos_clyon");

/**
 * As contas de assistente, geridas pelo administrador.
 *
 * Um assistente entra em clyon.pt/admin/login com o código para entrar que
 * lhe for dado aqui (d75, 20-11-2026) e cai num painel só dele, com as secções que lhe forem dadas aqui.
 * Desde 03-10-2026 pode dar-se qualquer secção do menu menos «Assistentes»,
 * e uma conta nova nasce sem nenhuma marcada — quem cria escolhe. Não vê o
 * resto e não apaga nada.
 *
 * Desde 08-10-2026 a comissão conta-se por PERÍODOS — 23/09 a 15/10, depois
 * quinzenas — e cada conta ganha sobre todos os trabalhos ou só sobre os
 * seus. O cartão mostra este período, o que está por pagar e o que já foi
 * pago; o detalhe (`TrabalhosDoAssistente`) lista os períodos e marca-os
 * como pagos.
 *
 * ARRUMADO — d81, 21-11-2026 («demasiados textos longos e blocos soltos»):
 *  - as explicações saem do ecrã para um «?» ao lado do título (`Ajuda`);
 *  - um cartão por pessoa: nome e papel, o código (o bloco «Códigos para
 *    entrar» saiu: o estado e os botões vêm para aqui, o registo das trocas
 *    para o «Gerir»), as secções, a comissão e o «Gerir». O administrador
 *    também tem cartão, só com o código;
 *  - «Nova conta de assistente» é um botão ao lado do título;
 *  - a ordem é: contas ativas, presença (recolhida), desactivadas (recolhidas).
 * Nada saiu: tudo o que se fazia faz-se, no «Gerir» de cada uma.
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
  /** O dia de saída e os pedidos que contam depois dele (d40). */
  saida?: { saiuA: string | null; excepcoes: number[] };
  estatisticas: Estatisticas;
  comissoes: { totais: TotaisDasComissoes };
  createdAt: string | null;
  updatedAt: string | null;
};

/*
 * A CAIXA DA PERCENTAGEM — 17-10-2026. «A Comissão poderia ter o quadrado
 * pequeno à frente do nome, para colocar até 3 números: as comissões não
 * passam de 999 %.» Era a CAIXA com `w-full`, que ganhava ao `w-24` e ocupava
 * a linha inteira.
 */
const CAIXA_DA_PERCENTAGEM =
  "w-20 shrink-0 rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-white outline-none focus:border-cyan-500";

const CAIXA =
  "w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";

/** O rótulo pequeno de cada bloco do cartão. */
const ROTULO = "relative flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500";

/** As colunas do cartão: no telemóvel nome e «Gerir» por cima, o resto por baixo; num ecrã largo, uma linha. */
const GRELHA_DO_CARTAO =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2.5 xl:grid-cols-[minmax(9rem,1fr)_minmax(0,1.35fr)_5.5rem_minmax(0,1.6fr)_5.5rem] xl:items-start";

function dataCurta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
}

function euros(v: number): string {
  return v.toFixed(2).replace(".", ",") + " €";
}

function percent(v: number): string {
  return (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",")) + " %";
}

/** O texto do «?» do cabeçalho — era o parágrafo por baixo do título. */
function TextoDoCabecalho() {
  return (
    <>
      <p>
        Contas com um painel próprio, com as secções que escolher para cada uma — qualquer secção do menu, menos esta.
        Uma conta nova não traz nenhuma marcada.
      </p>
      <p className="mt-1.5">
        Os assistentes não gerem assistentes e não apagam: arquivam. Criam-se aqui, o código para entrar dá-se aqui, e
        desactivar fecha a porta no acto.
      </p>
    </>
  );
}

/** O texto do «?» da comissão — eram o bloco «Comissão sobre o lucro da CLYON» e o texto por baixo da lista. */
function TextoDaComissao() {
  return (
    <>
      <p className="font-semibold text-white">Comissão sobre o lucro da CLYON</p>
      <p className="mt-1">
        A parte de cada assistente é uma percentagem do lucro total de cada período — o que a CLYON fica de cada
        trabalho, sem IVA: nos pedidos da plataforma, as taxas desse trabalho; nos Trabalhos CLYON, a taxa escolhida;
        nos fechados à mão, o lucro que se escrever.
      </p>
      <p className="mt-1.5">
        A comissão conta-se por períodos — de {INICIO_ESCRITO} a 15/10, depois de 1 a 15 e de 16 ao fim de cada mês —,
        pelo dia em que cada trabalho ficou concluído. Uma conta em «todos os trabalhos» ganha sobre tudo o que foi
        concluído; uma em «só os dela», sobre os que aceitou ou em que foi a primeira a agir. A parte do assistente é a
        percentagem dele sobre o lucro da CLYON no período, sem IVA: num pedido da plataforma, as taxas da negociação (e
        o acréscimo de pagar depois); num Trabalho CLYON, o preço ao cliente menos o que o profissional recebe; num
        trabalho fechado à mão, o lucro que se escreveu. Mudar uma percentagem recalcula os períodos por pagar; um
        período marcado como pago fica como foi pago. Trabalhos de contas de teste não contam.
      </p>
    </>
  );
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
      {SECCOES_A_ESCOLHER.map((s) => {
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
                    ? normalizarSeccoes([...valor, s])
                    : // Desmarcar a Mesa tira as duas metades dela.
                      valor.filter((x) => x !== s && !(SECCOES_DA_MESA.includes(s) && SECCOES_DA_MESA.includes(x))),
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

export default function AdminAssistentesPanel({
  presenca,
}: {
  /** O bloco «Presença e agendas» (vem do LegacyAdminClient), entre as ativas e as desactivadas. */
  presenca?: ReactNode;
}) {
  const { token, ready, user } = useAdminAuth();
  const [assistentes, setAssistentes] = useState<Assistente[]>([]);
  // A barra do topo (d79, 20-11-2026): pelo nome.
  const { termo: busca } = useProcuraDoBackoffice();
  const [comissaoPorOmissao, setComissaoPorOmissao] = useState<number>(40);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<number | "novo" | null>(null);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");

  // Formulário de criação
  const [nome, setNome] = useState("");
  // O código da conta nova: escrito à mão, ou em branco para o servidor gerar (d75).
  const [codigoNovo, setCodigoNovo] = useState("");
  const [versaoDasContas, setVersaoDasContas] = useState(0);
  const [codigoDaNova, setCodigoDaNova] = useState<{ nome: string; codigo: string } | null>(null);
  // Desmarcadas ao criar — 03-10-2026. Com o menu inteiro na lista, vir tudo
  // marcado era dar carteiras e configurações a quem só ia tratar de pedidos.
  const [seccoesNovas, setSeccoesNovas] = useState<SeccaoDoAssistente[]>([]);
  // «Coloque o Nova conta de assistente dentro de um botão, para só abrir
  // quando quiser.» — o dono, 17-10-2026. Desde a d81 o botão está no topo,
  // à direita do título, e o formulário abre por baixo dele.
  const [novaAberta, setNovaAberta] = useState(false);
  const [comissaoNova, setComissaoNova] = useState<string>("40");

  // Qual conta está com os detalhes abertos
  const [aberto, setAberto] = useState<number | null>(null);
  // As desactivadas ficam recolhidas no fim (d81).
  const [desactivadasAbertas, setDesactivadasAbertas] = useState(false);
  const [comissaoRascunho, setComissaoRascunho] = useState<Record<number, string>>({});
  // A saída e as excepções (d40): o dia escolhido e o pedido a marcar, por conta.
  const [saidaRascunho, setSaidaRascunho] = useState<Record<number, string>>({});
  const [excepcaoRascunho, setExcepcaoRascunho] = useState<Record<number, string>>({});

  // Os códigos para entrar (d75): o estado de cada conta, no cartão dela.
  const codigos = useCodigosParaEntrar(token, versaoDasContas);

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

  async function agir(
    corpo: Record<string, unknown>,
    quem: number | "novo",
    aoFazer?: (dados: Record<string, unknown>) => void,
  ) {
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
      aoFazer?.(dados);
      setVersaoDasContas((v) => v + 1);
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
    const nomeDaNova = nome;
    const escrito = codigoNovo.trim();
    const certo = await agir(
      {
        nome,
        seccoes: seccoesNovas,
        comissaoPercent: comissaoNova,
        ...(escrito ? { codigo: codigoNovo } : { gerarCodigo: true }),
      },
      "novo",
      (dados) => {
        if (typeof dados.codigoGerado === "string") {
          setCodigoDaNova({ nome: nomeDaNova, codigo: dados.codigoGerado });
        }
      },
    );
    if (certo) {
      setNome("");
      setCodigoNovo("");
      setSeccoesNovas([]);
      setComissaoNova(String(comissaoPorOmissao));
      setNovaAberta(false);
    }
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

  // A barra do topo filtra os cartões pelo nome (ou pelo n.º da conta).
  const combina = (c: { id: number; nome: string }) => combinaComOsCampos({ ids: [c.id], textos: [c.nome] }, busca);
  const aProcurar = busca.trim() !== "";
  const contaDe = new Map(codigos.contas.map((c) => [c.id, c]));
  const administradores = codigos.contas.filter((c) => c.papel === "admin" && combina(c));
  const assistentesAtivas = assistentes.filter((a) => a.activo && combina(a));
  const assistentesDesactivadas = assistentes.filter((a) => !a.activo && combina(a));
  const adminsAtivos = administradores.filter((c) => c.activo);
  const adminsDesactivados = administradores.filter((c) => !c.activo);
  const nDesactivadas = assistentesDesactivadas.length + adminsDesactivados.length;
  const nada = aProcurar && assistentesAtivas.length + adminsAtivos.length + nDesactivadas === 0;
  // A procurar, uma desactivada que case abre o grupo — senão não se via.
  const desactivadasVisiveis = desactivadasAbertas || (aProcurar && nDesactivadas > 0);
  const semCodigo = codigos.contas.filter((c) => c.activo && !c.temCodigo).length;

  /** O cartão do administrador: só o código (d81). */
  const cartaoDoAdministrador = (c: ContaDoPainel) => (
    <article key={`admin-${c.id}`} className="relative rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
      <div className={GRELHA_DO_CARTAO}>
        <div className="col-span-2 min-w-0 xl:col-span-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className={`font-semibold ${c.activo ? "text-white" : "text-slate-400"}`}>{c.nome}</span>
            {!c.activo && (
              <span className="rounded-full bg-coral/14 px-2 py-0.5 text-[11px] font-semibold text-coral-texto">desactivada</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            administrador{user?.id === c.id ? " · a sua conta" : ""}
          </p>
        </div>
        <div className="col-span-2 min-w-0 xl:col-span-1">
          <div className={ROTULO}>
            Código para entrar
            <Ajuda sobre="Código para entrar">
              <TextoDosCodigos />
            </Ajuda>
          </div>
          <div className="mt-1">
            <EstadoDoCodigo conta={c} codigos={codigos} />
          </div>
        </div>
        <div className="col-span-2 xl:col-span-3 xl:justify-self-end">
          <RegistoDasTrocas nome={c.nome} registo={codigos.registo} />
        </div>
      </div>
    </article>
  );

  /** O cartão de uma assistente: nome e papel, código, secções, comissão e «Gerir». */
  const cartao = (a: Assistente) => {
    const e = a.estatisticas;
    const c = a.comissoes.totais;
    const conta = contaDe.get(a.id);
    const estaAberto = aberto === a.id;
    const rascunho = comissaoRascunho[a.id] ?? String(a.comissaoPercent);
    const nSeccoes = a.seccoes.filter((s) => SECCOES_A_ESCOLHER.includes(s)).length;
    return (
      <article key={a.id} className="relative rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
        <div className={GRELHA_DO_CARTAO}>
          {/* Nome e papel */}
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5">
              <span className={`font-semibold ${a.activo ? "text-white" : "text-slate-400"}`}>{a.nome}</span>
              {a.saida?.saiuA && (
                <span className="rounded-full bg-ambar/14 px-2 py-0.5 text-[11px] font-semibold text-ambar-texto">
                  {rotuloDaSaida(a.saida.saiuA)}
                </span>
              )}
              {!a.activo && (
                <span className="rounded-full bg-coral/14 px-2 py-0.5 text-[11px] font-semibold text-coral-texto">
                  desactivada
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              assistente · {percent(a.comissaoPercent)} do lucro ·{" "}
              {a.comissaoSobre === "todos" ? "todos os trabalhos" : "só os dela"}
            </p>
          </div>

          {/* Gerir — no telemóvel ao lado do nome; num ecrã largo, no fim da linha */}
          <button
            type="button"
            onClick={() => setAberto(estaAberto ? null : a.id)}
            className="flex h-fit items-center gap-1.5 self-start justify-self-end rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 xl:order-last"
            aria-expanded={estaAberto}
          >
            {estaAberto ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
            Gerir
          </button>

          {/* Código para entrar (d75) */}
          <div className="col-span-2 min-w-0 xl:col-span-1">
            <div className={ROTULO}>
              Código para entrar
              <Ajuda sobre="Código para entrar">
                <TextoDosCodigos />
              </Ajuda>
            </div>
            <div className="mt-1">
              {conta ? <EstadoDoCodigo conta={conta} codigos={codigos} /> : <p className="text-xs text-slate-500">—</p>}
            </div>
          </div>

          {/* Secções */}
          <div className="col-span-2 flex items-baseline gap-2 xl:col-span-1 xl:block">
            <p className={ROTULO}>Secções</p>
            <p
              className={`text-sm font-semibold tabular-nums xl:mt-1 ${
                nSeccoes < SECCOES_A_ESCOLHER.length ? "text-ambar-texto" : "text-white"
              }`}
            >
              {nSeccoes} de {SECCOES_A_ESCOLHER.length}
            </p>
          </div>

          {/* Comissão — por períodos, desde o início das comissões */}
          <div className="col-span-2 min-w-0 xl:col-span-1">
            <div className={ROTULO}>
              Comissão
              <Ajuda sobre="Comissão">
                <TextoDaComissao />
              </Ajuda>
            </div>
            <dl className="mt-1 grid grid-cols-3 gap-2">
              <div>
                <dt className="text-[11px] text-slate-500">Este período</dt>
                <dd className="text-sm font-bold tabular-nums text-ciano-texto" title={c.periodoActual ?? undefined}>
                  {euros(c.estePeriodo)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Por pagar</dt>
                <dd className={`text-sm font-bold tabular-nums ${c.porPagar > 0 ? "text-ambar-texto" : "text-slate-400"}`}>
                  {euros(c.porPagar)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Pago</dt>
                <dd className="text-sm font-bold tabular-nums text-esmeralda-texto">{euros(c.pago)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {estaAberto && (
          <div className="mt-3 space-y-4 border-t border-slate-700/60 pt-3">
            {/* A conta e os números por extenso */}
            <div className="space-y-1 text-xs text-slate-400">
              <p>
                Criada a {dataCurta(a.createdAt)}
                {a.updatedAt && a.updatedAt !== a.createdAt ? ` · alterada a ${dataCurta(a.updatedAt)}` : ""}
              </p>
              <p>
                Dela, de sempre: <strong className="text-slate-200">{e.concluidos}</strong> concluídos ·{" "}
                <strong className="text-slate-200">{e.emCurso}</strong> em curso ·{" "}
                <strong className="text-slate-200">{e.cancelados}</strong> cancelados ou rejeitados ·{" "}
                <strong className="text-slate-200">{e.arquivados}</strong> arquivados
              </p>
              <p>
                Comissão desde {INICIO_ESCRITO}: <strong className="text-slate-200">{c.trabalhos}</strong>{" "}
                {c.trabalhos === 1 ? "trabalho concluído conta" : "trabalhos concluídos contam"} · este período
                {c.periodoActual ? ` (${c.periodoActual})` : ""}{" "}
                <strong className="text-ciano-texto">{euros(c.estePeriodo)}</strong> · por pagar{" "}
                <strong className="text-ambar-texto">{euros(c.porPagar)}</strong> · pago{" "}
                <strong className="text-esmeralda-texto">{euros(c.pago)}</strong>
              </p>
            </div>

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
                className={CAIXA_DA_PERCENTAGEM}
                maxLength={6}
                inputMode="decimal"
                value={rascunho}
                onChange={(ev) => setComissaoRascunho((r) => ({ ...r, [a.id]: ev.target.value }))}
                aria-label={`Comissão de ${a.nome}`}
              />
              <span className="text-xs text-slate-400">% do lucro da CLYON</span>
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
                «Todos» conta todos os trabalhos concluídos desde {INICIO_ESCRITO}, de quem quer que os tenha
                tratado — e a lista diz quem foi o operador de cada um. «Só os dela» conta os que ela aceitou ou em que foi a primeira a agir. Os
                períodos já pagos não mudam.
              </p>
            </div>

            {/*
              A SAÍDA — d40, 15-11-2026. O último dia que conta para ela; o que
              for feito depois só conta se estiver marcado aqui («falou com o
              cliente»). Não desactiva a conta: isso é o botão de baixo.
            */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Saiu a</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={saidaRascunho[a.id] || a.saida?.saiuA || ""}
                  onChange={(ev) => setSaidaRascunho((r) => ({ ...r, [a.id]: ev.target.value }))}
                  className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                  aria-label={`Dia em que ${a.nome} saiu`}
                />
                {Boolean(saidaRascunho[a.id]) && saidaRascunho[a.id] !== (a.saida?.saiuA ?? "") && (
                  <button
                    onClick={() => {
                      const dia = saidaRascunho[a.id];
                      if (!window.confirm(`${a.nome} saiu a ${diaEscrito(dia)}? O que for feito depois deixa de contar para ela, salvo os trabalhos marcados.`)) return;
                      agir({ id: a.id, saiuA: dia }, a.id).then((ok) => {
                        if (ok) setSaidaRascunho((r) => ({ ...r, [a.id]: "" }));
                      });
                    }}
                    disabled={ocupado === a.id}
                    className="rounded-lg bg-acao px-3 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
                  >
                    Guardar
                  </button>
                )}
                {a.saida?.saiuA && (
                  <button
                    onClick={() => {
                      if (!window.confirm(`Apagar o dia de saída de ${a.nome}? Volta a contar tudo como antes.`)) return;
                      agir({ id: a.id, saiuA: null }, a.id);
                    }}
                    disabled={ocupado === a.id}
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                  >
                    Apagar o dia
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Depois deste dia, nenhum trabalho conta para {a.nome} — com «todos» ou «só os dela» —, pelo dia em
                que foi feito. O próprio dia ainda conta. Os períodos já pagos não mudam.
              </p>

              {a.saida?.saiuA && (
                <div className="mt-3 rounded-lg border border-slate-700/60 bg-slate-950/40 p-2.5">
                  <p className="text-xs font-semibold text-white">Trabalhos que contam depois da saída</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Conta para {a.nome} (falou com o cliente): entra quando ficar concluído, na quinzena em que for
                    feito.
                  </p>
                  {a.saida.excepcoes.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {a.saida.excepcoes.map((pid) => (
                        <li
                          key={pid}
                          className="flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-100"
                        >
                          #{pid}
                          <button
                            onClick={() => {
                              if (!window.confirm(`#${pid} deixa de contar para ${a.nome}?`)) return;
                              agir({ id: a.id, excepcaoDaSaida: { pedidoId: pid, marcar: false } }, a.id);
                            }}
                            disabled={ocupado === a.id}
                            className="text-[10px] text-slate-400 hover:text-red-300 disabled:opacity-40"
                            aria-label={`Desmarcar #${pid}`}
                          >
                            tirar
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-500">Nenhum marcado.</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      inputMode="numeric"
                      placeholder="N.º do pedido"
                      value={excepcaoRascunho[a.id] ?? ""}
                      onChange={(ev) => setExcepcaoRascunho((r) => ({ ...r, [a.id]: ev.target.value }))}
                      className="w-32 rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                      aria-label={`Pedido que conta para ${a.nome} depois da saída`}
                    />
                    <button
                      onClick={() => {
                        const pid = (excepcaoRascunho[a.id] ?? "").replace("#", "").trim();
                        if (!pid) return;
                        agir({ id: a.id, excepcaoDaSaida: { pedidoId: pid, marcar: true } }, a.id).then((ok) => {
                          if (ok) setExcepcaoRascunho((r) => ({ ...r, [a.id]: "" }));
                        });
                      }}
                      disabled={ocupado === a.id || !(excepcaoRascunho[a.id] ?? "").trim()}
                      className="rounded-lg bg-acao px-3 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
                    >
                      Conta para {a.nome}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/*
              Os períodos e os trabalhos por trás de cada número — ver
              TrabalhosDoAssistente (resumo entre datas, previsão, «Marcar como
              pago», «Anular pagamento», CSV, relatório geral). A `key` faz-o
              reler quando muda o que entra na conta.
            */}
            <TrabalhosDoAssistente
              key={`${a.id}-${a.comissaoPercent}-${a.comissaoSobre}-${a.saida?.saiuA ?? ""}-${a.saida?.excepcoes.join(",") ?? ""}`}
              token={token}
              fonte={`/api/admin/assistentes?trabalhos=${a.id}`}
              gerir={(corpo) => agir({ id: a.id, ...corpo }, a.id)}
            />

            {/* O registo das trocas do código dela (d75 → d81) */}
            <RegistoDasTrocas nome={a.nome} registo={codigos.registo} />

            {/* A presença de uma conta desactivada só se vê aqui (d81) */}
            {!a.activo && (
              <div className="rounded-xl border border-slate-700/60 bg-slate-950/30 p-3">
                <AdminPresencaPanel soDe={a.id} />
              </div>
            )}

            {/* Conta */}
            <div className="flex flex-wrap gap-2">
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
  };

  return (
    <div className="space-y-4">
      {/* ── O título, o «?», o resumo e os dois botões (d81) ─────────────────── */}
      <div>
        <div className="relative flex flex-wrap items-center gap-x-2 gap-y-2">
          <h2 className="text-2xl font-semibold text-white">Assistentes</h2>
          <Ajuda sobre="Assistentes">
            <TextoDoCabecalho />
          </Ajuda>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => carregar()}
              aria-label="Atualizar"
              title="Atualizar"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setNovaAberta((v) => !v)}
              aria-expanded={novaAberta}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-acao px-3 text-xs font-semibold text-white hover:bg-acao-hover"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Nova conta de assistente
            </button>
          </div>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {assistentes.length} conta{assistentes.length === 1 ? "" : "s"}
          {assistentes.length > 0 ? ` · ${activos} ativa${activos === 1 ? "" : "s"}` : ""}
          {assistentes.length > 0
            ? ` · comissões por pagar ${euros(totalPorPagar)} · pagas ${euros(totalPago)}`
            : ""}
        </p>
      </div>

      {(erro || codigos.erro) && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro || codigos.erro}
        </p>
      )}
      {(feito || (codigos.feito && !codigos.mostrado)) && (
        <p className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          <Check className="h-4 w-4" aria-hidden="true" />
          {feito || codigos.feito}
        </p>
      )}
      {!codigos.segredoPosto && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          Falta a variável CODIGO_DE_ENTRADA_PEPPER na Vercel. Sem ela não se gravam códigos nem se entra com eles.
        </p>
      )}
      {semCodigo > 0 && (
        <p className="text-xs text-ambar-texto">
          {semCodigo === 1 ? "1 conta ativa sem código" : `${semCodigo} contas ativas sem código`} — enquanto houver, o
          ecrã de entrada mostra «Entrar com utilizador».
        </p>
      )}

      {codigoDaNova && (
        <CodigoMostradoUmaVez
          nome={codigoDaNova.nome}
          codigo={codigoDaNova.codigo}
          aoFechar={() => setCodigoDaNova(null)}
        />
      )}
      {codigos.mostrado && (
        <CodigoMostradoUmaVez
          nome={codigos.mostrado.nome}
          codigo={codigos.mostrado.codigo}
          aoFechar={codigos.fecharMostrado}
        />
      )}

      {/* ── Criar — fechado até se carregar no botão do topo (17-10-2026, d81) ── */}
      {novaAberta && (
      <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <UserPlus className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            Nova conta de assistente
          </h3>
          <button
            type="button"
            onClick={() => setNovaAberta(false)}
            aria-expanded={true}
            className="flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            Fechar
          </button>
        </div>
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
          <input
            className={`${CAIXA} font-mono`}
            type="text"
            placeholder="Código para entrar (em branco: gera-se um)"
            value={codigoNovo}
            onChange={(e) => setCodigoNovo(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Código para entrar da conta nova"
          />
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
            className={CAIXA_DA_PERCENTAGEM}
            maxLength={6}
            inputMode="decimal"
            value={comissaoNova}
            onChange={(e) => setComissaoNova(e.target.value)}
            aria-label="Percentagem da comissão do assistente"
          />
          <span className="text-xs text-slate-400">
            % do lucro da CLYON em cada período
          </span>
        </div>

        <button
          onClick={criar}
          disabled={
            ocupado === "novo" ||
            nome.trim().length < 3 ||
            seccoesNovas.length === 0
          }
          className="mt-4 flex items-center gap-2 rounded-lg bg-acao px-4 py-2 text-sm font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
        >
          {ocupado === "novo" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Criar assistente
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Entregue o código à pessoa por fora — não voltamos a mostrá-lo. Ela entra em{" "}
          <code className="font-mono">clyon.pt/admin/login</code> só com o código.
        </p>
      </section>
      )}

      {/* ── 1. As contas ativas: o administrador e as assistentes ─────────────── */}
      <div className="space-y-2">
        {nada && <p className="text-sm text-slate-400">Nenhuma conta com «{busca.trim()}».</p>}
        {adminsAtivos.map(cartaoDoAdministrador)}
        {assistentesAtivas.map(cartao)}
        {assistentes.length === 0 && (
          <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-center text-sm text-slate-400">
            Ainda não há assistentes. Crie a primeira conta no botão de cima.
          </p>
        )}
      </div>

      {/* ── 2. A presença e as agendas, recolhidas ───────────────────────────── */}
      {presenca && <div className="border-t border-slate-700/60 pt-4">{presenca}</div>}

      {/* ── 3. As desactivadas, recolhidas no fim ────────────────────────────── */}
      {nDesactivadas > 0 && (
        <div className="border-t border-slate-700/60 pt-4">
          <button
            type="button"
            onClick={() => setDesactivadasAbertas((v) => !v)}
            aria-expanded={desactivadasVisiveis}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white"
          >
            {desactivadasVisiveis ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
            Desactivadas ({nDesactivadas})
          </button>
          {desactivadasVisiveis && (
            <div className="mt-2 space-y-2">
              {adminsDesactivados.map(cartaoDoAdministrador)}
              {assistentesDesactivadas.map(cartao)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
