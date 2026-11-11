"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Smartphone } from "lucide-react";
import {
  TEXTOS_DO_CONVITE_NO_SITE as T,
  emailDoPrograma,
  fraseDoEstadoNaConta,
  type EstadoNoPrograma,
  type OrigemDaInscricao,
} from "@/lib/programa-da-app";

/**
 * O CONVITE PARA O PROGRAMA DE ACESSO ANTECIPADO DA APP — 11-11-2026 (ordem do
 * CEO, pedida e aprovada pelo dono).
 *
 * Dois modos:
 *   · `convite` — o cartão de quem acabou de criar conta (fim da confirmação
 *     do email) e o do topo da conta, enquanto não respondeu. «Agora não»
 *     fecha-o e fica lembrado neste navegador; o resto vive na base.
 *   · `conta`   — o bloco permanente da Segurança: o estado, entrar ou sair.
 *
 * O email vem pré-preenchido com o da conta, e pode mudar-se: tem de ser o da
 * conta Google do telemóvel, que é o que a Google Play pede para dar acesso.
 */

export const CHAVE_DO_AGORA_NAO = "clyon:programa-da-app:agora-nao";

function disseAgoraNao(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_DO_AGORA_NAO) === "1";
  } catch {
    return false;
  }
}

function lembrarAgoraNao() {
  try {
    window.localStorage.setItem(CHAVE_DO_AGORA_NAO, "1");
  } catch {
    /* sem armazenamento: o cartão volta na próxima visita, e não faz mal */
  }
}

type Estado = { estado: EstadoNoPrograma | null; email: string | null; emailDaConta: string };

