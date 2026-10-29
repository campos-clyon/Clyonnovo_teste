import type { Metadata } from "next";

import PaginaDePreco from "@/components/precos/PaginaDePreco";
import { descricaoQueCabe } from "@/lib/descricoes-seo";
import { og } from "@/lib/open-graph";
import { PRECO_FECHADO } from "@/lib/promessas-publicas";
import {
  comIva,
  euros,
  exemplosDeMudanca,
  extrasDasMudancas,
  linhasDasMudancas,
  paginaDePreco,
} from "@/lib/quanto-custa";
import { SITE_URL } from "@/lib/seo-data";
import {
  HORAS_POR_TIPOLOGIA,
  MATERIAIS,
  MINIMO_DA_MUDANCA,
  MINIMO_DE_HORAS,
  OFERTA_DA_MUDANCA,
  PESSOAS_NA_EQUIPA,
  POR_ANDAR_SEM_ELEVADOR,
  PRECO_POR_HORA,
  PRECO_POR_KM_LONGE,
  RAIO_INCLUIDO_KM,
  deslocacao,
  orcamentoDaMudanca,
} from "@/lib/tabela-das-mudancas";
import { TAXA_IVA } from "@/lib/taxas-plataforma";

/*
 * QUANTO CUSTA UMA MUDANÇA — 17-10-2026. Ver `quanto-custa.ts`.
 *
 * «Quanto custa uma mudança em Lisboa» tinha a Fixando nos três primeiros
 * lugares, com médias de 590 € e faixas de 50 a 1 700 €. A CLYON tem a
 * tabela do dono, à hora (13-10-2026): aqui está ela, por tipologia, com os
 * extras e quatro mudanças feitas pela mesma conta do simulador.
 */
const pagina = paginaDePreco("/precos/mudancas");
const IVA = `${Math.round(TAXA_IVA * 100)} %`;
const total = (t: "T0" | "T1" | "T2" | "T3" | "T4+") => orcamentoDaMudanca({ tipologia: t }).totalSemIva;
const KM_DO_EXEMPLO = 120;
const caixaMaisBarata = Math.min(...MATERIAIS.map((m) => m.preco));

const descricao = descricaoQueCabe([
  `Mudanças a ${PRECO_POR_HORA} € + IVA por hora, equipa de ${PESSOAS_NA_EQUIPA}, mínimo ${MINIMO_DE_HORAS} h.`,
  `T1 ≈ ${euros(total("T1"))}, T2 ≈ ${euros(total("T2"))}, T3 ≈ ${euros(total("T3"))} + IVA.`,
  "Extras e exemplos feitos.",
]);

export const metadata: Metadata = {
  title: pagina.titulo,
  description: descricao,
  alternates: { canonical: `${SITE_URL}${pagina.caminho}` },
  openGraph: og({ title: pagina.titulo, description: descricao, url: `${SITE_URL}${pagina.caminho}` }),
};

export const revalidate = 86400;

