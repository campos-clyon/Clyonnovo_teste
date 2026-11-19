import { rotuloEscolhido, type ContaDeDestino } from "./contas-de-destino";

/**
 * DE ONDE VEIO CADA PAGAMENTO, E A PROVA — d66 (CEO e dono, 18-11-2026).
 *
 * Cada linha de `pagamentos` e cada parte de `cobrancasAoProfissional` diz a
 * sua ORIGEM, com o rótulo e o detalhe que a provam:
 *
 *   · euPago (MB WAY ou Multibanco) — automático: a entidade, a referência e
 *     o identificador do euPago (`trid`, ou o da criação). Ninguém escreve
 *     nada; a prova é o próprio euPago.
 *   · Transferência — a conta onde entrou (`contaDeDestino`, a lista das
 *     Configs; só nome e últimos 4 dígitos — `contas-de-destino.ts`).
 *   · MB WAY directo, numerário, pago ao profissional, abatimento, acerto — o
 *     rótulo de cada um.
 *
 * E se o registo, por ter sido feito à mão, precisa de COMPROVATIVO (foto ou
 * PDF): «Já recebemos» por transferência ou numerário não grava sem ele
 * (`exigeComprovativoAoRegistar`); os outros registos à mão ficam com a
 * etiqueta «sem comprovativo» até alguém o juntar. Os do euPago e os acertos
 * no saldo (nenhum dinheiro mexeu) nunca precisam.
 *
 * Reaproveita os métodos de sempre (`ComoEntrou`, `a-quem-foi-o-dinheiro.ts`).
 * Puro, sem base; testado em `d66-origem-do-pagamento.test.ts`.
 */

export type ChaveDaOrigem =
  | "eupago_mbway"
  | "eupago_multibanco"
  | "transferencia"
  | "mbway_directo"
  | "numerario"
  | "pago_ao_profissional"
  | "abatimento"
  | "acerto"
  | "outro";

/** Pela ordem dos filtros do ecrã. */
export const ORIGENS: ReadonlyArray<{ chave: ChaveDaOrigem; rotulo: string }> = [
  { chave: "eupago_mbway", rotulo: "euPago · MB WAY" },
  { chave: "eupago_multibanco", rotulo: "euPago · Multibanco" },
  { chave: "transferencia", rotulo: "Transferência" },
  { chave: "mbway_directo", rotulo: "MB WAY directo" },
  { chave: "numerario", rotulo: "Numerário" },
  { chave: "pago_ao_profissional", rotulo: "Pago ao profissional" },
  { chave: "abatimento", rotulo: "Abatimento no saldo" },
  { chave: "acerto", rotulo: "Acerto" },
  { chave: "outro", rotulo: "Outra origem" },
];

const ROTULO = new Map(ORIGENS.map((o) => [o.chave, o.rotulo]));

export function rotuloDaOrigem(chave: ChaveDaOrigem): string {
  return ROTULO.get(chave) ?? "Outra origem";
}

/** O método gravado → a origem. */
export function chaveDaOrigem(metodo: string | null | undefined): ChaveDaOrigem {
  switch (String(metodo ?? "").trim()) {
    case "mbway":
      return "eupago_mbway";
    case "multibanco":
      return "eupago_multibanco";
    case "transferencia":
    case "pro_transferencia":
      return "transferencia";
    case "pro_mbway":
      return "mbway_directo";
    case "numerario":
    case "pro_numerario":
      return "numerario";
    case "ao_profissional":
      return "pago_ao_profissional";
    case "abatimento":
      return "abatimento";
    case "quitacao":
      return "acerto";
    default:
      return "outro";
  }
}

/** O euPago é que diz: nada se escreve à mão. */
export function eOrigemAutomatica(chave: ChaveDaOrigem): boolean {
  return chave === "eupago_mbway" || chave === "eupago_multibanco";
}

/**
 * Um registo feito por uma pessoa, de dinheiro que mexeu: precisa de
 * comprovativo (ou fica «sem comprovativo»). O euPago prova-se sozinho; o
 * abatimento e o acerto não movem dinheiro.
 */
export function precisaDeComprovativo(metodo: string | null | undefined): boolean {
  const c = chaveDaOrigem(metodo);
  return c === "transferencia" || c === "mbway_directo" || c === "numerario" || c === "pago_ao_profissional";
}

/**
 * «Já recebemos» por transferência ou numerário: o botão não grava sem o
 * ficheiro. Quem pagou pelo euPago não precisa; o pago ao profissional em mão
 * pode juntá-lo depois.
 */
