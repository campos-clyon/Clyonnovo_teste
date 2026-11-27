import { primeiroNome } from "./mensagem-whatsapp";
import { quandoPorExtenso } from "./aviso-de-data-ao-cliente";
import { linkDeWhatsApp } from "./link-de-whatsapp";
import { ABERTURA_DOS_METODOS, SEM_METODOS_DE_PAGAMENTO, limparMetodosDePagamento } from "./metodos-de-pagamento";
import { servicoComArtigo } from "./mensagem-das-propostas";
import { servicoEmPalavras } from "./servico-em-palavras";
import { valorComIva } from "./extra-no-local";
import { lerBase, type BaseDoPreco } from "./base-do-preco";
import { fraseDaBase } from "./frase-da-base";
import { diasPorExtenso, type DiaDoTrabalho } from "./varios-dias";
import { telefoneLegivel } from "./telefone-legivel";
import { NO_FIM_DO_TRABALHO, SALVO_SE_COMBINAREM } from "./quando-se-paga";

/**
 * A MENSAGEM DE ADJUDICAÇÃO — 21-10-2026.
 *
 * Depois de o cliente aceitar a proposta e de haver profissional, o dono
 * escrevia isto à mão no WhatsApp. Pediu um botão ao lado de «Alterar valor
 * ou taxa» que abrisse a conversa do cliente com ela já escrita.
 *
 * REESCRITA A 22-10-2026. *«Parece muito robotizada e está com caracteres
 * especiais que pegam muito mal para o cliente.»* Os emojis dos métodos de
 * pagamento chegavam ao cliente como «�» — saíram todos, e a mensagem passou
 * a falar como uma pessoa. E diz quem faz o trabalho: a empresa encarregada
 * e o responsável da empresa, que vai entrar em contacto o mais breve
 * possível, com o telefone dele, para o cliente poder ligar. O responsável
 * escreve-se na ficha do profissional; sem ele, fala-se da equipa da empresa.
 *
 * OS MÉTODOS DE PAGAMENTO VÊM DAS CONFIGURAÇÕES — 27-10-2026. Escrevem-se no
 * backoffice (Configs → «Métodos de pagamento para a adjudicação») e chegam
 * aqui em `metodosDePagamento`. Sem eles, a mensagem diz que os dados seguem
 * a seguir. Ver `metodos-de-pagamento.ts`.
 *
 * O PAGAMENTO SÓ PELA PLATAFORMA — 03-11-2026 (d15, aprovada pelo dono a
 * 04-11). O bloco das Configs saía por omissão neste botão, com dados de
 * pagamento de uma pessoa, e o cliente pagava fora da plataforma. Desde hoje:
 *
 *   · o link do pedido (onde o cliente paga por MB WAY, Multibanco ou
 *     transferência, como no «Enviar valores para pagamento» da d19) vem
 *     marcado no «Enviar adjudicação»;
 *   · os «Dados do dono» vêm desmarcados, e só entram com um motivo escrito
 *     (`lerMotivoDosDadosDoDono`) — o motivo fica no histórico do pedido;
 *   · sem formas escolhidas, a mensagem NUNCA leva o bloco das Configs: diz
 *     que os dados seguem a seguir. Os dados de uma pessoa (IBAN, Revolut, um
 *     telemóvel) não saem por omissão.
 */

/** O motivo para usar os dados do dono: o mesmo tamanho do «sem factura». */
export const MOTIVO_DOS_DADOS_DO_DONO_MINIMO = 5;
export const MOTIVO_DOS_DADOS_DO_DONO_MAXIMO = 300;
export const PEDE_O_MOTIVO_DOS_DADOS_DO_DONO =
  "Escreva porque vai com os dados do dono e não pela plataforma — sem o motivo, não entram.";

export function lerMotivoDosDadosDoDono(v: unknown): { ok: true; motivo: string } | { ok: false; erro: string } {
  const motivo = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, MOTIVO_DOS_DADOS_DO_DONO_MAXIMO) : "";
  return motivo.length >= MOTIVO_DOS_DADOS_DO_DONO_MINIMO
    ? { ok: true, motivo }
    : { ok: false, erro: PEDE_O_MOTIVO_DOS_DADOS_DO_DONO };
}

