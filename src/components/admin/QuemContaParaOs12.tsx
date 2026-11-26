"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ClipboardPaste, Loader2, MessageCircle, Phone, RefreshCw, Send, Trash2, X } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { dataEHoraEmLisboa, instanteDaBase } from "@/lib/hora-de-lisboa";
import {
  DIAS_DO_TESTE,
  ROTULOS_DO_USO,
  telefoneParaLigar,
  type AppDoTeste,
  type EmailDaPlaySemConta,
  type EstadoDeUso,
  type LinhaDoQuadro,
} from "@/lib/quem-conta-para-os-12";
import {
  PASSOS_DA_ADESAO,
  ROTULOS_DO_APARELHO,
  ROTULOS_DO_MOTIVO,
  ultimoPassoEmPalavras,
  type Percurso,
  type ResumoDosPercursos,
} from "@/lib/percurso-da-app-cliente";
import {
  estadoQueSeAvisa,
  podeAvisarAgora,
  quemAvisarEmMassa,
  rotuloDoAvisado,
  textoDoAvisoDaAppPro,
  type LinhaQueSeAvisa,
} from "@/lib/aviso-da-app-pro";
import { intervaloAoAcaso } from "@/lib/aviso-aos-profissionais";

/*
 * «QUEM CONTA PARA OS 12» — 17-11-2026 (d60, pedida e aprovada pelo dono).
 *
 * A Play Console diz quantos testadores participam, nunca quem. Aqui está
 * quem: cada pessoa que devia estar no teste, se usa a app (abriu nos últimos
 * 14 dias), se instalou e parou, ou se nunca entrou — com o telefone para a
 * equipa ligar e perguntar porquê. O total «Usa» compara-se com o número da
 * Play. Colando a lista de testadores da Play, o quadro diz também quem está
 * fora dela e que emails da Play não têm conta CLYON.
 *
 * Só o administrador (a rota é `requireAdminGeral`). Na CLYON Pro vive na
 * secção Profissionais (tema escuro); na app de cliente, em Contas › Programa
 * da app (tema claro).
 *
 * d106 (24-11-2026): na app de cliente, a coluna «Na ligação do convite» (o
 * último passo: convite enviado → clicou → aparelho → passo → «Não consegui»
 * com o motivo) e, por cima, o resumo de todos (cliques, % iPhone e
 * computador, motivos por passo).
 *
 * d134 (26-11-2026): na CLYON Pro, a coluna «Aviso» — «Avisar no WhatsApp»
 * a quem está em «Nunca entrou» ou «Instalou e parou»: abre o texto
 * (editável) e só o manda ao carregar em «Enviar». E «Avisar todos os que
 * nunca entraram (N)»: a lista e o texto, enviados um a um com 20 a 45 s
 * entre cada. Um por dia a cada pessoa («avisado a DD/MM às HH:MM»).
 */

type AvisoDaApp = { avisadoEm: string | null; temWhatsApp: boolean };
type LinhaComAviso = LinhaDoQuadro & { percurso?: Percurso | null; avisoDaApp?: AvisoDaApp | null };

type Quadro = {
  linhas: LinhaComAviso[];
  percursos?: ResumoDosPercursos | null;
  semConta: EmailDaPlaySemConta[];
  totais: Record<EstadoDeUso, number>;
  usaNaPlay: number | null;
  listaColada: boolean;
  lista: { emails: string[]; coladaEm: string | null; porQuem: string | null };
};

