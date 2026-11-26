/**
 * O QUE O SITE SABE — a Vitória responde com ele. 27-10-2026 (decisão d11).
 *
 * *«O que está no site é conhecimento dela.»* — o dono, depois do #510, em que
 * a equipa teve de entrar para responder a uma pergunta que o site já
 * respondia. Aqui junta-se, num só texto, o que as páginas dizem: o que a
 * CLYON é, quem faz o trabalho, o prazo das propostas, os preços de
 * referência, o IVA e a factura, como se paga, o entulho e os contentores, a
 * mudança à hora, os itens a mais, o atendimento.
 *
 * LIDO DAS FONTES, NUNCA COPIADO: cada frase sai da constante que as páginas
 * usam (`promessas-publicas.ts`, `perguntas-frequentes-da-vitoria.ts`,
 * `seo-data.ts`, `precos-publicos.ts`, `sacos-de-entulho.ts`,
 * `tabela-das-mudancas.ts`, `itens-a-mais.ts`, `pagamento-na-plataforma.ts`).
 * Um preço que mude lá muda aqui no mesmo deploy — e a guarda das lições
 * (`EUROS_DAS_FONTES`) passa a aceitar o número novo e a recusar o velho.
 *
 * ESTE FICHEIRO É PURO.
 */
import { ITENS_A_MAIS_PARA_O_CLIENTE } from "./itens-a-mais";
import { novoModeloEmVigor } from "./novo-modelo";
import { REGRAS_DO_PAGAMENTO_PARA_O_MODELO } from "./o-pagamento-da-vitoria";
import { promessaGeral } from "./pagamento-na-plataforma";
import {
  O_IVA_NA_PROPOSTA,
  O_QUE_E_A_CARGA,
  PODE_MANDAR_IMAGENS,
  respostaComoSePaga,
} from "./perguntas-frequentes-da-vitoria";
import { agoraDoModelo } from "./relogio-do-modelo";
import {
  ENTULHO_ATE_10_SACOS,
  ENTULHO_POR_VOLUME,
  ESVAZIAMENTO_POR_TIPOLOGIA,
  GRANDES_EM_TEXTO,
  MANUTENCAO_POR_TIPO,
  NOME_DO_TAMANHO,
  PECAS_DE_REFERENCIA,
  PECAS_EM_TEXTO,
  PRECOS,
  PRECO_DA_PRIMEIRA_GRANDE,
  PRECO_POR_ITEM,
  RECOLHA_POR_ANDAR_E_PECA_GRANDE,
  PRECO_POR_SACO,
  RECOLHA_MINIMA_DOS_MOVEIS,
  RECOLHA_POR_ANDAR_COM_ELEVADOR,
  RECOLHA_POR_ANDAR_SEM_ELEVADOR,
  SEM_IVA_NA_FRASE,
  precoDaPeca,
  valorDeUmAndarAPe,
} from "./precos-publicos";
import {
  ACRESCIMO_POR_URGENCIA,
  AO_FIM_DE_SEMANA,
  DESMONTAGEM_A_PEDIDO,
  NO_MESMO_DIA,
  PRECO_FECHADO,
  PRECO_FECHADO_SEM_AS_FATURAS,
  QUEM_FAZ_O_TRABALHO,
  PROMESSA_DO_PRAZO,
} from "./promessas-publicas";
import { A_GRANEL, PESO_DO_SACO, RESPOSTA_SOBRE_CONTENTORES } from "./sacos-de-entulho";
import { PRAZO_DE_RESPOSTA, faturaEmPalavras } from "./seo-data";
import { AS_DUAS_FATURAS_DO_TRABALHO } from "./voz-da-vitoria";
import { servicosPorExtenso } from "./servicos-da-vitoria";
import {
  DESMONTAGEM_NA_MUDANCA,
  ELEVADOR_EXTERIOR,
  MATERIAIS,
  MINIMO_DE_HORAS,
  PESSOAS_NA_EQUIPA,
  POR_ANDAR_SEM_ELEVADOR,
  POR_ANDAR_SEM_ELEVADOR_POR_PESSOA,
  PRECO_POR_HORA,
  PRECO_POR_HORA_DUAS_PESSOAS,
  PRECO_POR_KM_LONGE,
  RAIO_INCLUIDO_KM,
} from "./tabela-das-mudancas";
import { eurosDaLista, precoDaMudancaNoWhatsApp, precoPublicoConhecido } from "./preco-publico-das-mudancas";
import { NOSSA_EQUIPA, PROPRIO_DIA } from "./frases-proibidas";
import { nomeDoServico } from "./service-categories";
import { TAXA_IVA } from "./taxas-plataforma";
import { DESDE_DA_MONTAGEM, EUROS_DA_MONTAGEM, REGRAS_DA_MONTAGEM, TABELA_DA_MONTAGEM, linhaDaTabelaEmTexto } from "./tabela-da-montagem";

