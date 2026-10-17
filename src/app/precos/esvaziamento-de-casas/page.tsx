import type { Metadata } from "next";

import PaginaDePreco from "@/components/precos/PaginaDePreco";
import { descricaoQueCabe } from "@/lib/descricoes-seo";
import { og } from "@/lib/open-graph";
import { PRECOS } from "@/lib/precos-publicos";
import { ACRESCIMO_POR_URGENCIA, DESMONTAGEM_A_PEDIDO, PRECO_FECHADO } from "@/lib/promessas-publicas";
import {
  comIvaEscrito,
  linhaDoEsvaziamento,
  linhasDoEsvaziamento,
  paginaDePreco,
  semIvaEscrito,
  type Valor,
} from "@/lib/quanto-custa";
import { SITE_URL } from "@/lib/seo-data";
import { TAXA_IVA } from "@/lib/taxas-plataforma";

/*
 * QUANTO CUSTA ESVAZIAR UMA CASA — 17-10-2026. Ver `quanto-custa.ts`.
 *
 * Na Fixando, «Esvaziamento» é uma etiqueta sobre fossas sépticas, e não há
 * página de esvaziamento de casas nem de recheios. Aqui está a grelha que
 * /esvaziamento-de-casas já mostrava, com o IVA ao lado, e o que entra.
 */
const pagina = paginaDePreco("/precos/esvaziamento-de-casas");
const linhas = linhasDoEsvaziamento();
const t01 = linhaDoEsvaziamento("T0/T1").valor;
const t2 = linhaDoEsvaziamento("T2").valor;
const t34 = linhaDoEsvaziamento("T3/T4").valor;
const moradia = linhaDoEsvaziamento("moradia").valor;
const apartamento: Valor = {
  tipo: "faixa",
  de: PRECOS.esvaziamento_apartamento.minimo ?? 0,
  ate: PRECOS.esvaziamento_apartamento.maximo ?? 0,
};
const IVA = `${Math.round(TAXA_IVA * 100)} %`;

const descricao = descricaoQueCabe([
  `Esvaziar um T0/T1: ${semIvaEscrito(t01)}; T2: ${semIvaEscrito(t2)}; T3/T4: ${semIvaEscrito(t34)}; moradia ${semIvaEscrito(moradia)}. Tudo + IVA.`,
  "Com IVA ao lado e o que entra.",
]);

export const metadata: Metadata = {
  title: pagina.titulo,
  description: descricao,
  alternates: { canonical: `${SITE_URL}${pagina.caminho}` },
  openGraph: og({ title: pagina.titulo, description: descricao, url: `${SITE_URL}${pagina.caminho}` }),
};

export const revalidate = 86400;

export default function PrecoDoEsvaziamentoPage() {
  return (
    <PaginaDePreco
      c={{
        pagina,
        tom: "recolha",
        h1: "Quanto custa esvaziar uma casa?",
        resposta:
          `Esvaziar um apartamento custa ${semIvaEscrito(apartamento)} + IVA (${comIvaEscrito(apartamento)} com IVA), ` +
          `conforme a tipologia, o volume e o andar: um T0/T1 ${semIvaEscrito(t01)}, um T2 ${semIvaEscrito(t2)} ` +
          `e um T3/T4 ${semIvaEscrito(t34)}, sempre + IVA. Uma moradia completa, ${semIvaEscrito(moradia)} + IVA. ` +
          "O valor final é a proposta do profissional, fechada antes de começar e já com o IVA.",
        tabela: { titulo: "Tabela de preços do esvaziamento", linhas },
        caixa: {
          titulo: "O que entra num esvaziamento",
          itens: [
            "Móveis, eletrodomésticos, colchões e o recheio que fica na casa.",
            "Arrecadação, garagem, varandas ou quintal, se os incluir no pedido.",
            "O que quer guardar fica de fora: separe-o antes, ou diga-o no pedido.",
            "Se houver entulho de obras, diga-o no pedido: o entulho tem tabela própria.",
          ],
        },
        fatores: [
          "O volume: quantas divisões, e quão cheias",
          "O andar, o elevador e a distância até à carrinha",
          "Se é preciso desmontar móveis",
          "O estacionamento à porta",
          "A data: se há uma data das chaves que não se mexe, diga-a no pedido",
          ACRESCIMO_POR_URGENCIA,
        ],
        porConcelho: "esvaziamento",
        faqs: [
          {
            question: "Quanto custa esvaziar um apartamento T2?",
            answer:
              `${semIvaEscrito(t2)} + IVA (${comIvaEscrito(t2)} com IVA). ` +
              "Um T2 pouco cheio e com elevador fica mais perto do início da faixa; cheio, num andar alto sem elevador, mais perto do fim.",
          },
          {
            question: "Quanto custa esvaziar um T0 ou T1?",
            answer: `${semIvaEscrito(t01)} + IVA (${comIvaEscrito(t01)} com IVA).`,
          },
          {
            question: "Quanto custa esvaziar uma moradia?",
            answer:
              `Uma moradia completa, ${semIvaEscrito(moradia)} + IVA (${comIvaEscrito(moradia)} com IVA). ` +
              "Mais divisões, arrecadação, garagem ou quintal sobem o valor: com fotografias, a proposta vem mais certa.",
          },
          {
            question: "A câmara esvazia casas?",
            answer:
              "Não. As câmaras recolhem monos de graça, por marcação, mas não esvaziam casas inteiras. " +
              "Para uma ou duas peças pode compensar: as regras de cada câmara estão na página dos preços dos monos.",
          },
          {
            question: "A desmontagem dos móveis está incluída?",
            answer: DESMONTAGEM_A_PEDIDO,
          },
          {
            question: "Os preços já têm IVA?",
            answer: `Os valores da tabela são sem IVA, e a coluna ao lado tem o valor com IVA (${IVA}). ${PRECO_FECHADO}`,
          },
        ],
        relacionados: [
          { href: "/esvaziamento-de-casas", titulo: "Esvaziamento de casas e apartamentos" },
          { href: "/blog/esvaziar-a-casa-de-um-familiar", titulo: "Esvaziar a casa de um familiar: por onde começar" },
          { href: "/blog/esvaziar-apartamento-para-arrendar-ou-vender", titulo: "Esvaziar um apartamento para arrendar ou vender" },
          { href: "/precos/recolha-de-monos-e-moveis", titulo: "Quanto custa recolher monos e móveis" },
        ],
        oferta: {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: PRECOS.esvaziamento_casa.minimo,
        },
        ctaTitulo: "Tem uma casa para esvaziar?",
        mensagemWhatsApp: "Olá! Tenho uma casa para esvaziar. Podem dar-me um orçamento?",
      }}
    />
  );
}
