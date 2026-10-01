"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import {
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Wallet,
  AlertTriangle,
  Smartphone,
  Landmark,
  Pencil,
  ChevronDown,
  Clock,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
import { descritivoDaTransferencia } from "@/lib/descritivo-da-transferencia";

/**
 * Quem tem dinheiro a receber, e por onde lho mandar.
 *
 * "Todos esses pedidos já foram concluídos e recebemos os pagamentos, mas não
 * tenho acesso aos dados dos pros para efectuar o pagamento deles manual."
 *
 * O ecrã dos Levantamentos mostra quem PEDIU para receber, e estava vazio — a
 * dizer "nada por transferir" com 570 € por transferir. Para pedir é preciso ter
 * IBAN gravado, e dois dos três profissionais com trabalho por pagar não o têm:
 * a fila estava vazia porque ninguém conseguia entrar nela.
 *
 * Este ecrã faz a pergunta ao contrário — não quem pediu, mas quem TEM A
 * RECEBER — que é a única que interessa enquanto o pagamento for feito à mão.
 */

type Trabalho = {
  negociacaoId: number;
  pedidoId: number;
  servico: string | null;
  cidade: string | null;
  /** Quem contratou, e onde. É por aqui que se reconhece o trabalho. */
  cliente: string | null;
  telefoneDoCliente: string | null;
  morada: string | null;
  quando: string | null;
  profissional: string;
  valorAcordado: number;
  recebe: number;
  confirmadoEm: string | null;
  aguardaConfirmacao: boolean;
  /** Quando ele deu o trabalho por feito. */
  feitoEm: string | null;
  /** O que o cliente pagou — com IVA incluído desde o corte (01-10-2026), sem IVA antes. */
  clientePaga: number;
  ivaIncluido: boolean;
  /** Em dinheiro com IVA incluído: o IVA e a comissão que o profissional deve à CLYON. */
  dividaDoProfissional: number | null;
  dividaPaga: boolean;
  /** Valor do trabalho menos o que ele recebe — a parte da CLYON do lado dele. */
  taxaDescontada: number;
  forma: "plataforma" | "dinheiro";
};

/** «28/09» — o dia e o mês chegam; o ano é sempre este. */
function diaCurto(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Dias inteiros desde uma data, contados pelo calendário. */
function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const meiaNoite = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.max(0, Math.round((meiaNoite(new Date()) - meiaNoite(d)) / 86_400_000));
}

/* O descritivo da transferência vive em `@/lib/descritivo-da-transferencia`. */

const somar = (valores: number[]) => Math.round(valores.reduce((s, v) => s + v, 0) * 100) / 100;

/*
 * AS COLUNAS DA TABELA — as mesmas no cabeçalho, em cada linha e no total.
 *
 * Num ecrã estreito não há tabela: cada trabalho empilha-se, e os números
 * levam o nome ao lado. A partir de `md` é uma grelha com as colunas
 * alinhadas, que é o que faz cada valor ler-se como sendo daquele trabalho.
 */
const COLUNAS =
  "md:grid md:grid-cols-[minmax(0,1fr)_8.5rem_7.5rem_7rem_7.5rem_8.5rem] md:items-start md:gap-4";

/**
 * QUEM, ONDE E QUANDO — a linha que faz o trabalho ser reconhecível.
 *
 * *«Para eu dizer se já paguei preciso saber de qual se trata: nome do
 * cliente, número e localidade. Também quem realizou.»* — 18-09-2026.
 *
 * O botão «Já paguei» tira dinheiro da conta da CLYON com base no
 * reconhecimento de quem carrega nele, e «#325 · Recolha de móveis ·
 * Carcavelos» não chega para reconhecer nada. Quem paga tem a transferência no
 * homebanking de um lado e esta lista do outro; o que faz a ponte entre as
 * duas é o NOME e o TELEFONE, não o número do pedido.
 *
 * O telemóvel é clicável: metade destas dúvidas resolve-se com uma chamada, e
 * obrigar a copiar o número para o telefone é a diferença entre ligar e deixar
 * para depois.
 *
 * Vive fora dos dois blocos — «por pagar» e «a decorrer» — porque os dois
 * mostram o mesmo trabalho e só diferem no botão da direita. Duas cópias
 * acabavam com dois formatos.
 */
