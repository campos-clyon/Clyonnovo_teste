"use client";

import { useState } from "react";
import { Loader2, Sparkles, Tag } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useReservaDoValorUnico } from "@/hooks/useReservaDoValorUnico";
import {
  diferencaEmTexto,
  escolherPorMim,
  valorUnicoComIva,
  valorUnicoSugerido,
  type CandidatoAoValorUnico,
} from "@/lib/valor-unico";

/*
 * O VALOR ÚNICO NA MESA — 15-11-2026 (d39, caminho B do CEO e do dono).
 *
 * Num pedido com propostas, a equipa grava um valor só para o cliente — a
 * mediana das propostas abertas, arredondada a 5 €, vem escrita e pode mudar.
 * As negociações NÃO acabam: os parceiros continuam com as propostas deles.
 * Com o valor gravado, o «Enviar orçamento» e o «Enviar pela CLYON» mandam a
 * mensagem do valor único (sem nomes), e aqui há «Enviar por email».
 *
 * Depois de o cliente dizer que sim, «Escolher por mim» sugere o parceiro
 * (`escolherPorMim`), e a equipa aceita a proposta dele pelo «Aceitar» de
 * sempre — que avisa antes se ele pediu mais do que o valor único. Com o
 * interruptor «Reserva do valor único» ligado (d101), a diferença é a reserva
 * (d39): gravada ao fechar, na parte da CLYON (reserva.ts); desligado, conta a
 * proposta do parceiro.
 */

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/** O valor único aceite pelo cliente (d39): o texto da Mesa, num sítio só. */
export const VALOR_UNICO_ACEITE_NA_MESA = "Valor único aceite pelo cliente — escolher o parceiro";

