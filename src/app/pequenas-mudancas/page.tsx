import type { Metadata } from "next";

import PaginaDeTipoDeMudanca from "@/components/mudancas/PaginaDeTipoDeMudanca";
import { descricaoQueCabe } from "@/lib/descricoes-seo";
import { og } from "@/lib/open-graph";
import { AO_FIM_DE_SEMANA, PROPOSTAS_EM_ATE, PROMESSA_DO_PRAZO } from "@/lib/promessas-publicas";
import {
  exemplosDaListaNumaFrase,
  precoDaMudancaNaDescricao,
  precoDaMudancaNumaFrase,
  type PrecoPublicoDasMudancas,
} from "@/lib/preco-publico-das-mudancas";
import { precoPublicoDasMudancas } from "@/lib/ler-preco-publico-das-mudancas";
import { PRAZO_DE_RESPOSTA, SITE_URL } from "@/lib/seo-data";

/*
 * PEQUENAS MUDANÇAS — 09-10-2026. Um quarto, um estúdio, um T0/T1 com pouca
 * coisa: quem procura isto tem medo de pagar uma mudança inteira por meia
 * carrinha. Ver `PaginaDeTipoDeMudanca`.
 */
const titulo = "Pequenas Mudanças em Lisboa e Margem Sul";
// Com o preço desde 14-10-2026; desde 11-11-2026 o preço público (o «desde» dos parceiros, ou a referência).
const descricaoCom = (preco: PrecoPublicoDasMudancas) => descricaoQueCabe([
  `Pequenas mudanças em Lisboa, Margem Sul e Setúbal — um quarto, um estúdio, um T0/T1 — à hora, ${precoDaMudancaNaDescricao(preco)}.`,
  `Propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`,
  "Orçamento grátis.",
]);

/** De hora a hora: o preço da hora é o preço público das mudanças (cache de 1 h). */
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const descricao = descricaoCom(await precoPublicoDasMudancas());
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: `${SITE_URL}/pequenas-mudancas` },
    openGraph: og({ title: titulo, description: descricao, url: `${SITE_URL}/pequenas-mudancas` }),
  };
}

export default async function PequenasMudancasPage() {
  const preco = await precoPublicoDasMudancas();
  return (
    <PaginaDeTipoDeMudanca
      preco={preco}
      c={{
        caminho: "/pequenas-mudancas",
        nome: "Pequenas mudanças",
        h1: "Pequenas mudanças",
        intro: `Um quarto, um estúdio, um T0 ou T1 com pouca coisa: uma mudança pequena não precisa de um camião grande nem de um dia inteiro. Diga o que vai e as duas moradas — o pedido chega a parceiros da zona, e as propostas vêm para o tamanho real da mudança. ${PROMESSA_DO_PRAZO}`,
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
              "As caixas embalam-se antes do dia. Se precisar de material de embalagem, diga-o no pedido: alguns parceiros levam caixas e plástico, e isso vem discriminado na proposta.",
          },
          {
            question: "Quanto custa uma pequena mudança?",
            answer: `Depende do volume, dos andares e do elevador nas duas moradas, e da distância entre elas. Paga-se à hora, ao preço do parceiro que escolher (${precoDaMudancaNumaFrase(preco)}): na lista vê a nota, o preço por hora, a equipa e o material de cada um, e o pedido segue para os que escolher ${PROPOSTAS_EM_ATE}.${exemplosDaListaNumaFrase(preco) ? ` ${exemplosDaListaNumaFrase(preco)}` : ""}`,
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