export function exigeComprovativoAoRegistar(metodo: string | null | undefined): boolean {
  const c = chaveDaOrigem(metodo);
  return c === "transferencia" || c === "numerario";
}

/** Uma transferência diz sempre a conta onde entrou. */
export function exigeContaDeDestino(metodo: string | null | undefined): boolean {
  return chaveDaOrigem(metodo) === "transferencia";
}

/** Os identificadores internos (linhas à parte, acertos) não são do euPago. */
function eIdentificadorDoEupago(v: string | null | undefined): v is string {
  const s = String(v ?? "").trim();
  // `abatimento-mao-N` e `acerto-folha-N` (pago-em-mao.ts) são as chaves das linhas à parte.
  return s.length > 0 && !/^(abatimento|acerto)-/i.test(s);
}

export type OrigemDoPagamento = {
  chave: ChaveDaOrigem;
  rotulo: string;
  /** A prova escrita: a referência e o id do euPago, ou a conta onde entrou. */
  detalhe: string | null;
  automatica: boolean;
  precisaDeComprovativo: boolean;
};

export function origemDoPagamento(p: {
  metodo: string | null | undefined;
  referencia?: string | null;
  entidade?: string | null;
  trid?: string | null;
  transacaoId?: string | null;
  contaDeDestino?: string | null;
}): OrigemDoPagamento {
  const chave = chaveDaOrigem(p.metodo);
  const automatica = eOrigemAutomatica(chave);
  const partes: string[] = [];
  if (automatica) {
    if (p.entidade) partes.push(`Ent. ${p.entidade}`);
    if (p.referencia) partes.push(`Ref. ${p.referencia}`);
    const id = eIdentificadorDoEupago(p.trid) ? p.trid : eIdentificadorDoEupago(p.transacaoId) ? p.transacaoId : null;
    if (id) partes.push(`euPago ${id}`);
  } else if (p.contaDeDestino) {
    partes.push(`Entrou em ${p.contaDeDestino}`);
  } else if (chave === "transferencia") {
    partes.push("Conta por indicar");
  }
  const metodo = String(p.metodo ?? "");
  const rotulo = metodo.startsWith("pro_") ? `${rotuloDaOrigem(chave)} (do profissional)` : rotuloDaOrigem(chave);
  return {
    chave,
    rotulo,
    detalhe: partes.length ? partes.join(" · ") : null,
    automatica,
    precisaDeComprovativo: precisaDeComprovativo(p.metodo),
  };
}

// ─── Os registos de um trabalho, para o ecrã e para os filtros ──────────────

/** Onde vive o registo: a linha de `pagamentos`, a parte da cobrança, ou o «Já pagámos» ao profissional. */
export type AlvoDoComprovativo = "pagamento" | "cobranca" | "pago_ao_profissional";

export const ALVOS_DO_COMPROVATIVO: ReadonlyArray<AlvoDoComprovativo> = ["pagamento", "cobranca", "pago_ao_profissional"];

export function eAlvoDoComprovativo(v: unknown): v is AlvoDoComprovativo {
  return typeof v === "string" && (ALVOS_DO_COMPROVATIVO as readonly string[]).includes(v);
}

export type ComprovativoVisto = { id: number; nome: string; em: string | null; por: string | null };

/** Um registo de dinheiro do trabalho, com a origem e a prova. */
export type RegistoDoDinheiro = {
  alvo: AlvoDoComprovativo;
  alvoId: number;
  /** «Pagamento do cliente», «IVA pago à parte»… */
  oQue: string;
  valor: number | null;
  em: string | null;
  origem: OrigemDoPagamento;
  comprovativos: ComprovativoVisto[];
  /** Feito à mão, de dinheiro que mexeu, e ainda sem ficheiro. */
  semComprovativo: boolean;
  /** d1 (19-11-2026): quem e quando viu esta transferência no extrato do banco. */
  conferidoNoExtrato?: { em: string | null; por: string | null } | null;
  /** d1: uma transferência que entrou na CLYON e ainda não se viu no extrato. */
  porConferir?: boolean;
};

/**
 * «CONFERIDO NO EXTRATO» — d1 (CEO e dono, 19-11-2026). Um comprovativo faz-se
 * em minutos; só o extrato do banco prova que o dinheiro entrou. Cada
 * TRANSFERÊNCIA que entrou na CLYON (uma linha de `pagamentos` ou uma parte da
 * cobrança ao profissional) ganha a marca de quem a viu no extrato, e quando; as
 * Finanças põem-na uma vez por semana. O euPago prova-se sozinho; o «Já
 * pagámos» ao profissional é dinheiro a sair e fica de fora.
 */
