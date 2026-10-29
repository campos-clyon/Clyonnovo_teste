import type { Metadata } from "next";

import PaginaDePreco from "@/components/precos/PaginaDePreco";
import { descricaoQueCabe } from "@/lib/descricoes-seo";
import { og } from "@/lib/open-graph";
import { PECAS_DE_REFERENCIA, PRECOS } from "@/lib/precos-publicos";
import { ACRESCIMO_POR_URGENCIA, DESMONTAGEM_A_PEDIDO, PRECO_FECHADO } from "@/lib/promessas-publicas";
import {
  comIvaEscrito,
  linhaDoEsvaziamento,
  linhasDosMonosEMoveis,
  paginaDePreco,
  semIvaEscrito,
  type Valor,
} from "@/lib/quanto-custa";
import { SITE_URL } from "@/lib/seo-data";
import { TAXA_IVA } from "@/lib/taxas-plataforma";

/*
 * QUANTO CUSTA RECOLHER MONOS E MÓVEIS — 17-10-2026. Ver `quanto-custa.ts`.
 *
 * A Fixando não tem página de monos nem de móveis: manda quem tem uma ou duas
 * peças para a câmara. Aqui estão as duas faixas, as peças de referência e,
 * concelho a concelho, o que a câmara recolhe de graça — para a pessoa
 * escolher com tudo à frente.
 */
const pagina = paginaDePreco("/precos/recolha-de-monos-e-moveis");
const linhas = linhasDosMonosEMoveis();
const [monos, moveis] = linhas;
const IVA = `${Math.round(TAXA_IVA * 100)} %`;

/** A faixa de uma peça de referência, pelo nome. */
function faixaDa(peca: string): Valor {
  const p = PECAS_DE_REFERENCIA.find((x) => x.peca === peca);
  if (!p) throw new Error(`Peça de referência desconhecida: ${peca}`);
  return { tipo: "faixa", de: p.minimo, ate: p.maximo };
}
const sofa = faixaDa("Sofá de 2 a 3 lugares");
const cama = faixaDa("Cama de casal com estrado");
const armario = faixaDa("Armário grande");
const t01 = linhaDoEsvaziamento("T0/T1").valor;
const moradia = linhaDoEsvaziamento("moradia").valor;

const descricao = descricaoQueCabe([
  `Recolha de monos ${semIvaEscrito(monos.valor)} + IVA, de móveis ${semIvaEscrito(moveis.valor)} + IVA, sofá ${semIvaEscrito(sofa)} + IVA.`,
  "Com IVA ao lado, e o que a câmara recolhe de graça.",
]);

export const metadata: Metadata = {
  title: pagina.titulo,
  description: descricao,
  alternates: { canonical: `${SITE_URL}${pagina.caminho}` },
  openGraph: og({ title: pagina.titulo, description: descricao, url: `${SITE_URL}${pagina.caminho}` }),
};

export const revalidate = 86400;

export default function PrecoDosMonosEMoveisPage() {
  return (
    <PaginaDePreco
      c={{
        pagina,
        tom: "recolha",
        h1: "Quanto custa recolher monos e móveis?",
        resposta:
          `A recolha de monos custa ${semIvaEscrito(monos.valor)} + IVA, e a de móveis ${semIvaEscrito(moveis.valor)} + IVA, ` +
          `conforme a peça, o andar e o elevador. Um sofá de 2 a 3 lugares fica em ${semIvaEscrito(sofa)} + IVA ` +
          `(${comIvaEscrito(sofa)} com IVA). As câmaras da zona também recolhem monos, por marcação e, em regra, de graça: ` +
          "as regras de cada uma estão mais abaixo.",
        tabela: { titulo: "Tabela de preços da recolha de monos e móveis", linhas },
        caixa: {
          titulo: "Câmara ou parceiro?",
          itens: [
            "A câmara é, em regra, grátis, mas é por marcação, no dia que ela tiver, e as peças deixam-se no local e à hora que ela combinar.",
            "Um parceiro tira as peças de dentro de casa, a qualquer andar, no dia que combinar consigo.",
            DESMONTAGEM_A_PEDIDO,
            "Se for a casa inteira, já não é recolha de peças: é um esvaziamento, com tabela própria.",
          ],
        },
        fatores: [
          "O tamanho e o peso de cada peça",
          "O andar, o elevador e as escadas",
          "Se é preciso desmontar antes de tirar",
          "Quantas peças são, e se estão todas no mesmo sítio",
          "O estacionamento à porta",
          ACRESCIMO_POR_URGENCIA,
        ],
        porConcelho: "monos",
        faqs: [
          {
            question: "Quanto custa retirar um sofá?",
            answer: `Um sofá de 2 a 3 lugares fica em ${semIvaEscrito(sofa)} + IVA (${comIvaEscrito(sofa)} com IVA). O andar, o elevador e se é preciso desmontar fazem a diferença dentro da faixa.`,
          },
          {
            question: "Quanto custa recolher uma cama?",
            answer: `Uma cama de casal com estrado fica em ${semIvaEscrito(cama)} + IVA (${comIvaEscrito(cama)} com IVA).`,
          },
          {
            question: "Quanto custa retirar um armário grande?",
            answer: `Um armário grande fica em ${semIvaEscrito(armario)} + IVA (${comIvaEscrito(armario)} com IVA). ${DESMONTAGEM_A_PEDIDO}`,
          },
          {
            question: "A câmara recolhe monos de graça?",
            answer:
              "Em regra, sim: por marcação, e com regras sobre o dia e o sítio onde deixar as peças. " +
              "As regras de cada câmara estão nesta página, concelho a concelho, com a fonte oficial.",
          },
          {
            question: "E se for a casa inteira?",
            answer: `Aí é um esvaziamento: um T0/T1 fica em ${semIvaEscrito(t01)} + IVA, uma moradia completa ${semIvaEscrito(moradia)} + IVA. A tabela está na página dos preços do esvaziamento.`,
          },
          {
            question: "Os preços já têm IVA?",
            answer: `Os valores da tabela são sem IVA, e a coluna ao lado tem o valor com IVA (${IVA}). ${PRECO_FECHADO}`,
          },
        ],
        relacionados: [
          { href: "/recolha-de-monos", titulo: "Recolha de monos em Lisboa, Margem Sul e Setúbal" },
          { href: "/recolha-de-moveis", titulo: "Recolha de móveis" },
          { href: "/blog/recolha-de-monos-camara-ou-profissional", titulo: "Monos: pela câmara ou por um parceiro?" },
          { href: "/blog/quanto-custa-retirar-um-sofa-em-lisboa", titulo: "Quanto custa retirar um sofá em Lisboa" },
          { href: "/precos/esvaziamento-de-casas", titulo: "Quanto custa esvaziar uma casa" },
          { href: "/precos/recolha-de-entulho", titulo: "Quanto custa recolher entulho" },
        ],
        oferta: {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: Math.min(PRECOS.recolha_monos.minimo ?? Infinity, PRECOS.recolha_moveis.minimo ?? Infinity),
          highPrice: Math.max(PRECOS.recolha_monos.maximo ?? 0, PRECOS.recolha_moveis.maximo ?? 0),
        },
        ctaTitulo: "Tem monos ou móveis para tirar?",
        mensagemWhatsApp: "Olá! Tenho monos/móveis para recolher. Podem dar-me um orçamento?",
      }}
    />
  );
}
