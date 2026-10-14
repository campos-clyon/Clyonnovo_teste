"use client";

import { useRef, useState } from "react";
import { ArrowLeftRight, Loader2, Paperclip, Trash2, X } from "lucide-react";
import { somarDiasAoDia } from "@/lib/hora-de-lisboa";
import {
  emEuros,
  lerEuros,
  type Categoria,
  type Conta,
  type Movimento,
  type TipoDeMovimento,
} from "@/lib/financas";
import { BolaDaCategoria } from "./aparencia";

const TITULO: Record<TipoDeMovimento, string> = {
  despesa: "despesa",
  receita: "receita",
  transferencia: "transferência",
};

const COR_DO_TIPO: Record<TipoDeMovimento, string> = {
  despesa: "text-coral-texto",
  receita: "text-esmeralda-texto",
  transferencia: "text-cyan-200",
};

/**
 * LANÇAR À MÃO — a «Nova despesa» e a «Nova receita» do Mobills, e a
 * transferência entre contas.
 *
 * Fecha pelo X e pelo «Cancelar», nunca por um clique ao lado: o que se perde
 * é um valor acabado de escrever com o talão na mão (a mesma regra do editor
 * de pedidos).
 */
export default function FormularioDoMovimento({
  tipoInicial,
  movimento,
  contas,
  categorias,
  hoje,
  ultimaCategoria = {},
  token,
  podeApagar,
  onGravado,
  onFechar,
}: {
  tipoInicial: TipoDeMovimento;
  movimento: Movimento | null;
  contas: Conta[];
  categorias: Categoria[];
  hoje: string;
  /** A categoria do último lançado à mão, por tipo — é por ela que o formulário abre. */
  ultimaCategoria?: Partial<Record<"despesa" | "receita", number>>;
  token: string | null;
  podeApagar: boolean;
  onGravado: () => void;
  onFechar: () => void;
}) {
  const contaDaPlataforma = contas.find((c) => c.papel === "plataforma")?.id ?? contas[0]?.id ?? null;
  const primeiraCategoria = (t: TipoDeMovimento) => {
    const ultima = t === "transferencia" ? undefined : ultimaCategoria[t];
    if (ultima != null && categorias.some((c) => c.id === ultima && c.tipo === t)) return ultima;
    return categorias.find((c) => c.tipo === t && !c.sistema)?.id ?? categorias.find((c) => c.tipo === t)?.id ?? null;
  };

  const [tipo, setTipo] = useState<TipoDeMovimento>(movimento?.tipo ?? tipoInicial);
  const [valor, setValor] = useState(movimento ? movimento.valor.toFixed(2).replace(".", ",") : "");
  const [efectivado, setEfectivado] = useState(movimento?.efectivado ?? true);
  const [dia, setDia] = useState(movimento?.dia ?? hoje);
  const [descricao, setDescricao] = useState(movimento?.descricao ?? "");
  const [categoriaId, setCategoriaId] = useState<number | null>(
    movimento ? movimento.categoriaId : primeiraCategoria(tipoInicial),
  );
  const [contaId, setContaId] = useState<number | null>(movimento?.contaId ?? contaDaPlataforma);
  const [contaDestinoId, setContaDestinoId] = useState<number | null>(
    movimento?.contaDestinoId ?? contas.find((c) => c.id !== contaDaPlataforma)?.id ?? null,
  );
  const [notas, setNotas] = useState(movimento?.notas ?? "");
  const [ignorado, setIgnorado] = useState(movimento?.ignorado ?? false);
  const [anexo, setAnexo] = useState<{ url: string; nome: string } | null>(movimento?.anexo ?? null);
  const [aEnviarAnexo, setAEnviarAnexo] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState("");
  const [gravado, setGravado] = useState("");
  const seletor = useRef<HTMLInputElement | null>(null);

  const ontem = somarDiasAoDia(hoje, -1);
  const lido = lerEuros(valor);
  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo);
  const categoria = categorias.find((c) => c.id === categoriaId) ?? null;

  function mudarTipo(t: TipoDeMovimento) {
    setTipo(t);
    if (t !== "transferencia" && categoria?.tipo !== t) setCategoriaId(primeiraCategoria(t));
    setErro("");
  }

  async function anexar(f: File) {
    setAEnviarAnexo(true);
    setErro("");
    try {
      const { enviarFicheiro } = await import("@/lib/enviar-ficheiro");
      const r = await enviarFicheiro(f);
      if (r.ok) setAnexo({ url: r.ficheiro.url, nome: r.ficheiro.name });
      else setErro(`O anexo não subiu: ${r.motivo}`);
    } catch {
      setErro("O anexo não subiu. Tente outra vez.");
    } finally {
      setAEnviarAnexo(false);
      if (seletor.current) seletor.current.value = "";
    }
  }

  async function gravar(criarOutra: boolean) {
    if (!token) return;
    setAGravar(true);
    setErro("");
    setGravado("");
    try {
      const res = await fetch("/api/admin/financas/movimentos", {
        method: movimento ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: movimento?.id,
          tipo,
          valor,
          dia,
          descricao,
          categoriaId: tipo === "transferencia" ? null : categoriaId,
          contaId,
          contaDestinoId: tipo === "transferencia" ? contaDestinoId : null,
          efectivado,
          ignorado,
          notas,
          anexoUrl: anexo?.url ?? null,
          anexoNome: anexo?.nome ?? null,
        }),
      });
      const dados = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível gravar.");
        return;
      }
      onGravado();
      if (!criarOutra || movimento) {
        onFechar();
        return;
      }
      // A seguinte nasce do mesmo tipo, no mesmo dia e na mesma conta: é assim
      // que se lançam os talões de uma semana de seguida.
      setGravado(`${emEuros(lido ?? 0)} gravados. Pode lançar a seguinte.`);
      setValor("");
      setDescricao("");
      setNotas("");
      setAnexo(null);
      setIgnorado(false);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(false);
    }
  }

  async function apagar() {
    if (!token || !movimento) return;
    if (!window.confirm(`Apagar «${movimento.descricao || "este movimento"}» de ${emEuros(movimento.valor)}? Não se desfaz.`)) return;
    setAGravar(true);
    setErro("");
    try {
      const res = await fetch(`/api/admin/financas/movimentos?id=${encodeURIComponent(movimento.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível apagar.");
        return;
      }
      onGravado();
      onFechar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(false);
    }
  }

  const campo = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";
  const rotulo = "block text-xs font-semibold uppercase tracking-wider text-slate-400";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={movimento ? `Editar ${TITULO[tipo]}` : `Nova ${TITULO[tipo]}`}
        className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-[Poppins] text-lg font-bold text-white">
            {movimento ? "Editar" : "Nova"} {TITULO[tipo]}
          </h3>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!movimento && (
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-1" role="radiogroup" aria-label="Tipo">
            {(["despesa", "receita", "transferencia"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tipo === t}
                onClick={() => mudarTipo(t)}
                className={`rounded-lg px-2 py-1.5 text-xs font-semibold capitalize transition ${
                  tipo === t ? `bg-slate-800 ${COR_DO_TIPO[t]}` : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {TITULO[t]}
              </button>
            ))}
          </div>
        )}

        <label className="mt-4 block">
          <span className={rotulo}>Valor</span>
          <span className="mt-1 flex items-center gap-2 border-b border-slate-700 pb-1 focus-within:border-cyan-500">
            <span className={`text-2xl font-bold ${COR_DO_TIPO[tipo]}`}>€</span>
            <input
              autoFocus
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className={`w-full bg-transparent text-2xl font-bold tabular-nums outline-none placeholder:text-slate-600 ${COR_DO_TIPO[tipo]}`}
            />
          </span>
        </label>

        <label className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-200">
            {tipo === "despesa" ? "Foi paga" : tipo === "receita" ? "Foi recebida" : "Já foi feita"}
          </span>
          <input
            type="checkbox"
            checked={efectivado}
            onChange={(e) => setEfectivado(e.target.checked)}
            className="h-5 w-5 accent-cyan-500"
          />
        </label>
        {!efectivado && (
          <p className="mt-1 text-[11px] text-ambar-texto">
            Fica por {tipo === "receita" ? "receber" : "pagar"}: aparece no mês, e só entra no saldo quando a marcar como feita.
          </p>
        )}

        <div className="mt-4">
          <span className={rotulo}>Dia</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {[
              { d: hoje, r: "Hoje" },
              { d: ontem, r: "Ontem" },
            ].map((x) => (
              <button
                key={x.r}
                type="button"
                onClick={() => setDia(x.d)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  dia === x.d ? "bg-cyan-500/20 text-cyan-100" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {x.r}
              </button>
            ))}
            <input
              type="date"
              value={dia}
              onChange={(e) => e.target.value && setDia(e.target.value)}
              aria-label="Outro dia"
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
            />
          </div>
        </div>

        <label className="mt-4 block">
          <span className={rotulo}>Descrição</span>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={tipo === "despesa" ? "IVECO 1, MINIPREÇO, salário do David…" : tipo === "receita" ? "Quem pagou, e porquê" : "Porquê"}
            maxLength={200}
            className={`mt-1 ${campo}`}
          />
        </label>

        {tipo === "transferencia" ? (
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label className="block">
              <span className={rotulo}>De</span>
              <select value={contaId ?? ""} onChange={(e) => setContaId(Number(e.target.value))} className={`mt-1 ${campo}`}>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <ArrowLeftRight className="mb-2.5 h-4 w-4 text-slate-500" aria-hidden="true" />
            <label className="block">
              <span className={rotulo}>Para</span>
              <select
                value={contaDestinoId ?? ""}
                onChange={(e) => setContaDestinoId(Number(e.target.value))}
                className={`mt-1 ${campo}`}
              >
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={rotulo}>Categoria</span>
              <span className="mt-1 flex items-center gap-2">
                {categoria && <BolaDaCategoria cor={categoria.cor} icone={categoria.icone} />}
                <select
                  value={categoriaId ?? ""}
                  onChange={(e) => setCategoriaId(Number(e.target.value))}
                  className={campo}
                >
                  {categoriasDoTipo.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="block">
              <span className={rotulo}>Conta</span>
              <select value={contaId ?? ""} onChange={(e) => setContaId(Number(e.target.value))} className={`mt-1 ${campo}`}>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <label className="mt-4 block">
          <span className={rotulo}>Notas</span>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            maxLength={500}
            className={`mt-1 resize-y ${campo}`}
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            ref={seletor}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void anexar(f);
            }}
          />
          {anexo ? (
            <span className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200">
              <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="truncate underline-offset-2 hover:underline">
                {anexo.nome}
              </a>
              <button type="button" onClick={() => setAnexo(null)} aria-label="Tirar o anexo" className="text-slate-400 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => seletor.current?.click()}
              disabled={aEnviarAnexo}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {aEnviarAnexo ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />}
              {aEnviarAnexo ? "A enviar…" : "Anexar talão ou factura"}
            </button>
          )}
        </div>

        <label className="mt-4 flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm text-slate-200">Ignorar esta transação</span>
            <span className="block text-[11px] text-slate-500">Fica na lista, mas não conta no saldo nem nos totais.</span>
          </span>
          <input
            type="checkbox"
            checked={ignorado}
            onChange={(e) => setIgnorado(e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-cyan-500"
          />
        </label>

        {erro && <p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{erro}</p>}
        {gravado && <p className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">{gravado}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {movimento && podeApagar && (
            <button
              type="button"
              onClick={() => void apagar()}
              disabled={aGravar}
              className="mr-auto flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Apagar
            </button>
          )}
          <button type="button" onClick={onFechar} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white">
            Cancelar
          </button>
          {!movimento && (
            <button
              type="button"
              onClick={() => void gravar(true)}
              disabled={aGravar || aEnviarAnexo || lido == null || lido <= 0}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              Guardar e lançar outra
            </button>
          )}
          <button
            type="button"
            onClick={() => void gravar(false)}
            disabled={aGravar || aEnviarAnexo || lido == null || lido <= 0}
            className="flex items-center gap-1.5 rounded-lg bg-acao px-4 py-2 text-sm font-bold text-white hover:bg-acao-hover disabled:opacity-40"
          >
            {aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
