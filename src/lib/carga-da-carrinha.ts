/**
 * UMA CARGA NÃO É A MESMA COISA EM TODAS AS CARRINHAS.
 *
 * "Os profissionais devem responder se a carrinha deles é pequena, média ou
 * grande, e vamos usar essa informação para dizer o valor por carga exclusivo
 * para a conta dele. Se colocarmos o valor de partida de 350 por carga, o
 * sistema deve entender que me refiro a carga grande: logo, os que têm
 * carrinha pequena devem ver 150 por carga, mais ou menos 2 cargas e meia para
 * recolher tudo; para a carrinha média, 250, mais ou menos 1 carga e meia."
 * — 29-09-2026.
 *
 * O PROBLEMA QUE ISTO RESOLVE. «350 € por carga» é um preço sem unidade
 * enquanto não se souber o tamanho da carga. O mesmo monte de entulho são uma
 * viagem numa Sprinter e duas e meia numa Kangoo — e se os dois lerem o mesmo
 * número, um deles está a fazer contas erradas. Quem tem a carrinha pequena
 * aceita 350 por carga a pensar que faz o trabalho numa viagem, e no fim faz
 * três.
 *
 * O VALOR QUE A CLYON ESCREVE É O DA CARRINHA GRANDE. É a referência, e é
 * deliberado: é o preço de fazer o trabalho na menor quantidade de viagens.
 * Daí para baixo, cada carrinha vê o seu.
 *
 * NÃO É UM DESCONTO. Quem tem a carrinha pequena não ganha menos pelo mesmo
 * trabalho: ganha menos POR VIAGEM e faz mais viagens. O total anda à volta do
 * mesmo — e a conta de quantas viagens, que é a parte que ninguém faz de
 * cabeça, passa a estar escrita ao lado do número.
 */

/**
 * A LISTA DOS VEÍCULOS NÃO VIVE AQUI — vive em `convite-profissional.ts`.
 *
 * Cheguei a escrever aqui uma quinta cópia dela, com cinco entradas. A
 * canónica tem SETE: faltavam-lhe o `camiao_grua` e o `varios`, e o efeito
 * de validar contra a cópia curta era um profissional com camião-grua a não
 * conseguir gravar o próprio perfil. Fica registado porque é o erro que uma
 * lista duplicada sempre faz: não dá erro no dia em que se escreve.
 */
import { TIPOS_DE_VEICULO } from "./convite-profissional";
/*
 * O FORMATADOR DA CASA, e nao um novo.
 *
 * Escrevi aqui um `toLocaleString("pt-PT")`, que depende do ICU completo
 * estar no Node do servidor -- e onde nao esta, «150,00 €» sai «150.00 €»
 * com ponto. O `euros()` da mesa nao depende de nada: e um `toFixed` com a
 * virgula posta a mao, de proposito, e e o mesmo numero que o painel ja
 * mostra ao lado deste. Dois formatadores no mesmo cartao dariam duas
 * maneiras de escrever dinheiro na mesma linha.
 */
import { euros } from "./texto-da-mesa";

/** O que o profissional declara ter. São os valores que já viviam na coluna. */
export type TamanhoDaCarrinha = "pequena" | "media" | "grande";

/**
 * QUANTO CABE EM CADA UMA, EM PARTES.
 *
 * Três, cinco e sete. Não é uma medida em metros cúbicos — é a proporção que
 * reproduz exactamente os números que ele deu, e é por isso que está escrita
 * assim em vez de em decimais que ninguém reconheceria:
 *
 *   350 × 3/7 = 150,00      350 × 5/7 = 250,00      350 × 7/7 = 350,00
 *
 * E as viagens saem da mesma proporção, ao contrário: 7/3 = 2,33 e 7/5 = 1,4,
 * que arredondados para cima à meia carga dão as «duas e meia» e a «uma e
 * meia» que ele escreveu.
 *
 * ⚠️ NÃO É A PROPORÇÃO DOS METROS CÚBICOS, e é de propósito. As etiquetas
 * da lista dizem «até 3 m³», «3 a 8 m³» e «8 a 15 m³», o que daria uns
 * 2 : 5,5 : 11,5 — e nessa proporção a carrinha pequena veria 61 € por
 * carga, não 150. Os números são os que o dono deu, e o que eles medem não
 * é volume: é o que um profissional aceita por uma viagem, que tem uma
 * parte fixa (sair, descarregar, pagar o aterro) que não encolhe com a
 * carrinha. Quem vier aqui «corrigir» isto pelos metros cúbicos corta 60 %
 * ao valor por viagem de quem tem a carrinha pequena.
 *
 * Se um dia se quiser afinar, muda-se aqui e mais nada — os ecrãs não
 * sabem estes números.
 */
export const PARTES_QUE_CABEM: Record<TamanhoDaCarrinha, number> = {
  pequena: 3,
  media: 5,
  grande: 7,
};

/** A carrinha a que o valor escrito pela CLYON se refere. */
export const CARRINHA_DE_REFERENCIA: TamanhoDaCarrinha = "grande";

