"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, Send, Smartphone, X } from "lucide-react";
import {
  ASSUNTO_DO_CONVITE,
  LINK_DE_ADESAO_SUGERIDO,
  PRE_CABECALHO_DO_CONVITE,
  linkDeAdesaoValido,
  textoDoConvite,
} from "@/lib/convite-app-cliente";
import { preencherTexto } from "@/lib/seguimento-da-app";
import { TEXTO_DO_CONVITE_POR_WHATSAPP } from "@/lib/textos-do-seguimento-da-app";

/*
 * O CONVITE PARA TESTAR A APP DE CLIENTE — 01-11-2026 (ordem do CEO, aprovada
 * pelo dono). Só o administrador vê o botão. O envio a todos é do dono, depois
 * de a Play aprovar o teste fechado; para provar, «Enviar só para mim».
 */

type Estado = {
  link: string | null;
  destinatarios: number;
  porEnviar: number;
  jaReceberam: number;
  enviadosNoTotal: number;
  deFora: Record<string, number>;
  nomeDaPrimeira: string | null;
  /** d59 (17-11-2026): só um Gmail vai para a Play. */
  paraAPlay: number;
  faltaGmail: number;
  noPrograma: number;
  conviteQuePedeOGmailPronto: boolean;
  /** d59, parte 2 (17-11-2026): o convite novo — só contagens. */
  conviteNovo: { emails: number; whatsapps: number; jaReceberam: number; whatsappsPorSair: number };
};

const ROTULOS_DE_FORA: Record<string, string> = {
  desactivada: "desactivadas",
  "nao-e-cliente": "administradores",
  "sem-email": "sem email válido",
  profissional: "de profissionais",
  "de-teste": "de teste",
  "email-repetido": "email repetido",
};

