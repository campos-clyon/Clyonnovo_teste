"use client";

import type { MouseEvent } from "react";
import { StickyNote } from "lucide-react";

/**
 * A NOTA DO PEDIDO NA MESA — o «Anotar» e a nota escrita.
 *
 * "O Sr. Olímpio Sarmento pediu para esperar até segunda para tomar uma
 * decisão; se tivesse como colocarmos uma etiqueta no pedido dele ou uma
 * anotação, seria mais fácil." — 19-09-2026.
 *
 * Vivia dentro do cartão da Mesa. A 26-10-2026 (d29) saiu para aqui, para
 * servir também as linhas do «Por decidir» — *«Coloque as notas aqui»*, o
 * dono. Os dois sítios desenham ESTE componente com o MESMO estado (uma nota
 * aberta de cada vez, e a batida de 30 s parada enquanto se escreve) e
 * guardam pela MESMA função da Mesa (`guardarNota`), que vai pela rota do
 * pedido — a coluna `notasInternas` que o ecrã do pedido já escrevia. A nota
 * escrita num sítio aparece igual no outro.
 *
 * Âmbar, e não a cor de um estado: isto não é o que o pedido É, é o que nós
 * sabemos sobre ele — um papel colado por cima.
 */

/** O estado da nota, que mora no painel da Mesa e se passa a quem a desenha. */
export type NotasDaMesa = {
  /** O pedido com a caixa da nota aberta — um de cada vez. */
  aberta: number | null;
  rascunho: string;
  aGuardar: boolean;
  escrever: (texto: string) => void;
  /** Abre a caixa do pedido com este texto lá dentro. */
  abrir: (pedidoId: number, texto: string) => void;
  fechar: () => void;
  guardar: (pedidoId: number, texto: string) => void;
};

/*
 * O clique é da nota: não abre a linha por baixo, não abre o editor do
 * pedido, não marca a caixa.
 */
const soAqui = (e: MouseEvent) => e.stopPropagation();

/**
 * O «ANOTAR» — só num pedido sem nota e com a caixa fechada. Com nota escrita
 * não aparece: é a própria nota que se carrega para a mudar.
 */
export function BotaoAnotar({
  pedidoId,
  nota,
  notas,
  className = "",
}: {
  pedidoId: number;
  nota: string | null | undefined;
  notas: NotasDaMesa;
  className?: string;
}) {
  if (notas.aberta === pedidoId || nota) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        soAqui(e);
        notas.abrir(pedidoId, "");
      }}
      className={`flex items-center gap-1 text-[11px] text-slate-600 transition hover:text-amber-300 ${className}`.trim()}
    >
      <StickyNote className="h-3 w-3" aria-hidden="true" />
      Anotar
    </button>
  );
}

/** A nota à vista, numa linha por baixo — ou a caixa para a escrever. */
export default function NotaDoPedido({
  pedidoId,
  nota,
  notas,
  margem = "mt-1.5",
}: {
  pedidoId: number;
  nota: string | null | undefined;
  notas: NotasDaMesa;
  /** O espaço por cima: nos cartões da Mesa, 1.5; numa linha que já tem `gap`, menos. */
  margem?: string;
}) {
  if (notas.aberta === pedidoId) {
    return (
      <div className={`${margem} w-full rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-2.5`}>
        <textarea
          value={notas.rascunho}
          onChange={(e) => notas.escrever(e.target.value)}
          onClick={soAqui}
          onKeyDown={(e) => {
            // Enter guarda, Shift+Enter muda de linha. Uma nota é uma
            // linha; obrigar ao rato para a gravar é um passo a mais.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              notas.guardar(pedidoId, notas.rascunho);
            }
            if (e.key === "Escape") notas.fechar();
          }}
          rows={2}
          autoFocus
          maxLength={500}
          placeholder="Ex.: pediu para esperar até segunda-feira"
          aria-label={`Nota do pedido ${pedidoId}`}
          className="w-full resize-none rounded-lg border border-slate-600 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              soAqui(e);
              notas.guardar(pedidoId, notas.rascunho);
            }}
            disabled={notas.aGuardar}
            className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {notas.aGuardar ? "A guardar…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              soAqui(e);
              notas.fechar();
            }}
            disabled={notas.aGuardar}
            className="rounded-lg border border-slate-600 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          {nota && (
            <button
              type="button"
              onClick={(e) => {
                soAqui(e);
                notas.guardar(pedidoId, "");
              }}
              disabled={notas.aGuardar}
              className="text-[11px] text-slate-500 underline hover:text-red-300 disabled:opacity-50"
            >
              Apagar a nota
            </button>
          )}
          <span className="ml-auto text-[10px] text-slate-500">A mesma nota do ecrã do pedido.</span>
        </div>
      </div>
    );
  }
  if (!nota) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        soAqui(e);
        notas.abrir(pedidoId, nota);
      }}
      title="Mudar a nota"
      className={`${margem} flex w-full items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-2.5 py-1 text-left transition hover:border-amber-400/50`}
    >
      <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
      <span className="whitespace-pre-line break-words text-xs leading-relaxed text-amber-200/90">{nota}</span>
    </button>
  );
}
