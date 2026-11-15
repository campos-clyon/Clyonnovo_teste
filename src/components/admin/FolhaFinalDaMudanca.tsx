"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";

/**
 * A FOLHA FINAL DA MUDANÇA, PELA EQUIPA — d38 v2, commit b (15-11-2026).
 *
 * No lugar do «Corrigir o valor» nas mudanças (Pagamentos, Carteiras, Mesa e
 * Trabalhos CLYON): horas, equipa, preço da hora, deslocação em km ou em
 * euros e o material por linhas. «Ver a conta» pergunta ao servidor (a mesma
 * conta que grava: `folha-final.ts`) e mostra, antes de gravar, o total com e
 * sem IVA, o que o profissional recebe e o que fica para a CLYON. Só depois
 * se grava; cada gravação fica no histórico. Só administradores.
 */

type Linha = { descricao: string; valor: string };

type Previa = {
  semIva: number;
  iva: number;
  total: number;
  profissional: number;
  clyon: number;
  taxa: number;
  novoModelo: null | { faturaDoParceiro: number; faturaDaClyon: number; regime: "normal" | "isento" };
};

type Entrada = {
  pessoas: 2 | 3;
  horas: number;
  precoHoraCent?: number | null;
  deslocacao: { tipo: "km"; km: number; precoKmCent?: number | null } | { tipo: "euros"; cent: number };
  materiais?: { descricao: string; cent: number }[];
};

type DoServidor = {
  pode: boolean;
  porqueNao: string | null;
  trabalhoClyon: boolean;
  jaPago: boolean;
  novoModelo: boolean;
  antes: { valorAcordado: number | null; profissional: number | null };
  tarifa: { precoHora2: number; precoHora3: number | null; minimoHoras: number; precoKm: number; kmMinimo: number } | null;
  pessoasEscolhidas: 2 | 3 | null;
  kmDoPercurso: number | null;
  ultima: { entrada: Entrada | null; previa: Previa | null; porQuem: string | null; criadaEm: string | null } | null;
  historico: {
    id: number;
    criadaEm: string | null;
    porQuem: string | null;
    valorAntes: number | null;
    valorDepois: number;
    profissionalAntes: number | null;
    profissionalDepois: number;
    jaPago: boolean;
    motivo: string | null;
  }[];
};

type Formulario = {
  pessoas: 2 | 3;
  horas: string;
  precoHora: string;
  deslocacaoTipo: "km" | "euros";
  km: string;
  precoKm: string;
  deslocacaoEuros: string;
  materiais: Linha[];
  motivo: string;
};

