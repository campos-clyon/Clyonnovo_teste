import { diaEmLisboa, instanteDaBase } from "./hora-de-lisboa";

/**
 * A GESTORA DE CONTAS DA CLYON — 14-10-2026.
 *
 * *«Quero que transforme a carteira nessa gestora de contas da CLYON, onde
 * podemos gerir os pagamentos e gastos da CLYON, valores recebidos e pagos,
 * com categorias, entre outros.»* — com as capturas do Mobills ao lado: o
 * painel do mês, as transacções por dia com o saldo do fim do dia, as
 * despesas por categoria, e a despesa, a receita e a transferência à mão.
 *
 * As decisões do dono, no mesmo dia:
 *   · a secção das Carteiras passa a ser esta gestora, e o ecrã de antes (o que
 *     cada profissional tem a receber, e o IBAN) fica lá dentro, num separador;
 *   · O DINHEIRO DA PLATAFORMA ENTRA SOZINHO: o que os clientes pagaram e o que
 *     se transferiu aos profissionais aparecem como receitas e despesas, com
 *     categoria própria e só de leitura — o resto lança-se à mão;
 *   · vê e lança quem tiver a secção (apagar continua a ser do administrador,
 *     como em todo o backoffice);
 *   · começa do zero — o histórico do Mobills fica para depois.
 *
 * ESTE FICHEIRO É PURO: as regras, as contas e as frases. A base está em
 * `financas-na-base.ts`; os ecrãs em `components/admin/financas`.
 */

export type TipoDeMovimento = "despesa" | "receita" | "transferencia";
export type TipoDeCategoria = "despesa" | "receita";
export type TipoDeConta = "banco" | "dinheiro" | "cartao" | "outra";

export const TIPOS_DE_CONTA: ReadonlyArray<{ id: TipoDeConta; rotulo: string }> = [
  { id: "banco", rotulo: "Conta bancária" },
  { id: "dinheiro", rotulo: "Dinheiro" },
  { id: "cartao", rotulo: "Cartão" },
  { id: "outra", rotulo: "Outra" },
];

/** Os dez tons da paleta do dono (o `@theme` do globals.css). */
export const CORES = [
  "ciano",
  "azul",
  "violeta",
  "magenta",
  "coral",
  "laranja",
  "ambar",
  "lima",
  "esmeralda",
  "ardosia",
] as const;
export type Cor = (typeof CORES)[number];

/** Os ícones de uma categoria, por nome — o ecrã traduz em desenho. */
export const ICONES = [
  "salario",
  "combustivel",
  "portagem",
  "alimentacao",
  "mecanica",
  "viatura",
  "compras",
  "material",
  "servicos",
  "assinatura",
  "impostos",
  "renda",
  "publicidade",
  "seguro",
  "telefone",
  "saude",
  "formacao",
  "trabalho",
  "clientes",
  "profissionais",
  "comissao",
  "banco",
  "presente",
  "outros",
] as const;
export type Icone = (typeof ICONES)[number];

/**
 * As duas contas que o dinheiro da plataforma conhece: a do banco, onde o
 * euPago deposita e de onde saem as transferências aos profissionais, e a
 * caixa, onde entra o numerário que um cliente entrega à CLYON.
 */
export type PapelDaConta = "plataforma" | "caixa";

export type Conta = {
  id: number;
  nome: string;
  tipo: TipoDeConta;
  /** O que a conta tinha no dia em que começou a ser seguida aqui. */
  saldoInicial: number;
  cor: Cor;
  papel: PapelDaConta | null;
};

/** As categorias que o dinheiro da plataforma usa. Existem sempre. */
export type CategoriaDoSistema =
  | "clientes"
  | "dividas_dos_profissionais"
  | "pagamentos_aos_profissionais"
  | "comissoes_eupago";

export type Categoria = {
  id: number;
  nome: string;
  tipo: TipoDeCategoria;
  cor: Cor;
  icone: Icone;
  sistema: CategoriaDoSistema | null;
};

/** De onde veio um movimento que ninguém lançou à mão. */
export type OrigemAutomatica = {
  de: "recebimento" | "comissao_eupago" | "pago_ao_profissional" | "levantamento";
  pedidoId: number | null;
};

