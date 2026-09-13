import { PRECOS } from "./precos-publicos";

/**
 * OS TÍTULOS QUE O GOOGLE MOSTRA INTEIROS.
 *
 * O Google corta o título por volta dos 60 caracteres, e o que fica de fora
 * não desaparece em silêncio: ele reescreve o que sobra com pedaços da
 * página. Foi o que aconteceu em Lisboa — «Recolha de Móveis em Lisboa —
 * Hoje ou Amanhã, 40 – 120 € | CLYON» tem 64, o Google cortou o «€ | CLYON»,
 * e o resultado mostrava «40 – 120», um intervalo sem unidade que não quer
 * dizer nada a quem está a decidir onde clicar.
 *
 * O `layout.tsx` acrescenta « | CLYON» a tudo (`template: "%s | CLYON"`), e
 * esses oito caracteres contam. Por isso o que se escreve aqui tem de caber
 * em 52 — e `comExtra` garante-o por construção, deitando fora a parte
 * dispensável em vez de deixar o Google escolher por nós.
 */

export const LIMITE_DO_GOOGLE = 60;

/** O que o template do layout acrescenta a todos os títulos. */
export const SUFIXO_DA_MARCA = " | CLYON";

/** O título completo, como aparece no separador e no Google. */
export function tituloCompleto(titulo: string): string {
  return `${titulo}${SUFIXO_DA_MARCA}`;
}

/** Cabe no Google depois de a marca ser acrescentada? */
export function cabeNoGoogle(titulo: string): boolean {
  return tituloCompleto(titulo).length <= LIMITE_DO_GOOGLE;
}

/**
 * A base com o extra atrás, quando o conjunto cabe; só a base, quando não.
 *
 * O extra é sempre a parte que se pode perder — o preço, o prazo — e a base
 * é a que não se pode: o serviço e a terra. Assim uma terra de nome comprido
 * perde o preço em vez de perder o nome.
 */
export function comExtra(base: string, extra: string): string {
  const completo = `${base} — ${extra}`;
  return cabeNoGoogle(completo) ? completo : base;
}

const PRECO_MOVEIS = PRECOS.recolha_moveis.etiqueta; // "40 – 120 €"
const PRECO_ENTULHO = PRECOS.recolha_entulho.etiqueta; // "desde 110 €/m³"

/**
 * O título de uma página de cidade + serviço.
 *
 * Sem « | CLYON»: quem o acrescenta é o template do layout. Escrevê-lo aqui
 * dá «… | CLYON | CLYON», que é o que oito páginas do site mostravam no
 * Google.
 */
export function tituloDaCidade(
  serviceName: string,
  cityName: string,
  serviceSlug: string,
  citySlug: string,
): string {
  if (serviceSlug === "recolha-moveis") {
    const base = `Recolha de Móveis em ${cityName}`;
    if (citySlug === "lisboa") return comExtra(base, `Hoje, ${PRECO_MOVEIS}`);
    if (citySlug === "almada") return comExtra(base, `Hoje, ${PRECO_MOVEIS}`);
    if (citySlug === "setubal") return comExtra(base, `${PRECO_MOVEIS}, em 6h`);
    return comExtra(base, PRECO_MOVEIS);
  }

  if (serviceSlug === "recolha-monos") {
    const base = `Recolha de Monos em ${cityName}`;
    // A alternativa à câmara é a promessa que ganha esta pesquisa: quem já
    // descobriu que a recolha municipal demora semanas procura exactamente
    // isto. Vale mais do que o preço no título.
    if (citySlug === "lisboa") return comExtra(base, "Sem Esperar a Câmara");
    if (citySlug === "almada") return comExtra(base, "Sem Esperar a Câmara");
    return comExtra(base, "Alternativa à Câmara");
  }

  if (serviceSlug === "recolha-entulho") {
    /*
      SEM BIG BAGS NO TÍTULO — é o que aparece no Google.

      Prometia «Big Bags» a quem procurava, e a CLYON não os tem: a recolha é
      a saco de 25 kg. Um título que promete o que a página não cumpre traz
      cliques que se perdem no primeiro parágrafo. Ver `sacos-de-entulho.ts`.
    */
    const base = `Recolha de Entulho em ${cityName}`;
    if (citySlug === "lisboa") return comExtra(base, `a Saco, ${PRECO_ENTULHO}`);
    return comExtra(base, PRECO_ENTULHO);
  }

  return comExtra(`${serviceName} em ${cityName}`, "Orçamento em 6h");
}
