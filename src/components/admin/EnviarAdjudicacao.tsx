"use client";

import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  linkDaAdjudicacao,
  type ReferenciaNaAdjudicacao,
  type TrabalhoAdjudicado,
} from "@/lib/mensagem-de-adjudicacao";

/**
 * «ENVIAR ADJUDICAÇÃO AO CLIENTE», COM AS FORMAS DE PAGAMENTO — 27-10-2026 (d14).
 *
 * Na Mesa e nos Trabalhos CLYON. Escolhe-se uma ou várias formas:
 *
 *   · os dados do dono (Configs → «Métodos de pagamento para a adjudicação»);
 *   · uma referência Multibanco do euPago para este pedido;
 *   · um MB WAY do euPago para este pedido, para o telemóvel do cliente.
 *
 * As referências geram-se na hora pela rota de sempre
 * (/api/admin/pagamentos/criar): o VALOR É SEMPRE O DO SERVIDOR — este ecrã
 * não manda valor nenhum —, a Multibanco viva do mesmo valor reaproveita-se, e
 * uma nova anula a antiga. Ficam ligadas ao pedido nos Pagamentos.
 *
 * NÃO MANDA A MENSAGEM: abre o WhatsApp do cliente com ela escrita.
 */

type Props = {
  negociacaoId: number;
  adjudicacao: Omit<TrabalhoAdjudicado, "formas" | "metodosDePagamento"> & { telefone: string | null };
  metodosDePagamento: string | null;
  metodosLidos: boolean;
  /** O estilo do botão, para combinar com o cartão onde está. */
  classeDoBotao: string;
};

type Resposta = {
  error?: string;
  pagamento?: {
    metodo: "multibanco" | "mbway";
    valor: number;
    entidade: string | null;
    referencia: string | null;
    telemovel: string | null;
    expiraEm: string | null;
  };
};

export default function EnviarAdjudicacao({
  negociacaoId,
  adjudicacao,
  metodosDePagamento,
  metodosLidos,
  classeDoBotao,
}: Props) {
  const { token } = useAdminAuth();
  const [aberto, setAberto] = useState(false);
  const temDadosDoDono = Boolean(metodosDePagamento && metodosDePagamento.trim());
  const [doDono, setDoDono] = useState(temDadosDoDono);
  const [multibanco, setMultibanco] = useState(false);
  const [mbway, setMbway] = useState(false);
  const [telemovel, setTelemovel] = useState(adjudicacao.telefone ?? "");
  const [aGerar, setAGerar] = useState(false);
  const [erro, setErro] = useState("");
  const [geradas, setGeradas] = useState<ReferenciaNaAdjudicacao[] | null>(null);

  const comEupago = multibanco || mbway;
  const link = (referencias: ReferenciaNaAdjudicacao[]) =>
    linkDaAdjudicacao(
      {
        ...adjudicacao,
        metodosDePagamento,
        formas: { comDadosDoDono: doDono && temDadosDoDono, referencias },
      },
      new Date(),
    );

  async function gerar() {
    setAGerar(true);
    setErro("");
    const feitas: ReferenciaNaAdjudicacao[] = [];
    try {
      for (const metodo of [multibanco ? "multibanco" : null, mbway ? "mbway" : null]) {
        if (!metodo) continue;
        const r = await fetch("/api/admin/pagamentos/criar", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          // Sem valor: quem decide quanto se pede é o servidor.
          body: JSON.stringify({
            negociacaoId,
            metodo,
            ...(metodo === "mbway" ? { telemovel } : {}),
          }),
        });
        const d = (await r.json().catch(() => ({}))) as Resposta;
        if (!r.ok || !d.pagamento) {
          setErro(`${metodo === "mbway" ? "MB WAY" : "Multibanco"}: ${d.error ?? "não foi possível gerar."}`);
          break;
        }
        feitas.push({
          metodo: d.pagamento.metodo,
          valor: d.pagamento.valor,
          entidade: d.pagamento.entidade,
          referencia: d.pagamento.referencia,
          telemovel: d.pagamento.telemovel,
          expiraEm: d.pagamento.expiraEm,
        });
      }
    } catch {
      setErro("Erro de rede.");
    } finally {
      setGeradas(feitas);
      setAGerar(false);
    }
  }

  const pronto = comEupago ? (geradas && geradas.length > 0 ? link(geradas) : null) : link([]);

  return (
    <div className={aberto ? "flex w-full flex-col gap-2" : "contents"}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        title="Escolher as formas de pagamento e abrir o WhatsApp do cliente com a adjudicação"
        className={classeDoBotao}
      >
        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Enviar adjudicação ao cliente
      </button>

      {aberto && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-200">
          <p className="font-semibold text-slate-100">Formas de pagamento na mensagem</p>
          <label className={`mt-2 flex items-center gap-2 ${temDadosDoDono ? "" : "opacity-50"}`}>
            <input
              type="checkbox"
              checked={doDono && temDadosDoDono}
              disabled={!temDadosDoDono || geradas != null}
              onChange={(e) => setDoDono(e.target.checked)}
            />
            Dados do dono (Métodos de pagamento das Configs)
          </label>
          {metodosLidos && !temDadosDoDono && (
            <p className="ml-6 text-amber-300">
              Sem métodos de pagamento nas Configs: a mensagem diz que os dados seguem a seguir.
            </p>
          )}
          <label className="mt-1.5 flex items-center gap-2">
            <input
              type="checkbox"
              checked={multibanco}
              disabled={geradas != null}
              onChange={(e) => setMultibanco(e.target.checked)}
            />
            Referência Multibanco euPago para este pedido
          </label>
          <label className="mt-1.5 flex items-center gap-2">
            <input
              type="checkbox"
              checked={mbway}
              disabled={geradas != null}
              onChange={(e) => setMbway(e.target.checked)}
            />
            MB WAY euPago para este pedido
          </label>
          {mbway && (
            <div className="ml-6 mt-1.5">
              <input
                type="tel"
                value={telemovel}
                disabled={geradas != null}
                onChange={(e) => setTelemovel(e.target.value)}
                aria-label="Telemóvel do cliente para o MB WAY"
                className="w-44 rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              />
              <p className="mt-1 text-slate-400">
                O pedido chega à aplicação MB WAY do cliente assim que o gerar, e dura 5 minutos.
              </p>
            </div>
          )}

          {comEupago && geradas == null && (
            <button
              type="button"
              onClick={() => void gerar()}
              disabled={aGerar || (mbway && !telemovel.trim())}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-cyan-600/60 px-2.5 py-1.5 font-semibold text-cyan-200 disabled:opacity-40"
            >
              {aGerar && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {aGerar ? "A gerar…" : "Gerar e preparar a mensagem"}
            </button>
          )}
          {geradas != null && geradas.length > 0 && (
            <p className="mt-2 text-emerald-300">
              {geradas.length === 1 ? "Referência gerada" : "Referências geradas"} — ficam nos Pagamentos deste pedido.
            </p>
          )}
          {erro && <p className="mt-2 text-red-300">{erro}</p>}

          {pronto && (
            <a
              href={pronto}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/60 bg-emerald-500/10 px-2.5 py-1.5 font-semibold text-emerald-200 hover:bg-emerald-500/20"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Abrir o WhatsApp do cliente com a mensagem
            </a>
          )}
        </div>
      )}
    </div>
  );
}
