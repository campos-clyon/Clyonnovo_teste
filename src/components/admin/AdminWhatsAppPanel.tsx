"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  Hand,
  Loader2,
  MessageCircle,
  Power,
  RefreshCw,
  Undo2,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * O painel de controlo do WhatsApp da plataforma.
 *
 * O mesmo poder do painel do Winapp, sobre o cérebro DAQUI — e organizado
 * pela pergunta que o dono traz: "quem está a falar com este número agora?"
 *
 *   LIGADO      → o cérebro responde e envia propostas.
 *   Entregue    → uma pessoa está nessa conversa; o cérebro cala-se NELA.
 *   Bloqueado   → contacto pessoal ou indesejado; nunca ninguém automático
 *                 fala com ele, e o que escrever é ignorado.
 *   DESLIGADO   → um gesto e cala-se tudo, em todas as conversas.
 *
 * Interromper acontece sozinho quando ele responde à mão no WhatsApp — o
 * Winapp avisa o site. Aqui é onde se VÊ isso, e onde se devolve.
 */

type Estado = {
  ligado: boolean;
  canal: "meta" | "ponte" | "nenhum";
  interrompidos: Array<{ telefone: string; motivo: string | null; criadoEm: string }>;
  bloqueados: Array<{ telefone: string; nota: string | null; criadoEm: string }>;
  fila: Array<{ id: number; telefone: string; texto: string }>;
};

const CAIXA =
  "rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";