export default function ProgramaDaApp({
  modo,
  origem,
  onFechar,
}: {
  modo: "convite" | "conta";
  origem: OrigemDaInscricao;
  /** No modo convite: chamado ao «Agora não», ao fim da inscrição, ou quando não há nada a perguntar. */
  onFechar?: () => void;
}) {
  const [lido, setLido] = useState<Estado | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [escondido, setEscondido] = useState(false);
  const [email, setEmail] = useState("");
  const [aceito, setAceito] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  const [aAbrir, setAAbrir] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (modo === "convite" && origem === "conta" && disseAgoraNao()) {
      setEscondido(true);
      return;
    }
    void (async () => {
      try {
        const r = await fetch("/api/conta/programa-da-app", { cache: "no-store", credentials: "include" });
        const d = (await r.json().catch(() => ({}))) as Partial<Estado> & { ok?: boolean };
        if (!vivo) return;
        if (!r.ok || !d.ok) {
          setFalhou(true);
          return;
        }
        const e: Estado = { estado: d.estado ?? null, email: d.email ?? null, emailDaConta: d.emailDaConta ?? "" };
        setLido(e);
        setEmail(e.email ?? e.emailDaConta);
      } catch {
        if (vivo) setFalhou(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [modo, origem]);

  // No convite, quem já respondeu — também quem saiu — (ou se não se conseguiu ler) não vê nada.
  const nadaAPerguntar = modo === "convite" && (escondido || falhou || (lido !== null && lido.estado !== null));
  useEffect(() => {
    if (nadaAPerguntar && !feito) onFechar?.();
  }, [nadaAPerguntar, feito, onFechar]);

  const entrar = async () => {
    setErro(null);
    if (!aceito) {
      setErro(T.semConsentimento);
      return;
    }
    if (!emailDoPrograma(email)) {
      setErro(T.emailMal);
      return;
    }
    setAGravar(true);
    try {
      const r = await fetch("/api/conta/programa-da-app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, consentimento: true, origem }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; estado?: EstadoNoPrograma; email?: string; error?: string };
      if (!r.ok || !d.ok) {
        setErro(d.error ?? "Não foi possível gravar agora. Tente outra vez.");
        return;
      }
      setLido((antes) => ({ estado: d.estado ?? "inscrito", email: d.email ?? email, emailDaConta: antes?.emailDaConta ?? "" }));
      setFeito(true);
      if (modo === "conta") setAAbrir(false);
    } catch {
      setErro("Sem ligação. Verifique a internet e tente outra vez.");
    } finally {
      setAGravar(false);
    }
  };

  const sair = async () => {
    if (!confirm("Sair do programa de acesso antecipado da app?")) return;
    setAGravar(true);
    setErro(null);
    try {
      const r = await fetch("/api/conta/programa-da-app", { method: "DELETE", credentials: "include" });
      if (!r.ok) {
        setErro("Não foi possível gravar agora. Tente outra vez.");
        return;
      }
      setLido((antes) => (antes ? { ...antes, estado: "saiu" } : antes));
      setFeito(false);
      setAAbrir(false);
    } catch {
      setErro("Sem ligação. Verifique a internet e tente outra vez.");
    } finally {
      setAGravar(false);
    }
  };

  const agoraNao = () => {
    lembrarAgoraNao();
    setEscondido(true);
    onFechar?.();
  };

  if (modo === "convite" && (nadaAPerguntar || !lido) && !feito) return null;
  if (modo === "conta" && !lido) {
    return falhou ? null : (
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-slate-300" aria-hidden="true" />
      </div>
    );
  }

  const dentro = lido?.estado === "inscrito" || lido?.estado === "adicionado" || lido?.estado === "convidado";

  const formulario = (
    <div className="mt-4 space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        {T.rotuloDoEmail}
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-[#00B4CC] focus:outline-none"
        />
      </label>
      <p className="text-xs leading-relaxed text-slate-500">{T.notaDoEmail}</p>
      <label className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-600">
        <input
          type="checkbox"
          checked={aceito}
          onChange={(e) => setAceito(e.target.checked)}
          className="mt-1 h-4 w-4 flex-shrink-0 accent-[#00B4CC]"
        />
        <span>{T.consentimento}</span>
      </label>
      {erro && <p className="text-sm text-rose-600">{erro}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => void entrar()}
          disabled={aGravar}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#00B4CC] px-5 text-sm font-bold text-white transition hover:bg-acao-hover disabled:opacity-60"
        >
          {aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {T.sim}
        </button>
        <button
          type="button"
          onClick={modo === "convite" ? agoraNao : () => setAAbrir(false)}
          className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
        >
          {T.nao}
        </button>
      </div>
    </div>
  );

  if (modo === "convite") {
    return (
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-xl">
        {feito ? (
          <>
            <CheckCircle2 className="h-8 w-8 text-acao" aria-hidden="true" />
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{T.feito}</p>
            {onFechar && (
              <button
                type="button"
                onClick={onFechar}
                className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-[#00B4CC] text-sm font-bold text-white transition hover:bg-acao-hover"
              >
                Continuar
              </button>
            )}
          </>
        ) : (
          <>
            <Smartphone className="h-8 w-8 text-[#00B4CC]" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold text-tinta">{T.titulo}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{T.corpo}</p>
            {formulario}
          </>
        )}
      </div>
    );
  }

  // Modo conta: o bloco da Segurança.
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">App da CLYON para Android</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        {feito ? T.feito : fraseDoEstadoNaConta(lido?.estado ?? null, lido?.email ?? null)}
      </p>
      {aAbrir && !dentro ? (
        formulario
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {!dentro && (
            <button
              type="button"
              onClick={() => setAAbrir(true)}
              className="rounded-xl bg-[#00B4CC] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-acao-hover"
            >
              Entrar no programa
            </button>
          )}
          {dentro && (
            <button
              type="button"
              onClick={() => void sair()}
              disabled={aGravar}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:opacity-60"
            >
              Sair do programa
            </button>
          )}
        </div>
      )}
      {erro && !aAbrir && <p className="mt-2 text-sm text-rose-600">{erro}</p>}
    </div>
  );
}
