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
  HORAS_COM_TRES_PESSOAS,
  MATERIAIS,
  MINIMO_DA_MUDANCA,
  MINIMO_DE_HORAS,
  PESSOAS_NA_EQUIPA,
  POR_ANDAR_SEM_ELEVADOR,
  PRECO_POR_HORA,
  PRECO_POR_KM_LONGE,
  RAIO_INCLUIDO_KM,
  deslocacao,
  intervaloDeHorasEmTexto,
  referenciaDaCasa,
} from "@/lib/tabela-das-mudancas";
import { TAXA_IVA } from "@/lib/taxas-plataforma";
import {
  ofertaDaMudanca,
  precoDaMudancaNaCabeca,
  precoDaMudancaNaDescricao,
  type PrecoPublicoDasMudancas,
} from "@/lib/preco-publico-das-mudancas";
import { precoPublicoDasMudancas } from "@/lib/ler-preco-publico-das-mudancas";

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
 */
const pagina = paginaDePreco("/precos/mudancas");
const IVA = `${Math.round(TAXA_IVA * 100)} %`;
/** A referência de uma casa, em intervalo e com a proteção (11-11-2026): «310–410 €». */
type Casa = "T0" | "T1" | "T2" | "T3" | "T4+";
const faixa = (t: Casa) => {
  const o = referenciaDaCasa(t);
  return `${euros(o.totalSemIvaMinimo).replace(" €", "")}–${euros(o.totalSemIvaMaximo)}`;
};
const faixaComIva = (t: Casa) => {
  const o = referenciaDaCasa(t);
  return `${euros(comIva(o.totalSemIvaMinimo)).replace(" €", "")}–${euros(comIva(o.totalSemIvaMaximo))}`;
};
const KM_DO_EXEMPLO = 120;
const caixaMaisBarata = Math.min(...MATERIAIS.map((m) => m.preco));

const descricaoCom = (preco: PrecoPublicoDasMudancas) =>
  descricaoQueCabe([
    `Mudanças à hora, ${precoDaMudancaNaDescricao(preco)}.`,
    `Na referência, T1 ${faixa("T1")}, T2 ${faixa("T2")} + IVA.`,
    "Compare os parceiros e escolha.",
  ]);

export async function generateMetadata(): Promise<Metadata> {
  const descricao = descricaoCom(await precoPublicoDasMudancas());
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
        h1: "Quanto custa uma mudança?",
        resposta:
          `${precoDaMudancaNaCabeca(preco)} ` +
          `No simulador vê os parceiros disponíveis, com a nota, o preço por hora, a equipa de 2 ou 3 e o material, e escolhe; ` +
          `o valor final sai das horas, dos km e do material que confirma na folha do dia. ` +
          `Na referência (${euros(PRECO_POR_HORA)} + IVA por hora, ${euros(comIva(PRECO_POR_HORA))} com IVA, equipa de ${PESSOAS_NA_EQUIPA}), ` +
          `com a proteção dos móveis e do chão, um T1 fica em ${faixa("T1")}, um T2 em ${faixa("T2")} e um T3 em ${faixa("T3")}, sempre + IVA ` +
          `(um T3 com IVA: ${faixaComIva("T3")}). Um T3 leva ${intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS.T3)} com 3 pessoas — um dia inteiro.`,
        tabela: { titulo: "Na referência, por tipologia", linhas: linhasDasMudancas() },
        extras: {
          titulo: "Os extras, na referência",
          intro: "Somam-se às horas, quando se aplicam. Cada parceiro tem a sua tarifa: a hora, os km e o material de cada um vêem-se na lista.",
          linhas: extrasDasMudancas(),
        },
        exemplos: {
          titulo: "Quatro mudanças, com as contas feitas",
          intro:
            "Feitas pela tabela de referência. São estimativas: com o parceiro que escolher, a conta é a da tarifa dele, e paga-se pelas horas confirmadas na folha do dia.",
          itens: exemplosDeMudanca(),
        },
        caixa: {
          titulo: "O que vem na hora",
          itens: [
            "A carrinha e a equipa do parceiro — 2 ou 3 pessoas, à sua escolha",
            "Carregar, transportar e descarregar",
            "Os km do percurso, pela tarifa do parceiro",
            `Materiais de embalamento à parte, ao preço do parceiro (na referência, caixas a partir de ${euros(caixaMaisBarata)})`,
          ],
        },
        fatores: [
          "A tipologia, e quanta coisa vai",
          "Os andares e o elevador nas duas casas",
          "Desmontar e montar móveis",
          "O preço por hora do parceiro que escolher, e os km pela tarifa dele",
          "O estacionamento à porta das duas casas",
          "Ter tudo embalado antes do dia poupa horas",
        ],
        porConcelho: "mudancas",
        faqs: [
          {
            question: "Quanto custa a mudança de um T2?",
            answer:
              `Conta-se ${intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS.T2)} com 3 pessoas: na referência, com a proteção, ${faixa("T2")} + IVA (${faixaComIva("T2")} com IVA), ` +
              `com elevador nas duas casas e até ${RAIO_INCLUIDO_KM} km (cada andar sem elevador acresce ${euros(POR_ANDAR_SEM_ELEVADOR)}). Com o parceiro que escolher, é o preço por hora dele.`,
          },
          {
            question: "Quanto custa a mudança de um T0 ou T1?",
            answer:
              `Um T0 leva ${intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS.T0)} com 3 pessoas e um T1 ${intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS.T1)}, nunca menos do que o mínimo do parceiro. ` +
              `Na referência, com a proteção: T0 ${faixa("T0")} + IVA (${faixaComIva("T0")} com IVA), T1 ${faixa("T1")} + IVA (${faixaComIva("T1")} com IVA).`,
          },
          {
            question: "Quanto custa uma mudança para longe?",
            answer:
              `Os km contam pela tarifa de cada parceiro, e cada um diz até que distância vai. Na referência, até ${RAIO_INCLUIDO_KM} km de percurso a deslocação está incluída; acima disso, ${euros(PRECO_POR_KM_LONGE)} por km, ` +
              `contando todos os km, ida e volta, mais portagens: ${KM_DO_EXEMPLO} km são ${euros(deslocacao(KM_DO_EXEMPLO))} de deslocação, mais as horas.`,
          },
          {
            question: "O preço é fechado?",
            answer:
              "A hora é a do parceiro que escolher, e fica congelada no pedido; o total sai das horas, dos km e do material que confirma na folha do dia. " +
              "É por isso que vale a pena dizer no pedido o que vai, os andares e o elevador.",
          },
          {
            question: "Há um preço mínimo?",
            answer: `Sim: o mínimo de horas de cada parceiro, que se vê na lista. Na referência, ${MINIMO_DE_HORAS} horas da equipa, ${euros(MINIMO_DA_MUDANCA)} + IVA (${euros(comIva(MINIMO_DA_MUDANCA))} com IVA).`,
          },
          {
            question: "Os preços já têm IVA?",
            answer: `Os valores da tabela são sem IVA, e a coluna ao lado tem o valor com IVA (${IVA}); na lista dos parceiros, cada preço aparece sem e com IVA. ${PRECO_FECHADO}`,
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
        oferta: ofertaDaMudanca(preco),
        ctaTitulo: "Tem uma mudança para fazer?",
        mensagemWhatsApp: "Olá! Tenho uma mudança para fazer. Podem dar-me um orçamento?",
      }}
    />
  );
}
