"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, Download, Loader2, RefreshCw, Send, Smartphone } from "lucide-react";
import { dataEHoraEmLisboa, instanteDaBase } from "@/lib/hora-de-lisboa";
import {
  ROTULOS_DOS_ESTADOS,
  emailsPorAdicionar,
  podeMarcarAdicionado,
  podeReceberOConvite,
  type EstadoNoPrograma,
} from "@/lib/programa-da-app";
import { csvParaAPlay } from "@/lib/convite-app-cliente";
import { quandoSaiOLembrete, type ComoAderiu, type ListaParaAPlay } from "@/lib/seguimento-da-app";

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
 *
 * d59 (17-11-2026) — «porque ninguém adere»:
 *   · aviso dos inscritos parados há mais de 24 h em «inscrito»;
 *   · «Lista para a Play»: os inscritos + as contas novas sem convite, só com
 *     Gmail, prontos a copiar ou descarregar (CSV);
 *   · «Convidados — já aderiram?»: o sinal da app (avisos ligados) ou a marca
 *     «Já instalou» da equipa; e quando sai o lembrete (desligado por omissão).
 */

type Convidado = {
  email: string;
  origem: "programa" | "conta";
  convidadoEm: string | null;
  aderiu: ComoAderiu;
  instalouPor: string | null;
  lembreteEm: string | null;
  lembreteCanais: string | null;
  temTelefone: boolean;
  gmail: boolean;
  /** Quando saiu o convite novo (17-11-2026); `null` = ainda não o recebeu. */
  conviteNovoEm: string | null;
};

