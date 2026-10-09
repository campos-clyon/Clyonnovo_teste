"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Coins,
  Loader2,
  MessageCircle,
  Pencil,
  RefreshCw,
  UserCheck,
  Users,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import RegistarPedido from "@/components/admin/RegistarPedido";
import { FormularioDaOferta } from "@/components/admin/FormularioDaOferta";
import { servicoEmPalavras } from "@/lib/servico-em-palavras";
import {
  ROTULO_DA_FASE,
  lerValorFixo,
  taxasDoTrabalhoClyon,
  type FaseDaOferta,
  type ModoDaOferta,
} from "@/lib/oferta-clyon";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
import { linkDaPropostaClyon } from "@/lib/proposta-clyon-ao-cliente";
import ValorETaxaDoTrabalho from "@/components/admin/ValorETaxaDoTrabalho";
import { coresPelaOrdem, type CorDoProfissional } from "@/lib/cores-dos-profissionais";

/**
 * OS TRABALHOS CLYON DE VALOR FIXO — a página do backoffice.
 *
 * *«Quero criar uma função no site para gerar trabalhos nas contas dos
 * profissionais (…) são trabalhos que nós já negociámos e já temos os valores,
 * só precisamos de alguém para realizar.»* — 02-10-2026.
 *
 * Três coisas, por esta ordem, que é a ordem em que acontecem:
 *   1. registar o trabalho e oferecê-lo — o «Registar pedido» de sempre, com o
 *      passo do envio trocado pela oferta a valor fixo;
 *   2. escolher quem o faz, entre os que aceitaram;
 *   3. confirmar que está feito — aqui é a CLYON que confirma, e não o cliente.
 *
 * As regras e as decisões do dono estão em `oferta-clyon.ts`.
 */

type NegociacaoDoTrabalho = {
  negociacaoId: number;
  providerId: number;
  profissional: string;
  estado: string;
  modo: ModoDaOferta | null;
  dataCombinada: string | null;
  atribuidaEm: string | null;
  execucaoEnviadaEm: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
};

type TrabalhoClyon = {
  pedidoId: number;
  servico: string | null;
  localidade: string | null;
  morada: string | null;
  dataAgendada: string | null;
  valorFixo: number;
  /** O que o cliente paga, sem IVA — a base da comissão da assistente (08-10-2026). */
  precoAoCliente: number | null;
  /** A taxa (0,10 / 0,15 / 0,20). Nula nos antigos: o valor era o que o pro recebia. */
  taxa: number | null;
  cliente: string | null;
  telefone: string | null;
  estadoDoPedido: string | null;
  criadoEm: string | null;
  negociacoes: NegociacaoDoTrabalho[];
  /** O mesmo que `resumoDaOferta` devolve no servidor. */
  resumo: {
    fase: FaseDaOferta;
    enviados: number;
    recusaram: number;
    interessados: NegociacaoDoTrabalho[];
    atribuida: NegociacaoDoTrabalho | null;
  };
};

type Separador = "atribuir" | "curso" | "feitos" | "cancelados";

const SEPARADORES: Array<{ id: Separador; rotulo: string; fases: FaseDaOferta[]; vazio: string }> = [
  {
    id: "atribuir",
    rotulo: "Por atribuir",
    fases: ["escolher", "a_espera", "sem_ninguem"],
    vazio: "Nenhum trabalho à espera de profissional.",
  },
  {
    id: "curso",
    rotulo: "Em curso",
    fases: ["por_confirmar", "atribuida"],
    vazio: "Nenhum trabalho em curso.",
  },
  {
    id: "feitos",
    rotulo: "Concluídos",
    fases: ["confirmada", "paga"],
    vazio: "Ainda nenhum trabalho concluído.",
  },
  // Arquivados ou cancelados antes de feitos: saíram dos profissionais (08-10-2026).
  {
    id: "cancelados",
    rotulo: "Cancelados",
    fases: ["cancelada"],
    vazio: "Nenhum trabalho cancelado.",
  },
];