export default function ConviteAppCliente({
  authToken,
  emailSugerido,
}: {
  authToken: string;
  /** O email de uma conta de administrador, para o «só para mim». */
  emailSugerido?: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [link, setLink] = useState("");
  const [meuEmail, setMeuEmail] = useState(emailSugerido ?? "");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const cabecalhos = { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" };

  const carregar = useCallback(async () => {
    setErro(null);
    const res = await fetch("/api/admin/convite-app-cliente", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(d.error ?? "Não foi possível ler as contas.");
      return;
    }
    setEstado(d as Estado);
    setLink((atual) => atual || (d as Estado).link || LINK_DE_ADESAO_SUGERIDO);
  }, [authToken]);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  useEffect(() => {
    if (emailSugerido && !meuEmail) setMeuEmail(emailSugerido);
  }, [emailSugerido, meuEmail]);

  const post = async (corpo: Record<string, unknown>) => {
    const res = await fetch("/api/admin/convite-app-cliente", {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify(corpo),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "Não foi possível concluir.");
    return d;
  };

  const linkLimpo = linkDeAdesaoValido(link);
  const linkGuardado = estado?.link ?? null;
  const linkPorGuardar = linkLimpo !== null && linkLimpo !== linkGuardado;

  const guardarLink = async () => {
    setOcupado("link"); setErro(null); setAviso(null);
    try {
      await post({ accao: "guardar-link", link });
      await carregar();
      setAviso("Link guardado.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setOcupado(null);
    }
  };

  const soParaMim = async () => {
    setOcupado("mim"); setErro(null); setAviso(null);
    try {
      await post({ accao: "so-para-mim", email: meuEmail });
      setAviso(`Enviado só para ${meuEmail}. Veja a caixa de entrada (e o spam).`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setOcupado(null);
    }
  };

  const enviarConviteNovo = async () => {
    if (!estado) return;
    const { emails, whatsapps } = estado.conviteNovo;
    const certeza = confirm(
      `Enviar o convite novo?\n\n` +
        `Vão sair ${emails} email${emails !== 1 ? "s" : ""} e ${whatsapps} WhatsApp ` +
        `(a quem tem telemóvel na conta).\n\n` +
        `Só contas com Gmail que ainda não aderiram, também as do convite de 01/11. ` +
        `Cada pessoa recebe-o uma vez. Os WhatsApp saem um de cada vez, 20 a 45 s entre cada, das 9h às 21h. ` +
        `3 dias depois sai um lembrete único a quem não aderir. Não se desfaz.`,
    );
    if (!certeza) return;
    setOcupado("novo"); setErro(null); setAviso(null);
    let total = 0;
    let porWhats = 0;
    try {
      for (;;) {
        const r = (await post({ accao: "enviar-convite-novo" })) as {
          enviados: number; falhados: number; whatsappsNaFila: number; restantes: number;
        };
        total += r.enviados;
        porWhats += r.whatsappsNaFila;
        setAviso(`A enviar… ${total} email${total !== 1 ? "s" : ""}, ${porWhats} WhatsApp na fila.`);
        if (r.falhados > 0) {
          setErro(`${r.falhados} não saíram (o serviço de email recusou). Pode tentar outra vez: só vão os que faltam.`);
          break;
        }
        if (r.enviados === 0 || r.restantes === 0) break;
      }
      setAviso(
        `Feito: ${total} email${total !== 1 ? "s" : ""} enviado${total !== 1 ? "s" : ""} e ${porWhats} WhatsApp na fila (saem espaçados pela ponte).`,
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setOcupado(null);
      await carregar();
    }
  };

  const enviarATodos = async () => {
    if (!estado) return;
    const certeza = confirm(
      `Enviar o convite a ${estado.porEnviar} conta${estado.porEnviar !== 1 ? "s" : ""} sem Gmail (o convite pede-lhes o Gmail do telemóvel)?\n\n` +
        `Sai devagar, uma a uma. Quem já recebeu não volta a receber. Não se desfaz.`,
    );
    if (!certeza) return;
    setOcupado("todos"); setErro(null); setAviso(null);
    let total = 0;
    try {
      for (;;) {
        const r = (await post({ accao: "enviar-lote" })) as {
          enviados: number; falhados: number; restantes: number;
        };
        total += r.enviados;
        setAviso(`A enviar… ${total} enviado${total !== 1 ? "s" : ""}.`);
        if (r.falhados > 0) {
          setErro(`${r.falhados} não saíram (o serviço de email recusou). Pode tentar outra vez: só vão os que faltam.`);
          break;
        }
        if (r.enviados === 0 || r.restantes === 0) break;
      }
      setAviso(`Feito: ${total} convite${total !== 1 ? "s" : ""} enviado${total !== 1 ? "s" : ""}.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setOcupado(null);
      await carregar();
    }
  };

  const descarregarCsv = async () => {
    setOcupado("csv"); setErro(null);
    try {
      const res = await fetch("/api/admin/convite-app-cliente?csv=1", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("Não foi possível descarregar.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "testadores-app-cliente.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setOcupado(null);
    }
  };

  const deFora = estado
    ? Object.entries(estado.deFora)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${ROTULOS_DE_FORA[k] ?? k}`)
        .join(" · ")
    : "";

  const caixa =
    "mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500";
  const botaoSec =
    "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50";

  return (
    <>
      <button onClick={() => setAberto(true)} className={botaoSec}>
        <Smartphone className="h-4 w-4" />
        Convidar para testar a app
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Convidar para testar a app de cliente</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Teste fechado da app CLYON na Google Play. Envie só depois de a Play aprovar o teste.
                </p>
              </div>
              <button onClick={() => setAberto(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" title="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>

            {!estado && !erro && (
              <p className="mt-6 flex items-center text-sm text-slate-400">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> A carregar…
              </p>
            )}

            {estado && (
              <div className="mt-5 space-y-5">
                <label className="block text-xs font-semibold text-slate-500">
                  Link de adesão da Play (obrigatório)
                  <div className="flex gap-2">
                    <input value={link} onChange={(e) => setLink(e.target.value)} className={caixa} placeholder={LINK_DE_ADESAO_SUGERIDO} />
                    <button
                      onClick={guardarLink}
                      disabled={!linkPorGuardar || ocupado !== null}
                      className="mt-1 h-10 shrink-0 rounded-xl bg-acao px-4 text-sm font-semibold text-white hover:bg-acao-hover disabled:opacity-50"
                    >
                      Guardar
                    </button>
                  </div>
                  {!linkLimpo && link && (
                    <span className="mt-1 block font-normal text-red-600">Tem de ser um link https://play.google.com/…</span>
                  )}
                  {!linkGuardado && (
                    <span className="mt-1 block font-normal text-amber-700">Ainda não há link guardado: guarde-o antes de enviar.</span>
                  )}
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">
                    Pré-visualização{estado.nomeDaPrimeira ? ` (com o nome da primeira conta)` : ""}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">Assunto: {ASSUNTO_DO_CONVITE}</p>
                  <p className="mt-1 text-xs text-slate-500">Pré-cabeçalho: {PRE_CABECALHO_DO_CONVITE}</p>
                  <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-700">
                    {textoDoConvite({ nome: estado.nomeDaPrimeira, link: linkLimpo ?? linkGuardado ?? LINK_DE_ADESAO_SUGERIDO })}
                  </pre>
                  <p className="mt-4 text-xs font-semibold text-slate-500">WhatsApp (a quem tem telemóvel na conta)</p>
                  <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-700">
                    {preencherTexto(TEXTO_DO_CONVITE_POR_WHATSAPP, {
                      Nome: estado.nomeDaPrimeira ?? "",
                      linkDeAdesao: linkLimpo ?? linkGuardado ?? LINK_DE_ADESAO_SUGERIDO,
                    })}
                  </pre>
                </div>

                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Convite novo</p>
                  <p className="mt-1">
                    Por enviar: <strong className="text-slate-900">{estado.conviteNovo.emails}</strong> email
                    {estado.conviteNovo.emails !== 1 ? "s" : ""} e{" "}
                    <strong className="text-slate-900">{estado.conviteNovo.whatsapps}</strong> WhatsApp ·{" "}
                    <strong className="text-slate-900">{estado.conviteNovo.jaReceberam}</strong> já receberam
                    {estado.conviteNovo.whatsappsPorSair > 0 && <> · {estado.conviteNovo.whatsappsPorSair} WhatsApp na fila</>}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Contas com Gmail que ainda não aderiram (também as do convite de 01/11), fora do Programa da app.
                    Cada pessoa recebe o convite novo uma vez e, 3 dias depois, no máximo um lembrete.
                  </p>
                </div>

                <div className="text-sm text-slate-700">
                  <p>
                    <strong className="text-slate-900">{estado.destinatarios}</strong> conta{estado.destinatarios !== 1 ? "s" : ""} de cliente recebem ·{" "}
                    <strong className="text-slate-900">{estado.jaReceberam}</strong> já receberam ·{" "}
                    <strong className="text-slate-900">{estado.porEnviar}</strong> por enviar
                  </p>
                  {deFora && <p className="mt-1 text-xs text-slate-400">Ficam de fora: {deFora}.</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    <strong className="text-slate-700">{estado.paraAPlay}</strong> com Gmail, prontas para a lista da Play
                    {estado.noPrograma > 0 && <> · {estado.noPrograma} já no Programa da app (seguem por lá)</>}
                  </p>
                  {estado.faltaGmail > 0 && (
                    <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <strong>{estado.faltaGmail}</strong> conta{estado.faltaGmail !== 1 ? "s" : ""} com email que não é Gmail:
                      falta o Gmail do telemóvel. Não vão para a lista da Play.{" "}
                      {estado.conviteQuePedeOGmailPronto
                        ? "O convite pede-lhes que respondam ao email com o Gmail do telemóvel («Pedir o Gmail aos sem Gmail»)."
                        : "Ficam fora do envio até o texto que pede o Gmail estar aprovado."}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold text-slate-500">Provar antes: enviar só para mim</p>
                  <div className="mt-1 flex gap-2">
                    <input value={meuEmail} onChange={(e) => setMeuEmail(e.target.value)} className={caixa} placeholder="o seu email" type="email" />
                    <button onClick={soParaMim} disabled={!linkGuardado || !meuEmail || ocupado !== null} className={`${botaoSec} mt-1 h-10 shrink-0`}>
                      <Send className="h-4 w-4" />
                      {ocupado === "mim" ? "A enviar…" : "Enviar só para mim"}
                    </button>
                  </div>
                </div>

                {aviso && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{aviso}</p>}
                {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

                <div className="flex flex-wrap justify-end gap-2">
                  <button onClick={descarregarCsv} disabled={ocupado !== null || estado.paraAPlay === 0} className={botaoSec}>
                    <Download className="h-4 w-4" />
                    Descarregar lista para a Play ({estado.paraAPlay} Gmail)
                  </button>
                  {estado.porEnviar > 0 && (
                    <button
                      onClick={enviarATodos}
                      disabled={!linkGuardado || linkPorGuardar || ocupado !== null}
                      className={botaoSec}
                    >
                      <Send className="h-4 w-4" />
                      {ocupado === "todos" ? "A enviar…" : `Pedir o Gmail aos sem Gmail (${estado.porEnviar})`}
                    </button>
                  )}
                  <button
                    onClick={enviarConviteNovo}
                    disabled={!linkGuardado || linkPorGuardar || estado.conviteNovo.emails === 0 || ocupado !== null}
                    className="inline-flex items-center gap-2 rounded-xl bg-acao px-4 py-2 text-sm font-semibold text-white hover:bg-acao-hover disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {ocupado === "novo" ? "A enviar…" : `Enviar o convite novo (${estado.conviteNovo.emails})`}
                  </button>
                </div>
              </div>
            )}

            {erro && !estado && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
          </div>
        </div>
      )}
    </>
  );
}
