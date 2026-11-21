"use client";

import { useState } from "react";
import { Loader2, PhoneCall } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { diaEmLisboa, somarDiasAoDia } from "@/lib/hora-de-lisboa";
import {
  DIAS_NO_MAXIMO_PARA_VOLTAR,
  horaNaJanela,
  NOTA_NO_MAXIMO,
  RESPOSTAS_DO_CONTACTO,
  ROTULOS_DAS_RESPOSTAS,
  voltarPorOmissao,
  type RespostaDoContacto,
} from "@/lib/seguimento-do-cliente";

/**
 * O «FALEI COM O CLIENTE» NUM CARTÃO DO «PRECISA DE SI» — d83, 21-11-2026.
 *
 * O botão abre um painel pequeno: o que o cliente respondeu («Vai pensar»,
 * «Não atendeu», «Quer outra data», «Quer cancelar»), uma nota curta, e —
 * menos no cancelar — quando voltar a contactar (dia e hora de Lisboa, das
 * 9h00 às 20h59; por omissão amanhã às 10h00). Por baixo, os contactos
 * guardados e o passo do seguimento, escritos no servidor (`seguimentoNaMesa`).
 * «Parar o seguimento» desmarca o ciclo em curso.
 */
export type SeguimentoNaMesa = {
  pedidoId: number;
  emCurso: boolean;
  podeParar: boolean;
  linha: string;
  contactos: string[];
  falha: string | null;
};

