"use client";

import { useState } from "react";
import { Check, Copy, CreditCard, Landmark, Loader2, Smartphone } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { linkDoWhatsApp } from "@/lib/mensagem-da-referencia";

/**
 * GERAR A REFERÊNCIA E MANDÁ-LA AO CLIENTE — um pedido de cada vez.
 *
 * *«Vamos colocar apenas para o admin gerar as referências e enviar
 * individualmente para cada pedido.»* — 18-09-2026.
 *
 * Havia um ecrã de pagamento feito, aberto a qualquer cliente. Isto é melhor
 * para começar, e por uma razão que não é técnica: numa cobrança nova o que
 * falta não é o botão — é a confiança de que cada caso correu bem. Com uma
 * pessoa a decidir pedido a pedido, o primeiro erro custa um cliente em vez de
 * cem.
 *
 * FECHADO POR OMISSÃO. Este componente vive dentro do cartão de um trabalho
 * fechado, entre muitas outras coisas; aberto de origem, punha um formulário de
 * cobrança à frente de quem só queria conferir uma conta.
 *
 * NÃO MANDA A MENSAGEM. Escreve-a e entrega-a — o botão do WhatsApp abre a
 * conversa com o texto já lá, e o de copiar serve para tudo o resto. Mandar por
 * nós seria escolher o canal e o momento por quem está a falar com o cliente.
 */

type Pagamento = {
  id: number;
  metodo: "mbway" | "multibanco";
  estado: string;
  valor: number;
  entidade: string | null;
  referencia: string | null;
  telemovel: string | null;
  expiraEm: string | null;
  mensagem: string;
};

const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

function Copiavel({ rotulo, valor }: { rotulo: string; valor: string }) {
  const [feito, setFeito] = useState(false);
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{rotulo}</p>
      <div className="mt-0.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-sm text-slate-100">{valor}</code>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(valor);
              setFeito(true);
              setTimeout(() => setFeito(false), 2000);
            } catch {
              /* Sem área de transferência, o número continua à vista. */
            }
          }}
          className="shrink-0 rounded border border-slate-700 p-1 text-slate-400 hover:text-cyan-300"
          title={`Copiar ${rotulo.toLowerCase()}`}
        >
          {feito ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

export default function GerarReferencia({
  negociacaoId,
  telefoneDoCliente,
  precisaFatura = false,
  /** Os dois valores, já calculados pelo servidor. Este ecrã não faz contas. */
  semFactura,
  comFacturaValor,
}: {
  negociacaoId: number;
  telefoneDoCliente?: string | null;
  precisaFatura?: boolean;
  semFactura: number;
  comFacturaValor: number;
}) {
  const { token } = useAdminAuth();
  const [aberto, setAberto] = useState(false);
  const [comFactura, setComFactura] = useState(precisaFatura);
  const [telemovel, setTelemovel] = useState(telefoneDoCliente ?? "");
  const [aGerar, setAGerar] = useState<"mbway" | "multibanco" | null>(null);
  const [erro, setErro] = useState("");
  const [pagamento, setPagamento] = useState<Pagamento | null>(null);
  const [copiada, setCopiada] = useState(false);

  async function gerar(metodo: "mbway" | "multibanco") {
    setAGerar(metodo);
    setErro("");
    try {
      const r = await fetch("/api/admin/pagamentos/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          negociacaoId,
          metodo,
          comFactura,
          telemovel: metodo === "mbway" ? telemovel : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        // A versão PARA NÓS: quem lê isto é quem pode resolver.
        setErro([d.error, d.detalhe].filter(Boolean).join(" — "));
        return;
      }
      setPagamento(d.pagamento);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGerar(null);
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-600 hover:text-cyan-300"
      >
        <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
        Gerar referência de pagamento
      </button>
    );
  }

  const valor = comFactura ? comFacturaValor : semFactura;
  const link = pagamento ? linkDoWhatsApp(telefoneDoCliente, pagamento.mensagem) : null;

  return (
    <div className="mt-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.05] p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300">
          <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
          Cobrar o cliente
        </p>
        <button
          onClick={() => setAberto(false)}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          fechar
        </button>
      </div>

      {!pagamento ? (
        <>
          {/*
            A FACTURA DECIDE O NÚMERO, e por isso escolhe-se ANTES de gerar.
            Sem factura são 105,00; com factura acresce o IVA da taxa e são
            106,15. Perguntá-la depois obrigava a anular a referência e a fazer
            outra — e a que já foi mandada ao cliente continua válida.
          */}
          <label className="mt-2 flex items-start gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={comFactura}
              onChange={(e) => setComFactura(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Com factura
              <span className="block text-slate-500">
                {euros(comFacturaValor)} com · {euros(semFactura)} sem
              </span>
            </span>
          </label>

          <div className="mt-2">
            <label className="text-[11px] text-slate-400" htmlFor={`tel-${negociacaoId}`}>
              Telemóvel com MB WAY (só para MB WAY)
            </label>
            <input
              id={`tel-${negociacaoId}`}
              value={telemovel}
              onChange={(e) => setTelemovel(e.target.value)}
              placeholder="912 345 678"
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void gerar("multibanco")}
              disabled={aGerar !== null}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {aGerar === "multibanco" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Landmark className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Referência Multibanco · {euros(valor)}
            </button>
            <button
              onClick={() => void gerar("mbway")}
              disabled={aGerar !== null || telemovel.trim().length < 9}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-600 disabled:opacity-40"
            >
              {aGerar === "mbway" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Pedido MB WAY · {euros(valor)}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            A referência é gerada no euPago e fica à espera. Quem diz que foi paga é o webhook
            deles — nunca este ecrã.
          </p>
        </>
      ) : (
        <>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {pagamento.metodo === "multibanco" ? (
              <>
                <Copiavel rotulo="Entidade" valor={pagamento.entidade ?? "—"} />
                <Copiavel rotulo="Referência" valor={pagamento.referencia ?? "—"} />
                <Copiavel rotulo="Valor" valor={euros(pagamento.valor)} />
              </>
            ) : (
              <>
                <Copiavel rotulo="Telemóvel" valor={pagamento.telemovel ?? "—"} />
                <Copiavel rotulo="Valor" valor={euros(pagamento.valor)} />
              </>
            )}
          </div>

          {pagamento.expiraEm && (
            <p className="mt-2 text-[11px] text-slate-500">
              Válida até {new Date(pagamento.expiraEm).toLocaleString("pt-PT")}
            </p>
          )}

          {/*
            A MENSAGEM VEM ESCRITA DO SERVIDOR, com o valor lá dentro. Montá-la
            aqui era uma segunda versão do que se está a cobrar.
          */}
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-950/60 p-3 font-sans text-xs leading-relaxed text-slate-300">
            {pagamento.mensagem}
          </pre>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(pagamento.mensagem);
                  setCopiada(true);
                  setTimeout(() => setCopiada(false), 2500);
                } catch {
                  /* O texto está à vista por cima, para se copiar à mão. */
                }
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-600"
            >
              {copiada ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copiada ? "Copiada" : "Copiar mensagem"}
            </button>
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Abrir no WhatsApp
              </a>
            )}
            <button
              onClick={() => setPagamento(null)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              gerar outra
            </button>
          </div>
        </>
      )}

      {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}
    </div>
  );
}
