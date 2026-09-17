"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Loader2, Smartphone, Landmark } from "lucide-react";

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
  metodo: "mbway" | "multibanco";
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
}: {
  pedidoId: number;
  negociacaoId: number;
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
}) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [metodo, setMetodo] = useState<"mbway" | "multibanco" | null>(null);
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
      if (!r.ok) return;
      setEstado((await r.json()) as Estado);
    } catch {
      // Uma sondagem que falha não diz nada a ninguém: tenta outra vez a
      // seguir. O erro que interessa mostrar é o de quem carregou num botão.
    }
  }, []);

  useEffect(() => {
    void ler();
  }, [ler]);

  const aberto = estado?.pagamentos.find((p) => p.estado === "pendente") ?? null;

  /*
   * A SONDAGEM SÓ CORRE ENQUANTO HÁ ALGO POR PAGAR, e pára quando o
   * separador não está à frente. Um cliente que deixe a página aberta uma
   * tarde não tem de nos bater à porta de quatro em quatro segundos.
   */
  useEffect(() => {
    if (!aberto || estado?.pago) return;
    const t = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setAgora(Date.now());
      void ler();
    }, SONDAGEM_MS);
    return () => clearInterval(t);
  }, [aberto, estado?.pago, ler]);

  async function pedir(qual: "mbway" | "multibanco") {
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
    const pago = estado.pagamentos.find((p) => p.estado === "pago");
    return (
      <div className="mt-4 rounded-xl border border-emerald-300 bg-white p-4 text-left">
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Pagamento recebido
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Recebemos {pago ? euros(pago.valor) : "o pagamento"}
          {pago?.metodo === "mbway" ? " por MB WAY" : " por Multibanco"}. O valor fica connosco até
          confirmar que o trabalho está feito.
        </p>
      </div>
    );
  }

  if (!estado.disponivel) return null;

  const valor = comFactura ? estado.valores.comFactura : estado.valores.semFactura;

  // ── Há uma referência ou um MB WAY à espera ─────────────────────────────
  if (aberto) {
    const expira = aberto.expiraEm ? new Date(aberto.expiraEm).getTime() : null;
    const segundos = expira ? Math.max(0, Math.round((expira - agora) / 1000)) : null;
    const expirou = segundos === 0;

    return (
      <div className="mt-4 rounded-xl border border-slate-300 bg-white p-4 text-left">
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
              disabled={aPedir || soParaVer}
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
                ? ` A referência é válida até ${new Date(aberto.expiraEm).toLocaleDateString("pt-PT")}.`
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
  return (
    <div className="mt-4 rounded-xl border border-slate-300 bg-white p-4 text-left">
      <p className="text-sm font-bold text-slate-900">Pagar {euros(valor)}</p>

      {/*
        A FACTURA É UMA ESCOLHA, E TEM DE SER FEITA ANTES DE SE PEDIR O VALOR.
        É ela que decide o número: 105,00 sem, 106,15 com. Perguntá-la depois
        obrigava a anular o pedido e a fazer outro.
      */}
      <label className="mt-2 flex items-start gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={comFactura}
          onChange={(e) => setComFactura(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Quero factura
          <span className="block text-tinta-fraca">
            Com factura são {euros(estado.valores.comFactura)}; sem factura,{" "}
            {euros(estado.valores.semFactura)}.
          </span>
        </span>
      </label>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMetodo("mbway")}
          className={`flex items-center gap-2 rounded-[14px] border p-3 text-left text-sm font-semibold ${
            metodo === "mbway" ? "border-acao bg-acao/5 text-acao" : "border-slate-300 text-slate-700"
          }`}
        >
          <Smartphone className="h-4 w-4" aria-hidden="true" />
          MB WAY
          <span className="block text-[11px] font-normal text-tinta-fraca">confirma no telemóvel</span>
        </button>
        <button
          type="button"
          onClick={() => setMetodo("multibanco")}
          className={`flex items-center gap-2 rounded-[14px] border p-3 text-left text-sm font-semibold ${
            metodo === "multibanco"
              ? "border-acao bg-acao/5 text-acao"
              : "border-slate-300 text-slate-700"
          }`}
        >
          <Landmark className="h-4 w-4" aria-hidden="true" />
          Multibanco
          <span className="block text-[11px] font-normal text-tinta-fraca">referência para pagar</span>
        </button>
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

      {metodo && (
        <button
          type="button"
          onClick={() => void pedir(metodo)}
          disabled={aPedir || soParaVer || (metodo === "mbway" && telemovel.trim().length < 9)}
          className="mt-3 w-full rounded-[14px] bg-acao px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {aPedir
            ? "A pedir…"
            : metodo === "mbway"
              ? `Pagar ${euros(valor)} por MB WAY`
              : `Gerar referência de ${euros(valor)}`}
        </button>
      )}

      {erro && (
        <p className="mt-2 text-xs text-red-600">
          {erro}
          {sugereOutro && metodo === "mbway" && " Pode usar a referência Multibanco."}
        </p>
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
function Rodape() {
  return (
    <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-tinta-fraca">
      Pagamentos processados pelo euPago. A CLYON não guarda dados do seu cartão nem do seu banco.
    </p>
  );
}
