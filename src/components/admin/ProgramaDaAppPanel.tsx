"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, RefreshCw, Send, Smartphone } from "lucide-react";
import { dataEHoraEmLisboa, instanteDaBase } from "@/lib/hora-de-lisboa";
import {
  ROTULOS_DOS_ESTADOS,
  emailsPorAdicionar,
  podeMarcarAdicionado,
  podeReceberOConvite,
  type EstadoNoPrograma,
} from "@/lib/programa-da-app";

/*
 * CONTAS → «PROGRAMA DA APP» — 11-11-2026 (ordem do CEO, pedida e aprovada
 * pelo dono). Os clientes que pediram para entrar no programa de acesso
 * antecipado da app de cliente. O caminho de cada um:
 *
 *   1. «Copiar emails por adicionar» → colar na lista de testadores do teste
 *      fechado na Play Console (aceita emails separados por vírgulas);
 *   2. «Marcar como adicionados» — os que acabou de copiar, ou os selecionados;
 *   3. «Enviar convite» — o email com o link de adesão (Configs) e a Play Store.
 *
 * Só o administrador: as rotas são `requireAdminGeral`.
 */

type Inscricao = {
  id: number;
  email: string;
  estado: EstadoNoPrograma;
  origem: string;
  temConta: boolean;
  consentimentoEm: string | null;
  adicionadoEm: string | null;
  adicionadoPor: string | null;
  convidadoEm: string | null;
  convidadoPor: string | null;
  saiuEm: string | null;
};

const COR_DO_ESTADO: Record<EstadoNoPrograma, string> = {
  inscrito: "bg-amber-100 text-amber-800",
  adicionado: "bg-sky-100 text-sky-800",
  convidado: "bg-emerald-100 text-emerald-800",
  saiu: "bg-slate-100 text-slate-500",
};

function quando(v: string | null): string {
  const d = instanteDaBase(v);
  return d ? dataEHoraEmLisboa(d) : "—";
}