const eur = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(2).replace(".", ",")} €`);
const virgula = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));
const centAVirgula = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
const pct = (t: number) => `${String(Math.round(t * 10000) / 100).replace(".", ",")} %`;

const QUANDO = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formularioInicial(d: DoServidor): Formulario {
  const e = d.ultima?.entrada ?? null;
  if (e) {
    return {
      pessoas: e.pessoas,
      horas: virgula(e.horas),
      precoHora: centAVirgula(e.precoHoraCent ?? null),
      deslocacaoTipo: e.deslocacao.tipo,
      km: e.deslocacao.tipo === "km" ? virgula(e.deslocacao.km) : "",
      precoKm: e.deslocacao.tipo === "km" ? centAVirgula(e.deslocacao.precoKmCent ?? null) : "",
      deslocacaoEuros: e.deslocacao.tipo === "euros" ? centAVirgula(e.deslocacao.cent) : "",
      materiais: (e.materiais ?? []).map((m) => ({ descricao: m.descricao, valor: centAVirgula(m.cent) })),
      motivo: "",
    };
  }
  const pessoas = d.pessoasEscolhidas ?? 2;
  return {
    pessoas,
    horas: "",
    precoHora: "",
    deslocacaoTipo: d.tarifa ? "km" : "euros",
    km: virgula(d.kmDoPercurso),
    precoKm: "",
    deslocacaoEuros: "",
    materiais: [],
    motivo: "",
  };
}

export default function FolhaFinalDaMudanca({
  pedidoId,
  negociacaoId,
  onGravado,
}: {
  pedidoId: number;
  negociacaoId: number;
  onGravado?: () => void;
}) {
  const { token } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [aberto, setAberto] = useState(false);
  const [d, setD] = useState<DoServidor | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [previa, setPrevia] = useState<{ de: string; previa: Previa; acerto: { transferido: number; diferenca: number } | null } | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [gravado, setGravado] = useState("");

  const ler = useCallback(async () => {
    if (!token) return;
    setErro("");
    try {
      const res = await fetch(`/api/admin/negociacoes/horas?pedidoId=${pedidoId}&negociacaoId=${negociacaoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Não foi possível ler o trabalho.");
      const f = (j.folhaFinal ?? null) as DoServidor | null;
      setD(f);
      if (f) setForm((x) => x ?? formularioInicial(f));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o trabalho.");
    }
  }, [token, pedidoId, negociacaoId]);

  useEffect(() => {
    if (aberto && !d) void ler();
  }, [aberto, d, ler]);

  const chave = form ? JSON.stringify({ ...form, motivo: "" }) : "";
  const previaActual = previa && previa.de === chave ? previa.previa : null;

  async function enviar(previsualizar: boolean) {
    if (!token || !form) return;
    setOcupado(true);
    setErro("");
    setGravado("");
    try {
      const res = await fetch("/api/admin/negociacoes/horas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pedidoId,
          negociacaoId,
          accao: "folha_final",
          previsualizar,
          pessoas: form.pessoas,
          horas: form.horas,
          precoHora: form.precoHora,
          deslocacaoTipo: form.deslocacaoTipo,
          km: form.km,
          precoKm: form.precoKm,
          deslocacaoEuros: form.deslocacaoEuros,
          materiais: form.materiais,
          motivo: form.motivo.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.mudou) {
          setPrevia(null);
          setD(null);
        }
        throw new Error(j.error ?? "Não foi possível fazer a conta.");
      }
      setPrevia({ de: chave, previa: j.previa as Previa, acerto: (j.acerto ?? null) as { transferido: number; diferenca: number } | null });
      if (!previsualizar) {
        setGravado(`Gravado: ${eur((j.previa as Previa).semIva)} sem IVA passa a ser o valor final.`);
        setD(null);
        setPrevia(null);
        await ler();
        onGravado?.();
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível fazer a conta.");
    } finally {
      setOcupado(false);
    }
  }

  const muda = (p: Partial<Formulario>) => setForm((f) => (f ? { ...f, ...p } : f));
  const campo = "mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs tabular-nums text-white";

  return (
    <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/60 p-2.5">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
      >
        {aberto ? "Fechar a folha final" : "Folha final da mudança"}
      </button>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Horas, deslocação e material: a conta refaz o valor final. A taxa conta só sobre as horas e a deslocação.
      </p>

      {aberto && (
        <div className="mt-2 space-y-2">
          {!d && !erro && <p className="text-[11px] text-slate-400">A ler…</p>}
          {d && !d.pode && <p className="text-[11px] text-amber-300">{d.porqueNao}</p>}
          {d && d.pode && form && (
            <>
              <p className="text-[11px] text-slate-400">
                Valor de agora: {eur(d.antes.valorAcordado)} sem IVA
                {d.antes.profissional != null ? ` · o profissional recebe ${eur(d.antes.profissional)}` : ""}
                {d.ultima?.criadaEm ? ` · última folha final a ${QUANDO.format(new Date(d.ultima.criadaEm))}${d.ultima.porQuem ? `, por ${d.ultima.porQuem}` : ""}` : ""}
              </p>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <label className="text-[11px] text-slate-400">
                  Equipa
                  <select value={form.pessoas} onChange={(e) => muda({ pessoas: Number(e.target.value) === 3 ? 3 : 2 })} className={campo}>
                    <option value={2}>2 pessoas</option>
                    <option value={3}>3 pessoas</option>
                  </select>
                </label>
                <label className="text-[11px] text-slate-400">
                  Horas (6,5 ou 6:30)
                  <input value={form.horas} onChange={(e) => muda({ horas: e.target.value })} inputMode="decimal" className={campo} />
                </label>
                <label className="text-[11px] text-slate-400">
                  Preço da hora, sem IVA
                  <input
                    value={form.precoHora}
                    onChange={(e) => muda({ precoHora: e.target.value })}
                    inputMode="decimal"
                    placeholder={
                      d.tarifa
                        ? `${virgula(form.pessoas === 3 ? d.tarifa.precoHora3 : d.tarifa.precoHora2) || "—"} (tarifa)`
                        : "obrigatório"
                    }
                    className={campo}
                  />
                </label>
              </div>
              {d.tarifa && (
                <p className="text-[11px] text-slate-500">
                  Tarifa congelada: mínimo de {virgula(d.tarifa.minimoHoras)} h, {virgula(d.tarifa.precoKm)} €/km, mínimo de {d.tarifa.kmMinimo} km. Vazio = o da tarifa.
                </p>
              )}

              <fieldset className="text-[11px] text-slate-400">
                <legend>Deslocação</legend>
                <div className="mt-1 flex flex-wrap gap-3">
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={form.deslocacaoTipo === "km"} onChange={() => muda({ deslocacaoTipo: "km" })} /> em km
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={form.deslocacaoTipo === "euros"} onChange={() => muda({ deslocacaoTipo: "euros" })} /> em euros
                  </label>
                </div>
                {form.deslocacaoTipo === "km" ? (
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <label>
                      Km
                      <input value={form.km} onChange={(e) => muda({ km: e.target.value })} inputMode="decimal" className={campo} />
                    </label>
                    <label>
                      Preço do km, sem IVA
                      <input
                        value={form.precoKm}
                        onChange={(e) => muda({ precoKm: e.target.value })}
                        inputMode="decimal"
                        placeholder={d.tarifa ? `${virgula(d.tarifa.precoKm)} (tarifa)` : "obrigatório"}
                        className={campo}
                      />
                    </label>
                  </div>
                ) : (
                  <label className="mt-1 block">
                    Deslocação, sem IVA
                    <input value={form.deslocacaoEuros} onChange={(e) => muda({ deslocacaoEuros: e.target.value })} inputMode="decimal" className={campo} />
                  </label>
                )}
              </fieldset>

              <div className="text-[11px] text-slate-400">
                <p>Material (sem taxa, com IVA), sem IVA</p>
                {form.materiais.map((m, i) => (
                  <div key={i} className="mt-1 flex gap-1.5">
                    <input
                      value={m.descricao}
                      onChange={(e) => muda({ materiais: form.materiais.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)) })}
                      placeholder="ex.: 20 caixas"
                      maxLength={120}
                      className={`${campo} mt-0 flex-1`}
                    />
                    <input
                      value={m.valor}
                      onChange={(e) => muda({ materiais: form.materiais.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)) })}
                      inputMode="decimal"
                      placeholder="0,00"
                      className={`${campo} mt-0 w-24`}
                    />
                    <button
                      type="button"
                      onClick={() => muda({ materiais: form.materiais.filter((_, j) => j !== i) })}
                      className="rounded border border-slate-700 px-1.5 text-slate-400 hover:text-red-300"
                      aria-label={`Tirar a linha ${i + 1}`}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => muda({ materiais: [...form.materiais, { descricao: "", valor: "" }] })}
                  className="mt-1 flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" /> Linha de material
                </button>
              </div>

              {d.jaPago && (
                <label className="block text-[11px] text-slate-400">
                  Motivo (obrigatório — o profissional já foi pago)
                  <input
                    value={form.motivo}
                    onChange={(e) => muda({ motivo: e.target.value })}
                    maxLength={300}
                    placeholder="ex.: horas e material da folha do dia"
                    className={campo}
                  />
                </label>
              )}

              {previaActual && (
                <div className="rounded border border-slate-700 bg-slate-900/70 p-2 text-[11px] text-slate-300">
                  <p>
                    Total ao cliente <strong className="text-white">{eur(previaActual.total)}</strong> com IVA ·{" "}
                    {eur(previaActual.semIva)} sem IVA ({eur(previaActual.iva)} de IVA)
                  </p>
                  <p>
                    O profissional recebe <strong className="text-white">{eur(previaActual.profissional)}</strong> · fica para a CLYON{" "}
                    <strong className="text-white">{eur(previaActual.clyon)}</strong> (taxa de {pct(previaActual.taxa)} sobre as horas e a deslocação)
                  </p>
                  {previaActual.novoModelo && (
                    <p className="text-slate-400">
                      Modelo de 15/11: fatura do parceiro {eur(previaActual.novoModelo.faturaDoParceiro)}
                      {previaActual.novoModelo.regime === "isento" ? " (isento de IVA)" : " (com IVA)"} + fatura da CLYON{" "}
                      {eur(previaActual.novoModelo.faturaDaClyon)} (com IVA).
                    </p>
                  )}
                  {previa?.acerto && previa.acerto.diferenca !== 0 && (
                    <p className={previa.acerto.diferenca > 0 ? "text-emerald-300" : "text-amber-300"}>
                      Já se lhe transferiram {eur(previa.acerto.transferido)}.{" "}
                      {previa.acerto.diferenca > 0
                        ? `Os ${eur(previa.acerto.diferenca)} a mais ficam-lhe disponíveis na carteira (acerto da folha final do pedido #${pedidoId}).`
                        : `Recebeu ${eur(-previa.acerto.diferenca)} a mais: a diferença é para lhe cobrar.`}
                    </p>
                  )}
                  {d.antes.valorAcordado != null && (
                    <p className="text-slate-500">
                      Era {eur(d.antes.valorAcordado)} sem IVA
                      {d.antes.profissional != null ? `; o profissional recebia ${eur(d.antes.profissional)}` : ""}.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void enviar(true)}
                  disabled={ocupado || !eAdministrador}
                  title={eAdministrador ? undefined : "Só administradores"}
                  className="rounded-lg border border-cyan-700 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-40"
                >
                  Ver a conta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!previaActual) return;
                    if (window.confirm(`Gravar a folha final do #${pedidoId}?\n\n${eur(previaActual.total)} com IVA (${eur(previaActual.semIva)} sem IVA) passa a ser o valor final. O profissional recebe ${eur(previaActual.profissional)}.`)) {
                      void enviar(false);
                    }
                  }}
                  disabled={ocupado || !eAdministrador || !previaActual || (d.jaPago && !form.motivo.trim())}
                  className="flex items-center gap-1.5 rounded-lg bg-acao px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
                >
                  {ocupado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                  Gravar {previaActual ? eur(previaActual.semIva) : ""}
                </button>
              </div>

              {d.historico.length > 0 && (
                <details className="text-[11px] text-slate-400">
                  <summary className="cursor-pointer">Histórico da folha final ({d.historico.length})</summary>
                  <ul className="mt-1 space-y-1">
                    {d.historico.map((h) => (
                      <li key={h.id}>
                        {h.criadaEm ? QUANDO.format(new Date(h.criadaEm)) : "—"}
                        {h.porQuem ? `, ${h.porQuem}` : ""}: {eur(h.valorAntes)} → {eur(h.valorDepois)} sem IVA; o profissional{" "}
                        {eur(h.profissionalAntes)} → {eur(h.profissionalDepois)}
                        {h.jaPago ? " (já pago)" : ""}
                        {h.motivo ? ` — ${h.motivo}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
          {gravado && <p className="text-[11px] text-emerald-300">{gravado}</p>}
          {erro && <p className="text-[11px] text-red-300">{erro}</p>}
        </div>
      )}
    </div>
  );
}