/** «40 €», «13,50 €». */
function euros(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")} €`;
}

/** O valor com IVA, arredondado ao cêntimo — como o cliente o lê na proposta. */
export function comIva(n: number): number {
  return Math.round(n * (1 + TAXA_IVA) * 100) / 100;
}

/** «60 € + IVA (73,80 € com IVA)» — o valor sem IVA nunca sozinho. */
function maisIva(n: number): string {
  return `${euros(n)} + IVA (${euros(comIva(n))} com IVA)`;
}

/*
 * OS NÚMEROS DA d60 QUE A VITÓRIA DIZ — 17-11-2026 (d62/d63). Lidos das fontes:
 * o mínimo de uma mudança com 2 e com 3 pessoas (as horas mínimas da
 * referência), e o exemplo dos andares a pé com peças grandes (o mesmo do site).
 */
/** O mínimo de uma mudança na referência, sem IVA: as horas mínimas × a hora da equipa. */
export const MINIMO_DA_MUDANCA_COM: Readonly<Record<2 | 3, number>> = Object.freeze({
  2: PRECO_POR_HORA_DUAS_PESSOAS * MINIMO_DE_HORAS,
  3: PRECO_POR_HORA * MINIMO_DE_HORAS,
});
/** O exemplo dos andares: 3 peças grandes num 3.º andar sem elevador. */
export const EXEMPLO_DOS_ANDARES = { pecasGrandes: 3, andar: 3, valor: valorDeUmAndarAPe(3) * 3 } as const;

/** «4,80» — sempre com os cêntimos. */
const centimos = (n: number) => n.toFixed(2).replace(".", ",");

/** «40 – 120 € sem IVA (49,20 – 147,60 € com IVA)» — nunca o sem IVA sozinho. */
function faixa(minimo: number, maximo?: number): string {
  const sem = maximo != null ? `${minimo} – ${maximo} €` : `desde ${minimo} €`;
  const com =
    maximo != null
      ? `${euros(comIva(minimo))} – ${euros(comIva(maximo))}`.replace(/ € – /, " – ")
      : `desde ${euros(comIva(minimo))}`;
  return `${sem} sem IVA (${com} com IVA)`;
}

/**
 * Os serviços que publicam preço — o nome vem do mapa único
 * (service-categories.ts); aqui só o esclarecimento entre parênteses.
 */
const SERVICOS_COM_PRECO: ReadonlyArray<readonly [id: string, nota?: string]> = [
  ["recolha_moveis"],
  ["recolha_monos"],
  ["esvaziamento_casa"],
  ["esvaziamento_apartamento"],
  ["esvaziamento_garagem"],
  ["esvaziamento_sotao"],
  ["esvaziamento_cave"],
  ["manutencao_casa", "reparações"],
];

