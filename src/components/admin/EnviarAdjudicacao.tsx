"use client";

import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  MOTIVO_DOS_DADOS_DO_DONO_MAXIMO,
  PEDE_O_MOTIVO_DOS_DADOS_DO_DONO,
  lerMotivoDosDadosDoDono,
  linkDaAdjudicacao,
  type ReferenciaNaAdjudicacao,
  type TrabalhoAdjudicado,
  type AdjudicacaoNoNovoModelo,
} from "@/lib/mensagem-de-adjudicacao";

/**
 * «ENVIAR ADJUDICAÇÃO AO CLIENTE», COM AS FORMAS DE PAGAMENTO — 27-10-2026 (d14).
 *
 * Na Mesa e nos Trabalhos CLYON. Escolhe-se uma ou várias formas:
 *
 *   · o link do pedido, onde o cliente paga pela plataforma por MB WAY,
 *     Multibanco ou transferência — MARCADO POR OMISSÃO desde 03-11-2026 (d15),
 *     como no «Enviar valores para pagamento» (d19);
 *   · uma referência Multibanco do euPago para este pedido;
 *   · um MB WAY do euPago para este pedido, para o telemóvel do cliente;
 *   · os dados do dono (Configs → «Métodos de pagamento para a adjudicação») —
 *     DESMARCADOS por omissão desde a d15, e só com um motivo escrito, como no
 *     «sem factura». O motivo fica no histórico do pedido.
 *
 * As referências vão pela rota de sempre (/api/admin/pagamentos/criar): o
 * VALOR É SEMPRE O DO SERVIDOR — este ecrã não manda valor nenhum —, a
 * Multibanco viva do mesmo valor reaproveita-se, e uma nova anula a antiga. O
 * link e o motivo vão pela rota da adjudicação (/api/admin/negociacoes/adjudicacao).
 *
 * NÃO MANDA A MENSAGEM: abre o WhatsApp do cliente com ela escrita.
 *
 * NO MODELO DE 15-11 (d17, 13-11-2026) o cliente paga ao parceiro: o bloco do
 * pagamento é o texto D das Vendas (sem «Paga à CLYON»), com o total do bloco
 * «Pagar a …» e o link do pedido, onde estão os dados para pagar. Não se
 * oferecem referências ao cliente nem os dados do dono. Quem decide o modelo é o
 * servidor (a rota da adjudicação); a marca da Mesa só esconde as caixas.
 */