export default function PrecoDasMudancasPage() {
  return (
    <PaginaDePreco
      c={{
        pagina,
        tom: "mudanca",
        h1: "Quanto custa uma mudança?",
        resposta:
          `Uma mudança paga-se à hora: ${euros(PRECO_POR_HORA)} + IVA por hora (${euros(comIva(PRECO_POR_HORA))} com IVA) ` +
          `pela equipa de ${PESSOAS_NA_EQUIPA}, com carrinha, motorista e 2 ajudantes, e um mínimo de ${MINIMO_DE_HORAS} horas. ` +
          `Um T1 fica em cerca de ${euros(total("T1"))}, um T2 em ${euros(total("T2"))} e um T3 em ${euros(total("T3"))}, sempre + IVA. ` +
          `Andares sem elevador, desmontagem e percursos acima de ${RAIO_INCLUIDO_KM} km acrescem.`,
        tabela: { titulo: "Quanto custa, por tipologia", linhas: linhasDasMudancas() },
        extras: {
          titulo: "Os extras",
          intro: "Somam-se às horas, quando se aplicam.",
          linhas: extrasDasMudancas(),
        },
        exemplos: {
          titulo: "Quatro mudanças, com as contas feitas",
          intro:
            "Feitas pela mesma conta que estima o seu pedido no simulador. São estimativas: a mudança paga-se pelas horas feitas no dia.",
          itens: exemplosDeMudanca(),
        },
        caixa: {
          titulo: "O que vem na hora",
          itens: [
            "Carrinha, motorista e 2 ajudantes",
            "Carregar, transportar e descarregar",
            `A deslocação, até ${RAIO_INCLUIDO_KM} km de percurso`,
            `Materiais de embalamento à parte, pela tabela (caixas a partir de ${euros(caixaMaisBarata)})`,
          ],
        },
        fatores: [
          "A tipologia, e quanta coisa vai",
          "Os andares e o elevador nas duas casas",
          "Desmontar e montar móveis",
          `A distância: acima de ${RAIO_INCLUIDO_KM} km contam todos os km, ida e volta`,
          "O estacionamento à porta das duas casas",
          "Ter tudo embalado antes do dia poupa horas",
        ],
        porConcelho: "mudancas",
        faqs: [
          {
            question: "Quanto custa a mudança de um T2?",
            answer:
              `Contam-se cerca de ${HORAS_POR_TIPOLOGIA.T2} horas: ${euros(total("T2"))} + IVA (${euros(comIva(total("T2")))} com IVA), ` +
              `com elevador nas duas casas e até ${RAIO_INCLUIDO_KM} km. Cada andar sem elevador acresce ${euros(POR_ANDAR_SEM_ELEVADOR)}.`,
          },
          {
            question: "Quanto custa a mudança de um T0 ou T1?",
            answer: `O mínimo: ${MINIMO_DE_HORAS} horas, ${euros(MINIMO_DA_MUDANCA)} + IVA (${euros(comIva(MINIMO_DA_MUDANCA))} com IVA).`,
          },
          {
            question: "Quanto custa uma mudança para longe?",
            answer:
              `Até ${RAIO_INCLUIDO_KM} km de percurso a deslocação está incluída. Acima disso, ${euros(PRECO_POR_KM_LONGE)} por km, ` +
              `contando todos os km, ida e volta, mais portagens: ${KM_DO_EXEMPLO} km são ${euros(deslocacao(KM_DO_EXEMPLO))} de deslocação, mais as horas.`,
          },
          {
            question: "O preço é fechado?",
            answer:
              "A hora é fechada; o total sai das horas feitas no dia. Cada proposta diz quantas horas o parceiro prevê, " +
              "e é por isso que vale a pena dizer no pedido o que vai, os andares e o elevador.",
          },
          {
            question: "Há um preço mínimo?",
            answer: `Sim: ${MINIMO_DE_HORAS} horas da equipa, ${euros(MINIMO_DA_MUDANCA)} + IVA.`,
          },
          {
            question: "Os preços já têm IVA?",
            answer: `Os valores da tabela são sem IVA, e a coluna ao lado tem o valor com IVA (${IVA}). ${PRECO_FECHADO}`,
          },
        ],
        relacionados: [
          { href: "/mudancas", titulo: "Mudanças em Lisboa, Margem Sul e Setúbal" },
          { href: "/pequenas-mudancas", titulo: "Pequenas mudanças" },
          { href: "/transporte-de-moveis", titulo: "Transporte de móveis" },
          { href: "/blog/quanto-custa-uma-mudanca-em-lisboa", titulo: "Quanto custa uma mudança em Lisboa" },
          { href: "/blog/mudanca-entre-lisboa-e-a-margem-sul", titulo: "Mudança entre Lisboa e a Margem Sul" },
          { href: "/mudancas-de-escritorio", titulo: "Mudanças de escritório" },
        ],
        oferta: OFERTA_DA_MUDANCA,
        ctaTitulo: "Tem uma mudança para fazer?",
        mensagemWhatsApp: "Olá! Tenho uma mudança para fazer. Podem dar-me um orçamento?",
      }}
    />
  );
}