export function eConferivelNoExtrato(r: Pick<RegistoDoDinheiro, "alvo" | "origem">): boolean {
  return (r.alvo === "pagamento" || r.alvo === "cobranca") && r.origem.chave === "transferencia";
}

export function porConferirNoExtrato(r: Pick<RegistoDoDinheiro, "alvo" | "origem" | "conferidoNoExtrato">): boolean {
  return eConferivelNoExtrato(r) && !r.conferidoNoExtrato;
}

/** Os registos onde se põe a marca «conferido no extrato». */
export type AlvoDoExtrato = "pagamento" | "cobranca";

export function eAlvoDoExtrato(v: unknown): v is AlvoDoExtrato {
  return v === "pagamento" || v === "cobranca";
}

export function semComprovativo(r: Pick<RegistoDoDinheiro, "origem" | "comprovativos">): boolean {
  return r.origem.precisaDeComprovativo && r.comprovativos.length === 0;
}

/** O filtro do ecrã: uma origem (ou todas) e, se quiser, só os que falta o comprovativo. */
export type FiltroDaOrigem = {
  origem: ChaveDaOrigem | "todas";
  soSemComprovativo: boolean;
  /** d1: só as transferências que ainda não se viram no extrato. */
  soPorConferir?: boolean;
};

export const FILTRO_DA_ORIGEM_VAZIO: FiltroDaOrigem = { origem: "todas", soSemComprovativo: false, soPorConferir: false };

/**
 * Um trabalho passa no filtro se ALGUM registo dele passa: tem essa origem e,
 * com «só sem comprovativo», é um que ainda não o tem. Sem filtro, passa tudo
 * — também os que ainda não têm registo nenhum.
 */
export function passaNoFiltroDaOrigem(registos: ReadonlyArray<RegistoDoDinheiro> | undefined, f: FiltroDaOrigem): boolean {
  if (f.origem === "todas" && !f.soSemComprovativo && !f.soPorConferir) return true;
  return (registos ?? []).some(
    (r) =>
      (f.origem === "todas" || r.origem.chave === f.origem) &&
      (!f.soSemComprovativo || r.semComprovativo) &&
      (!f.soPorConferir || r.porConferir === true),
  );
}

/** Quantas transferências estão por conferir no extrato — o número ao lado do filtro (d1). */
export function contarPorConferir(listas: ReadonlyArray<ReadonlyArray<RegistoDoDinheiro> | undefined>): number {
  let n = 0;
  for (const l of listas) for (const r of l ?? []) if (r.porConferir === true) n++;
  return n;
}

// ─── Antes de gravar um registo à mão ───────────────────────────────────────

export type RegistoAMaoConferido = { ok: true; contaDeDestino: string | null } | { ok: false; erro: string };

/**
 * O QUE SE CONFERE ANTES DE GRAVAR «JÁ RECEBEMOS» (ou uma parte da cobrança):
 * uma transferência diz a conta onde entrou (da lista das Configs); por
 * transferência ou numerário, no «Já recebemos», o comprovativo vem junto.
 * Nada se grava se faltar uma das duas.
 */
export function conferirRegistoAMao(d: {
  metodo: string;
  contaId: unknown;
  contas: ReadonlyArray<ContaDeDestino>;
  temComprovativo: boolean;
  /** No «Já recebemos» é obrigatório (transferência e numerário); nas partes da cobrança junta-se se houver. */
  comprovativoObrigatorio: boolean;
}): RegistoAMaoConferido {
  let contaDeDestino: string | null = null;
  if (exigeContaDeDestino(d.metodo)) {
    contaDeDestino = rotuloEscolhido(d.contas, d.contaId);
    if (!contaDeDestino) return { ok: false, erro: "Diga em que conta entrou a transferência (a lista está nas Configs)." };
  } else if (d.contaId != null && d.contaId !== "") {
    // MB WAY directo ou numerário: a conta é opcional, mas, se vier, é da lista.
    contaDeDestino = rotuloEscolhido(d.contas, d.contaId);
  }
  if (d.comprovativoObrigatorio && exigeComprovativoAoRegistar(d.metodo) && !d.temComprovativo) {
    return { ok: false, erro: "Junte o comprovativo (fotografia ou PDF): sem ele, o pagamento não se regista." };
  }
  return { ok: true, contaDeDestino };
}

/** Quantos registos à mão estão sem comprovativo — o número ao lado do filtro. */
export function contarSemComprovativo(listas: ReadonlyArray<ReadonlyArray<RegistoDoDinheiro> | undefined>): number {
  let n = 0;
  for (const l of listas) for (const r of l ?? []) if (r.semComprovativo) n++;
  return n;
}
