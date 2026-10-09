import type { Metadata } from "next";

import PaginaDeTipoDeMudanca from "@/components/mudancas/PaginaDeTipoDeMudanca";
import { descricaoQueCabe } from "@/lib/descricoes-seo";
import { og } from "@/lib/open-graph";
import { AO_FIM_DE_SEMANA, PROPOSTAS_EM_ATE, RECEBE_PROPOSTAS } from "@/lib/promessas-publicas";
import { PRAZO_DE_RESPOSTA, SITE_URL } from "@/lib/seo-data";

/*
 * PEQUENAS MUDANÇAS — 09-10-2026. Um quarto, um estúdio, um T0/T1 com pouca
 * coisa: quem procura isto tem medo de pagar uma mudança inteira por meia
 * carrinha. Ver `PaginaDeTipoDeMudanca`.
 */
const titulo = "Pequenas Mudanças em Lisboa e Margem Sul";
const descricao = descricaoQueCabe([
  "Pequenas mudanças em Lisboa, Margem Sul e Setúbal: um quarto, um estúdio ou um T0/T1, com poucos móveis e caixas.",
  `Propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`,
]);

export const metadata: Metadata = {
  title: titulo,
  description: descricao,
  alternates: { canonical: `${SITE_URL}/pequenas-mudancas` },
  openGraph: og({ title: titulo, description: descricao, url: `${SITE_URL}/pequenas-mudancas` }),
};

export default function PequenasMudancasPage() {
  return (
    <PaginaDeTipoDeMudanca
      c={{
        caminho: "/pequenas-mudancas",
        nome: "Pequenas mudanças",
        h1: "Pequenas mudanças",
        intro: `Um quarto, um estúdio, um T0 ou T1 com pouca coisa: uma mudança pequena não precisa de um camião grande nem de um dia inteiro. Diga o que vai e as duas moradas — o pedido chega a profissionais verificados da zona, e as propostas vêm para o tamanho real da mudança. ${RECEBE_PROPOSTAS}`,
        quandoFazSentido: {
          titulo: "Quando é uma pequena mudança",
          itens: [
            "Um estudante que muda de quarto ou de residência",
            "Um estúdio ou um T0/T1 pouco mobilado",
            "Vai viver com alguém e leva só parte das coisas",
            "Caixas e poucos móveis, sem nada de grande para desmontar",
          ],
        },
        oQueDizer: [
          "Quantas caixas e que móveis vão, mesmo que sejam poucos",
          "As duas moradas, o andar de cada uma e se há elevador",
          "Se precisa de ajuda a carregar, ou só do transporte",
          "A data, e se tem margem para a mudar",
        ],
        fatoresDePreco: [
          "O volume — quantas caixas e que móveis",
          "Os andares e o elevador nas duas moradas",
          "A distância entre as duas moradas",
          "O dia e a hora",
        ],
        faqs: [
          {
            question: "O que conta como pequena mudança?",
            answer:
              "Não há uma regra fixa: um quarto, um estúdio ou um T0/T1 com pouca coisa, que cabe numa carrinha. Diga o que vai, e cada proposta vem para esse volume.",
          },
          {
            question: "Tenho de embalar tudo antes?",
            answer:
              "As caixas embalam-se antes do dia. Se precisar de material de embalagem, diga-o no pedido: alguns profissionais levam caixas e plástico, e isso vem discriminado na proposta.",
          },
          {
            question: "Quanto custa uma pequena mudança?",
            answer: `Depende do volume, dos andares e do elevador nas duas moradas, e da distância entre elas. Não há tabela: recebe propostas ${PROPOSTAS_EM_ATE}, cada uma com o preço fechado antes de começar.`,
          },
          {
            question: "Fazem pequenas mudanças ao fim de semana?",
            answer: AO_FIM_DE_SEMANA,
          },
        ],
        artigo: {
          href: "/blog/pequenas-mudancas-em-lisboa-quando-compensa",
          titulo: "Pequenas mudanças em Lisboa: quando compensa",
        },
        ctaTitulo: "Tem uma pequena mudança para fazer?",
        mensagemWhatsApp: "Olá! Tenho uma pequena mudança para fazer. Podem dar-me um orçamento?",
      }}
    />
  );
}
