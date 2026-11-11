import {
  aoCliente,
  cartaoDoParceiro,
  faixaEmTexto,
  porqueFicaDeFora,
  type CandidatoDaMudanca,
  type ContextoDaMudanca,
} from "./lista-de-parceiros-da-mudanca";
import { REGRAS_DAS_MUDANCAS, type TarifaDasMudancas } from "./conta-da-mudanca";
import { TAXA_IVA } from "./taxas-plataforma";
import {
  DESLOCACAO_DA_MUDANCA_PARA_O_MODELO,
  ELEVADOR_EXTERIOR,
  MINIMO_DE_HORAS,
  NOTA_DO_T4_OU_MAIOR,
  PESSOAS_NA_EQUIPA,
  POR_ANDAR_SEM_ELEVADOR,
  POR_ANDAR_SEM_ELEVADOR_POR_PESSOA,
  PRECO_POR_HORA,
  HORAS_COM_TRES_PESSOAS,
  TIPOLOGIA_POR_EXTENSO,
  desmontagemPorTipologiaEmTexto,
  horasEscritas,
  horasPorTipologiaEmTexto,
  intervaloDeHorasCurto,
  intervaloDeHorasEmTexto,
  type Tipologia,
} from "./tabela-das-mudancas";

/** «com 3 pessoas, um T1 leva entre 4 e 5 h, um T2 entre 5 e 7 h e um T3 entre 7 e 9 h» — da tabela. */
export const HORAS_DA_MUDANCA_NUMA_FRASE =
  `com 3 pessoas, um T1 leva ${intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS.T1)}, um T2 ${intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS.T2)} ` +
  `e um T3 ${intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS.T3)} (um T3 ou maior faz-se só com 3 pessoas)`;

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

/**
 * UM EXEMPLO PELA LISTA — 11-11-2026 (d7). Uma casa, contada com a tarifa do
 * parceiro que a faz mais barata hoje: as horas da tipologia (nunca abaixo do
 * mínimo dele), a proteção que ele fornece e os km mínimos que ele cobra. É a
 * conta do cartão da lista (`cartaoDoParceiro`), sem andares e sem distância.
 */
export type ExemploDaMudanca = {
  tipologia: Tipologia;
  /** A equipa da conta: 2, ou 3 numa casa que só se faz com 3. */
  pessoas: 2 | 3;
  horas: [minimo: number, maximo: number];
  /** A estimativa nos dois extremos das horas, como o cliente a paga. */
  minimo: ValorDaHora;
  maximo: ValorDaHora;
  /** Se a conta leva o material de proteção (há parceiros que não o fornecem). */
  comProtecao: boolean;
};

export type PrecoPublicoDasMudancas =
  | {
      tipo: "parceiros";
      parceiros: number;
      /** O preço da hora mais baixo com 2 pessoas. */
      desde: ValorDaHora;
      /** O mais baixo com 3 pessoas (11-11-2026: T3 e T4+ só com 3); ausente se nenhum faz com 3. */
      desde3?: ValorDaHora;
      /** O mínimo de horas dos parceiros da lista: o mais baixo e o mais alto (d7). */
      minimoHoras?: { de: number; ate: number };
      /** Um exemplo por tipologia, pelo parceiro mais barato de cada uma (d7). */
      exemplos?: ExemploDaMudanca[];
    }
  | { tipo: "referencia" };

/** As casas dos exemplos: duas que se fazem com 2 pessoas e uma que só se faz com 3. */
export const TIPOLOGIAS_DOS_EXEMPLOS: readonly Tipologia[] = Object.freeze(["T1", "T2", "T3"] as Tipologia[]);

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
  let menor3: number | null = null;
  let quantos = 0;
  const naLista: Array<CandidatoDaMudanca & { tarifa: TarifaDasMudancas }> = [];
  for (const c of candidatos) {
    if (!c.tarifa || porqueFicaDeFora(c, 0, ctx) !== null) continue;
    const cent = Math.round(Number(c.tarifa.precoHora2) * 100);
    if (!Number.isFinite(cent) || cent <= 0) continue;
    quantos += 1;
    naLista.push(c as CandidatoDaMudanca & { tarifa: TarifaDasMudancas });
    if (menor == null || cent < menor) menor = cent;
    const cent3 = c.tarifa.precoHora3 == null ? NaN : Math.round(Number(c.tarifa.precoHora3) * 100);
    if (Number.isFinite(cent3) && cent3 > 0 && (menor3 == null || cent3 < menor3)) menor3 = cent3;
  }
  if (menor == null) return SEM_PARCEIROS;
  const v = aoCliente(menor, REGRAS_DAS_MUDANCAS, true);
  const p: PrecoPublicoDasMudancas = { tipo: "parceiros", parceiros: quantos, desde: { semIvaCent: v.semIvaCent, comIvaCent: v.comIvaCent } };
  if (menor3 != null) {
    const v3 = aoCliente(menor3, REGRAS_DAS_MUDANCAS, true);
    p.desde3 = { semIvaCent: v3.semIvaCent, comIvaCent: v3.comIvaCent };
  }
  const minimos = naLista.map((c) => Number(c.tarifa.minimoHoras)).filter((h) => Number.isFinite(h) && h > 0);
  if (minimos.length > 0) p.minimoHoras = { de: Math.min(...minimos), ate: Math.max(...minimos) };
  const exemplos = exemplosDaLista(naLista, ctx);
  if (exemplos.length > 0) p.exemplos = exemplos;
  return p;
}

