"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { CabecalhoDeEcra, euros } from "@/components/portal/Portal";
import {
  EXEMPLO_DA_MUDANCA,
  MATERIAIS,
  REGRAS_DAS_MUDANCAS,
  congelarTarifa,
  validarTarifa,
  valorDaMudanca,
  type RegrasDaConta,
  type TarifaDasMudancas,
} from "@/lib/conta-da-mudanca";
import { dataEHoraEmLisboa } from "@/lib/hora-de-lisboa";

/**
 * OS PREÇOS DAS MUDANÇAS — 10-11-2026 (fase 1).
 *
 * O profissional escreve aqui o preço da hora da equipa, os km, o material e
 * os mínimos. Por baixo, a conta de um exemplo feita com a mesma função que
 * vai fazer a conta a sério (`valorDaMudanca`), para ele ver o que o cliente
 * paga e o que lhe fica antes de gravar.
 *
 * Nesta fase nada disto chega aos clientes: fica guardado na conta dele.
 */

type Campos = Record<
  | "precoHora2"
  | "precoHora3"
  | "minimoHoras"
  | "precoKm"
  | "kmMinimo"
  | "kmMaximo"
  | "caixa"
  | "cartaoMetro"
  | "filmeRolo"
  | "plasticoBolhaRolo",
  string
>;

const VAZIO: Campos = {
  precoHora2: "",
  precoHora3: "",
  minimoHoras: "",
  precoKm: "",
  kmMinimo: "",
  kmMaximo: "",
  caixa: "",
  cartaoMetro: "",
  filmeRolo: "",
  plasticoBolhaRolo: "",
};

const CAIXA =
  "w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-cyan-600";

const paraOCampo = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
const doCentimo = (c: number) => euros(c / 100);
const percentagem = (f: number) => `${Math.round(f * 1000) / 10} %`.replace(".", ",");

function Campo({
  etiqueta,
  ajuda,
  erro,
  valor,
  onMudar,
  sufixo,
}: {
  etiqueta: string;
  ajuda?: string;
  erro?: string;
  valor: string;
  onMudar: (v: string) => void;
  sufixo: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{etiqueta}</span>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          className={CAIXA}
          inputMode="decimal"
          value={valor}
          onChange={(e) => onMudar(e.target.value)}
        />
        <span className="shrink-0 text-sm text-slate-500">{sufixo}</span>
      </div>
      {erro && <span className="mt-1 block text-xs text-red-700">{erro}</span>}
      {ajuda && !erro && <span className="mt-1 block text-xs text-slate-500">{ajuda}</span>}
    </label>
  );
}