function QuemOndeQuando({ t }: { t: Trabalho }) {
  /*
   * 01-10-2026: duas coisas saíram daqui. A DATA, que passou a ter coluna
   * própria na tabela (feito, confirmado, há quantos dias espera). E o «feito
   * por Revolution», que dentro do cartão do Revolution repetia o título em
   * cada linha. O que fica é o que faz a ponte com o homebanking: o nome, o
   * telefone e a morada do cliente.
   */
  if (!t.cliente && !t.telefoneDoCliente && !t.morada) return null;
  return (
    <div className="mt-1 text-[11px] leading-relaxed">
      <p className="text-slate-300">
        {t.cliente ?? "Cliente sem nome"}
        {t.telefoneDoCliente && (
          <>
            {" · "}
            <a
              href={`tel:${t.telefoneDoCliente.replace(/\s/g, "")}`}
              className="text-cyan-400 hover:underline"
            >
              {t.telefoneDoCliente}
            </a>
          </>
        )}
      </p>
      {t.morada && <p className="truncate text-slate-500">{t.morada}</p>}
    </div>
  );
}

type Ficha = {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  nif: string | null;
  activo: boolean;
  iban: string | null;
  ibanTitular: string | null;
  mbway: string | null;
  moradaFiscal: string | null;
  codigoPostalFiscal: string | null;
  localidadeFiscal: string | null;
  regimeIva: string | null;
  emiteFatura: boolean;
  porPagar: Trabalho[];
  porFinalizar: Trabalho[];
  jaPago: number;
  totalPorPagar: number;
  totalPorFinalizar: number;
  /** O que ele deve à CLYON de trabalhos em dinheiro já confirmados. 01-10-2026. */
  aPagarAClyon?: number;
};

const euros = (v: number) => v.toFixed(2).replace(".", ",") + " €";

const SERVICO: Record<string, string> = {
  recolha_moveis: "Recolha de móveis",
  recolha_monos: "Recolha de monos",
  recolha_entulho: "Recolha de entulho",
  esvaziamento_casa: "Esvaziamento de casa",
  esvaziamento_apartamento: "Esvaziamento de apartamento",
  mudanca: "Mudança",
  montagem_moveis: "Montagem de móveis",
};

/** Copiar sem transcrever: um IBAN à mão são 25 caracteres para enganar. */
function Copiar({ valor, rotulo, texto = "Copiar" }: { valor: string; rotulo: string; texto?: string }) {
  const [feito, setFeito] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(valor);
          setFeito(true);
          setTimeout(() => setFeito(false), 2000);
        } catch {
          /* sem área de transferência: fica o texto à vista para copiar */
        }
      }}
      title={`Copiar ${rotulo}`}
      className="flex shrink-0 items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-800"
    >
      {feito ? (
        <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
      ) : (
        <Copy className="h-3 w-3" aria-hidden="true" />
      )}
      {feito ? "Copiado" : texto}
    </button>
  );
}

