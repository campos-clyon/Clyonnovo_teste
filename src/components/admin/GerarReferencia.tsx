"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { Check, Copy, CreditCard, Landmark, Loader2, RefreshCw, Smartphone } from "lucide-react";
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
  valorPago: number | null;
  entidade: string | null;
  referencia: string | null;
  telemovel: string | null;
  expiraEm: string | null;
  pagoEm: string | null;
  criadoEm: string;
  mensagem: string;
};

const QUANDO = (iso: string) => new Date(iso).toLocaleString("pt-PT");

/**
 * O QUE JÁ ACONTECEU A ESTE PEDIDO, em uma linha.
 *
 * Existe porque gerar uma referência não pode ser um gesto sem memória. No dia
 * seguinte, quem abre o pedido tem de ver que já foi pedido dinheiro àquele
 * cliente — senão gera outra, e é assim que alguém paga duas vezes.
 */
function Estado({ p }: { p: Pagamento }) {
  if (p.estado === "pago") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        Pago {euros(p.valorPago ?? p.valor)}
        {p.pagoEm ? ` · ${QUANDO(p.pagoEm)}` : ""} · {p.metodo === "mbway" ? "MB WAY" : "Multibanco"}
      </p>
    );
  }
  if (p.estado === "pendente") {
    const expirou = p.expiraEm != null && new Date(p.expiraEm).getTime() < Date.now();
    return (
      <p className={`text-xs ${expirou ? "text-slate-500" : "text-amber-300"}`}>
        {expirou ? "Expirou" : "À espera do pagamento"} ·{" "}
        {p.metodo === "mbway" ? "MB WAY" : "Multibanco"} · {euros(p.valor)}
        {p.expiraEm ? ` · ${expirou ? "expirou" : "até"} ${QUANDO(p.expiraEm)}` : ""}
      </p>
    );
  }
  return (
    <p className="text-xs text-slate-500">
      {p.estado} · {p.metodo === "mbway" ? "MB WAY" : "Multibanco"} · {euros(p.valor)} ·{" "}
      {QUANDO(p.criadoEm)}
    </p>
  );
}

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
  /*
   * Voltar ao formulario, com uma referencia viva na mao.
   *
   * "Gerar outra" nao pode limpar so o que se acabou de gerar: por baixo esta
   * a que veio da base, e o ecra voltava a mostra-la como se nada fosse.
   *
   * Nao ha risco nenhum em deixar pedir: se for uma referencia Multibanco
   * viva, o SERVIDOR recusa e devolve a mesma -- duas referencias vivas para
   * o mesmo trabalho e como alguem paga duas vezes, e essa regra nao pode
   * morar num ecra.
   */
  const [aPedirOutra, setAPedirOutra] = useState(false);
  /** O histórico deste pedido. `null` enquanto não se leu. */
  const [historico, setHistorico] = useState<Pagamento[] | null>(null);
  /**
   * Sandbox ou produção — e não é detalhe técnico, é o aviso.
   *
   * `null` enquanto não se leu: na dúvida não se promete que é a sério nem se
   * promete que não é. O aviso só aparece quando se sabe.
   */
  const [ambiente, setAmbiente] = useState<string | null>(null);

  /*
   * «JÁ FOI PAGA?» — 22-09-2026.
   *
   * "A euPago não mostra se realmente foi feito", com o comprovativo da Caixa
   * na mão: 42,00 €, referência paga às 09:49, e este ecrã a continuar a dizer
   * «cobrar o cliente».
   *
   * Um pagamento chega por um aviso do euPago, e das três coisas que acontecem
   * sempre a um webhook a pior é NÃO CHEGAR — porque é silenciosa. Não há
   * nenhum aviso a avisar que um aviso não chegou. A sondagem automática corre
   * de hora a hora; esperar cinquenta minutos com um comprovativo à frente e um
   * cliente do outro lado não é resposta.
   */
  const [aConferir, setAConferir] = useState(false);
  const [conferencia, setConferencia] = useState<{ texto: string; bruto?: unknown } | null>(null);

  /*
   * LÊ-SE SEMPRE, ABERTO OU FECHADO.
   *
   * O resumo de uma linha — «Pago 105,00 € a 18/09» — tem de estar à vista
   * sem ninguém abrir nada: é a resposta à pergunta que se faz ao olhar para
   * um trabalho fechado, e obrigar a um clique para a ver é escondê-la.
   */
  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/admin/pagamentos/criar?negociacaoId=${negociacaoId}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (r.ok) {
        setHistorico(d.pagamentos ?? []);
        setAmbiente(typeof d.ambiente === "string" ? d.ambiente : null);
      }
    } catch {
      /* Sem rede fica o que estava. O botão de gerar diz o que falhar. */
    }
  }, [token, negociacaoId]);

  useEffect(() => {
    void ler();
  }, [ler]);

  // O ciclo partilhado do backoffice: um MB WAY resolve-se em segundos e o
  // aviso chega sozinho, mas só o servidor sabe quando chegou.
  useAutoRefresh(() => ler(), { enabled: Boolean(token) });

  const jaPago = historico?.find((p) => p.estado === "pago") ?? null;
  const porPagar =
    historico?.find(
      (p) => p.estado === "pendente" && (!p.expiraEm || new Date(p.expiraEm).getTime() > Date.now()),
    ) ?? null;

  /**
   * Pergunta ao euPago pela referência, agora.
   *
   * ⚠️ SÓ APANHA PAGAMENTOS; NUNCA FECHA NENHUM — a regra é do servidor e está
   * lá explicada. Um «ainda não» de hoje pode ser um «sim» amanhã.
   */
  async function conferir(pagamentoId: number) {
    if (!token) return;
    setAConferir(true);
    setErro("");
    setConferencia(null);
    try {
      const r = await fetch("/api/admin/pagamentos/conferir", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pagamentoId }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível perguntar ao euPago.");
        return;
      }
      if (d.aplicado) {
        setConferencia({ texto: "O euPago confirmou. Está dado por pago." });
      } else if (d.jaEstava) {
        setConferencia({ texto: "Já cá estava dado por pago." });
      } else if (d.pago) {
        setConferencia({
          texto: d.porque ?? "O euPago diz que está paga, mas não se creditou nada.",
          bruto: d.bruto,
        });
      } else {
        /*
         * O «ainda não» vem com a resposta em bruto de propósito. A página do
         * `multibanco/info` tem mais de dois anos e não diz o nome do campo do
         * estado: se ele disser «não» sobre uma referência que temos por paga,
         * é aqui que se vê porquê, sem ir ao registo do servidor.
         */
        setConferencia({
          texto:
            "O euPago diz que ainda não foi paga. Pode levar alguns minutos a chegar lá — " +
            "se o cliente tem comprovativo, guarde-o e volte a perguntar.",
          bruto: d.bruto,
        });
      }
      await ler();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAConferir(false);
    }
  }

  async function gerar(metodo: "mbway" | "multibanco") {
    setAGerar(metodo);
    setErro("");
    setAPedirOutra(false);
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
      void ler();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGerar(null);
    }
  }

  if (!aberto) {
    return (
      <div className="mt-3">
        {/*
          O ESTADO PRIMEIRO, E SEM SE ABRIR NADA.

          «Pago 105,00 € a 18/09» é a resposta à pergunta que se faz ao olhar
          para um trabalho fechado. Escondê-la atrás de um clique era pedir a
          alguém que procurasse o que devia estar à frente.
        */}
        {jaPago ? (
          <Estado p={jaPago} />
        ) : porPagar ? (
          <Estado p={porPagar} />
        ) : null}
        <button
          onClick={() => setAberto(true)}
          className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-600 hover:text-cyan-300"
        >
          <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
          {jaPago
            ? "Ver o pagamento"
            : porPagar
              ? "Ver ou reenviar a referência"
              : "Gerar referência de pagamento"}
        </button>
      </div>
    );
  }

  const valor = comFactura ? comFacturaValor : semFactura;
  /*
   * O QUE SE MOSTRA: o que se acabou de gerar, ou o que já estava à espera.
   *
   * A segunda parte é a que faz a diferença dois dias depois — a referência
   * que o cliente tem na mão continua a ser aquela, e reenviá-la é melhor do
   * que gerar outra. Duas referências vivas para o mesmo trabalho é como
   * alguém paga duas vezes.
   */
  const mostrar = aPedirOutra ? null : (pagamento ?? porPagar);
  const link = mostrar ? linkDoWhatsApp(telefoneDoCliente, mostrar.mensagem) : null;

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

      {jaPago ? (
        <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] p-3">
          <Estado p={jaPago} />
          {/*
            SEM BOTAO DE GERAR. Um trabalho pago nao precisa de outra
            referencia, e o indice unico da base recusa-a de qualquer forma --
            mas oferece-la era convidar alguem a mandar ao cliente uma
            referencia que ele ia pagar pela segunda vez.
          */}
          <p className="mt-1 text-[11px] text-slate-400">
            O dinheiro entrou na conta do euPago. Nada mais a cobrar neste trabalho.
          </p>
        </div>
      ) : !mostrar ? (
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
          {/*
            ⚠️ O AVISO DE QUE ISTO É DINHEIRO A SÉRIO — 21-09-2026.

            "mude tudo para usarmos PRODUÇÃO, vamos trabalhar com valores reais".

            Até esse dia o botão era inofensivo: a sandbox não move um cêntimo,
            e carregar por engano não fazia mal a ninguém. Com o ambiente em
            produção, o MESMO botão, no MESMO sítio, com o MESMO aspecto, passa
            a pedir dinheiro a uma pessoa verdadeira.

            O aviso é a única coisa que muda de aspecto quando a consequência
            muda. Sem ele, quem anda a experimentar no backoffice continua a
            carregar como andava — e a primeira vez que se dá por isso é com um
            cliente ao telefone a perguntar porque é que lhe pediram 127 €.
          */}
          {ambiente === "producao" ? (
            <p className="mt-2 rounded-lg border border-amber-600/40 bg-amber-950/30 px-2.5 py-2 text-[11px] font-semibold leading-relaxed text-amber-300">
              Isto é dinheiro a sério. A referência vai para o telemóvel ou para o
              multibanco deste cliente e ele pode pagá-la já. Quem diz que foi paga é o
              webhook do euPago — nunca este ecrã.
            </p>
          ) : (
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              {ambiente === "sandbox" ? "Sandbox: não move dinheiro nenhum. " : ""}
              A referência é gerada no euPago e fica à espera. Quem diz que foi paga é o webhook
              deles — nunca este ecrã.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {mostrar.metodo === "multibanco" ? (
              <>
                <Copiavel rotulo="Entidade" valor={mostrar.entidade ?? "—"} />
                <Copiavel rotulo="Referência" valor={mostrar.referencia ?? "—"} />
                <Copiavel rotulo="Valor" valor={euros(mostrar.valor)} />
              </>
            ) : (
              <>
                <Copiavel rotulo="Telemóvel" valor={mostrar.telemovel ?? "—"} />
                <Copiavel rotulo="Valor" valor={euros(mostrar.valor)} />
              </>
            )}
          </div>

          {mostrar.expiraEm && (
            <p className="mt-2 text-[11px] text-slate-500">
              Válida até {new Date(mostrar.expiraEm).toLocaleString("pt-PT")}
            </p>
          )}

          {/*
            A MENSAGEM VEM ESCRITA DO SERVIDOR, com o valor lá dentro. Montá-la
            aqui era uma segunda versão do que se está a cobrar.
          */}
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-950/60 p-3 font-sans text-xs leading-relaxed text-slate-300">
            {mostrar.mensagem}
          </pre>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(mostrar.mensagem);
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
            {/*
              A PERGUNTA QUE O ECRÃ NÃO CONSEGUE RESPONDER SOZINHO.

              Só no Multibanco: o `multibanco/info` pergunta por referência, e
              uma operação MB WAY não tem referência que se consulte assim.
            */}
            {mostrar.metodo === "multibanco" && mostrar.referencia && (
              <button
                onClick={() => void conferir(mostrar.id)}
                disabled={aConferir}
                title="Pergunta ao euPago se esta referência já foi paga. Não cobra nada."
                className="flex items-center gap-1.5 rounded-lg border border-cyan-700/60 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
              >
                {aConferir ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {aConferir ? "A perguntar…" : "Já foi paga?"}
              </button>
            )}
            <button
              onClick={() => {
                setPagamento(null);
                setAPedirOutra(true);
              }}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              gerar outra
            </button>
          </div>

          {conferencia && (
            <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
              <p className="text-xs leading-relaxed text-slate-300">{conferencia.texto}</p>
              {conferencia.bruto != null && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
                    o que o euPago respondeu
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-2 font-mono text-[10px] leading-relaxed text-slate-400">
                    {JSON.stringify(conferencia.bruto, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </>
      )}

      {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}
    </div>
  );
}
