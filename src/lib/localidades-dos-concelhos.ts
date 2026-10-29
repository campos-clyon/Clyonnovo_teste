/**
 * AS TERRAS QUE SE JUNTARAM AO CONCELHO — 28-10-2026 (d13, fase 1).
 *
 * A Amora e Corroios juntam-se ao Seixal, e a Costa da Caparica a Almada: as
 * páginas delas fazem 301 para a do mesmo serviço no concelho (ver
 * `paginas-consolidadas.ts`), e esta passa a falar delas. Sem esta secção não
 * há 301 — é a casa nova de quem procurava a terra.
 *
 * REGRA DESTE FICHEIRO, a de cidades-local.ts e recolha-da-camara.ts: nada
 * inventado. Fontes públicas, lidas a 28/29-10-2026:
 *   · população e localidades das freguesias — Censos de 2021 (INE), pelas
 *     páginas da Amora, de Corroios e da Costa da Caparica;
 *   · o IC20 liga à A2 (nó A2/IC20) e tem ramo directo para a ponte 25 de
 *     Abril — Infraestruturas de Portugal, 03-06-2025
 *     (infraestruturasdeportugal.pt/pt-pt/node/7484);
 *   · Corroios: estação da Fertagus e terminal do Metro Sul do Tejo;
 *   · Ecocentro de Vale de Milhaços e Ecoparque do Seixal — cm-seixal.pt e
 *     cm-almada.pt; recolha de monos e de entulho de Almada — cm-almada.pt.
 * O que não se confirmou numa fonte oficial (as saídas da A2 pelas listas de
 * nós que circulam na Internet) ficou de fora.
 *
 * Sem números de trabalhos nem de clientes. Os preços, a promessa do prazo e
 * a frase dos contentores vêm das fontes únicas, nunca escritos à mão.
 */
import { PROMESSA_DO_PRAZO } from "./promessas-publicas";
import { ESVAZIAMENTO_POR_TIPOLOGIA, PECAS_DE_REFERENCIA, PRECOS, desdeDoVolume } from "./precos-publicos";
import { ENTULHO_10_SACOS_NA_FRASE, faixaSemEComIva } from "./descricoes-seo";
import { comIva, euros } from "./quanto-custa";
import { NAO_HA_CONTENTORES, PESO_DO_SACO } from "./sacos-de-entulho";
import { MINIMO_DE_HORAS, PESSOAS_NA_EQUIPA, PRECO_POR_HORA, PRECO_POR_HORA_COM_IVA } from "./tabela-das-mudancas";

export interface LocalidadeDoConcelho {
  /** A terra, como se diz. */
  nome: string;
  /** O endereço que faz 301 para a página onde esta secção está. */
  enderecoAntigo: string;
  /** O H2 da secção. */
  titulo: string;
  /** 80–150 palavras: a terra, o que se pede lá, o preço sem e com IVA, e a promessa do prazo. */
  texto: string;
  /** Uma ligação interna dentro do texto, quando a há: `texto` tem de aparecer tal e qual no texto. */
  ligacao?: { texto: string; href: string };
}

/** «desde 120 € + IVA (147,60 € com IVA)» */
const desdeComIva = (v: number) => `desde ${euros(v)} + IVA (${euros(comIva(v))} com IVA)`;
const tipologia = (chave: string) => ESVAZIAMENTO_POR_TIPOLOGIA.find((t) => t.chave === chave)!;
const SOFA = PECAS_DE_REFERENCIA.find((p) => p.peca.startsWith("Sofá"))!;

