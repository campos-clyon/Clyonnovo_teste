import type { Metadata } from "next";

import PaginaDePreco from "@/components/precos/PaginaDePreco";
import { og } from "@/lib/open-graph";
import { paginaDePreco } from "@/lib/quanto-custa";
import { SITE_URL } from "@/lib/seo-data";
import { ofertaDaMudanca } from "@/lib/preco-publico-das-mudancas";
import { precoPublicoDasMudancas } from "@/lib/ler-preco-publico-das-mudancas";
import { conteudoDoPrecoDasMudancas, descricaoDoPrecoDasMudancas } from "@/lib/pagina-do-preco-das-mudancas";

/*
 * QUANTO CUSTA UMA MUDANÇA — 17-10-2026. Ver `quanto-custa.ts`.
 *
 * «Quanto custa uma mudança em Lisboa» tinha a Fixando nos três primeiros
 * lugares, com médias de 590 € e faixas de 50 a 1 700 €. A CLYON tem a
 * tabela do dono, à hora (13-10-2026): aqui está ela, por tipologia, com os
 * extras e quatro mudanças feitas pela mesma conta do simulador.
 *
 * AO PREÇO DE CADA PARCEIRO — 11-11-2026: a cabeça diz o preço público (o
 * «desde» dos parceiros da lista, ou a referência); a tabela por tipologia,
 * os extras e os exemplos ficam como REFERÊNCIA, e dizem-no.
 *
 * PELA LISTA, QUANDO HÁ PARCEIROS — d7, 11-11-2026: com parceiros na lista a
 * página diz o que a lista dá (o «desde» de 2 e de 3 e a estimativa de cada
 * casa, com a proteção e os km) e a referência só aparece com a lista vazia.
 * Os textos vivem em `pagina-do-preco-das-mudancas.ts`, que a orquestra lê.
 */
const pagina = paginaDePreco("/precos/mudancas");

export async function generateMetadata(): Promise<Metadata> {
  const descricao = descricaoDoPrecoDasMudancas(await precoPublicoDasMudancas());
  return {
    title: pagina.titulo,
    description: descricao,
    alternates: { canonical: `${SITE_URL}${pagina.caminho}` },
    openGraph: og({ title: pagina.titulo, description: descricao, url: `${SITE_URL}${pagina.caminho}` }),
  };
}

/** De hora a hora: o preço público das mudanças (cache de 1 h). */
export const revalidate = 3600;

export default async function PrecoDasMudancasPage() {
  const preco = await precoPublicoDasMudancas();
  return (
    <PaginaDePreco
      c={{
        pagina,
        tom: "mudanca",
        ...conteudoDoPrecoDasMudancas(preco),
        porConcelho: "mudancas",
        relacionados: [
          { href: "/mudancas", titulo: "Mudanças em Lisboa, Margem Sul e Setúbal" },
          { href: "/pequenas-mudancas", titulo: "Pequenas mudanças" },
          { href: "/transporte-de-moveis", titulo: "Transporte de móveis" },
          { href: "/blog/quanto-custa-uma-mudanca-em-lisboa", titulo: "Quanto custa uma mudança em Lisboa" },
          { href: "/blog/mudanca-entre-lisboa-e-a-margem-sul", titulo: "Mudança entre Lisboa e a Margem Sul" },
          { href: "/mudancas-de-escritorio", titulo: "Mudanças de escritório" },
        ],
        oferta: ofertaDaMudanca(preco),
        ctaTitulo: "Tem uma mudança para fazer?",
        mensagemWhatsApp: "Olá! Tenho uma mudança para fazer. Podem dar-me um orçamento?",
      }}
    />
  );
}
