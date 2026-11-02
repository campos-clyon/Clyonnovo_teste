"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Loader2, Smartphone, Landmark } from "lucide-react";
import { promessaDaForma } from "@/lib/pagamento-na-plataforma";
import { comoORecebemos, pagamentoDoClienteParaMostrar } from "@/lib/pagamento-visto-pelo-cliente";
import { diferencaEmPalavras } from "@/lib/horas-do-trabalho";
import { lerForma } from "@/lib/forma-de-pagamento";
import {
  COMO_PAGA,
  IVA_DO_PAGAMENTO,
  MB_WAY,
  O_VALOR_FICA_COM_A_CLYON,
  PRECO,
  REFERENCIA_MULTIBANCO,
  SEM_IVA,
  SERVICO,
  TOTAL_A_PAGAR,
  emEurosNoPagamento,
  pagarOValor,
} from "@/lib/frases-do-pagamento";

/**
 * ONDE O CLIENTE PAGA — MB WAY e Multibanco.
 *
 * Fase 2 do `docs/plano-pagamentos-eupago.md`. Todo o dinheiro é decidido no
 * servidor: este ecrã nunca calcula um valor, recebe-o. Uma segunda conta do
 * lado do navegador era uma segunda verdade, e o dia em que discordasse da
 * primeira era o dia em que o cliente via um número e o banco lhe pedia outro.
 *
 * NÃO APARECE QUANDO NÃO SERVE. Se a cobrança não estiver aberta, o servidor
 * responde `disponivel: false` e isto não desenha nada — em vez de mostrar uma
 * caixa bonita que devolve um erro a quem carregar nela.
 *
 * E É O SERVIDOR QUE DIZ QUE ESTÁ PAGO, nunca este ecrã. Uma referência criada
 * não é um pagamento; quem confirma é o webhook do euPago. Daí a sondagem: o
 * MB WAY resolve-se em segundos, mas só do lado de lá se sabe quando.
 */

type Pagamento = {
  id: number;
  /** Também os registados à mão (transferência, numerário…) — 27-10-2026. */
  metodo: string;
  estado: string;
  valor: number;
  comFactura: boolean;
  referencia: string | null;
  entidade: string | null;
  expiraEm: string | null;
  pagoEm: string | null;
  criadoEm: string;
};

type Estado = {
  disponivel: boolean;
  pagamentos: Pagamento[];
  pago: boolean;
  valores: { semFactura: number; comFactura: number };
  /**
   * Com IVA incluído (01-10-2026) os dois valores são o mesmo — há factura em
   * todas as vendas — e a pergunta «quer factura?» desaparece.
   */
  ivaIncluido?: boolean;
  /**
   * O pagamento registado é do cliente? Em dinheiro com IVA incluído é a
   * dívida do profissional, e não se mostra ao cliente (27-10-2026, d16).
   */
  doCliente?: boolean;
  /**
   * A DIFERENÇA DAS HORAS — 31-10-2026. Num trabalho por hora, confirmadas as
   * horas: o que falta pagar (pela mesma rota, `parte: "diferenca"`) ou o que
   * a CLYON lhe devolve.
   */
  diferenca?: { aPagar: number; aDevolver: number; pago: boolean; pagamentos: Pagamento[] } | null;
  /** O serviço sem IVA, o IVA e o total — do servidor (02-11-2026). Nulo antes do IVA incluído. */
  desdobramento?: { semIva: number; iva: number; total: number } | null;
};

const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

/** De quanto em quanto tempo se pergunta ao servidor se já foi pago. */
const SONDAGEM_MS = 4000;

