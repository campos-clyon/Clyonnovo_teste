"use client";

import { useState, type MouseEvent } from "react";
import { CheckCircle2, ClipboardList, Copy, Mail, MessageCircle, X } from "lucide-react";
import {
  arrumarAsFaltas,
  caminhosDoQueFalta,
  rotuloDaFalta,
  type CanalDoPedido,
  type ChaveDaFalta,
} from "@/lib/mensagem-do-que-falta";

/**
 * «PEDIR O QUE FALTA» NO «POR DECIDIR» DA MESA — 26-10-2026 (d31).
 *
 * *«Botões para contactar o cliente com uma mensagem feita pelo próprio
 * sistema a partir do que falta no pedido.»* — o dono. Pelo WhatsApp, e por
 * email quando o número do cliente não tem WhatsApp.
 *
 * O botão diz quantas coisas faltam («Pedir o que falta (3)»), e um pedido
 * completo diz «Pedido completo», sem clique. Aberto, mostra a lista e os
 * caminhos lado a lado: o WhatsApp (`wa.me` com o texto, por
 * `link-de-whatsapp.ts`), o email (`mailto:` com o assunto e o corpo) e o
 * «Copiar mensagem». O que não serve fica desligado e diz porquê; o que
 * serve melhor fica destacado.
 *
 * NADA SE ENVIA SOZINHO. Abre-se o WhatsApp ou o email com a mensagem
 * escrita, noutro separador, e quem envia é a pessoa da equipa. O clique fica
 * no botão: não abre a edição do pedido nem marca a caixa da linha. E fica no
 * histórico do pedido quem pediu, por onde e a lista (a rota
 * `/api/admin/pedidos/[id]/o-que-falta`).
 *
 * O que falta vem já contado do servidor (`oQueFaltaNoPedido`); a mensagem
 * escreve-a `mensagem-do-que-falta.ts`.
 */

/** O pedido, no que o botão precisa dele — o que a linha do «Por decidir» já tem. */
export type PedidoParaPedir = {
  id: number;
  serviceType: string | null;
  city: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
};

const soAqui = (e: MouseEvent) => e.stopPropagation();

/** O botão da linha: quantas faltam, ou «Pedido completo». */
export function BotaoPedirOQueFalta({
  pedidoId,
  faltas,
  aberto,
  onAlternar,
}: {
  pedidoId: number;
  faltas: readonly ChaveDaFalta[];
  aberto: boolean;
  onAlternar: () => void;
}) {
  const n = arrumarAsFaltas(faltas).length;
  if (n === 0) {
    return (
      <button
        type="button"
        disabled
        title="Não falta nada neste pedido"
        className="flex items-center gap-1.5 rounded-lg border border-emerald-700/50 px-3 py-2 text-xs font-medium text-emerald-300/80 disabled:cursor-default"
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Pedido completo
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        soAqui(e);
        onAlternar();
      }}
      aria-expanded={aberto}
      aria-label={`Pedir ao cliente o que falta no pedido ${pedidoId} (${n})`}
      title="Pedir ao cliente o que falta, por WhatsApp ou por email"
      className="flex items-center gap-1.5 rounded-lg border border-rose-500/50 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10"
    >
      <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
      Pedir o que falta ({n})
    </button>
  );
}

type Registo = { tipo: "ok"; texto: string } | { tipo: "erro"; texto: string } | null;

const BASE = "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold";
const DESTACADO_VERDE = `${BASE} bg-emerald-600 text-white hover:bg-emerald-500`;
const DESTACADO_AZUL = `${BASE} bg-sky-600 text-white hover:bg-sky-500`;
const DESTACADO_CINZA = `${BASE} bg-slate-200 text-slate-900 hover:bg-white`;
const SECUNDARIO = `${BASE} border border-slate-600 text-slate-200 hover:bg-slate-800/60`;
const DESLIGADO = `${BASE} cursor-not-allowed border border-slate-800 text-slate-500`;

