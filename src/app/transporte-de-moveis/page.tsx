import type { Metadata } from "next";

import PaginaDeTipoDeMudanca from "@/components/mudancas/PaginaDeTipoDeMudanca";
import { descricaoQueCabe } from "@/lib/descricoes-seo";
import { og } from "@/lib/open-graph";
import { PROPOSTAS_EM_ATE, PROMESSA_DO_PRAZO } from "@/lib/promessas-publicas";
import {
  exemplosDaListaNumaFrase,
  precoDaMudancaNaDescricao,
  precoDaMudancaNumaFrase,
  type PrecoPublicoDasMudancas,
} from "@/lib/preco-publico-das-mudancas";
import { precoPublicoDasMudancas } from "@/lib/ler-preco-publico-das-mudancas";
import { PRAZO_DE_RESPOSTA, SITE_URL } from "@/lib/seo-data";

/*
 * TRANSPORTE DE MÓVEIS — 09-10-2026. Para quem tem um sofá, uma cama ou um
 * roupeiro para levar de um sítio para outro: não é uma mudança, e não
 * procura «mudanças». Ver `PaginaDeTipoDeMudanca`.
 */
const titulo = "Transporte de Móveis em Lisboa e Margem Sul";
// Com o preço desde 14-10-2026; desde 11-11-2026 o preço público (o «desde» dos parceiros, ou a referência).
const descricaoCom = (preco: PrecoPublicoDasMudancas) => descricaoQueCabe([
  "Transporte de um sofá, uma cama, um roupeiro ou de poucos móveis em Lisboa, Margem Sul e Setúbal.",
  `À hora, ${precoDaMudancaNaDescricao(preco)}.`,
  `Propostas de parceiros em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`,
]);

/** De hora a hora: o preço da hora é o preço público das mudanças (cache de 1 h). */
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const descricao = descricaoCom(await precoPublicoDasMudancas());
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: `${SITE_URL}/transporte-de-moveis` },
    openGraph: og({ title: titulo, description: descricao, url: `${SITE_URL}/transporte-de-moveis` }),
  };
}

export default async function TransporteDeMoveisPage() {
  const preco = await precoPublicoDasMudancas();
  return (
    <PaginaDeTipoDeMudanca
      preco={preco}
      c={{
        caminho: "/transporte-de-moveis",
        nome: "Transporte de móveis",
        h1: "Transporte de móveis",
        intro: `Um sofá comprado em segunda mão, a cama que vai para casa de um filho, o roupeiro de uma loja que não entrega: quando são poucos volumes, não é uma mudança — é um transporte de móveis. Diga o que vai e as duas moradas, e o pedido chega a parceiros da zona, com carrinha. ${PROMESSA_DO_PRAZO}`,
        quandoFazSentido: {
          titulo: "Quando é um transporte de móveis",
          itens: [
            "Comprou um móvel usado e o vendedor não entrega",
            "Comprou numa loja que não faz entregas, ou que tem prazo longo",
            "Leva móveis para uma arrecadação, um armazém ou a casa de família",
            "Muda um ou dois móveis grandes de uma casa para outra",
          ],
        },
        oQueDizer: [
          "O que vai, com as medidas dos móveis maiores — ou uma fotografia",
          "As duas moradas, o andar de cada uma e se há elevador",
          "Se é preciso desmontar e voltar a montar",
          "Se o móvel se levanta numa loja ou em casa de outra pessoa, e a que horas",
        ],
        fatoresDePreco: [
          "O tamanho e o peso dos móveis",
          "Os andares e o elevador nas duas moradas",
          "A distância entre as duas moradas",
          "Desmontar e montar, se for preciso",
        ],
        faqs: [
          {
            question: "Fazem o transporte de um só móvel?",
            answer:
              "Sim. Um só sofá, uma cama ou um roupeiro também se pedem: o pedido é o mesmo de uma mudança, e as propostas dizem o preço desse transporte.",
          },
          {
            question: "Podem ir buscar um móvel que comprei a outra pessoa ou numa loja?",
            answer:
              "Sim. Diga no pedido a morada onde se levanta, a que horas pode ser, e a morada de entrega. Combine antes com o vendedor que o móvel está pronto a sair.",
          },
          {
            question: "O parceiro carrega e sobe as escadas?",
            answer:
              "Pode pedi-lo: diga quantos andares há em cada morada e se há elevador, e a proposta já conta com a carga, a descarga e as escadas.",
          },
          {
            question: "Quanto custa transportar um móvel?",
            answer: `Depende do tamanho e do peso, dos andares e do elevador nas duas moradas, e da distância entre elas. Paga-se à hora, ao preço do parceiro que escolher (${precoDaMudancaNumaFrase(preco)}): na lista vê a nota, o preço por hora, a equipa e o material de cada um, e o pedido segue para os que escolher ${PROPOSTAS_EM_ATE}.${exemplosDaListaNumaFrase(preco) ? ` ${exemplosDaListaNumaFrase(preco)}` : ""}`,
          },
        ],
        ctaTitulo: "Tem um móvel para levar?",
        mensagemWhatsApp: "Olá! Preciso de transportar um móvel. Podem dar-me um orçamento?",
      }}
    />
  );
}