const PARTES_DA_REFERENCIA = PARTES_QUE_CABEM[CARRINHA_DE_REFERENCIA];

/**
 * O tamanho, lido da coluna `providers.tipoVeiculo`.
 *
 * A coluna é um `VARCHAR(60)` que já existia e que guarda `carrinha_pequena`,
 * `carrinha_media`, `carrinha_grande`, `camiao` ou `sem_veiculo` — a lista do
 * formulário de candidatura.
 *
 * ⚠️ O CAMIÃO CONTA COMO GRANDE, e não como mais do que isso. Cabe-lhe mais,
 * é verdade, mas o valor que a CLYON escreve é o de uma carga grande: dar ao
 * camião um valor POR CARGA maior do que o escrito seria cobrar ao cliente
 * acima do que foi combinado. Ele ganha na mesma — faz o trabalho em menos
 * viagens do que qualquer outro.
 *
 * E devolve `null` para tudo o resto, incluindo quem não declarou nada. Sem
 * saber o tamanho não se inventa nenhum: mostra-se o valor como está escrito,
 * que é o comportamento de sempre.
 */
const TAMANHO_POR_VEICULO: Record<string, TamanhoDaCarrinha> = {
  carrinha_pequena: "pequena",
  carrinha_media: "media",
  carrinha_grande: "grande",
  /*
   * O CAMIÃO, O CAMIÃO-GRUA E O «VÁRIOS VEÍCULOS» CONTAM COMO GRANDE, e nunca
   * como mais do que isso.
   *
   * Cabe-lhes mais, é verdade, mas o valor que a CLYON escreve É o de uma
   * carga grande: dar-lhes um valor POR CARGA maior do que o escrito seria
   * cobrar ao cliente acima do combinado. Ganham na mesma — fazem o trabalho
   * em menos viagens do que qualquer outro.
   *
   * Quem declara «vários veículos» tem o grande entre eles, e é com ele que
   * faz o trabalho que se paga por carga.
   */
  camiao: "grande",
  camiao_grua: "grande",
  varios: "grande",
  /*
   * O `sem_veiculo` está de fora de propósito, e não por esquecimento: quem
   * não tem viatura não tem carga, e mostrar-lhe um valor por carga «da sua
   * carrinha» seria inventar-lhe uma. Cai no `null`, como quem não declarou
   * nada, e vê o valor tal como está escrito.
   */
};

/*
 * A PROVA DE QUE ESTE MAPA NÃO FICA ATRÁS DA LISTA.
 *
 * Um veículo novo em `TIPOS_DE_VEICULO` que aqui não entre não dá erro
 * nenhum: dá um profissional a ver o valor da carrinha grande em silêncio. O
 * teste deste ficheiro percorre a lista canónica e obriga cada entrada a
 * estar decidida aqui — ou como um tamanho, ou explicitamente sem nenhum.
 */
export const VEICULOS_SEM_CARGA: readonly string[] = ["sem_veiculo"];

/** Todos os ids que a lista canónica conhece, para o teste os percorrer. */
export const IDS_DE_VEICULO: readonly string[] = TIPOS_DE_VEICULO.map((v) => v.id);

/**
 * O tamanho, lido da coluna `providers.tipoVeiculo`.
 *
 * A coluna é um `VARCHAR(60)` que já existia e que guarda um dos ids de
 * `TIPOS_DE_VEICULO`.
 *
 * Devolve `null` para tudo o que não esteja no mapa, incluindo quem não
 * declarou nada. Sem saber o tamanho não se inventa nenhum: mostra-se o valor
 * como está escrito, que é o comportamento de sempre.
 */
export function tamanhoDaCarrinha(tipoVeiculo: unknown): TamanhoDaCarrinha | null {
  if (typeof tipoVeiculo !== "string") return null;
  return TAMANHO_POR_VEICULO[tipoVeiculo.trim().toLowerCase()] ?? null;
}

/** O que a CLYON escreveu, visto pela carrinha dele. Arredondado ao cêntimo. */
export function porCargaNesta(valorDaReferencia: number, tamanho: TamanhoDaCarrinha): number {
  const v = (valorDaReferencia * PARTES_QUE_CABEM[tamanho]) / PARTES_DA_REFERENCIA;
  return Math.round(v * 100) / 100;
}

/**
 * Quantas viagens, arredondadas PARA CIMA à meia carga.
 *
 * Para cima porque meia viagem não existe do lado de quem conduz: quem precisa
 * de 2,33 cargas faz três. O meio serve para dizer que a última vai a meio, que
 * é informação verdadeira e útil — e é a palavra que ele próprio usou.
 *
 * Nunca menos de uma: o trabalho mais pequeno do mundo é uma viagem.
 */
export function quantasCargas(tamanho: TamanhoDaCarrinha): number {
  const bruto = PARTES_DA_REFERENCIA / PARTES_QUE_CABEM[tamanho];
  return Math.max(1, Math.ceil(bruto * 2) / 2);
}

