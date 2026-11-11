import { aoCliente, porqueFicaDeFora, type CandidatoDaMudanca } from "./lista-de-parceiros-da-mudanca";
import { REGRAS_DAS_MUDANCAS } from "./conta-da-mudanca";
import { TAXA_IVA } from "./taxas-plataforma";
import {
  DESLOCACAO_DA_MUDANCA_PARA_O_MODELO,
  ELEVADOR_EXTERIOR,
  HORAS_A_MAIS_COM_DESMONTAGEM,
  HORAS_POR_TIPOLOGIA,
  MINIMO_DE_HORAS,
  PESSOAS_NA_EQUIPA,
  POR_ANDAR_SEM_ELEVADOR,
  POR_ANDAR_SEM_ELEVADOR_POR_PESSOA,
  PRECO_POR_HORA,
  TIPOLOGIA_POR_EXTENSO,
  type Tipologia,
} from "./tabela-das-mudancas";

/**
 * O PREÇO PÚBLICO DAS MUDANÇAS — 11-11-2026 («Textos e nota Google»).
 *
 * Desde 10–11-11 as mudanças fazem-se ao preço de cada parceiro (a tarifa de
 * `tarifasDasMudancas`, a lista no simulador e nas apps). O site, a Vitória,
 * a FAQ, o blog e os títulos ainda prometiam «Equipa de 3 a 50 €/h + IVA».
 *
 * A regra (decisão do CEO, aprovada pelo dono):
 *   · com pelo menos um parceiro na lista, diz-se o «desde» VERDADEIRO — o
 *     preço por hora mais baixo com 2 pessoas, como o cliente o paga — e o
 *     modelo: compare os parceiros e escolha;
 *   · sem nenhum, a tabela de antes diz-se como REFERÊNCIA (50 € + IVA por
 *     hora, equipa de 3, mínimo 3 horas), e o simulador segue pela equipa.
 *   · nunca o sem IVA sozinho; ao cliente diz-se «parceiro».
 *
 * Esta lib é PURA: os textos saem de um `PrecoPublicoDasMudancas`, e quem o
 * lê da base (com cache de 1 h) é `ler-preco-publico-das-mudancas.ts`. Os
 * textos que não podem esperar pela base (blog, FAQ, as perguntas das
 * cidades) usam o modelo sem número (`MODELO_DA_MUDANCA`) e a referência.
 */

export type ValorDaHora = { semIvaCent: number; comIvaCent: number };

export type PrecoPublicoDasMudancas =
  | { tipo: "parceiros"; parceiros: number; desde: ValorDaHora }
  | { tipo: "referencia" };

/** Sem parceiros na lista (ou sem base): a referência. */
export const SEM_PARCEIROS: PrecoPublicoDasMudancas = Object.freeze({ tipo: "referencia" });

/**
 * O «desde» dos parceiros: os que entrariam na lista de uma mudança qualquer
 * (sem conta de teste, aprovados, activos, com mudanças nas categorias, com a
 * tarifa e «aparecer na lista»), o preço da hora com 2 pessoas mais baixo.
 * A distância e a equipa de 3 ficam de fora: dependem do pedido.
 */
export function precoPublicoDosCandidatos(candidatos: readonly CandidatoDaMudanca[]): PrecoPublicoDasMudancas {
  const ctx = {
    tipologia: null,
    desmontagem: false,
    pessoas: 2 as const,
    kmPercurso: 0,
    formaDePagamento: "na_plataforma" as const,
    cidade: null,
  };
  let menor: number | null = null;
  let quantos = 0;
  for (const c of candidatos) {
    if (!c.tarifa || porqueFicaDeFora(c, 0, ctx) !== null) continue;
    const cent = Math.round(Number(c.tarifa.precoHora2) * 100);
    if (!Number.isFinite(cent) || cent <= 0) continue;
    quantos += 1;
    if (menor == null || cent < menor) menor = cent;
  }
  if (menor == null) return SEM_PARCEIROS;
  const v = aoCliente(menor, REGRAS_DAS_MUDANCAS, true);
  return { tipo: "parceiros", parceiros: quantos, desde: { semIvaCent: v.semIvaCent, comIvaCent: v.comIvaCent } };
}