export default function AdminCarteirasPanel() {
  const { token } = useAdminAuth();
  const [carteiras, setCarteiras] = useState<Ficha[]>([]);
  const [total, setTotal] = useState(0);
  const [porFinalizar, setPorFinalizar] = useState(0);
  const [jaPago, setJaPago] = useState(0);
  const [clyon, setClyon] = useState({ porFinalizar: 0, ganha: 0, fechada: 0, faturado: 0 });
  const [semComoPagar, setSemComoPagar] = useState(0);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  /*
   * CORRIGIR O VALOR DE UM TRABALHO FECHADO.
   *
   * "Me dê a opção de editar o valor, pois tem trabalhos que o orçamento é no
   * local e que muda — ex.: esse trabalho foi 230."
   *
   * Numa boa parte dos trabalhos o orçamento fecha-se à porta, com as coisas à
   * vista. O #242 foi combinado a 135 € e o trabalho foram 230: sem isto, ou
   * se pagava 128,25 € de um trabalho de 218,50 €, ou se pagava por fora — e
   * fora da carteira o dinheiro deixa de aparecer em conta nenhuma.
   */
  const [aCorrigir, setACorrigir] = useState<{
    t: Trabalho;
    nome: string;
    valor: string;
  } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [precisaMotivo, setPrecisaMotivo] = useState(false);
  const [aGravar, setAGravar] = useState(false);

  async function gravarValor() {
    if (!token || !aCorrigir) return;
    const valor = Number(aCorrigir.valor.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro("Escreva um valor acima de zero.");
      return;
    }
    setAGravar(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/valor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          negociacaoId: aCorrigir.t.negociacaoId,
          valor,
          motivo: motivo.trim() || undefined,
        }),
      });
      const dados = await res.json();
      if (!res.ok) {
        // O servidor pede o motivo quando o trabalho já foi pago: a caixa
        // abre-se em vez de a mensagem morrer numa linha vermelha.
        if (dados.precisaMotivo) setPrecisaMotivo(true);
        setErro(dados.error ?? "Não foi possível gravar o valor.");
        return;
      }
      setACorrigir(null);
      setMotivo("");
      setPrecisaMotivo(false);
      await carregar(true);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(false);
    }
  }

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!token) return;
      if (!silencioso) setACarregar(true);
      try {
        const res = await fetch("/api/admin/carteiras", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dados = await res.json();
        if (!res.ok) {
          setErro(dados.error ?? "Não foi possível ler as carteiras.");
          return;
        }
        setCarteiras(dados.carteiras ?? []);
        setTotal(dados.total ?? 0);
        setPorFinalizar(dados.totalPorFinalizar ?? 0);
        setJaPago(dados.totalJaPago ?? 0);
        setClyon(dados.clyon ?? { porFinalizar: 0, ganha: 0, fechada: 0, faturado: 0 });
        setSemComoPagar(dados.semComoPagar ?? 0);
        setErro("");
      } catch {
        setErro("Erro de rede.");
      } finally {
        setACarregar(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /*
   * NOVIDADES SEM F5 — 16-09-2026.
   *
   * "sempre que quero ver as novidades tenho que ficar atualizando tudo, mas
   * isso não devia acontecer (…) como no WhatsApp, quando alguém envia
   * mensagem." Catorze dos dezasseis painéis deste backoffice não tinham
   * ciclo nenhum.
   *
   * Silencioso de propósito: não mexe no estado de carregamento, não grita
   * erros de rede, pára com o separador escondido e volta a buscar assim que
   * ele reaparece.
   */
  useAutoRefresh(() => carregar(true), { enabled: Boolean(token) });

  async function marcarPago(t: Trabalho, nome: string) {
    if (!token) return;
    if (
      !window.confirm(
        `Marcar como pago a ${nome}?\n\n` +
          `${euros(t.recebe)} pelo pedido #${t.pedidoId}.\n\n` +
          `Faça a transferência PRIMEIRO no banco. Isto só regista que ela saiu — ` +
          `depois disto, o painel dele deixa de mostrar este valor como disponível.`,
      )
    )
      return;

    setOcupado(t.negociacaoId);
    setErro("");
    try {
      const res = await fetch("/api/admin/carteiras", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ negociacaoId: t.negociacaoId }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível marcar como pago.");
        return;
      }
      await carregar(true);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  const comSaldo = carteiras.filter((c) => c.totalPorPagar > 0);
  /* Quem tem trabalho a decorrer não é «sem nada»: tem dinheiro a caminho. */
  // Quem deve à CLYON (IVA e comissão de trabalhos em dinheiro) também não
  // está «parado»: há uma referência por pagar. 01-10-2026.
  const deve = (c: Ficha) => (c.aPagarAClyon ?? 0) > 0;
  const aDecorrer = carteiras.filter(
    (c) => c.totalPorPagar === 0 && (c.totalPorFinalizar > 0 || deve(c)),
  );
  const parados = carteiras.filter(
    (c) => c.totalPorPagar === 0 && c.totalPorFinalizar === 0 && !deve(c),
  );

  /*
   * QUEM ESTÁ FECHADO E QUEM ESTÁ ABERTO.
   *
   * Os «sem movimento» ficam fechados em bloco — não há gesto nenhum a fazer
   * com eles. Os trabalhos «a decorrer» fecham-se por profissional: seis
   * linhas de três andares cada, vezes cinco profissionais, é o que fazia esta
   * página ter três ecrãs de altura sem nada para fazer em nenhum deles.
   */
  const [verParados, setVerParados] = useState(false);
  const [abertos, setAbertos] = useState<Record<number, boolean>>({});

  /**
   * UMA LINHA DA TABELA — um trabalho, e os números DELE ao lado.
   *
   * *«Está tudo muito confuso e misturado, não consigo ver de qual trabalho se
   * trata os valores; deve ter mais informações.»* — 01-10-2026.
   *
   * O que se transferia por cada trabalho estava numa linha cinzenta de onze
   * píxeis, «Acordado 190,00 € · ele recebe 178,60 €», e o botão verde «Já
   * paguei» ficava do outro lado do ecrã, alinhado com o nome do serviço. O
   * total do cartão (1 522,80 €) não aparecia em lado nenhum como a soma
   * destas linhas.
   *
   * Agora cada trabalho é uma linha de uma tabela com colunas: o trabalho e o
   * cliente, as datas, o valor do trabalho, a taxa descontada, e o que se
   * transfere — a negrito, encostado ao botão. E a tabela fecha com o total,
   * que é o número grande do cartão.
   */
  function LinhaDoTrabalho({ t, nome, pagavel }: { t: Trabalho; nome: string; pagavel: boolean }) {
    const servico = SERVICO[t.servico ?? ""] ?? t.servico ?? "Trabalho";
    const espera = pagavel ? diasDesde(t.confirmadoEm) : null;
    const percentagem =
      t.valorAcordado > 0 ? Math.round((t.taxaDescontada / t.valorAcordado) * 100) : null;
    return (
      <div className={`rounded-lg bg-slate-950/40 px-3 py-2.5 ${COLUNAS}`}>
        {/* ── O trabalho: o que é, de quem, onde ── */}
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${pagavel ? "text-white" : "text-slate-300"}`}>
            <span className="mr-1.5 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-300">
              #{t.pedidoId}
            </span>
            {servico}
            {t.cidade ? <span className="font-normal text-slate-400"> · {t.cidade}</span> : null}
          </p>
          <QuemOndeQuando t={t} />
        </div>

        {/* ── As datas: quando foi feito, quando foi confirmado, há quanto espera ── */}
        <div className="mt-2 space-y-0.5 text-[11px] leading-snug text-slate-400 md:mt-0">
          {t.feitoEm && <p>Feito {diaCurto(t.feitoEm)}</p>}
          {t.confirmadoEm && <p>Confirmado {diaCurto(t.confirmadoEm)}</p>}
          {!t.feitoEm && !t.confirmadoEm && t.quando && <p>Marcado {diaCurto(t.quando)}</p>}
          {espera != null && espera > 0 && (
            <p className={espera >= 7 ? "font-semibold text-amber-300" : "text-slate-500"}>
              à espera há {espera} {espera === 1 ? "dia" : "dias"}
            </p>
          )}
        </div>

        {/* ── Os números. No telemóvel levam o nome ao lado; na tabela, o nome está no cabeçalho. ── */}
        <div className="mt-2 grid grid-cols-3 gap-2 md:contents">
          <div className="md:text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 md:hidden">Valor do trabalho</p>
            <p className="text-sm tabular-nums text-slate-200">{euros(t.valorAcordado)}</p>
            <p className="text-[10px] tabular-nums text-slate-500">
              cliente pagou {euros(t.clientePaga)} {t.ivaIncluido ? "c/ IVA" : "s/ IVA"}
            </p>
            {/*
              EM DINHEIRO COM IVA INCLUÍDO, O PROFISSIONAL DEVE À CLYON — 01-10-2026.
              O cliente pagou-lhe o preço com IVA em notas; o IVA e a comissão
              voltam por referência, gerada ao confirmar (ou no cartão do
              trabalho, em Negociações).
            */}
            {t.dividaDoProfissional != null && (
              <p
                className={`text-[10px] font-semibold tabular-nums ${
                  t.dividaPaga ? "text-emerald-400" : "text-amber-300"
                }`}
              >
                {t.dividaPaga
                  ? `pagou à CLYON ${euros(t.dividaDoProfissional)}`
                  : `deve à CLYON ${euros(t.dividaDoProfissional)}`}
              </p>
            )}
          </div>
          <div className="md:text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 md:hidden">Taxa CLYON</p>
            <p className="text-sm tabular-nums text-slate-400">−{euros(t.taxaDescontada)}</p>
            {percentagem != null && <p className="text-[10px] text-slate-500">{percentagem} %</p>}
          </div>
          <div className="md:text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 md:hidden">
              {pagavel ? "A transferir" : "Vai receber"}
            </p>
            <p className={`text-base font-bold tabular-nums ${pagavel ? "text-emerald-300" : "text-slate-300"}`}>
              {euros(t.recebe)}
            </p>
          </div>
        </div>

        {/* ── A acção ── */}
        <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-0 md:flex-col md:items-end">
          {pagavel ? (
            <button
              onClick={() => marcarPago(t, nome)}
              disabled={ocupado === t.negociacaoId}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {ocupado === t.negociacaoId ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Já paguei
            </button>
          ) : (
            <span
              className={`rounded-full px-2.5 py-1 text-center text-[11px] font-semibold leading-tight ${
                t.forma === "dinheiro"
                  ? "max-w-[8.5rem] bg-slate-800 text-slate-300"
                  : t.aguardaConfirmacao
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-slate-800 text-slate-400"
              }`}
            >
              {t.forma === "dinheiro"
                ? "em dinheiro — nada a transferir"
                : t.aguardaConfirmacao
                  ? "falta confirmar"
                  : "por fazer"}
            </span>
          )}
          <button
            onClick={() => setACorrigir({ t, nome, valor: String(t.valorAcordado) })}
            className="inline-flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
            corrigir valor
          </button>
        </div>
      </div>
    );
  }

  /**
   * A TABELA: o cabeçalho, as linhas, e o total que é o número do cartão.
   *
   * O total é somado aqui, das linhas que estão à vista — e não lido de outro
   * sítio —, para que o que se vê em baixo seja literalmente a soma do que se
   * vê em cima. Se não bater com o número grande do cartão, é porque alguma
   * coisa está mal, e vê-se.
   */
  function TabelaDeTrabalhos({
    lista,
    nome,
    pagavel,
  }: {
    lista: Trabalho[];
    nome: string;
    pagavel: boolean;
  }) {
    const totalValor = somar(lista.map((t) => t.valorAcordado));
    const totalTaxa = somar(lista.map((t) => t.taxaDescontada));
    const totalRecebe = somar(lista.map((t) => t.recebe));
    return (
      <div className="space-y-1.5">
        <div
          className={`hidden px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${COLUNAS}`}
          aria-hidden="true"
        >
          <span>Trabalho e cliente</span>
          <span>Datas</span>
          <span className="text-right">Valor do trabalho</span>
          <span className="text-right">Taxa CLYON</span>
          <span className="text-right">{pagavel ? "A transferir" : "Vai receber"}</span>
          <span />
        </div>
        {lista.map((t) =>
          pagavel ? (
            <LinhaDoTrabalho key={t.negociacaoId} t={t} nome={nome} pagavel />
          ) : (
            <LinhaDoTrabalho key={t.negociacaoId} t={t} nome={nome} pagavel={false} />
          ),
        )}
        <div className={`rounded-lg border border-slate-800 px-3 py-2 ${COLUNAS}`}>
          <p className="text-xs font-semibold text-slate-300">
            Total · {lista.length} {lista.length === 1 ? "trabalho" : "trabalhos"}
          </p>
          <span className="hidden md:block" />
          <p className="hidden text-right text-xs tabular-nums text-slate-400 md:block">{euros(totalValor)}</p>
          <p className="hidden text-right text-xs tabular-nums text-slate-500 md:block">−{euros(totalTaxa)}</p>
          <p
            className={`mt-1 text-right text-base font-bold tabular-nums md:mt-0 ${
              pagavel ? "text-emerald-300" : "text-slate-300"
            }`}
          >
            {euros(totalRecebe)}
          </p>
          <span className="hidden md:block" />
        </div>
      </div>
    );
  }

  /**
   * O CARTÃO DE UM PROFISSIONAL, em três pesos.
   *
   * O mesmo profissional, com a mesma informação por trás, mostrado conforme o
   * que há para fazer com ele:
   *
   *   · «pagar»    — vai abrir-se o banco. O IBAN à vista, o trabalho
   *                  identificado, e o botão de dar por pago;
   *   · «decorrer» — não se faz nada hoje. Só quanto aí vem e quantos trabalhos;
   *   · «parado»   — não se faz nada nunca. Uma linha, e o IBAN só se existir.
   *
   * O BLOCO DE PAGAMENTO SÓ APARECE ONDE SE PAGA. Era isto que enchia o ecrã:
   * duas caixas grandes de IBAN e MB WAY, mais a morada fiscal, repetidas em
   * cada um dos dezoito profissionais — incluindo os dezasseis a quem não se
   * devia nada.
   */
  function Cartao({ c, modo }: { c: Ficha; modo: "pagar" | "decorrer" | "parado" }) {
    const aberto = abertos[c.id] ?? false;
    const semComoReceber = !c.iban && !c.mbway;

    return (
      <article
        className={`rounded-2xl border bg-slate-900 ${
          modo === "pagar"
            ? "border-emerald-500/25 p-4"
            : modo === "decorrer"
              ? "border-slate-800 p-3.5"
              : "border-slate-800/70 p-3"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className={`flex items-center gap-2 font-bold ${
                modo === "parado" ? "text-sm text-slate-300" : "text-base text-white"
              }`}
            >
              <Wallet className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              {c.nome}
              {!c.activo && (
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                  inactivo
                </span>
              )}
            </h3>
            {(c.aPagarAClyon ?? 0) > 0 && (
              <p className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                deve à CLYON {euros(c.aPagarAClyon ?? 0)} — IVA e comissão de trabalhos em dinheiro
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {c.nif ? `NIF ${c.nif}` : "sem NIF"}
              {" · "}
              {c.emiteFatura
                ? `passa fatura (${c.regimeIva ?? "regime por indicar"})`
                : "não passa fatura"}
              {c.telefone ? ` · ${c.telefone}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p
              className={`font-[Poppins] font-bold ${
                modo === "pagar" ? "text-xl text-emerald-300" : "text-base text-slate-400"
              }`}
            >
              {euros(modo === "pagar" ? c.totalPorPagar : c.totalPorFinalizar)}
            </p>
            <p className="text-[11px] text-slate-500">
              {modo === "pagar"
                ? `a transferir · ${c.porPagar.length} ${c.porPagar.length === 1 ? "trabalho" : "trabalhos"}`
                : modo === "decorrer"
                  ? "a caminho"
                  : c.jaPago > 0
                    ? `${euros(c.jaPago)} já pagos`
                    : "nada em curso"}
            </p>
            {/*
              O DESCRITIVO, para a transferência dizer o que paga. Sem ele, o
              profissional vê 1 522,80 € entrar e não sabe de que trabalhos.
            */}
            {modo === "pagar" && c.porPagar.length > 0 && (
              <div className="mt-1.5 flex justify-end">
                <Copiar
                  valor={descritivoDaTransferencia(c.porPagar.map((t) => t.pedidoId))}
                  rotulo="o descritivo da transferência"
                  texto="Copiar descritivo"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Por onde lhe pagar: só onde se vai pagar ──────────────────── */}
        {modo === "pagar" && (
          <>
            {/*
              `grid-cols-1` e `min-w-0` nas caixas: sem eles o IBAN, que nao
              parte, alargava a coluna para alem do cartao no telemovel — o
              `truncate` do codigo so encolhe se a caixa a volta puder encolher.
            */}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <Landmark className="h-3.5 w-3.5" aria-hidden="true" />
                  Transferência
                </p>
                {c.iban ? (
                  <>
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="min-w-0 flex-1 break-all font-mono text-sm text-slate-100">
                        {c.iban}
                      </code>
                      <Copiar valor={c.iban} rotulo="o IBAN" />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {c.ibanTitular ? (
                        <>
                          Titular: <span className="text-slate-300">{c.ibanTitular}</span>
                        </>
                      ) : (
                        /* Um nome que não bate com o IBAN é transferência devolvida. */
                        <span className="text-amber-400">Sem titular indicado.</span>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 text-sm text-amber-400">Sem IBAN.</p>
                )}
              </div>

              <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                  MB WAY
                </p>
                {c.mbway ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="min-w-0 flex-1 font-mono text-sm text-slate-100">
                      {c.mbway}
                    </code>
                    <Copiar valor={c.mbway} rotulo="o MB WAY" />
                  </div>
                ) : (
                  <p className="mt-1.5 text-sm text-slate-500">Sem MB WAY.</p>
                )}
              </div>
            </div>

            {/* A morada fiscal é para o documento, não para o pagamento —
                por isso vem depois, e mais discreta. */}
            <p className="mt-2 text-xs text-slate-500">
              {c.moradaFiscal ? (
                <>
                  Morada fiscal:{" "}
                  <span className="text-slate-400">
                    {[c.moradaFiscal, c.codigoPostalFiscal, c.localidadeFiscal]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </>
              ) : (
                <span className="text-amber-500/80">Morada fiscal por indicar.</span>
              )}
            </p>
          </>
        )}

        {/*
          NOS OUTROS DOIS, UMA LINHA E SÓ QUANDO É PRECISA.

          Um bloco de IBAN em quem não tem nada a receber é ruído. Mas a quem
          tem dinheiro A CAMINHO vale a pena avisar já, para se pedir o IBAN
          antes de o trabalho fechar — e não depois, com o dinheiro parado e o
          profissional à espera.
        */}
        {modo === "decorrer" && semComoReceber && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Sem IBAN nem MB WAY — peça-lhos antes de o trabalho fechar.
          </p>
        )}
        {modo === "parado" && (
          <p className="mt-1.5 truncate font-mono text-xs text-slate-600">
            {c.iban ?? (c.mbway ? `MB WAY ${c.mbway}` : "sem IBAN nem MB WAY")}
          </p>
        )}

        {/* ── Os trabalhos por pagar, um a um ───────────────────────────── */}
        {modo === "pagar" && c.porPagar.length > 0 && (
          <div className="mt-4 border-t border-slate-800 pt-3">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
              A transferir agora — feitos e confirmados
            </h4>
            <TabelaDeTrabalhos lista={c.porPagar} nome={c.nome} pagavel />
          </div>
        )}

        {/*
          O QUE ESTÁ A DECORRER — fechado, e sem botão de pagar.

          Não é dinheiro dele ainda: está do lado do cliente e só se solta
          quando o trabalho for confirmado. Um botão aqui seria um convite a
          pagar por trabalho que ainda não foi feito.

          Fechado porque ninguém faz nada com ele hoje — mas contam-se quantos
          são e quanto valem, que é o que decide se vale a pena esperar pela
          próxima transferência ou fazer já esta.
        */}
        {modo !== "parado" && c.porFinalizar.length > 0 && (
          <div className="mt-3 border-t border-slate-800 pt-3">
            <button
              onClick={() => setAbertos((a) => ({ ...a, [c.id]: !aberto }))}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              {/*
                «A DECORRER · 5 TRABALHOS · 1945,80 €» por baixo de um cartão que
                diz «1522,80 € por transferir» eram dois totais lado a lado sem
                dizer qual é qual. Diz-se o que é: ainda não se transfere.
              */}
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Ainda não se transfere · {c.porFinalizar.length}{" "}
                {c.porFinalizar.length === 1 ? "trabalho" : "trabalhos"} por fazer ou por confirmar ·{" "}
                {euros(c.totalPorFinalizar)}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${
                  aberto ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>
            {aberto && (
              <div className="mt-2">
                <TabelaDeTrabalhos lista={c.porFinalizar} nome={c.nome} pagavel={false} />
              </div>
            )}
          </div>
        )}
      </article>
    );
  }


  return (
    <section className="rounded-[28px] border border-slate-700/60 bg-slate-900/80 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
      {/*
        A CAIXA DE CORRIGIR O VALOR.

        Fecha-se pelo botão e não por clicar fora: já se perdeu trabalho a
        meio por um toque ao lado, e aqui o que se perde é um número que se
        acabou de acertar ao telefone.
      */}
      {aCorrigir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="font-[Poppins] text-lg font-bold text-white">
              Corrigir o valor
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              #{aCorrigir.t.pedidoId} · {aCorrigir.nome}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Estava acordado {euros(aCorrigir.t.valorAcordado)}. O que ficar aqui
              refaz o que ele recebe, o que o cliente paga e a comissão — e fica no
              histórico do pedido.
            </p>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Valor do trabalho (sem IVA)
              <input
                autoFocus
                value={aCorrigir.valor}
                onChange={(e) => setACorrigir({ ...aCorrigir, valor: e.target.value })}
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-lg font-bold text-white outline-none focus:border-cyan-600"
              />
            </label>

            {/* A conta refeita, antes de gravar: ver o número antes de o fixar. */}
            {Number(aCorrigir.valor.replace(",", ".")) > 0 && (
              <p className="mt-2 text-xs text-cyan-300">
                Ele passa a receber{" "}
                <strong>
                  {/* Da constante, e não de um 0,95 escrito aqui: a taxa
                      mudou uma vez e este número ficou a mentir. */}
                  {euros(quantoOProfissionalRecebe(Number(aCorrigir.valor.replace(",", "."))))}
                </strong>
                .
              </p>
            )}

            {(precisaMotivo || aCorrigir.t.confirmadoEm) && (
              <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Porquê
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="orçamento fechado no local"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                />
              </label>
            )}

            {erro && (
              <p className="mt-3 rounded-lg border border-rose-800 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
                {erro}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={gravarValor}
                disabled={aGravar}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0E7490] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0891B2] disabled:opacity-50"
              >
                {aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Gravar
              </button>
              <button
                onClick={() => {
                  setACorrigir(null);
                  setMotivo("");
                  setPrecisaMotivo(false);
                  setErro("");
                }}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Plataforma
          </p>
          <h2 className="mt-1 font-[Poppins] text-2xl font-bold text-white">Carteiras</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Quem tem dinheiro a receber, e por onde lho mandar. Faça a transferência no banco
            e marque como pago aqui — enquanto não houver ligação directa, é isto que fecha
            o dinheiro no painel dele.
          </p>
        </div>
        <button
          onClick={() => carregar()}
          className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Actualizar
        </button>
      </div>

      {/* O número que interessa, em cima. */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {/*
          TRÊS MONTES, e cada trabalho está exactamente num deles.

          "A carteira deve mostrar os valores já pagos, por pagar, e por
          finalizar — seriam os trabalhos acordados mas ainda não realizados."

          O do meio é o que exige acção hoje, e por isso é o que tem cor. O da
          esquerda diz o que aí vem — é o que decide se vale a pena esperar
          pela próxima transferência ou fazer já esta. O da direita é a conta
          feita, e serve para conferir.
        */}
        <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Por finalizar
          </p>
          <p className="font-[Poppins] text-2xl font-bold text-slate-300">
            {euros(porFinalizar)}
          </p>
          <p className="text-xs text-slate-500">acordado, ainda por fazer</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
            Por transferir
          </p>
          <p className="font-[Poppins] text-2xl font-bold text-white">{euros(total)}</p>
          <p className="text-xs text-emerald-300/70">
            {comSaldo.length} {comSaldo.length === 1 ? "profissional" : "profissionais"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Já pagos
          </p>
          <p className="font-[Poppins] text-2xl font-bold text-slate-300">{euros(jaPago)}</p>
          <p className="text-xs text-slate-500">desde o início</p>
        </div>

        {/*
          O aviso que explica o ecrã vazio dos Levantamentos: sem IBAN nem MB
          WAY, o profissional não consegue sequer PEDIR para receber. O dinheiro
          fica parado e ninguém vê porquê.
        */}
        {semComoPagar > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-amber-200">
                {semComoPagar} {semComoPagar === 1 ? "não tem" : "não têm"} para onde receber
              </p>
              <p className="text-xs text-amber-300/80">
                Sem IBAN nem MB WAY. Peça-lhos antes de transferir seja o que for.
              </p>
            </div>
          </div>
        )}
      </div>

      {/*
        A CONTA DA CASA.

        "Coloque também os ganhos da CLYON."

        A comissão vem das duas pontas — 5% que o cliente paga a mais e 6% que
        se desconta ao profissional (trocadas em 07-09-2026) — e por isso não
        se lê nem do que entra nem do que sai. É a diferença entre os dois, e
        não estava em lado nenhum.

        Segue os mesmos três estados do dinheiro deles, de propósito: uma
        comissão de um trabalho por fazer ainda não é ganho, é uma promessa.
        Só o número da direita está fechado dos dois lados.
      */}
      <div className="mt-4 rounded-2xl border border-cyan-500/25 bg-[#06B6D4]/[0.06] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
            A comissão da CLYON
          </p>
          <p className="text-xs text-slate-400">
            {euros(clyon.faturado)} facturados aos clientes até hoje
          </p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] text-slate-500">A caminho</p>
            <p className="font-[Poppins] text-lg font-bold text-slate-300">
              {euros(clyon.porFinalizar)}
            </p>
            <p className="text-[11px] text-slate-600">de trabalho por fazer</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Ganha, por liquidar</p>
            <p className="font-[Poppins] text-lg font-bold text-slate-300">
              {euros(clyon.ganha)}
            </p>
            <p className="text-[11px] text-slate-600">falta transferir a parte dele</p>
          </div>
          <div>
            <p className="text-[11px] text-cyan-300">Fechada</p>
            <p className="font-[Poppins] text-xl font-bold text-white">{euros(clyon.fechada)}</p>
            <p className="text-[11px] text-cyan-300/70">trabalho feito e pago</p>
          </div>
        </div>
      </div>

      {erro && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/*
        «A ler» só quando não há nada lido — ver a nota igual na Agenda.

        Voltar a esta secção trocava as carteiras todas por «A ler…», mesmo
        com os saldos já na memória. Quem já tem números fica a vê-los; a
        actualização entra por baixo.
      */}
      {aCarregar && carteiras.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">A ler…</p>
      ) : carteiras.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-8 text-center text-sm text-slate-500">
          Ainda não há profissionais com trabalho fechado.
        </p>
      ) : (
        <>
          {/*
            ⚠️ TRÊS SECÇÕES, E NÃO UMA LISTA — 18-09-2026.

            "Muitas informações nessa tela misturadas; organize tudo de modo
            profissional."

            Estavam todos na mesma lista e com o mesmo cartão: quem tem 500 €
            à espera de transferência e quem nunca fez um trabalho ocupavam o
            mesmo espaço, cada um com o seu bloco de IBAN, de MB WAY e de
            morada fiscal. Num ecrã com dezoito profissionais, os dois que
            precisam de alguma coisa desaparecem no meio dos dezasseis que não.

            A separação é pelo GESTO, que é o que muda de um grupo para o
            outro:

              · A PAGAR    — abre-se o banco e transfere-se. Precisa do IBAN à
                             vista e do trabalho identificado;
              · A DECORRER — não se faz nada hoje. Basta saber quanto aí vem;
              · SEM NADA   — não se faz nada nunca. Só existe para se poder
                             procurar alguém, e por isso está fechado.
          */}
          {comSaldo.length > 0 && (
            <section className="mt-6">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                <Landmark className="h-3.5 w-3.5" aria-hidden="true" />A pagar agora ·{" "}
                {euros(total)}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Trabalho feito e confirmado. Transfira no banco e marque aqui.
              </p>
              <div className="mt-3 space-y-3">
                {comSaldo.map((c) => (
                  <Cartao key={c.id} c={c} modo="pagar" />
                ))}
              </div>
            </section>
          )}

          {aDecorrer.length > 0 && (
            <section className="mt-7">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />A decorrer ·{" "}
                {euros(porFinalizar)}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Fechado com o profissional e ainda por fazer ou por confirmar. Nada a
                transferir hoje.
              </p>
              <div className="mt-3 space-y-2">
                {aDecorrer.map((c) => (
                  <Cartao key={c.id} c={c} modo="decorrer" />
                ))}
              </div>
            </section>
          )}

          {parados.length > 0 && (
            <section className="mt-7">
              {/*
                FECHADO POR OMISSÃO. São profissionais sem nada a receber e sem
                nada a caminho — não há gesto nenhum a fazer com eles. Ficam
                atrás de um clique para se poder confirmar um IBAN ou procurar
                um nome, que é a única razão para os abrir.
              */}
              <button
                onClick={() => setVerParados((v) => !v)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-2.5 text-left transition hover:border-slate-700"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Sem movimento · {parados.length}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  {verParados ? "esconder" : "ver"}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${verParados ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </span>
              </button>
              {verParados && (
                <div className="mt-2 space-y-2">
                  {parados.map((c) => (
                    <Cartao key={c.id} c={c} modo="parado" />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