export type Movimento = {
  /** `m12` — lançado à mão; `auto:…` — veio da plataforma. */
  id: string;
  tipo: TipoDeMovimento;
  /** Sempre positivo: o sinal é o tipo. */
  valor: number;
  /** `YYYY-MM-DD`, o dia em Lisboa. */
  dia: string;
  descricao: string;
  /** Nula numa transferência. */
  categoriaId: number | null;
  /** Numa transferência, a conta de onde sai. */
  contaId: number;
  /** Só numa transferência: para onde vai. */
  contaDestinoId: number | null;
  /** «Foi paga» / «Foi recebida». Por fazer não mexe no saldo de hoje. */
  efectivado: boolean;
  /** «Ignorar transação»: fica à vista, e não conta em total nenhum. */
  ignorado: boolean;
  notas: string | null;
  anexo: { url: string; nome: string } | null;
  automatico: OrigemAutomatica | null;
  criadoPor: string | null;
};

// ─── O que nasce com a gestora ───────────────────────────────────────────────

export const CONTAS_DE_ORIGEM: ReadonlyArray<Omit<Conta, "id" | "saldoInicial"> & { papel: PapelDaConta }> = [
  { nome: "Banco", tipo: "banco", cor: "azul", papel: "plataforma" },
  { nome: "Caixa", tipo: "dinheiro", cor: "esmeralda", papel: "caixa" },
];

/**
 * As categorias com que a gestora abre — as do Mobills dele, mais as que uma
 * empresa de recolhas usa. Mudam-se, apagam-se e acrescentam-se no ecrã.
 */
export const CATEGORIAS_DE_ORIGEM: ReadonlyArray<Omit<Categoria, "id" | "sistema">> = [
  { nome: "Salários", tipo: "despesa", cor: "laranja", icone: "salario" },
  { nome: "Combustível", tipo: "despesa", cor: "ardosia", icone: "combustivel" },
  { nome: "Portagens", tipo: "despesa", cor: "coral", icone: "portagem" },
  { nome: "Alimentação", tipo: "despesa", cor: "magenta", icone: "alimentacao" },
  { nome: "Mecânica", tipo: "despesa", cor: "ambar", icone: "mecanica" },
  { nome: "Compras", tipo: "despesa", cor: "violeta", icone: "compras" },
  { nome: "Serviços", tipo: "despesa", cor: "esmeralda", icone: "servicos" },
  { nome: "Assinaturas", tipo: "despesa", cor: "azul", icone: "assinatura" },
  { nome: "Impostos", tipo: "despesa", cor: "lima", icone: "impostos" },
  { nome: "Publicidade", tipo: "despesa", cor: "ciano", icone: "publicidade" },
  { nome: "Outras despesas", tipo: "despesa", cor: "ardosia", icone: "outros" },
  { nome: "Trabalhos feitos", tipo: "receita", cor: "lima", icone: "trabalho" },
  { nome: "Outras receitas", tipo: "receita", cor: "ardosia", icone: "outros" },
];

export const CATEGORIAS_DO_SISTEMA: Readonly<Record<CategoriaDoSistema, Omit<Categoria, "id" | "sistema">>> = {
  clientes: { nome: "Clientes (plataforma)", tipo: "receita", cor: "ciano", icone: "clientes" },
  dividas_dos_profissionais: {
    nome: "IVA e comissão (trabalhos em dinheiro)",
    tipo: "receita",
    cor: "esmeralda",
    icone: "profissionais",
  },
  pagamentos_aos_profissionais: {
    nome: "Pagamentos aos profissionais",
    tipo: "despesa",
    cor: "violeta",
    icone: "profissionais",
  },
  comissoes_eupago: { nome: "Comissões euPago", tipo: "despesa", cor: "ardosia", icone: "comissao" },
};

// ─── Números ─────────────────────────────────────────────────────────────────

export const aosCentimos = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** «18.640,10 €» — com o ponto dos milhares, como no Mobills dele. */
export function emEuros(v: number): string {
  const sinal = v < 0 ? "-" : "";
  const [inteira, decimal] = Math.abs(aosCentimos(v)).toFixed(2).split(".");
  return `${sinal}${inteira.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimal} €`;
}

