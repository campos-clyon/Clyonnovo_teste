"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Loader2, Plus, X } from "lucide-react";
import {
  BOTAO_AGORA,
  BOTAO_MAIS_PAUSA,
  CORRIGIR_A_FOLHA,
  ENVIAR_A_FOLHA,
  MAXIMO_DE_PAUSAS,
  TITULO_DA_FOLHA,
  contextoDaFolha,
  folhaNoEcra,
  lerFolha,
  type FolhaNoEcra,
} from "@/lib/folha-da-mudanca";
import { HORA_DE_FIM, HORA_DE_INICIO, agoraNoCampo } from "@/lib/horas-do-trabalho";
import type { QuantidadeDoMaterial } from "@/lib/conta-da-mudanca";
import type { Pedido } from "./tipos";

/**
 * A FOLHA DA MUDANÇA, NO PAINEL — 11-11-2026 (ordem do CEO com o sim do dono).
 *
 * Numa mudança com a lista de parceiros, em vez das horas simples: a hora de
 * início e a de fim (escritas à mão, ou «Agora»), as pausas («+ Pausa»), a
 * equipa, os km (já com os do percurso — corrigir pede o motivo) e o material
 * pelas unidades da tarifa dele. O valor faz-se aqui com a MESMA conta do site
 * (`lerFolha`, folha-da-mudanca.ts) antes de enviar; o site refaz e grava. O
 * cliente confirma — a folha nunca se confirma sozinha.
 */