/** «2 cargas e meia», «1 carga e meia», «1 carga». */
export function cargasPorExtenso(tamanho: TamanhoDaCarrinha): string {
  const n = quantasCargas(tamanho);
  const inteiras = Math.floor(n);
  const meia = n - inteiras >= 0.5;
  // O nome concorda com a PARTE INTEIRA: «uma carga e meia», «duas cargas e
  // meia». Escrever «1 cargas e meia» é o tipo de erro que faz quem lê
  // desconfiar do número que está ao lado.
  const nome = inteiras === 1 ? "carga" : "cargas";
  if (!meia) return `${inteiras} ${nome}`;
  return inteiras === 0 ? "meia carga" : `${inteiras} ${nome} e meia`;
}

export type CargaParaEste = {
  tamanho: TamanhoDaCarrinha;
  /** O valor por carga que ELE vê. */
  porCarga: number;
  /** Quantas viagens, em número. */
  cargas: number;
  /** «2 cargas e meia». */
  cargasEmPalavras: string;
  /** O valor está mudado face ao que a CLYON escreveu? */
  diferente: boolean;
};

/**
 * A conta inteira para um profissional, ou `null` quando não se aplica.
 *
 * Devolve `null` — e não um valor igual ao escrito — em três casos, porque são
 * três razões diferentes para não mostrar nada de novo: o pedido não é por
 * carga, não há valor nenhum, ou não se sabe que carrinha ele tem. Quem chama
 * mostra o número como sempre mostrou.
 */
export function cargaParaEste(
  valorDaReferencia: number | null | undefined,
  tipoVeiculo: unknown,
): CargaParaEste | null {
  const tamanho = tamanhoDaCarrinha(tipoVeiculo);
  if (!tamanho) return null;
  if (typeof valorDaReferencia !== "number" || !Number.isFinite(valorDaReferencia)) return null;
  if (valorDaReferencia <= 0) return null;

  const porCarga = porCargaNesta(valorDaReferencia, tamanho);
  return {
    tamanho,
    porCarga,
    cargas: quantasCargas(tamanho),
    cargasEmPalavras: cargasPorExtenso(tamanho),
    diferente: porCarga !== Math.round(valorDaReferencia * 100) / 100,
  };
}

/** Como se chama cada uma num ecrã. */
export const NOME_DO_TAMANHO: Record<TamanhoDaCarrinha, string> = {
  pequena: "carrinha pequena",
  media: "carrinha média",
  grande: "carrinha grande",
};

/**
 * ⚠️ ISTO NÃO MUDA O VALOR QUE ELE ACEITA. É a parte mais importante deste
 * ficheiro, e a que se perde primeiro.
 *
 * Verificado a 29-09-2026: NENHUM sítio do sistema multiplica o valor pelo
 * número de cargas. O `baseDoPreco: "carga"` é uma etiqueta — os dois acertam
 * as cargas entre si, e a plataforma cobra o `valorAcordado` tal e qual.
 *
 * Por isso o valor ajustado é o que ele precisa de saber para DECIDIR, e não o
 * que entra no acordo. Se entrasse, um profissional de carrinha pequena
 * aceitava 150 € e fazia duas viagens e meia por 150 € — o contrário exacto do
 * que isto serve para evitar.
 *
 * Para o ajustado passar a ser o valor acordado, o número de cargas tem de
 * viajar COM o acordo: uma coluna na negociação, a mesa a mostrá-la, a página
 * do cliente a dizer «150 € × 2,5», e a factura a bater com isso. É uma
 * decisão do dono, não uma que se tire por dedução de um ecrã.
 */

/** O que o ecrã diz a quem tem esta carrinha, num pedido pago por carga. */
export type FraseDaCarga = {
  /** «Na sua carrinha pequena» — o título do bloco. */
  titulo: string;
  /** A frase inteira, já com os dois números. */
  texto: string;
  /** Curto, para caber ao lado do número no cartão: «~150 €/carga · 2 cargas e meia». */
  curto: string;
};

/**
 * A FRASE, com os números dele.
 *
 * Devolve `null` para a carrinha grande — que é a referência — porque não há
 * nada a dizer-lhe: o valor escrito já é o dele, e uma linha a explicar que
 * nada muda é ruído em cima do número mais importante do cartão.
 */
export function fraseDaCarga(carga: CargaParaEste | null): FraseDaCarga | null {
  if (!carga || !carga.diferente) return null;
  return {
    titulo: `Na sua ${NOME_DO_TAMANHO[carga.tamanho]}`,
    texto:
      `O valor escrito é para uma carga de carrinha grande — uma viagem. Na sua, ` +
      `o mesmo trabalho leva cerca de ${carga.cargasEmPalavras}, o que dá ` +
      `${euros(carga.porCarga)} por carga. Combine as cargas com o cliente antes de fechar.`,
    curto: `~${euros(carga.porCarga)}/carga · ${carga.cargasEmPalavras}`,
  };
}