const TEMAS = {
  escuro: {
    caixa: "rounded-2xl border border-slate-800 bg-slate-950/40 p-4",
    titulo: "text-base font-semibold text-white",
    texto: "text-sm text-slate-400",
    fraco: "text-xs text-slate-500",
    forte: "font-semibold text-slate-100",
    tabela: "divide-y divide-slate-800",
    cabeca: "text-xs uppercase tracking-wide text-slate-500",
    campo: "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 placeholder:text-slate-600",
    botao: "flex items-center gap-2 rounded-xl border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50",
    filtro: "rounded-full border px-3 py-1 text-xs font-semibold transition",
    filtroOn: "border-cyan-400 bg-cyan-500/15 text-cyan-200",
    filtroOff: "border-slate-700 text-slate-400 hover:text-slate-200",
    link: "text-cyan-300 hover:underline",
    aviso: "text-amber-300",
    erro: "text-red-300",
    estado: {
      usa: "bg-emerald-500/15 text-emerald-300",
      parou: "bg-amber-500/15 text-amber-200",
      nunca: "bg-slate-700/60 text-slate-300",
    } as Record<EstadoDeUso, string>,
    marca: "bg-slate-800 text-slate-300",
    marcaAviso: "bg-amber-500/15 text-amber-200",
  },
  claro: {
    caixa: "rounded-2xl border border-slate-200 bg-white p-4",
    titulo: "text-base font-bold text-slate-900",
    texto: "text-sm text-slate-600",
    fraco: "text-xs text-slate-500",
    forte: "font-semibold text-slate-900",
    tabela: "divide-y divide-slate-100",
    cabeca: "text-xs uppercase tracking-wide text-slate-500",
    campo: "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-800 placeholder:text-slate-400",
    botao: "flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50",
    filtro: "rounded-full border px-3 py-1 text-xs font-semibold transition",
    filtroOn: "border-sky-500 bg-sky-50 text-sky-800",
    filtroOff: "border-slate-200 text-slate-500 hover:text-slate-800",
    link: "text-sky-700 hover:underline",
    aviso: "text-amber-700",
    erro: "text-red-600",
    estado: {
      usa: "bg-emerald-100 text-emerald-800",
      parou: "bg-amber-100 text-amber-800",
      nunca: "bg-slate-100 text-slate-600",
    } as Record<EstadoDeUso, string>,
    marca: "bg-slate-100 text-slate-600",
    marcaAviso: "bg-amber-100 text-amber-800",
  },
};

/** A linha como o aviso a vê (estado, WhatsApp, último aviso). */
function paraOAviso(l: LinhaComAviso): LinhaQueSeAvisa {
  return {
    id: l.id,
    estado: l.estado,
    contaDeTeste: l.contaDeTeste,
    temWhatsApp: l.avisoDaApp?.temWhatsApp === true,
    avisadoEm: l.avisoDaApp?.avisadoEm ?? null,
  };
}

/** O texto do aviso desta linha (o que se vê na pré-visualização). */
function textoDaLinha(l: LinhaComAviso): string {
  return textoDoAvisoDaAppPro({
    nome: l.nome,
    estado: l.estado === "parou" ? "parou" : "nunca",
    inscritoEm: l.inscritoEm ?? null,
    abertaEm: l.abertaEm,
    naoGmail: l.naoGmail,
  });
}

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function quando(v: string | null): string {
  const d = instanteDaBase(v);
  return d ? dataEHoraEmLisboa(d) : "—";
}

