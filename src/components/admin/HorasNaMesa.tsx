"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import type { ResumoDasHoras } from "@/lib/horas-do-trabalho";
import { REGRA_DAS_HORAS, fimPelasHoras, intervaloDasHoras, totalDasHoras } from "@/lib/horas-do-trabalho";
import { oQueSePercebeuDasHoras } from "@/lib/horas-escritas-na-folha";
import { CampoNumerico, TextoQueCresce } from "@/components/admin/CamposCompactos";
import {
  FOLGA_DOS_KM,
  FOLHA_POR_CONFIRMAR,
  contextoDaFolha,
  folhaNoEcra,
  lerFolha,
  type CamposDaFolha,
  type ContextoCruDaFolha,
  type FolhaNoEcra,
} from "@/lib/folha-da-mudanca";
import { materiaisUsados } from "@/lib/materiais-da-proposta";
import {
  CAIXA_DO_ACORDO_DAS_PESSOAS_A_MAIS,
  PESSOAS_DA_FOLHA,
  PRECO_POR_PESSOA_A_MAIS_SEM_IVA,
  type PessoasDaFolha,
} from "@/lib/tabela-das-mudancas";

/**
 * AS HORAS DE UM TRABALHO POR HORA, NA MESA — 31-10-2026.
 *
 * Lê `GET /api/admin/negociacoes/horas`: início, fim, horas faturadas, o total
 * (sem IVA e o do cliente), os materiais usados, quem confirmou e quando, o
 * «Não concordo» do cliente, e o acerto do dinheiro — a diferença que o
 * cliente ainda paga ou o «a devolver ao cliente», que a equipa trata à mão.
 * «Confirmar as horas» e «Corrigir e confirmar» são só de administradores (a
 * rota recusa aos outros).
 */

type Resposta = {
  marcadas: boolean;
  confirmadas: boolean;
  confirmadasPor: "cliente" | "clyon" | null;
  contestadas: boolean;
  contestacao: string | null;
  estadoTexto: string | null;
  resumo: (Omit<ResumoDasHoras, "marcadasEm" | "confirmadasEm" | "contestadasEm"> & {
    marcadasEm: string | null;
    confirmadasEm: string | null;
    contestadasEm: string | null;
  }) | null;
  materiaisTexto: string | null;
  /** A folha da mudança (11-11-2026), com o que o parceiro recebe e o histórico. */
  folha: (FolhaNoEcra & { estado: string | null; historico: Array<{ quando: string; texto: string }>; marca?: string | null }) | null;
  acerto: { aPagar: number; aDevolver: number; pagoAteAgora: number; final: number; aDevolverTexto: string | null } | null;
  /** Para a equipa preencher a folha a pedido de quem fez o trabalho (d26, 15-11-2026). */
  preencher?: {
    pode: boolean;
    valorPorHora: number | null;
    dia: string;
    inicio: string;
    fim: string;
    /** Numa mudança com a lista: o contexto e os campos da app (a mesma conta, `lerFolha`). */
    folha: { contexto: ContextoCruDaFolha; campos: CamposDaFolha; regra: string } | null;
    /** Nas outras: os materiais à parte da proposta. */
    materiais: Array<{ id: string; nome: string; preco: number; unidade: string }>;
    quantidades: Record<string, number>;
  };
};

/**
 * A FOLHA PREENCHIDA PELA EQUIPA — d26, 15-11-2026. Quem fez o trabalho não usa
 * a app: a equipa escreve o que ele diz (o dia, o início e o fim — ou o total
 * de horas —, a equipa, os km e o material) e a conta é a da app, ao cêntimo:
 * `lerFolha` numa mudança com a lista, horas × valor por hora + material da
 * proposta nas outras. A rota grava com a mesma função do lado dele.
 */
type Formulario = {
  dia: string;
  inicio: string;
  fim: string;
  horas: string;
  /** 2 a 8 (d70): acima de 3, com o acordo do cliente. */
  pessoas: PessoasDaFolha;
  acordoDasPessoasAMais: boolean;
  km: string;
  motivoDosKm: string;
  materiais: Record<string, string>;
};

