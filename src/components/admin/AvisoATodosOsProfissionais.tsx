"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import {
  CAMINHO_DO_SABER_MAIS,
  INTERVALO_DO_WHATSAPP_S,
  JANELA_DO_WHATSAPP,
  NOME_DO_INTERRUPTOR_DO_AVISO,
  comONome,
  htmlDoEmailDoAviso,
  type Canal,
  type ConteudoDoAviso,
} from "@/lib/aviso-aos-profissionais";

/**
 * «AVISO A TODOS OS PROFISSIONAIS» — d11 (15-11-2026). Só o administrador.
 *
 * Quem recebe (só contagens e ids), o texto do email e do WhatsApp com versão,
 * a pré-visualização, «Enviar teste para mim», e o envio: email pelo Resend em
 * lotes, WhatsApp pela ponte um de cada vez (20–45 s ao acaso, 9h–21h de
 * Lisboa), cada profissional uma só vez por canal, com «Parar» e o registo de
 * cada destinatário. Nada sai sem escrever ENVIAR.
 */

type Estado = "pendente" | "a_enviar" | "enviado" | "falhou" | "parado";
type Versao = ConteudoDoAviso & { id: number; criadoEm: string | null; porQuem: string | null };
type Dados = {
  destinatarios: { total: number; comEmail: number; comWhatsApp: number; semContacto: number; ids: number[] };
  contadores: Record<Canal, Record<Estado, number>>;
  envio: {
    id: number;
    estado: string;
    canais: Canal[];
    versaoId: number;
    criadoEm: string | null;
    porQuem: string | null;
    paradoEm: string | null;
    terminadoEm: string | null;
    proximoWhatsAppEmS: number | null;
  } | null;
  foraDaJanelaAgora: boolean;
  whatsappLigado: boolean;
  linhas: Array<{ providerId: number; canal: Canal; estado: Estado; motivo: string | null; enviadoEm: string | null }>;
  interruptor: { ligado: boolean };
  versoes: Versao[];
  emVigor: ConteudoDoAviso & { versaoId: number | null };
};

const ROTULO: Record<Estado, string> = {
  pendente: "por enviar",
  a_enviar: "a enviar",
  enviado: "enviados",
  falhou: "falharam",
  parado: "parados",
};

const lisboa = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" })
    : "—";