function formatarTelefone(t: string): string {
  const d = t.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("351")) {
    return `+351 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  }
  return d;
}

function desde(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminWhatsAppPanel() {
  const { token, ready } = useAdminAuth();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [numeroNovo, setNumeroNovo] = useState("");
  const [notaNova, setNotaNova] = useState("");

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/whatsapp", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setEstado(dados);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    }
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    void carregar();
    // O estado muda fora daqui (o Winapp interrompe, a fila esvazia): o ecrã
    // acompanha sozinho, como o painel do profissional.
    const t = setInterval(() => void carregar(), 30_000);
    return () => clearInterval(t);
  }, [ready, carregar]);

  const agir = useCallback(
    async (accao: string, telefone?: string, nota?: string) => {
      if (!token) return;
      setOcupado(true);
      try {
        const res = await fetch("/api/admin/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ accao, telefone, nota }),
        });
        const dados = await res.json();
        if (!res.ok) {
          setErro(dados.error ?? "Não foi possível.");
          return;
        }
        setErro("");
        await carregar();
      } catch {
        setErro("Erro de rede.");
      } finally {
        setOcupado(false);
      }
    },
    [token, carregar],
  );

  if (!estado) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        A carregar o estado do WhatsApp…
      </div>
    );
  }

  const CANAL = {
    meta: "a falar pela API oficial da Meta",
    ponte: "a falar pela ponte do Winapp (o WhatsApp emparelhado no PC)",
    nenhum: "sem canal configurado — nada sai nem entra até haver Meta ou ponte",
  }[estado.canal];

  return (
    <div className="space-y-4">
      {/* O interruptor geral: o estado em letras grandes e UM gesto ao lado. */}
      <section
        className={`rounded-2xl border p-5 ${
          estado.ligado
            ? "border-emerald-500/25 bg-emerald-500/[0.06]"
            : "border-red-500/30 bg-red-500/[0.07]"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-lg font-bold text-white">
              <MessageCircle
                className={`h-5 w-5 ${estado.ligado ? "text-emerald-400" : "text-red-400"}`}
                aria-hidden="true"
              />
              {estado.ligado ? "O WhatsApp da plataforma está ligado" : "Está DESLIGADO — ninguém recebe nada"}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {estado.ligado ? CANAL : "As mensagens novas ficam na fila à espera de o voltar a ligar."}
            </p>
          </div>
          <button
            onClick={() => agir(estado.ligado ? "desligar" : "ligar")}
            disabled={ocupado}
            className={`flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition disabled:opacity-50 ${
              estado.ligado
                ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            }`}
          >
            <Power className="h-4 w-4" aria-hidden="true" />
            {estado.ligado ? "Desligar tudo" : "Ligar outra vez"}
          </button>
        </div>
      </section>

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* Interromper ou bloquear um número — o mesmo formulário serve os dois. */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-white">Calar o cérebro num número</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          <strong className="text-slate-300">Entregar a si</strong> é para clientes: a conversa
          passa a ser sua e devolve-se quando quiser. <strong className="text-slate-300">Bloquear</strong>{" "}
          é para contactos pessoais e indesejados: nunca mais recebem nada, até desbloquear.
          Quando responde à mão no WhatsApp, a conversa é entregue a si sozinha.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={numeroNovo}
            onChange={(e) => setNumeroNovo(e.target.value)}
            placeholder="Número (ex.: 912 345 678)"
            className={`${CAIXA} sm:w-56`}
          />
          <input
            value={notaNova}
            onChange={(e) => setNotaNova(e.target.value)}
            placeholder="Nota (opcional — quem é, porquê)"
            className={`${CAIXA} flex-1`}
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await agir("interromper", numeroNovo, notaNova || undefined);
                setNumeroNovo("");
                setNotaNova("");
              }}
              disabled={ocupado || numeroNovo.replace(/\D/g, "").length < 9}
              className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-amber-500/15 px-4 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/25 disabled:opacity-40"
            >
              <Hand className="h-4 w-4" aria-hidden="true" />
              Entregar a si
            </button>
            <button
              onClick={async () => {
                await agir("bloquear", numeroNovo, notaNova || undefined);
                setNumeroNovo("");
                setNotaNova("");
              }}
              disabled={ocupado || numeroNovo.replace(/\D/g, "").length < 9}
              className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-red-500/15 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 disabled:opacity-40"
            >
              <Ban className="h-4 w-4" aria-hidden="true" />
              Bloquear
            </button>
          </div>
        </div>
      </section>

      {/* Conversas entregues a uma pessoa */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            Conversas entregues a si{" "}
            {estado.interrompidos.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                {estado.interrompidos.length}
              </span>
            )}
          </h3>
          <button
            onClick={() => void carregar()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Actualizar
          </button>
        </div>
        {estado.interrompidos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Nenhuma. O cérebro está a tratar de todas as conversas dos pedidos activos.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800">
            {estado.interrompidos.map((i) => (
              <li key={i.telefone} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-white">{formatarTelefone(i.telefone)}</p>
                  <p className="truncate text-xs text-slate-500">
                    {i.motivo ?? "—"} · desde {desde(i.criadoEm)}
                  </p>
                </div>
                <button
                  onClick={() => agir("retomar", i.telefone)}
                  disabled={ocupado}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-40"
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Devolver ao site
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Bloqueados */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-white">
          Bloqueados{" "}
          {estado.bloqueados.length > 0 && (
            <span className="ml-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">
              {estado.bloqueados.length}
            </span>
          )}
        </h3>
        {estado.bloqueados.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Ninguém bloqueado.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800">
            {estado.bloqueados.map((b) => (
              <li key={b.telefone} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-white">{formatarTelefone(b.telefone)}</p>
                  <p className="truncate text-xs text-slate-500">
                    {b.nota ?? "—"} · desde {desde(b.criadoEm)}
                  </p>
                </div>
                <button
                  onClick={() => agir("desbloquear", b.telefone)}
                  disabled={ocupado}
                  className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
                >
                  Desbloquear
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* A fila por enviar — só aparece quando há alguma coisa nela. */}
      {estado.fila.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="text-sm font-bold text-white">
            Na fila para sair{" "}
            <span className="ml-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-300">
              {estado.fila.length}
            </span>
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            O Winapp vem buscá-las de poucos em poucos segundos.
            {!estado.ligado && " Desligado, ficam aqui à espera."}
          </p>
          <ul className="mt-3 divide-y divide-slate-800">
            {estado.fila.map((m) => (
              <li key={m.id} className="py-2.5">
                <p className="font-mono text-xs text-slate-400">{formatarTelefone(m.telefone)}</p>
                <p className="mt-0.5 truncate text-sm text-slate-300">{m.texto}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
