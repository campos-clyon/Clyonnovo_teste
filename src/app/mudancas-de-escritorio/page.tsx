import type { Metadata } from "next";

import PaginaDeTipoDeMudanca from "@/components/mudancas/PaginaDeTipoDeMudanca";
import { descricaoQueCabe } from "@/lib/descricoes-seo";
import { og } from "@/lib/open-graph";
import { AO_FIM_DE_SEMANA, PROPOSTAS_EM_ATE, RECEBE_PROPOSTAS } from "@/lib/promessas-publicas";
import { PRAZO_DE_RESPOSTA, SITE_URL } from "@/lib/seo-data";

/*
 * MUDANÇAS DE ESCRITÓRIO — 09-10-2026. Escritórios, lojas e consultórios:
 * quem procura isto quer saber de factura, de horário e do equipamento. Ver
 * `PaginaDeTipoDeMudanca`.
 *
 * O endereço começa por «/mudancas-», e o middleware manda esses para a
 * cidade com o mesmo nome — este fica de fora por estar em
 * `PAGINAS_DE_TIPO_DE_MUDANCA` (tipos-de-mudanca.ts).
 */
const titulo = "Mudanças de Escritório em Lisboa e Setúbal";
const descricao = descricaoQueCabe([
  "Mudanças de escritório, lojas e consultórios em Lisboa, Margem Sul e Setúbal, com factura e hora fora do expediente.",
  `Propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`,
]);

export const metadata: Metadata = {
  title: titulo,
  description: descricao,
  alternates: { canonical: `${SITE_URL}/mudancas-de-escritorio` },
  openGraph: og({ title: titulo, description: descricao, url: `${SITE_URL}/mudancas-de-escritorio` }),
};

export default function MudancasDeEscritorioPage() {
  return (
    <PaginaDeTipoDeMudanca
      c={{
        caminho: "/mudancas-de-escritorio",
        nome: "Mudanças de escritório",
        h1: "Mudanças de escritório",
        intro: `Escritórios, lojas, consultórios e pequenos armazéns: mudar uma empresa é levar secretárias, cadeiras, arquivo e equipamento sem parar o trabalho mais do que o necessário. Descreva o espaço e o que vai, e o pedido chega a profissionais verificados da zona. ${RECEBE_PROPOSTAS}`,
        quandoFazSentido: {
          titulo: "Para quem é",
          itens: [
            "Empresas que mudam de escritório, ou de andar no mesmo edifício",
            "Lojas e consultórios que mudam de morada",
            "Arquivo, mobiliário e equipamento que vão para um armazém",
            "Mudanças ao fim do dia ou ao sábado, para não parar o trabalho",
          ],
        },
        oQueDizer: [
          "Quantos postos de trabalho, e o mobiliário: secretárias, cadeiras, armários, arquivo",
          "O equipamento delicado — computadores, monitores, impressoras — e quem o desliga e embala",
          "As duas moradas, o andar, o elevador e as regras do edifício para cargas e horários",
          "O NIF da empresa, para sair na factura",
        ],
        fatoresDePreco: [
          "O volume de mobiliário, arquivo e equipamento",
          "Os andares, os elevadores e as regras de cada edifício",
          "A hora — fora do expediente ou ao sábado",
          "Desmontar e montar secretárias e armários",
        ],
        faqs: [
          {
            question: "A factura sai com o NIF da empresa?",
            answer:
              "Sim. Todas as vendas têm factura, e no pedido indica o NIF da empresa para ela sair em seu nome.",
          },
          {
            question: "A mudança pode ser fora do horário de expediente?",
            answer: `Diga a hora que lhe serve no pedido: as propostas dizem quem a consegue cumprir. ${AO_FIM_DE_SEMANA}`,
          },
          {
            question: "Quem desliga e embala os computadores?",
            answer:
              "Combine-o no pedido. O habitual é a empresa desligar e identificar o equipamento, e o profissional embalar, proteger e transportar — se precisar que ele trate também da embalagem, diga-o para vir na proposta.",
          },
          {
            question: "Quanto custa uma mudança de escritório?",
            answer: `Depende do volume, dos andares e das regras dos dois edifícios, da hora e da distância. Não há tabela: recebe propostas ${PROPOSTAS_EM_ATE}, cada uma com o preço fechado antes de começar.`,
          },
        ],
        ctaTitulo: "A sua empresa vai mudar de sítio?",
        mensagemWhatsApp: "Olá! Preciso de uma mudança de escritório. Podem dar-me um orçamento?",
      }}
    />
  );
}