/* ── O ÚLTIMO CONHECIDO — para quem fala sem poder esperar pela base ──────── */

let ultimoConhecido: PrecoPublicoDasMudancas = SEM_PARCEIROS;

/** O último preço lido da base nesta instância (a referência, antes da primeira leitura). */
export function precoPublicoConhecido(): PrecoPublicoDasMudancas {
  return ultimoConhecido;
}

export function lembrarPrecoPublico(p: PrecoPublicoDasMudancas): void {
  ultimoConhecido = p;
}

/* ── OS NÚMEROS, ESCRITOS ─────────────────────────────────────────────────── */

/** «40» ou «42,50» — sem espaços que partam um título. */
function numero(cent: number): string {
  return cent % 100 === 0 ? String(cent / 100) : (cent / 100).toFixed(2).replace(".", ",");
}
/** «40,00 €» */
function euros(cent: number): string {
  return `${(cent / 100).toFixed(2).replace(".", ",")} €`;
}

const REF_SEM_IVA_CENT = Math.round(PRECO_POR_HORA * 100);
const REF_COM_IVA_CENT = Math.round(PRECO_POR_HORA * (1 + TAXA_IVA) * 100);

/** O preço da hora de referência (a tabela de antes), sem e com IVA. */
export const HORA_DE_REFERENCIA: ValorDaHora = Object.freeze({ semIvaCent: REF_SEM_IVA_CENT, comIvaCent: REF_COM_IVA_CENT });

/* ── O MODELO, SEM NÚMERO — o mesmo em todo o lado (`modelo-da-mudanca.ts`) ── */

export { MODELO_DA_MUDANCA, MODELO_DA_MUDANCA_CURTO, REFERENCIA_DA_MUDANCA } from "./modelo-da-mudanca";
import { MODELO_DA_MUDANCA, REFERENCIA_DA_MUDANCA } from "./modelo-da-mudanca";

/* ── OS TEXTOS, PELO PREÇO PÚBLICO ────────────────────────────────────────── */

/** «desde 40,00 € + IVA/h (49,20 € com IVA), equipa de 2» ou a referência. */
export function precoDaMudancaCurto(p: PrecoPublicoDasMudancas): string {
  if (p.tipo === "parceiros") {
    return `desde ${euros(p.desde.semIvaCent)} + IVA/h (${euros(p.desde.comIvaCent)} com IVA), equipa de 2`;
  }
  return REFERENCIA_DA_MUDANCA;
}

/** A frase da cabeça de uma página: o «desde» e o convite a comparar, ou a referência. */
export function precoDaMudancaNaCabeca(p: PrecoPublicoDasMudancas): string {
  if (p.tipo === "parceiros") {
    return `Mudanças à hora ${precoDaMudancaCurto(p)} — compare os parceiros e escolha.`;
  }
  return `Mudanças à hora: cada parceiro tem o seu preço. A ${REFERENCIA_DA_MUDANCA}.`;
}

/** A resposta inteira, para «Quanto custa uma mudança?». */
export function precoDaMudancaPorExtenso(p: PrecoPublicoDasMudancas): string {
  return `${precoDaMudancaNaCabeca(p)} ${MODELO_DA_MUDANCA}`;
}

/** Para títulos, por ordem de preferência — fica o primeiro que couber nos 60 caracteres. */
export function precoDaMudancaNoTitulo(p: PrecoPublicoDasMudancas): string[] {
  if (p.tipo === "parceiros") return [`Desde ${numero(p.desde.semIvaCent)} €/h + IVA`];
  return [`Referência ${numero(REF_SEM_IVA_CENT)} €/h + IVA`];
}