/** As linhas dos preços de referência — só dos serviços que a Vitória oferece. */
function linhasDosPrecos(): string[] {
  const linhas: string[] = [];
  for (const [id, nota] of SERVICOS_COM_PRECO) {
    const nome = nota ? `${nomeDoServico(id)} (${nota})` : nomeDoServico(id);
    const p = PRECOS[id];
    if (!p || p.minimo == null) continue;
    // Os móveis por peça (d6 v2, 03-11-2026): a frase do dono, peça a peça, com o com IVA de cada uma;
    // e a recolha mínima (d7, 04-11-2026), com os andares depois do mínimo.
    // Desde a d60 (16-11-2026) a primeira peça grande conta à parte — pelas frases da fonte (PECAS_EM_TEXTO).
    if (id === "recolha_moveis") {
      const ci = (v: number) => `${centimos(comIva(v))} €`;
      const grandesComIva = GRANDES_EM_TEXTO.replace(`${PRECO_DA_PRIMEIRA_GRANDE} €`, ci(PRECO_DA_PRIMEIRA_GRANDE)).replace(
        `${PRECO_POR_ITEM.grande} €`,
        ci(PRECO_POR_ITEM.grande),
      );
      linhas.push(
        `  · ${nome}, por peça: ${PECAS_EM_TEXTO} sem IVA (com IVA: pequena ${ci(PRECO_POR_ITEM.pequeno)}, média ${ci(PRECO_POR_ITEM.medio)}, ${grandesComIva}); ` +
          `recolha mínima ${euros(RECOLHA_MINIMA_DOS_MOVEIS)} sem IVA (${euros(comIva(RECOLHA_MINIMA_DOS_MOVEIS))} com IVA), que já inclui o parceiro ir a casa, carregar e levar ao destino certo; os andares somam-se depois do mínimo.`,
      );
      continue;
    }
    // Os monos com as peças contadas seguem a mesma conta e a mesma recolha mínima (d60).
    if (id === "recolha_monos") {
      linhas.push(`  · ${nome}: ${faixa(Math.max(p.minimo, RECOLHA_MINIMA_DOS_MOVEIS))}, com as peças contadas pela mesma tabela dos móveis.`);
      continue;
    }
    // O esvaziamento de casa desde o mais pequeno das tipologias (a moradia tem o seu «desde», nas linhas a seguir).
    if (id === "esvaziamento_casa") {
      linhas.push(`  · ${nome}: ${faixa(Math.min(...ESVAZIAMENTO_POR_TIPOLOGIA.map((t) => t.minimo)))}, conforme a tipologia (a seguir).`);
      continue;
    }
    linhas.push(`  · ${nome}: ${faixa(p.minimo, p.maximo)}.`);
  }
  for (const t of ESVAZIAMENTO_POR_TIPOLOGIA) linhas.push(`  · ${t.tipo}: ${faixa(t.minimo, t.maximo)}.`);
  // Os exemplos pela tabela das peças (d7): o sofá é uma peça grande, a mesa com cadeiras uma média.
  for (const p of PECAS_DE_REFERENCIA) {
    linhas.push(`  · ${p.peca}: ${NOME_DO_TAMANHO[p.tamanho]}, ${euros(precoDaPeca(p))} sem IVA (${euros(comIva(precoDaPeca(p)))} com IVA).`);
  }
  linhas.push(
    `  · Entulho até 10 sacos (sacos de ${PESO_DO_SACO}): ${faixa(ENTULHO_ATE_10_SACOS.minimo, ENTULHO_ATE_10_SACOS.maximo)}.`,
    // Os sacos um a um (d4, 03-11-2026): cada saco a mais conta o mesmo.
    `  · Entulho em sacos de ${PESO_DO_SACO}, cada saco: ${centimos(PRECO_POR_SACO.minimo)} – ${centimos(PRECO_POR_SACO.maximo)} € sem IVA (${centimos(comIva(PRECO_POR_SACO.minimo))} – ${centimos(comIva(PRECO_POR_SACO.maximo))} € com IVA); até 10 sacos conta o mínimo de 10.`,
  );
  // O granel ao preço dos sacos (d7, 04-11-2026): 1 m³ = 40 sacos.
  for (const v of ENTULHO_POR_VOLUME) linhas.push(`  · Entulho, ${v.m3} m³ (≈ ${v.sacos} sacos, ensacado ou a granel): ${faixa(v.de, v.ate)}.`);
  // Ao preço de cada parceiro (11-11-2026): o preço público, o último lido da base.
  linhas.push(`  · Mudança: ${precoDaMudancaNoWhatsApp(precoPublicoConhecido())}`);
  return linhas;
}

/**
 * O TEXTO PARA O MODELO — o que o site diz, frase a frase.
 *
 * Os preços vão com a regra do dono (11-10-2026): a Vitória NÃO estima o preço
 * do pedido de ninguém — o valor vem das propostas. Só diz um preço de
 * referência a quem pergunta pela tabela do site, sempre sem IVA com o valor
 * com IVA ao lado, e a dizer que o preço final é o da proposta.
 */