export default function PrecosDasMudancas({ onVoltar }: { onVoltar: () => void }) {
  const [campos, setCampos] = useState<Campos>(VAZIO);
  const [naLista, setNaLista] = useState(false);
  const [podeAparecer, setPodeAparecer] = useState(false);
  const [regras, setRegras] = useState<RegrasDaConta>(REGRAS_DAS_MUDANCAS);
  const [actualizadoEm, setActualizadoEm] = useState<string | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [aGravar, setAGravar] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  function encher(t: (TarifaDasMudancas & { actualizadoEm?: string | null }) | null) {
    if (!t) return;
    setCampos({
      precoHora2: paraOCampo(t.precoHora2),
      precoHora3: paraOCampo(t.precoHora3),
      minimoHoras: paraOCampo(t.minimoHoras),
      precoKm: paraOCampo(t.precoKm),
      kmMinimo: paraOCampo(t.kmMinimo),
      kmMaximo: paraOCampo(t.kmMaximo),
      caixa: paraOCampo(t.caixa),
      cartaoMetro: paraOCampo(t.cartaoMetro),
      filmeRolo: paraOCampo(t.filmeRolo),
      plasticoBolhaRolo: paraOCampo(t.plasticoBolhaRolo),
    });
    setNaLista(Boolean(t.aparecerNaLista));
    setActualizadoEm(t.actualizadoEm ?? null);
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/profissionais/tarifas-mudancas", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (!vivo) return;
        if (!r.ok) {
          setMensagem({ tom: "erro", texto: d.error ?? "Não foi possível ler os seus preços." });
          return;
        }
        encher(d.tarifa ?? null);
        setPodeAparecer(Boolean(d.podeAparecerNaLista));
        if (d.regras) {
          setRegras({
            taxa: Number(d.regras.taxaDaPlataforma),
            modo: d.regras.modoDaTaxa === "por_cima" ? "por_cima" : "de_dentro",
            materialComIva: Boolean(d.regras.materialComIva),
            iva: Number(d.regras.iva),
          });
        }
      } catch {
        if (vivo) setMensagem({ tom: "erro", texto: "Erro de rede. Tente outra vez." });
      } finally {
        if (vivo) setACarregar(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const mudar = (k: keyof Campos) => (v: string) => {
    setCampos((c) => ({ ...c, [k]: v }));
    setMensagem(null);
  };

  const validacao = useMemo(() => validarTarifa({ ...campos, aparecerNaLista: naLista }), [campos, naLista]);

  // O exemplo: com o material que ele fornece (as caixas, se as tiver).
  const exemplo = useMemo(() => {
    if (!validacao.ok) return null;
    const t = validacao.tarifa;
    const uso = { ...EXEMPLO_DA_MUDANCA, materiais: t.caixa == null ? {} : EXEMPLO_DA_MUDANCA.materiais };
    const conta = valorDaMudanca(congelarTarifa(t, regras), uso);
    return conta.ok ? conta : null;
  }, [validacao, regras]);

  async function gravar() {
    if (!validacao.ok) {
      setErros(validacao.erros as Record<string, string>);
      setMensagem({ tom: "erro", texto: "Há valores por corrigir." });
      return;
    }
    setErros({});
    setAGravar(true);
    try {
      const r = await fetch("/api/profissionais/tarifas-mudancas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Sem a categoria, a lista vai sempre desligada (a rota recusaria).
        body: JSON.stringify({ ...validacao.tarifa, aparecerNaLista: podeAparecer && validacao.tarifa.aparecerNaLista }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErros(d.erros ?? {});
        setMensagem({ tom: "erro", texto: d.error ?? "Não foi possível gravar." });
        return;
      }
      encher(d.tarifa ?? null);
      setMensagem({ tom: "ok", texto: "Preços gravados." });
    } catch {
      setMensagem({ tom: "erro", texto: "Erro de rede. Tente outra vez." });
    } finally {
      setAGravar(false);
    }
  }

  const e = (k: string): string | undefined => erros[k];

  return (
    <>
      <CabecalhoDeEcra titulo="Preços das mudanças" onVoltar={onVoltar} />

      {aCarregar ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A carregar…
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">
            Os seus preços para mudanças, sem IVA. Quando um cliente o escolher, o trabalho fica com
            os preços desse dia: pode mudá-los aqui depois, mas os trabalhos já escolhidos não mudam.
            Por agora ficam só guardados na sua conta.
          </p>

          <section className="space-y-3 rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-[#0B1929]">A equipa</h2>
            <Campo etiqueta="Hora com 2 pessoas" sufixo="€/h" valor={campos.precoHora2} onMudar={mudar("precoHora2")} erro={e("precoHora2")} />
            <Campo
              etiqueta="Hora com 3 pessoas"
              sufixo="€/h"
              ajuda="Vazio = não faz mudanças com 3 pessoas."
              valor={campos.precoHora3}
              onMudar={mudar("precoHora3")}
              erro={e("precoHora3")}
            />
            <Campo
              etiqueta="Mínimo de horas"
              sufixo="h"
              ajuda="As horas cobradas nunca ficam abaixo deste mínimo."
              valor={campos.minimoHoras}
              onMudar={mudar("minimoHoras")}
              erro={e("minimoHoras")}
            />
          </section>

          <section className="space-y-3 rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-[#0B1929]">Os quilómetros</h2>
            <Campo etiqueta="Preço do km" sufixo="€/km" valor={campos.precoKm} onMudar={mudar("precoKm")} erro={e("precoKm")} />
            <Campo
              etiqueta="Km mínimos por trabalho"
              sufixo="km"
              ajuda="Os km cobrados nunca ficam abaixo deste número."
              valor={campos.kmMinimo}
              onMudar={mudar("kmMinimo")}
              erro={e("kmMinimo")}
            />
            <Campo
              etiqueta="Distância máxima que aceita"
              sufixo="km"
              valor={campos.kmMaximo}
              onMudar={mudar("kmMaximo")}
              erro={e("kmMaximo")}
            />
          </section>

          <section className="space-y-3 rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-[#0B1929]">O material</h2>
            <p className="text-xs text-slate-500">
              Vazio = não fornece. O material não leva a taxa da plataforma: o cliente paga o seu preço.
            </p>
            {MATERIAIS.map((m) => (
              <Campo
                key={m.chave}
                etiqueta={`${m.nome} (por ${m.unidade})`}
                sufixo={`€/${m.unidade}`}
                valor={campos[m.chave]}
                onMudar={mudar(m.chave)}
                erro={e(m.chave)}
              />
            ))}
          </section>

          <section className="rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm">
            <button
              type="button"
              role="switch"
              aria-checked={naLista}
              disabled={!podeAparecer}
              onClick={() => setNaLista((v) => !v)}
              className="flex w-full items-center gap-3 text-left disabled:opacity-50"
            >
              <span className="flex-1">
                <span className="block text-sm font-medium text-slate-800">Aparecer na lista das mudanças</span>
                <span className="block text-xs text-slate-500">
                  {podeAparecer
                    ? "Quando a lista abrir aos clientes, aparece com estes preços."
                    : "Só com o serviço «Mudanças» nos seus serviços."}
                </span>
              </span>
              <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${naLista ? "bg-acao" : "bg-slate-300"}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${naLista ? "left-6" : "left-1"}`} />
              </span>
            </button>
            {erros.aparecerNaLista && <p className="mt-1 text-xs text-red-700">{erros.aparecerNaLista}</p>}
          </section>

          <section className="rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-[#0B1929]">Exemplo da conta</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {EXEMPLO_DA_MUDANCA.horas} horas, {EXEMPLO_DA_MUDANCA.pessoas} pessoas, {EXEMPLO_DA_MUDANCA.km} km
              {exemplo && exemplo.materiais.linhas.length > 0 ? `, ${EXEMPLO_DA_MUDANCA.materiais?.caixas} caixas` : ""}
            </p>
            {!exemplo ? (
              <p className="mt-3 text-sm text-slate-500">Preencha os preços da equipa e dos km para ver a conta.</p>
            ) : (
              <dl className="mt-3 space-y-1.5 text-sm">
                <Linha rotulo={`Horas (${exemplo.horas.cobradas} h × ${doCentimo(exemplo.horas.precoHoraCent)})`} valor={doCentimo(exemplo.horas.cent)} />
                <Linha rotulo={`Km (${exemplo.km.cobrados} km × ${doCentimo(exemplo.km.precoKmCent)})`} valor={doCentimo(exemplo.km.cent)} />
                {exemplo.materiais.linhas.map((l) => (
                  <Linha key={l.chave} rotulo={`${l.nome} (${l.quantidade} × ${doCentimo(l.precoCent)})`} valor={doCentimo(l.cent)} />
                ))}
                {exemplo.taxa.modo === "por_cima" && (
                  <Linha rotulo={`Taxa da plataforma (${percentagem(exemplo.taxa.fracao)} das horas e km)`} valor={doCentimo(exemplo.taxa.cent)} />
                )}
                <Linha rotulo="O cliente paga, sem IVA" valor={doCentimo(exemplo.semIvaCent)} forte />
                <Linha rotulo={`IVA (${percentagem(regras.iva)}${regras.materialComIva ? "" : ", sem o material"})`} valor={doCentimo(exemplo.ivaCent)} />
                <Linha rotulo="O cliente paga, com IVA" valor={doCentimo(exemplo.totalCent)} forte />
                <div className="my-2 border-t border-slate-100" />
                {exemplo.taxa.modo === "de_dentro" && (
                  <Linha rotulo={`Taxa da plataforma (${percentagem(exemplo.taxa.fracao)} das horas e km)`} valor={`− ${doCentimo(exemplo.taxa.cent)}`} />
                )}
                <Linha rotulo="Fica para si, sem IVA" valor={doCentimo(exemplo.profissionalCent)} forte />
              </dl>
            )}
          </section>

          {mensagem && (
            <p
              className={`rounded-xl border px-3 py-2 text-sm ${
                mensagem.tom === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {mensagem.texto}
            </p>
          )}

          <button
            type="button"
            onClick={gravar}
            disabled={aGravar}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-acao text-base font-bold text-white transition active:bg-acao-hover disabled:opacity-40"
          >
            {aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Gravar os preços
          </button>
          {actualizadoEm && (
            <p className="text-center text-xs text-slate-400">
              Última gravação: {dataEHoraEmLisboa(new Date(actualizadoEm))}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${forte ? "font-semibold text-slate-900" : "text-slate-600"}`}>
      <dt>{rotulo}</dt>
      <dd className="shrink-0 tabular-nums">{valor}</dd>
    </div>
  );
}