type Props = {
  negociacaoId: number;
  adjudicacao: Omit<TrabalhoAdjudicado, "formas" | "metodosDePagamento"> & { telefone: string | null };
  metodosDePagamento: string | null;
  metodosLidos: boolean;
  /** O estilo do botão, para combinar com o cartão onde está. */
  classeDoBotao: string;
  /** A negociação segue o modelo de 15-11 (`noNovoModelo` da Mesa, d17). */
  novoModelo?: boolean;
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

type Preparada = {
  link: string | null;
  referencias: ReferenciaNaAdjudicacao[];
  /** O modelo de 15-11, como o servidor o decidiu (d17). */
  novoModelo?: AdjudicacaoNoNovoModelo | null;
};

export default function EnviarAdjudicacao({
  negociacaoId,
  adjudicacao,
  metodosDePagamento,
  metodosLidos,
  classeDoBotao,
  novoModelo = false,
}: Props) {
  const { token } = useAdminAuth();
  const [aberto, setAberto] = useState(false);
  const temDadosDoDono = Boolean(metodosDePagamento && metodosDePagamento.trim());
  // O pagamento pela plataforma, por omissão; os dados do dono, desmarcados (d15).
  const [comLink, setComLink] = useState(true);
  const [doDono, setDoDono] = useState(false);
  const [motivoDoDono, setMotivoDoDono] = useState("");
  const [multibanco, setMultibanco] = useState(false);
  const [mbway, setMbway] = useState(false);
  const [telemovel, setTelemovel] = useState(adjudicacao.telefone ?? "");
  const [aPreparar, setAPreparar] = useState(false);
  const [erro, setErro] = useState("");
  const [preparada, setPreparada] = useState<Preparada | null>(null);

  // No modelo novo (d17): só o link do pedido; sem referências ao cliente nem os dados do dono.
  const comDono = !novoModelo && doDono && temDadosDoDono;
  const motivoValido = lerMotivoDosDadosDoDono(motivoDoDono).ok;
  const precisaDoServidor = novoModelo || comLink || multibanco || mbway || comDono;
  const fixo = preparada != null;

  const link = (p: Preparada) =>
    linkDaAdjudicacao(
      {
        ...adjudicacao,
        metodosDePagamento,
        formas: {
          comDadosDoDono: comDono,
          motivoDosDadosDoDono: comDono ? motivoDoDono : null,
          referencias: p.referencias,
          link: p.link,
          novoModelo: p.novoModelo ?? null,
        },
      },
      new Date(),
    );

  async function preparar() {
    setAPreparar(true);
    setErro("");
    const feitas: ReferenciaNaAdjudicacao[] = [];
    let linkDoPedido: string | null = null;
    try {
      for (const metodo of novoModelo ? [] : [multibanco ? "multibanco" : null, mbway ? "mbway" : null]) {
        if (!metodo) continue;
        const r = await fetch("/api/admin/pagamentos/criar", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          // Sem valor: quem decide quanto se pede é o servidor.
          // `origem`: no modelo de 15-11 o servidor recusa referências pedidas daqui (d17).
          body: JSON.stringify({
            negociacaoId,
            metodo,
            origem: "adjudicacao",
            ...(metodo === "mbway" ? { telemovel } : {}),
          }),
        });
        const d = (await r.json().catch(() => ({}))) as Resposta;
        if (!r.ok || !d.pagamento) {
          setErro(`${metodo === "mbway" ? "MB WAY" : "Multibanco"}: ${d.error ?? "não foi possível gerar."}`);
          // As que já se geraram ficam na mensagem, como antes: não se pede outra vez um MB WAY.
          if (feitas.length > 0) setPreparada({ link: null, referencias: feitas });
          return;
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
      // O link do pedido e o motivo dos dados do dono (d15).
      let doNovoModelo: AdjudicacaoNoNovoModelo | null = null;
      if (novoModelo || comLink || comDono) {
        const r = await fetch("/api/admin/negociacoes/adjudicacao", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            negociacaoId,
            comLink: novoModelo || comLink,
            dadosDoDono: comDono,
            motivoDosDadosDoDono: comDono ? motivoDoDono : null,
          }),
        });
        const d = (await r.json().catch(() => ({}))) as {
          link?: string | null;
          error?: string;
          novoModelo?: AdjudicacaoNoNovoModelo | null;
        };
        if (!r.ok) {
          setErro(d.error ?? "Não foi possível preparar a mensagem.");
          if (feitas.length > 0) setPreparada({ link: null, referencias: feitas });
          return;
        }
        linkDoPedido = d.link ?? null;
        doNovoModelo = d.novoModelo ?? null;
      }
      setPreparada({ link: linkDoPedido, referencias: feitas, novoModelo: doNovoModelo });
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAPreparar(false);
    }
  }

  const pronto = preparada ? link(preparada) : precisaDoServidor ? null : link({ link: null, referencias: [] });

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
          {novoModelo && (
            <p className="mt-2 text-slate-300">
              Modelo de 15-11: o cliente paga diretamente ao parceiro. A mensagem leva o total e o link do pedido, onde
              estão os dados para pagar. Sem referências ao cliente.
            </p>
          )}
          {!novoModelo && (<>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={comLink} disabled={fixo} onChange={(e) => setComLink(e.target.checked)} />
            Link do pedido: o cliente paga pela plataforma (MB WAY, Multibanco ou transferência)
          </label>
          {comLink && !fixo && (
            <p className="ml-6 text-slate-400">Gera-se um link novo ao preparar; o anterior deixa de funcionar.</p>
          )}
          <label className="mt-1.5 flex items-center gap-2">
            <input
              type="checkbox"
              checked={multibanco}
              disabled={fixo}
              onChange={(e) => setMultibanco(e.target.checked)}
            />
            Referência Multibanco euPago para este pedido
          </label>
          <label className="mt-1.5 flex items-center gap-2">
            <input
              type="checkbox"
              checked={mbway}
              disabled={fixo}
              onChange={(e) => setMbway(e.target.checked)}
            />
            MB WAY euPago para este pedido
          </label>
          {mbway && (
            <div className="ml-6 mt-1.5">
              <input
                type="tel"
                value={telemovel}
                disabled={fixo}
                onChange={(e) => setTelemovel(e.target.value)}
                aria-label="Telemóvel do cliente para o MB WAY"
                className="w-44 rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              />
              <p className="mt-1 text-slate-400">
                O pedido chega à aplicação MB WAY do cliente assim que o gerar, e dura 5 minutos.
              </p>
            </div>
          )}
          <label className={`mt-1.5 flex items-center gap-2 ${temDadosDoDono ? "" : "opacity-50"}`}>
            <input
              type="checkbox"
              checked={comDono}
              disabled={!temDadosDoDono || fixo}
              onChange={(e) => setDoDono(e.target.checked)}
            />
            Dados do dono (Métodos de pagamento das Configs), fora da plataforma
          </label>
          {comDono && (
            <label className="ml-6 mt-1 block">
              <span className="font-semibold text-amber-200">Motivo de não ir pela plataforma (obrigatório)</span>
              <textarea
                value={motivoDoDono}
                disabled={fixo}
                onChange={(e) => setMotivoDoDono(e.target.value)}
                maxLength={MOTIVO_DOS_DADOS_DO_DONO_MAXIMO}
                rows={2}
                placeholder="Ex.: o cliente não consegue pagar por MB WAY nem Multibanco"
                className="mt-1 w-full rounded-lg border border-amber-500/40 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
              />
              {!motivoValido && (
                <span className="mt-0.5 block text-[11px] text-red-300">{PEDE_O_MOTIVO_DOS_DADOS_DO_DONO}</span>
              )}
            </label>
          )}
          {metodosLidos && !temDadosDoDono && <p className="ml-6 text-slate-400">Sem métodos de pagamento nas Configs.</p>}
          </>)}
          {!precisaDoServidor && (
            <p className="mt-2 text-amber-300">Sem nenhuma forma escolhida, a mensagem diz que os dados seguem a seguir.</p>
          )}

          {precisaDoServidor && !fixo && (
            <button
              type="button"
              onClick={() => void preparar()}
              disabled={aPreparar || (mbway && !telemovel.trim()) || (comDono && !motivoValido)}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-cyan-600/60 px-2.5 py-1.5 font-semibold text-cyan-200 disabled:opacity-40"
            >
              {aPreparar && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {aPreparar ? "A preparar…" : "Preparar a mensagem"}
            </button>
          )}
          {preparada != null && preparada.referencias.length > 0 && (
            <p className="mt-2 text-emerald-300">
              {preparada.referencias.length === 1 ? "Referência gerada" : "Referências geradas"} — ficam nos Pagamentos
              deste pedido.
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