export default function SeguimentoDoCliente({
  pedidoId,
  estado,
  comBotao,
  onFeito,
  onErro,
}: {
  pedidoId: number;
  estado: SeguimentoNaMesa | undefined;
  /** No «Precisa de si»: mostra o «Falei com o cliente». Nos outros blocos, só o que já houve. */
  comBotao: boolean;
  onFeito: (texto: string) => void;
  onErro: (texto: string) => void;
}) {
  const { token } = useAdminAuth();
  const [aberto, setAberto] = useState(false);
  const [resposta, setResposta] = useState<RespostaDoContacto | null>(null);
  const [nota, setNota] = useState("");
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [aGuardar, setAGuardar] = useState(false);

  if (!estado && !comBotao) return null;

  function abrir() {
    const omissao = voltarPorOmissao(new Date());
    setResposta(null);
    setNota("");
    setDia(omissao.dia);
    setHora(omissao.hora);
    setAberto(true);
  }

  async function enviar(corpo: Record<string, unknown>, falhou: string) {
    if (!token) return;
    setAGuardar(true);
    try {
      const r = await fetch("/api/admin/seguimento-do-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId, ...corpo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) onErro(d.error ?? falhou);
      else {
        setAberto(false);
        onFeito(d.feito ?? `#${pedidoId}: guardado.`);
      }
    } catch {
      onErro("Erro de rede.");
    } finally {
      setAGuardar(false);
    }
  }

  function guardar() {
    if (!resposta) return;
    if (resposta === "quer_cancelar") {
      if (!window.confirm(`Cancelar o pedido #${pedidoId}? Os parceiros com proposta são avisados, como no cancelamento de sempre.`)) return;
      void enviar({ accao: "falei", resposta, nota }, "Não foi possível cancelar.");
      return;
    }
    void enviar({ accao: "falei", resposta, nota, dia, hora }, "Não foi possível guardar.");
  }

  function parar() {
    if (!window.confirm(`Parar o seguimento do pedido #${pedidoId}? Nada mais sai ao cliente.`)) return;
    void enviar({ accao: "parar" }, "Não foi possível parar o seguimento.");
  }

  const hoje = diaEmLisboa(new Date());
  const horaValida = horaNaJanela(hora);
  const podeGuardar = resposta != null && (resposta === "quer_cancelar" || (Boolean(dia) && horaValida));

  return (
    <div className="mt-1 space-y-1 text-[11px]" onClick={(e) => e.stopPropagation()}>
      {estado?.contactos.map((l, i) => (
        <p key={i} className="text-slate-400">
          {l}
        </p>
      ))}
      {estado && (
        <p className={estado.emCurso ? "text-ciano-texto" : "text-slate-300"}>
          {estado.linha}
          {estado.falha && <span className="ml-1 text-red-300">— da última vez: {estado.falha}</span>}
        </p>
      )}
      {comBotao && !aberto && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={abrir}
            className="flex items-center gap-1 rounded-md border border-ciano/50 px-2 py-0.5 font-semibold text-ciano-texto hover:bg-ciano/14"
          >
            <PhoneCall className="h-3 w-3" aria-hidden="true" />
            Falei com o cliente
          </button>
          {estado?.podeParar && (
            <button
              type="button"
              onClick={parar}
              disabled={aGuardar}
              className="rounded-md border border-slate-600 px-2 py-0.5 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Parar o seguimento
            </button>
          )}
        </div>
      )}
      {comBotao && aberto && (
        <div className="max-w-md space-y-2 rounded-lg border border-slate-700 bg-slate-900 p-2.5">
          <p className="font-semibold text-slate-200">O que o cliente respondeu?</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="O que o cliente respondeu">
            {RESPOSTAS_DO_CONTACTO.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setResposta(r)}
                aria-pressed={resposta === r}
                className={
                  resposta === r
                    ? r === "quer_cancelar"
                      ? "rounded-md border border-red-500/70 bg-red-500/20 px-2 py-0.5 font-semibold text-red-200"
                      : "rounded-md border border-ciano/70 bg-ciano/20 px-2 py-0.5 font-semibold text-ciano-texto"
                    : "rounded-md border border-slate-600 px-2 py-0.5 text-slate-300 hover:bg-slate-800"
                }
              >
                {ROTULOS_DAS_RESPOSTAS[r]}
              </button>
            ))}
          </div>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={NOTA_NO_MAXIMO}
            placeholder="Nota curta (opcional)"
            aria-label="Nota curta"
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100 placeholder:text-slate-500"
          />
          {resposta !== "quer_cancelar" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-300">Voltar a contactar em</span>
              <input
                type="date"
                value={dia}
                min={hoje}
                max={somarDiasAoDia(hoje, DIAS_NO_MAXIMO_PARA_VOLTAR)}
                onChange={(e) => setDia(e.target.value)}
                aria-label="Dia para voltar a contactar"
                className="rounded-md border border-slate-600 bg-slate-950 px-1.5 py-0.5 text-slate-100 [color-scheme:dark]"
              />
              <input
                type="time"
                value={hora}
                min="09:00"
                max="20:59"
                step={900}
                onChange={(e) => setHora(e.target.value)}
                aria-label="Hora para voltar a contactar"
                className="rounded-md border border-slate-600 bg-slate-950 px-1.5 py-0.5 text-slate-100 [color-scheme:dark]"
              />
              <span className={horaValida ? "text-slate-500" : "text-red-300"}>das 9h00 às 20h59 (Lisboa)</span>
            </div>
          )}
          {resposta === "quer_cancelar" && (
            <p className="text-red-200">O pedido é cancelado já, e os parceiros com proposta são avisados.</p>
          )}
          {resposta != null && resposta !== "quer_cancelar" && (
            <p className="text-slate-500">
              A Vitória escreve-lhe nesse dia e hora, e nos dois dias seguintes à mesma hora; sem resposta, o pedido é arquivado ao 4.º dia.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={!podeGuardar || aGuardar}
              className={
                resposta === "quer_cancelar"
                  ? "flex items-center gap-1 rounded-md border border-red-500/60 px-2.5 py-0.5 font-semibold text-red-200 hover:bg-red-500/15 disabled:opacity-40"
                  : "flex items-center gap-1 rounded-md border border-ciano/60 px-2.5 py-0.5 font-semibold text-ciano-texto hover:bg-ciano/14 disabled:opacity-40"
              }
            >
              {aGuardar && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
              {resposta === "quer_cancelar" ? "Cancelar o pedido" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-md border border-slate-600 px-2.5 py-0.5 text-slate-300 hover:bg-slate-800"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