function corpoDoFormulario(f: Formulario, pausas: Array<{ inicio: string; fim: string }>) {
  const fim = f.fim.trim() || fimPelasHoras(f.inicio, f.horas) || "";
  return {
    dia: f.dia,
    inicio: f.inicio.trim(),
    fim,
    horas: f.fim.trim() ? undefined : f.horas.trim() || undefined,
    pessoas: f.pessoas,
    acordoDasPessoasAMais: f.pessoas > 3 ? f.acordoDasPessoasAMais : undefined,
    km: f.km,
    motivoDosKm: f.motivoDosKm,
    pausas,
    materiais: Object.fromEntries(Object.entries(f.materiais).filter(([, v]) => v.trim() !== "")),
  };
}

const campo =
  "h-8 rounded-lg border border-slate-700 bg-slate-900 px-2 text-white outline-none focus:border-cyan-600";

const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const QUANDO = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const quando = (v: string | null) => (v ? QUANDO.format(new Date(v)) : null);

export default function HorasNaMesa({
  pedidoId,
  negociacaoId,
  onMudou,
  abrirOFormulario = 0,
  onLida,
}: {
  pedidoId: number;
  negociacaoId: number;
  onMudou: () => void;
  /** Muda de valor para abrir o «Preencher a folha» (o «Já está feito» sem folha, d26). */
  abrirOFormulario?: number;
  /** Depois de cada leitura: se a folha já tem horas (para o «Já está feito» saber, d26). */
  onLida?: (marcadas: boolean) => void;
}) {
  const { token } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [r, setR] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [aEnviar, setAEnviar] = useState("");
  const [aCorrigir, setACorrigir] = useState(false);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [aPreencher, setAPreencher] = useState(false);
  const [form, setForm] = useState<Formulario | null>(null);

  function abrirPreencher(dados: Resposta | null = r) {
    const p = dados?.preencher;
    if (!p) return;
    const c = p.folha?.campos;
    setForm({
      dia: c?.dia ?? p.dia,
      inicio: c?.inicio || p.inicio,
      fim: c?.fim || p.fim,
      horas: "",
      pessoas: c?.pessoasDaFolha ?? c?.pessoas ?? 2,
      acordoDasPessoasAMais: Boolean(c?.acordoDasPessoasAMais),
      km: c?.km ?? "",
      motivoDosKm: c?.motivoDosKm ?? "",
      materiais: c
        ? { ...c.materiais }
        : Object.fromEntries(Object.entries(p.quantidades ?? {}).map(([k, v]) => [k, String(v).replace(".", ",")])),
    });
    setAPreencher(true);
  }

  useEffect(() => {
    if (abrirOFormulario > 0) abrirPreencher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirOFormulario]);

  /** A conta, antes de gravar — a mesma da app (d26). */
  const previa = useMemo(() => {
    const p = r?.preencher;
    if (!form || !p) return null;
    const corpo = corpoDoFormulario(form, p.folha?.campos.pausas ?? []);
    if (p.folha) {
      const ctx = contextoDaFolha(p.folha.contexto);
      if (!ctx) return { erro: "A tarifa deste trabalho não se leu." };
      const lida = lerFolha(corpo, ctx);
      if (!lida.ok) return { erro: lida.erro };
      const ecra = folhaNoEcra(lida.folha, "parceiro", ctx.tarifa.minimoHoras);
      return { texto: `${ecra.totalTexto}${ecra.recebeTexto ? ` · ${ecra.recebeTexto}` : ""}`, linhas: ecra.linhas };
    }
    const lido = intervaloDasHoras({ dia: form.dia, inicio: corpo.inicio, fim: corpo.fim });
    if (!lido.ok) return { erro: lido.erro };
    if (p.valorPorHora == null || p.valorPorHora <= 0) return { erro: "Este trabalho não tem valor por hora acordado." };
    const quantidades: Record<string, number> = {};
    for (const [k, v] of Object.entries(corpo.materiais)) {
      const n = Number(String(v).replace(",", "."));
      if (Number.isFinite(n) && n > 0) quantidades[k] = n;
    }
    const usados = materiaisUsados({ incluidos: false, itens: p.materiais } as never, quantidades);
    const total = totalDasHoras(p.valorPorHora, lido.intervalo.horasFaturadas, usados.total);
    return {
      texto:
        `${String(lido.intervalo.horasFaturadas).replace(".", ",")} h × ${eur(p.valorPorHora)}/h` +
        (usados.total > 0 ? ` + material ${eur(usados.total)}` : "") +
        ` = ${eur(total)} sem IVA`,
      linhas: null,
    };
  }, [form, r]);

  async function preencher() {
    if (!token || !form || !r?.preencher) return;
    const corpo = corpoDoFormulario(form, r.preencher.folha?.campos.pausas ?? []);
    if (!window.confirm(`Gravar a folha a pedido do profissional?${previa && "texto" in previa ? `\n\n${previa.texto}` : ""}\n\nO cliente valida-a como sempre.`)) return;
    setAEnviar("preencher");
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/horas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId, negociacaoId, accao: "preencher", ...corpo }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) return setErro(dados.error ?? "Não foi possível gravar a folha.");
      setAPreencher(false);
      await ler();
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar("");
    }
  }

  async function validarPorTelefone() {
    if (!token) return;
    if (!window.confirm("O cliente validou esta folha por telefone? Fica registado no histórico com o seu nome, e o total passa a ser o valor do trabalho.")) return;
    setAEnviar("telefone");
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/horas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId, negociacaoId, accao: "validar_telefone", ...(r?.folha?.marca ? { marcaDaFolha: r.folha.marca } : {}) }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível gravar.");
        if (dados.folhaMudou) await ler();
        return;
      }
      await ler();
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar("");
    }
  }

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/negociacoes/horas?pedidoId=${pedidoId}&negociacaoId=${negociacaoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) return setErro(dados.error ?? "Não foi possível ler as horas.");
      setR(dados as Resposta);
      setInicio((dados as Resposta).resumo?.inicio ?? "");
      setFim((dados as Resposta).resumo?.fim ?? "");
      onLida?.(Boolean((dados as Resposta).marcadas));
    } catch {
      setErro("Erro de rede.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, pedidoId, negociacaoId]);

  useEffect(() => {
    void ler();
  }, [ler]);

  async function agir(accao: "confirmar" | "corrigir") {
    if (!token) return;
    const pergunta =
      accao === "confirmar"
        ? "Confirmar estas horas pela CLYON? O total passa a ser o valor do trabalho."
        : `Gravar das ${inicio} às ${fim} e confirmar pela CLYON? O total passa a ser o valor do trabalho.`;
    if (!window.confirm(pergunta)) return;
    setAEnviar(accao);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/horas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        // Os materiais usados ficam como ele os marcou (sem eles, a rota apagava-os).
        body: JSON.stringify({
          pedidoId,
          negociacaoId,
          accao,
          inicio,
          fim,
          // A folha que a equipa tem no ecrã (11-11-2026): se o parceiro a corrigiu entretanto, não se confirma às cegas.
          ...(accao === "confirmar" && r?.folha?.marca ? { marcaDaFolha: r.folha.marca } : {}),
          // Numa folha da mudança o material fica como o parceiro o pôs na folha.
          ...(r?.folha ? {} : { materiais: Object.fromEntries((r?.resumo?.materiais ?? []).map((l) => [l.id, l.quantidade])) }),
        }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível gravar.");
        // A folha mudou entretanto: mostra-se a nova.
        if (dados.folhaMudou) await ler();
        return;
      }
      setACorrigir(false);
      await ler();
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar("");
    }
  }

  /*
   * O FORMULÁRIO DA EQUIPA (d26) — os campos que a app mostra a quem fez o
   * trabalho, com a conta dela antes de gravar.
   */
  const formulario =
    aPreencher && form && r?.preencher ? (
      <div className="mt-2 rounded-lg border border-cyan-900/60 p-2">
        <p className="font-semibold text-cyan-300">Preencher a folha a pedido do profissional</p>
        <div className="mt-1.5 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-0.5 text-slate-400">
            Dia
            <input type="date" value={form.dia} onChange={(e) => setForm({ ...form, dia: e.target.value })} className={campo} />
          </label>
          <label className="flex flex-col gap-0.5 text-slate-400">
            Início
            <input value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} placeholder="09:00" inputMode="numeric" className={`${campo} w-20`} />
          </label>
          <label className="flex flex-col gap-0.5 text-slate-400">
            Fim
            <input value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} placeholder="13:00" inputMode="numeric" className={`${campo} w-20`} />
          </label>
          <label className="flex flex-col gap-0.5 text-slate-400">
            ou total de horas
            <CampoNumerico
              valor={form.horas}
              muda={(v) => setForm({ ...form, horas: v, fim: v.trim() ? "" : form.fim })}
              unidade="h"
              placeholder="4h30"
              decimal={false}
            />
            {(() => {
              // d49: «4h30» também, e diz o que percebeu («4 h 30 min»).
              const lido = oQueSePercebeuDasHoras(form.horas);
              return lido ? <span className={lido.ok ? "text-emerald-300" : "text-amber-300"}>{lido.texto}</span> : null;
            })()}
          </label>
          {r.preencher.folha && (
            <>
              <label className="flex flex-col gap-0.5 text-slate-400">
                Equipa
                <select
                  value={form.pessoas}
                  onChange={(e) => setForm({ ...form, pessoas: Number(e.target.value) as PessoasDaFolha })}
                  className={campo}
                >
                  <option value={2}>2 pessoas</option>
                  {r.preencher.folha.campos.podeTres &&
                    PESSOAS_DA_FOLHA.filter((n) => n >= 3 && n <= (r.preencher!.folha!.campos.pessoasMaximas ?? 3)).map((n) => (
                      <option key={n} value={n}>
                        {n} pessoas
                      </option>
                    ))}
                </select>
              </label>
              {form.pessoas > 3 && (
                <label className="flex basis-full items-start gap-1.5 text-amber-300">
                  <input
                    type="checkbox"
                    checked={form.acordoDasPessoasAMais}
                    onChange={(e) => setForm({ ...form, acordoDasPessoasAMais: e.target.checked })}
                    className="mt-0.5"
                  />
                  <span>
                    {CAIXA_DO_ACORDO_DAS_PESSOAS_A_MAIS} (+{eur(PRECO_POR_PESSOA_A_MAIS_SEM_IVA)}/h sem IVA por cada pessoa acima de 3; fica registado quem e quando)
                  </span>
                </label>
              )}
              <label className="flex flex-col gap-0.5 text-slate-400">
                Km (ida e volta)
                <CampoNumerico valor={form.km} muda={(v) => setForm({ ...form, km: v })} unidade="km" />
              </label>
            </>
          )}
        </div>
        {r.preencher.folha &&
          r.preencher.folha.campos.kmDoPercurso != null &&
          Math.abs(Number(form.km.replace(",", ".")) - r.preencher.folha.campos.kmDoPercurso) >= FOLGA_DOS_KM && (
            <label className="mt-1.5 flex flex-col gap-0.5 text-slate-400">
              Porque os km são diferentes dos do percurso ({String(r.preencher.folha.campos.kmDoPercurso).replace(".", ",")} km)?
              <TextoQueCresce valor={form.motivoDosKm} muda={(v) => setForm({ ...form, motivoDosKm: v })} maxLength={300} />
            </label>
          )}
        {(() => {
          const lista = r.preencher.folha
            ? r.preencher.folha.campos.materiaisDisponiveis.map((m) => ({ id: m.quantidade, nome: m.nome, preco: m.precoTexto }))
            : r.preencher.materiais.map((m) => ({ id: m.id, nome: m.nome, preco: `${eur(m.preco)}/${m.unidade}` }));
          if (lista.length === 0) return null;
          return (
            <div className="mt-1.5 flex flex-wrap items-end gap-2">
              {lista.map((m) => (
                <label key={m.id} className="flex flex-col gap-0.5 text-slate-400">
                  {m.nome} ({m.preco})
                  <CampoNumerico
                    valor={form.materiais[m.id] ?? ""}
                    muda={(v) => setForm({ ...form, materiais: { ...form.materiais, [m.id]: v } })}
                    placeholder="0"
                  />
                </label>
              ))}
            </div>
          );
        })()}
        {r.preencher.folha && r.preencher.folha.campos.pausas.length > 0 && (
          <p className="mt-1 text-slate-500">
            As pausas que ele marcou ficam: {r.preencher.folha.campos.pausas.map((p) => `${p.inicio}–${p.fim}`).join(", ")}.
          </p>
        )}
        <p className="mt-1 text-slate-500">
          {r.preencher.folha
            ? `${r.preencher.folha.regra} O material leva IVA e não leva taxa. Os andares não entram na folha (como na app).`
            : `${REGRA_DAS_HORAS} A conta é a da app: horas × valor por hora + material da proposta; os km e os andares não se somam neste trabalho.`}
        </p>
        {previa && "erro" in previa ? (
          <p className="mt-1 text-amber-200">{previa.erro}</p>
        ) : previa ? (
          <>
            <p className="mt-1 font-semibold text-emerald-300">{previa.texto}</p>
            {previa.linhas && (
              <dl className="mt-1 space-y-0.5">
                {previa.linhas.map((l, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <dt className={l.forte ? "font-semibold text-slate-100" : "text-slate-400"}>
                      {l.rotulo}
                      {l.nota ? <span className="text-slate-500"> — {l.nota}</span> : null}
                    </dt>
                    <dd className={`tabular-nums ${l.forte ? "font-semibold text-slate-100" : "text-slate-300"}`}>{l.valor}</dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void preencher()}
            disabled={aEnviar !== "" || !eAdministrador || !previa || "erro" in previa}
            title={eAdministrador ? undefined : "Só administradores"}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {aEnviar === "preencher" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            Gravar a folha
          </button>
          <button
            type="button"
            onClick={() => setAPreencher(false)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </button>
        </div>
      </div>
    ) : null;

  const botaoPreencher = (rotulo: string) =>
    r?.preencher?.pode && !aPreencher ? (
      <button
        type="button"
        onClick={() => abrirPreencher()}
        disabled={!eAdministrador}
        title={eAdministrador ? undefined : "Só administradores"}
        className="rounded-lg border border-cyan-700 px-3 py-1.5 font-semibold text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-40"
      >
        {rotulo}
      </button>
    ) : null;

  // AINDA SEM HORAS (d26): o quadro aparece na mesma, com o «Preencher a folha».
  if (r && (!r.marcadas || !r.resumo)) {
    if (!r.preencher?.pode) return erro ? <p className="mt-2 text-xs text-red-300">{erro}</p> : null;
    return (
      <section aria-label="Folha do trabalho" className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
        <p className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-cyan-300">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Folha do trabalho
        </p>
        <p className="mt-1.5 text-amber-200">
          Ainda sem horas. Se o profissional não usa a app, preencha a folha a pedido dele: o cliente valida-a como sempre.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">{botaoPreencher("Preencher a folha")}</div>
        {formulario}
        {erro && <p className="mt-1.5 text-red-300">{erro}</p>}
      </section>
    );
  }
  if (!r || !r.resumo) {
    return erro ? <p className="mt-2 text-xs text-red-300">{erro}</p> : null;
  }
  const h = r.resumo;
  return (
    <section
      aria-label="Folha do trabalho"
      className={`mt-3 rounded-xl border p-3 text-xs ${
        r.contestadas ? "border-red-500/50 bg-red-500/10" : "border-cyan-900/60 bg-slate-950/60"
      }`}
    >
      <p className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-cyan-300">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        Folha do trabalho
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <div>
          <dt className="text-slate-500">Início</dt>
          <dd className="font-semibold tabular-nums text-slate-100">{h.inicio}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Fim</dt>
          <dd className="font-semibold tabular-nums text-slate-100">
            {h.fim}
            {h.passaDaMeiaNoite ? " (dia seguinte)" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Horas faturadas</dt>
          <dd className="font-semibold tabular-nums text-slate-100">{String(h.horas).replace(".", ",")} h</dd>
        </div>
        <div>
          <dt className="text-slate-500">Total</dt>
          <dd className="font-semibold tabular-nums text-emerald-300">
            {eur(h.total)} sem IVA · cliente {eur(h.cliente.total)} com IVA
          </dd>
        </div>
      </dl>
      <p className="mt-1.5 text-slate-400">{r.folha ? r.folha.resumo : h.textoParaAEquipa}</p>
      {/* A FOLHA DA MUDANÇA (11-11-2026): em degraus, como o parceiro a vê, e o histórico de cada edição. */}
      {r.folha && (
        <div className="mt-2 rounded-lg border border-cyan-900/60 p-2">
          <p className="font-semibold text-cyan-300">
            {r.folha.titulo}
            {r.folha.estado === "por_confirmar" ? ` — ${FOLHA_POR_CONFIRMAR}` : ""}
          </p>
          <dl className="mt-1 space-y-0.5">
            {r.folha.linhas.map((l, i) => (
              <div key={i} className="flex justify-between gap-3">
                <dt className={l.forte ? "font-semibold text-slate-100" : "text-slate-400"}>
                  {l.rotulo}
                  {l.nota ? <span className="text-slate-500"> — {l.nota}</span> : null}
                </dt>
                <dd className={`tabular-nums ${l.forte ? "font-semibold text-slate-100" : "text-slate-300"}`}>{l.valor}</dd>
              </div>
            ))}
          </dl>
          {r.folha.avisoDaEquipa && <p className="mt-1 text-amber-200">{r.folha.avisoDaEquipa}</p>}
          {r.folha.historico.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-slate-500">
              {r.folha.historico.map((e, i) => (
                <li key={i}>
                  {e.quando} — {e.texto}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {h.materiais.length > 0 && (
        <p className="mt-1 text-slate-400">
          Materiais usados: {h.materiais.map((l) => `${l.quantidade} × ${l.nome} (${eur(l.total)})`).join(", ")}
        </p>
      )}
      {r.materiaisTexto && <p className="mt-1 text-slate-500">Na proposta: {r.materiaisTexto}</p>}
      <p className="mt-1 text-slate-500">
        Marcadas {quando(h.marcadasEm) ?? "—"}.{" "}
        {h.confirmadas
          ? `Confirmadas ${h.confirmadasPor === "clyon" ? "pela CLYON" : "pelo cliente"} a ${quando(h.confirmadasEm) ?? "—"}.`
          : "Por confirmar."}{" "}
        {REGRA_DAS_HORAS}
      </p>
      {r.contestadas && (
        <p className="mt-1.5 rounded-md bg-red-500/15 px-2 py-1 font-semibold text-red-200">
          Horas contestadas pelo cliente{h.contestacao ? `: «${h.contestacao}»` : ""}
          {h.contestadasEm ? ` (${quando(h.contestadasEm)})` : ""}. Fale com os dois e corrija ou confirme.
        </p>
      )}
      {r.acerto && r.acerto.aPagar > 0 && (
        <p className="mt-1.5 font-semibold text-amber-200">
          O cliente pagou {eur(r.acerto.pagoAteAgora)}; falta a diferença das horas: {eur(r.acerto.aPagar)} (o cliente paga-a no pedido).
        </p>
      )}
      {r.acerto?.aDevolverTexto && (
        <p className="mt-1.5 rounded-md bg-amber-500/15 px-2 py-1 font-semibold text-amber-100">
          {r.acerto.aDevolverTexto} — o cliente pagou {eur(r.acerto.pagoAteAgora)} e as horas deram {eur(r.acerto.final)}. Devolver à mão.
        </p>
      )}
      {!r.confirmadas && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void agir("confirmar")}
            disabled={aEnviar !== ""}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {aEnviar === "confirmar" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            Confirmar as horas
          </button>
          {aCorrigir ? (
            <>
              <label className="flex items-center gap-1 text-slate-400">
                Início
                <input
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  placeholder="09:00"
                  inputMode="numeric"
                  className="h-8 w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 text-white outline-none focus:border-cyan-600"
                />
              </label>
              <label className="flex items-center gap-1 text-slate-400">
                Fim
                <input
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  placeholder="13:00"
                  inputMode="numeric"
                  className="h-8 w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 text-white outline-none focus:border-cyan-600"
                />
              </label>
              <button
                type="button"
                onClick={() => void agir("corrigir")}
                disabled={aEnviar !== "" || !inicio || !fim}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-700 px-3 py-1.5 font-semibold text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-40"
              >
                {aEnviar === "corrigir" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                Corrigir e confirmar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setACorrigir(true)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-300 hover:bg-slate-800"
            >
              Corrigir e confirmar
            </button>
          )}
          {/* O cliente não usa a app e validou ao telefone (d26): confirma-se em nome dele, com quem o registou. */}
          <button
            type="button"
            onClick={() => void validarPorTelefone()}
            disabled={aEnviar !== "" || !eAdministrador}
            title={eAdministrador ? undefined : "Só administradores"}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-700 px-3 py-1.5 font-semibold text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-40"
          >
            {aEnviar === "telefone" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            Validada pelo cliente por telefone
          </button>
          {botaoPreencher("Corrigir a folha (sem confirmar)")}
        </div>
      )}
      {formulario}
      {erro && <p className="mt-1.5 text-red-300">{erro}</p>}
    </section>
  );
}
