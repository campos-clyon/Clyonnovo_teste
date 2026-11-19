"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { NOME_DO_INTERRUPTOR_DO_QUE_FALTA } from "@/lib/lembrete-do-que-falta";

/**
 * O INTERRUPTOR «LEMBRETES DO QUE FALTA» — Configs (d71, 19-11-2026).
 *
 * DESLIGADO POR OMISSÃO. O dono liga-o depois de ver o ensaio: quem entraria
 * agora (só os números dos pedidos), os ciclos a correr e os textos tal como
 * saem. Só o administrador o vê e muda; para ligar escreve-se LIGAR.
 */
type Ensaio = {
  ligado: boolean;
  entrariam: Array<{ pedidoId: number; canal: "whatsapp" | "email"; faltas: number }>;
  aCorrer: Array<{ pedidoId: number; canal: "whatsapp" | "email"; linha: string | null; passoDeHoje: string | null }>;
  deFora: Record<string, number>;
};
type Estado = {
  ligado: boolean;
  mudadoEm: string | null;
  porQuem: string | null;
  textos?: Record<"lembrete1" | "lembrete2" | "lembrete3" | "arquivo" | "cancelamento", string>;
  ensaio?: Ensaio | null;
  motivos?: Record<string, string>;
};

const TITULOS: Array<[keyof NonNullable<Estado["textos"]>, string]> = [
  ["lembrete1", "Dia 1: o primeiro lembrete"],
  ["lembrete2", "Dia 3: o segundo, mais curto"],
  ["lembrete3", "Dia 5: o último aviso"],
  ["arquivo", "Dia 7: arquivado sem resposta"],
  ["cancelamento", "Respondeu 2: o texto de cancelamento (d55)"],
];

export default function LembretesDoQueFalta() {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [palavra, setPalavra] = useState("");
  const [erro, setErro] = useState("");
  const [aMudar, setAMudar] = useState(false);
  const [verTextos, setVerTextos] = useState(false);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/lembretes-do-que-falta", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (r.ok) setEstado((await r.json()) as Estado);
    } catch {
      /* fica o que se tinha */
    }
  }, [token]);

  useEffect(() => {
    if (ready && eAdministrador) void ler();
  }, [ready, eAdministrador, ler]);

  async function mudar(ligar: boolean) {
    if (!token) return;
    setAMudar(true);
    setErro("");
    try {
      const r = await fetch("/api/admin/lembretes-do-que-falta", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ligar, confirmacao: palavra }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível mudar.");
        return;
      }
      setPalavra("");
      await ler();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAMudar(false);
    }
  }

  if (!eAdministrador) return null;
  const ligado = estado?.ligado === true;
  const quando = estado?.mudadoEm
    ? new Date(estado.mudadoEm).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" })
    : null;
  const ensaio = estado?.ensaio ?? null;
  const deFora = ensaio ? Object.entries(ensaio.deFora).filter(([, n]) => n > 0) : [];

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{NOME_DO_INTERRUPTOR_DO_QUE_FALTA}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        Os pedidos dos «Orçamentos novos» a que falta informação (criados há mais de 12 h, sem «Pedir o que falta» nem
        mensagem do cliente nas últimas 24 h) recebem às 10h de Lisboa um lembrete no dia 1, no dia 3 e no dia 5, pelo
        WhatsApp ou, sem telemóvel, por email. Sem resposta, o pedido é arquivado no dia 7 (nunca apagado). O «2»
        cancela o pedido; qualquer outra resposta pára os lembretes e segue a conversa. Um ciclo por pedido.
      </p>
      <p className={`mt-2 text-sm font-semibold ${ligado ? "text-red-300" : "text-amber-200"}`}>
        {estado == null ? "A ler…" : ligado ? "LIGADO" : "Desligado: nada sai, nada se cancela e nada se arquiva"}
        {quando && <span className="ml-2 text-xs font-normal text-slate-400">({quando}{estado?.porQuem ? `, ${estado.porQuem}` : ""})</span>}
      </p>

      {ensaio && (
        <div className="mt-3 space-y-1 text-xs leading-5 text-slate-300">
          <p className="font-semibold text-slate-200">Ensaio (só leitura, agora)</p>
          <p>
            Entrariam {ensaio.entrariam.length}:{" "}
            {ensaio.entrariam.length === 0
              ? "nenhum"
              : ensaio.entrariam.map((e) => `#${e.pedidoId} (${e.canal === "whatsapp" ? "WhatsApp" : "email"}, ${e.faltas} em falta)`).join(", ")}
          </p>
          {ensaio.aCorrer.length > 0 && (
            <p>
              A correr:{" "}
              {ensaio.aCorrer.map((c) => `#${c.pedidoId}: ${c.linha ?? "na fila"}`).join(" · ")}
            </p>
          )}
          {deFora.length > 0 && (
            <p className="text-slate-400">
              De fora: {deFora.map(([m, n]) => `${n} ${estado?.motivos?.[m] ?? m}`).join(" · ")}
            </p>
          )}
        </div>
      )}

      {estado?.textos && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setVerTextos((v) => !v)}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200"
          >
            {verTextos ? "Esconder os textos" : "Ver os textos tal como saem"}
          </button>
          {verTextos && (
            <div className="mt-2 space-y-3">
              {TITULOS.map(([chave, titulo]) => (
                <div key={chave}>
                  <p className="text-[11px] font-semibold text-slate-400">{titulo}</p>
                  <pre className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-700/60 bg-slate-900/60 p-2 font-sans text-xs leading-5 text-slate-200">
                    {estado.textos?.[chave]}
                  </pre>
                </div>
              ))}
              <p className="text-[11px] text-slate-500">Exemplo inventado: pedido #1234, recolha de monos em Almada, sem fotografias, andar e elevador.</p>
            </div>
          )}
        </div>
      )}

      {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}
      {estado != null &&
        (ligado ? (
          <button
            type="button"
            onClick={() => mudar(false)}
            disabled={aMudar}
            className="mt-3 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
          >
            Desligar
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={palavra}
              onChange={(e) => setPalavra(e.target.value)}
              placeholder="Escreva LIGAR"
              aria-label="Escreva LIGAR para ligar os lembretes do que falta"
              className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={() => mudar(true)}
              disabled={aMudar || palavra.trim().toUpperCase() !== "LIGAR"}
              className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-200 disabled:opacity-40"
            >
              Ligar (só com o sim do dono)
            </button>
          </div>
        ))}
    </div>
  );
}
