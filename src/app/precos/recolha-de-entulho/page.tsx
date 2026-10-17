import type { Metadata } from "next";

import PaginaDePreco from "@/components/precos/PaginaDePreco";
import { descricaoQueCabe } from "@/lib/descricoes-seo";
import { og } from "@/lib/open-graph";
import { ACRESCIMO_POR_URGENCIA, PRECO_FECHADO } from "@/lib/promessas-publicas";
import {
  ENTULHO_POR_M3,
  MEDIDAS_DO_ENTULHO,
  comIva,
  euros,
  linhasDoEntulho,
  paginaDePreco,
  semIvaEscrito,
  comIvaEscrito,
} from "@/lib/quanto-custa";
import { COMO_SE_RECOLHE_ENTULHO, NAO_HA_CONTENTORES, RESPOSTA_SOBRE_CONTENTORES } from "@/lib/sacos-de-entulho";
import { SITE_URL } from "@/lib/seo-data";
import { TAXA_IVA } from "@/lib/taxas-plataforma";

/*
 * QUANTO CUSTA RECOLHER ENTULHO — 17-10-2026. Ver `quanto-custa.ts`.
 *
 * A pesquisa «preço remoção de entulho por m³» tinha a Fixando em primeiro,
 * com uma média de pedidos. Aqui está a tabela que o motor usa, por volume, e
 * o que a câmara de cada concelho recolhe de graça.
 */
const pagina = paginaDePreco("/precos/recolha-de-entulho");
const linhas = linhasDoEntulho();
const [ate10Sacos, umMetro, tresMetros] = linhas;
const { sacosPorMetroCubico, sacosPorBigBag, pesoDoSaco } = MEDIDAS_DO_ENTULHO;
const IVA = `${Math.round(TAXA_IVA * 100)} %`;

const descricao = descricaoQueCabe([
  `Recolha de entulho desde ${euros(ENTULHO_POR_M3)} + IVA por m³ (${euros(comIva(ENTULHO_POR_M3))} com IVA).`,
  `Até 10 sacos: ${semIvaEscrito(ate10Sacos.valor)} + IVA.`,
  "Tabela, exemplos e o que a câmara recolhe de graça.",
]);

export const metadata: Metadata = {
  title: pagina.titulo,
  description: descricao,
  alternates: { canonical: `${SITE_URL}${pagina.caminho}` },
  openGraph: og({ title: pagina.titulo, description: descricao, url: `${SITE_URL}${pagina.caminho}` }),
};

export const revalidate = 86400;

export default function PrecoDoEntulhoPage() {
  return (
    <PaginaDePreco
      c={{
        pagina,
        tom: "recolha",
        h1: "Quanto custa recolher entulho?",
        resposta:
          `A recolha de entulho custa desde ${euros(ENTULHO_POR_M3)} + IVA por metro cúbico ` +
          `(${euros(comIva(ENTULHO_POR_M3))} com IVA). Até 10 sacos, ${semIvaEscrito(ate10Sacos.valor)} + IVA; ` +
          `até 3 m³, ${semIvaEscrito(tresMetros.valor)} + IVA. ${COMO_SE_RECOLHE_ENTULHO} ` +
          "O valor final é a proposta do profissional, fechada antes de começar e já com o IVA.",
        tabela: { titulo: "Tabela de preços da recolha de entulho", linhas },
        caixa: {
          titulo: "Quanto é 1 m³ de entulho",
          itens: [
            `1 m³ são cerca de ${sacosPorMetroCubico} sacos de obra de ${pesoDoSaco} kg.`,
            `Um big bag são cerca de ${sacosPorBigBag} sacos, quase 1 m³. Serve de medida: a recolha é feita em sacos, carregados à mão.`,
            NAO_HA_CONTENTORES,
            "Se o entulho estiver solto no chão, o profissional ensaca-o no local, e o tempo que leva entra na proposta.",
          ],
        },
        fatores: [
          "A quantidade, em sacos ou em metros cúbicos",
          "Se o entulho já está ensacado ou solto no chão",
          "O andar, o elevador e a distância até à carrinha",
          "O estacionamento à porta",
          "A mistura com outros materiais, como madeira, móveis ou eletrodomésticos",
          ACRESCIMO_POR_URGENCIA,
        ],
        porConcelho: "entulho",
        faqs: [
          {
            question: "Quanto custa recolher 1 m³ de entulho?",
            answer:
              `Desde ${euros(ENTULHO_POR_M3)} + IVA (${euros(comIva(ENTULHO_POR_M3))} com IVA). ` +
              `1 m³ são cerca de ${sacosPorMetroCubico} sacos de obra de ${pesoDoSaco} kg.`,
          },
          {
            question: "Quanto custa recolher só alguns sacos de entulho?",
            answer:
              `Até 10 sacos, ${semIvaEscrito(ate10Sacos.valor)} + IVA (${comIvaEscrito(ate10Sacos.valor)} com IVA). ` +
              "É o valor mínimo de uma recolha: a deslocação é a mesma para dois ou para dez sacos.",
          },
          {
            question: "Quanto custa tirar o entulho de uma obra num T1 ou T2?",
            answer:
              `Uma obra num T1 ou T2 costuma dar até 3 m³: ${semIvaEscrito(tresMetros.valor)} + IVA ` +
              `(${comIvaEscrito(tresMetros.valor)} com IVA). Uma casa de banho ou uma cozinha cabem normalmente em 1 m³: ` +
              `${semIvaEscrito(umMetro.valor)} + IVA.`,
          },
          {
            question: "A câmara recolhe entulho de graça?",
            answer:
              "Em vários concelhos, sim, para pequenas obras e com limites: em Lisboa, por exemplo, até 1 m³ por obra isenta de licença, a pedido. " +
              "As regras de cada câmara estão nesta página, concelho a concelho, com a fonte oficial.",
          },
          {
            question: "Fornecem contentor ou big bag?",
            answer: RESPOSTA_SOBRE_CONTENTORES,
          },
          {
            question: "Os preços já têm IVA?",
            answer: `Os valores da tabela são sem IVA, e a coluna ao lado tem o valor com IVA (${IVA}). ${PRECO_FECHADO}`,
          },
        ],
        relacionados: [
          { href: "/recolha-de-entulho", titulo: "Recolha de entulho em Lisboa, Margem Sul e Setúbal" },
          { href: "/blog/entulho-sacos-big-bag-ou-contentor", titulo: "Sacos, big bag da câmara ou contentor: como escolher" },
          { href: "/blog/recolha-de-entulho-legal-e-organizada", titulo: "Recolha de entulho legal e organizada" },
          { href: "/precos/recolha-de-monos-e-moveis", titulo: "Quanto custa recolher monos e móveis" },
        ],
        oferta: {
          "@type": "Offer",
          priceCurrency: "EUR",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: ENTULHO_POR_M3,
            minPrice: ENTULHO_POR_M3,
            priceCurrency: "EUR",
            unitCode: "MTQ",
            unitText: "m³",
            valueAddedTaxIncluded: false,
          },
        },
        ctaTitulo: "Tem entulho para tirar?",
        mensagemWhatsApp: "Olá! Tenho entulho para recolher. Podem dar-me um orçamento?",
      }}
    />
  );
}