export default function AvisoATodosOsProfissionais() {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [texto, setTexto] = useState<ConteudoDoAviso | null>(null);
  const [aOcupar, setAOcupar] = useState(false);
  const [testeEmail, setTesteEmail] = useState("");
  const [testeTelefone, setTesteTelefone] = useState("");
  const [canais, setCanais] = useState<Canal[]>(["email", "whatsapp"]);
  const [confirmacao, setConfirmacao] = useState("");
  const [verIds, setVerIds] = useState(false);
  const [verLinhas, setVerLinhas] = useState(false);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/aviso-aos-profissionais", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível ler o aviso.");
        return;
      }
      setDados(d as Dados);
      setTexto((t) => t ?? { titulo: d.emVigor.titulo, textoEmail: d.emVigor.textoEmail, textoWhatsApp: d.emVigor.textoWhatsApp });
    } catch {
      setErro("Erro de rede.");
    }
  }, [token]);

  useEffect(() => {
    if (ready && eAdministrador) void ler();
  }, [ready, eAdministrador, ler]);

  const aEnviar = dados?.envio?.estado === "a_enviar";

  // Contadores ao vivo: de 5 em 5 s com um envio a correr; e a página também empurra o motor.
  useEffect(() => {
    if (!token || !aEnviar) return;
    const ver = window.setInterval(() => void ler(), 5000);
    const empurrar = window.setInterval(() => {
      void fetch("/api/admin/aviso-aos-profissionais", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ accao: "avancar" }),
      }).catch(() => {});
    }, 8000);
    return () => {
      window.clearInterval(ver);
      window.clearInterval(empurrar);
    };
  }, [token, aEnviar, ler]);

  async function pedir(corpo: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (!token) return null;
    setAOcupar(true);
    setErro("");
    setAviso("");
    try {
      const r = await fetch("/api/admin/aviso-aos-profissionais", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível.");
        return null;
      }
      return d as Record<string, unknown>;
    } catch {
      setErro("Erro de rede.");
      return null;
    } finally {
      setAOcupar(false);
    }
  }

  const ultima = dados?.versoes[0] ?? null;
  const igualAUltima = Boolean(
    ultima &&
      texto &&
      ultima.titulo === texto.titulo.trim() &&
      ultima.textoEmail === texto.textoEmail.replace(/\r\n/g, "\n").trim() &&
      ultima.textoWhatsApp === texto.textoWhatsApp.replace(/\r\n/g, "\n").trim(),
  );

  const htmlDaPrevia = useMemo(
    () =>
      texto
        ? htmlDoEmailDoAviso({
            titulo: texto.titulo,
            texto: comONome(texto.textoEmail, "Nome"),
            urlDoPerfil: "#",
          })
        : "",
    [texto],
  );

  if (!eAdministrador) return null;
  if (!dados || !texto) {
    return <p className="text-sm text-slate-400">{erro || "A carregar…"}</p>;
  }

  const ligaAoSaberMais = texto.textoEmail.includes(CAMINHO_DO_SABER_MAIS) || texto.textoWhatsApp.includes(CAMINHO_DO_SABER_MAIS);
  const caixa = "rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4";
  const campo =
    "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500";
  const botao = "rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50";

  return (
    <div className="space-y-4">
      {erro && <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">{erro}</p>}
      {aviso && <p className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">{aviso}</p>}

      {/* ── Quem recebe ─────────────────────────────────────────────────── */}
      <div className={caixa}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Quem recebe</p>
        <p className="mt-1 text-sm text-slate-300">
          Profissionais aprovados e activos, sem contas de teste nem a conta da casa. Cada um recebe este aviso uma só
          vez em cada canal.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Profissionais", dados.destinatarios.total],
            ["Com email", dados.destinatarios.comEmail],
            ["Com WhatsApp", dados.destinatarios.comWhatsApp],
            ["Sem contacto", dados.destinatarios.semContacto],
          ].map(([r, n]) => (
            <div key={String(r)} className="rounded-xl border border-slate-700/60 px-3 py-2">
              <p className="text-xs text-slate-400">{r}</p>
              <p className="text-xl font-semibold text-white">{n}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setVerIds((v) => !v)} className="mt-3 text-xs text-sky-300 underline">
          {verIds ? "Esconder os ids" : "Ver os ids"}
        </button>
        {verIds && <p className="mt-2 break-words text-xs text-slate-400">{dados.destinatarios.ids.join(", ") || "—"}</p>}
      </div>

      {/* ── O texto ─────────────────────────────────────────────────────── */}
      <div className={caixa}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">O texto</p>
        <p className="mt-1 text-sm text-slate-300">
          {ultima
            ? `Versão ${ultima.id}, guardada a ${lisboa(ultima.criadoEm)} por ${ultima.porQuem ?? "—"}${igualAUltima ? "" : " — com alterações por guardar"}.`
            : "Ainda é o rascunho da d11: nada guardado."}{" "}
          {"{nome}"} é o primeiro nome. No email: uma linha em branco separa parágrafos, «### » é um subtítulo, «- » ou
          «1. » fazem listas, **assim** fica a negrito. No WhatsApp, *assim* é negrito.
        </p>
        <label className="mt-3 block text-xs text-slate-400">Título (o assunto do email e o título da página)</label>
        <input className={campo} value={texto.titulo} onChange={(e) => setTexto({ ...texto, titulo: e.target.value })} />
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-400">Texto do email (e da página «Saber mais»)</label>
            <textarea
              className={`${campo} h-80 font-mono text-xs`}
              value={texto.textoEmail}
              onChange={(e) => setTexto({ ...texto, textoEmail: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400">Texto do WhatsApp</label>
            <textarea
              className={`${campo} h-80 font-mono text-xs`}
              value={texto.textoWhatsApp}
              onChange={(e) => setTexto({ ...texto, textoWhatsApp: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={aOcupar || igualAUltima}
            onClick={async () => {
              const d = await pedir({ accao: "guardar", ...texto });
              if (d) {
                setAviso("Versão guardada.");
                setTexto(null);
                await ler();
              }
            }}
            className={`${botao} bg-sky-600 text-white`}
          >
            Guardar versão
          </button>
          {dados.versoes.length > 1 && (
            <select
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-200"
              value=""
              onChange={(e) => {
                const v = dados.versoes.find((x) => x.id === Number(e.target.value));
                if (v) setTexto({ titulo: v.titulo, textoEmail: v.textoEmail, textoWhatsApp: v.textoWhatsApp });
              }}
            >
              <option value="">Abrir uma versão anterior…</option>
              {dados.versoes.map((v) => (
                <option key={v.id} value={v.id}>
                  Versão {v.id} — {lisboa(v.criadoEm)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Pré-visualização ─────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={caixa}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Email</p>
          <p className="mt-1 text-xs text-slate-400">Assunto: {texto.titulo}</p>
          <iframe title="Pré-visualização do email" sandbox="" srcDoc={htmlDaPrevia} className="mt-2 h-[520px] w-full rounded-lg bg-white" />
        </div>
        <div className={caixa}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">WhatsApp</p>
          <div className="mt-2 rounded-lg bg-[#0b141a] p-3">
            <div className="ml-auto max-w-[92%] whitespace-pre-wrap rounded-lg bg-[#005c4b] px-3 py-2 text-sm leading-6 text-white">
              {comONome(texto.textoWhatsApp, "Nome")}
            </div>
          </div>
        </div>
      </div>

      {/* ── Teste ───────────────────────────────────────────────────────── */}
      <div className={caixa}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Enviar teste para mim</p>
        <p className="mt-1 text-sm text-slate-300">
          Envia o texto que está no editor (guardado ou não) só para o email e/ou telemóvel que escrever aqui. Não conta
          como envio a ninguém da lista, e recusa contactos de profissionais da lista.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input className={campo} placeholder="O seu email" value={testeEmail} onChange={(e) => setTesteEmail(e.target.value)} />
          <input className={campo} placeholder="O seu telemóvel" value={testeTelefone} onChange={(e) => setTesteTelefone(e.target.value)} />
        </div>
        <button
          type="button"
          disabled={aOcupar || (!testeEmail.trim() && !testeTelefone.trim())}
          onClick={async () => {
            const d = await pedir({ accao: "teste", ...texto, email: testeEmail, telefone: testeTelefone });
            if (d) {
              setAviso(
                [d.email ? `Email: ${String(d.email)}` : null, d.whatsapp ? `WhatsApp: ${String(d.whatsapp)}` : null]
                  .filter(Boolean)
                  .join(" · "),
              );
            }
          }}
          className={`${botao} mt-3 bg-slate-700 text-white`}
        >
          Enviar teste para mim
        </button>
      </div>

      {/* ── O envio ─────────────────────────────────────────────────────── */}
      <div className={caixa}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Envio a todos</p>
        <p className="mt-1 text-sm text-slate-300">
          Email pelo Resend, em lotes pequenos. WhatsApp pela ponte, um de cada vez, com {INTERVALO_DO_WHATSAPP_S.min} a{" "}
          {INTERVALO_DO_WHATSAPP_S.max} s ao acaso entre mensagens, só das {JANELA_DO_WHATSAPP.das}h às{" "}
          {JANELA_DO_WHATSAPP.as}h de Lisboa (fora disso espera pelas {JANELA_DO_WHATSAPP.das}h). As respostas chegam à
          Mesa das conversas como hoje. Com esta página fechada, o envio continua a cada ronda da ponte.
        </p>
        {ligaAoSaberMais && !dados.interruptor.ligado && (
          <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
            O texto liga para a página «Saber mais», que só abre com «{NOME_DO_INTERRUPTOR_DO_AVISO}» ligado nas Configs.
            O envio fica recusado até lá.
          </p>
        )}
        {!dados.whatsappLigado && (
          <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
            O WhatsApp está desligado no painel: os WhatsApp esperam até ser ligado.
          </p>
        )}

        {dados.envio && (
          <div className="mt-3 rounded-xl border border-slate-700/60 px-3 py-2 text-sm text-slate-300">
            Envio {dados.envio.id} ({dados.envio.canais.join(" e ")}, versão {dados.envio.versaoId}) —{" "}
            <span className="font-semibold text-white">
              {dados.envio.estado === "a_enviar" ? "a enviar" : dados.envio.estado}
            </span>
            , começado a {lisboa(dados.envio.criadoEm)} por {dados.envio.porQuem ?? "—"}
            {dados.envio.paradoEm ? `; parado a ${lisboa(dados.envio.paradoEm)}` : ""}
            {dados.envio.terminadoEm ? `; terminado a ${lisboa(dados.envio.terminadoEm)}` : ""}.
            {aEnviar && dados.envio.canais.includes("whatsapp") && (
              <span className="block text-xs text-slate-400">
                {dados.foraDaJanelaAgora
                  ? `WhatsApp fora da janela: retoma às ${JANELA_DO_WHATSAPP.das}h de Lisboa.`
                  : dados.envio.proximoWhatsAppEmS
                    ? `Próximo WhatsApp daqui a ~${dados.envio.proximoWhatsAppEmS} s.`
                    : "Próximo WhatsApp na ronda seguinte da ponte."}
              </span>
            )}
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["email", "whatsapp"] as Canal[]).map((c) => (
            <div key={c} className="rounded-xl border border-slate-700/60 px-3 py-2">
              <p className="text-sm font-semibold text-white">{c === "email" ? "Email" : "WhatsApp"}</p>
              <p className="mt-1 text-xs text-slate-300">
                {(Object.keys(ROTULO) as Estado[])
                  .map((e) => `${dados.contadores[c][e]} ${ROTULO[e]}`)
                  .join(" · ")}
              </p>
            </div>
          ))}
        </div>

        {aEnviar ? (
          <button
            type="button"
            disabled={aOcupar}
            onClick={async () => {
              const d = await pedir({ accao: "parar" });
              if (d) {
                setAviso(d.parado ? "Envio parado. Os que já saíram ficam enviados." : "Não havia envio a correr.");
                await ler();
              }
            }}
            className={`${botao} mt-3 bg-red-600 text-white`}
          >
            Parar
          </button>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-4 text-sm text-slate-200">
              {(["email", "whatsapp"] as Canal[]).map((c) => (
                <label key={c} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={canais.includes(c)}
                    onChange={(e) => setCanais((cs) => (e.target.checked ? [...cs, c] : cs.filter((x) => x !== c)))}
                  />
                  {c === "email" ? "Email" : "WhatsApp"}
                </label>
              ))}
            </div>
            {!igualAUltima && <p className="text-xs text-amber-300">Guarde o texto antes de enviar: sai a última versão guardada.</p>}
            <div className="flex flex-wrap items-center gap-3">
              <input
                className={`${campo} max-w-[200px]`}
                placeholder="Escreva ENVIAR"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
              />
              <button
                type="button"
                disabled={aOcupar || !igualAUltima || !ultima || canais.length === 0 || confirmacao.trim().toUpperCase() !== "ENVIAR"}
                onClick={async () => {
                  const d = await pedir({ accao: "comecar", versaoId: ultima?.id, canais, confirmacao });
                  if (d) {
                    setAviso(`Envio começado: ${String(d.novos)} novos, ${String(d.retomados)} retomados.`);
                    setConfirmacao("");
                    await ler();
                  }
                }}
                className={`${botao} bg-emerald-600 text-white`}
              >
                Enviar a todos
              </button>
            </div>
          </div>
        )}

        <button type="button" onClick={() => setVerLinhas((v) => !v)} className="mt-4 block text-xs text-sky-300 underline">
          {verLinhas ? "Esconder o registo por destinatário" : `Ver o registo por destinatário (${dados.linhas.length})`}
        </button>
        {verLinhas && (
          <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-slate-700/60">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="sticky top-0 bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-2 py-1">Profissional (id)</th>
                  <th className="px-2 py-1">Canal</th>
                  <th className="px-2 py-1">Estado</th>
                  <th className="px-2 py-1">Quando</th>
                  <th className="px-2 py-1">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {dados.linhas.map((l) => (
                  <tr key={`${l.providerId}-${l.canal}`} className="border-t border-slate-800">
                    <td className="px-2 py-1">#{l.providerId}</td>
                    <td className="px-2 py-1">{l.canal === "email" ? "Email" : "WhatsApp"}</td>
                    <td className="px-2 py-1">{ROTULO[l.estado] ?? l.estado}</td>
                    <td className="px-2 py-1">{lisboa(l.enviadoEm)}</td>
                    <td className="px-2 py-1">{l.motivo ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
