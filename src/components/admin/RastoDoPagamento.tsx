"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FileCheck2, FileWarning, Paperclip } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { diaEmLisboa } from "@/lib/hora-de-lisboa";
import {
  ORIGENS,
  type ChaveDaOrigem,
  type ComprovativoVisto,
  type FiltroDaOrigem,
  type RegistoDoDinheiro,
} from "@/lib/origem-do-pagamento";

/**
 * O RASTO DE CADA PAGAMENTO, NO ECRÃ — d66 (CEO e dono, 18-11-2026). SÓ VER.
 *
 * As peças que os Pagamentos (os dois separadores), o cartão do pedido (Mesa /
 * Trabalho CLYON) e as Finanças usam para dizer de onde veio cada pagamento e
 * mostrar a prova: a lista dos registos, o filtro pela origem («sem
 * comprovativo» incluído) e o botão que abre um comprovativo (pela rota
 * autenticada — nunca um link público). Juntar um comprovativo e escolher a
 * conta vivem à parte (ProvaDoPagamento.tsx): só os Pagamentos os importam.
 */

const euros = (n: number | null) => (n == null ? "" : `${n.toFixed(2).replace(".", ",")} €`);

/** «18/11», em Lisboa. */
function diaCurto(iso: string | null): string {
  if (!iso) return "";
  const d = diaEmLisboa(new Date(iso));
  return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "";
}

/** Abre o comprovativo num separador novo: o ficheiro vem pela sessão do backoffice. */
export async function abrirComprovativo(token: string | null, id: number): Promise<string | null> {
  if (!token) return "Sessão em falta.";
  // O separador abre-se já, no clique — senão o browser trava-o.
  const janela = typeof window !== "undefined" ? window.open("", "_blank") : null;
  try {
    const r = await fetch(`/api/admin/pagamentos/rasto/comprovativo/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      janela?.close();
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      return j.error ?? "Não foi possível abrir o comprovativo.";
    }
    const url = URL.createObjectURL(await r.blob());
    if (janela) janela.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return null;
  } catch {
    janela?.close();
    return "Erro de rede.";
  }
}

export function BotaoDoFicheiro({ c }: { c: ComprovativoVisto }) {
  const { token } = useAdminAuth();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={async () => setErro(await abrirComprovativo(token, c.id))}
        title={`${c.nome}${c.por ? ` — junto por ${c.por}` : ""}${c.em ? `, a ${diaCurto(c.em)}` : ""}`}
        className="inline-flex max-w-[14rem] items-center gap-1 rounded border border-emerald-700/50 bg-emerald-950/30 px-1.5 py-0.5 text-[11px] text-emerald-200 hover:border-emerald-500"
      >
        <FileCheck2 className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{c.nome}</span>
      </button>
      {erro && <span className="text-[11px] text-rose-300">{erro}</span>}
    </>
  );
}

/** A etiqueta dos registos à mão que ainda não têm a prova. */
export function EtiquetaSemComprovativo() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-600/50 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
      <FileWarning className="h-3 w-3" aria-hidden="true" />
      sem comprovativo
    </span>
  );
}

/** Os registos de dinheiro de um trabalho: de onde veio cada um, e a prova. */
export function ListaDosRegistos({
  registos,
  juntar,
}: {
  registos: ReadonlyArray<RegistoDoDinheiro> | undefined;
  /** O botão «Juntar comprovativo» (ProvaDoPagamento.tsx), só onde se pode juntar. */
  juntar?: (r: RegistoDoDinheiro) => ReactNode;
}) {
  if (!registos || registos.length === 0) return null;
  return (
    <ul className="space-y-1">
      {registos.map((r) => (
        <li key={`${r.alvo}:${r.alvoId}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-300">
          <Paperclip className="h-3 w-3 text-slate-500" aria-hidden="true" />
          <span className="font-semibold text-slate-200">{r.origem.rotulo}</span>
          {r.origem.detalhe && <span className="text-slate-400">{r.origem.detalhe}</span>}
          <span className="text-slate-500">
            {r.oQue}
            {r.valor != null ? ` · ${euros(r.valor)}` : ""}
            {r.em ? ` · ${diaCurto(r.em)}` : ""}
          </span>
          {r.comprovativos.map((c) => (
            <BotaoDoFicheiro key={c.id} c={c} />
          ))}
          {r.semComprovativo && <EtiquetaSemComprovativo />}
          {/* O euPago prova-se sozinho; os registos à mão juntam o ficheiro (também depois). */}
          {juntar && !r.origem.automatica && juntar(r)}
        </li>
      ))}
    </ul>
  );
}

/** O filtro pela origem, com «só sem comprovativo» e quantos faltam. */
export function FiltroDaOrigemCampos({
  valor,
  onMudar,
  quantosSemComprovativo,
}: {
  valor: FiltroDaOrigem;
  onMudar: (f: FiltroDaOrigem) => void;
  quantosSemComprovativo: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={valor.origem}
        onChange={(e) => onMudar({ ...valor, origem: e.target.value as ChaveDaOrigem | "todas" })}
        aria-label="Origem do pagamento"
        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
      >
        <option value="todas">Todas as origens</option>
        {ORIGENS.map((o) => (
          <option key={o.chave} value={o.chave}>
            {o.rotulo}
          </option>
        ))}
      </select>
      <label className="inline-flex items-center gap-1.5 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={valor.soSemComprovativo}
          onChange={(e) => onMudar({ ...valor, soSemComprovativo: e.target.checked })}
        />
        Só sem comprovativo ({quantosSemComprovativo})
      </label>
    </div>
  );
}

/** Para o cartão do pedido (Mesa / Trabalho CLYON): lê o rasto de um trabalho. */
export function RastoDoTrabalho({ negociacaoId }: { negociacaoId: number }) {
  const { token } = useAdminAuth();
  const [registos, setRegistos] = useState<RegistoDoDinheiro[] | null>(null);
  useEffect(() => {
    if (!token) return;
    let vivo = true;
    void fetch(`/api/admin/pagamentos/rasto?negociacaoId=${negociacaoId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { registos: [] }))
      .then((j: { registos?: RegistoDoDinheiro[] }) => {
        if (vivo) setRegistos(Array.isArray(j.registos) ? j.registos : []);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [token, negociacaoId]);
  if (!registos || registos.length === 0) return null;
  return (
    <div className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">De onde veio o dinheiro</p>
      <ListaDosRegistos registos={registos} />
    </div>
  );
}