const COR_DA_FASE: Record<FaseDaOferta, string> = {
  escolher: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  a_espera: "border-slate-600 bg-slate-800/60 text-slate-300",
  sem_ninguem: "border-red-500/40 bg-red-500/10 text-red-300",
  atribuida: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  por_confirmar: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  confirmada: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  paga: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  cancelada: "border-slate-600 bg-slate-800/60 text-slate-400",
};

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** O que o profissional recebe: o valor menos a taxa — nos antigos, o valor todo. */
function ganhosDe(t: { valorFixo: number; taxa: number | null }): number {
  return t.taxa != null ? quantoOProfissionalRecebe(t.valorFixo, taxasDoTrabalhoClyon(t.taxa)) : t.valorFixo;
}

const euros = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(2).replace(".", ",")} €`;

/** «sex., 2 out., 09:00» — em Lisboa, onde o trabalho acontece. */
function quando(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminTrabalhosClyonPanel() {
  const { token, ready } = useAdminAuth();
  const [trabalhos, setTrabalhos] = useState<TrabalhoClyon[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [separador, setSeparador] = useState<Separador>("atribuir");
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [aEditar, setAEditar] = useState<number | null>(null);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!token) return;
      if (!silencioso) setACarregar(true);
      try {
        const res = await fetch("/api/admin/trabalhos-clyon", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dados = await res.json();
        if (!res.ok) {
          setErro(dados.error ?? "Não foi possível ler os trabalhos CLYON.");
          return;
        }
        setTrabalhos(dados.trabalhos ?? []);
        setErro("");
      } catch {
        if (!silencioso) setErro("Erro de rede.");
      } finally {
        setACarregar(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);

  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token) });

  async function agir(
    url: string,
    corpo: Record<string, unknown>,
    negociacaoId: number,
    feito: string,
  ) {
    if (!token) return;
    setOcupado(negociacaoId);
    setErro("");
    setAviso("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return;
      }
      setAviso(feito);
      await carregar(true);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  function escolher(t: TrabalhoClyon, n: NegociacaoDoTrabalho) {
    const outros = t.resumo.interessados.length - 1;
    if (
      !window.confirm(
        `Dar o trabalho #${t.pedidoId} a ${n.profissional}? Recebe ${euros(ganhosDe(t))}.` +
          (outros > 0 ? `\n\n${outros === 1 ? "O outro que aceitou fica" : `Os outros ${outros} que aceitaram ficam`} de fora.` : ""),
      )
    ) {
      return;
    }
    void agir(
      "/api/admin/trabalhos-clyon/escolher",
      { negociacaoId: n.negociacaoId },
      n.negociacaoId,
      `#${t.pedidoId} atribuído a ${n.profissional}. Foi avisado por email e WhatsApp.`,
    );
  }

  function confirmar(t: TrabalhoClyon, n: NegociacaoDoTrabalho, semProva: boolean) {
    if (
      !window.confirm(
        semProva
          ? `${n.profissional} ainda não deu o #${t.pedidoId} por feito. Confirmar mesmo assim?\n\nO que recebe (${euros(ganhosDe(t))}) fica disponível na carteira dele.`
          : `Confirmar que o #${t.pedidoId} está feito?\n\nO que recebe (${euros(ganhosDe(t))}) fica disponível na carteira de ${n.profissional}.`,
      )
    ) {
      return;
    }
    void agir(
      "/api/admin/trabalhos-clyon/confirmar",
      { negociacaoId: n.negociacaoId, semProva },
      n.negociacaoId,
      `#${t.pedidoId} confirmado. O valor está na carteira de ${n.profissional}.`,
    );
  }

  /*
   * MEXER NUM TRABALHO JÁ OFERECIDO — 08-10-2026. O valor e a taxa (quem já
   * o tinha aceite volta a ter de aceitar), o cancelamento (todos avisados),
   * e o preço ao cliente dos antigos. A rota escreve no histórico do pedido
   * quem mudou, de quanto para quanto.
   */
  async function mexer(t: TrabalhoClyon, corpo: Record<string, unknown>, feito: (d: Record<string, unknown>) => string): Promise<boolean> {
    if (!token) return false;
    setOcupado(t.pedidoId);
    setErro("");
    setAviso("");
    try {
      const res = await fetch("/api/admin/trabalhos-clyon", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId: t.pedidoId, ...corpo }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível guardar.");
        return false;
      }
      setAviso(feito(dados));
      await carregar(true);
      return true;
    } catch {
      setErro("Erro de rede.");
      return false;
    } finally {
      setOcupado(null);
    }
  }

  const guardarPreco = (t: TrabalhoClyon, texto: string) =>
    mexer(t, { accao: "preco", precoAoCliente: texto }, (d) =>
      `#${t.pedidoId}: preço ao cliente ${euros(Number(d.precoAoCliente))} sem IVA.`,
    );

  const guardarValor = (t: TrabalhoClyon, valor: string, taxa: number) =>
    mexer(t, { accao: "valor", valor, taxa }, (d) => String(d.feito ?? `#${t.pedidoId}: valor mudado.`));

  function cancelar(t: TrabalhoClyon) {
    if (
      !window.confirm(
        `Cancelar o trabalho #${t.pedidoId}?\n\nSai dos profissionais a quem foi oferecido, e quem o tinha é avisado por WhatsApp.`,
      )
    ) {
      return;
    }
    void mexer(t, { accao: "cancelar" }, (d) => String(d.feito ?? `#${t.pedidoId} cancelado.`));
  }

  const porSeparador = useMemo(() => {
    const m = new Map<Separador, TrabalhoClyon[]>();
    for (const s of SEPARADORES) {
      m.set(
        s.id,
        trabalhos.filter((t) => s.fases.includes(t.resumo.fase)),
      );
    }
    return m;
  }, [trabalhos]);
  const actual = porSeparador.get(separador) ?? [];
  const def = SEPARADORES.find((s) => s.id === separador)!;
  /*
   * UMA COR POR TRABALHO — 09-10-2026. *«Pedidos muito misturados, não
   * consigo ver a diferença; colocar cores separando.»* Eram todos o mesmo
   * cartão escuro, um por baixo do outro. Cada um ganha um tom da paleta
   * do backoffice, pela ordem em que aparece: dois seguidos nunca têm a
   * mesma cor. Ver `cores-dos-profissionais.ts`.
   */
  const coresDosTrabalhos = coresPelaOrdem(actual.map((t) => t.pedidoId));

  return (
    <div className="space-y-4">
      <RegistarPedido
        onCriado={() => void carregar(true)}
        oferta={(r) => (
          <FormularioDaOferta
            token={token}
            pedidoId={r.id}
            alcance={r.alcance}
            referencia={r.valorDePartida}
            onOferecido={(msg) => {
              setAviso(msg);
              setSeparador("atribuir");
              void carregar(true);
            }}
          />
        )}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Trabalhos CLYON por fase" className="grid grid-cols-3 gap-2 sm:flex">
          {SEPARADORES.map((s) => {
            const activo = s.id === separador;
            const n = porSeparador.get(s.id)?.length ?? 0;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={activo}
                onClick={() => setSeparador(s.id)}
                className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition sm:px-4 ${
                  activo
                    ? "border-cyan-500/60 bg-[#06B6D4]/10 text-cyan-200"
                    : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600"
                }`}
              >
                {s.rotulo} <span className="tabular-nums text-slate-400">· {n}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => void carregar()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Actualizar
        </button>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{erro}</p>
      )}
      {aviso && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {aviso}
        </p>
      )}

      {aCarregar && trabalhos.length === 0 ? (
        <p className="flex items-center gap-2 py-8 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A carregar…
        </p>
      ) : actual.length === 0 ? (
        <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-400">
          {def.vazio}
        </p>
      ) : (
        <ul className="space-y-3">
          {actual.map((t) => (
            <CartaoDoTrabalho
              key={t.pedidoId}
              t={t}
              cor={coresDosTrabalhos.get(t.pedidoId) ?? null}
              ocupado={ocupado}
              onEscolher={(n) => escolher(t, n)}
              onConfirmar={(n, semProva) => confirmar(t, n, semProva)}
              onEditar={() => setAEditar(t.pedidoId)}
              onPreco={(texto) => guardarPreco(t, texto)}
              onValor={(valor, taxa) => guardarValor(t, valor, taxa)}
              onCancelar={() => cancelar(t)}
            />
          ))}
        </ul>
      )}

      {/*
        EDITAR O PEDIDO — 07-10-2026, «deixe a opção de editar o pedido».

        O mesmo editor da Agenda e das Negociações, por cima da lista. Num
        Trabalho CLYON gravar não recomeça nada: a oferta segue com quem a
        recebeu, com o mesmo valor fixo (`recomecar-do-zero.ts`).

        Fecha pelo botão, e só pelo botão: são catorze campos e fotografias, e
        um clique ao lado não pode deitá-los fora.
      */}
      {aEditar != null && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#0B1220] p-4 sm:p-8">
          <div className="mx-auto max-w-5xl">
            <RegistarPedido
              editarId={aEditar}
              onCriado={() => void carregar(true)}
              onFechar={() => {
                setAEditar(null);
                void carregar(true);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CartaoDoTrabalho({
  t,
  cor = null,
  ocupado,
  onEscolher,
  onConfirmar,
  onEditar,
  onPreco,
  onValor,
  onCancelar,
}: {
  t: TrabalhoClyon;
  /** A cor deste trabalho na lista — contorno, faixa, fundo e título. */
  cor?: CorDoProfissional | null;
  ocupado: number | null;
  onEscolher: (n: NegociacaoDoTrabalho) => void;
  onConfirmar: (n: NegociacaoDoTrabalho, semProva: boolean) => void;
  onEditar: () => void;
  onPreco: (texto: string) => Promise<boolean>;
  onValor: (valor: string, taxa: number) => Promise<boolean>;
  onCancelar: () => void;
}) {
  const r = t.resumo;
  const a = r.atribuida;
  const dia = quando(a?.dataCombinada ?? t.dataAgendada);
  const [aMudarPreco, setAMudarPreco] = useState(false);
  const [precoEscrito, setPrecoEscrito] = useState("");
  const [aMudarValor, setAMudarValor] = useState(false);
  const [valorEscrito, setValorEscrito] = useState("");
  const [taxaEscolhida, setTaxaEscolhida] = useState<number | null>(null);
  /*
   * MUDA-SE ATÉ ESTAR FEITO — 08-10-2026. Depois de o profissional dar o
   * trabalho por feito, o dinheiro já tem dono, e o valor não se mexe aqui.
   */
  const aindaSeMuda = (["escolher", "a_espera", "sem_ninguem", "atribuida"] as FaseDaOferta[]).includes(r.fase);
  const ganhos = ganhosDe(t);
  /*
   * A PROPOSTA NO WHATSAPP DO CLIENTE — 08-10-2026. Sem preço ao cliente (um
   * antigo sem ele) ou sem telemóvel que abra no WhatsApp, não há botão; e
   * num cancelado não há proposta nenhuma a fazer.
   */
  const proposta =
    r.fase === "cancelada"
      ? null
      : linkDaPropostaClyon({ ...t, quando: a?.dataCombinada ?? t.dataAgendada }, new Date());

  return (
    <li className={`rounded-2xl border p-4 ${cor ? `border-l-4 ${cor.grupo}` : "border-slate-800 bg-slate-900/60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-base font-bold ${cor ? cor.nome : "text-white"}`}>
            #{t.pedidoId} · {maiuscula(servicoEmPalavras(t.servico))}
            {t.localidade ? <span className="font-normal text-slate-400"> · {t.localidade}</span> : null}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {[dia ? `${a?.dataCombinada ? "Dia marcado" : "Dia pedido"}: ${dia}` : "Sem dia", t.cliente, t.telefone]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${COR_DA_FASE[r.fase]}`}>
            {ROTULO_DA_FASE[r.fase]}
          </span>
          {t.taxa != null ? (
            <>
              <p className="mt-1 text-lg font-bold tabular-nums text-white">{euros(t.valorFixo)}</p>
              <p className="text-[10px] text-slate-500">
                valor sem IVA · taxa {Math.round(t.taxa * 100)} % · o pro recebe{" "}
                <span className="font-semibold text-emerald-300">{euros(ganhos)}</span>
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-lg font-bold tabular-nums text-emerald-300">{euros(t.valorFixo)}</p>
              <p className="text-[10px] text-slate-500">valor fixo · o que o pro recebe</p>
            </>
          )}
        </div>
      </div>

      {/*
        O QUE FICA PARA A CLYON. Num trabalho com taxa, sai do valor; num
        trabalho antigo (o valor era o que o pro recebia), do preço ao cliente
        escrito à parte — sem ele, a comissão da assistente conta zero aqui e o
        período dela não se pode marcar como pago.
      */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {t.taxa != null ? (
          <span className="text-slate-400">
            Fica para a CLYON <strong className="tabular-nums text-slate-200">{euros(t.valorFixo - ganhos)}</strong>
          </span>
        ) : aMudarPreco ? (
          <>
            <span className="text-slate-400">Preço ao cliente, sem IVA</span>
            <input
              inputMode="decimal"
              autoFocus
              value={precoEscrito}
              onChange={(e) => setPrecoEscrito(e.target.value)}
              placeholder="400,00"
              aria-label={`Preço ao cliente do #${t.pedidoId}, sem IVA`}
              className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm font-semibold tabular-nums text-white outline-none focus:border-cyan-500"
            />
            <span className="text-slate-400">€</span>
            <button
              onClick={async () => {
                if (await onPreco(precoEscrito)) setAMudarPreco(false);
              }}
              disabled={ocupado === t.pedidoId || precoEscrito.trim() === ""}
              className="rounded-lg bg-acao px-2.5 py-1 font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
            >
              Guardar
            </button>
            <button
              onClick={() => setAMudarPreco(false)}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </>
        ) : t.precoAoCliente != null ? (
          <>
            <span className="text-slate-400">
              Preço ao cliente{" "}
              <strong className="tabular-nums text-slate-200">{euros(t.precoAoCliente)}</strong> sem IVA
              {" · "}fica para a CLYON {euros(t.precoAoCliente - t.valorFixo)}
            </span>
            <button
              onClick={() => {
                setPrecoEscrito(t.precoAoCliente!.toFixed(2).replace(".", ","));
                setAMudarPreco(true);
              }}
              className="text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-slate-200"
            >
              mudar
            </button>
          </>
        ) : (
          <>
            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-200">
              Falta o preço ao cliente
            </span>
            <button
              onClick={() => {
                setPrecoEscrito("");
                setAMudarPreco(true);
              }}
              className="rounded-lg border border-amber-500/40 px-2.5 py-1 font-semibold text-amber-200 hover:bg-amber-500/10"
            >
              Escrever
            </button>
          </>
        )}
      </div>

      {aMudarValor && (
        <div className="mt-3 space-y-3 rounded-xl border border-cyan-900/60 bg-slate-950/60 p-3">
          <ValorETaxaDoTrabalho
            valor={valorEscrito}
            taxa={taxaEscolhida}
            onValor={setValorEscrito}
            onTaxa={setTaxaEscolhida}
          />
          {t.taxa == null && (
            <p className="rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
              Trabalho antigo: {euros(t.valorFixo)} era o que o profissional recebia. Ao gravar com uma
              taxa, o valor passa a ser o preço ao cliente, sem IVA — e o profissional recebe o que
              aparece em cima.
            </p>
          )}
          <p className="text-[11px] text-slate-400">
            {a
              ? `${a.profissional} já o tem: fica com ele se aceitar o valor novo — e é avisado. Se recusar, volta a ser oferecido aos outros.`
              : "Quem já o aceitou volta a ter de aceitar o valor novo, e é avisado por WhatsApp."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (taxaEscolhida != null && (await onValor(valorEscrito, taxaEscolhida))) setAMudarValor(false);
              }}
              disabled={ocupado === t.pedidoId || !lerValorFixo(valorEscrito).ok || taxaEscolhida == null}
              className="rounded-lg bg-acao px-3 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
            >
              Guardar valor e taxa
            </button>
            <button
              onClick={() => setAMudarValor(false)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!a && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Oferecido a {r.enviados} {r.enviados === 1 ? "profissional" : "profissionais"}
          {r.recusaram > 0 ? ` · ${r.recusaram} recusaram` : ""}
          {r.enviados === 1 && t.negociacoes[0]?.modo === "directa" ? " · se aceitar, fica com ele" : ""}
        </p>
      )}


      {r.fase === "escolher" && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold text-amber-200">
            Aceitaram — escolha quem o faz:
          </p>
          <ul className="mt-2 space-y-1.5">
            {r.interessados.map((n) => (
              <li key={n.negociacaoId} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-white">{n.profissional}</span>
                <button
                  onClick={() => onEscolher(n)}
                  disabled={ocupado != null}
                  className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-xs font-bold text-white transition hover:bg-acao-hover disabled:opacity-50"
                >
                  {ocupado === n.negociacaoId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Escolher
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.fase === "sem_ninguem" && (
        <p className="mt-2 text-xs text-red-300">
          Todos os que o receberam recusaram. Em «Alterar valor ou taxa», o valor novo volta a ser
          oferecido a eles.
        </p>
      )}

      {a && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-sm text-slate-200">
            <span className="text-slate-400">Profissional:</span> <strong className="text-white">{a.profissional}</strong>
            {a.confirmadoEm ? (
              <span className="text-slate-400"> · confirmado {quando(a.confirmadoEm)}</span>
            ) : a.execucaoEnviadaEm ? (
              <span className="text-amber-300"> · diz que está feito ({quando(a.execucaoEnviadaEm)})</span>
            ) : null}
            {a.pagoEm ? <span className="text-emerald-300"> · pago {quando(a.pagoEm)}</span> : null}
          </p>
          {!a.confirmadoEm && (
            <div className="flex flex-wrap gap-2">
              {a.execucaoEnviadaEm ? (
                <button
                  onClick={() => onConfirmar(a, false)}
                  disabled={ocupado != null}
                  className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-xs font-bold text-white transition hover:bg-acao-hover disabled:opacity-50"
                >
                  {ocupado === a.negociacaoId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Confirmar trabalho feito
                </button>
              ) : (
                <button
                  onClick={() => onConfirmar(a, true)}
                  disabled={ocupado != null}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Já está feito — confirmar
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
        {/* Um link, e não `window.open`: abre sempre, sem o browser o bloquear. */}
        {proposta && (
          <a
            href={proposta.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-600/50 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Enviar proposta ao cliente · {euros(proposta.total)}
          </a>
        )}
        <button
          onClick={onEditar}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Editar pedido
        </button>
        {aindaSeMuda && (
          <>
            <button
              onClick={() => {
                // Num trabalho antigo o valor era o que o pro recebia, e o valor
                // novo é o preço ao cliente: parte-se do preço, se o houver.
                const partida = t.taxa != null ? t.valorFixo : t.precoAoCliente;
                setValorEscrito(partida != null ? partida.toFixed(2).replace(".", ",") : "");
                setTaxaEscolhida(t.taxa);
                setAMudarValor(true);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
            >
              <Coins className="h-3.5 w-3.5" aria-hidden="true" />
              Alterar valor ou taxa
            </button>
            <button
              onClick={onCancelar}
              disabled={ocupado === t.pedidoId}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-40"
            >
              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
              Cancelar trabalho
            </button>
          </>
        )}
      </div>
    </li>
  );
}
