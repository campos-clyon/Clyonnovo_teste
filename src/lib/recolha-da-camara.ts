/**
 * A RECOLHA DA CÂMARA, CONCELHO A CONCELHO — 07-10-2026.
 *
 * *«Temos que melhorar essas páginas e torná-las mais fortes.»* As páginas
 * «Recolha de Monos em X — Alternativa à Câmara» e as de entulho eram as mais
 * curtas e as mais parecidas entre si (metade do texto igual de uma terra
 * para a outra), e prometiam no título uma comparação que o texto não fazia.
 *
 * Quem pesquisa «recolha de monos em Almada» quer, muitas vezes, saber como
 * funciona a da câmara. Dizer-lho — como se pede, o que leva, quanto custa —
 * é o que torna a página útil; e é a partir daí que se percebe quando compensa
 * pedir a um profissional (dentro de casa, num dia certo, com desmontagem).
 *
 * REGRA DESTE FICHEIRO, a mesma de `cidades-local.ts`: nada aqui é inventado.
 * Cada frase sai das páginas oficiais em `fontes` (câmara, serviços
 * municipalizados ou o sistema de resíduos), lidas no dia indicado. O que as
 * fontes não confirmavam — um preço de 2026 por publicar, dois horários que se
 * contradizem — ficou de fora. Um concelho sem fonte confirmada fica sem
 * bloco: é melhor não dizer nada do que dar um número de telefone errado a
 * quem quer deitar fora um sofá.
 */

export type FonteOficial = {
  /** Quem publica — «Câmara Municipal de Almada». */
  nome: string;
  url: string;
};

export type InformacaoDaCamara = {
  /** Frases prontas a mostrar, e só com o que as fontes dizem. */
  texto: string;
  fontes: FonteOficial[];
};

export type RecolhaDaCamara = {
  /** O concelho, como se escreve — «Almada». */
  concelho: string;
  /** Como funciona a recolha de monos. */
  monos?: InformacaoDaCamara;
  /** O que o concelho faz com o entulho de pequenas obras. */
  entulho?: InformacaoDaCamara;
};

/** O dia em que as fontes foram lidas — os serviços municipais mudam. */
export const CONSULTADAS_EM = "2026-10-07";

/**
 * De que concelho é cada zona com página. Benfica é Lisboa; Queluz é Sintra; a
 * Costa da Caparica é Almada. É o concelho que presta o serviço, e não a
 * freguesia.
 */
export const CONCELHO_DA_ZONA: Record<string, string> = {
  lisboa: "lisboa",
  benfica: "lisboa",
  lumiar: "lisboa",
  alvalade: "lisboa",
  olivais: "lisboa",
  sintra: "sintra",
  "monte-abraao": "sintra",
  queluz: "sintra",
  cascais: "cascais",
  oeiras: "oeiras",
  carnaxide: "oeiras",
  amadora: "amadora",
  loures: "loures",
  odivelas: "odivelas",
  almada: "almada",
  "costa-da-caparica": "almada",
  seixal: "seixal",
  amora: "seixal",
  corroios: "seixal",
  barreiro: "barreiro",
  moita: "moita",
  montijo: "montijo",
  alcochete: "alcochete",
  setubal: "setubal",
  palmela: "palmela",
  sesimbra: "sesimbra",
};

// Os SIMAR servem Loures e Odivelas: o mesmo serviço de entulho nos dois.
const ENTULHO_DOS_SIMAR: InformacaoDaCamara = {
  texto:
    "Os SIMAR recolhem sem custo o entulho de pequenas obras feitas pelo próprio dono ou inquilino, até 1 m³ por obra: depois da marcação entregam um big bag e recolhem-no uma semana depois. O serviço é só para clientes dos SIMAR e só aceita betão, tijolo, ladrilho, telha, cerâmica, pladur, fios eléctricos e plásticos. Acima de 1 m³, o entulho tem de ir para um operador licenciado.",
  fontes: [
    {
      nome: "SIMAR Loures e Odivelas",
      url: "https://www.simar-louresodivelas.pt/index.php/residuos-de-construcao-e-demolicao-2",
    },
    {
      nome: "SIMAR Loures e Odivelas",
      url: "https://www.simar-louresodivelas.pt/index.php/residuos-de-construcao-e-demolicao-rcd",
    },
  ],
};

const VOLUMOSOS_DOS_SIMAR: FonteOficial = {
  nome: "SIMAR Loures e Odivelas",
  url: "https://www.simar-louresodivelas.pt/index.php/residuos-volumosos",
};

