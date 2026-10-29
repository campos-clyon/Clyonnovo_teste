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
import { ACRESCIMO_POR_ITEM_EXTRA } from "./itens-a-mais";
import { PROMESSA } from "./pagamento-na-plataforma";
import { O_IVA_NA_PROPOSTA, O_QUE_E_A_CARGA, PODE_MANDAR_IMAGENS } from "./perguntas-frequentes-da-vitoria";
import {
  ENTULHO_ATE_10_SACOS,
  ENTULHO_POR_M3_ACIMA_DE_1,
  ENTULHO_POR_VOLUME,
  ESVAZIAMENTO_POR_TIPOLOGIA,
  PECAS_DE_REFERENCIA,
  PRECOS,
  SEM_IVA_NA_FRASE,
} from "./precos-publicos";
import {
  ACRESCIMO_POR_URGENCIA,
  AO_FIM_DE_SEMANA,
  DESMONTAGEM_A_PEDIDO,
  NO_MESMO_DIA,
  PRECO_FECHADO,
  QUEM_FAZ_O_TRABALHO,
  PROMESSA_DO_PRAZO,
} from "./promessas-publicas";
import { A_GRANEL, PESO_DO_SACO, RESPOSTA_SOBRE_CONTENTORES } from "./sacos-de-entulho";
import { COMO_SE_PAGA, FACTURA_EM_PALAVRAS, PRAZO_DE_RESPOSTA } from "./seo-data";
import { servicosPorExtenso } from "./servicos-da-vitoria";
import {
  ELEVADOR_EXTERIOR,
  MATERIAIS,
  MINIMO_DA_MUDANCA,
  MINIMO_DE_HORAS,
  POR_ANDAR_SEM_ELEVADOR,
  POR_ANDAR_SEM_ELEVADOR_POR_PESSOA,
  PRECO_DA_MUDANCA_POR_EXTENSO,
  PRECO_POR_HORA,
  PRECO_POR_KM_LONGE,
} from "./tabela-das-mudancas";
import { NOSSA_EQUIPA, PROPRIO_DIA } from "./frases-proibidas";
import { nomeDoServico } from "./service-categories";
import { TAXA_IVA } from "./taxas-plataforma";

/** «40 €», «13,50 €». */
function euros(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")} €`;
}

/** O valor com IVA, arredondado ao cêntimo — como o cliente o lê na proposta. */
export function comIva(n: number): number {
  return Math.round(n * (1 + TAXA_IVA) * 100) / 100;
}

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
  ["esvaziamento_casa", "moradia"],
  ["esvaziamento_apartamento"],
  ["manutencao_casa", "reparações"],
];