export default function PagarTrabalho({
  pedidoId,
  negociacaoId,
  token,
  telefoneSugerido,
  precisaFatura = false,
  soParaVer = false,
  formaDePagamento = null,
  soSePago = false,
  notaDoValor,
  titulo = null,
  aoDecidir,
}: {
  /** «Recolha de móveis · Fred Teste» — a primeira linha do bloco de pagar (02-11-2026). */
  titulo?: string | null;
  /**
   * Diz a quem chama se o bloco de pagar está à vista (02-11-2026). Com ele à
   * vista, a página tira o cartão do preço de cima — o preço está no bloco.
   */
  aoDecidir?: (mostraOBloco: boolean) => void;
  pedidoId: number;
  negociacaoId: number;
  /**
   * COMO O CLIENTE PAGA ESTE TRABALHO — 29-09-2026. Nulo = na plataforma.
   *
   * Decide a frase de depois de pago. Em dinheiro, a referência que o
   * backoffice lhe manda é só a comissão da CLYON, e «o valor fica connosco
   * até confirmar» dizia-lhe que guardávamos um serviço que ele vai pagar em
   * notas ao profissional.
   */
  formaDePagamento?: string | null;
  /** O token do link do email. Sem ele, vale a sessão. */
  token?: string | null;
  telefoneSugerido?: string | null;
  /**
   * O cliente JÁ DISSE se queria factura — no pedido, e há semanas.
   *
   * Perguntar outra vez aqui, com a caixa vazia, era ignorar o que ele
   * respondeu e arriscar cobrar-lhe o valor errado por distracção. A caixa
   * continua lá para ele mudar de ideias; o que muda é de que lado começa.
   */
  precisaFatura?: boolean;
  soParaVer?: boolean;
  /**
   * DEPOIS DO TRABALHO FEITO — 27-10-2026 (d16). Só se mostra o «Pagamento
   * recebido»; nada de caixas para pagar.
   */
  soSePago?: boolean;
  /** Uma linha por baixo do «Pagar X» — num trabalho por hora, que é a estimativa (31-10-2026). */
  notaDoValor?: string | null;
}) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [falhouALer, setFalhouALer] = useState(false);
  // Como na Vinted: um método já escolhido, e o botão «Pagar» logo à vista.
  const [metodo, setMetodo] = useState<"mbway" | "multibanco" | null>("mbway");
  const [comFactura, setComFactura] = useState(precisaFatura);
  const [telemovel, setTelemovel] = useState(telefoneSugerido ?? "");
  const [aPedir, setAPedir] = useState(false);
  const [erro, setErro] = useState("");
  const [sugereOutro, setSugereOutro] = useState(false);
  const [copiado, setCopiado] = useState("");
  const [agora, setAgora] = useState(() => Date.now());

  const params = useRef(
    `pedidoId=${pedidoId}&negociacaoId=${negociacaoId}${token ? `&token=${encodeURIComponent(token)}` : ""}`,
  );

  const ler = useCallback(async () => {
    try {
      const r = await fetch(`/api/pagamentos?${params.current}`, { cache: "no-store" });
      if (!r.ok) {
        setFalhouALer(true);
        return;
      }
      setEstado((await r.json()) as Estado);
    } catch {
      // Uma sondagem que falha não diz nada a ninguém: tenta outra vez a
      // seguir. O erro que interessa mostrar é o de quem carregou num botão.
      setFalhouALer(true);
    }
  }, []);

  useEffect(() => {
    void ler();
  }, [ler]);

  const aberto = estado?.pagamentos.find((p) => p.estado === "pendente") ?? null;

  /* O bloco de pagar está à vista? A página tira o cartão do preço de cima quando está. */
  const mostraOBloco = Boolean(estado && !estado.pago && !soSePago && (aberto || estado.disponivel));
  useEffect(() => {
    if (!aoDecidir) return;
    if (estado) aoDecidir(mostraOBloco);
    else if (falhouALer) aoDecidir(false);
  }, [aoDecidir, estado, falhouALer, mostraOBloco]);

  /*
   * A SONDAGEM SÓ CORRE ENQUANTO HÁ ALGO POR PAGAR, e pára quando o
   * separador não está à frente. Um cliente que deixe a página aberta uma
   * tarde não tem de nos bater à porta de quatro em quatro segundos.
   */
  // A diferença das horas (31-10-2026) também se sonda enquanto está por pagar.
  const diferencaAberta = Boolean(
    estado?.diferenca && !estado.diferenca.pago && estado.diferenca.pagamentos.some((p) => p.estado === "pendente"),
  );
  useEffect(() => {
    if ((!aberto || estado?.pago) && !diferencaAberta) return;
    const t = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setAgora(Date.now());
      void ler();
    }, SONDAGEM_MS);
    return () => clearInterval(t);
  }, [aberto, estado?.pago, diferencaAberta, ler]);

  async function pedir(qual: "mbway" | "multibanco", parte: "trabalho" | "diferenca" = "trabalho") {
    setAPedir(true);
    setErro("");
    setSugereOutro(false);
    try {
      const r = await fetch("/api/pagamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId,
          negociacaoId,
          token,
          metodo: qual,
          comFactura,
          telemovel: qual === "mbway" ? telemovel : undefined,
          ...(parte === "diferenca" ? { parte: "diferenca" } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível iniciar o pagamento.");
        setSugereOutro(Boolean(d.sugereOutroMetodo));
        return;
      }
      setAgora(Date.now());
      await ler();
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique a ligação.");
    } finally {
      setAPedir(false);
    }
  }

  async function copiar(texto: string, qual: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      setTimeout(() => setCopiado(""), 2000);
    } catch {
      // Sem área de transferência (um navegador antigo, uma permissão negada)
      // o número continua lá para ser lido. Não vale um aviso de erro.
    }
  }

  if (!estado) return null;

  // ── Já está pago ────────────────────────────────────────────────────────
  if (estado.pago) {
    const pago = pagamentoDoClienteParaMostrar(estado.pagamentos, estado.doCliente !== false);
    if (!pago) return null;
    const como = comoORecebemos(pago.metodo);
    return (
      <div className="mt-4 rounded-xl border border-emerald-300 bg-white p-4 text-left">
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Pagamento recebido
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Recebemos {euros(pago.valor)}
          {como ? ` ${como}` : ""}.{" "}
          {promessaDaForma(formaDePagamento, estado.ivaIncluido ? "iva_incluido" : "sem_iva").clienteDepoisDePagar}
        </p>
        {estado.diferenca && (
          <Diferenca
            d={estado.diferenca}
            ivaIncluido={estado.ivaIncluido !== false}
            soParaVer={soParaVer}
            aPedir={aPedir}
            erro={erro}
            telemovel={telemovel}
            setTelemovel={setTelemovel}
            onPedir={(qual) => void pedir(qual, "diferenca")}
          />
        )}
      </div>
    );
  }

  if (soSePago) return null;
  /*
   * UMA REFERÊNCIA PENDENTE MOSTRA-SE SEMPRE — 30-10-2026. A que o backoffice
   * gerou é do cliente, e a app já a mostrava; o site escondia-a quando a
   * caixa de pagar não estava aberta. Sem pendente, a caixa só aparece aberta.
   */
  if (!aberto && !estado.disponivel) return null;

  const valor =
    comFactura || estado.ivaIncluido ? estado.valores.comFactura : estado.valores.semFactura;

  // ── Há uma referência ou um MB WAY à espera ─────────────────────────────
  if (aberto) {
    const expira = aberto.expiraEm ? new Date(aberto.expiraEm).getTime() : null;
    const segundos = expira ? Math.max(0, Math.round((expira - agora) / 1000)) : null;
    const expirou = segundos === 0;

    return (
      <div className="mt-4 rounded-xl border border-slate-300 bg-white p-4 text-left">
        {titulo && <p className="mb-3 text-sm font-semibold text-slate-900">{titulo}</p>}
        {aberto.metodo === "mbway" ? (
          <>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Smartphone className="h-4 w-4 text-acao" aria-hidden="true" />
              {expirou ? "O pedido expirou" : "Confirme no seu telemóvel"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {expirou
                ? "O MB WAY dá cinco minutos para confirmar. Pode pedir outro."
                : `Enviámos um pedido de ${euros(aberto.valor)} para a aplicação MB WAY. Abra-a e confirme.`}
            </p>
            {/*
              A CONTAGEM EXISTE PORQUE O PRAZO NÃO É NOSSO.
              «The customer have 5 minutes to execute the payment» — é do MB
              WAY. Sem a contagem, quem foi buscar o telemóvel a outra divisão
              volta e encontra um ecrã parado que não explica nada.
            */}
            {!expirou && segundos != null && (
              <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, "0")} para confirmar
              </p>
            )}
            <button
              type="button"
              onClick={() => void pedir("mbway")}
              disabled={aPedir || soParaVer || !estado.disponivel}
              className="mt-3 rounded-[14px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              {aPedir ? "A pedir…" : "Pedir outra vez"}
            </button>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Landmark className="h-4 w-4 text-acao" aria-hidden="true" />
              Referência Multibanco
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { t: "Entidade", v: aberto.entidade ?? "—" },
                { t: "Referência", v: aberto.referencia ?? "—" },
                { t: "Valor", v: euros(aberto.valor) },
              ].map((c) => (
                <div key={c.t} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <dt className="text-[11px] uppercase tracking-wide text-tinta-fraca">{c.t}</dt>
                  <dd className="text-sm font-bold tabular-nums text-slate-900">{c.v}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={() => void copiar(aberto.referencia ?? "", "ref")}
              className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-acao"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copiado === "ref" ? "Copiado" : "Copiar a referência"}
            </button>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Pague no homebanking ou numa caixa Multibanco.
              {aberto.expiraEm
                ? ` A referência é válida até ${new Date(aberto.expiraEm).toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" })}.`
                : ""}{" "}
              Assim que o pagamento entrar, esta página actualiza-se sozinha.
            </p>
          </>
        )}
        {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
        <Rodape />
      </div>
    );
  }

  // ── Escolher como pagar ─────────────────────────────────────────────────
  /*
   * SIMPLES, COMO A VINTED — 02-11-2026 (ordem do CEO e do dono). O bloco diz
   * só: o serviço e o parceiro; o «Preço» (serviço sem IVA, IVA, total); o
   * «Como paga»; o botão; e onde fica o dinheiro. O resto (itens a mais, o
   * valor dado online, trocar de parceiro, contactos, o que pediu) fica
   * abaixo, fora do bloco. As frases são as da app (`frases-do-pagamento.ts`);
   * os números são os do servidor.
   */
  const desdobramento = estado.ivaIncluido ? estado.desdobramento ?? null : null;
  const pagaPelaPlataforma = lerForma(formaDePagamento) !== "dinheiro";
  return (
    <div className="mt-4 rounded-xl border border-slate-300 bg-white p-4 text-left">
      {titulo && <p className="text-sm font-semibold text-slate-900">{titulo}</p>}

      <h3 className={`${titulo ? "mt-4" : ""} text-xs font-bold uppercase tracking-wide text-tinta-fraca`}>{PRECO}</h3>
      <dl className="mt-2 space-y-1 text-sm tabular-nums">
        {desdobramento && (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-slate-700">
                {SERVICO} <span className="text-xs text-tinta-fraca">{SEM_IVA}</span>
              </dt>
              <dd className="text-slate-900">{emEurosNoPagamento(desdobramento.semIva)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-slate-700">{IVA_DO_PAGAMENTO}</dt>
              <dd className="text-slate-900">{emEurosNoPagamento(desdobramento.iva)}</dd>
            </div>
          </>
        )}
        <div className={`flex items-baseline justify-between gap-4 ${desdobramento ? "mt-2 border-t border-slate-200 pt-2" : ""}`}>
          <dt className="font-bold text-slate-900">{TOTAL_A_PAGAR}</dt>
          <dd className="text-base font-bold text-slate-900">{emEurosNoPagamento(valor)}</dd>
        </div>
      </dl>
      {notaDoValor && <p className="mt-1 text-xs text-slate-600">{notaDoValor}</p>}

      {/*
        A FACTURA É UMA ESCOLHA, E TEM DE SER FEITA ANTES DE SE PEDIR O VALOR.
        Só nas negociações de antes do IVA incluído (01-10-2026): é ela que
        decide o número. Com IVA incluído há fatura sempre, e não se pergunta.
      */}
      {!estado.ivaIncluido && (
      <label className="mt-2 flex items-start gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={comFactura}
          onChange={(e) => setComFactura(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Quero fatura
          <span className="block text-tinta-fraca">
            Com fatura são {euros(estado.valores.comFactura)}; sem fatura,{" "}
            {euros(estado.valores.semFactura)}.
          </span>
        </span>
      </label>
      )}

      <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-tinta-fraca">{COMO_PAGA}</h3>
      <div className="mt-2 grid gap-2" role="radiogroup" aria-label={COMO_PAGA}>
        {(
          [
            { qual: "mbway", nome: MB_WAY, Icone: Smartphone },
            { qual: "multibanco", nome: REFERENCIA_MULTIBANCO, Icone: Landmark },
          ] as const
        ).map(({ qual, nome, Icone }) => (
          <button
            key={qual}
            type="button"
            role="radio"
            aria-checked={metodo === qual}
            onClick={() => setMetodo(qual)}
            className={`flex min-h-[48px] items-center gap-3 rounded-[14px] border px-3 text-left text-sm font-semibold ${
              metodo === qual ? "border-acao bg-acao/5 text-acao" : "border-slate-300 text-slate-700"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                metodo === qual ? "border-acao" : "border-slate-400"
              }`}
              aria-hidden="true"
            >
              {metodo === qual && <span className="h-2 w-2 rounded-full bg-acao" />}
            </span>
            <Icone className="h-4 w-4" aria-hidden="true" />
            {nome}
          </button>
        ))}
      </div>

      {metodo === "mbway" && (
        <div className="mt-3">
          <label htmlFor="mbway-tel" className="text-xs font-semibold text-slate-700">
            Telemóvel com MB WAY
          </label>
          <input
            id="mbway-tel"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={telemovel}
            onChange={(e) => setTelemovel(e.target.value)}
            placeholder="912 345 678"
            className="mt-1 w-full rounded-[14px] border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => metodo && void pedir(metodo)}
        disabled={!metodo || aPedir || soParaVer || (metodo === "mbway" && telemovel.trim().length < 9)}
        className="mt-4 min-h-[48px] w-full rounded-[14px] bg-acao px-4 py-3 text-base font-bold text-white disabled:opacity-40"
      >
        {aPedir ? "A pedir…" : pagarOValor(valor)}
      </button>

      {erro && (
        <p className="mt-2 text-xs text-red-600">
          {erro}
          {sugereOutro && metodo === "mbway" && " Pode usar a referência Multibanco."}
        </p>
      )}
      {pagaPelaPlataforma && (
        <p className="mt-3 text-xs leading-relaxed text-slate-600">{O_VALOR_FICA_COM_A_CLYON}</p>
      )}
      <Rodape />
    </div>
  );
}

/**
 * O euPago tem de ser nomeado, e não é uma cortesia.
 *
 * O contrato obriga: *«informar os seus Consumidores de que os pagamentos são
 * processados pela Eupago»*. Fica no ecrã onde se paga, que é onde a
 * informação serve para alguma coisa.
 */
/**
 * A DIFERENÇA DAS HORAS, depois do pagamento do trabalho — 31-10-2026. Os
 * mesmos dois caminhos (MB WAY, Multibanco), com `parte: "diferenca"`; o valor
 * é o do servidor. Menos do que pagou: a CLYON devolve-lhe a diferença.
 */
function Diferenca({
  d,
  ivaIncluido,
  soParaVer,
  aPedir,
  erro,
  telemovel,
  setTelemovel,
  onPedir,
}: {
  d: NonNullable<Estado["diferenca"]>;
  ivaIncluido: boolean;
  soParaVer: boolean;
  aPedir: boolean;
  erro: string;
  telemovel: string;
  setTelemovel: (v: string) => void;
  onPedir: (qual: "mbway" | "multibanco") => void;
}) {
  const [metodo, setMetodo] = useState<"mbway" | "multibanco" | null>(null);
  if (d.aDevolver > 0) {
    return (
      <p className="mt-3 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-700">
        As horas confirmadas ficaram abaixo do que pagou: a CLYON devolve-lhe {euros(d.aDevolver)}.
      </p>
    );
  }
  if (d.pago) {
    return (
      <p className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2 text-xs font-semibold text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Diferença das horas paga.
      </p>
    );
  }
  if (d.aPagar <= 0) return null;
  const aberto = d.pagamentos.find((p) => p.estado === "pendente") ?? null;
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <p className="text-sm font-bold text-slate-900">{diferencaEmPalavras(d.aPagar, ivaIncluido)}</p>
      {aberto && aberto.metodo === "multibanco" && (
        <p className="mt-1 text-xs tabular-nums text-slate-700">
          Entidade {aberto.entidade ?? "—"} · Referência {aberto.referencia ?? "—"} · {euros(aberto.valor)}
        </p>
      )}
      {aberto && aberto.metodo === "mbway" && (
        <p className="mt-1 text-xs text-slate-700">
          Enviámos um pedido de {euros(aberto.valor)} para a aplicação MB WAY. Abra-a e confirme.
        </p>
      )}
      {!soParaVer && (
        <>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMetodo("mbway")}
              className={`rounded-[14px] border p-2.5 text-left text-sm font-semibold ${
                metodo === "mbway" ? "border-acao bg-acao/5 text-acao" : "border-slate-300 text-slate-700"
              }`}
            >
              MB WAY
            </button>
            <button
              type="button"
              onClick={() => setMetodo("multibanco")}
              className={`rounded-[14px] border p-2.5 text-left text-sm font-semibold ${
                metodo === "multibanco" ? "border-acao bg-acao/5 text-acao" : "border-slate-300 text-slate-700"
              }`}
            >
              Multibanco
            </button>
          </div>
          {metodo === "mbway" && (
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={telemovel}
              onChange={(e) => setTelemovel(e.target.value)}
              placeholder="912 345 678"
              aria-label="Telemóvel com MB WAY"
              className="mt-2 w-full rounded-[14px] border border-slate-300 px-3 py-2 text-sm"
            />
          )}
          {metodo && (
            <button
              type="button"
              onClick={() => onPedir(metodo)}
              disabled={aPedir || (metodo === "mbway" && telemovel.trim().length < 9)}
              className="mt-2 w-full rounded-[14px] bg-acao px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {aPedir
                ? "A pedir…"
                : metodo === "mbway"
                  ? `Pagar ${euros(d.aPagar)} por MB WAY`
                  : `Gerar referência de ${euros(d.aPagar)}`}
            </button>
          )}
          {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
        </>
      )}
    </div>
  );
}

function Rodape() {
  return (
    <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-tinta-fraca">
      Pagamentos processados pelo euPago. A CLYON não guarda dados do seu cartão nem do seu banco.
    </p>
  );
}
