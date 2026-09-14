/**
 * O QUE O PROFISSIONAL GANHOU, E QUE SE VÊ NO PERFIL DELE.
 *
 * "Quero que deixe esse perfil mais pro, com coisas legais para eles. Caso
 * tenha nota 5, eles devem ganhar uma coroa no topo do perfil." — 14-09-2026.
 *
 * O perfil dele era um formulário: nome, telefone, morada, email, Guardar.
 * Nada que ele quisesse abrir duas vezes. Isto é a outra metade — o que ele
 * construiu, dito por números que já existem.
 *
 * A REGRA DA COROA, e porque não basta ter «nota 5».
 *
 * Um profissional com UMA avaliação de cinco estrelas tem média 5,0. Dar-lhe a
 * coroa por isso faz duas coisas más: dá-a a quem ainda não fez nada, e tira o
 * valor a quem a tem por trinta trabalhos seguidos. No dia em que metade dos
 * profissionais tiver coroa, a coroa deixa de ser vista.
 *
 * Por isso são precisas TRÊS avaliações e média cheia. Três é o número a que
 * um acaso deixa de explicar o resultado, e é atingível numa semana de trabalho
 * bem feito — não é um troféu inalcançável, é um patamar.
 *
 * E PERDE-SE. Uma avaliação de quatro estrelas tira a coroa, porque a média
 * deixa de ser 5,0. É isso que a faz valer alguma coisa.
 *
 * FICHEIRO PURO: recebe números e devolve distinções. Sem base e sem rede,
 * para os testes poderem percorrer os casos de fronteira — que aqui são o que
 * interessa.
 */

export type Distincao = "coroa" | "estreante" | "veterano" | "caminho_da_coroa";

export type FichaDaDistincao = {
  /** O emblema. Um caractere, porque vai ao lado do nome. */
  simbolo: string;
  titulo: string;
  /** Uma linha que diz COMO se ganhou. Um emblema sem regra é decoração. */
  porque: string;
};

/** A média cheia. Nada abaixo disto dá coroa. */
export const MEDIA_DA_COROA = 5;

/**
 * Quantas avaliações são precisas para a coroa contar.
 *
 * Com uma só, a média é o acaso de um cliente bem-disposto. Ver o cabeçalho.
 */
export const AVALIACOES_PARA_A_COROA = 3;

/** A partir daqui é veterano. Não é sobre notas — é sobre quilómetros. */
export const TRABALHOS_PARA_VETERANO = 25;

export const FICHA_DA_DISTINCAO: Record<Distincao, FichaDaDistincao> = {
  coroa: {
    simbolo: "👑",
    titulo: "Nota máxima",
    porque: `5,0 de média em ${AVALIACOES_PARA_A_COROA} avaliações ou mais. Perde-se com a primeira abaixo de 5.`,
  },
  caminho_da_coroa: {
    simbolo: "✨",
    titulo: "A caminho da coroa",
    porque: `Está em 5,0. Faltam avaliações para chegar às ${AVALIACOES_PARA_A_COROA}.`,
  },
  veterano: {
    simbolo: "🛠️",
    titulo: "Veterano",
    porque: `${TRABALHOS_PARA_VETERANO} trabalhos concluídos pela CLYON.`,
  },
  estreante: {
    simbolo: "🌱",
    titulo: "Começou agora",
    porque: "Ainda sem avaliações. A primeira chega no fim do primeiro trabalho.",
  },
};

export type ContaDoPerfil = {
  /** A média das estrelas, ou null se ainda não tem nenhuma. */
  media: number | null;
  /** Quantas avaliações recebeu. */
  quantasAvaliacoes: number;
  /** Trabalhos que chegaram ao fim. */
  trabalhosConcluidos: number;
};

/** Tem coroa? É a pergunta que o topo do perfil faz. */
export function temCoroa(c: ContaDoPerfil): boolean {
  return (
    c.quantasAvaliacoes >= AVALIACOES_PARA_A_COROA &&
    c.media != null &&
    c.media >= MEDIA_DA_COROA
  );
}

/**
 * Quantas avaliações de cinco estrelas faltam para a coroa.
 *
 * Zero quando já a tem. NULL quando a média já caiu abaixo de 5 — aí não é
 * uma questão de quantidade, e dizer «faltam duas» seria mentira: com uma
 * nota de 4 lá dentro, mais cinco-estrelas nunca devolvem a média a 5,0.
 */
export function quantasFaltamParaACoroa(c: ContaDoPerfil): number | null {
  if (temCoroa(c)) return 0;
  if (c.media != null && c.media < MEDIA_DA_COROA) return null;
  return AVALIACOES_PARA_A_COROA - c.quantasAvaliacoes;
}

/**
 * As distinções deste profissional, para mostrar por esta ordem.
 *
 * A coroa e o «a caminho» excluem-se: são o mesmo caminho em dois pontos.
 */
export function distincoesDe(c: ContaDoPerfil): Distincao[] {
  const d: Distincao[] = [];
  if (temCoroa(c)) d.push("coroa");
  else if (c.quantasAvaliacoes === 0) d.push("estreante");
  else if (c.media != null && c.media >= MEDIA_DA_COROA) d.push("caminho_da_coroa");

  if (c.trabalhosConcluidos >= TRABALHOS_PARA_VETERANO) d.push("veterano");
  return d;
}

/** «5,0» e não «5». O zero à direita é o que faz a média parecer medida. */
export function mediaEmPalavras(media: number | null): string {
  if (media == null) return "—";
  return media.toFixed(1).replace(".", ",");
}

/** «3 avaliações», «1 avaliação», «sem avaliações». */
export function avaliacoesEmPalavras(quantas: number): string {
  if (quantas <= 0) return "sem avaliações";
  return `${quantas} ${quantas === 1 ? "avaliação" : "avaliações"}`;
}
