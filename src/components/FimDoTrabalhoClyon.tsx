"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Star } from "lucide-react";
import PagarTrabalho from "@/components/PagarTrabalho";
import PrecoDaClyon from "@/components/PrecoDaClyon";
import type { FimDoTrabalhoClyon as Fim } from "@/lib/fim-do-trabalho-clyon";
import type { PrecoClyonNoEcra } from "@/lib/preco-clyon-para-o-cliente";

/**
 * O FIM DE UM TRABALHO CLYON, NO LINK DO PEDIDO — d6, 31-10-2026.
 *
 * O mesmo que a app mostra (`fim-do-trabalho-clyon.ts`), pela ordem de uma
 * negociação: quem faz e o dia combinado, o pagamento (a referência que a
 * CLYON gerou, ou pagar sozinho — o mesmo `PagarTrabalho` das negociações),
 * «A CLYON confirma consigo quando o trabalho estiver feito» e, depois de
 * confirmado, «Como correu com {nome}?». Avaliar vai pela mesma
 * `agirComoCliente` da app.
 *
 * O PREÇO JÁ FOI ACORDADO — 05-11-2026 (d20 v2). *«Não deve ter aceitar, pois
 * já foi acordado anteriormente.»* — o dono. Com o parceiro escolhido pela
 * CLYON, o preço foi fechado com o cliente na conversa: aqui não há «Aceito
 * este preço». Há o valor (sem IVA, IVA e total) e logo as formas de pagar,
 * no bloco de pagar, com o botão «Pagar». O pagamento não precisa de nenhuma
 * aceitação gravada (`trabalhoQueSePodePagar` não a lê), por isso nada se
 * grava sozinho. Sem o bloco de pagar à vista (a porta fechada, um modelo
 * antigo), fica o cartão do preço, só para ler.
 *
 * E PAGA-SE DEPOIS DE FEITO: num Trabalho CLYON a equipa manda os valores
 * para pagamento quando o trabalho está feito («Enviar valores para
 * pagamento», d19). Por isso as formas de pagar continuam à vista depois de
 * confirmado, enquanto não estiver pago. O `?pagar=1` desse link põe o ecrã
 * no bloco de pagar.
 */
export default function FimDoTrabalhoClyon({
  fim,
  pedidoId,
  token,
  precisaFatura,
  telefoneDoCliente,
  soParaVer = false,
  preco = null,
  focarNoPagamento = false,
}: {
  fim: Fim;
  pedidoId: number;
  /** O token do link; sem ele, a sessão da conta (`/api/users/me/negociacao`). */
  token?: string;
  precisaFatura: boolean;
  telefoneDoCliente: string | null;
  soParaVer?: boolean;
  /** O preço já acordado — sem «Aceito», só para ler quando o bloco de pagar não está à vista. */
  preco?: PrecoClyonNoEcra | null;
  /** Veio do «Enviar valores para pagamento» (`?pagar=1`): o ecrã abre no pagamento. */
  focarNoPagamento?: boolean;
}) {
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dada, setDada] = useState<number | null>(fim.estrelas);
  const confirmado = fim.fase === "confirmado" || fim.fase === "pago";
  // O bloco de pagar está à vista? Até se saber, o cartão do preço fica.
  const [blocoAVista, setBlocoAVista] = useState(false);
  const aoDecidir = useCallback((v: boolean) => setBlocoAVista(v), []);
  const pagamento = useRef<HTMLDivElement>(null);
  const jaFocou = useRef(false);
  useEffect(() => {
    if (!focarNoPagamento || jaFocou.current || !pagamento.current) return;
    if (!blocoAVista && fim.podePagar) return;
    jaFocou.current = true;
    pagamento.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focarNoPagamento, blocoAVista, fim.podePagar]);

  async function avaliar() {
    if (soParaVer || estrelas < 1) return;
    setAEnviar(true);
    setErro(null);
    try {
      const r = await fetch(token ? `/api/negociacao/${token}` : "/api/users/me/negociacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accao: "avaliar", pedidoId, negociacaoId: fim.negociacaoId, estrelas, comentario: comentario.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Não foi possível guardar. Tente outra vez.");
      setDada(estrelas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível guardar. Tente outra vez.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
    {preco && !blocoAVista && <PrecoDaClyon preco={preco} enviarPara={null} podeAceitar={false} />}
    <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <p className="text-sm font-semibold text-tinta">{fim.textos.quemFaz}</p>
      <p className="mt-2 text-sm text-slate-700">{fim.textos.dia}</p>
      {fim.textos.aClyonConfirma && <p className="mt-2 text-sm text-slate-600">{fim.textos.aClyonConfirma}</p>}
      {confirmado && fim.confirmadoEmTexto && (
        <p className="mt-2 text-sm font-semibold text-emerald-800">Confirmado pela CLYON a {fim.confirmadoEmTexto}.</p>
      )}

      <div ref={pagamento} id="pagar" className="scroll-mt-4">
        {fim.podePagar && (
          <PagarTrabalho
            pedidoId={pedidoId}
            negociacaoId={fim.negociacaoId}
            token={token}
            precisaFatura={precisaFatura}
            telefoneSugerido={telefoneDoCliente}
            soParaVer={soParaVer}
            aoDecidir={aoDecidir}
          />
        )}
      </div>

      {confirmado && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-left">
          {dada ? (
            <p className="flex items-center justify-center gap-1 text-sm text-slate-600">
              A sua avaliação:
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={`h-4 w-4 ${n <= dada ? "fill-[#00B4CC] text-[#00B4CC]" : "text-slate-300"}`} aria-hidden="true" />
              ))}
            </p>
          ) : fim.podeAvaliar ? (
            <>
              <p className="text-center text-sm font-semibold text-tinta">{fim.textos.pergunta}</p>
              <div className="mt-2 flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setEstrelas(n)} aria-label={`${n} de 5 estrelas`} className="p-1">
                    <Star className={`h-8 w-8 transition ${n <= estrelas ? "fill-[#00B4CC] text-[#00B4CC]" : "text-slate-300"}`} />
                  </button>
                ))}
              </div>
              {estrelas > 0 && (
                <>
                  <textarea
                    value={comentario}
                    onChange={(ev) => setComentario(ev.target.value)}
                    rows={2}
                    maxLength={600}
                    placeholder="Quer deixar uma palavra? (opcional)"
                    className="mt-3 w-full rounded-xl border-2 border-gray-300 p-3 text-sm outline-none focus:border-cyan-600"
                  />
                  <button
                    type="button"
                    onClick={() => void avaliar()}
                    disabled={soParaVer || aEnviar}
                    className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-acao font-bold text-white transition active:bg-acao-hover disabled:opacity-40"
                  >
                    {aEnviar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Enviar avaliação
                  </button>
                </>
              )}
              {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
            </>
          ) : null}
        </div>
      )}
    </section>
    </>
  );
}
