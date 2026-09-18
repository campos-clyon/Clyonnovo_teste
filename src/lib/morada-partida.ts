/**
 * O CÓDIGO POSTAL QUE VEM DENTRO DA MORADA.
 *
 * *«Os dados do cliente, mesmo vindo com o código postal no endereço, ele não
 * vem no campo "Código postal".»* — 18-09-2026.
 *
 * As pessoas escrevem a morada toda numa linha — «Praceta Carlos da Costa
 * Frescata, 4, 2910-758 Setúbal» — e o formulário tem três campos. O que
 * acontecia era o campo ficar vazio com um placeholder por baixo, e quem
 * olhasse de lado ler o placeholder como se fosse o valor: `2845-513`, que é a
 * morada da CLYON e não a do cliente.
 *
 * E o código postal não é decoração: é ele, com a localidade, que localiza a
 * morada — e são as coordenadas que decidem que profissionais alcançam o
 * trabalho. Um pedido sem código postal é um pedido que chega a menos gente.
 *
 * SÓ SE ACEITA A FORMA CANÓNICA, `NNNN-NNN`. Sem o hífen, «Avenida 1234 567»
 * seria lido como código postal — e um número de porta a virar código postal
 * manda o trabalho para a outra ponta do país. Quatro dígitos soltos também
 * não chegam: `2910` sem o resto não localiza rua nenhuma.
 */

/** `NNNN-NNN`, com fronteiras para não apanhar metade de um número maior. */
const CODIGO_POSTAL = /(?<!\d)(\d{4}-\d{3})(?!\d)/;

export type MoradaPartida = {
  /** O que sobra da morada depois de sair o código postal e o que vem atrás. */
  rua: string;
  /** `NNNN-NNN`, ou `null` se a morada não trouxer nenhum. */
  codigoPostal: string | null;
  /** O que aparecia a seguir ao código postal, quando aparecia alguma coisa. */
  localidade: string | null;
};

/** Tira vírgulas, pontos e espaços das pontas — sobra o que é mesmo texto. */
function aparado(s: string): string {
  return s.replace(/^[\s,;.·—–-]+|[\s,;.·—–-]+$/g, "").trim();
}

/**
 * Parte uma morada escrita numa linha nas três partes que o formulário tem.
 *
 * Não adivinha: se não houver um `NNNN-NNN`, devolve a morada inteira como rua
 * e `null` nos outros dois. É melhor um campo vazio, que se vê, do que um
 * campo preenchido com um palpite, que não se vê.
 */
export function partirMorada(morada: string | null | undefined): MoradaPartida {
  const texto = (morada ?? "").trim();
  if (!texto) return { rua: "", codigoPostal: null, localidade: null };

  const m = CODIGO_POSTAL.exec(texto);
  if (!m) return { rua: texto, codigoPostal: null, localidade: null };

  const antes = texto.slice(0, m.index);
  const depois = texto.slice(m.index + m[1].length);

  return {
    rua: aparado(antes),
    codigoPostal: m[1],
    localidade: aparado(depois) || null,
  };
}

/**
 * O que falta preencher, a partir do que a morada já diz.
 *
 * ⚠️ NUNCA ESCREVE POR CIMA DO QUE JÁ LÁ ESTÁ. Se alguém corrigiu o código
 * postal à mão porque a morada estava mal escrita, a correcção é a verdade —
 * e um preenchimento automático a passar-lhe por cima seria desfazer trabalho
 * de uma pessoa com uma regra de três linhas.
 *
 * E não mexe na morada. O texto que o cliente escreveu fica como ele o
 * escreveu: apagar-lhe de lá o código postal era reescrever o que ele disse
 * para arrumar um formulário nosso.
 */
export function completarComAMorada(campos: {
  address: string;
  postalCode: string;
  city: string;
}): { postalCode: string; city: string } {
  const partes = partirMorada(campos.address);
  return {
    postalCode: campos.postalCode.trim() || partes.codigoPostal || "",
    city: campos.city.trim() || partes.localidade || "",
  };
}