/** «1.234,56», «12,5», «12.50», 12.5 → 1234.56 / 12.5. Nada que não seja um número. */
export function lerEuros(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? aosCentimos(v) : null;
  if (typeof v !== "string") return null;
  let t = v.replace(/[€\s]/g, "");
  if (!t) return null;
  // Com vírgula, a vírgula é a decimal e os pontos são milhares.
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? aosCentimos(n) : null;
}

// ─── Meses e dias ────────────────────────────────────────────────────────────

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** `YYYY-MM` de um dia. */
export const mesDoDia = (dia: string): string => dia.slice(0, 7);

/** `2026-10` + 2 → `2026-12`; − 10 → `2025-12`. */
export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** «Outubro de 2026». */
export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const nome = MESES[m - 1] ?? "";
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
}

/** «Out» — para os eixos. */
export function mesCurto(mes: string): string {
  const m = Number(mes.slice(5, 7));
  const nome = MESES[m - 1] ?? "";
  return nome.charAt(0).toUpperCase() + nome.slice(1, 3);
}

/** O último dia do mês, `YYYY-MM-DD`. */
export function ultimoDiaDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/** «terça-feira, 14 de outubro» — o dia de calendário, sem fuso. */
export function diaPorExtenso(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  const semana = DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  return `${semana}, ${d} de ${MESES[m - 1]}`;
}

/** Um dia `YYYY-MM-DD` que existe. */
export function diaValido(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [a, m, d] = v.split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1, d));
  return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === d && a >= 2000 && a <= 2100;
}

// ─── O saldo ─────────────────────────────────────────────────────────────────

/** Conta para o saldo: aconteceu, e não se mandou ignorar. */
export const contaParaOSaldo = (m: Movimento): boolean => m.efectivado && !m.ignorado;

/** O que um movimento faz a uma conta: entra (+), sai (−), ou nada. */
export function efeitoNaConta(m: Movimento, contaId: number): number {
  if (m.tipo === "receita") return m.contaId === contaId ? m.valor : 0;
  if (m.tipo === "despesa") return m.contaId === contaId ? -m.valor : 0;
  let efeito = 0;
  if (m.contaId === contaId) efeito -= m.valor;
  if (m.contaDestinoId === contaId) efeito += m.valor;
  return efeito;
}

/**
 * O saldo de uma conta até ao fim de um dia (inclusive). Sem dia, tudo o que
 * já aconteceu.
 */
export function saldoDaConta(conta: Conta, movimentos: Movimento[], ateDia?: string): number {
  let s = conta.saldoInicial;
  for (const m of movimentos) {
    if (!contaParaOSaldo(m)) continue;
    if (ateDia && m.dia > ateDia) continue;
    s += efeitoNaConta(m, conta.id);
  }
  return aosCentimos(s);
}

/**
 * O SALDO INICIAL QUE FAZ A CONTA BATER COM O BANCO HOJE.
 *
 * O dinheiro da plataforma entra desde o primeiro pagamento, com meses de
 * história. Quem escrevesse o saldo de hoje do extracto como «saldo inicial»
 * contava essa história duas vezes. Aqui escreve-se o saldo de hoje, e o
 * inicial é o que sobra depois de descontar tudo o que já está lançado.
 */
export function saldoInicialParaBater(
  conta: Pick<Conta, "id">,
  movimentos: Movimento[],
  saldoDeHoje: number,
  hoje: string,
): number {
  const lancado = saldoDaConta({ ...(conta as Conta), saldoInicial: 0 }, movimentos, hoje);
  return aosCentimos(saldoDeHoje - lancado);
}

/** O saldo de todas as contas juntas. Uma transferência entre elas não muda nada. */
export function saldoTotal(contas: Conta[], movimentos: Movimento[], ateDia?: string): number {
  return aosCentimos(contas.reduce((s, c) => s + saldoDaConta(c, movimentos, ateDia), 0));
}

// ─── O mês ───────────────────────────────────────────────────────────────────

export type ResumoDoMes = {
  receitas: number;
  despesas: number;
  /** Receitas menos despesas do mês — o que aconteceu. */
  balanco: number;
  /** Por receber e por pagar neste mês: lançado, mas ainda não aconteceu. */
  receitasPrevistas: number;
  despesasPrevistas: number;
};