export default function QuemContaParaOs12({ app, tema }: { app: AppDoTeste; tema: "escuro" | "claro" }) {
  const { token, ready } = useAdminAuth();
  const t = TEMAS[tema];
  const [quadro, setQuadro] = useState<Quadro | null>(null);
  const [erro, setErro] = useState("");
  const [aCarregar, setACarregar] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [colar, setColar] = useState(false);
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState<EstadoDeUso | "todos">("todos");
  const [avisos, setAvisos] = useState("");
  // d134: a pré-visualização de um aviso (nada sai sem «Enviar») e o «Avisar todos».
  const [previa, setPrevia] = useState<{ linha: LinhaComAviso; texto: string } | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [erroDoAviso, setErroDoAviso] = useState("");
  const [massa, setMassa] = useState<{ ids: string[]; ver: string | null } | null>(null);
  const [progresso, setProgresso] = useState<{
    feitos: number;
    falharam: number;
    total: number;
    aCorrer: boolean;
    proximo: string;
  } | null>(null);
  const parar = useRef(false);

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    try {
      const res = await fetch(`/api/admin/quem-conta-para-os-12?app=${app}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const d = (await res.json().catch(() => ({}))) as Quadro & { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Não consegui ler o quadro.");
      setQuadro(d);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui ler o quadro.");
    } finally {
      setACarregar(false);
    }
  }, [token, app]);

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);

  async function guardar(lista: string) {
    if (!token) return;
    setAGuardar(true);
    try {
      const res = await fetch("/api/admin/quem-conta-para-os-12", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ app, lista }),
      });
      const d = (await res.json().catch(() => ({}))) as Quadro & {
        error?: string;
        avisos?: { avisados: number; falharam: number; desligado?: boolean } | null;
      };
      if (!res.ok) throw new Error(d.error ?? "Não consegui guardar a lista.");
      setQuadro(d);
      // O aviso «Já pode entrar no teste» (d6, 18-11-2026): só a quem passou a estar na lista, uma vez.
      setAvisos(
        d.avisos?.desligado
          ? "O aviso «Já pode instalar» da app de cliente está desligado: não saiu nada."
          : d.avisos && (d.avisos.avisados || d.avisos.falharam)
          ? `Avisados agora (email/app): ${d.avisos.avisados}${d.avisos.falharam ? ` · sem caminho para avisar: ${d.avisos.falharam}` : ""}.`
          : "",
      );
      setErro("");
      setColar(false);
      setTexto("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui guardar a lista.");
    } finally {
      setAGuardar(false);
    }
  }

  /** Marca a linha como avisada, sem voltar a ler o quadro. */
  function marcarAvisado(id: string, avisadoEm: string) {
    setQuadro((q) =>
      q
        ? {
            ...q,
            linhas: q.linhas.map((l) =>
              l.id === id ? { ...l, avisoDaApp: { temWhatsApp: l.avisoDaApp?.temWhatsApp ?? true, avisadoEm } } : l,
            ),
          }
        : q,
    );
  }

  /** UM aviso pelo WhatsApp da plataforma. Só os botões «Enviar» o chamam. */
  async function enviarAviso(l: LinhaComAviso, textoDoAviso: string): Promise<string | null> {
    if (!token) return "Sem sessão.";
    try {
      const res = await fetch("/api/admin/quem-conta-para-os-12/avisar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: l.id, texto: textoDoAviso }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; avisadoEm?: string | null };
      if (d.avisadoEm) marcarAvisado(l.id, d.avisadoEm);
      if (!res.ok) return d.error ?? "O aviso não saiu.";
      return null;
    } catch {
      return "O aviso não saiu.";
    }
  }

  async function enviarAPrevia() {
    if (!previa) return;
    setAEnviar(true);
    const falhou = await enviarAviso(previa.linha, previa.texto);
    setAEnviar(false);
    if (falhou) {
      setErroDoAviso(falhou);
      return;
    }
    setErroDoAviso("");
    setPrevia(null);
    setAvisos(`Aviso enviado pelo WhatsApp a ${previa.linha.nome}.`);
  }

  /** «Avisar todos os que nunca entraram»: um a um, com 20 a 45 s entre cada. */
  async function enviarATodos() {
    if (!massa || !quadro) return;
    const escolhidos = quadro.linhas.filter(
      (l) => massa.ids.includes(l.id) && podeAvisarAgora(paraOAviso(l), new Date()),
    );
    if (escolhidos.length === 0) return;
    parar.current = false;
    const total = escolhidos.length;
    let feitos = 0;
    let falharam = 0;
    for (let i = 0; i < total; i += 1) {
      if (parar.current) break;
      const l = escolhidos[i];
      setProgresso({ feitos, falharam, total, aCorrer: true, proximo: `a enviar a ${l.nome}` });
      const falhou = await enviarAviso(l, textoDaLinha(l));
      if (falhou) falharam += 1;
      else feitos += 1;
      if (i < total - 1 && !parar.current) {
        const s = intervaloAoAcaso();
        setProgresso({ feitos, falharam, total, aCorrer: true, proximo: `o próximo dentro de ${s} s` });
        await esperar(s * 1000);
      }
    }
    setProgresso({ feitos, falharam, total, aCorrer: false, proximo: "" });
    setAvisos(`Avisados pelo WhatsApp: ${feitos}${falharam ? ` · não saíram: ${falharam}` : ""}.`);
  }

  const nomeDaApp = app === "pro" ? "CLYON Pro" : "app de cliente";
  const comAviso = app === "pro";
  const paraAvisarEmMassa = comAviso ? quemAvisarEmMassa((quadro?.linhas ?? []).map(paraOAviso), new Date()) : [];
  const linhas = (quadro?.linhas ?? []).filter((l) => filtro === "todos" || l.estado === filtro);

  return (
    <section className={t.caixa} aria-labelledby={`quem-conta-${app}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`quem-conta-${app}`} className={t.titulo}>
            Quem conta para os 12 — {nomeDaApp}
          </h3>
          <p className={`mt-1 max-w-2xl ${t.texto}`}>
            A Play Console diz quantos testadores participam, não quem. «Usa» é quem abriu a app nos últimos{" "}
            {DIAS_DO_TESTE} dias — compare o total com o número da Play. Ligue a quem parou ou nunca entrou e
            pergunte porquê.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {comAviso && quadro && (
            <button
              type="button"
              className={t.botao}
              disabled={paraAvisarEmMassa.length === 0 || progresso?.aCorrer === true}
              onClick={() => {
                setProgresso(null);
                setMassa({ ids: paraAvisarEmMassa.map((l) => l.id), ver: paraAvisarEmMassa[0]?.id ?? null });
              }}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Avisar todos os que nunca entraram ({paraAvisarEmMassa.length})
            </button>
          )}
          <button type="button" className={t.botao} onClick={() => setColar((v) => !v)}>
            <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
            Colar a lista da Play
          </button>
          <button type="button" className={t.botao} onClick={() => void carregar()} disabled={aCarregar}>
            {aCarregar ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            Atualizar
          </button>
        </div>
      </div>

      {erro && <p className={`mt-3 text-sm ${t.erro}`}>{erro}</p>}
      {avisos && <p className={`mt-3 text-sm ${t.forte}`}>{avisos}</p>}

      {comAviso && massa && quadro && (
        <div className={`mt-4 rounded-xl border px-3 py-3 ${tema === "escuro" ? "border-slate-700" : "border-slate-200"}`}>
          <div className="flex items-start justify-between gap-2">
            <p className={t.forte}>Avisar no WhatsApp quem nunca entrou na app</p>
            <button
              type="button"
              aria-label="Fechar"
              className={t.botao}
              disabled={progresso?.aCorrer === true}
              onClick={() => setMassa(null)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className={`mt-1 ${t.fraco}`}>
            Sai um a um, pelo WhatsApp da plataforma, com 20 a 45 segundos entre cada: não feche esta página até
            acabar. Quem já foi avisado hoje fica de fora. Carregue num nome para ver o texto dessa pessoa.
          </p>
          <ul className="mt-2 space-y-1">
            {quadro.linhas
              .filter((l) => paraAvisarEmMassa.some((x) => x.id === l.id))
              .map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Avisar ${l.nome}`}
                    checked={massa.ids.includes(l.id)}
                    disabled={progresso?.aCorrer === true}
                    onChange={(e) =>
                      setMassa((m) =>
                        m ? { ...m, ids: e.target.checked ? [...m.ids, l.id] : m.ids.filter((x) => x !== l.id) } : m,
                      )
                    }
                  />
                  <button
                    type="button"
                    className={`text-left text-sm ${t.link}`}
                    onClick={() => setMassa((m) => (m ? { ...m, ver: l.id } : m))}
                  >
                    {l.nome}
                  </button>
                  <span className={t.fraco}>{l.telefone}</span>
                  {rotuloDoAvisado(l.avisoDaApp?.avisadoEm) && (
                    <span className={t.fraco}>{rotuloDoAvisado(l.avisoDaApp?.avisadoEm)}</span>
                  )}
                </li>
              ))}
          </ul>
          {(() => {
            const visto = quadro.linhas.find((l) => l.id === massa.ver);
            return visto ? (
              <pre
                className={`mt-3 whitespace-pre-wrap rounded-lg border p-2 font-sans text-xs ${
                  tema === "escuro" ? "border-slate-800 text-slate-300" : "border-slate-200 text-slate-700"
                }`}
              >
                {textoDaLinha(visto)}
              </pre>
            ) : null;
          })()}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {progresso?.aCorrer ? (
              <button type="button" className={t.botao} onClick={() => (parar.current = true)}>
                Parar
              </button>
            ) : (
              <button
                type="button"
                className={t.botao}
                disabled={massa.ids.length === 0}
                onClick={() => void enviarATodos()}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                Enviar a {massa.ids.length}, um a um
              </button>
            )}
            {progresso && (
              <span className={t.texto}>
                {progresso.feitos + progresso.falharam} de {progresso.total} · enviados: {progresso.feitos}
                {progresso.falharam ? ` · não saíram: ${progresso.falharam}` : ""}
                {progresso.aCorrer && progresso.proximo ? ` · ${progresso.proximo}` : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {comAviso && previa && (
        <div className={`mt-4 rounded-xl border px-3 py-3 ${tema === "escuro" ? "border-slate-700" : "border-slate-200"}`}>
          <p className={t.forte}>
            Aviso no WhatsApp para {previa.linha.nome}
            {previa.linha.telefone ? ` (${previa.linha.telefone})` : ""}
          </p>
          <p className={`mt-1 ${t.fraco}`}>Reveja e altere o texto se quiser. Só sai ao carregar em «Enviar».</p>
          <label className="sr-only" htmlFor="texto-do-aviso-da-app">
            Texto do aviso
          </label>
          <textarea
            id="texto-do-aviso-da-app"
            rows={12}
            value={previa.texto}
            onChange={(e) => setPrevia((p) => (p ? { ...p, texto: e.target.value } : p))}
            className={`mt-2 ${t.campo} font-sans`}
          />
          {erroDoAviso && <p className={`mt-2 text-sm ${t.erro}`}>{erroDoAviso}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={t.botao}
              disabled={aEnviar || !previa.texto.trim()}
              onClick={() => void enviarAPrevia()}
            >
              {aEnviar ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              Enviar
            </button>
            <button
              type="button"
              className={t.botao}
              disabled={aEnviar}
              onClick={() => {
                setPrevia(null);
                setErroDoAviso("");
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {quadro && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(["todos", "usa", "parou", "nunca"] as const).map((f) => {
            const n = f === "todos" ? quadro.linhas.length : quadro.totais[f];
            return (
              <button
                key={f}
                type="button"
                aria-pressed={filtro === f}
                onClick={() => setFiltro(f)}
                className={`${t.filtro} ${filtro === f ? t.filtroOn : t.filtroOff}`}
              >
                {f === "todos" ? "Todos" : ROTULOS_DO_USO[f]}: {n}
              </button>
            );
          })}
          <span className={`ml-auto text-sm ${t.forte}`}>
            Usa: {quadro.totais.usa}
            {quadro.usaNaPlay !== null && ` (${quadro.usaNaPlay} na lista da Play)`} — a Play precisa de 12
          </span>
        </div>
      )}

      {quadro?.percursos && (
        <div className={`mt-4 rounded-xl border px-3 py-3 ${tema === "escuro" ? "border-slate-800" : "border-slate-200"}`}>
          <p className={t.forte}>Na ligação do convite</p>
          <p className={`mt-1 ${t.texto}`}>
            Com ligação: {quadro.percursos.comLink} · clicaram: {quadro.percursos.clicaram}
            {quadro.percursos.comLink > 0 &&
              ` (${Math.round((quadro.percursos.clicaram / quadro.percursos.comLink) * 100)} %)`}
            {quadro.percursos.clicaram > 0 &&
              ` · iPhone: ${quadro.percursos.percentIphone} % · computador: ${quadro.percursos.percentPc} % · Android: ${quadro.percursos.porAparelho.android}`}
          </p>
          {quadro.percursos.motivos.length > 0 ? (
            <ul className={`mt-2 space-y-0.5 ${t.texto}`}>
              {quadro.percursos.motivos.map((m) => (
                <li key={`${m.passo}-${m.motivo}`}>
                  Passo {m.passo} ({PASSOS_DA_ADESAO[m.passo]}): {ROTULOS_DO_MOTIVO[m.motivo]} — {m.n}
                </li>
              ))}
            </ul>
          ) : (
            <p className={`mt-1 ${t.fraco}`}>Ainda ninguém carregou em «Não consegui».</p>
          )}
        </div>
      )}

      {colar && (
        <div className="mt-4 space-y-2">
          <label className={`block ${t.texto}`} htmlFor={`lista-da-play-${app}`}>
            Cole os emails da lista de testadores (Play Console › Testes › Teste fechado › Testadores), separados
            por vírgulas ou linhas. Fica guardada a última lista colada.
            {app === "pro"
              ? " Quem passar a estar na lista e ainda não abriu a app recebe, uma vez, o aviso «Já pode entrar no teste»."
              : " O aviso «Já pode instalar» da app de cliente está desligado; quando se ligar, sai uma vez a quem nos deu o Gmail e passou a estar na lista."}
          </label>
          <textarea
            id={`lista-da-play-${app}`}
            rows={4}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className={t.campo}
            placeholder="nome@gmail.com, outro@gmail.com"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={t.botao} disabled={aGuardar || !texto.trim()} onClick={() => void guardar(texto)}>
              {aGuardar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Guardar e cruzar
            </button>
            {quadro?.listaColada && (
              <button type="button" className={t.botao} disabled={aGuardar} onClick={() => void guardar("")}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Apagar a lista guardada
              </button>
            )}
          </div>
        </div>
      )}

      {quadro?.listaColada && (
        <p className={`mt-3 ${t.fraco}`}>
          Lista da Play: {quadro.lista.emails.length} emails, colada a {quando(quadro.lista.coladaEm)}
          {quadro.lista.porQuem ? ` por ${quadro.lista.porQuem}` : ""}.
        </p>
      )}

      {quadro && quadro.linhas.length === 0 && !erro && (
        <p className={`mt-4 ${t.texto}`}>Ainda ninguém no teste desta app.</p>
      )}

      {linhas.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className={t.cabeca}>
                <th className="py-2 pr-3 font-semibold">Pessoa</th>
                <th className="py-2 pr-3 font-semibold">Estado</th>
                <th className="py-2 pr-3 font-semibold">Última abertura</th>
                <th className="py-2 pr-3 font-semibold">Telefone</th>
                <th className="py-2 pr-3 font-semibold">Lista da Play</th>
                {quadro?.percursos && <th className="py-2 font-semibold">Na ligação do convite</th>}
                {comAviso && <th className="py-2 pl-3 text-right font-semibold">Aviso</th>}
              </tr>
            </thead>
            <tbody className={t.tabela}>
              {linhas.map((l) => {
                const tel = telefoneParaLigar(l.telefone);
                return (
                  <tr key={l.id} className="align-top">
                    <td className="py-2.5 pr-3">
                      <div className={t.forte}>
                        {l.nome}
                        {l.contaDeTeste && <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] ${t.marca}`}>conta de teste</span>}
                      </div>
                      <div className={`font-mono ${t.fraco}`}>{l.emails.join(" · ") || "sem email"}</div>
                      <div className={t.fraco}>{l.porque}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${t.estado[l.estado]}`}>
                        {ROTULOS_DO_USO[l.estado]}
                      </span>
                    </td>
                    <td className={`py-2.5 pr-3 whitespace-nowrap ${t.texto}`}>
                      {l.abertaEm ? quando(l.abertaEm) : l.temAvisosDaApp ? "antes de 27/10 (avisos ligados)" : "—"}
                      {l.versao && <div className={t.fraco}>versão {l.versao}</div>}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {tel ? (
                        <a href={`tel:${tel}`} className={`inline-flex items-center gap-1 ${t.link}`}>
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                          {l.telefone}
                        </a>
                      ) : (
                        <span className={t.fraco}>sem telefone</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {quadro?.listaColada &&
                          (l.emailNaPlay ? (
                            <span className={`rounded px-1.5 py-0.5 text-[11px] ${t.marca}`}>na lista</span>
                          ) : (
                            <span className={`rounded px-1.5 py-0.5 text-[11px] ${t.marcaAviso}`}>fora da lista da Play</span>
                          ))}
                        {l.naoGmail && (
                          <span className={`rounded px-1.5 py-0.5 text-[11px] ${t.marcaAviso}`}>
                            a Play pode não reconhecer este email
                          </span>
                        )}
                      </div>
                    </td>
                    {quadro?.percursos && (
                      <td className={`py-2.5 ${t.texto}`}>
                        <div className={l.percurso?.naoConsegui ? t.aviso : undefined}>{ultimoPassoEmPalavras(l.percurso ?? null)}</div>
                        {l.percurso?.naoConsegui?.texto && <div className={t.fraco}>«{l.percurso.naoConsegui.texto}»</div>}
                        {l.percurso && l.percurso.aparelhos.length > 0 && (
                          <div className={t.fraco}>
                            {l.percurso.aparelhos.map((a) => ROTULOS_DO_APARELHO[a]).join(" · ")} · {l.percurso.cliques} clique(s)
                            {l.percurso.cliqueEm ? ` · 1.º a ${quando(l.percurso.cliqueEm)}` : ""}
                          </div>
                        )}
                      </td>
                    )}
                    {comAviso && (
                      <td className="py-2.5 pl-3 text-right">
                        {estadoQueSeAvisa(l.estado) &&
                          (podeAvisarAgora(paraOAviso(l), new Date()) ? (
                            <button
                              type="button"
                              className={`ml-auto whitespace-nowrap ${t.botao}`}
                              onClick={() => {
                                setErroDoAviso("");
                                setPrevia({ linha: l, texto: textoDaLinha(l) });
                              }}
                            >
                              <MessageCircle className="h-4 w-4" aria-hidden="true" />
                              Avisar no WhatsApp
                            </button>
                          ) : !l.avisoDaApp?.temWhatsApp ? (
                            <span className={t.fraco}>sem telemóvel para o WhatsApp</span>
                          ) : null)}
                        {rotuloDoAvisado(l.avisoDaApp?.avisadoEm) && (
                          <div className={`mt-1 whitespace-nowrap ${t.fraco}`}>{rotuloDoAvisado(l.avisoDaApp?.avisadoEm)}</div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {quadro && quadro.semConta.length > 0 && (
        <div className="mt-5">
          <h4 className={`flex items-center gap-2 text-sm ${t.forte}`}>
            <AlertTriangle className={`h-4 w-4 ${t.aviso}`} aria-hidden="true" />
            Na lista da Play, sem conta CLYON ({quadro.semConta.length})
          </h4>
          <p className={`mt-1 ${t.fraco}`}>Provável email errado — ou a pessoa entrou com outro email.</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {quadro.semConta.map((s) => (
              <li key={s.email} className={`rounded-lg px-2 py-1 font-mono text-xs ${s.gmail ? t.marca : t.marcaAviso}`}>
                {s.email}
                {!s.gmail && " — a Play pode não reconhecer este email"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
