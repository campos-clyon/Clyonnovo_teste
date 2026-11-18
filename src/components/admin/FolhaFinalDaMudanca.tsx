"use client";

import { diaEmLisboa, horaEmLisboa } from "@/lib/hora-de-lisboa";
import { horasDoDia, horasEmPalavrasCurtas, lerDiaReal, type DiaReal } from "@/lib/registo-real";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import EnviarValorFinalAoCliente from "@/components/admin/EnviarValorFinalAoCliente";
import { oQueSePercebeuDasHoras } from "@/lib/horas-escritas-na-folha";
import { CampoNumerico, TextoQueCresce } from "@/components/admin/CamposCompactos";
import {
  CAIXA_DO_ACORDO_DAS_PESSOAS_A_MAIS,
  PESSOAS_DA_FOLHA,
  PRECO_POR_PESSOA_A_MAIS_SEM_IVA,
  pessoasAMais,
  precoDaHoraParaPessoas,
  type AcordoDasPessoasAMais,
  type PessoasDaFolha,
} from "@/lib/tabela-das-mudancas";

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
  pessoas: PessoasDaFolha;
  acordoDasPessoasAMais?: AcordoDasPessoasAMais | null;
  horas: number;
  precoHoraCent?: number | null;
  deslocacao: { tipo: "km"; km: number; precoKmCent?: number | null } | { tipo: "euros"; cent: number };
  materiais?: { descricao: string; cent: number }[];
  /** d67: o registo real da folha (início, fim e pausa por dia). */
  registoReal?: DiaReal[];
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
  /** 2 a 8 (d70): acima de 3, o preço da hora escrito é o da equipa de 3 e cada pessoa a mais soma-se. */
  pessoas: PessoasDaFolha;
  acordoDasPessoasAMais: boolean;
  horas: string;
  /** d67: por dia, o início, o fim e a pausa (hora de Lisboa). */
  dias: { dia: string; inicio: string; fim: string; pausa: string }[];
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
      acordoDasPessoasAMais: Boolean(e.acordoDasPessoasAMais),
      horas: virgula(e.horas),
      // Folhas antigas (só horas): ficam as horas, e os dias por escrever.
      dias: (e.registoReal ?? []).map((x) => ({ dia: x.dia, inicio: horaEmLisboa(new Date(x.inicio)), fim: horaEmLisboa(new Date(x.fim)), pausa: x.pausaMin ? String(x.pausaMin) : "" })),
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
    acordoDasPessoasAMais: false,
    horas: "",
    dias: [{ dia: diaEmLisboa(new Date()), inicio: "", fim: "", pausa: "" }],
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
  comEnvioAoCliente = true,
}: {
  pedidoId: number;
  negociacaoId: number;
  onGravado?: () => void;
  /** «Enviar o valor final ao cliente» (d38 v2, commit d): nos Pagamentos, na Mesa e nos Trabalhos CLYON. */
  comEnvioAoCliente?: boolean;
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
          acordoDasPessoasAMais: form.pessoas > 3 ? form.acordoDasPessoasAMais : undefined,
          horas: form.horas,
          // d67: com os dias escritos, as horas calculam-se no servidor (fim − início − pausa).
          registoReal: form.dias.some((x) => x.inicio.trim() || x.fim.trim()) ? form.dias.filter((x) => x.inicio.trim() || x.fim.trim()) : undefined,
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
  // A linha do material (d49): campos próprios, sem larguras em conflito com o «w-full» de cima.
  const campoDoNome = "mt-1 block w-full min-w-0 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white";

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

              {/*
                COMPACTO — d49 (dono, 16-11-2026): os números em campos estreitos
                (até 7 algarismos, a unidade à direita), lado a lado; no telemóvel
                empilham em duas colunas.
              */}
              <div className="grid grid-cols-2 items-start gap-x-3 gap-y-2 text-[11px] text-slate-400 sm:flex sm:flex-wrap">
                <label className="block">
                  Equipa
                  <select value={form.pessoas} onChange={(e) => muda({ pessoas: Number(e.target.value) as PessoasDaFolha })} className="mt-1 block rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white">
                    {PESSOAS_DA_FOLHA.map((n) => (
                      <option key={n} value={n}>
                        {n} pessoas
                      </option>
                    ))}
                  </select>
                </label>
                {/* d67: em vez de «Horas», o início, o fim e a pausa de cada dia — as horas calculam-se. */}
                <div className="block sm:col-span-2">
                  Início, fim e pausa (hora de Lisboa)
                  {form.dias.map((x, i) => {
                    const lido = lerDiaReal(x);
                    const mudaDia = (m: Partial<typeof x>) => muda({ dias: form.dias.map((y, k) => (k === i ? { ...y, ...m } : y)) });
                    return (
                      <div key={i} className="mt-1 flex flex-wrap items-center gap-1">
                        <input type="date" value={x.dia} onChange={(e) => mudaDia({ dia: e.target.value })} className="rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white" aria-label={`Dia ${i + 1}`} />
                        <input placeholder="13:00" value={x.inicio} onChange={(e) => mudaDia({ inicio: e.target.value })} className="w-16 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white" aria-label={`Início do dia ${i + 1}`} />
                        <input placeholder="19:00" value={x.fim} onChange={(e) => mudaDia({ fim: e.target.value })} className="w-16 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white" aria-label={`Fim do dia ${i + 1}`} />
                        <input placeholder="pausa 1 h" value={x.pausa} onChange={(e) => mudaDia({ pausa: e.target.value })} className="w-20 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white" aria-label={`Pausa do dia ${i + 1}`} />
                        <span className={lido.ok ? "text-emerald-300" : "text-slate-500"}>{lido.ok ? `→ ${horasEmPalavrasCurtas(horasDoDia(lido.dia))}` : ""}</span>
                        {form.dias.length > 1 && (
                          <button type="button" onClick={() => muda({ dias: form.dias.filter((_, k) => k !== i) })} className="underline">
                            tirar
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => muda({ dias: [...form.dias, { dia: "", inicio: "", fim: "", pausa: "" }] })} className="mt-1 underline">
                    acrescentar um dia
                  </button>
                  {/* Folhas antigas: só as horas, quando não há início e fim. */}
                  {!form.dias.some((x) => x.inicio.trim() || x.fim.trim()) && (
                    <label className="mt-1 block">
                      Ou só as horas (folha antiga)
                      <CampoNumerico valor={form.horas} muda={(v) => muda({ horas: v })} unidade="h" placeholder="6h30" decimal={false} />
                      {(() => {
                        const p = oQueSePercebeuDasHoras(form.horas);
                        return p ? <span className={`mt-0.5 block ${p.ok ? "text-emerald-300" : "text-amber-300"}`}>{p.texto}</span> : null;
                      })()}
                    </label>
                  )}
                </div>
                <label className="block">
                  {form.pessoas > 3 ? "Preço/hora da equipa de 3 s/ IVA" : "Preço/hora s/ IVA"}
                  <CampoNumerico
                    valor={form.precoHora}
                    muda={(v) => muda({ precoHora: v })}
                    unidade="€"
                    placeholder={d.tarifa ? virgula(form.pessoas >= 3 ? d.tarifa.precoHora3 : d.tarifa.precoHora2) || "—" : "0,00"}
                  />
                  {(() => {
                    // d70: a hora que vai para a conta, com as pessoas a mais.
                    if (form.pessoas <= 3) return null;
                    const escrito = Number(form.precoHora.replace(",", "."));
                    const base = form.precoHora.trim() && Number.isFinite(escrito) && escrito > 0 ? escrito : d.tarifa?.precoHora3 ?? null;
                    return base != null ? (
                      <span className="mt-0.5 block text-emerald-300">
                        Com {form.pessoas}: {eur(precoDaHoraParaPessoas(base, form.pessoas))}/h s/ IVA
                      </span>
                    ) : null;
                  })()}
                </label>
                <fieldset className="col-span-2 sm:col-span-1">
                  <legend>Deslocação</legend>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={form.deslocacaoTipo === "km"} onChange={() => muda({ deslocacaoTipo: "km" })} /> em km
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={form.deslocacaoTipo === "euros"} onChange={() => muda({ deslocacaoTipo: "euros" })} /> em euros
                    </label>
                  </div>
                  {form.deslocacaoTipo === "km" ? (
                    <div className="flex flex-wrap gap-x-3">
                      <label className="block">
                        Km
                        <CampoNumerico valor={form.km} muda={(v) => muda({ km: v })} unidade="km" placeholder="0" />
                      </label>
                      <label className="block">
                        Preço/km s/ IVA
                        <CampoNumerico
                          valor={form.precoKm}
                          muda={(v) => muda({ precoKm: v })}
                          unidade="€"
                          placeholder={d.tarifa ? virgula(d.tarifa.precoKm) : "0,00"}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="block">
                      Deslocação s/ IVA
                      <CampoNumerico valor={form.deslocacaoEuros} muda={(v) => muda({ deslocacaoEuros: v })} unidade="€" placeholder="0,00" />
                    </label>
                  )}
                </fieldset>
              </div>
              {form.pessoas > 3 && (
                <div className="rounded border border-amber-700/60 bg-amber-950/30 p-2 text-[11px] text-amber-200">
                  <p>
                    {pessoasAMais(form.pessoas)} {pessoasAMais(form.pessoas) === 1 ? "pessoa" : "pessoas"} acima de 3: a hora da equipa de 3 + {eur(PRECO_POR_PESSOA_A_MAIS_SEM_IVA)}/h s/ IVA
                    por cada uma. Só com o acordo do cliente — sem a marca, o servidor não grava.
                  </p>
                  <label className="mt-1 flex items-start gap-1.5 font-semibold">
                    <input
                      type="checkbox"
                      checked={form.acordoDasPessoasAMais}
                      onChange={(e) => muda({ acordoDasPessoasAMais: e.target.checked })}
                      className="mt-0.5"
                    />
                    {CAIXA_DO_ACORDO_DAS_PESSOAS_A_MAIS}
                  </label>
                  {d.ultima?.entrada?.acordoDasPessoasAMais && (
                    <p className="mt-1 text-amber-300/80">
                      Registado a {QUANDO.format(new Date(d.ultima.entrada.acordoDasPessoasAMais.em))}
                      {d.ultima.entrada.acordoDasPessoasAMais.nome ? `, por ${d.ultima.entrada.acordoDasPessoasAMais.nome}` : ""} (
                      {d.ultima.entrada.acordoDasPessoasAMais.por}), para {d.ultima.entrada.acordoDasPessoasAMais.pessoas} pessoas.
                    </p>
                  )}
                </div>
              )}
              {d.tarifa ? (
                <p className="text-[11px] text-slate-500">
                  Tarifa congelada: mínimo de {virgula(d.tarifa.minimoHoras)} h, {virgula(d.tarifa.precoKm)} €/km, mínimo de {d.tarifa.kmMinimo} km. Vazio = o da tarifa.
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">Sem tarifa congelada: o preço da hora e o do km são obrigatórios.</p>
              )}

              <div className="text-[11px] text-slate-400">
                <p>Material (sem taxa, com IVA)</p>
                {/*
                  d49 (dono, 16-11-2026): o nome ocupa a linha e o valor fica estreito
                  à direita, com «€». Antes o «w-full» do campo ganhava ao «w-24» e o
                  nome ficava numa caixinha onde não se conseguia escrever.
                */}
                {form.materiais.map((m, i) => (
                  <div key={i} className="mt-1 flex items-end gap-1.5">
                    <label className="min-w-0 flex-1">
                      <span className="block">Material {i + 1}</span>
                      <input
                        value={m.descricao}
                        onChange={(e) => muda({ materiais: form.materiais.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)) })}
                        placeholder="Material (ex.: cartão, plástico, filme)"
                        maxLength={120}
                        className={campoDoNome}
                      />
                    </label>
                    <label className="shrink-0">
                      <span className="block">Valor s/ IVA</span>
                      <CampoNumerico
                        valor={m.valor}
                        muda={(v) => muda({ materiais: form.materiais.map((x, j) => (j === i ? { ...x, valor: v } : x)) })}
                        unidade="€"
                        placeholder="0,00"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => muda({ materiais: form.materiais.filter((_, j) => j !== i) })}
                      className="mb-0.5 rounded border border-slate-700 px-1.5 py-1 text-slate-400 hover:text-red-300"
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
                  <TextoQueCresce
                    valor={form.motivo}
                    muda={(v) => muda({ motivo: v })}
                    maxLength={300}
                    placeholder="ex.: horas e material da folha do dia"
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
          {/* Depois de gravada: o valor final ao cliente, só com o botão (d38 v2, commit d). */}
          {comEnvioAoCliente && d?.pode && d.ultima && <EnviarValorFinalAoCliente pedidoId={pedidoId} negociacaoId={negociacaoId} />}
          {erro && <p className="text-[11px] text-red-300">{erro}</p>}
        </div>
      )}
    </div>
  );
}