const PRECO_SOFA = faixaSemEComIva(SOFA.minimo, SOFA.maximo);
const PRECO_MOVEIS = faixaSemEComIva(PRECOS.recolha_moveis.minimo!, PRECOS.recolha_moveis.maximo!);
const PRECO_MONOS = faixaSemEComIva(PRECOS.recolha_monos.minimo!, PRECOS.recolha_monos.maximo!);
const UM_METRO = desdeComIva(desdeDoVolume(1));
const TRES_METROS = desdeComIva(desdeDoVolume(3));
const ESV_T0_T1 = faixaSemEComIva(tipologia("T0/T1").minimo, tipologia("T0/T1").maximo!);
const ESV_T2 = faixaSemEComIva(tipologia("T2").minimo, tipologia("T2").maximo!);
const ESV_APARTAMENTO = faixaSemEComIva(
  PRECOS.esvaziamento_apartamento.minimo!,
  PRECOS.esvaziamento_apartamento.maximo!,
);
const ESV_MORADIA = desdeComIva(tipologia("moradia").minimo);
const HORA_DA_MUDANCA =
  `${euros(PRECO_POR_HORA)}/h + IVA (${euros(PRECO_POR_HORA_COM_IVA)}/h com IVA) ` +
  `pela equipa de ${PESSOAS_NA_EQUIPA}, mínimo ${MINIMO_DE_HORAS} horas`;