/**
 * O PREÇO FECHADO, SEM A FATURA DO MODELO DE ANTES — 15-11-2026 (d30). A frase
 * pública acaba em «Há fatura em todas as vendas.»; no modelo novo quem passa
 * as faturas é dito pela frase do Jurídico (`AS_DUAS_FATURAS_DO_TRABALHO`), e
 * a Vitória não pode ler as duas. A frase pública é do Site e não muda aqui.
 */
// d30 (Site): a frase das faturas saiu do fim do preço fechado para a sua própria constante.
export const PRECO_FECHADO_SEM_A_FATURA = PRECO_FECHADO_SEM_AS_FATURAS;

export function oQueOSiteSabe(agora: Date = agoraDoModelo()): string {
  const iva = `${Math.round(TAXA_IVA * 100)} %`;
  // d10: os textos do dinheiro pela data — até 15-11-2026, os de hoje.
  const novo = novoModeloEmVigor(agora);
  const promessa = promessaGeral(agora);
  const doPagamento = novo ? REGRAS_DO_PAGAMENTO_PARA_O_MODELO.map((r) => `\n- ${r}`).join("") : "";
  return `O QUE O SITE DA CLYON DIZ (clyon.pt) — é o teu conhecimento. Responde com isto, e só com isto:

QUEM É A CLYON
- A CLYON é uma plataforma: o cliente faz o pedido, parceiros da zona respondem com o preço deles, e o cliente escolhe. Serviços: ${servicosPorExtenso()}.
- ${QUEM_FAZ_O_TRABALHO}
- «É a CLYON que faz o trabalho?» ${promessa.faqQuemFaz}
- «Quem responde por um trabalho mal feito?» ${promessa.faqQuemResponde}
- ${AO_FIM_DE_SEMANA}

O PEDIDO E AS PROPOSTAS
- ${PROMESSA_DO_PRAZO} O pedido é grátis e sem compromisso.
- No mesmo dia? ${NO_MESMO_DIA}
- ${DESMONTAGEM_A_PEDIDO} ${ACRESCIMO_POR_URGENCIA}
- ${PODE_MANDAR_IMAGENS}

PREÇO, IVA E FATURA
- ${novo ? PRECO_FECHADO_SEM_A_FATURA : PRECO_FECHADO}
- ${novo ? AS_DUAS_FATURAS_DO_TRABALHO : faturaEmPalavras(agora)}
- ${O_IVA_NA_PROPOSTA}
- Por carga: ${O_QUE_E_A_CARGA}
- Itens a mais no dia (orçamento de valor total): ${ITENS_A_MAIS_PARA_O_CLIENTE}, combinado com o cliente antes de avançar.
- Preços de referência do site, ${SEM_IVA_NA_FRASE} — o preço final é sempre o da proposta do parceiro:
${linhasDosPrecos().join("\n")}
- Mudança à hora: nunca prometas um preço fixo — cada parceiro tem o seu preço por hora e o seu mínimo de horas, e o cliente escolhe na lista do simulador de mudanças. Um valor da referência diz-se sempre como referência («na referência…»), nunca como o preço da CLYON. Na referência (sem parceiros na lista): cada andar sem elevador ${maisIva(POR_ANDAR_SEM_ELEVADOR_POR_PESSOA)} por pessoa, ou seja ${maisIva(POR_ANDAR_SEM_ELEVADOR)} uma equipa de ${PESSOAS_NA_EQUIPA}; elevador exterior ${maisIva(ELEVADOR_EXTERIOR)}; a deslocação até ${RAIO_INCLUIDO_KM} km está incluída, e acima disso conta ${maisIva(PRECO_POR_KM_LONGE)} por km, ida e volta, mais portagens${precoPublicoConhecido().tipo === "parceiros" ? "" : `; mínimo de ${MINIMO_DE_HORAS} horas da referência: ${maisIva(MINIMO_DA_MUDANCA_COM[2])} com 2 pessoas, ${maisIva(MINIMO_DA_MUDANCA_COM[3])} com 3`}. Materiais de embalamento à parte (ex.: ${MATERIAIS.slice(0, 3)
    .map((m) => `${m.nome.toLowerCase()} ${maisIva(m.preco)} por ${m.unidade}`)
    .join("; ")}).

COMO SE PAGA
- ${respostaComoSePaga(agora)}${doPagamento}

ENTULHO
- ${RESPOSTA_SOBRE_CONTENTORES}
- ${A_GRANEL}
- A granel conta-se ao mesmo preço dos sacos: 1 m³ são cerca de ${ENTULHO_POR_VOLUME[0].sacos} sacos, ${faixa(ENTULHO_POR_VOLUME[0].de, ENTULHO_POR_VOLUME[0].ate)}.

MONTAGEM E DESMONTAGEM DE MÓVEIS (a tabela do site, valores «desde» — o parceiro propõe o valor final)
- O serviço começa ${DESDE_DA_MONTAGEM}. Por peça (montar):
${TABELA_DA_MONTAGEM.map((l) => `  · ${linhaDaTabelaEmTexto(l)}.`).join("\n")}
${REGRAS_DA_MONTAGEM.map((r) => `- ${r}`).join("\n")}
- Numa recolha, desmontar antes de levar conta metade da montagem da peça; numa mudança, desmontar e montar no destino conta 75 % da montagem e da desmontagem somadas.
- Numa mudança: ${DESMONTAGEM_NA_MUDANCA} É a única desmontagem dela. O «acesso difícil» (escadas estreitas, sem elevador, estacionamento longe) diz-se ao parceiro e também não soma horas; nunca o trates como desmontagem.
- Com as peças, o andar e o elevador, podes dizer a estimativa pela tabela (sempre como estimativa, com o IVA ao lado); o valor certo vem na proposta do parceiro.

ANDARES (por trabalho, nas recolhas por peça e no entulho)
- Com elevador: +${maisIva(RECOLHA_POR_ANDAR_COM_ELEVADOR)} por andar.
- Sem elevador, no entulho: +${maisIva(RECOLHA_POR_ANDAR_SEM_ELEVADOR)} por andar.
- Sem elevador, nos móveis e nos monos por peça: ${maisIva(RECOLHA_POR_ANDAR_E_PECA_GRANDE)} por andar e por peça grande, nunca menos de ${maisIva(RECOLHA_POR_ANDAR_SEM_ELEVADOR)} por andar. Ex.: ${EXEMPLO_DOS_ANDARES.pecasGrandes} peças grandes num ${EXEMPLO_DOS_ANDARES.andar}.º andar sem elevador, ${maisIva(EXEMPLO_DOS_ANDARES.valor)}.
- Uma peça grande que não cabe no elevador desce pela escada: os andares contam-se como sem elevador.
- O estacionamento a mais de 30 metros conta como mais um andar sem elevador.

O QUE NUNCA SE DIZ
- Nunca «no ${PROPRIO_DIA}» como promessa; nunca contentores nem big bags (a CLYON não os tem); nunca um preço que não esteja aqui em cima; nunca um preço sem IVA sozinho (o IVA é ${iva}).
- O preço do pedido de um cliente concreto não se estima: vem nas propostas, em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.
- Quem faz o trabalho é o parceiro escolhido, nunca «nós» nem «a ${NOSSA_EQUIPA}».
- Quem vai é um parceiro: uma empresa parceira, com a sua equipa — não uma pessoa sozinha. Diz sempre «parceiro» (a palavra antiga fazia os clientes pensar que ia uma pessoa só).`;
}

