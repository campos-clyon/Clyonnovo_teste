"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { AVISO_SEM_NADA_PAGO, semNadaPagoRegistado } from "@/lib/aviso-sem-nada-pago";

/**
 * «ENVIAR O VALOR FINAL AO CLIENTE» — d38 v2, commit d (15-11-2026).
 *
 * Na caixa da folha final (Pagamentos, Mesa e Trabalhos CLYON), depois de
 * gravada. «Ver a mensagem» pergunta ao servidor (a mesma conta que envia:
 * `valor-final-ao-cliente.ts`) e mostra o total com IVA e o sem IVA ao lado,
 * o que mudou (se a equipa o quiser juntar) e o canal. Só sai quando se carrega
 * em «Enviar»: no modelo antigo e nos Trabalhos CLYON gera uma Multibanco e um
 * MB WAY novos (as referências antigas ficam canceladas); no modelo de 15-11
 * leva os dados para pagar ao parceiro e as duas faturas. O pagamento entra
 * sozinho pelo webhook. Só administradores.
 */

type Conta =
  | { modo: "referencia"; total: number; semIva: number; iva: number; aPedir: number; parte: "trabalho" | "diferenca"; pagoAteAgora: number }
  | { modo: "parceiro"; total: number; semIva: number; iva: number; faturaDoParceiro: number; faturaDaClyon: number; regime: "normal" | "isento" };

type Envio = {
  id: number;
  total: number;
  semIva: number;
  aPedir: number;
  canaisQueSairam: string[];
  porQuem: string | null;
  enviadoEm: string | null;
};

type Previa = {
  conta: Conta | null;
  mensagem: string | null;
  porqueNao: string | null;
  destinos: { whatsapp: boolean; email: boolean };
  sugestaoDoQueMudou: string;
  historico: Envio[];
};

const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
/** d70: com IVA e o sem IVA ao lado; sem fatura (sem IVA nenhum), di-lo — como `totalEmPalavras`. */
const totalComOuSemFatura = (total: number, semIva: number) =>
  total > semIva ? `${eur(total)} com IVA (${eur(semIva)} sem IVA)` : `${eur(total)} (sem fatura)`;
const QUANDO = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const canais = (c: string[]) => (c.length === 0 ? "não saiu" : c.map((x) => (x === "whatsapp" ? "WhatsApp" : "email")).join(" e "));