/** Chave: o caminho da página que fica, sem a barra inicial («recolha-moveis-seixal», «mudancas/seixal»). */
export const LOCALIDADES_DO_CONCELHO: Readonly<Record<string, LocalidadeDoConcelho[]>> = {
  "recolha-moveis-seixal": [
    {
      nome: "Amora",
      enderecoAntigo: "/recolha-moveis-amora",
      titulo: "Recolha de móveis na Amora",
      texto:
        `Com perto de 50 mil habitantes (Censos de 2021), a Amora junta a cidade — Amora e Cruz de Pau —, os Foros de Amora, o Fogueteiro, as Paivas, a Quinta da Princesa e parte de Belverde. Há prédios de vários andares e moradias com garagem, e é isso que o pedido deve dizer: o andar, se há elevador e se o sofá ou o roupeiro passa na porta. Um parceiro verificado da zona retira sofás, camas, armários e eletrodomésticos de dentro de casa, e desmonta-os se o pedir. Um sofá de 2 a 3 lugares fica em ${PRECO_SOFA}; vários móveis juntos, ${PRECO_MOVEIS}. ${PROMESSA_DO_PRAZO}`,
    },
    {
      nome: "Corroios",
      enderecoAntigo: "/recolha-moveis-corroios",
      titulo: "Recolha de móveis em Corroios",
      texto:
        `Corroios tem pouco mais de 50 mil habitantes (Censos de 2021) e junta o Miratejo, Santa Marta do Pinhal, Vale de Milhaços, o Alto do Moinho, o Pinhal do Vidal e a Verdizela. Nas torres do Miratejo, o que conta é o tamanho do elevador; nas moradias de Santa Marta do Pinhal e de Vale de Milhaços, a carrinha encosta ao portão, mas não se esqueça da garagem. Um parceiro verificado retira os móveis de dentro de casa, desmonta-os se o pedir e leva-os para destino licenciado, por ${PRECO_MOVEIS}. Se tiver carro e for só uma peça, o Ecocentro de Vale de Milhaços, no fim da Avenida Fábrica da Pólvora, recebe sofás e colchões sem custo. ${PROMESSA_DO_PRAZO}`,
    },
  ],
  "recolha-monos-seixal": [
    {
      nome: "Amora",
      enderecoAntigo: "/recolha-monos-amora",
      titulo: "Recolha de monos na Amora",
      texto:
        `Na Amora, os monos saem tanto das casas como das arrecadações e das garagens: o colchão velho, o móvel que sobrou de uma mudança, o eletrodoméstico que já não liga. A recolha da Câmara do Seixal é gratuita, mas faz-se à porta ou junto ao contentor, no dia da semana marcado para a freguesia. Quando o mono está num andar sem elevador — nos blocos mais antigos da Cruz de Pau, por exemplo —, tem de ser desmontado ou não pode esperar pela data, um parceiro verificado vai buscá-lo lá dentro e leva-o para destino licenciado, por ${PRECO_MONOS}. Mande uma fotografia e diga o andar. ${PROMESSA_DO_PRAZO}`,
    },
    {
      nome: "Corroios",
      enderecoAntigo: "/recolha-monos-corroios",
      titulo: "Recolha de monos em Corroios",
      texto:
        `Em Corroios, do Miratejo à Verdizela, há duas formas de se livrar de um mono sem pagar: marcar a recolha da Câmara do Seixal e deixá-lo à porta ou junto ao contentor no dia combinado, ou levá-lo ao Ecocentro de Vale de Milhaços, que fica na própria freguesia. Quando não há carro, nem quem ajude a descer o sofá, nem tempo para esperar pelo dia da freguesia, um parceiro verificado tira-o de dentro de casa, da garagem ou da arrecadação e leva-o para destino licenciado. Os monos ficam em ${PRECO_MONOS}, conforme o volume, o andar e o acesso. ${PROMESSA_DO_PRAZO}`,
    },
  ],
  "recolha-entulho-seixal": [
    {
      nome: "Amora",
      enderecoAntigo: "/recolha-entulho-amora",
      titulo: "Recolha de entulho na Amora",
      texto:
        `Uma casa de banho ou uma cozinha remodelada num prédio da Amora dá entulho que tem de descer escadas ou caber no elevador. Por isso recolhe-se em sacos de obra de ${PESO_DO_SACO}, carregados à mão pelo parceiro, ou a granel, se estiver solto. ${NAO_HA_CONTENTORES} Quem tem pouco entulho e carrinha própria pode levá-lo ao Ecoparque do Seixal, da Amarsul, que fica na Amora, no Pinhal Alto dos Carrascos, dentro dos limites que a Câmara publica. Para o resto, um parceiro verificado leva-o a operador licenciado: ${ENTULHO_10_SACOS_NA_FRASE}; 1 m³, o volume de uma casa de banho ou de uma cozinha, ${UM_METRO}. ${PROMESSA_DO_PRAZO}`,
    },
    {
      nome: "Corroios",
      enderecoAntigo: "/recolha-entulho-corroios",
      titulo: "Recolha de entulho em Corroios",
      texto:
        `Em Corroios, o tipo de casa muda o trabalho. Nas moradias de Santa Marta do Pinhal e de Vale de Milhaços, a carrinha costuma encostar ao portão e o entulho sai depressa; nas torres do Miratejo, desce de elevador, saco a saco, e convém avisar o condomínio. Em qualquer dos casos, recolhe-se em sacos de obra de ${PESO_DO_SACO} ou a granel, e não fica nada na rua à espera. ${NAO_HA_CONTENTORES} Uma remodelação de casa de banho cabe, em geral, em 1 m³, ${UM_METRO}; a obra de um T1 ou de um T2 vai até 3 m³, ${TRES_METROS}. O parceiro verificado que escolher leva o entulho a operador licenciado. ${PROMESSA_DO_PRAZO}`,
    },
  ],
  "esvaziamento-casas-seixal": [
    {
      nome: "Amora",
      enderecoAntigo: "/esvaziamento-casas-amora",
      titulo: "Esvaziamento de casas na Amora",
      texto:
        `Esvaziar uma casa na Amora — numa herança, no fim de um arrendamento ou antes de uma venda — é muitas vezes um trabalho de prédio, do Fogueteiro às Paivas e à Cruz de Pau: o andar, o elevador e o lugar para a carrinha decidem o tempo que leva. Diga-os no pedido, com fotografias de cada divisão e da arrecadação. Um parceiro verificado retira móveis, eletrodomésticos, roupa e tralha e deixa a casa vazia, pronta para entregar as chaves; o que quiser doar, separe antes. Como referência, um T2 fica em ${ESV_T2}. A recolha da Câmara só leva monos, e à porta: o recheio miúdo fica de fora. ${PROMESSA_DO_PRAZO}`,
    },
    {
      nome: "Corroios",
      enderecoAntigo: "/esvaziamento-casas-corroios",
      titulo: "Esvaziamento de casas em Corroios",
      texto:
        `Em Corroios há dois esvaziamentos diferentes. Num apartamento das torres do Miratejo, tudo desce de elevador, e contam o tamanho da cabina e a reserva com o condomínio. Numa moradia de Santa Marta do Pinhal ou de Vale de Milhaços, esvaziam-se também a garagem, o anexo e o quintal, que é onde mais coisas se juntam. Diga no pedido o que fica e o que sai, e mande fotografias de cada espaço, incluindo os de fora. Um parceiro verificado leva o recheio para destino licenciado e deixa a casa pronta a entregar ou a vender: um apartamento fica em ${ESV_APARTAMENTO}; uma moradia completa, ${ESV_MORADIA}. ${PROMESSA_DO_PRAZO}`,
    },
  ],
  "mudancas/seixal": [
    {
      nome: "Amora",
      enderecoAntigo: "/mudancas/amora",
      titulo: "Mudanças na Amora",
      texto:
        `Para quem muda de casa da Amora para Lisboa, a travessia é pela ponte 25 de Abril, com a portagem incluída na proposta. Nos prédios da Cruz de Pau e do Fogueteiro, diga o andar e se há elevador: cada andar feito a pé entra na proposta. Numa moradia, lembre-se da garagem e da arrecadação, que é o que mais se esquece no pedido e faz crescer o volume no dia. A mudança paga-se à hora, com carrinha, motorista e 2 ajudantes: ${HORA_DA_MUDANCA}. Quem a faz é o parceiro verificado que escolher entre as propostas. ${PROMESSA_DO_PRAZO}`,
    },
    {
      nome: "Corroios",
      enderecoAntigo: "/mudancas/corroios",
      titulo: "Mudanças em Corroios",
      texto:
        `Em Corroios, a mudança organiza-se pelo tipo de casa. Nas torres do Miratejo, combine o elevador com o condomínio e diga o andar; nas moradias de Santa Marta do Pinhal e de Vale de Milhaços, a carrinha encosta ao portão e a carga faz-se mais depressa. Corroios tem estação da Fertagus e o terminal do Metro Sul do Tejo, mas para os móveis o caminho é a estrada: Almada fica ao lado, e para Lisboa a travessia é pela ponte 25 de Abril, com a portagem na proposta. Paga-se à hora, pela tabela da CLYON: ${HORA_DA_MUDANCA}. Um parceiro verificado faz a mudança; a CLYON junta as propostas e acompanha o pedido até ao fim. ${PROMESSA_DO_PRAZO}`,
    },
  ],
  "recolha-moveis-almada": [
    {
      nome: "Costa da Caparica",
      enderecoAntigo: "/recolha-moveis-costa-da-caparica",
      titulo: "Recolha de móveis na Costa da Caparica",
      texto:
        `A freguesia da Costa da Caparica, com cerca de 14 mil habitantes (Censos de 2021), vai da cidade à Fonte da Telha, passando pelo Bairro do Foni, pela Courela do Pinhal e pelas Terras da Costa. Com muitas casas de férias e de arrendamento, os móveis juntam-se no fim de cada contrato: sofás-cama, colchões, mesas e cadeiras de varanda. Um parceiro verificado retira-os de dentro de casa, desmonta-os se o pedir e leva-os para destino licenciado, por ${PRECO_MOVEIS}. Se estiverem em bom estado, o guia sobre a recolha gratuita de móveis usados na Costa da Caparica explica como os doar. Entre junho e setembro, prefira a manhã: junto à praia, estacionar é difícil. ${PROMESSA_DO_PRAZO}`,
      ligacao: {
        texto: "o guia sobre a recolha gratuita de móveis usados na Costa da Caparica",
        href: "/blog/recolha-gratuita-de-moveis-usados-costa-da-caparica",
      },
    },
  ],
  "recolha-monos-almada": [
    {
      nome: "Costa da Caparica",
      enderecoAntigo: "/recolha-monos-costa-da-caparica",
      titulo: "Recolha de monos na Costa da Caparica",
      texto:
        `Na Costa da Caparica, a recolha de monos da Câmara de Almada é gratuita e marca-se com a Junta de Freguesia da Costa da Caparica, pela linha verde ou por email; os monos ficam no local e no dia combinados, nunca junto aos contentores. Serve quando os consegue pôr à porta e pode esperar pela data. Quando o mono está num andar sem elevador, numa garagem cheia ou numa casa de férias que tem de ficar livre antes do próximo inquilino, um parceiro verificado vai buscá-lo lá dentro e leva-o para destino licenciado, por ${PRECO_MONOS}. No verão, diga a rua: junto à praia, a carrinha pode ter de parar mais longe. ${PROMESSA_DO_PRAZO}`,
    },
  ],
  "recolha-entulho-almada": [
    {
      nome: "Costa da Caparica",
      enderecoAntigo: "/recolha-entulho-costa-da-caparica",
      titulo: "Recolha de entulho na Costa da Caparica",
      texto:
        `Para pequenas obras feitas pelo próprio morador, a Câmara de Almada tem um serviço de recolha de entulho, pago à taxa municipal, que também se pede no Espaço Cidadão da Costa da Caparica. Quando a obra é maior, tem empreiteiro ou não quer tratar disso, um parceiro verificado recolhe o entulho em sacos de obra de ${PESO_DO_SACO} ou a granel e leva-o a operador licenciado. ${NAO_HA_CONTENTORES} Se a obra for numa casa de férias, fazê-la fora da época facilita: entre junho e setembro, estacionar junto à praia é difícil. Pequenas quantidades: ${ENTULHO_10_SACOS_NA_FRASE}; 1 m³, ${UM_METRO}. ${PROMESSA_DO_PRAZO}`,
    },
  ],
  "esvaziamento-casas-almada": [
    {
      nome: "Costa da Caparica",
      enderecoAntigo: "/esvaziamento-casas-costa-da-caparica",
      titulo: "Esvaziamento de casas na Costa da Caparica",
      texto:
        `Na Costa da Caparica, com muitas casas de férias e de arrendamento, um esvaziamento é muitas vezes o fim de um contrato, uma venda ou uma herança — e uma casa que guarda o que se foi juntando em vários verões. Um parceiro verificado retira móveis, eletrodomésticos, roupa de cama e tralha e deixa a casa vazia, pronta para a entrega das chaves. Mande fotografias de cada divisão, da varanda e da arrecadação, e diga o andar e se há elevador. Como referência, um T0 ou T1 fica em ${ESV_T0_T1}. A recolha da Câmara de Almada só leva monos e marca-se com a junta: a roupa, a loiça e os livros ficam de fora. ${PROMESSA_DO_PRAZO}`,
    },
  ],
  "mudancas/almada": [
    {
      nome: "Costa da Caparica",
      enderecoAntigo: "/mudancas/costa-da-caparica",
      titulo: "Mudanças na Costa da Caparica",
      texto:
        `Para entrar ou sair da Costa da Caparica, a via rápida é o IC20, que liga à A2 e à ponte 25 de Abril; a portagem da ponte entra na proposta. Aqui, a época pesa mais do que a distância: entre junho e setembro, a zona junto à praia enche e não há onde encostar a carrinha, por isso vale a pena marcar de manhã cedo ou fora da época. Na Fonte da Telha e nas Terras da Costa, descreva o acesso até à porta. Paga-se à hora, pela tabela da CLYON: ${HORA_DA_MUDANCA}. Um parceiro verificado faz a mudança; a CLYON junta as propostas e acompanha o pedido até ao fim. ${PROMESSA_DO_PRAZO}`,
    },
  ],
};

/** As secções das terras que esta página absorveu («/recolha-moveis-seixal» ou «mudancas/seixal»). */
export function localidadesDaPagina(caminho: string): LocalidadeDoConcelho[] {
  return LOCALIDADES_DO_CONCELHO[caminho.replace(/^\//, "")] ?? [];
}

/** O texto partido à volta da ligação, para a página pôr o link no meio. */
export function textoComLigacao(l: LocalidadeDoConcelho): { antes: string; ligacao?: { texto: string; href: string }; depois: string } {
  if (!l.ligacao) return { antes: l.texto, depois: "" };
  const i = l.texto.indexOf(l.ligacao.texto);
  if (i < 0) return { antes: l.texto, depois: "" };
  return {
    antes: l.texto.slice(0, i),
    ligacao: l.ligacao,
    depois: l.texto.slice(i + l.ligacao.texto.length),
  };
}
