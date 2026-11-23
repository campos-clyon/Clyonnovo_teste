"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { NOME_DO_INTERRUPTOR_DO_ENVIO_AUTOMATICO, NOME_DO_INTERRUPTOR_SO_DA_VITORIA } from "@/lib/envio-automatico-nome";

/**
 * O INTERRUPTOR DE EMERGÊNCIA «ENVIO AUTOMÁTICO AOS PARCEIROS» — Configs (d87, 22-11-2026).
 *
 * LIGADO POR OMISSÃO: os pedidos completos seguem sozinhos para os parceiros
 * (das 8h às 21h; fora disso, às 8h00). Desde 23-11-2026 (d88), de todas as
 * origens — simulador, formulário, WhatsApp e registado na Mesa —, 10 minutos
 * depois de entrarem. A segunda chave, «Só os da Vitória» (desligada por
 * omissão), volta ao comportamento da d87. Desligar o primeiro deixa tudo nos
 * «por enviar» como antes, e os cartões mostram «enviaria a …». Só o
 * administrador o vê e muda.
 */
type Chave = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };
type Estado = Chave & { soDaVitoria?: Chave };

const quandoFoi = (c: Chave | null | undefined) =>
  c?.mudadoEm
    ? new Date(c.mudadoEm).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" }) +
      (c.porQuem ? `, ${c.porQuem}` : "")
    : null;

export default function InterruptorDoEnvioAutomatico() {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [aMudar, setAMudar] = useState(false);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/interruptor-do-envio-automatico", {
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

  async function mudar(corpo: { ligar: boolean } | { soDaVitoria: boolean }) {
    if (!token) return;
    if ("ligar" in corpo && !corpo.ligar && !window.confirm("Desligar o envio automático aos parceiros? Os pedidos completos, de todas as origens, ficam nos «por enviar» até voltar a ligar.")) return;
    if ("soDaVitoria" in corpo && corpo.soDaVitoria && !window.confirm("Só os da Vitória? Os pedidos do simulador, do formulário e os registados na Mesa voltam a ficar nos «por enviar» à espera da equipa.")) return;
    setAMudar(true);
    setErro("");
    try {
      const r = await fetch("/api/admin/interruptor-do-envio-automatico", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível mudar.");
        return;
      }
      setEstado(d as Estado);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAMudar(false);
    }
  }

  if (!eAdministrador) return null;
  const ligado = estado?.ligado === true;
  const soDaVitoria = estado?.soDaVitoria?.ligado === true;
  const quando = quandoFoi(estado);
  const quandoSo = quandoFoi(estado?.soDaVitoria);

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{NOME_DO_INTERRUPTOR_DO_ENVIO_AUTOMATICO}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        Todo o pedido completo dos «Orçamentos novos» — do simulador, do formulário do site, do WhatsApp ou registado na
        Mesa — segue sozinho para os parceiros da zona, pelo mesmo envio do botão «Negociação» da Mesa (a conta da CLYON
        como valor de partida): serviço da lista, morada com coordenadas e código postal, nada em falta, sem conta de
        teste nem número bloqueado, e pelo menos um parceiro elegível. Só sai 10 minutos depois de entrar e sem mensagens
        do cliente nos últimos 10 minutos (o cartão diz «Segue sozinho às …»). Ficam sempre com uma pessoa: Trabalhos
        CLYON e valor fixo, propostas já enviadas, mudanças com parceiros escolhidos pelo cliente, estimativas acima de
        500 € com IVA, pedidos com nota da equipa ou atribuídos a alguém. Os que a Vitória completa pelo WhatsApp seguem
        logo. Os avisos só saem das 8h às 21h; fora disso, às 8h00. Se uma condição falhar, fica nos «por enviar» com o
        motivo no cartão. Este interruptor é para emergências.
      </p>
      <p className={`mt-2 text-sm font-semibold ${ligado ? "text-emerald-300" : "text-amber-200"}`}>
        {estado == null ? "A ler…" : ligado ? "LIGADO" : "Desligado — fica tudo nos «por enviar»; a Mesa mostra «enviaria a …»"}
        {quando && <span className="ml-2 text-xs font-normal text-slate-400">({quando})</span>}
      </p>
      {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}
      {estado != null && (
        <button
          type="button"
          onClick={() => mudar({ ligar: !ligado })}
          disabled={aMudar}
          className={
            ligado
              ? "mt-3 rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-200 disabled:opacity-50"
              : "mt-3 rounded-lg border border-emerald-500/50 px-3 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-50"
          }
        >
          {ligado ? "Desligar (emergência)" : "Voltar a ligar"}
        </button>
      )}

      {/* A segunda chave (d88): só os da Vitória, como na d87. */}
      {estado != null && (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{NOME_DO_INTERRUPTOR_SO_DA_VITORIA}</p>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            Ligada, só seguem sozinhos os pedidos que a Vitória completa pelo WhatsApp; os do simulador, do formulário e os
            registados na Mesa voltam a esperar pela equipa.
          </p>
          <p className={`mt-2 text-sm font-semibold ${soDaVitoria ? "text-amber-200" : "text-emerald-300"}`}>
            {soDaVitoria ? "LIGADA — só os da Vitória" : "Desligada — todas as origens"}
            {quandoSo && <span className="ml-2 text-xs font-normal text-slate-400">({quandoSo})</span>}
          </p>
          <button
            type="button"
            onClick={() => mudar({ soDaVitoria: !soDaVitoria })}
            disabled={aMudar}
            className="mt-3 rounded-lg border border-slate-500/60 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
          >
            {soDaVitoria ? "Voltar a todas as origens" : "Só os da Vitória"}
          </button>
        </div>
      )}
    </div>
  );
}