/* ── A guarda dos números ──────────────────────────────────────────────── */

/**
 * OS EUROS QUE O SITE PUBLICA — sem IVA e com IVA. Uma lição ou uma resposta
 * livre com um valor em euros fora desta lista fica bloqueada: nem a Vitória
 * nem uma lição mudam um preço.
 */
export const EUROS_DAS_FONTES: readonly number[] = (() => {
  const sem = new Set<number>();
  const juntar = (n: number | null | undefined) => {
    if (typeof n === "number" && Number.isFinite(n) && n > 0) sem.add(Math.round(n * 100) / 100);
  };
  for (const p of Object.values(PRECOS)) {
    juntar(p.minimo);
    juntar(p.maximo);
  }
  for (const t of ESVAZIAMENTO_POR_TIPOLOGIA) {
    juntar(t.minimo);
    juntar(t.maximo);
  }
  for (const p of PECAS_DE_REFERENCIA) juntar(precoDaPeca(p));
  juntar(RECOLHA_MINIMA_DOS_MOVEIS);
  juntar(ENTULHO_ATE_10_SACOS.minimo);
  juntar(ENTULHO_ATE_10_SACOS.maximo);
  for (const v of ENTULHO_POR_VOLUME) {
    juntar(v.de);
    juntar(v.ate);
  }
  // d4 e d6 (03-11-2026): os sacos um a um, os andares do entulho e dos móveis, as peças; e a grelha da manutenção por tipo (d1 v2).
  juntar(PRECO_POR_SACO.minimo);
  juntar(PRECO_POR_SACO.maximo);
  juntar(RECOLHA_POR_ANDAR_COM_ELEVADOR);
  juntar(RECOLHA_POR_ANDAR_SEM_ELEVADOR);
  for (const v of Object.values(PRECO_POR_ITEM)) juntar(v);
  // d60 (16-11-2026): a primeira peça grande e o andar a pé por peça grande.
  juntar(PRECO_DA_PRIMEIRA_GRANDE);
  juntar(RECOLHA_POR_ANDAR_E_PECA_GRANDE);
  for (const linha of Object.values(MANUTENCAO_POR_TIPO)) {
    for (const c of Object.values(linha)) {
      if (c.tipo === "faixa") {
        juntar(c.de);
        juntar(c.ate);
      } else if (c.tipo === "desde") juntar(c.de);
    }
  }
  for (const n of [
    PRECO_POR_HORA,
    PRECO_POR_HORA_DUAS_PESSOAS,
    PRECO_POR_HORA_DUAS_PESSOAS * MINIMO_DE_HORAS,
    PRECO_POR_KM_LONGE,
    ELEVADOR_EXTERIOR,
    POR_ANDAR_SEM_ELEVADOR,
    POR_ANDAR_SEM_ELEVADOR_POR_PESSOA,
    MINIMO_DA_MUDANCA_COM[2],
    MINIMO_DA_MUDANCA_COM[3],
    EXEMPLO_DOS_ANDARES.valor,
  ])
    juntar(n);
  for (const m of MATERIAIS) juntar(m.preco);
  // d132 (26-11-2026): a tabela da montagem — as peças, a desmontagem, os dois, a hora, o mínimo e os extras.
  for (const n of EUROS_DA_MONTAGEM) juntar(n);
  const todos = new Set<number>(sem);
  for (const n of sem) todos.add(comIva(n));
  return [...todos].sort((a, b) => a - b);
})();