/** O painel aberto por baixo da linha: a lista, os caminhos e a mensagem. */
export default function PainelDoQueFalta({
  pedido,
  faltas,
  token,
  onFechar,
}: {
  pedido: PedidoParaPedir;
  faltas: readonly ChaveDaFalta[];
  token: string | null;
  onFechar: () => void;
}) {
  const [registo, setRegisto] = useState<Registo>(null);
  const lista = arrumarAsFaltas(faltas);
  // A hora de agora, para o «Bom dia / Boa tarde / Boa noite» de Lisboa.
  const { texto, whatsapp, email } = caminhosDoQueFalta(pedido, lista, new Date());

  async function registar(canal: CanalDoPedido, feito: string) {
    try {
      const r = await fetch(`/api/admin/pedidos/${pedido.id}/o-que-falta`, {
        method: "POST",
        // O separador do WhatsApp abre por cima; o registo não pode morrer com o clique.
        keepalive: true,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ canal }),
      });
      setRegisto(
        r.ok
          ? { tipo: "ok", texto: `${feito} Ficou registado no histórico do pedido.` }
          : { tipo: "erro", texto: `${feito} Mas não ficou registado no histórico do pedido.` },
      );
    } catch {
      setRegisto({ tipo: "erro", texto: `${feito} Mas não ficou registado no histórico do pedido.` });
    }
  }

  async function copiar(e: MouseEvent) {
    soAqui(e);
    try {
      await navigator.clipboard.writeText(texto);
      void registar("copiar", "Mensagem copiada.");
    } catch {
      setRegisto({ tipo: "erro", texto: "Não foi possível copiar. Seleccione a mensagem abaixo e copie-a à mão." });
    }
  }

  if (lista.length === 0) return null;

  // O que serve melhor fica destacado: o WhatsApp; sem ele, o email; sem os dois, copiar.
  const estiloDoEmail = whatsapp ? SECUNDARIO : DESTACADO_AZUL;
  const estiloDoCopiar = !whatsapp && !email ? DESTACADO_CINZA : SECUNDARIO;

  return (
    <div className="basis-full rounded-xl border border-rose-500/30 bg-slate-950/60 p-3" onClick={soAqui}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-rose-200">Falta no pedido #{pedido.id}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Abre o WhatsApp ou o email com a mensagem já escrita. Nada é enviado sem ser por si.
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            soAqui(e);
            onFechar();
          }}
          aria-label="Fechar"
          className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800/60"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="O que falta">
        {lista.map((c) => (
          <li
            key={c}
            className="rounded-full border border-rose-500/30 bg-rose-500/5 px-2 py-0.5 text-[11px] text-rose-100"
          >
            {rotuloDaFalta(c, pedido.serviceType)}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              soAqui(e);
              void registar("whatsapp", "WhatsApp aberto com a mensagem.");
            }}
            className={DESTACADO_VERDE}
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            WhatsApp
          </a>
        ) : (
          <button type="button" disabled title="Este número não abre no WhatsApp" className={DESLIGADO}>
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            WhatsApp
            <span className="font-normal">· sem WhatsApp</span>
          </button>
        )}

        {email ? (
          <a
            href={email}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              soAqui(e);
              void registar("email", "Email aberto com a mensagem.");
            }}
            className={estiloDoEmail}
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            Email
          </a>
        ) : (
          <button type="button" disabled title="O pedido não tem email" className={DESLIGADO}>
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            Email
            <span className="font-normal">· sem email</span>
          </button>
        )}

        <button type="button" onClick={copiar} className={estiloDoCopiar}>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          Copiar mensagem
        </button>
      </div>

      {registo && (
        <p className={`mt-2 text-xs ${registo.tipo === "ok" ? "text-emerald-300" : "text-amber-300"}`} role="status">
          {registo.texto}
        </p>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">Ver a mensagem</summary>
        <pre className="mt-1.5 whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950 p-2 font-sans text-xs leading-relaxed text-slate-300">
          {texto}
        </pre>
      </details>
    </div>
  );
}