export default function ProgramaDaAppPanel({ authToken }: { authToken: string }) {
  const [lista, setLista] = useState<Inscricao[]>([]);
  const [temLink, setTemLink] = useState<boolean | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  /** Os ids que se copiaram por último — «Marcar como adicionados» usa-os se nada estiver selecionado. */
  const [copiados, setCopiados] = useState<number[]>([]);
  const [filtro, setFiltro] = useState<EstadoNoPrograma | "todos">("todos");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const r = await fetch("/api/admin/programa-da-app", { headers: { Authorization: `Bearer ${authToken}` } });
      const d = (await r.json().catch(() => ({}))) as { inscricoes?: Inscricao[]; temLink?: boolean; error?: string };
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível ler o programa.");
        return;
      }
      setLista(d.inscricoes ?? []);
      setTemLink(!!d.temLink);
    } catch {
      setErro("Não foi possível ler o programa.");
    }
  }, [authToken]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const post = async (corpo: Record<string, unknown>) => {
    const r = await fetch("/api/admin/programa-da-app", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d as { error?: string }).error ?? "Não foi possível concluir.");
    return d as Record<string, number>;
  };

  const contagem = useMemo(() => {
    const c: Record<EstadoNoPrograma, number> = { inscrito: 0, adicionado: 0, convidado: 0, saiu: 0 };
    for (const l of lista) c[l.estado]++;
    return c;
  }, [lista]);

  const visiveis = filtro === "todos" ? lista : lista.filter((l) => l.estado === filtro);
  const escolhidos = lista.filter((l) => selecionados.has(l.id));

  const alternar = (id: number) =>
    setSelecionados((antes) => {
      const n = new Set(antes);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const copiar = async () => {
    setErro(null);
    setAviso(null);
    // Os selecionados que estão por adicionar, ou todos os inscritos.
    const fonte = escolhidos.some((l) => l.estado === "inscrito") ? escolhidos : lista;
    const texto = emailsPorAdicionar(fonte);
    if (!texto) {
      setAviso("Não há emails por adicionar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(texto);
      const ids = fonte.filter((l) => podeMarcarAdicionado(l.estado)).map((l) => l.id);
      setCopiados(ids);
      setAviso(
        `${ids.length} email${ids.length !== 1 ? "s" : ""} copiado${ids.length !== 1 ? "s" : ""}. Cole na lista de testadores do teste fechado na Play Console e, depois de guardar lá, carregue em «Marcar como adicionados».`,
      );
    } catch {
      setErro("O navegador não deixou copiar. Selecione os emails na lista e copie à mão.");
    }
  };

  const marcarAdicionados = async () => {
    const ids = escolhidos.some((l) => podeMarcarAdicionado(l.estado))
      ? escolhidos.filter((l) => podeMarcarAdicionado(l.estado)).map((l) => l.id)
      : copiados;
    if (ids.length === 0) {
      setAviso("Copie primeiro os emails, ou selecione os que já pôs na Play.");
      return;
    }
    if (!confirm(`Marcar ${ids.length} inscrição(ões) como adicionadas na Play Console?`)) return;
    setOcupado("adicionar");
    setErro(null);
    setAviso(null);
    try {
      const d = await post({ accao: "marcar-adicionados", ids });
      setAviso(`${d.mudados ?? 0} marcada(s) como adicionadas. Já pode enviar o convite.`);
      setCopiados([]);
      setSelecionados(new Set());
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setOcupado(null);
    }
  };

  const convidar = async () => {
    if (!temLink) {
      setErro("Falta o link de adesão da Play. Escreva-o em Configs → «Link do programa da app» e volte aqui.");
      return;
    }
    const sel = escolhidos.filter((l) => podeReceberOConvite(l.estado)).map((l) => l.id);
    const quantos = sel.length > 0 ? sel.length : contagem.adicionado;
    if (quantos === 0) {
      setAviso("Não há ninguém adicionado à espera do convite.");
      return;
    }
    if (!confirm(`Enviar o email do convite a ${quantos} pessoa${quantos !== 1 ? "s" : ""}?`)) return;
    setOcupado("convidar");
    setErro(null);
    setAviso(null);
    let enviados = 0;
    let falhados = 0;
    try {
      // O servidor envia de 10 em 10; repete-se até não sobrar nenhum.
      for (let volta = 0; volta < 100; volta++) {
        const d = await post({ accao: "convidar", ...(sel.length > 0 ? { ids: sel } : {}) });
        enviados += d.enviados ?? 0;
        falhados += d.falhados ?? 0;
        if ((d.falhados ?? 0) > 0 || (d.restantes ?? 0) === 0 || (d.enviados ?? 0) === 0) break;
      }
      setAviso(
        `${enviados} convite(s) enviado(s)` +
          (falhados > 0 ? `; ${falhados} falharam e continuam «adicionados» — tente outra vez daqui a pouco.` : "."),
      );
      setSelecionados(new Set());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setOcupado(null);
      await carregar();
    }
  };

  const FILTROS: Array<{ id: EstadoNoPrograma | "todos"; rotulo: string }> = [
    { id: "todos", rotulo: `Todos (${lista.length})` },
    { id: "inscrito", rotulo: `Por adicionar (${contagem.inscrito})` },
    { id: "adicionado", rotulo: `Adicionados (${contagem.adicionado})` },
    { id: "convidado", rotulo: `Convidados (${contagem.convidado})` },
    { id: "saiu", rotulo: `Saíram (${contagem.saiu})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Smartphone className="h-5 w-5 text-cyan-600" aria-hidden="true" />
            Programa da app
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Clientes que pediram para entrar no programa de acesso antecipado da app para Android. Copie os emails
            por adicionar, cole-os na lista de testadores do teste fechado da app de cliente na Play Console, marque-os
            como adicionados e envie o convite.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Atualizar
        </button>
      </div>

      {temLink === false && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Ainda não há link de adesão: o convite não sai sem ele. Escreva-o em Configs → «Link do programa da app».
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copiar()}
          disabled={contagem.inscrito === 0}
          className="flex items-center gap-2 rounded-xl bg-acao px-4 py-2 text-sm font-semibold text-white transition hover:bg-acao-hover disabled:opacity-50"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copiar emails por adicionar ({contagem.inscrito})
        </button>
        <button
          type="button"
          onClick={() => void marcarAdicionados()}
          disabled={ocupado !== null || contagem.inscrito === 0}
          className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {ocupado === "adicionar" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          Marcar como adicionados
        </button>
        <button
          type="button"
          onClick={() => void convidar()}
          disabled={ocupado !== null || contagem.adicionado === 0}
          title={temLink === false ? "Falta o link de adesão nas Configs" : undefined}
          className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {ocupado === "convidar" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          Enviar convite ({contagem.adicionado})
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Com linhas selecionadas, os botões usam só essas; sem nenhuma, copiar usa todos os por adicionar, marcar usa os
        que acabou de copiar e o convite vai a todos os adicionados.
      </p>

      {aviso && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{aviso}</p>}
      {erro && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p>}

      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filtro === f.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
          Ainda ninguém nesta lista.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">
                  <span className="sr-only">Selecionar</span>
                </th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Inscrito em</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Quem marcou</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selecionados.has(l.id)}
                      onChange={() => alternar(l.id)}
                      aria-label={`Selecionar ${l.email}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-800">
                    {l.email}
                    {!l.temConta && <span className="ml-2 font-sans text-[11px] text-slate-400">(sem conta)</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {quando(l.consentimentoEm)}
                    <span className="ml-1 text-slate-400">· {l.origem === "registo" ? "no registo" : "na conta"}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COR_DO_ESTADO[l.estado]}`}>
                      {ROTULOS_DOS_ESTADOS[l.estado]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {l.estado === "convidado" && `${l.convidadoPor ?? "—"} · ${quando(l.convidadoEm)}`}
                    {l.estado === "adicionado" && `${l.adicionadoPor ?? "—"} · ${quando(l.adicionadoEm)}`}
                    {l.estado === "saiu" && `saiu · ${quando(l.saiuEm)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