/**
 * OS EXEMPLOS DA LISTA — 11-11-2026 (d7). Para cada casa de
 * `TIPOLOGIAS_DOS_EXEMPLOS`, o cartão de cada parceiro que a faz (a conta da
 * lista, com a proteção e os km mínimos dele), e fica o mais barato ao meio do
 * intervalo. Pura: quem fala de preço (a Vitória, o aviso ao modelo) lê daqui
 * e não faz contas.
 */
export function exemplosDaLista(
  naLista: ReadonlyArray<CandidatoDaMudanca & { tarifa: TarifaDasMudancas }>,
  base: ContextoDaMudanca,
): ExemploDaMudanca[] {
  const exemplos: ExemploDaMudanca[] = [];
  for (const tipologia of TIPOLOGIAS_DOS_EXEMPLOS) {
    const c = { ...base, tipologia };
    let melhor: ExemploDaMudanca | null = null;
    let meio = Infinity;
    for (const parceiro of naLista) {
      if (porqueFicaDeFora(parceiro, 0, c) !== null) continue;
      const cartao = cartaoDoParceiro(parceiro, c, "exemplo");
      if (!cartao || !(cartao.estimativa.comIvaCent < meio)) continue;
      meio = cartao.estimativa.comIvaCent;
      melhor = {
        tipologia,
        pessoas: cartao.pessoas,
        horas: [cartao.horasMinimo, cartao.horasMaximo],
        minimo: { semIvaCent: cartao.estimativa.minimo.semIvaCent, comIvaCent: cartao.estimativa.minimo.comIvaCent },
        maximo: { semIvaCent: cartao.estimativa.maximo.semIvaCent, comIvaCent: cartao.estimativa.maximo.comIvaCent },
        comProtecao: cartao.protecao.linhas.length > 0,
      };
    }
    if (melhor) exemplos.push(melhor);
  }
  return exemplos;
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

/* ── A VITÓRIA E O AVISO AO MODELO — pela lista (d7, 11-11-2026) ────────────
 *
 * Os dois diziam a hora, a equipa e o mínimo da tabela de referência como se
 * fossem um preço da CLYON, mesmo com parceiros na lista («Para estimar usa a
 * referência…»). Decisão do CEO, aprovada pelo dono:
 *   · cada parceiro tem o seu preço por hora (2 e 3 pessoas) e o seu mínimo;
 *   · com parceiros na lista, estima-se pelo «desde» da lista (2 e 3) e com
 *     um exemplo por tipologia que leva a proteção e os km;
 *   · com a lista vazia, só a referência publicada, dita como referência;
 *   · o mínimo da referência só na referência: com tarifa, é o do parceiro.
 */

/** «entre 2 e 3 horas», ou «2 horas» quando todos têm o mesmo. */
function minimoDosParceirosEmTexto(m: { de: number; ate: number }): string {
  const horas = (h: number) => `${horasEscritas(h)} ${h === 1 ? "hora" : "horas"}`;
  return m.de === m.ate ? horas(m.de) : `entre ${horasEscritas(m.de)} e ${horas(m.ate)}`;
}

/** «desde 40,00 € + IVA/h (49,20 € com IVA) com 2 pessoas e desde 55,00 € + IVA/h (67,65 € com IVA) com 3». */
export function desdeDaListaEmTexto(p: Extract<PrecoPublicoDasMudancas, { tipo: "parceiros" }>): string {
  const um = (v: ValorDaHora) => `desde ${euros(v.semIvaCent)} + IVA/h (${euros(v.comIvaCent)} com IVA)`;
  return `${um(p.desde)} com 2 pessoas${p.desde3 ? ` e ${um(p.desde3)} com 3` : ""}`;
}

/** «um T2 com 2 pessoas (entre 6,5 e 9 h), 381–504 € com IVA (310–410 € sem IVA)». */
export function exemploDaListaEmTexto(e: ExemploDaMudanca): string {
  const casa = e.tipologia === "itens" ? TIPOLOGIA_POR_EXTENSO.itens : `um ${TIPOLOGIA_POR_EXTENSO[e.tipologia]}`;
  return `${casa} com ${e.pessoas} pessoas (${intervaloDeHorasEmTexto(e.horas)}), ${faixaEmTexto(e.minimo, e.maximo)}`;
}

/** A referência, dita como referência: «na referência, são … + IVA por hora (… com IVA), equipa de 3, mínimo de 3 horas». */
export const NA_REFERENCIA_DA_MUDANCA = REFERENCIA_DA_MUDANCA.replace(/^referência: /, "na referência, são ");

/** O que a Vitória diz a quem pergunta o preço de uma mudança. */
export function precoDaMudancaNoWhatsApp(p: PrecoPublicoDasMudancas): string {
  const fecho =
    "No simulador de mudanças (clyon.pt/simulador?servico=mudanca) vê os parceiros disponíveis, " +
    "com a nota, o preço por hora, a equipa de 2 ou 3 e o material, e escolhe; o valor final sai das horas, " +
    "dos km e do material confirmados na folha do dia.";
  if (p.tipo !== "parceiros") {
    return (
      `Nas mudanças, cada parceiro tem o seu preço por hora e o seu mínimo de horas; ${NA_REFERENCIA_DA_MUDANCA}. ` +
      `As horas dependem da casa: ${HORAS_DA_MUDANCA_NUMA_FRASE}. ${fecho}`
    );
  }
  const minimo = p.minimoHoras ? ` (hoje, ${minimoDosParceirosEmTexto(p.minimoHoras)})` : "";
  const abre = `Nas mudanças, cada parceiro tem o seu preço por hora e o seu mínimo de horas${minimo}: ${desdeDaListaEmTexto(p)}.`;
  const exemplos = p.exemplos ?? [];
  const meio =
    exemplos.length > 0
      ? `Por exemplo, pelo parceiro com o preço mais baixo, ${exemplos.every((e) => e.comProtecao) ? "já com a proteção e os km" : "já com os km"}: ${exemplos.map(exemploDaListaEmTexto).join("; ")}.`
      : `As horas dependem da casa: ${HORAS_DA_MUDANCA_NUMA_FRASE}.`;
  return `${abre} ${meio} ${fecho}`;
}

/**
 * A HORA OU O MÍNIMO DA REFERÊNCIA, ESCRITOS NUM TEXTO — para os testes (a
 * conversa da mudança e a regra y da orquestra). Apanha a hora da tabela de
 * referência, sem ou com IVA («NN €/h», «NN,00 € + IVA por hora», «NN € s/IVA
 * por hora», «NN €/hora») e o «mínimo (de) N horas» dela. Quem os diz tem de
 * dizer «referência» na mesma frase; com parceiros na lista, ninguém os diz.
 */
export function dizAHoraOuOMinimoDaReferencia(texto: string): boolean {
  const n = (v: number) => (Number.isInteger(v) ? `${v}(?:,00)?` : v.toFixed(2).replace(".", ","));
  const hora = new RegExp(
    String.raw`(?<![\d,.])(?:${n(PRECO_POR_HORA)}|${n(REF_COM_IVA_CENT / 100)}) ?€ ?(?:\+ ?IVA ?|s\/IVA ?|sem IVA ?|com IVA ?)?(?:\/ ?h(?:ora)?(?![a-zà-ú])|por hora)`,
    "i",
  );
  const minimo = new RegExp(String.raw`m[íi]nimo (?:de )?${MINIMO_DE_HORAS} ?h(?:oras)?(?![a-zà-ú])`, "i");
  return hora.test(texto) || minimo.test(texto);
}

/**
 * O mínimo de uma mudança, para o modelo: com tarifa, o do parceiro; sem
 * parceiros na lista, o da tabela de referência, dito como referência.
 */
export function minimoDaMudancaParaOModelo(p: PrecoPublicoDasMudancas): string {
  if (p.tipo === "parceiros") return "o mínimo de horas é o da tarifa de cada parceiro";
  return `o mínimo de horas é o de cada parceiro; na referência (sem parceiros na lista), ${numero(REF_SEM_IVA_CENT * MINIMO_DE_HORAS)} € s/IVA (${numero(REF_COM_IVA_CENT * MINIMO_DE_HORAS)} € c/IVA): ${MINIMO_DE_HORAS} h × ${PRECO_POR_HORA} €/h`;
}

/** Os euros que a lista de hoje dá (o «desde» de 2 e de 3 e os exemplos), para quem confere números. */
export function eurosDaLista(p: PrecoPublicoDasMudancas): number[] {
  if (p.tipo !== "parceiros") return [];
  const cent = [p.desde, ...(p.desde3 ? [p.desde3] : []), ...(p.exemplos ?? []).flatMap((e) => [e.minimo, e.maximo])].flatMap((v) => [
    v.semIvaCent,
    v.comIvaCent,
  ]);
  // Ao cêntimo e ao euro: os exemplos escrevem-se ao euro (`faixaEmTexto`).
  return [...new Set(cent.flatMap((c) => [c / 100, Math.round(c / 100)]))];
}

/** As regras, para o aviso ao modelo que estima. */
export function regrasDaMudancaParaOModelo(p: PrecoPublicoDasMudancas): string {
  let hora: string;
  let deslocacao: string;
  if (p.tipo === "parceiros") {
    const exemplos = (p.exemplos ?? [])
      .map(
        (e) =>
          `${TIPOLOGIA_POR_EXTENSO[e.tipologia]}, ${e.pessoas} pessoas, ${intervaloDeHorasCurto(e.horas)}${e.comProtecao ? ", com a proteção" : ""}: ${faixaEmTexto(e.minimo, e.maximo)}`,
      )
      .join(" | ");
    hora =
      `Preço por hora e mínimo de horas de CADA PARCEIRO (a tarifa dele). O mais baixo hoje, com 2 pessoas: ${numero(p.desde.semIvaCent)} €/hora` +
      (p.desde3 ? `; com 3 pessoas: ${numero(p.desde3.semIvaCent)} €/hora` : "") +
      "." +
      (p.minimoHoras
        ? ` O mínimo de horas é o de cada parceiro (na lista de hoje: ${minimoDosParceirosEmTexto(p.minimoHoras)}).`
        : " O mínimo de horas é o de cada parceiro.") +
      `
  ESTIMA PELO «DESDE» DA LISTA: as horas da tipologia × o preço por hora mais baixo da equipa (2 ou 3 pessoas), nunca abaixo do mínimo de horas do parceiro, mais a proteção e os km da tarifa dele. Diz sempre «desde» e que depende do parceiro que o cliente escolher.` +
      (exemplos
        ? `
  EXEMPLOS DE HOJE (o parceiro com o preço mais baixo, com os km mínimos dele): ${exemplos}.`
        : "");
    deslocacao = `Deslocação: os km são os da tarifa de cada parceiro (o preço por km e os km mínimos dele). Na referência: ${DESLOCACAO_DA_MUDANCA_PARA_O_MODELO}.`;
  } else {
    hora = `Sem parceiros na lista não há preço por hora para prometer: estima só pela REFERÊNCIA publicada — ${PRECO_POR_HORA} €/hora (equipa de ${PESSOAS_NA_EQUIPA}), mínimo de ${MINIMO_DE_HORAS} horas da referência — e di-la sempre como referência («na referência…»), nunca como o preço da CLYON nem de um parceiro.`;
    deslocacao = `Deslocação (referência): ${DESLOCACAO_DA_MUDANCA_PARA_O_MODELO}.`;
  }
  return `MUDANÇA — À HORA, AO PREÇO DE CADA PARCEIRO (valores sem IVA, o que o cliente paga):
  ${hora}
  O cliente vê no simulador os parceiros disponíveis (nota, preço por hora, equipa de 2 ou 3, material) e escolhe; nunca prometas um preço fixo.
  HORAS ESTIMADAS PELA TIPOLOGIA, SEMPRE EM INTERVALO (diz «entre X e Y horas», nunca um número só):
    equipa de 3: ${horasPorTipologiaEmTexto(3)};
    equipa de 2: ${horasPorTipologiaEmTexto(2)} — T3 e T4+ só com 3 pessoas. ${NOTA_DO_T4_OU_MAIOR}
    Desmontagem/montagem soma aos dois extremos: ${desmontagemPorTipologiaEmTexto()}.
  Material: a proteção (filme, cartão, plástico bolha) entra na estimativa; as caixas e o embalamento completo só se o cliente os pedir.
  ${deslocacao}
  Cada andar sem elevador (referência): ${POR_ANDAR_SEM_ELEVADOR_POR_PESSOA} € por pessoa (${POR_ANDAR_SEM_ELEVADOR} € a equipa de ${PESSOAS_NA_EQUIPA}).
  Elevador exterior (referência): ${ELEVADOR_EXTERIOR} € por serviço. Materiais de embalamento: os do parceiro.
  O total sai das horas, dos km e do material confirmados na folha do dia; isto é só a estimativa.`;
}