/** «1.234,56», «13,50», «49.2», «120» → número. */
function lerNumero(cru: string): number {
  let t = cru.replace(/\s/g, "");
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "");
  t = t.replace(",", ".");
  return Number(t);
}

/** Os valores em euros escritos num texto: «40 €», «40 – 120 €», «€ 50», «32 euros». */
export function eurosNoTexto(texto: string): number[] {
  const out: number[] = [];
  // Os milhares com espaço («1 300 €», como `euros` os escreve) desde a d60: o T4 chega aos 1 300 €.
  const NUM = String.raw`\d{1,3}(?:[ \u00a0]\d{3})+(?:,\d{1,2})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
  const depois = new RegExp(
    String.raw`(${NUM})(?:\s*(?:€|euros?)?\s*(?:–|-|a|até)\s*(${NUM}))?\s*(?:€|euros?\b|eur\b)`,
    "gi",
  );
  for (const m of texto.matchAll(depois)) {
    out.push(lerNumero(m[1]));
    if (m[2]) out.push(lerNumero(m[2]));
  }
  const antes = new RegExp(String.raw`€\s*(${NUM})`, "g");
  for (const m of texto.matchAll(antes)) out.push(lerNumero(m[1]));
  return out.filter((n) => Number.isFinite(n));
}

/** O número bate com uma fonte (ao cêntimo)? */
export function euroDasFontes(n: number): boolean {
  // O «desde» das mudanças, quando há parceiros na lista (11-11-2026), também é fonte.
  const p = precoPublicoConhecido();
  if (eurosDaLista(p).some((v) => Math.abs(v - n) < 0.011)) return true;
  return EUROS_DAS_FONTES.some((f) => Math.abs(f - n) < 0.011);
}