export type TrabalhoAdjudicado = {
  cliente: string | null;
  quando: string | null;
  servico?: string | null;
  localidade?: string | null;
  /**
   * d63 (18-11-2026): o que o valor mede, e o valor ao cliente (por carga ou por
   * hora: o de UMA carga ou de UMA hora). Sem eles, o trabalho todo e sem número.
   */
  base?: BaseDoPreco | null;
  valor?: { semIva: number; total: number } | null;
  minimoHoras?: number | null;
  /** d64: os dias do trabalho (`varios-dias.ts`); com mais de um, a mensagem diz-os todos. */
  dias?: DiaDoTrabalho[] | null;
  /** O nome da empresa que faz o trabalho — o profissional escolhido. */
  empresa?: string | null;
  /** Quem responde por ela, como o cliente o vai ouvir: o primeiro nome. */
  responsavel?: string | null;
  telefoneDaEmpresa?: string | null;
  /** O texto das Configs com os métodos de pagamento; vazio, os dados seguem a seguir. */
  metodosDePagamento?: string | null;
  /**
   * AS FORMAS ESCOLHIDAS NO «ENVIAR ADJUDICAÇÃO» — 27-10-2026 (d14). Quando
   * vem, manda: os dados do dono só entram se `comDadosDoDono`, e cada
   * referência euPago gerada para este pedido entra com os seus dados. Sem
   * isto, a mensagem é a de sempre (só os métodos das Configs).
   */
  formas?: {
    comDadosDoDono: boolean;
    /** Porque vão os dados do dono (d15): sem um motivo válido, não entram. */
    motivoDosDadosDoDono?: string | null;
    referencias: ReferenciaNaAdjudicacao[];
    /** O link do pedido, gerado no servidor ao preparar a mensagem (d15). */
    link?: string | null;
    /**
     * O MODELO DE 15-11 — d17 (13-11-2026), decidido no servidor
     * (`/api/admin/negociacoes/adjudicacao`). O cliente paga ao parceiro: o
     * bloco do pagamento é o texto D das Vendas, sem «Paga à CLYON» e sem
     * referências; o total é o do bloco «Pagar a …» (`total-ao-cliente.ts`).
     */
    novoModelo?: AdjudicacaoNoNovoModelo | null;
  };
};

/** O que o servidor dá à adjudicação no modelo de 15-11 (d17). */
export type AdjudicacaoNoNovoModelo = {
  /** O que o cliente paga — por carga numa base «carga»; a estimativa (ou o final) numa base «hora». */
  total: number;
  semIva: number;
  /** d58: o que o valor mede (`base-do-preco.ts`). Sem ela, o trabalho todo. */
  base?: BaseDoPreco | null;
  /** d58: numa base «hora» com as horas por confirmar, o valor de UMA hora ao cliente. */
  porHora?: { semIva: number; total: number } | null;
  /** As formas que o parceiro pode receber (`comoPagarDisponiveis` com os dados dele). */
  formas: ReadonlyArray<"transferencia" | "mbway" | "dinheiro">;
};

/** Uma referência euPago gerada no servidor para este pedido. */
export type ReferenciaNaAdjudicacao = {
  metodo: "multibanco" | "mbway";
  valor: number;
  entidade?: string | null;
  referencia?: string | null;
  telemovel?: string | null;
  /** ISO ou Date: quando deixa de valer (Multibanco). */
  expiraEm?: string | Date | null;
};

const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

function diaEmLisboa(d: string | Date): string | null {
  const data = new Date(d);
  if (Number.isNaN(data.getTime())) return null;
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}