/** Para uma descrição, depois de «Mudanças em X à hora, »: sem ponto final. */
export function precoDaMudancaNaDescricao(p: PrecoPublicoDasMudancas): string {
  if (p.tipo === "parceiros") {
    return `desde ${numero(p.desde.semIvaCent)} €/h + IVA (${numero(p.desde.comIvaCent)} € com IVA), equipa de 2 — compare parceiros e escolha`;
  }
  return `referência ${numero(REF_SEM_IVA_CENT)} €/h + IVA (${numero(REF_COM_IVA_CENT)} € com IVA), equipa de ${PESSOAS_NA_EQUIPA}`;
}

/**
 * O preço nos dados estruturados: o «desde» real, à hora, sem IVA; sem
 * parceiros, nenhum (a referência não se declara ao Google como oferta).
 */
export function ofertaDaMudanca(p: PrecoPublicoDasMudancas) {
  if (p.tipo !== "parceiros") return undefined;
  return {
    "@type": "Offer",
    priceCurrency: "EUR",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: p.desde.semIvaCent / 100,
      priceCurrency: "EUR",
      unitCode: "HUR",
      unitText: "hora",
      valueAddedTaxIncluded: false,
    },
  } as const;
}

/** O que a Vitória diz a quem pergunta o preço de uma mudança. */
export function precoDaMudancaNoWhatsApp(p: PrecoPublicoDasMudancas): string {
  const abre =
    p.tipo === "parceiros"
      ? `Nas mudanças, cada parceiro tem o seu preço por hora — ${precoDaMudancaCurto(p)}.`
      : `Nas mudanças, cada parceiro tem o seu preço por hora; a ${REFERENCIA_DA_MUDANCA.replace(/^referência: /, "referência é ")}.`;
  return (
    `${abre} No simulador de mudanças (clyon.pt/simulador?servico=mudanca) vê os parceiros disponíveis, ` +
    "com a nota, o preço por hora, a equipa de 2 ou 3 e o material, e escolhe; o valor final sai das horas, " +
    "dos km e do material confirmados na folha do dia."
  );
}

/** As regras, para o aviso ao modelo que estima. */
export function regrasDaMudancaParaOModelo(p: PrecoPublicoDasMudancas): string {
  const hora =
    p.tipo === "parceiros"
      ? `Preço por hora de CADA PARCEIRO (a tarifa dele). O mais baixo hoje, com 2 pessoas: ${numero(p.desde.semIvaCent)} €/hora. Para estimar usa a referência de ${PRECO_POR_HORA} €/hora (equipa de ${PESSOAS_NA_EQUIPA}), mínimo ${MINIMO_DE_HORAS} horas.`
      : `Sem parceiros na lista: a referência é ${PRECO_POR_HORA} €/hora (equipa de ${PESSOAS_NA_EQUIPA}), mínimo ${MINIMO_DE_HORAS} horas.`;
  return `MUDANÇA — À HORA, AO PREÇO DE CADA PARCEIRO (valores sem IVA, o que o cliente paga):
  ${hora}
  O cliente vê no simulador os parceiros disponíveis (nota, preço por hora, equipa de 2 ou 3, material) e escolhe; nunca prometas um preço fixo.
  HORAS ESTIMADAS PELA TIPOLOGIA (equipa de ${PESSOAS_NA_EQUIPA}): ${(Object.keys(HORAS_POR_TIPOLOGIA) as Tipologia[])
    .map((t) => `${TIPOLOGIA_POR_EXTENSO[t]} ${HORAS_POR_TIPOLOGIA[t]}h`)
    .join(" · ")} · desmontagem/montagem +${HORAS_A_MAIS_COM_DESMONTAGEM}h.
  Deslocação (referência): ${DESLOCACAO_DA_MUDANCA_PARA_O_MODELO}.
  Cada andar sem elevador (referência): ${POR_ANDAR_SEM_ELEVADOR_POR_PESSOA} € por pessoa (${POR_ANDAR_SEM_ELEVADOR} € a equipa de ${PESSOAS_NA_EQUIPA}).
  Elevador exterior (referência): ${ELEVADOR_EXTERIOR} € por serviço. Materiais de embalamento: os do parceiro.
  O total sai das horas, dos km e do material confirmados na folha do dia; isto é só a estimativa.`;
}