/**
 * As contas do mês. As transferências não entram: o dinheiro mudou de conta,
 * não entrou nem saiu da CLYON. Os ignorados também não.
 */
export function resumoDoMes(movimentos: Movimento[], mes: string): ResumoDoMes {
  const r = { receitas: 0, despesas: 0, receitasPrevistas: 0, despesasPrevistas: 0 };
  for (const m of movimentos) {
    if (m.ignorado || m.tipo === "transferencia" || mesDoDia(m.dia) !== mes) continue;
    if (m.tipo === "receita") {
      if (m.efectivado) r.receitas += m.valor;
      else r.receitasPrevistas += m.valor;
    } else if (m.efectivado) r.despesas += m.valor;
    else r.despesasPrevistas += m.valor;
  }
  return {
    receitas: aosCentimos(r.receitas),
    despesas: aosCentimos(r.despesas),
    balanco: aosCentimos(r.receitas - r.despesas),
    receitasPrevistas: aosCentimos(r.receitasPrevistas),
    despesasPrevistas: aosCentimos(r.despesasPrevistas),
  };
}

export type FatiaDaCategoria = {
  categoria: Categoria | null;
  total: number;
  /** De 0 a 1: a parte desta categoria no total do mês. */
  fraccao: number;
};

/** As despesas (ou as receitas) do mês, por categoria, da maior para a menor. */
export function porCategoria(
  movimentos: Movimento[],
  categorias: Categoria[],
  mes: string,
  tipo: TipoDeCategoria,
): FatiaDaCategoria[] {
  const somas = new Map<number | null, number>();
  for (const m of movimentos) {
    if (m.tipo !== tipo || !contaParaOSaldo(m) || mesDoDia(m.dia) !== mes) continue;
    somas.set(m.categoriaId, (somas.get(m.categoriaId) ?? 0) + m.valor);
  }
  const total = [...somas.values()].reduce((s, v) => s + v, 0);
  const porId = new Map(categorias.map((c) => [c.id, c]));
  return [...somas.entries()]
    .map(([id, soma]) => ({
      categoria: id != null ? (porId.get(id) ?? null) : null,
      total: aosCentimos(soma),
      fraccao: total > 0 ? soma / total : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Os últimos `n` meses até `mes`, do mais antigo para o mais recente. */
export function balancoDosMeses(
  movimentos: Movimento[],
  mes: string,
  n = 6,
): Array<{ mes: string; receitas: number; despesas: number }> {
  return Array.from({ length: n }, (_, i) => {
    const m = somarMeses(mes, i - (n - 1));
    const r = resumoDoMes(movimentos, m);
    return { mes: m, receitas: r.receitas, despesas: r.despesas };
  });
}

export type DiaDeMovimentos = {
  dia: string;
  movimentos: Movimento[];
  /** O saldo no fim do dia: de todas as contas, ou só da conta escolhida. */
  saldoNoFimDoDia: number;
};

/**
 * Os dias do mês com movimentos, do mais recente para o mais antigo, cada um
 * com o saldo com que acabou — o «Saldo do Final do Dia» do Mobills.
 *
 * O saldo conta com tudo o que aconteceu até esse dia, mesmo o que o filtro
 * esconde: é o saldo da conta, e não a soma do que se está a ver.
 */
export function diasDoMes(
  contas: Conta[],
  todos: Movimento[],
  vistos: Movimento[],
  mes: string,
  contaId: number | null = null,
): DiaDeMovimentos[] {
  const porDia = new Map<string, Movimento[]>();
  for (const m of vistos) {
    if (mesDoDia(m.dia) !== mes) continue;
    porDia.set(m.dia, [...(porDia.get(m.dia) ?? []), m]);
  }
  const conta = contaId != null ? contas.find((c) => c.id === contaId) : undefined;
  const saldo = (dia: string) => (conta ? saldoDaConta(conta, todos, dia) : saldoTotal(contas, todos, dia));
  return [...porDia.keys()]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((dia) => ({
      dia,
      movimentos: (porDia.get(dia) ?? []).sort((a, b) => ordemNoDia(b) - ordemNoDia(a)),
      saldoNoFimDoDia: saldo(dia),
    }));
}

/** Dentro do dia, o último lançado primeiro; os da plataforma por baixo. */
function ordemNoDia(m: Movimento): number {
  return m.id.startsWith("m") ? Number(m.id.slice(1)) || 0 : -1;
}

// ─── Lançar à mão ────────────────────────────────────────────────────────────

export type DadosDoMovimento = {
  tipo: TipoDeMovimento;
  valor: number;
  dia: string;
  descricao: string;
  categoriaId: number | null;
  contaId: number;
  contaDestinoId: number | null;
  efectivado: boolean;
  ignorado: boolean;
  notas: string | null;
  anexoUrl: string | null;
  anexoNome: string | null;
};

const texto = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const VALOR_MAXIMO = 10_000_000;

/** O que veio do formulário, conferido contra as contas e as categorias que existem. */
export function lerMovimento(
  corpo: unknown,
  contas: Conta[],
  categorias: Categoria[],
): { ok: true; dados: DadosDoMovimento } | { ok: false; erro: string } {
  const c = (corpo ?? {}) as Record<string, unknown>;
  const tipo = c.tipo;
  if (tipo !== "despesa" && tipo !== "receita" && tipo !== "transferencia") {
    return { ok: false, erro: "Escolha se é despesa, receita ou transferência." };
  }
  const valor = lerEuros(c.valor);
  if (valor == null || valor <= 0) return { ok: false, erro: "Escreva o valor, maior do que zero." };
  if (valor > VALOR_MAXIMO) return { ok: false, erro: "Esse valor é grande demais. Confirme os zeros." };
  if (!diaValido(c.dia)) return { ok: false, erro: "Escolha o dia." };

  const contaId = Number(c.contaId);
  if (!contas.some((x) => x.id === contaId)) return { ok: false, erro: "Escolha a conta." };

  let categoriaId: number | null = null;
  let contaDestinoId: number | null = null;
  if (tipo === "transferencia") {
    contaDestinoId = Number(c.contaDestinoId);
    if (!contas.some((x) => x.id === contaDestinoId)) return { ok: false, erro: "Escolha a conta para onde vai." };
    if (contaDestinoId === contaId) return { ok: false, erro: "A transferência tem de ir para outra conta." };
  } else {
    categoriaId = Number(c.categoriaId);
    const cat = categorias.find((x) => x.id === categoriaId);
    if (!cat) return { ok: false, erro: "Escolha a categoria." };
    if (cat.tipo !== tipo) {
      return { ok: false, erro: `«${cat.nome}» é uma categoria de ${cat.tipo === "despesa" ? "despesas" : "receitas"}.` };
    }
  }

  const anexoUrl = texto(c.anexoUrl, 500);
  if (anexoUrl && !/^https:\/\//.test(anexoUrl)) return { ok: false, erro: "O anexo não se percebe. Volte a anexá-lo." };

  return {
    ok: true,
    dados: {
      tipo,
      valor,
      dia: c.dia as string,
      descricao: texto(c.descricao, 200),
      categoriaId,
      contaId,
      contaDestinoId,
      efectivado: c.efectivado !== false,
      ignorado: c.ignorado === true,
      notas: texto(c.notas, 500) || null,
      anexoUrl: anexoUrl || null,
      anexoNome: anexoUrl ? texto(c.anexoNome, 160) || "Anexo" : null,
    },
  };
}

/** Uma conta nova ou mudada. */
export function lerConta(
  corpo: unknown,
): { ok: true; dados: { nome: string; tipo: TipoDeConta; saldoInicial: number; cor: Cor } } | { ok: false; erro: string } {
  const c = (corpo ?? {}) as Record<string, unknown>;
  const nome = texto(c.nome, 60);
  if (!nome) return { ok: false, erro: "Dê um nome à conta." };
  const tipo = TIPOS_DE_CONTA.some((t) => t.id === c.tipo) ? (c.tipo as TipoDeConta) : "banco";
  const saldoInicial = c.saldoInicial == null || c.saldoInicial === "" ? 0 : lerEuros(c.saldoInicial);
  if (saldoInicial == null || Math.abs(saldoInicial) > VALOR_MAXIMO) {
    return { ok: false, erro: "O saldo inicial não se percebe." };
  }
  const cor = (CORES as readonly string[]).includes(c.cor as string) ? (c.cor as Cor) : "azul";
  return { ok: true, dados: { nome, tipo, saldoInicial, cor } };
}

/** Uma categoria nova ou mudada. */
export function lerCategoria(
  corpo: unknown,
): { ok: true; dados: { nome: string; tipo: TipoDeCategoria; cor: Cor; icone: Icone } } | { ok: false; erro: string } {
  const c = (corpo ?? {}) as Record<string, unknown>;
  const nome = texto(c.nome, 60);
  if (!nome) return { ok: false, erro: "Dê um nome à categoria." };
  if (c.tipo !== "despesa" && c.tipo !== "receita") return { ok: false, erro: "Despesa ou receita?" };
  const cor = (CORES as readonly string[]).includes(c.cor as string) ? (c.cor as Cor) : "ardosia";
  const icone = (ICONES as readonly string[]).includes(c.icone as string) ? (c.icone as Icone) : "outros";
  return { ok: true, dados: { nome, tipo: c.tipo, cor, icone } };
}

// ─── O dinheiro da plataforma ────────────────────────────────────────────────

/** Um pagamento dado por pago na tabela `pagamentos`. */
export type RecebimentoDaPlataforma = {
  id: number;
  pedidoId: number;
  /** `mbway`, `multibanco`… do euPago; `transferencia`, `numerario`, `ao_profissional`, `abatimento` à mão. */
  metodo: string;
  valor: number;
  valorPago: number | null;
  comissaoEupago: number | null;
  pagoEm: Date | string | null;
  /** `producao` ou `sandbox`. */
  ambiente: string;
  /** Um pagamento a sério feito para provar a integração. O dinheiro é real. */
  deTeste: boolean;
  /** O profissional do trabalho é uma conta de teste (o Fred Teste). */
  contaDeTeste: boolean;
  /** A forma de pagamento do trabalho: `dinheiro` quer dizer que isto é a dívida do pro. */
  formaDoTrabalho: string | null;
  cliente: string | null;
  profissional: string | null;
};

/** Um trabalho marcado como pago ao profissional (`negociacoes.pagoEm`). */
export type PagamentoAoProfissional = {
  negociacaoId: number;
  pedidoId: number;
  pagoEm: Date | string | null;
  /** O que ele recebe — o valor menos a taxa da negociação. */
  recebe: number;
  profissional: string;
  contaDeTeste: boolean;
  formaDoTrabalho: string | null;
};

/** Um levantamento dado por pago. */
export type LevantamentoDaPlataforma = {
  id: number;
  valor: number;
  processadoEm: Date | string | null;
  profissional: string;
  contaDeTeste: boolean;
};

/** Os métodos em que o dinheiro NÃO entrou na CLYON. */
const NAO_ENTROU_NA_CLYON = ["ao_profissional", "abatimento"];
/** Os registos à mão — num trabalho de teste, são de faz-de-conta. */
const ANOTADOS_A_MAO = ["transferencia", "numerario"];

const NOME_DO_METODO: Record<string, string> = {
  mbway: "MB WAY",
  multibanco: "Multibanco",
  transferencia: "transferência",
  numerario: "numerário",
};

function diaDe(v: Date | string | null): string | null {
  const d = instanteDaBase(v);
  return d ? diaEmLisboa(d) : null;
}

/**
 * O DINHEIRO DA PLATAFORMA, TRADUZIDO EM MOVIMENTOS — só de leitura.
 *
 * Entra o que passou mesmo pelas contas da CLYON, e nada duas vezes:
 *
 *   · RECEBIDO: os pagamentos dados por pagos, em produção. Pelo euPago ou por
 *     transferência, no banco; em numerário, na caixa. Fica de fora o que o
 *     cliente pagou ao profissional no local, e a dívida abatida no saldo do
 *     profissional — nesses, o dinheiro não entrou na conta. Um pagamento de
 *     um trabalho em dinheiro é o profissional a pagar o IVA e a comissão.
 *   · A COMISSÃO DO euPAGO sai do recebido, como despesa à parte.
 *   · PAGO AOS PROFISSIONAIS: os trabalhos marcados como pagos e os
 *     levantamentos pagos — as duas maneiras de a CLYON transferir.
 *
 * As contas de teste (o Fred Teste) ficam de fora — menos o que o euPago
 * confirmou, que é dinheiro real na conta, mesmo num trabalho de teste.
 */
export function movimentosDaPlataforma(
  d: {
    recebimentos: RecebimentoDaPlataforma[];
    pagosAosProfissionais: PagamentoAoProfissional[];
    levantamentos: LevantamentoDaPlataforma[];
  },
  onde: { contaPlataforma: number; contaCaixa: number; categoria: (s: CategoriaDoSistema) => number },
): Movimento[] {
  const base = {
    contaDestinoId: null,
    efectivado: true,
    ignorado: false,
    notas: null,
    anexo: null,
    criadoPor: null,
  } as const;
  const fora: Movimento[] = [];

  for (const r of d.recebimentos) {
    const dia = diaDe(r.pagoEm);
    const valor = aosCentimos(r.valorPago ?? r.valor);
    if (!dia || !(valor > 0)) continue;
    if (r.ambiente !== "producao") continue;
    if (NAO_ENTROU_NA_CLYON.includes(r.metodo)) continue;
    if (r.contaDeTeste && ANOTADOS_A_MAO.includes(r.metodo)) continue;

    const daDivida = r.formaDoTrabalho === "dinheiro";
    const como = NOME_DO_METODO[r.metodo];
    const teste = r.deTeste ? " · pagamento de teste" : "";
    fora.push({
      ...base,
      id: `auto:recebimento:${r.id}`,
      tipo: "receita",
      valor,
      dia,
      descricao:
        (daDivida
          ? `IVA e comissão de ${r.profissional ?? "profissional"} — #${r.pedidoId}`
          : `${r.cliente?.trim() || "Cliente"} — #${r.pedidoId}`) +
        (como ? ` (${como})` : "") +
        teste,
      categoriaId: onde.categoria(daDivida ? "dividas_dos_profissionais" : "clientes"),
      contaId: r.metodo === "numerario" ? onde.contaCaixa : onde.contaPlataforma,
      automatico: { de: "recebimento", pedidoId: r.pedidoId },
    });

    const comissao = aosCentimos(r.comissaoEupago ?? 0);
    if (comissao > 0) {
      fora.push({
        ...base,
        id: `auto:comissao:${r.id}`,
        tipo: "despesa",
        valor: comissao,
        dia,
        descricao: `Comissão do euPago — #${r.pedidoId}`,
        categoriaId: onde.categoria("comissoes_eupago"),
        contaId: onde.contaPlataforma,
        automatico: { de: "comissao_eupago", pedidoId: r.pedidoId },
      });
    }
  }

  for (const p of d.pagosAosProfissionais) {
    const dia = diaDe(p.pagoEm);
    const valor = aosCentimos(p.recebe);
    if (!dia || !(valor > 0) || p.contaDeTeste) continue;
    // Num trabalho em dinheiro a CLYON não transfere nada: o cliente pagou-lhe no local.
    if (p.formaDoTrabalho === "dinheiro") continue;
    fora.push({
      ...base,
      id: `auto:pago:${p.negociacaoId}`,
      tipo: "despesa",
      valor,
      dia,
      descricao: `${p.profissional} — #${p.pedidoId}`,
      categoriaId: onde.categoria("pagamentos_aos_profissionais"),
      contaId: onde.contaPlataforma,
      automatico: { de: "pago_ao_profissional", pedidoId: p.pedidoId },
    });
  }

  for (const l of d.levantamentos) {
    const dia = diaDe(l.processadoEm);
    const valor = aosCentimos(l.valor);
    if (!dia || !(valor > 0) || l.contaDeTeste) continue;
    fora.push({
      ...base,
      id: `auto:levantamento:${l.id}`,
      tipo: "despesa",
      valor,
      dia,
      descricao: `Levantamento de ${l.profissional}`,
      categoriaId: onde.categoria("pagamentos_aos_profissionais"),
      contaId: onde.contaPlataforma,
      automatico: { de: "levantamento", pedidoId: null },
    });
  }

  return fora;
}

/** «Pagamentos», «Levantamentos» — o ecrã onde se mexe num movimento automático. */
export function ondeSeMexe(o: OrigemAutomatica): string {
  return o.de === "levantamento" ? "Levantamentos" : "Pagamentos";
}