function blocoDaReferencia(r: ReferenciaNaAdjudicacao): string {
  if (r.metodo === "multibanco") {
    const ate = r.expiraEm ? diaEmLisboa(r.expiraEm) : null;
    return [
      "Por Multibanco (homebanking ou caixa Multibanco), pelo valor exato:",
      `Entidade: ${r.entidade ?? "—"}`,
      `Referência: ${r.referencia ?? "—"}`,
      `Valor: ${euros(r.valor)}`,
      ate ? `Válida até ${ate}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `Por MB WAY: enviámos um pedido de ${euros(r.valor)}${r.telemovel ? ` para o ${r.telemovel}` : ""}.`,
    "Abra a aplicação MB WAY e confirme — tem 5 minutos. Se não aparecer, diga-nos e enviamos outro.",
  ].join("\n");
}

/**
 * A quem se paga no modelo antigo (e nos Trabalhos CLYON registados até 14-11,
 * d54): à CLYON. Regra s da orquestra: o nome diz «antigo», e no modelo de 15-11
 * a mensagem leva o bloco do pagamento ao parceiro (`blocoDoPagamentoAoParceiro`).
 */
export const PAGA_A_CLYON_NA_ADJUDICACAO_DO_MODELO_ANTIGO = "Paga à CLYON, que só paga ao parceiro depois de o trabalho estar feito.";

/**
 * O BLOCO DO PAGAMENTO, com as formas escolhidas — 27-10-2026 (d14). Sem
 * nenhuma, diz que os dados seguem a seguir.
 */
export function blocoDasFormasDePagamento(
  formas: NonNullable<TrabalhoAdjudicado["formas"]>,
  metodosDePagamento: string | null | undefined,
): string {
  const doDono =
    formas.comDadosDoDono && lerMotivoDosDadosDoDono(formas.motivoDosDadosDoDono).ok
      ? limparMetodosDePagamento(metodosDePagamento ?? null)
      : null;
  const link = formas.link?.trim() || null;
  const partes = [
    // Primeiro o pedido, onde se paga pela plataforma (d15).
    ...(link ? [`No seu pedido, por MB WAY, por Multibanco ou por transferência:\n${link}`] : []),
    ...formas.referencias.map(blocoDaReferencia),
    // A abertura que o dono tenha escrito nas Configs não se repete.
    ...(doDono ? [doDono.replace(/^para o pagamento[^\n]*\n+/i, "")] : []),
  ];
  if (partes.length === 0) return SEM_METODOS_DE_PAGAMENTO;
  // Só o link: a frase da d19, sem abertura.
  if (link && partes.length === 1) {
    return [
      `Pode pagar por MB WAY, por Multibanco ou por transferência, no seu pedido:\n${link}`,
      PAGA_A_CLYON_NA_ADJUDICACAO_DO_MODELO_ANTIGO,
    ].join("\n\n");
  }
  const abertura = partes.length > 1 ? ABERTURA_DOS_METODOS : "Para o pagamento:";
  const euPago =
    formas.referencias.length > 0
      ? "Os pagamentos por Multibanco e MB WAY são processados pelo euPago."
      : null;
  // Como no «Enviar valores para pagamento» (d19): a quem se paga, e quando o parceiro recebe.
  const aQuem =
    link || formas.referencias.length > 0
      ? PAGA_A_CLYON_NA_ADJUDICACAO_DO_MODELO_ANTIGO
      : null;
  return [abertura, ...partes, euPago, aQuem].filter(Boolean).join("\n\n");
}

const FORMA_NA_FRASE: Record<"transferencia" | "mbway" | "dinheiro", string> = {
  transferencia: "transferência",
  mbway: "MB WAY",
  dinheiro: "em dinheiro no local",
};

/** «por transferência, MB WAY ou em dinheiro no local» — só as que o parceiro pode receber. */
function formasEmPalavras(formas: AdjudicacaoNoNovoModelo["formas"]): string {
  const l = formas.map((f) => FORMA_NA_FRASE[f]);
  if (l.length === 0) return "";
  if (l.length === 1) return `por ${l[0]}`;
  return `por ${l.slice(0, -1).join(", ")} ou ${l[l.length - 1]}`;
}

/**
 * A PRIMEIRA FRASE DO BLOCO, PELA BASE — d58 (CEO e dono, 17-11-2026). Com base
 * «por carga» o número é de UMA carga e não do trabalho todo: «O valor é 370 € +
 * IVA por carga (455,11 €), × o número de cargas». Por hora, com as horas por
 * confirmar, o valor de uma hora e a estimativa; com as horas confirmadas, o
 * total final. No resto, como sempre (d47: «X € + IVA = Y €»).
 */
export function valorDoBlocoDoNovoModelo(
  n: Pick<AdjudicacaoNoNovoModelo, "total" | "semIva" | "base" | "porHora"> & { minimoHoras?: number | null },
): string {
  const base = lerBase(n.base);
  // d63 (18-11-2026): a frase única da base (`frase-da-base.ts`), e a taxa da plataforma a seguir.
  if (base === "carga") {
    return `${fraseDaBase("carga", null, { semIva: n.semIva, total: n.total })} Já com a taxa da plataforma.`;
  }
  if (base === "hora" && n.porHora) {
    return (
      `${fraseDaBase("hora", null, { semIva: n.porHora.semIva, total: n.porHora.total, minimoHoras: n.minimoHoras })} ` +
      `Já com a taxa da plataforma. A estimativa é ${valorComIva(n.semIva, n.total)}.`
    );
  }
  return `O total é ${valorComIva(n.semIva, n.total)}, já com a taxa da plataforma.`;
}

/**
 * O BLOCO DO PAGAMENTO NO MODELO DE 15-11 — o texto D das Vendas (d17,
 * 13-11-2026). Sem «Paga à CLYON», sem referências ao cliente, sem os dados do
 * dono: o cliente paga ao parceiro, pelos dados que estão no pedido.
 */
export function blocoDoPagamentoAoParceiro(
  n: AdjudicacaoNoNovoModelo,
  parceiro: string | null | undefined,
  link: string | null | undefined,
): string {
  /*
   * d58: «à empresa X» (a mensagem já a chama assim: «a cargo da empresa …»),
   * ou «ao parceiro» sem nome. Nunca «a X» nem «a o X»: a preposição vai
   * com a palavra que se escreve, e não com o nome.
   */
  const quem = parceiro?.trim() ? `à empresa ${parceiro.trim()}` : "ao parceiro";
  const como = formasEmPalavras(n.formas);
  return [
    valorDoBlocoDoNovoModelo(n),
    `Paga diretamente ${quem}, ${NO_FIM_DO_TRABALHO} (${SALVO_SE_COMBINAREM})${como ? `: ${como}` : ""}. ` +
      (link?.trim() ? `Os dados para pagar estão no seu pedido, e só lá:\n${link.trim()}` : "Os dados para pagar estão no seu pedido, e só lá."),
    "Se alguém lhe pedir que pague para outros dados, não pague e fale connosco.",
    "Recebe duas faturas no pedido: a do trabalho, do parceiro, e a da taxa da plataforma. Guarde o comprovativo do pagamento.",
  ].join("\n");
}

/** d63: a base da adjudicação — a do pedido, ou a do bloco do modelo de 15-11; sem nenhuma, o trabalho todo. */
export function baseDaAdjudicacao(t: Pick<TrabalhoAdjudicado, "base" | "formas">): BaseDoPreco {
  return lerBase(t.base ?? t.formas?.novoModelo?.base ?? null);
}

const maiuscula = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * O TOTAL NO MODELO ANTIGO — d103 (CEO e dono, 24-11-2026). Pelo trabalho todo, a
 * `fraseDaBase` não diz o número (cada mensagem di-lo com as suas palavras), e
 * esta não o dizia: um cliente recebeu «… fica confirmada. Inclui o que está nas
 * fotografias…» sem valor nenhum, com só o link do pedido para pagar. Desde hoje
 * diz-se com as palavras do modelo de 15-11 (`valorDoBlocoDoNovoModelo`), sem a
 * cauda da taxa da plataforma: no modelo antigo o cliente paga um total à CLYON.
 * Nunca o sem IVA sozinho (`valorComIva`). Por carga e por hora o número já vai
 * na frase da base; sem valor gravado, nada.
 */
export function totalDaAdjudicacaoNoModeloAntigo(t: Pick<TrabalhoAdjudicado, "base" | "formas" | "valor">): string | null {
  if (t.formas?.novoModelo || baseDaAdjudicacao(t) !== "total") return null;
  const tem = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
  const v = t.valor ?? null;
  const semIva = tem(v?.semIva) ? v.semIva : tem(v?.total) ? v.total : null;
  const total = tem(v?.total) ? v.total : semIva;
  if (semIva == null || total == null) return null;
  return `O total é ${valorComIva(semIva, total)}.`;
}

export function mensagemDeAdjudicacao(t: TrabalhoAdjudicado, agora: Date): string {
  const nome = primeiroNome(t.cliente);

  const comArtigo = servicoComArtigo(servicoEmPalavras(t.servico ?? null));
  const onde = t.localidade?.trim() ? ` em ${t.localidade.trim()}` : "";
  const oTrabalho = t.servico && comArtigo ? `${maiuscula(comArtigo)}${onde}` : "O serviço";

  // O dia só se diz se ainda está para vir — como na proposta.
  const dia = t.quando ? new Date(t.quando) : null;
  const futuro = dia != null && !Number.isNaN(dia.getTime()) && dia.getTime() > agora.getTime();
  // «A mudança fica marcada», «o esvaziamento fica marcado» — pelo artigo.
  const a = oTrabalho.startsWith("A ") ? "a" : "o";
  /*
   * d64 (18-11-2026): num trabalho em vários dias, os dias todos — «fica marcado
   * de segunda, 16, a quarta, 18 de novembro» — enquanto o último ainda vem.
   */
  const varios = t.dias && t.dias.length > 1 ? t.dias : null;
  const ultimoAindaVem = varios != null && new Date(varios[varios.length - 1].inicio).getTime() > agora.getTime();
  const osDias = varios ? diasPorExtenso(varios) : "";
  const fica = varios && ultimoAindaVem
    ? `${oTrabalho} fica marcad${a} ${osDias.startsWith("de ") ? osDias : `para ${osDias}`}.`
    : futuro
      ? `${oTrabalho} fica marcad${a} para ${quandoPorExtenso(dia, agora)}.`
      : `${oTrabalho} fica confirmad${a}.`;

  const empresa = t.empresa?.trim() || null;
  const responsavel = t.responsavel?.trim() || null;
  const telefone = t.telefoneDaEmpresa?.trim() ? telefoneLegivel(t.telefoneDaEmpresa) : null;
  const quemFaz = empresa
    ? [
        `O trabalho fica a cargo da empresa ${empresa}.`,
        responsavel
          ? `O ${responsavel}, responsável da ${empresa}, vai entrar em contacto consigo o mais breve possível para combinar os pormenores.`
          : `A equipa da ${empresa} vai entrar em contacto consigo o mais breve possível para combinar os pormenores.`,
        telefone ? `Se preferir, pode ligar-lhe directamente para o ${telefone}.` : null,
      ]
        .filter(Boolean)
        .join(" ")
    : "Um colega vai entrar em contacto consigo o mais breve possível para combinar os pormenores.";

  return [
    `Olá${nome ? `, ${nome}` : ""}! Obrigado pela confirmação.`,
    fica,
    /*
     * d47: o que o valor cobre, e o extra no local com o preço da regra do
     * serviço — d63 (18-11-2026): PELA BASE (`frase-da-base.ts`). O #556, por
     * carga no modelo antigo, levava «o volume a mais combina-se consigo». No
     * modelo de 15-11 com base por carga ou por hora a frase já vai no bloco
     * do pagamento: não se diz duas vezes.
     */
    t.formas?.novoModelo && baseDaAdjudicacao(t) !== "total"
      ? null
      : [
          // d103: no modelo antigo, pelo trabalho todo, o total antes do que cobre.
          totalDaAdjudicacaoNoModeloAntigo(t),
          fraseDaBase(baseDaAdjudicacao(t), t.servico ?? null, {
            semIva: t.valor?.semIva ?? null,
            total: t.valor?.total ?? null,
            minimoHoras: t.minimoHoras ?? null,
          }),
        ]
          .filter(Boolean)
          .join(" "),
    quemFaz,
    ...(t.formas?.novoModelo
      ? // O modelo de 15-11 (d17): o texto D, que já diz para guardar o comprovativo.
        [blocoDoPagamentoAoParceiro(t.formas.novoModelo, empresa, t.formas.link)]
      : [
          // Sem formas escolhidas, nunca os dados do dono (d15): os dados seguem a seguir.
          blocoDasFormasDePagamento(t.formas ?? { comDadosDoDono: false, referencias: [] }, t.metodosDePagamento),
          "Depois de pagar, envie-nos o comprovativo por aqui, por favor.",
        ]),
    "Obrigado pela preferência,\nEquipa CLYON",
  ]
    .filter((l): l is string => Boolean(l))
    .join("\n\n");
}

/** O link que abre a conversa do cliente com a mensagem escrita — ou `null` sem telefone. */
export function linkDaAdjudicacao(t: TrabalhoAdjudicado & { telefone: string | null }, agora: Date): string | null {
  return linkDeWhatsApp(t.telefone, mensagemDeAdjudicacao(t, agora));
}
