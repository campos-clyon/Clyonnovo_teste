"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { RAIO_MAXIMO_KM, type ErroDeInscricao } from "@/lib/inscricao-profissional";

const CATEGORIAS = SERVICE_CATEGORIES.filter((c) => c.id !== "outro");

function inputCls(erro?: string) {
  return `w-full rounded-xl border-2 bg-white px-4 py-2.5 text-base text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 ${
    erro ? "border-red-400" : "border-gray-300"
  }`;
}

export default function InscricaoForm() {
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    nif: "",
    cidade: "",
    categorias: [] as string[],
    zonas: "",
    raioKm: "30",
    emiteFatura: false,
    emiteGuiaTransporte: false,
    numeroTransportador: "",
  });
  const [erros, setErros] = useState<ErroDeInscricao[]>([]);
  const [erroGeral, setErroGeral] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [enviado, setEnviado] = useState<{ precisaVerificacaoDeGuia: boolean } | null>(null);

  const erro = (campo: string) => erros.find((e) => e.campo === campo)?.mensagem;

  function set(campo: string, valor: unknown) {
    setForm((p) => ({ ...p, [campo]: valor }));
    setErros((p) => p.filter((e) => e.campo !== campo));
  }

  function alternarCategoria(id: string) {
    setForm((p) => ({
      ...p,
      categorias: p.categorias.includes(id)
        ? p.categorias.filter((c) => c !== id)
        : [...p.categorias, id],
    }));
    setErros((p) => p.filter((e) => e.campo !== "categorias"));
  }

  async function submeter(ev: React.FormEvent) {
    ev.preventDefault();
    setAEnviar(true);
    setErroGeral("");
    setErros([]);

    try {
      const res = await fetch("/api/profissionais/inscricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          zonas: form.zonas
            .split(",")
            .map((z) => z.trim())
            .filter(Boolean),
        }),
      });
      const dados = await res.json();

      if (!res.ok) {
        if (Array.isArray(dados.erros)) setErros(dados.erros);
        setErroGeral(dados.error ?? "Não foi possível enviar a inscrição.");
        return;
      }
      setEnviado({ precisaVerificacaoDeGuia: dados.precisaVerificacaoDeGuia === true });
    } catch {
      setErroGeral("Erro de rede. Verifique a ligação e tente novamente.");
    } finally {
      setAEnviar(false);
    }
  }

  if (enviado) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-bold text-emerald-900">Inscrição recebida</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-emerald-800">
          Vamos analisar o seu registo. Enquanto isso não acontecer{" "}
          <strong>não recebe pedidos</strong> — é assim de propósito, para o cliente
          saber que quem lhe aparece já foi verificado.
        </p>
        {enviado.precisaVerificacaoDeGuia && (
          <p className="mx-auto mt-3 max-w-md rounded-xl border border-emerald-300 bg-white p-3 text-xs leading-relaxed text-emerald-900">
            Declarou emitir guia de transporte. Vamos confirmar o número de registo
            antes de o distintivo aparecer no seu perfil — um distintivo que
            qualquer um ligasse sozinho não valia nada para o cliente.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submeter} noValidate className="space-y-8">
      {/* ── Quem é ──────────────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-base font-bold text-slate-900">Quem é</legend>

        <div>
          <label htmlFor="nome" className="block text-sm font-medium text-gray-900">
            Nome ou empresa *
          </label>
          <input
            id="nome"
            value={form.nome}
            onChange={(e) => set("nome", e.target.value)}
            placeholder="Ex: Transportes Silva Lda"
            className={`mt-1.5 ${inputCls(erro("nome"))}`}
          />
          {erro("nome") && <p className="mt-1 text-xs text-red-600">{erro("nome")}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-900">
              Email *
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="geral@exemplo.pt"
              className={`mt-1.5 ${inputCls(erro("email"))}`}
            />
            {erro("email") && <p className="mt-1 text-xs text-red-600">{erro("email")}</p>}
            <p className="mt-1 text-xs text-slate-500">É por aqui que os pedidos chegam.</p>
          </div>

          <div>
            <label htmlFor="telefone" className="block text-sm font-medium text-gray-900">
              Telefone *
            </label>
            <input
              id="telefone"
              type="tel"
              autoComplete="tel"
              value={form.telefone}
              onChange={(e) => set("telefone", e.target.value)}
              placeholder="912 345 678"
              className={`mt-1.5 ${inputCls(erro("telefone"))}`}
            />
            {erro("telefone") && <p className="mt-1 text-xs text-red-600">{erro("telefone")}</p>}
          </div>
        </div>
      </fieldset>

      {/* ── O que faz ───────────────────────────────────────────────── */}
      <fieldset className="space-y-3">
        <legend className="text-base font-bold text-slate-900">O que faz</legend>
        <p className="text-sm text-slate-600">
          Só recebe pedidos das categorias que escolher. Escolher tudo não o ajuda —
          traz-lhe pedidos que não quer.
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIAS.map((c) => {
            const activa = form.categorias.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => alternarCategoria(c.id)}
                aria-pressed={activa}
                className={`flex items-center gap-2 rounded-xl border-2 p-3 text-left text-xs font-semibold transition ${
                  activa
                    ? "border-cyan-600 bg-cyan-50 text-cyan-900"
                    : "border-gray-200 bg-white text-slate-700 hover:border-cyan-300"
                }`}
              >
                <span aria-hidden="true">{c.emoji}</span>
                {c.label}
              </button>
            );
          })}
        </div>
        {erro("categorias") && <p className="text-xs text-red-600">{erro("categorias")}</p>}
      </fieldset>

      {/* ── Onde trabalha ───────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-base font-bold text-slate-900">Onde trabalha</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cidade" className="block text-sm font-medium text-gray-900">
              Cidade onde tem base *
            </label>
            <input
              id="cidade"
              value={form.cidade}
              onChange={(e) => set("cidade", e.target.value)}
              placeholder="Amadora"
              className={`mt-1.5 ${inputCls(erro("cidade"))}`}
            />
            {erro("cidade") && <p className="mt-1 text-xs text-red-600">{erro("cidade")}</p>}
          </div>

          <div>
            <label htmlFor="raio" className="block text-sm font-medium text-gray-900">
              Até quantos km se desloca *
            </label>
            <input
              id="raio"
              type="number"
              min={1}
              max={RAIO_MAXIMO_KM}
              value={form.raioKm}
              onChange={(e) => set("raioKm", e.target.value)}
              className={`mt-1.5 ${inputCls(erro("raioKm"))}`}
            />
            {erro("raioKm") && <p className="mt-1 text-xs text-red-600">{erro("raioKm")}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="zonas" className="block text-sm font-medium text-gray-900">
            Outras zonas que cobre <span className="font-normal text-slate-500">(opcional)</span>
          </label>
          <input
            id="zonas"
            value={form.zonas}
            onChange={(e) => set("zonas", e.target.value)}
            placeholder="Lisboa, Sintra, Cascais"
            className={`mt-1.5 ${inputCls()}`}
          />
          <p className="mt-1 text-xs text-slate-500">Separe por vírgulas.</p>
        </div>
      </fieldset>

      {/* ── Documentos ──────────────────────────────────────────────── */}
      <fieldset className="space-y-3">
        <legend className="text-base font-bold text-slate-900">Documentos que emite</legend>
        <p className="text-sm text-slate-600">
          Determina que pedidos lhe mostramos. Muitos clientes pedem fatura, e um
          pedido que a exija não chega a quem não a emite.
        </p>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-gray-300 bg-white p-4 transition hover:border-cyan-400 has-[:checked]:border-cyan-600 has-[:checked]:bg-cyan-50">
          <input
            type="checkbox"
            checked={form.emiteFatura}
            onChange={(e) => set("emiteFatura", e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-600"
          />
          <span className="flex-1">
            <span className="text-sm font-semibold text-slate-900">Emito fatura</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
              O IVA é do seu regime. Quem está em isenção não liquida IVA nenhum — a
              CLYON não se mete nisso e fatura apenas a sua própria comissão.
            </span>
          </span>
        </label>

        {form.emiteFatura && (
          <div>
            <label htmlFor="nif" className="block text-sm font-medium text-gray-900">
              NIF *
            </label>
            <input
              id="nif"
              inputMode="numeric"
              value={form.nif}
              onChange={(e) => set("nif", e.target.value)}
              placeholder="500 000 000"
              className={`mt-1.5 ${inputCls(erro("nif"))}`}
            />
            {erro("nif") && <p className="mt-1 text-xs text-red-600">{erro("nif")}</p>}
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-gray-300 bg-white p-4 transition hover:border-cyan-400 has-[:checked]:border-cyan-600 has-[:checked]:bg-cyan-50">
          <input
            type="checkbox"
            checked={form.emiteGuiaTransporte}
            onChange={(e) => set("emiteGuiaTransporte", e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-600"
          />
          <span className="flex-1">
            <span className="text-sm font-semibold text-slate-900">
              Emito guia de transporte (e-GAR)
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
              Transportar resíduos em Portugal exige transportador registado. Sem isto
              não lhe mostramos pedidos de entulho ou monos que peçam guia.
            </span>
          </span>
        </label>

        {form.emiteGuiaTransporte && (
          <div>
            <label
              htmlFor="numeroTransportador"
              className="block text-sm font-medium text-gray-900"
            >
              Número de registo de transportador *
            </label>
            <input
              id="numeroTransportador"
              value={form.numeroTransportador}
              onChange={(e) => set("numeroTransportador", e.target.value)}
              placeholder="Ex: APA-123456"
              className={`mt-1.5 ${inputCls(erro("numeroTransportador"))}`}
            />
            {erro("numeroTransportador") && (
              <p className="mt-1 text-xs text-red-600">{erro("numeroTransportador")}</p>
            )}
            <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-amber-700">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Confirmamos este número antes de o distintivo aparecer. Um distintivo que
              qualquer um ligasse sozinho não valia nada para o cliente.
            </p>
          </div>
        )}
      </fieldset>

      {erroGeral && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erroGeral}
        </p>
      )}

      <div className="space-y-3">
        <button
          type="submit"
          disabled={aEnviar}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3.5 text-base font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {aEnviar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {aEnviar ? "A enviar…" : "Quero receber pedidos"}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Inscrever-se é gratuito. Só há comissão quando fecha um trabalho.
        </p>
      </div>
    </form>
  );
}