type EstadoDoLembrete = { email: boolean; whatsapp: boolean; dias: number };

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
  const [parados, setParados] = useState(0);
  const [paraAPlay, setParaAPlay] = useState<ListaParaAPlay | null>(null);
  const [convidados, setConvidados] = useState<Convidado[]>([]);
  const [lembrete, setLembrete] = useState<EstadoDoLembrete | null>(null);
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
      const d = (await r.json().catch(() => ({}))) as {
        inscricoes?: Inscricao[];
        temLink?: boolean;
        parados?: number;
        paraAPlay?: ListaParaAPlay;
        convidados?: Convidado[];
        lembrete?: EstadoDoLembrete;
        error?: string;
      };
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível ler o programa.");
        return;
      }
      setLista(d.inscricoes ?? []);
      setTemLink(!!d.temLink);
      setParados(d.parados ?? 0);
      setParaAPlay(d.paraAPlay ?? null);
      setConvidados(d.convidados ?? []);
      setLembrete(d.lembrete ?? null);
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
      setErro("Falta a ligação de adesão da Play. Escreva-a em Configs → «Ligação do programa da app» e volte aqui.");
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

  /** Os ids dos inscritos que estão na lista para a Play — para «Marcar como adicionados» a seguir. */
  const idsDosInscritosNaLista = () => {
    const naLista = new Set(paraAPlay?.emails ?? []);
    return lista.filter((l) => podeMarcarAdicionado(l.estado) && naLista.has(l.email.trim().toLowerCase())).map((l) => l.id);
  };

  const copiarListaParaAPlay = async () => {
    setErro(null);
    setAviso(null);
    const emails = paraAPlay?.emails ?? [];
    if (emails.length === 0) {
      setAviso("Não há emails por pôr na lista da Play.");
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setCopiados(idsDosInscritosNaLista());
      setAviso(
        `${emails.length} email${emails.length !== 1 ? "s" : ""} copiado${emails.length !== 1 ? "s" : ""}. Cole na lista de testadores do teste fechado na Play Console. Depois de guardar lá: «Marcar como adicionados» (inscritos) e, para as contas novas, Contas → «Convidar para testar a app».`,
      );
    } catch {
      setErro("O navegador não deixou copiar. Selecione o texto da caixa e copie à mão.");
    }
  };

  const descarregarListaParaAPlay = () => {
    const emails = paraAPlay?.emails ?? [];
    if (emails.length === 0) return;
    const url = URL.createObjectURL(new Blob([csvParaAPlay(emails)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "testadores-app-cliente.csv";
    a.click();
    URL.revokeObjectURL(url);
    setCopiados(idsDosInscritosNaLista());
  };

  const marcarInstalou = async (email: string, sim: boolean) => {
    setOcupado(`instalou:${email}`);
    setErro(null);
    setAviso(null);
    try {
      await post({ accao: "marcar-instalou", email, sim });
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setOcupado(null);
    }
  };

  const porAderir = convidados.filter((c) => !c.aderiu).length;

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
          Ainda não há ligação de adesão: o convite não sai sem ela. Escreva-a em Configs → «Ligação do programa da app».
        </p>
      )}

      {parados > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>
              {parados} inscrito{parados !== 1 ? "s" : ""} à espera há mais de 24 h
            </strong>{" "}
            para entrar na lista da Play. Copie a lista abaixo, cole-a na Play Console e marque-os como adicionados.
          </span>
        </p>
      )}

      {paraAPlay && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Lista para a Play ({paraAPlay.emails.length})</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {paraAPlay.deInscritos} inscrito{paraAPlay.deInscritos !== 1 ? "s" : ""} por adicionar ·{" "}
                {paraAPlay.deContas} conta{paraAPlay.deContas !== 1 ? "s" : ""} nova{paraAPlay.deContas !== 1 ? "s" : ""} sem
                convite (com Gmail). Pronta a colar em Play Console → Testes → Teste fechado → Testadores.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copiarListaParaAPlay()}
                disabled={paraAPlay.emails.length === 0}
                className="flex items-center gap-2 rounded-xl bg-acao px-4 py-2 text-sm font-semibold text-white transition hover:bg-acao-hover disabled:opacity-50"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copiar a lista
              </button>
              <button
                type="button"
                onClick={descarregarListaParaAPlay}
                disabled={paraAPlay.emails.length === 0}
                className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Descarregar CSV
              </button>
            </div>
          </div>
          {paraAPlay.emails.length > 0 && (
            <textarea
              readOnly
              value={paraAPlay.emails.join(", ")}
              onFocus={(e) => e.currentTarget.select()}
              rows={Math.min(4, Math.ceil(paraAPlay.emails.length / 3))}
              aria-label="Emails por pôr na lista da Play"
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800"
            />
          )}
          {paraAPlay.faltaGmail > 0 && (
            <p className="mt-2 text-xs text-amber-800">
              {paraAPlay.faltaGmail} conta{paraAPlay.faltaGmail !== 1 ? "s" : ""} nova{paraAPlay.faltaGmail !== 1 ? "s" : ""} com
              email que não é Gmail ficam de fora: falta o Gmail do telemóvel (a Play só dá acesso a uma conta Google).
            </p>
          )}
        </div>
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
          title={temLink === false ? "Falta a ligação de adesão nas Configs" : undefined}
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

      {convidados.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-bold text-slate-900">
            Convidados — já aderiram? ({convidados.length - porAderir} de {convidados.length})
          </h3>
          <p className="text-xs text-slate-500">
            A Play não diz quem se tornou testador. Conta como aderiu quando a app de cliente ligou os avisos nessa conta, ou
            quando a equipa marca «Já instalou».{" "}
            {lembrete?.email
              ? `Lembrete único ${lembrete.dias} dias depois do convite novo, por email${lembrete.whatsapp ? " e WhatsApp" : ""}; quem só tem o convite antigo recebe primeiro o convite novo.`
              : "O lembrete está desligado (à espera dos textos aprovados)."}
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Convidado em</th>
                  <th className="px-3 py-2">Aderiu</th>
                  <th className="px-3 py-2">Lembrete</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Marcar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {convidados.map((c) => {
                  // O lembrete conta os 3 dias a partir do convite NOVO (17-11-2026).
                  const convidadoEm = instanteDaBase(c.conviteNovoEm);
                  return (
                    <tr key={c.email} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs text-slate-800">
                        {c.email}
                        <span className="ml-2 font-sans text-[11px] text-slate-400">
                          {c.origem === "programa" ? "(programa)" : "(convite às contas)"}
                          {!c.gmail && " · não é Gmail"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{quando(c.convidadoEm)}</td>
                      <td className="px-3 py-2 text-xs">
                        {c.aderiu === "avisos-da-app" && <span className="font-semibold text-emerald-700">Sim (a app ligou os avisos)</span>}
                        {c.aderiu === "marcado" && (
                          <span className="font-semibold text-emerald-700">Sim (marcado{c.instalouPor ? ` por ${c.instalouPor}` : ""})</span>
                        )}
                        {!c.aderiu && <span className="text-slate-500">Ainda não</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {c.lembreteEm
                          ? `enviado · ${quando(c.lembreteEm)}${c.lembreteCanais ? ` (${c.lembreteCanais.replace(",", " + ")})` : ""}`
                          : c.aderiu || !c.gmail
                            ? "—"
                            : !lembrete?.email
                              ? "desligado"
                              : convidadoEm
                                ? `a partir de ${dataEHoraEmLisboa(quandoSaiOLembrete(convidadoEm))}`
                                : "depois do convite novo"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {c.aderiu !== "avisos-da-app" && (
                          <button
                            type="button"
                            onClick={() => void marcarInstalou(c.email, c.aderiu !== "marcado")}
                            disabled={ocupado !== null}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            {c.aderiu === "marcado" ? "Desfazer" : "Já instalou"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