export function FolhaDaMudanca({ pedido, onGravou }: { pedido: Pedido; onGravou: () => void }) {
  const h = pedido.porHora!;
  const f = h.folha!;
  const c = f.campos;
  const [inicio, setInicio] = useState(c.inicio);
  const [fim, setFim] = useState(c.fim);
  const [pausas, setPausas] = useState<Array<{ inicio: string; fim: string }>>(c.pausas);
  const [pessoas, setPessoas] = useState<2 | 3>(c.pessoas);
  const [km, setKm] = useState(c.km);
  const [motivoDosKm, setMotivoDosKm] = useState(c.motivoDosKm);
  const [materiais, setMateriais] = useState<Partial<Record<QuantidadeDoMaterial, string>>>(c.materiais);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const editavel = h.podeMarcar;

  const corpo = { dia: c.dia, inicio, fim, pausas, pessoas, km, motivoDosKm, materiais };
  const previsao: { ecra: FolhaNoEcra | null; erro: string | null } = useMemo(() => {
    const ctx = contextoDaFolha(f.contexto);
    if (!ctx || !inicio || !fim) return { ecra: null, erro: null };
    const r = lerFolha(corpo, ctx);
    return r.ok ? { ecra: folhaNoEcra(r.folha, "parceiro", ctx.tarifa.minimoHoras), erro: null } : { ecra: null, erro: r.erro };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fim, pausas, pessoas, km, motivoDosKm, materiais, f.contexto]);

  const kmDiferentes = c.kmDoPercurso != null && Math.abs(Number(km.replace(",", ".")) - c.kmDoPercurso) >= 0.5;
  const mostrar = editavel ? previsao.ecra : f.enviada;

  async function enviar() {
    setAEnviar(true);
    setErro("");
    setMensagem("");
    try {
      const res = await fetch("/api/profissionais/trabalho/horas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negociacaoId: pedido.negociacaoId, ...corpo }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível enviar a folha.");
        return;
      }
      setMensagem(typeof dados.mensagem === "string" ? dados.mensagem : "");
      onGravou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  const hora = (rotulo: string, valor: string, mudar: (v: string) => void) => (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{rotulo}</span>
      <div className="flex gap-1.5">
        <input
          type="time"
          value={valor}
          disabled={!editavel}
          onChange={(e) => mudar(e.target.value)}
          className="min-h-[48px] w-full rounded-xl border-2 border-cyan-200 bg-white px-3 text-lg font-semibold text-slate-900 outline-none focus:border-cyan-500 disabled:opacity-60"
        />
        {editavel && (
          <button
            type="button"
            onClick={() => mudar(agoraNoCampo())}
            className="shrink-0 rounded-xl border-2 border-cyan-200 bg-white px-2.5 text-sm font-bold text-cyan-900"
          >
            {BOTAO_AGORA}
          </button>
        )}
      </div>
    </label>
  );

  return (
    <section className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
      <h2 className="flex items-center gap-2 text-base font-bold text-cyan-900">
        <ClipboardList className="h-5 w-5" aria-hidden="true" />
        {TITULO_DA_FOLHA}
      </h2>
      {f.estadoTexto && (
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold ${
            f.estado === "contestada" ? "border border-amber-300 bg-amber-50 text-amber-900" : "bg-white/70 text-cyan-900"
          }`}
        >
          {f.estadoTexto}
        </p>
      )}

      {editavel && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-3">
            {hora(HORA_DE_INICIO, inicio, setInicio)}
            {hora(HORA_DE_FIM, fim, setFim)}
          </div>

          {pausas.map((p, i) => (
            <div key={i} className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500">Pausa {i + 1}: início</span>
                <input
                  type="time"
                  value={p.inicio}
                  onChange={(e) => setPausas(pausas.map((x, k) => (k === i ? { ...x, inicio: e.target.value } : x)))}
                  className="min-h-[44px] rounded-xl border-2 border-cyan-200 bg-white px-3 font-semibold text-slate-900"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500">fim</span>
                <input
                  type="time"
                  value={p.fim}
                  onChange={(e) => setPausas(pausas.map((x, k) => (k === i ? { ...x, fim: e.target.value } : x)))}
                  className="min-h-[44px] rounded-xl border-2 border-cyan-200 bg-white px-3 font-semibold text-slate-900"
                />
              </label>
              <button
                type="button"
                onClick={() => setPausas(pausas.filter((_, k) => k !== i))}
                aria-label={`Tirar a pausa ${i + 1}`}
                className="mb-1 rounded-lg p-2 text-slate-500"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          ))}
          {pausas.length < MAXIMO_DE_PAUSAS && (
            <button
              type="button"
              onClick={() => setPausas([...pausas, { inicio: "", fim: "" }])}
              className="flex items-center gap-1 text-sm font-bold text-cyan-900"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {BOTAO_MAIS_PAUSA}
            </button>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Equipa</p>
            <div className="mt-1 flex gap-2">
              {([2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={n === 3 && !c.podeTres}
                  onClick={() => setPessoas(n)}
                  className={`min-h-[44px] flex-1 rounded-xl border-2 text-sm font-bold disabled:opacity-40 ${
                    pessoas === n ? "border-cyan-600 bg-white text-cyan-900" : "border-cyan-200 bg-white/60 text-slate-700"
                  }`}
                >
                  {n} pessoas{n === c.pessoasEscolhidas ? " (a escolhida)" : ""}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Km{c.kmDoPercurso != null ? ` (o percurso dá ${String(c.kmDoPercurso).replace(".", ",")} km)` : ""}
            </span>
            <input
              inputMode="decimal"
              value={km}
              onChange={(e) => setKm(e.target.value.replace(/[^\d,.]/g, ""))}
              className="min-h-[44px] w-32 rounded-xl border-2 border-cyan-200 bg-white px-3 text-right font-semibold text-slate-900"
            />
          </label>
          {kmDiferentes && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-600">Porque são diferentes do percurso?</span>
              <input
                value={motivoDosKm}
                maxLength={300}
                onChange={(e) => setMotivoDosKm(e.target.value)}
                className="min-h-[44px] rounded-xl border-2 border-cyan-200 bg-white px-3 text-sm text-slate-900"
              />
            </label>
          )}

          {c.materiaisDisponiveis.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-cyan-900">Material que forneceu</p>
              {c.materiaisDisponiveis.map((m) => (
                <label key={m.quantidade} className="flex items-center justify-between gap-3 text-sm text-slate-800">
                  <span>
                    {m.nome} <span className="text-slate-500">({m.precoTexto})</span>
                  </span>
                  <input
                    inputMode={m.decimal ? "decimal" : "numeric"}
                    value={materiais[m.quantidade] ?? ""}
                    onChange={(e) =>
                      setMateriais({ ...materiais, [m.quantidade]: e.target.value.replace(m.decimal ? /[^\d,.]/g : /[^\d]/g, "") })
                    }
                    placeholder="0"
                    aria-label={`Quantidade de ${m.nome}`}
                    className="w-20 rounded-lg border border-cyan-200 bg-white px-2 py-1.5 text-right font-semibold text-slate-900"
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {mostrar && <ResumoDaFolha folha={mostrar} />}
      {editavel && previsao.erro && <p className="mt-2 text-sm text-amber-800">{previsao.erro}</p>}
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      {mensagem && <p className="mt-2 text-sm font-semibold text-emerald-800">{mensagem}</p>}
      {editavel && (
        <button
          onClick={enviar}
          disabled={aEnviar || !previsao.ecra}
          className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-acao text-base font-bold text-white transition active:bg-acao-hover disabled:opacity-40"
        >
          {aEnviar && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          {h.marcadas ? CORRIGIR_A_FOLHA : ENVIAR_A_FOLHA}
        </button>
      )}
      <p className="mt-2 text-xs text-cyan-800">{f.regra}</p>
      {f.historico.length > 0 && (
        <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold">Histórico da folha</summary>
          <ul className="mt-1 space-y-1">
            {f.historico.map((e, i) => (
              <li key={i}>
                <span className="font-semibold">{e.quando}</span> — {e.texto}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function ResumoDaFolha({ folha }: { folha: FolhaNoEcra }) {
  return (
    <div className="mt-3 rounded-xl bg-white p-3">
      <dl className="space-y-1.5 text-sm">
        {folha.linhas.map((l, i) => (
          <div key={i} className="flex items-start justify-between gap-3">
            <dt className={l.forte ? "font-bold text-slate-900" : "text-slate-700"}>
              {l.rotulo}
              {l.nota && <span className="block text-xs font-normal text-slate-500">{l.nota}</span>}
            </dt>
            <dd className={`shrink-0 text-right ${l.forte ? "font-bold text-slate-900" : "text-slate-800"}`}>{l.valor}</dd>
          </div>
        ))}
      </dl>
      {folha.avisoDaEquipa && <p className="mt-2 text-xs font-semibold text-amber-800">{folha.avisoDaEquipa}</p>}
    </div>
  );
}