export default function EnviarValorFinalAoCliente({ pedidoId, negociacaoId }: { pedidoId: number; negociacaoId: number }) {
  const { token } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [aberto, setAberto] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [juntar, setJuntar] = useState(false);
  const [oQueMudou, setOQueMudou] = useState("");
  const [canal, setCanal] = useState<"whatsapp" | "email" | "ambos">("whatsapp");
  const [ocupado, setOcupado] = useState(false);
  const [resposta, setResposta] = useState<{ ok: boolean; texto: string; mensagem?: string } | null>(null);
  // Sem nada pago registado, o «Enviar» pede um segundo clique (16-11-2026, d52).
  const [naMesma, setNaMesma] = useState(false);

  async function pedir(previsualizar: boolean, texto?: string) {
    if (!token) return null;
    const res = await fetch("/api/admin/negociacoes/horas", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        pedidoId,
        negociacaoId,
        accao: "valor_final_ao_cliente",
        previsualizar,
        canal,
        oQueMudou: texto ?? (juntar ? oQueMudou : ""),
      }),
    });
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, j };
  }

  async function ver(texto?: string) {
    setOcupado(true);
    setResposta(null);
    try {
      const r = await pedir(true, texto);
      if (!r) return;
      const j = r.j;
      const p: Previa = {
        conta: (j.conta as Conta) ?? null,
        mensagem: (j.mensagem as string) ?? null,
        porqueNao: r.ok ? null : ((j.error as string) ?? "Não foi possível fazer a conta."),
        destinos: (j.destinos as Previa["destinos"]) ?? { whatsapp: false, email: false },
        sugestaoDoQueMudou: (j.sugestaoDoQueMudou as string) ?? "",
        historico: (j.historico as Envio[]) ?? [],
      };
      setPrevia(p);
      setNaMesma(false);
      if (!oQueMudou && p.sugestaoDoQueMudou) setOQueMudou(p.sugestaoDoQueMudou);
      if (!p.destinos.whatsapp && p.destinos.email) setCanal("email");
    } catch {
      setResposta({ ok: false, texto: "Erro de rede." });
    } finally {
      setOcupado(false);
    }
  }

  async function enviar() {
    const c = previa?.conta;
    if (!c) return;
    const onde = canal === "ambos" ? "pelo WhatsApp e por email" : canal === "email" ? "por email" : "pelo WhatsApp";
    const como =
      c.modo === "referencia"
        ? "Gera uma referência Multibanco e um MB WAY novos; as referências antigas deste trabalho deixam de valer."
        : "Leva os dados para pagar ao parceiro e as duas faturas.";
    if (!window.confirm(`Enviar o valor final do #${pedidoId} ao cliente ${onde}?\n\n${totalComOuSemFatura(c.total, c.semIva)}.\n${como}`)) return;
    setOcupado(true);
    setResposta(null);
    try {
      const r = await pedir(false);
      if (!r) return;
      if (r.ok) {
        setResposta({ ok: true, texto: (r.j.feito as string) ?? "Enviado." });
        await ver();
      } else {
        setResposta({ ok: false, texto: (r.j.error as string) ?? "Não foi possível enviar.", mensagem: (r.j.texto as string) ?? undefined });
      }
    } catch {
      setResposta({ ok: false, texto: "Erro de rede." });
    } finally {
      setOcupado(false);
    }
  }

  const c = previa?.conta ?? null;
  const semNadaPago = semNadaPagoRegistado(c);
  const podeEnviar =
    Boolean(c) && eAdministrador && !ocupado && (canal === "email" ? previa?.destinos.email : canal === "whatsapp" ? previa?.destinos.whatsapp : previa?.destinos.email && previa?.destinos.whatsapp);

  return (
    <div className="mt-2 rounded-lg border border-emerald-800/60 bg-slate-950/60 p-2.5">
      <button
        type="button"
        onClick={() => {
          setAberto((a) => !a);
          if (!aberto && !previa) void ver();
        }}
        className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
      >
        <Send className="h-3.5 w-3.5" aria-hidden="true" />
        {aberto ? "Fechar" : "Enviar o valor final ao cliente"}
      </button>

      {aberto && (
        <div className="mt-2 space-y-2 text-[11px] text-slate-300">
          {!previa && <p className="text-slate-400">A fazer a conta…</p>}
          {previa?.porqueNao && <p className="text-amber-300">{previa.porqueNao}</p>}
          {c && (
            <div className="rounded border border-slate-700 bg-slate-900/70 p-2">
              <p>
                Valor final <strong className="text-white">{eur(c.total)}</strong>
                {c.iva > 0 ? <> com IVA · {eur(c.semIva)} sem IVA</> : " (sem fatura)"}
              </p>
              {c.modo === "referencia" && c.parte === "diferenca" && (
                <p>
                  Já pagou {eur(c.pagoAteAgora)} pela estimativa: pede-se a diferença, <strong className="text-white">{eur(c.aPedir)}</strong>.
                </p>
              )}
              {c.modo === "parceiro" && (
                <p className="text-slate-400">
                  Modelo de 15/11: paga ao parceiro — fatura do trabalho {eur(c.faturaDoParceiro)} + fatura da CLYON {eur(c.faturaDaClyon)}.
                </p>
              )}
            </div>
          )}

          {c && (
            <>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={juntar} onChange={(e) => setJuntar(e.target.checked)} /> Juntar o que mudou e porquê
              </label>
              {juntar && (
                <textarea
                  value={oQueMudou}
                  onChange={(e) => setOQueMudou(e.target.value)}
                  rows={2}
                  maxLength={600}
                  className="block w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white"
                />
              )}
              <fieldset>
                <legend className="text-slate-400">Por onde vai</legend>
                <div className="mt-1 flex flex-wrap gap-3">
                  {(["whatsapp", "email", "ambos"] as const).map((k) => (
                    <label key={k} className="flex items-center gap-1">
                      <input type="radio" checked={canal === k} onChange={() => setCanal(k)} />
                      {k === "whatsapp" ? "WhatsApp" : k === "email" ? "Email" : "Os dois"}
                    </label>
                  ))}
                </div>
                {!previa?.destinos.whatsapp && <p className="text-amber-300">O pedido não tem telemóvel.</p>}
                {!previa?.destinos.email && <p className="text-amber-300">O pedido não tem email.</p>}
              </fieldset>
              <button
                type="button"
                onClick={() => void ver(juntar ? oQueMudou : "")}
                disabled={ocupado}
                className="rounded-lg border border-cyan-700 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-40"
              >
                Ver a mensagem
              </button>
              {previa?.mensagem && (
                <pre className="whitespace-pre-wrap rounded border border-slate-700 bg-slate-950 p-2 font-sans text-[11px] text-slate-200">{previa.mensagem}</pre>
              )}
              {semNadaPago && (
                <p role="alert" className="rounded border border-amber-600/50 bg-amber-950/30 px-2 py-1.5 font-semibold text-amber-200">
                  {AVISO_SEM_NADA_PAGO}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  // O primeiro clique, sem nada pago registado, só arma o «Enviar na mesma».
                  if (semNadaPago && !naMesma) {
                    setNaMesma(true);
                    return;
                  }
                  void enviar();
                }}
                disabled={!podeEnviar}
                title={eAdministrador ? undefined : "Só administradores"}
                className="flex items-center gap-1.5 rounded-lg bg-acao px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
              >
                {ocupado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                {semNadaPago && naMesma ? "Enviar na mesma" : "Enviar"} {eur(c.modo === "referencia" ? c.aPedir : c.total)}
              </button>
            </>
          )}

          {resposta && (
            <div className={resposta.ok ? "text-emerald-300" : "text-red-300"}>
              <p>{resposta.texto}</p>
              {resposta.mensagem && (
                <pre className="mt-1 whitespace-pre-wrap rounded border border-slate-700 bg-slate-950 p-2 font-sans text-slate-200">{resposta.mensagem}</pre>
              )}
            </div>
          )}

          {previa && previa.historico.length > 0 && (
            <details className="text-slate-400">
              <summary className="cursor-pointer">Já enviado ({previa.historico.length})</summary>
              <ul className="mt-1 space-y-1">
                {previa.historico.map((h) => (
                  <li key={h.id}>
                    {h.enviadoEm ? QUANDO.format(new Date(h.enviadoEm)) : "—"}
                    {h.porQuem ? `, ${h.porQuem}` : ""}: {totalComOuSemFatura(h.total, h.semIva)}
                    {h.aPedir !== h.total ? `, pedidos ${eur(h.aPedir)}` : ""} — {canais(h.canaisQueSairam)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