/** Os concelhos com informação confirmada numa fonte oficial. */
export const RECOLHA_DA_CAMARA: Record<string, RecolhaDaCamara> = {
  lisboa: {
    concelho: "Lisboa",
    monos: {
      texto:
        "A Câmara de Lisboa recolhe sem custo os monos das casas. Pede-se no Na Minha Rua LX, pelo 800 910 211 (chamada gratuita) ou na junta de freguesia. O dia, a hora e o local combinam-se com a Câmara, e levar os objetos até esse local é com quem os deita fora — deixá-los na rua sem esse acordo não é permitido.",
      fontes: [
        {
          nome: "Câmara Municipal de Lisboa",
          url: "https://informacoeseservicos.lisboa.pt/servicos/detalhe/pedido-de-intervencao-ambiente",
        },
        {
          nome: "Regulamento de Gestão de Resíduos, Limpeza e Higiene Urbana de Lisboa",
          url: "https://www.lisboa.pt/fileadmin/info_administrativa/normativas/regulamentos/ambiente/Regulamento_de_Gest%C3%A3o_de_Res%C3%ADduos_Limpeza_e_Higiene_Urbana_de_Lisboa.pdf",
        },
      ],
    },
    entulho: {
      texto:
        "Em Lisboa, a Câmara recolhe sem custo o entulho de obras particulares isentas de licença até 1 m³ por obra, a pedido; acima disso, a recolha é paga. O entulho tem de vir separado e sem resíduos perigosos, como o amianto. Os ecocentros da Valorsul não recebem entulho.",
      fontes: [
        {
          nome: "Regulamento de Gestão de Resíduos, Limpeza e Higiene Urbana de Lisboa",
          url: "https://www.lisboa.pt/fileadmin/info_administrativa/normativas/regulamentos/ambiente/Regulamento_de_Gest%C3%A3o_de_Res%C3%ADduos_Limpeza_e_Higiene_Urbana_de_Lisboa.pdf",
        },
        { nome: "Valorsul — Ecocentros", url: "https://www.valorsul.pt/pt/area-de-utilizador/ecocentros/" },
      ],
    },
  },

  amadora: {
    concelho: "Amadora",
    monos: {
      texto:
        "Na Amadora, a recolha de monos marca-se com a junta de freguesia ou com o Serviço de Higiene Urbana da Câmara (214 369 040 ou higiene.urbana@cm-amadora.pt), que recolhe de segunda a sábado, das 14h às 20h, num dia para cada freguesia. Os objetos só podem ser deixados no local, no dia e à hora combinados; abandoná-los na rua dá coima. Também se podem levar ao Ecocentro da Amadora, em Carenque, sem custo para os munícipes.",
      fontes: [
        {
          nome: "Câmara Municipal da Amadora",
          url: "https://www.cm-amadora.pt/pt/territorio/ambiente-novo/residuos-e-limpeza-urbana/8813-residuos-urbanos-indiferenciados-novo.html",
        },
        {
          nome: "Câmara Municipal da Amadora — Ecocentro",
          url: "https://www.cm-amadora.pt/pt/territorio/ambiente-novo/residuos-e-limpeza-urbana/8808-residuos-valorizaveis-ecocentro-novo.html",
        },
      ],
    },
    entulho: {
      texto:
        "Na Amadora, as juntas de freguesia recolhem, por marcação, entulho de obras em casa até 1 m³, e o Ecocentro da Amadora, em Carenque, recebe entulho em pequenas quantidades dos munícipes, sem custo. As empresas não podem lá descarregar entulho: numa obra de empreiteiro, o destino do entulho é responsabilidade de quem a faz.",
      fontes: [
        {
          nome: "Câmara Municipal da Amadora",
          url: "https://www.cm-amadora.pt/images/NOTICIAS/TERRITORIO/2026/AMBIENTE/Flyer_ARTE_FINAL_impresso.pdf",
        },
        {
          nome: "Código Regulamentar do Município da Amadora",
          url: "https://www.cm-amadora.pt/images/artigos/extra/amadorainforma/bm/2015/sprt17_revisao_codig_reg_municipio_7dez2015.pdf",
        },
        {
          nome: "Câmara Municipal da Amadora — Ecocentro",
          url: "https://www.cm-amadora.pt/pt/territorio/ambiente-novo/residuos-e-limpeza-urbana/8808-residuos-valorizaveis-ecocentro-novo.html",
        },
      ],
    },
  },

  odivelas: {
    concelho: "Odivelas",
    monos: {
      texto:
        "Em Odivelas, a recolha de monos pede-se à junta de freguesia ou aos SIMAR, pela linha gratuita 800 100 250 (24 horas por dia) ou por geral@simar-louresodivelas.pt. É gratuita para os clientes dos SIMAR, com data e local combinados, e os SIMAR respondem em até 5 dias úteis. Os monos só vão para junto do contentor, no máximo, 24 horas antes da recolha marcada.",
      fontes: [
        {
          nome: "Câmara Municipal de Odivelas",
          url: "https://www.cm-odivelas.pt/areas-de-intervencao/ambiente/monos-e-residuos-verdes",
        },
        VOLUMOSOS_DOS_SIMAR,
        {
          nome: "Regulamento de Resíduos e da Higiene e Limpeza de Espaços Públicos de Odivelas",
          url: "https://www.cm-odivelas.pt/cmodivelas/uploads/writer_file/document/721/regulamento_de_residuos_e_da_higiene_e_limpeza_de_espacos_publicos.pdf",
        },
      ],
    },
    entulho: ENTULHO_DOS_SIMAR,
  },

  loures: {
    concelho: "Loures",
    monos: {
      texto:
        "Em Loures, a Câmara manda pedir a recolha de monos aos SIMAR: linha gratuita 800 100 250 (24 horas por dia) ou geral@simar-louresodivelas.pt; também se pode marcar com a junta de freguesia. É gratuita para os clientes dos SIMAR, com data e local combinados, e a resposta chega em até 5 dias úteis. Os monos só vão para junto do contentor, no máximo, 24 horas antes da recolha.",
      fontes: [
        { nome: "Câmara Municipal de Loures", url: "https://www.cm-loures.pt/AreaConteudo.aspx?DisplayId=1765" },
        VOLUMOSOS_DOS_SIMAR,
        { nome: "Regulamento de Resíduos Sólidos e Limpeza Pública de Loures", url: "https://www.cm-loures.pt/media/pdf/PDF20141212161533829.pdf" },
      ],
    },
    entulho: ENTULHO_DOS_SIMAR,
  },

  sintra: {
    concelho: "Sintra",
    monos: {
      texto:
        "Em Sintra, a recolha de monos marca-se com a junta ou a união de freguesias da zona — os SMAS publicam os contactos de todas — e é gratuita até 10 peças por mês; acima disso paga-se a tarifa dos SMAS. Os monos só se põem no local e à hora combinados, sob pena de coima. Frigoríficos, máquinas de lavar e outros eletrodomésticos grandes recolhe-os em casa a Electrão, sem custo, pelo 800 262 333.",
      fontes: [
        { nome: "SMAS de Sintra", url: "https://www.smas-sintra.pt/monos-e-eletrodomesticos-volumosos/" },
        {
          nome: "SMAS de Sintra — regras de deposição",
          url: "https://www.smas-sintra.pt/residuos/rede-de-recolha-de-residuos-urbanos/ecocentros/regras-de-separacao-e-deposicao/",
        },
      ],
    },
    entulho: {
      texto:
        "Os SMAS de Sintra recolhem o entulho de obras isentas de licença até 1 m³ por obra, num big bag: pede-se pelo 800 210 020 (gratuito), por geral@smas-sintra.pt ou nos balcões dos SMAS, e o entulho tem de vir separado por materiais. O Centro de Deposição Temporária de São João das Lampas, junto ao cemitério, recebe sem custo o entulho de pequenas obras dos munícipes, de segunda a sábado, das 8h30 às 20h.",
      fontes: [
        {
          nome: "SMAS de Sintra",
          url: "https://www.smas-sintra.pt/residuos/rede-de-recolha-de-residuos-urbanos/residuos-de-construcao-e-demolicao/",
        },
        { nome: "SMAS de Sintra", url: "https://www.smas-sintra.pt/monos-e-eletrodomesticos-volumosos/" },
      ],
    },
  },

  cascais: {
    concelho: "Cascais",
    monos: {
      texto:
        "Em Cascais, a recolha de monos é gratuita e pede-se à Cascais Ambiente pela Linha Cascais, 800 203 186 (chamada gratuita, dias úteis das 9h às 18h), ou no FixCascais, com antecedência. Os objetos vão para a rua só no dia indicado e pelo tempo estritamente necessário; portas, janelas, loiças sanitárias e outros restos de obra não contam como monos.",
      fontes: [
        { nome: "Cascais Ambiente", url: "https://ambiente.cascais.pt/pt/servicos/recolha-objetos-uso" },
        { nome: "Cascais Ambiente", url: "https://ambiente.cascais.pt/pt/residuos-urbanos-sustentaveis" },
        {
          nome: "Regulamento de Serviço de Gestão de Resíduos Urbanos e Limpeza Urbana de Cascais",
          url: "https://ambiente.cascais.pt/sites/default/files/anexos/regulamento_de_servico_de_gestao_de_residuos_urbanos_e_limpeza_urbana.pdf",
        },
      ],
    },
    entulho: {
      texto:
        "A Cascais Ambiente recolhe o entulho de pequenas obras em casa, mas é um serviço pago, com pagamento antecipado: o entulho vai em big bag até 1 m³ (comprado por quem faz a obra) ou em sacos de ráfia até 50 litros, e a data combina-se depois de avaliados o acesso e o acondicionamento. Numa obra de empreiteiro, o destino do entulho é responsabilidade de quem a faz.",
      fontes: [
        {
          nome: "Regulamento de Serviço de Gestão de Resíduos Urbanos e Limpeza Urbana de Cascais",
          url: "https://ambiente.cascais.pt/sites/default/files/anexos/regulamento_de_servico_de_gestao_de_residuos_urbanos_e_limpeza_urbana.pdf",
        },
        { nome: "Cascais Ambiente", url: "https://ambiente.cascais.pt/pt/page/residuos-especiais" },
      ],
    },
  },

  oeiras: {
    concelho: "Oeiras",
    monos: {
      texto:
        "Em Oeiras, a recolha de monos pede-se ao Município pelo Número Verde 800 201 205 (gratuito) ou por daqv@oeiras.pt. O dia, a hora e o local combinam-se com a Câmara, nos dias de recolha de cada zona, e levar os monos até lá é com o munícipe; deixá-los na rua sem esse acordo não é permitido.",
      fontes: [
        {
          nome: "Câmara Municipal de Oeiras — «Cada resíduo no seu lugar»",
          url: "https://oeirasinterativa.oeiras.pt/dadosabertos/dataset/b2965561-5791-4fbf-9898-b3506013a9f0/resource/a09d4b5e-4db5-44d3-b31c-716f492ffabd/download/202305_cada-residuo-no-seu-lugar-folheto-pdf.pdf",
        },
        {
          nome: "Regulamento de Serviço de Gestão de Resíduos Urbanos de Oeiras",
          url: "https://www.oeiras.pt/documents/20124/156946/Regulamento+de+Servi%C3%A7o+de+Gest%C3%A3o+de+Res%C3%ADduos+Urbanos+e+de+Limpeza+e+Higiene+Urbana+do+Munic%C3%ADpio+de+Oeiras+-+DR.pdf/0e852834-3e17-1366-e3fd-4f7e540c02fa?t=1615461880294",
        },
      ],
    },
    entulho: {
      texto:
        "O Município de Oeiras recolhe sem custo o entulho de obras isentas de controlo prévio até 1 m³, em big bags, a pedido pelo 800 201 205 ou por geral@oeiras.pt — sem fibrocimento, betuminosos nem tintas. Acima de 1 m³, a recolha é feita por um operador licenciado, e o custo é do munícipe.",
      fontes: [
        {
          nome: "Câmara Municipal de Oeiras — «Cada resíduo no seu lugar»",
          url: "https://oeirasinterativa.oeiras.pt/dadosabertos/dataset/b2965561-5791-4fbf-9898-b3506013a9f0/resource/a09d4b5e-4db5-44d3-b31c-716f492ffabd/download/202305_cada-residuo-no-seu-lugar-folheto-pdf.pdf",
        },
        {
          nome: "Regulamento de Serviço de Gestão de Resíduos Urbanos de Oeiras",
          url: "https://www.oeiras.pt/documents/20124/156946/Regulamento+de+Servi%C3%A7o+de+Gest%C3%A3o+de+Res%C3%ADduos+Urbanos+e+de+Limpeza+e+Higiene+Urbana+do+Munic%C3%ADpio+de+Oeiras+-+DR.pdf/0e852834-3e17-1366-e3fd-4f7e540c02fa?t=1615461880294",
        },
      ],
    },
  },

  almada: {
    concelho: "Almada",
    monos: {
      texto:
        "Em Almada, a recolha de monos é gratuita e marca-se com a junta ou a união de freguesias, pela linha verde de cada uma — a de Almada, Cova da Piedade, Pragal e Cacilhas é o 800 100 304, e também aceita marcação online. Os monos ficam no local e na data combinados, nunca junto aos contentores ou ecopontos. Sofás, colchões e móveis também se podem levar ao Ecocentro de Almada, na Sobreda.",
      fontes: [
        { nome: "Câmara Municipal de Almada", url: "https://www.cm-almada.pt/o-que-e-um-mono-ou-monstro" },
        {
          nome: "União das Freguesias de Almada, Cova da Piedade, Pragal e Cacilhas",
          url: "https://www.uf-acppc.pt/noticias/espaco-publico/3010-recolha-de-residuos",
        },
        { nome: "Câmara Municipal de Almada — Ecocentro", url: "https://www.cm-almada.pt/viver/higiene-urbana/ecocentro-de-almada" },
      ],
    },
    entulho: {
      texto:
        "A Câmara de Almada recolhe o entulho de pequenas obras em casa em big bags de 1 m³, mediante uma taxa (47,02 € por metro cúbico na tabela de 2026): requisitam-se nos Espaços Cidadão da Costa da Caparica, da Sobreda e do Feijó. No saco só vai betão, tijolo, ladrilho, telha, cerâmica, terra e pedra — amianto, tintas, pladur, madeira e monos ficam de fora.",
      fontes: [
        {
          nome: "Câmara Municipal de Almada",
          url: "https://www.cm-almada.pt/viver/higiene-urbana/recolha-de-residuos-de-construcao-e-demolicao",
        },
        {
          nome: "Câmara Municipal de Almada — circular dos big bags",
          url: "https://www.cm-almada.pt/sites/default/files/2024-11/RECOLHA%20DE%20ENTULHOS_BIG%20BAG_CIRCULAR%20INFORMATIVA-1.pdf",
        },
        {
          nome: "Câmara Municipal de Almada — tabela de taxas",
          url: "https://www.cm-almada.pt/sites/default/files/2026-03/NOVO%20RGTMA.pdf",
        },
      ],
    },
  },

  seixal: {
    concelho: "Seixal",
    monos: {
      texto:
        "No Seixal, a recolha de monos é gratuita até 8 m³ e marca-se pela Linha Seixal Limpo, 210 976 011 (das 9h às 17h30), ou por seixal.limpo@cm-seixal.pt; a Câmara passa uma vez por semana, em dias fixos para cada freguesia. Os monos ficam à porta ou junto ao contentor mais próximo, no dia combinado. Também se podem entregar, sem custo, no Centro Municipal de Higiene Urbana de Fernão Ferro ou no Ecocentro de Vale de Milhaços.",
      fontes: [
        { nome: "Câmara Municipal do Seixal", url: "https://www.cm-seixal.pt/limpeza-urbana/residuos" },
        {
          nome: "Regulamento do Serviço de Gestão de Resíduos Urbanos do Seixal",
          url: "https://www.cm-seixal.pt/sites/default/files/documents/reg_servico_gestao_residuos_urbanos_0.pdf",
        },
      ],
    },
    entulho: {
      texto:
        "A Câmara do Seixal aluga big bags de 1 m³ para obras isentas de licença (31,76 € mais IVA em 2026) e recolhe-os cheios; requisitam-se nos Serviços Online, nos Serviços Centrais ou nas lojas do munícipe. No saco só vai betão, tijolo, ladrilho, telha, cerâmica, terra e pedra. Também se pode entregar entulho, sem custo, no Centro Municipal de Higiene Urbana de Fernão Ferro (até 1 m³ por dia, já triado) ou no Ecoparque do Seixal, da Amarsul (até 1 tonelada por semana).",
      fontes: [
        { nome: "Câmara Municipal do Seixal", url: "https://www.cm-seixal.pt/limpeza-urbana/residuos" },
        {
          nome: "Câmara Municipal do Seixal — folheto dos big bags",
          url: "https://www.cm-seixal.pt/sites/default/files/folheto_big_bags_municipe.pdf",
        },
        {
          nome: "Câmara Municipal do Seixal — tarifas de 2026",
          url: "https://www.cm-seixal.pt/sites/default/files/editais/019_atualizacao_de_tarifas.pdf",
        },
        {
          nome: "Câmara Municipal do Seixal — normas do Centro de Fernão Ferro",
          url: "https://www.cm-seixal.pt/sites/default/files/normas_aceitacao_final.pdf",
        },
      ],
    },
  },

  barreiro: {
    concelho: "Barreiro",
    monos: {
      texto:
        "No Barreiro, a recolha de monos é gratuita: liga-se para o 212 068 068 (linha só para marcações, nos dias úteis) e combina-se a recolha com a Câmara. O regulamento pede o pedido com cinco dias úteis de antecedência, e os monos só saem para o local indicado depois de confirmada a recolha. Colchões, móveis e sofás também se podem entregar, sem custo, no Ecocentro do Barreiro, no Lavradio.",
      fontes: [
        {
          nome: "Câmara Municipal do Barreiro",
          url: "https://www.cm-barreiro.pt/viver/aguas-e-higiene-urbana/residuos-e-higiene-urbana/recolha-de-monos/",
        },
        {
          nome: "Câmara Municipal do Barreiro — horários de recolha",
          url: "https://www.cm-barreiro.pt/viver/aguas-e-higiene-urbana/residuos-e-higiene-urbana/horarios-recolha/",
        },
        {
          nome: "Regulamento de Resíduos Urbanos e Higiene Urbana do Barreiro",
          url: "https://www.cm-barreiro.pt/wp-content/uploads/2023/04/regulamento_residuos_urbanos_e_higiene_urbana.pdf",
        },
        { nome: "Amarsul — Ecocentros", url: "https://www.amarsul.pt/pt/areas-de-negocio/servicos-recolha-seletiva/ecocentros/" },
        { nome: "Amarsul — Instalações", url: "https://www.amarsul.pt/pt/contactos/instalacoes/" },
      ],
    },
    entulho: {
      texto:
        "Para pequenas obras de conservação em casa, sem licença, a Câmara do Barreiro cede sacos de 1 m³, mediante tarifa, e recolhe-os — até 6 sacos por local, entregues por oito dias seguidos. Em alternativa, pode recorrer-se a um operador licenciado de gestão de resíduos.",
      fontes: [
        {
          nome: "Regulamento de Resíduos Urbanos e Higiene Urbana do Barreiro",
          url: "https://www.cm-barreiro.pt/wp-content/uploads/2023/04/regulamento_residuos_urbanos_e_higiene_urbana.pdf",
        },
      ],
    },
  },

  moita: {
    concelho: "Moita",
    monos: {
      texto:
        "Na Moita, a recolha de monos é gratuita e não precisa de marcação: a Câmara passa em circuitos fixos, e os monos põem-se junto aos contentores do lixo comum só nos dias da zona — na Baixa da Banheira, à segunda e à quinta; na Vila da Moita, ao domingo e à quarta. Nunca junto aos ecopontos, e sem eletrodomésticos nem entulho: os eletrodomésticos grandes recolhe-os a Electrão, sem custo, pelo 800 262 333. Também se podem levar ao Ecocentro de Alhos Vedros.",
      fontes: [
        { nome: "Câmara Municipal da Moita", url: "https://www.cm-moita.pt/viver/agua-e-ambiente/ambiente/residuos-43" },
        { nome: "Câmara Municipal da Moita", url: "https://www.cm-moita.pt/noticia-772/o-que-e-considerado-mono" },
      ],
    },
    entulho: {
      texto:
        "Na Moita, o entulho de obras isentas de licença é da responsabilidade da Câmara: requisitam-se «sacões» de cerca de 1 m³ nos balcões de atendimento da Câmara, com pagamento prévio de uma tarifa, Cartão de Cidadão e comprovativo de morada (fatura da água), e os serviços municipais recolhem-nos depois. Há um limite de três sacos, e o entulho nunca se deixa na rua nem em terrenos baldios.",
      fontes: [
        { nome: "Câmara Municipal da Moita", url: "https://www.cm-moita.pt/viver/agua-e-ambiente/ambiente/residuos-43" },
      ],
    },
  },

  montijo: {
    concelho: "Montijo",
    monos: {
      texto:
        "No Montijo, a recolha de monos é gratuita. Na União de Freguesias de Montijo e Afonsoeiro marca-se com o Serviço de Higiene Urbana da Câmara, pelo 212 327 837 (segunda a sábado, das 8h às 14h), e o serviço passa na data e hora combinadas; nas outras freguesias, quem recolhe é a junta. Sofás, colchões e móveis também se podem entregar, sem custo, no Ecocentro do Seixalinho, com contacto prévio.",
      fontes: [
        { nome: "Município do Montijo", url: "https://www.mun-montijo.pt/viver/ambiente/residuos/recolha-de-monos-e-verdes" },
        { nome: "Município do Montijo — Ecocentro do Seixalinho", url: "https://www.mun-montijo.pt/viver/ambiente/residuos/ecocentro-do-seixalinho" },
      ],
    },
    entulho: {
      texto:
        "No Montijo, a Câmara recolhe o entulho de obras isentas de licença em big bags fornecidos por ela, mediante tarifa (174,45 € por saco na tabela de 2026). Objetos grandes ou cortantes — loiças sanitárias, madeiras, ferros, vidros, azulejos — não vão dentro do saco: ficam ao lado, acondicionados. O Ecocentro do Seixalinho não recebe entulho.",
      fontes: [
        {
          nome: "Regulamento de Resíduos Sólidos do Montijo",
          url: "https://www.mun-montijo.pt/cmmontijo/uploads/document/file/10257/regulamento_residuos_solidos.pdf",
        },
        {
          nome: "Município do Montijo — tabela de tarifas de 2026",
          url: "https://www.mun-montijo.pt/cmmontijo/uploads/document/file/21566/tabela_tarifas_2026.pdf",
        },
        {
          nome: "Normas dos ecocentros da Amarsul (Município do Montijo)",
          url: "https://www.mun-montijo.pt/cmmontijo/uploads/writer_file/document/13279/a15d_002_normas_de_utilizacao_ecocentros.pdf",
        },
      ],
    },
  },
  alcochete: {
    concelho: "Alcochete",
    monos: {
      texto:
        "Em Alcochete, a recolha de monos é gratuita e marca-se com a Câmara (Divisão do Ambiente, Higiene Urbana e Espaços Verdes), pelo 212 348 671 (dias úteis, das 9h às 12h30 e das 14h às 17h30) ou por dahuev@cm-alcochete.pt. A data e a hora combinam-se, e levar os monos até ao local indicado é com o munícipe; pô-los na rua sem a recolha confirmada é proibido. Também se podem entregar, sem custo, no Ecocentro de Alcochete.",
      fontes: [
        { nome: "Câmara Municipal de Alcochete", url: "https://www.cm-alcochete.pt/Detalhe/higiene%20urbana" },
        {
          nome: "Regulamento do Serviço de Gestão de Resíduos Urbanos de Alcochete",
          url: "https://bo.cm-alcochete.pt/fileUploads/municipio/camara-municipal/regulamentos/regulamento_servico_gestao_residuos_urbanos_limpeza.pdf",
        },
      ],
    },
    entulho: {
      texto:
        "Em Alcochete, a Câmara recolhe o entulho de pequenas obras em casa, isentas de licença, num big bag pago: pede-se no Balcão Virtual (área Urbanismo) ou nos Paços do Concelho, levanta-se o saco no estaleiro municipal depois de pagar e, quando estiver cheio, marca-se a recolha pelo 212 348 671. Objetos grandes ou cortantes — loiças sanitárias, madeiras, ferros, vidros, azulejos — ficam ao lado do saco, acondicionados.",
      fontes: [
        { nome: "Câmara Municipal de Alcochete", url: "https://www.cm-alcochete.pt/Detalhe/higiene%20urbana" },
        {
          nome: "Regulamento do Serviço de Gestão de Resíduos Urbanos de Alcochete",
          url: "https://bo.cm-alcochete.pt/fileUploads/municipio/camara-municipal/regulamentos/regulamento_servico_gestao_residuos_urbanos_limpeza.pdf",
        },
      ],
    },
  },

  setubal: {
    concelho: "Setúbal",
    monos: {
      texto:
        "Em Setúbal, a recolha de monos — móveis, colchões, eletrodomésticos e outros objetos fora de uso — é gratuita e marca-se com os Serviços Municipalizados (SMS) pelo 800 210 522 (chamada gratuita) ou pelo 265 245 900, antes de pôr o que quer que seja na rua. Acima de 3 m³, a remoção é paga à tonelada. E as lojas que vendem eletrodomésticos grandes são obrigadas por lei a recolher o usado.",
      fontes: [
        {
          nome: "Serviços Municipalizados de Setúbal",
          url: "https://sms-setubal.pt/sms-residuos/recolha-de-monos-e-objetos-fora-de-uso/",
        },
        {
          nome: "Serviços Municipalizados de Setúbal — tarifário de 2026",
          url: "https://sms-setubal.pt/wp-content/uploads/2026/03/Tarifario-2026_Residuos-com-Servicos-Auxiliares-VC.pdf",
        },
      ],
    },
    entulho: {
      texto:
        "Os SMS de Setúbal recolhem o entulho de pequenas obras domésticas em todo o concelho, num big bag de 1 m³ que se compra aos próprios serviços — 36 € mais IVA em 2026, com a recolha incluída —, no Parque Municipal de Poçoilos, nas lojas SMS de Setúbal e de Azeitão ou nas juntas de Gâmbia-Pontes-Alto da Guerra e do Sado. Na compra marca-se o dia e o local; a partir daí há 10 dias para o encher, e no máximo três sacos. Só entulho, sem amianto e sem misturas.",
      fontes: [
        {
          nome: "Serviços Municipalizados de Setúbal",
          url: "https://sms-setubal.pt/sms-residuos/recolha-residuos-construcao-demolicao/",
        },
        {
          nome: "Serviços Municipalizados de Setúbal — tarifário de 2026",
          url: "https://sms-setubal.pt/wp-content/uploads/2026/03/Tarifario-2026_Residuos-com-Servicos-Auxiliares-VC.pdf",
        },
      ],
    },
  },

  palmela: {
    concelho: "Palmela",
    monos: {
      texto:
        "Em Palmela, a Câmara recolhe os monos com marcação — por escrito, pelo 212 336 624 ou ao balcão; em Poceirão e Marateca, com a união de freguesias. Até 1 m³, ficam junto aos contentores só na véspera do dia de recolha da zona (na vila de Palmela, à segunda e à quinta; no Pinhal Novo, ao domingo e à quarta); entre 1 e 3 m³ combina-se antes com os serviços, e acima disso recorre-se a um operador licenciado. Deixá-los fora dos dias marcados dá coima. Os residentes também os podem entregar no Centro de Transferência de Resíduos Valorizáveis de Pinhal Novo, até 3 m³.",
      fontes: [
        {
          nome: "Câmara Municipal de Palmela",
          url: "https://www.cm-palmela.pt/viver/ambiente/residuos/residuos-volumosos-ou-monos",
        },
        {
          nome: "Câmara Municipal de Palmela — calendário de recolha",
          url: "https://www.cm-palmela.pt/cmpalmela/uploads/writer_file/document/20726/tabela_recolha_monos_residuos_verdes.pdf",
        },
        {
          nome: "Câmara Municipal de Palmela — Centro de Transferência de Pinhal Novo",
          url: "https://www.cm-palmela.pt/viver/ambiente/residuos/residuos-volumosos-ou-monos/centro-de-transferencia-de-residuos-valorizaveis-de-pinhal-novo",
        },
      ],
    },
    entulho: {
      texto:
        "Em Palmela, a Câmara aluga um sacão de 1 m³ para o entulho de pequenas obras isentas de licença (24,86 € mais IVA em 2026): pede-se por escrito nos balcões de atendimento, dois de cada vez, com 15 dias para o usar, e a recolha faz-se na data combinada — com o saco na rua, ao alcance da grua, e sem o encher até cima. O Centro de Transferência de Pinhal Novo também recebe entulho de pequenas obras dos particulares, até 3 m³, sem pladur, isolamentos nem amianto.",
      fontes: [
        {
          nome: "Câmara Municipal de Palmela",
          url: "https://www.cm-palmela.pt/viver/ambiente/residuos/fluxos-especificos-de-residuos/entulhos-de-pequenas-obras",
        },
        {
          nome: "Câmara Municipal de Palmela — tabela de tarifas de 2026",
          url: "https://www.cm-palmela.pt/cmpalmela/uploads/writer_file/document/28606/tabela_de_tarifas_e_precos_do_municipio_de_palmela_e_regulamento_de_aplicacao_e_cobranca_2026.pdf",
        },
        {
          nome: "Câmara Municipal de Palmela — Centro de Transferência de Pinhal Novo",
          url: "https://www.cm-palmela.pt/viver/ambiente/residuos/fluxos-especificos-de-residuos/residuos-de-equipamentos-eletricos-e-eletronicos",
        },
      ],
    },
  },

  sesimbra: {
    concelho: "Sesimbra",
    monos: {
      texto:
        "Em Sesimbra, a Câmara recolhe monos sem custo, até 1100 litros de cada vez: pede-se pela app Nós Sesimbra, pelo 21 228 85 82 ou no Balcão Único de Serviços, e a recolha marca-se dentro do horário do serviço. Para grandes quantidades, aluga-se um contentor de 3 ou 7 m³. Também se podem entregar nos pontos REMOVE (Quinta do Conde, Lagoa de Albufeira, Zambujal e Maçã) ou, sem custo, no Ecocentro da Amarsul no Pinhal do Cabedal.",
      fontes: [
        { nome: "Câmara Municipal de Sesimbra", url: "https://www.sesimbra.pt/viver/ambiente/higiene-urbana/recolha-ao-domicilio" },
        { nome: "Câmara Municipal de Sesimbra — monos", url: "https://www.sesimbra.pt/viver/ambiente/higiene-urbana/monos-domesticos" },
        { nome: "Câmara Municipal de Sesimbra — REMOVE", url: "https://www.sesimbra.pt/viver/ambiente/higiene-urbana/remove" },
        { nome: "Câmara Municipal de Sesimbra — Ecocentro", url: "https://www.sesimbra.pt/viver/ambiente/higiene-urbana/ecocentro" },
      ],
    },
    entulho: {
      texto:
        "Em Sesimbra, a Câmara aluga big bags de 1 m³ para o entulho de pequenas obras isentas de licença, no Balcão Único de Serviços e no atendimento da Quinta do Conde: dois sacos por pedido e até cinco por casa, só com betão, tijolo, ladrilho e cerâmica. O saco fica fora da propriedade, ao alcance de um camião, e é recolhido quando se avisa, quando a Câmara o vê cheio ou ao fim de 15 dias.",
      fontes: [
        {
          nome: "Câmara Municipal de Sesimbra",
          url: "https://www.sesimbra.pt/viver/ambiente/higiene-urbana/residuos-de-construcao-e-demolicao",
        },
      ],
    },
  },
};

/** A recolha da câmara do concelho desta zona, quando há fonte confirmada. */
export function recolhaDaCamara(zona: string): RecolhaDaCamara | null {
  const concelho = CONCELHO_DA_ZONA[zona];
  return (concelho && RECOLHA_DA_CAMARA[concelho]) || null;
}