/** As linhas dos preços de referência — só dos serviços que a Vitória oferece. */
function linhasDosPrecos(): string[] {
  const linhas: string[] = [];
  for (const [id, nota] of SERVICOS_COM_PRECO) {
    const nome = nota ? `${nomeDoServico(id)} (${nota})` : nomeDoServico(id);
    const p = PRECOS[id];
    if (!p || p.minimo == null) continue;
    linhas.push(`  · ${nome}: ${faixa(p.minimo, p.maximo)}.`);
  }
  for (const t of ESVAZIAMENTO_POR_TIPOLOGIA) linhas.push(`  · ${t.tipo}: ${faixa(t.minimo, t.maximo)}.`);
  for (const p of PECAS_DE_REFERENCIA) linhas.push(`  · ${p.peca}: ${faixa(p.minimo, p.maximo)}.`);
  linhas.push(
    `  · Entulho até 10 sacos (sacos de ${PESO_DO_SACO}): ${faixa(ENTULHO_ATE_10_SACOS.minimo, ENTULHO_ATE_10_SACOS.maximo)}.`,
  );
  for (const v of ENTULHO_POR_VOLUME) linhas.push(`  · Entulho até ${v.m3} m³: ${faixa(v.desde)}.`);
  linhas.push(`  · Mudança: ${PRECO_DA_MUDANCA_POR_EXTENSO}`);
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
export function oQueOSiteSabe(): string {
  const iva = `${Math.round(TAXA_IVA * 100)} %`;
  return `O QUE O SITE DA CLYON DIZ (clyon.pt) — é o teu conhecimento. Responde com isto, e só com isto:

QUEM É A CLYON
- A CLYON é uma plataforma: o cliente faz o pedido, parceiros verificados da zona respondem com o preço deles, e o cliente escolhe. Serviços: ${servicosPorExtenso()}.
- ${QUEM_FAZ_O_TRABALHO}
- «É a CLYON que faz o trabalho?» ${PROMESSA.faqQuemFaz}
- «Quem responde por um trabalho mal feito?» ${PROMESSA.faqQuemResponde}
- ${AO_FIM_DE_SEMANA}

O PEDIDO E AS PROPOSTAS
- ${PROMESSA_DO_PRAZO} O pedido é grátis e sem compromisso.
- No mesmo dia? ${NO_MESMO_DIA}
- ${DESMONTAGEM_A_PEDIDO} ${ACRESCIMO_POR_URGENCIA}
- ${PODE_MANDAR_IMAGENS}

PREÇO, IVA E FATURA
- ${PRECO_FECHADO}
- ${FACTURA_EM_PALAVRAS}
- ${O_IVA_NA_PROPOSTA}
- Por carga: ${O_QUE_E_A_CARGA}
- Itens a mais no dia (orçamento de valor total): cada um acresce ${ACRESCIMO_POR_ITEM_EXTRA} € + IVA (${euros(comIva(ACRESCIMO_POR_ITEM_EXTRA))}), combinado com o cliente antes de avançar.
- Preços de referência do site, ${SEM_IVA_NA_FRASE} — o preço final é sempre o da proposta do parceiro:
${linhasDosPrecos().join("\n")}
- Mudança à hora: cada andar sem elevador ${POR_ANDAR_SEM_ELEVADOR_POR_PESSOA} € + IVA por pessoa (${POR_ANDAR_SEM_ELEVADOR} € + IVA a equipa); elevador exterior ${ELEVADOR_EXTERIOR} € + IVA; mínimo ${MINIMO_DE_HORAS} horas (${MINIMO_DA_MUDANCA} € + IVA). Materiais de embalamento à parte (ex.: ${MATERIAIS.slice(0, 3)
    .map((m) => `${m.nome.toLowerCase()} ${euros(m.preco)} + IVA por ${m.unidade}`)
    .join("; ")}).

COMO SE PAGA
- ${COMO_SE_PAGA}

ENTULHO
- ${RESPOSTA_SOBRE_CONTENTORES}
- ${A_GRANEL}
- Acima de 1 m³, a referência é ${euros(ENTULHO_POR_M3_ACIMA_DE_1)} + IVA por m³.

O QUE NUNCA SE DIZ
- Nunca «no ${PROPRIO_DIA}» como promessa; nunca contentores nem big bags (a CLYON não os tem); nunca um preço que não esteja aqui em cima; nunca um preço sem IVA sozinho (o IVA é ${iva}).
- O preço do pedido de um cliente concreto não se estima: vem nas propostas, em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.
- Quem faz o trabalho é o parceiro escolhido, nunca «nós» nem «a ${NOSSA_EQUIPA}».
- Quem vai é um parceiro verificado: uma empresa parceira, com a sua equipa — não uma pessoa sozinha. Diz sempre «parceiro» (a palavra antiga fazia os clientes pensar que ia uma pessoa só).`;
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
  for (const p of PECAS_DE_REFERENCIA) {
    juntar(p.minimo);
    juntar(p.maximo);
  }
  juntar(ENTULHO_ATE_10_SACOS.minimo);
  juntar(ENTULHO_ATE_10_SACOS.maximo);
  for (const v of ENTULHO_POR_VOLUME) juntar(v.desde);
  juntar(ENTULHO_POR_M3_ACIMA_DE_1);
  for (const n of [
    PRECO_POR_HORA,
    PRECO_POR_KM_LONGE,
    ELEVADOR_EXTERIOR,
    POR_ANDAR_SEM_ELEVADOR,
    POR_ANDAR_SEM_ELEVADOR_POR_PESSOA,
    MINIMO_DA_MUDANCA,
    ACRESCIMO_POR_ITEM_EXTRA,
  ])
    juntar(n);
  for (const m of MATERIAIS) juntar(m.preco);
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
  const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
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
  return EUROS_DAS_FONTES.some((f) => Math.abs(f - n) < 0.011);
}