const QUANDO = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function ValorUnicoNaMesa({
  pedidoId,
  valorUnico,
  propostas,
  temEmail,
  onMudou,
  aceite = null,
}: {
  /** O cliente aceitou o valor único (a Vitória leu o «SIM», ou a equipa marcou-o). */
  aceite?: { em: string; por: string | null } | null;
  pedidoId: number;
  valorUnico: number | null;
  /** As propostas abertas, como o cliente as veria (sem IVA), com a nota e o «verificado». */
  propostas: CandidatoAoValorUnico[];
  temEmail: boolean;
  onMudou: (aviso?: string) => void;
}) {
  const { token } = useAdminAuth();
  // d101: a «reserva» só se diz com o interruptor ligado.
  const comReserva = useReservaDoValorUnico();
  const sugerido = valorUnicoSugerido(propostas.map((p) => p.semIva));
  const [aEditar, setAEditar] = useState(false);
  const [escrito, setEscrito] = useState("");
  const [ocupado, setOcupado] = useState<"" | "gravar" | "tirar" | "email">("");
  const [erro, setErro] = useState("");
  const [sugestaoAberta, setSugestaoAberta] = useState(false);

  async function pedir(corpo: Record<string, unknown>, qual: "gravar" | "tirar" | "email"): Promise<Record<string, unknown> | null> {
    if (!token) return null;
    setOcupado(qual);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accao: "valor_unico", pedidoId, ...corpo }),
      });
      const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setErro(String(d.error ?? "Não foi possível gravar."));
        return null;
      }
      return d;
    } catch {
      setErro("Erro de rede.");
      return null;
    } finally {
      setOcupado("");
    }
  }

  async function gravar() {
    const valor = escrito.trim() === "" ? sugerido : escrito;
    const d = await pedir({ valor }, "gravar");
    if (!d) return;
    setAEditar(false);
    onMudou(`#${pedidoId}: valor único gravado — o «Enviar orçamento» manda-o sem nomes. As propostas continuam abertas.`);
  }

  async function tirar() {
    if (!window.confirm("Tirar o valor único? O cliente volta a ver as propostas com os nomes.")) return;
    const d = await pedir({ valor: null }, "tirar");
    if (d) onMudou(`#${pedidoId}: valor único tirado.`);
  }

  async function porEmail() {
    if (valorUnico == null) return;
    if (!window.confirm(`Enviar ao cliente, por email, o valor único de ${valorUnicoComIva(valorUnico)}?`)) return;
    const d = await pedir({ valor: valorUnico, email: true }, "email");
    if (!d) return;
    onMudou(
      d.email === "enviado"
        ? `#${pedidoId}: valor único enviado por email.`
        : d.email === "sem_email"
          ? `#${pedidoId}: o cliente não tem email.`
          : `#${pedidoId}: o email não saiu — tente pelo WhatsApp.`,
    );
  }

  const sugestao = valorUnico != null ? escolherPorMim(propostas, valorUnico) : null;

  /** «O cliente aceitou por telefone»: o mesmo estado que a Vitória grava no WhatsApp. */
  async function marcarAceite() {
    if (!token) return;
    if (!window.confirm(`Marcar que o cliente aceitou o valor único do #${pedidoId} (por telefone)?`)) return;
    setOcupado("gravar");
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accao: "valor_unico_aceite", pedidoId }),
      });
      const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setErro(String(d.error ?? "Não foi possível marcar."));
        return;
      }
      onMudou(`#${pedidoId}: valor único aceite pelo cliente — falta escolher o parceiro.`);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado("");
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-violet-500/40 bg-violet-950/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-200">
          <Tag className="h-3.5 w-3.5" aria-hidden="true" />
          Valor único ao cliente
        </p>
        {valorUnico != null ? (
          <span className="text-sm font-semibold text-white">{valorUnicoComIva(valorUnico)}</span>
        ) : (
          <span className="text-xs text-slate-400">
            Um valor só, sem nomes nem lista. As propostas continuam abertas e a CLYON escolhe o parceiro.
          </span>
        )}
      </div>

      {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}

      {aEditar || valorUnico == null ? (
        aEditar ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-300">
              Valor ao cliente, sem IVA{" "}
              <input
                inputMode="decimal"
                value={escrito}
                onChange={(e) => setEscrito(e.target.value)}
                placeholder={sugerido != null ? String(sugerido) : ""}
                className="ml-1 w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
              />
            </label>
            {sugerido != null && (
              <span className="text-[11px] text-slate-400">
                Sugerido: {sugerido} € + IVA — a mediana das propostas abertas, arredondada a 5 €.
              </span>
            )}
            <button
              onClick={() => void gravar()}
              disabled={ocupado !== ""}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {ocupado === "gravar" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Gravar
            </button>
            <button onClick={() => setAEditar(false)} className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-800/60">
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setEscrito(sugerido != null ? String(sugerido) : "");
              setAEditar(true);
            }}
            className="mt-2 rounded-lg border border-violet-500/60 px-2.5 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/10"
          >
            Enviar valor único ao cliente{sugerido != null ? ` · sugerido ${sugerido} € + IVA` : ""}
          </button>
        )
      ) : (
        <>
          {aceite ? (
            <p className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200">
              {VALOR_UNICO_ACEITE_NA_MESA}
              <span className="ml-1 font-normal text-emerald-300/80">
                · {QUANDO.format(new Date(aceite.em))}
                {aceite.por ? `, ${aceite.por}` : ""}
              </span>
            </p>
          ) : (
            <button
              onClick={() => void marcarAceite()}
              disabled={ocupado !== ""}
              className="mt-2 rounded-lg border border-emerald-600/60 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
            >
              O cliente aceitou por telefone
            </button>
          )}
          <p className="mt-1 text-[11px] text-slate-400">
            O «Enviar orçamento» e o «Enviar pela CLYON» mandam este valor, sem nomes. O cliente não vê as propostas até a CLYON escolher.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {temEmail && (
              <button
                onClick={() => void porEmail()}
                disabled={ocupado !== ""}
                className="flex items-center gap-1.5 rounded-lg border border-violet-500/60 px-2.5 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/10 disabled:opacity-50"
              >
                {ocupado === "email" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Enviar por email
              </button>
            )}
            <button
              onClick={() => setSugestaoAberta((a) => !a)}
              aria-expanded={sugestaoAberta}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Escolher por mim
            </button>
            <button
              onClick={() => {
                setEscrito(String(valorUnico));
                setAEditar(true);
              }}
              className="rounded-lg px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800/60"
            >
              Mudar
            </button>
            <button
              onClick={() => void tirar()}
              disabled={ocupado !== ""}
              className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-800/60 disabled:opacity-50"
            >
              Tirar
            </button>
          </div>

          {sugestaoAberta && (
            <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/50 p-2.5 text-xs text-slate-300">
              {sugestao ? (
                <>
                  <p>
                    Sugestão: <strong className="text-white">{sugestao.candidato.nome}</strong> — pediu{" "}
                    {euros(sugestao.candidato.semIva)} + IVA; {sugestao.porque}.
                  </p>
                  <p className="mt-1 text-slate-400">{diferencaEmTexto(valorUnico, sugestao.candidato.semIva, comReserva)}.</p>
                  {sugestao.acimaDoValorUnico && (
                    <p className="mt-1 font-semibold text-amber-300">
                      Pediu mais do que o valor único: o «Aceitar» pergunta antes de fechar.
                    </p>
                  )}
                  <p className="mt-1 text-slate-400">
                    Aceite a proposta dele no cartão dele («Aceitar», em nome do cliente). Só depois mande ao cliente quem é, o dia e como
                    pagar («Enviar adjudicação ao cliente»).
                  </p>
                </>
              ) : (
                <p>Nenhuma proposta aberta de um parceiro verificado: escolha à mão.</p>
              )}
              {propostas.length > 0 && (
                <ul className="mt-2 space-y-0.5 border-t border-slate-800 pt-2 text-slate-400">
                  {[...propostas]
                    .sort((a, b) => a.semIva - b.semIva)
                    .map((p) => (
                      <li key={p.negociacaoId}>
                        {p.nome}: {euros(p.semIva)} + IVA
                        {p.nota ? ` · ${p.nota.media.toFixed(1).replace(".", ",")} (${p.nota.quantas})` : " · sem avaliações"}
                        {p.verificado ? "" : " · não verificado"} · {diferencaEmTexto(valorUnico, p.semIva, comReserva)}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
