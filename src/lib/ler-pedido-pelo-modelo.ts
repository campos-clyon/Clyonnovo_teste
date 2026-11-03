import { createHash } from "node:crypto";
import { FORA_DO_PLANO, nomeDoServico } from "./service-categories";
import { HORAS_POR_TIPOLOGIA } from "./tabela-das-mudancas";
import { ESVAZIAMENTO_POR_TIPOLOGIA } from "./precos-publicos";
import { PESO_DO_SACO, SACOS_POR_BIG_BAG, SACOS_POR_METRO_CUBICO } from "./sacos-de-entulho";
import { formaDaResposta, semDadosPessoais } from "./descricao-pelo-modelo";
import { anfitriaoDoNossoBlob, buscarImagemExterna, urlDeAnexoPermitido } from "./url-externo-seguro";

/**
 * O LEITOR DO PEDIDO — 03-11-2026 (decisão d1 v1, aprovada pelo CEO e pelo
 * dono: «o simulador é a montra, tem de trabalhar sozinho»).
 *
 * A app de cliente manda o serviço, a descrição que a pessoa escreveu, as
 * respostas que já deu e até 6 fotografias que já subiram para o NOSSO
 * armazenamento. O Gemini lê tudo e devolve SUGESTÕES para os campos do
 * simulador dessa categoria — «quantidade: 50», «floor: 3º», «itens: 3
 * grandes» —, cada uma com a confiança e a frase que a justifica, para a
 * pessoa só confirmar. É o `POST /api/cliente/ler-pedido`.
 *
 * NUNCA UM PREÇO. O esquema da resposta não tem onde o pôr, um campo que não
 * seja da lista deita-se fora, e uma frase que fale de dinheiro troca-se por
 * uma frase neutra. O preço de referência é da R12 (`preco-de-referencia.ts`),
 * que lê as respostas — as que a pessoa confirmou.
 *
 * NADA INVENTADO. Um número «lido na descrição» tem de lá estar (em algarismos
 * ou por extenso); o andar, o elevador e o estacionamento só da descrição,
 * nunca das fotografias; o que «se viu nas fotografias» só vale se alguma foi
 * mesmo vista, e nunca passa de 0,6 de confiança. Os campos já respondidos só
 * voltam quando a leitura discorda, marcados.
 *
 * NUNCA CALADO. Sem chave, com o modelo em baixo, fora do formato ou com o
 * tecto do dia atingido, a resposta é `{ ok: true, sugestoes: [] }` — a app
 * segue com as perguntas — e a falha fica no termómetro do painel («Leitura
 * dos pedidos da app», `saude-da-ia.ts`) e na consola. O tradutor esteve um
 * mês morto sem ninguém saber; isto não.
 *
 * As partes puras (os campos, a entrada, a leitura e a verificação da
 * resposta) testam-se sem modelo; `lerOPedido` é a chamada.
 */

/* ──────────────────────────────────────────────────────────────────────────
 * OS CAMPOS DE CADA CATEGORIA — os mesmos ids do simulador por categoria
 * (Engenharia — Site, `simulador-por-categoria.ts`) e da app de cliente.
 * Só se sugere o que se sabe: o «não sei» de cada campo nunca é sugestão.
 * ────────────────────────────────────────────────────────────────────────── */

export type Grupo = "moveis" | "monos" | "entulho" | "esvaziamento" | "mudanca" | "manutencao" | "outro";

/** Que perguntas tem cada serviço (o mesmo desenho do simulador e da app). */
export const GRUPO_DO_SERVICO: Readonly<Record<string, Grupo>> = {
  recolha_moveis: "moveis",
  recolha_monos: "monos",
  recolha_entulho: "entulho",
  esvaziamento_casa: "esvaziamento",
  esvaziamento_apartamento: "esvaziamento",
  esvaziamento_garagem: "esvaziamento",
  esvaziamento_sotao: "esvaziamento",
  esvaziamento_cave: "esvaziamento",
  mudanca: "mudanca",
  manutencao_casa: "manutencao",
  outro: "outro",
};

type CampoDeOpcao = { id: string; tipo: "opcao"; opcoes: readonly string[]; explicacao: string };
type CampoDeNumero = { id: string; tipo: "numero"; minimo: number; maximo: number; explicacao: string };
type CampoSimNao = { id: string; tipo: "sim_nao"; explicacao: string };
type CampoDeItens = { id: "itens"; tipo: "itens"; explicacao: string };
export type CampoDoLeitor = CampoDeOpcao | CampoDeNumero | CampoSimNao | CampoDeItens;

export const ANDARES = ["rés-do-chão", "1º", "2º", "3º", "4º+"] as const;

const ACESSO: readonly CampoDoLeitor[] = [
  { id: "floor", tipo: "opcao", opcoes: ANDARES, explicacao: "o andar: rés-do-chão, 1º, 2º, 3º, ou 4º+ (do 4.º para cima)" },
  { id: "hasElevator", tipo: "opcao", opcoes: ["yes", "small", "no"], explicacao: "há elevador: yes (sim), small (pequeno), no (não)" },
  {
    id: "parkingDistance",
    tipo: "opcao",
    opcoes: ["door", "under_20m", "over_30m", "difficult"],
    explicacao: "onde fica a carrinha: door (à porta), under_20m (até 20 metros), over_30m (mais de 30 metros), difficult (difícil)",
  },
];

/** Só da descrição: as fotografias não dizem o andar, o elevador nem o estacionamento. */
export const CAMPOS_SO_DA_DESCRICAO: ReadonlySet<string> = new Set(ACESSO.map((c) => c.id));

const VOLUME: CampoDoLeitor = {
  id: "volume",
  tipo: "opcao",
  opcoes: ["carrinha", "camiao_caixa", "camiao_lixo"],
  explicacao: "quanto há para levar: carrinha (enche uma carrinha), camiao_caixa (enche a caixa de um camião), camiao_lixo (enche um camião)",
};
const DESMONTAGEM: CampoDoLeitor = { id: "desmontagem", tipo: "sim_nao", explicacao: "é preciso desmontar móveis: true ou false" };

const ENTULHO: readonly CampoDoLeitor[] = [
  {
    id: "entulho",
    tipo: "opcao",
    opcoes: ["ensacado", "chao", "misto"],
    explicacao: "ensacado (já está em sacos), chao (está no chão, a granel), misto (uma parte em sacos e outra no chão)",
  },
  {
    id: "tipoDeSaco",
    tipo: "opcao",
    opcoes: ["pequeno", "bigbag"],
    explicacao:
      `pequeno (os sacos de obra, de ${PESO_DO_SACO}), bigbag (só quando o cliente diz big bag — é a medida que ele já tem; ` +
      `cada big bag são cerca de ${SACOS_POR_BIG_BAG} sacos pequenos)`,
  },
  { id: "quantidade", tipo: "numero", minimo: 1, maximo: 2000, explicacao: "quantos sacos (ou quantos big bags, se tipoDeSaco for bigbag), na medida que o cliente disse" },
  { id: "ensacados", tipo: "numero", minimo: 0, maximo: 2000, explicacao: "no misto: quantos sacos já estão cheios" },
  { id: "porEnsacar", tipo: "numero", minimo: 0, maximo: 2000, explicacao: "no misto: quantos sacos ainda faltam encher" },
  {
    id: "entulhoVolume",
    tipo: "opcao",
    opcoes: ["ate1", "ate3", "ate5", "mais"],
    explicacao: `o volume quando não se contam sacos: ate1 (até 1 m³, uns ${SACOS_POR_METRO_CUBICO} sacos), ate3 (até 3 m³), ate5 (até 5 m³), mais (mais de 5 m³)`,
  },
];

const TIPOLOGIA_DO_ESVAZIAMENTO: CampoDoLeitor = {
  id: "tipologia",
  tipo: "opcao",
  opcoes: ESVAZIAMENTO_POR_TIPOLOGIA.map((t) => t.chave),
  explicacao: `o tamanho da casa: ${ESVAZIAMENTO_POR_TIPOLOGIA.map((t) => `${t.chave} (${t.tipo.toLowerCase()})`).join(", ")}`,
};

const TIPOLOGIA_DA_MUDANCA: CampoDoLeitor = {
  id: "tipologia",
  tipo: "opcao",
  opcoes: Object.keys(HORAS_POR_TIPOLOGIA),
  explicacao: "o tamanho da casa: itens (só alguns móveis), T0, T1, T2, T3, T4+ (T4 ou maior)",
};

const MANUTENCAO: readonly CampoDoLeitor[] = [
  {
    id: "tipoDeTrabalho",
    tipo: "opcao",
    opcoes: ["canalizacao", "electricidade", "pintura", "carpintaria", "pequenas_reparacoes", "remodelacao", "outro"],
    explicacao: "o tipo de trabalho; com mais de um, o que dá mais trabalho (a frase diz os outros)",
  },
  {
    id: "quantoTrabalho",
    tipo: "opcao",
    opcoes: ["uma_pequena", "varias_pequenas", "uma_divisao", "remodelacao"],
    explicacao: "quanto trabalho, contando tudo: uma_pequena, varias_pequenas, uma_divisao (uma divisão inteira), remodelacao",
  },
  { id: "materiais", tipo: "opcao", opcoes: ["tenho", "parceiro"], explicacao: "quem compra os materiais: tenho (o cliente já os tem), parceiro (o parceiro traz)" },
];

const MOVEIS: readonly CampoDoLeitor[] = [
  { id: "movelModo", tipo: "opcao", opcoes: ["item", "carga"], explicacao: "item (peças contadas) ou carga (uma carga sem contar as peças)" },
  {
    id: "itens",
    tipo: "itens",
    explicacao:
      "as peças contadas, em três campos: itens.grande (sofá, armário, cama, frigorífico, máquina de lavar), " +
      "itens.medio (fogão, cadeirão, frigorífico bar), itens.pequeno (micro-ondas, forno, mesinha de cabeceira)",
  },
  VOLUME,
  DESMONTAGEM,
];

/** Os campos que o leitor pode sugerir neste serviço — vazio quando o serviço não existe ou está fora do plano. */
export function camposDoServico(servico: string): readonly CampoDoLeitor[] {
  if (FORA_DO_PLANO.has(servico)) return [];
  const g = GRUPO_DO_SERVICO[servico];
  if (!g) return [];
  switch (g) {
    case "moveis":
      return [...MOVEIS, ...ACESSO];
    case "monos":
    case "outro":
      return [VOLUME, DESMONTAGEM, ...ACESSO];
    case "entulho":
      return [...ENTULHO, ...ACESSO];
    case "esvaziamento":
      // A tipologia só numa casa; a garagem, o sótão e a cave têm as perguntas do espaço.
      return [...(servico === "esvaziamento_casa" || servico === "esvaziamento_apartamento" ? [TIPOLOGIA_DO_ESVAZIAMENTO] : []), VOLUME, DESMONTAGEM, ...ACESSO];
    case "mudanca":
      return [TIPOLOGIA_DA_MUDANCA, DESMONTAGEM, ...ACESSO];
    case "manutencao":
      return [...MANUTENCAO, ...ACESSO];
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * O QUE ENTRA
 * ────────────────────────────────────────────────────────────────────────── */

export const MAXIMO_DE_FOTOGRAFIAS = 6;
const MAXIMO_DA_DESCRICAO = 1500;

export type Itens = { pequeno: number; medio: number; grande: number };
export type ValorDoCampo = string | number | boolean | Itens;

export type PedidoParaOLeitor = {
  servico: string;
  descricao: string;
  respostas: Record<string, ValorDoCampo>;
  /** Só as do NOSSO armazenamento, até 6. */
  fotografias: string[];
  /** Quantos endereços vieram no corpo (os de fora contam aqui e não se abrem). */
  fotografiasRecebidas: number;
};

/**
 * Uma fotografia do NOSSO store do Vercel Blob — o anfitrião exacto
 * (`anfitriaoDoNossoBlob`), https, sem pergunta nem âncora. Nunca se vai
 * buscar um endereço de fora: o servidor não é um proxy.
 */
export function fotografiaNossa(valor: unknown, env: Record<string, string | undefined> = process.env): string | null {
  const href = urlDeAnexoPermitido(valor);
  if (!href) return null;
  const nosso = anfitriaoDoNossoBlob(env);
  if (!nosso) return null;
  const url = new URL(href);
  if (url.hostname.toLowerCase() !== nosso) return null;
  if (url.search || url.hash) return null;
  return href;
}

const inteiro = (v: unknown, max = 2000): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.min(max, Math.round(n)) : 0;
};

/** O corpo do pedido, lido sem confiar — ou null (400). Puro, salvo o anfitrião do store. */
export function lerPedidoParaOLeitor(corpo: unknown, env: Record<string, string | undefined> = process.env): PedidoParaOLeitor | null {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return null;
  const c = corpo as Record<string, unknown>;
  if (typeof c.servico !== "string" || !/^[a-z_]{2,40}$/.test(c.servico)) return null;
  const descricao = typeof c.descricao === "string" ? c.descricao.trim().slice(0, MAXIMO_DA_DESCRICAO) : "";

  const campos = camposDoServico(c.servico);
  const respostas: Record<string, ValorDoCampo> = {};
  if (c.respostas && typeof c.respostas === "object" && !Array.isArray(c.respostas)) {
    const r = c.respostas as Record<string, unknown>;
    for (const campo of campos) {
      const v = r[campo.id];
      if (v == null || v === "") continue;
      if (campo.tipo === "itens") {
        if (typeof v === "object" && !Array.isArray(v)) {
          const i = v as Record<string, unknown>;
          respostas.itens = { pequeno: inteiro(i.pequeno, 50), medio: inteiro(i.medio, 50), grande: inteiro(i.grande, 50) };
        }
      } else if (typeof v === "string" && v.length <= 40) respostas[campo.id] = v;
      else if (typeof v === "number" && Number.isFinite(v)) respostas[campo.id] = v;
      else if (typeof v === "boolean") respostas[campo.id] = v;
    }
  }

  const lista = Array.isArray(c.fotografias) ? c.fotografias : [];
  const fotografias: string[] = [];
  for (const f of lista.slice(0, 20)) {
    const nossa = fotografiaNossa(f, env);
    if (nossa && !fotografias.includes(nossa)) fotografias.push(nossa);
    if (fotografias.length >= MAXIMO_DE_FOTOGRAFIAS) break;
  }
  return { servico: c.servico, descricao, respostas, fotografias, fotografiasRecebidas: lista.length };
}

/* ──────────────────────────────────────────────────────────────────────────
 * O AVISO AO MODELO E A ENTRADA
 * ────────────────────────────────────────────────────────────────────────── */

export const INSTRUCAO_DO_LEITOR = [
  "Lês o pedido de um cliente da CLYON, uma plataforma portuguesa que liga clientes a parceiros da zona, " +
    "e preparas as respostas do simulador para o cliente só ter de confirmar.",
  "Recebes o serviço, a descrição escrita pelo cliente, as respostas que ele já deu, os campos deste serviço com os valores possíveis e, às vezes, fotografias.",
  "Devolve SÓ um objecto JSON com duas chaves:",
  '  "sugestoes": uma lista; cada sugestão tem "campo" (um dos campos da lista, e mais nenhum), "valor" (em texto: um dos valores ' +
    'possíveis do campo, os números em algarismos, sim e não como "true" e "false"), "confianca" (de 0 a 1), ' +
    '"porque" (uma frase curta, até 15 palavras, para o cliente ler, a dizer de onde veio) e "origem" ("descricao", "fotografias" ou "ambas").',
  '  "nasFotografias": numa frase curta, o que se vê nas fotografias que é para levar ou fazer, com quantidades aproximadas ' +
    '(«cerca de 30 sacos de entulho numa sala»); "" sem fotografias, ou se não mostram nada disso.',
  "A CONFIANÇA: 0.9 ou mais só quando o cliente o escreveu com todas as letras; 0.6 a 0.8 quando se percebe sem estar escrito; " +
    "o que só se vê nas fotografias, no máximo 0.6.",
  "O ENTULHO: sacos de obra são os pequenos. Big bag só quando o cliente diz big bag, e a quantidade fica na medida dele " +
    '(«2 big bags» é quantidade 2 com tipoDeSaco "bigbag"). Parte em sacos e parte no chão é "misto", com ensacados e porEnsacar.',
  'OS MÓVEIS: peças contadas são movelModo "item" e os campos itens.grande, itens.medio e itens.pequeno; uma carga sem contar as peças é movelModo "carga" e volume.',
  "AS REPARAÇÕES: com mais de um trabalho, tipoDeTrabalho é o que dá mais trabalho e a frase diz os outros; quantoTrabalho conta todos.",
  "O ACESSO (andar, elevador, estacionamento) só pelo que o cliente escreveu — as fotografias não o dizem.",
  "REGRAS: só o que está na descrição ou se vê nas fotografias — não adivinhes. Um campo sem pistas fica de fora. Nunca sugiras «não sei». " +
    "Sem preços, sem valores em dinheiro, sem euros. Sem nomes, telefones, emails nem moradas. Não fales das pessoas que apareçam nas fotografias. " +
    "Português de Portugal, sem emojis.",
  'EXEMPLO (descrição «tenho 20 sacos de obra, 2.º andar com elevador»): {"sugestoes":[' +
    '{"campo":"entulho","valor":"ensacado","confianca":0.9,"porque":"Disse que já está em sacos.","origem":"descricao"},' +
    '{"campo":"quantidade","valor":"20","confianca":0.95,"porque":"Escreveu «20 sacos».","origem":"descricao"},' +
    '{"campo":"floor","valor":"2º","confianca":0.95,"porque":"Escreveu «2.º andar».","origem":"descricao"},' +
    '{"campo":"hasElevator","valor":"yes","confianca":0.9,"porque":"Disse que tem elevador.","origem":"descricao"}],"nasFotografias":""}',
].join("\n");

/** O formato pedido ao modelo (como `ESQUEMA_DA_RESPOSTA` da descrição: os tipos em texto, sem importar a biblioteca). */
export const ESQUEMA_DO_LEITOR = {
  type: "object",
  properties: {
    sugestoes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          campo: { type: "string" },
          valor: { type: "string" },
          confianca: { type: "number" },
          porque: { type: "string" },
          origem: { type: "string" },
        },
        required: ["campo", "valor", "confianca", "porque", "origem"],
      },
    },
    nasFotografias: { type: "string" },
  },
  required: ["sugestoes", "nasFotografias"],
} as const;

const SEM_DADOS = { contactName: null, address: null };

function respostaEmTexto(v: ValorDoCampo): string {
  if (typeof v === "object") return `grande ${v.grande}, medio ${v.medio}, pequeno ${v.pequeno}`;
  return String(v);
}

/** O que se manda ao modelo, além das fotografias: sem contactos nem códigos postais. Pura. */
export function entradaDoLeitor(p: PedidoParaOLeitor, fotografiasVistas: number): string {
  const campos = camposDoServico(p.servico);
  const descricao = semDadosPessoais(p.descricao, SEM_DADOS);
  const respostas = Object.entries(p.respostas).map(([k, v]) => `- ${k}: ${respostaEmTexto(v)}`);
  const lista = campos.map((c) => {
    if (c.tipo === "opcao") return `- ${c.id}: ${c.opcoes.join(" | ")} — ${c.explicacao}`;
    if (c.tipo === "numero") return `- ${c.id}: número de ${c.minimo} a ${c.maximo} — ${c.explicacao}`;
    if (c.tipo === "sim_nao") return `- ${c.id}: true | false — ${c.explicacao}`;
    return `- itens.grande, itens.medio, itens.pequeno: números de 0 a 50 — ${c.explicacao}`;
  });
  return [
    `SERVIÇO: ${nomeDoServico(p.servico)}`,
    `DESCRIÇÃO DO CLIENTE:\n${descricao || "(nenhuma)"}`,
    `RESPOSTAS JÁ DADAS:\n${respostas.length ? respostas.join("\n") : "(nenhuma)"}`,
    `FOTOGRAFIAS: ${fotografiasVistas > 0 ? `${fotografiasVistas}, antes deste texto` : "nenhuma"}`,
    `CAMPOS DESTE SERVIÇO (campo: valores possíveis — o que quer dizer):\n${lista.join("\n")}`,
  ].join("\n\n");
}

/* ──────────────────────────────────────────────────────────────────────────
 * A RESPOSTA, LIDA E VERIFICADA
 * ────────────────────────────────────────────────────────────────────────── */

export type Origem = "descricao" | "fotografias" | "ambas";
export type SugestaoBruta = { campo: string; valor: string; confianca: number; porque: string; origem: string };
export type RespostaDoLeitor = { sugestoes: SugestaoBruta[]; nasFotografias: string };

export type Sugestao = {
  campo: string;
  valor: ValorDoCampo;
  /** De 0 a 1, com duas casas. */
  confianca: number;
  /** A frase que a justifica, para o cliente ler. */
  porque: string;
  origem: Origem;
  /** O cliente já tinha respondido outra coisa a este campo. */
  discorda?: true;
};

function textoDe(v: unknown): string | null {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return String(v);
  return null;
}

/** O JSON do modelo, lido sem confiar — ou null (fora do formato). Puro. */
export function lerRespostaDoLeitor(cru: unknown): RespostaDoLeitor | null {
  let o: unknown = cru;
  if (typeof cru === "string") {
    const s = cru.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      o = JSON.parse(s);
    } catch {
      const i = s.indexOf("{");
      const j = s.lastIndexOf("}");
      if (i < 0 || j <= i) return null;
      try {
        o = JSON.parse(s.slice(i, j + 1));
      } catch {
        return null;
      }
    }
  }
  if (Array.isArray(o) && o.length === 1) o = o[0];
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  if (!("sugestoes" in r)) return null;
  if (r.sugestoes != null && !Array.isArray(r.sugestoes)) return null;
  const sugestoes: SugestaoBruta[] = [];
  for (const x of (r.sugestoes as unknown[] | null) ?? []) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue;
    const s = x as Record<string, unknown>;
    const campo = textoDe(s.campo);
    const valor = textoDe(s.valor);
    if (!campo || valor == null || valor === "") continue;
    const confianca = typeof s.confianca === "number" ? s.confianca : Number(textoDe(s.confianca) ?? NaN);
    sugestoes.push({ campo, valor, confianca, porque: textoDe(s.porque) ?? "", origem: textoDe(s.origem) ?? "" });
  }
  return { sugestoes, nasFotografias: textoDe(r.nasFotografias) ?? "" };
}

function plano(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const POR_EXTENSO: Readonly<Record<string, number>> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, catorze: 14, quinze: 15, dezasseis: 16, dezassete: 17, dezoito: 18, dezanove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100,
  duzia: 12,
};

/** Os números que a pessoa escreveu — em algarismos ou por extenso («vinte e cinco», «meia dúzia»). Pura. */
export function numerosDoTexto(texto: string): Set<number> {
  const t = plano(texto);
  const out = new Set<number>();
  for (const m of t.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const n = Number(m[0].replace(",", "."));
    if (Number.isFinite(n)) {
      out.add(n);
      out.add(Math.round(n));
    }
  }
  const ps = t.split(/[^a-z]+/).filter(Boolean);
  for (let i = 0; i < ps.length; i++) {
    const n = POR_EXTENSO[ps[i]];
    if (n == null) continue;
    if (ps[i] === "duzia") out.add(ps[i - 1] === "meia" ? 6 : 12);
    else out.add(n);
    // «vinte e cinco»
    if (n >= 20 && n % 10 === 0 && ps[i + 1] === "e" && POR_EXTENSO[ps[i + 2]] != null && POR_EXTENSO[ps[i + 2]] < 10) {
      out.add(n + POR_EXTENSO[ps[i + 2]]);
    }
  }
  return out;
}

/** O valor de uma opção, com os desvios que os modelos escrevem («3.º», «sim», «t2»). Pura. */
function opcaoDaSugestao(campo: CampoDeOpcao, valor: string): string | null {
  const v = plano(valor).trim();
  const exacta = campo.opcoes.find((o) => plano(o) === v);
  if (exacta) return exacta;
  if (campo.id === "floor") {
    if (/^(r\/?c|res|terreo|piso 0|0\b)/.test(v)) return "rés-do-chão";
    const m = /^(\d{1,2})/.exec(v);
    if (!m) return null;
    const n = Number(m[1]);
    return n === 0 ? "rés-do-chão" : n >= 4 ? "4º+" : `${n}º`;
  }
  if (campo.id === "hasElevator") {
    if (/^(sim|true|com)\b/.test(v)) return "yes";
    if (/pequen/.test(v)) return "small";
    if (/^(nao|false|sem)\b/.test(v)) return "no";
    return null;
  }
  if (campo.id === "tipologia") {
    const m = /^t\s*(\d)/.exec(v);
    if (/moradia|vivenda/.test(v) && campo.opcoes.includes("moradia")) return "moradia";
    if (!m) return null;
    const n = Number(m[1]);
    const opcoes = campo.opcoes;
    if (opcoes.includes("T0/T1")) return n <= 1 ? "T0/T1" : n === 2 ? "T2" : "T3/T4";
    return n >= 4 ? "T4+" : (opcoes.find((o) => o === `T${n}`) ?? null);
  }
  return null;
}

function simOuNao(valor: string): boolean | null {
  const v = plano(valor).trim();
  if (/^(true|sim|yes)$/.test(v)) return true;
  if (/^(false|nao|no)$/.test(v)) return false;
  return null;
}

/*
 * O QUE UMA FRASE PARA O CLIENTE NÃO PODE TER. Expressões regulares, e não
 * listas de palavras, de propósito: o teste da orquestra lê os textos daqui.
 */
const DINHEIRO = /€|\$|\beuros?\b|\bEUR\b|\biva\b|\bpre[cç]os?\b|\bvalor(es)?\b|\bcustos?\b|\bor[cç]amentos?\b|\bbarat[oa]s?\b|\bcar[oa]s?\b/i;
const CONTACTO = /(?:\+|00)?\d(?:[\s.-]?\d){8,}|\S+@\S+\.\S+|\bhttps?:\/\/\S+|\bwww\.\S+/;
const CODIGO_POSTAL = /(?<!\d)\d{4}-\d{3}(?!\d)/;
const MORADA =
  /\b([Rr]ua|[Aa]venida|[Aa]v\.|[Tt]ravessa|[Ll]argo|[Pp]ra[cç]a|[Pp]raceta|[Ee]strada|[Cc]al[cç]ada|[Bb]eco|[Aa]lameda)\s+(d[aeo]s?\s+)?[A-ZÀ-Ú0-9]/;
const DO_BRASIL: readonly RegExp[] = [
  /(?<![\p{L}\d_])voc[êe]s?(?![\p{L}\d_])/iu,
  /\bcelular(es)?\b/i,
  /\bequipes?\b/i,
  /\bcontatos?\b/i,
  /\bgeladeiras?\b/i,
  /\bbanheiros?\b/i,
  /\bcaminh[ãa]o\b/i,
  /\b(estou|está|estão|estava)\s+[a-zà-ú]{2,}(ando|endo|indo)\b/i,
];
/** Ao cliente diz-se «parceiro» (regra n da orquestra); e as promessas que a CLYON não faz. */
const FORA_DA_VOZ = /\bprofission|\b(pr[óo]prio|mesmo)\s+dia\b|\bintelig[êe]ncia\s+artificial\b|\bvirtual\b|\brob[ôo]\b/i;

/** A frase passa nas regras da casa? Pura. */
export function fraseAoCliente(t: string, maximo = 160): boolean {
  const s = t.trim();
  if (!s || s.length > maximo) return false;
  if (DINHEIRO.test(s) || CONTACTO.test(s) || CODIGO_POSTAL.test(s) || MORADA.test(s)) return false;
  if (DO_BRASIL.some((re) => re.test(s)) || FORA_DA_VOZ.test(s)) return false;
  if (/[*#`<>{}]|\p{Extended_Pictographic}/u.test(s)) return false;
  return true;
}

/** Quando a frase do modelo não passa, diz-se de onde veio, e mais nada. */
export const PORQUE_SEM_FRASE: Readonly<Record<Origem, string>> = {
  descricao: "Pelo que escreveu na descrição.",
  fotografias: "Pelo que se vê nas fotografias.",
  ambas: "Pela descrição e pelas fotografias.",
};

const comPonto = (s: string) => (/[.!?…»)]$/.test(s) ? s : `${s}.`);

/** As pistas do acesso na descrição — sem elas, o andar, o elevador e o estacionamento não se sugerem. */
const PISTA_DO_ACESSO: Readonly<Record<string, RegExp>> = {
  floor: /andar|piso|r\/?c\b|res[\s-]?do[\s-]?chao|\d\s*[º°ª]|\d\.\s*[º°ª]|terreo|cave|sotao/,
  hasElevator: /elevador|escadas?\b/,
  parkingDistance: /estaciona|carrinha|porta|metros|\bm\b|rua|garagem|parque|descarga/,
};

export const CONFIANCA_MAXIMA_DAS_FOTOGRAFIAS = 0.6;

/**
 * AS SUGESTÕES QUE PASSAM — só campos deste serviço, só valores da lista,
 * nada inventado, nenhuma frase fora das regras, os itens juntos num só
 * campo, e os campos já respondidos só quando a leitura discorda. Pura.
 */
export function sugestoesQuePassam(r: RespostaDoLeitor, p: PedidoParaOLeitor, fotografiasVistas: number): Sugestao[] {
  const campos = camposDoServico(p.servico);
  const porId = new Map(campos.map((c) => [c.id, c]));
  const texto = plano(semDadosPessoais(p.descricao, SEM_DADOS));
  const numeros = numerosDoTexto(texto);
  const comFotos = fotografiasVistas > 0;

  const boas: Sugestao[] = [];
  const itens: Array<{ tamanho: keyof Itens; n: number; confianca: number; porque: string; origem: Origem }> = [];

  for (const s of r.sugestoes.slice(0, 30)) {
    const [base, parte] = s.campo.split(".");
    const campo = porId.get(base);
    if (!campo) continue; // um campo que não é deste serviço — ou um «preço» — fica de fora

    let origem: Origem = s.origem === "fotografias" || s.origem === "ambas" ? s.origem : "descricao";
    if (origem !== "descricao" && !comFotos) {
      // «Viu-se numa fotografia» que ninguém viu: foi inventado. «Ambas» fica só com a descrição.
      if (origem === "fotografias") continue;
      origem = "descricao";
    }
    if (CAMPOS_SO_DA_DESCRICAO.has(campo.id)) {
      if (origem === "fotografias") continue;
      origem = "descricao";
      if (!PISTA_DO_ACESSO[campo.id].test(texto)) continue;
    }

    let valor: ValorDoCampo | null = null;
    if (campo.tipo === "opcao") valor = opcaoDaSugestao(campo, s.valor);
    else if (campo.tipo === "sim_nao") valor = simOuNao(s.valor);
    else if (campo.tipo === "numero" || campo.tipo === "itens") {
      const n = Number(String(s.valor).replace(",", "."));
      const [minimo, maximo] = campo.tipo === "numero" ? [campo.minimo, campo.maximo] : [0, 50];
      if (!Number.isFinite(n) || n < minimo || n > maximo) continue;
      valor = Math.round(n);
      // Um número «da descrição» tem de lá estar; senão, só vale se se viu nas fotografias.
      if (origem !== "fotografias" && valor !== 0 && !numeros.has(valor)) {
        if (!comFotos) continue;
        origem = "fotografias";
      }
    }
    if (valor == null) continue;

    let confianca = Number.isFinite(s.confianca) ? Math.min(1, Math.max(0, s.confianca)) : 0.5;
    if (origem === "fotografias") confianca = Math.min(confianca, CONFIANCA_MAXIMA_DAS_FOTOGRAFIAS);
    confianca = Math.round(confianca * 100) / 100;
    if (confianca <= 0) continue;
    const porque = fraseAoCliente(s.porque) ? comPonto(s.porque.trim()) : PORQUE_SEM_FRASE[origem];

    if (campo.tipo === "itens") {
      if (parte === "pequeno" || parte === "medio" || parte === "grande") itens.push({ tamanho: parte, n: valor as number, confianca, porque, origem });
      continue;
    }
    boas.push({ campo: campo.id, valor, confianca, porque, origem });
  }

  // As peças num só campo, como a app as guarda: { pequeno, medio, grande }.
  if (itens.length > 0) {
    const valor: Itens = { pequeno: 0, medio: 0, grande: 0 };
    for (const i of itens) valor[i.tamanho] = Math.max(valor[i.tamanho], i.n);
    if (valor.pequeno + valor.medio + valor.grande > 0) {
      const origens = new Set(itens.map((i) => i.origem));
      const origem: Origem = origens.size === 1 ? [...origens][0] : "ambas";
      const frases = [...new Set(itens.map((i) => i.porque))];
      const porque = frases.slice(0, 2).join(" ");
      boas.push({
        campo: "itens",
        valor,
        confianca: Math.min(...itens.map((i) => i.confianca)),
        porque: porque.length <= 200 ? porque : PORQUE_SEM_FRASE[origem],
        origem,
      });
    }
  }

  // Um campo, uma sugestão: a de maior confiança.
  const unica = new Map<string, Sugestao>();
  for (const s of boas) {
    const ja = unica.get(s.campo);
    if (!ja || s.confianca > ja.confianca) unica.set(s.campo, s);
  }
  // No rés-do-chão o elevador não interessa.
  const andar = unica.get("floor")?.valor ?? p.respostas.floor;
  if (andar === "rés-do-chão") unica.delete("hasElevator");

  const igual = (a: ValorDoCampo, b: ValorDoCampo) =>
    typeof a === "object" && typeof b === "object" ? a.pequeno === b.pequeno && a.medio === b.medio && a.grande === b.grande : String(a) === String(b);

  const out: Sugestao[] = [];
  for (const s of unica.values()) {
    const dada = p.respostas[s.campo];
    if (dada === undefined) out.push(s);
    else if (!igual(dada, s.valor)) out.push({ ...s, discorda: true });
  }
  // A ordem das perguntas do serviço.
  const ordem = campos.map((c) => c.id);
  return out.sort((a, b) => ordem.indexOf(a.campo) - ordem.indexOf(b.campo)).slice(0, 15);
}

/** A frase do que se vê, se passar nas regras e se alguma fotografia foi vista. Pura. */
export function oQueSeViuQuePassa(r: RespostaDoLeitor, fotografiasVistas: number): string | null {
  if (fotografiasVistas <= 0) return null;
  const t = r.nasFotografias.trim().replace(/^["“«']+|["”»']+$/g, "").trim();
  if (!t || /^\(?\s*nada\s*\)?\.?$/i.test(t)) return null;
  if (!fraseAoCliente(t, 200) || /\b(pessoas?|homem|mulher|crian[cç]a|rosto)\b/i.test(t)) return null;
  return comPonto(`${t.charAt(0).toUpperCase()}${t.slice(1)}`);
}

/* ──────────────────────────────────────────────────────────────────────────
 * A CHAMADA
 * ────────────────────────────────────────────────────────────────────────── */

export type UsoDoModelo = { modelo: string; entrada: number; saida: number; pensamento: number; ms: number };

export type LeituraDoPedido = {
  ok: true;
  sugestoes: Sugestao[];
  nasFotografias: string | null;
  fotografias: { recebidas: number; vistas: number };
};

/** O termómetro deste uso — ver `saude-da-ia.ts`. Nunca atira. */
async function anotar(motivo: string | null): Promise<void> {
  try {
    const { anotarSaudeDaIa } = await import("./saude-da-ia-na-base");
    await anotarSaudeDaIa("leitor", motivo);
  } catch {
    /* sem base, sem termómetro — e a resposta segue na mesma */
  }
}

/** 15 MB de fotografias ao todo: o pedido ao modelo tem um tecto, e seis fotografias reduzidas ficam muito abaixo. */
const BYTES_DAS_FOTOGRAFIAS = 15 * 1024 * 1024;

type Imagem = { inlineData: { mimeType: string; data: string } };

/** Vai buscar as fotografias (só as nossas, já filtradas), em paralelo. Nunca atira. */
async function abrirAsFotografias(urls: string[]): Promise<Imagem[]> {
  const lidas = await Promise.allSettled(urls.map((u) => buscarImagemExterna(u, 5000)));
  const out: Imagem[] = [];
  let bytes = 0;
  for (const l of lidas) {
    if (l.status !== "fulfilled" || !l.value) continue;
    bytes += l.value.buffer.byteLength;
    if (bytes > BYTES_DAS_FOTOGRAFIAS) break;
    out.push({ inlineData: { mimeType: l.value.mimeType, data: l.value.buffer.toString("base64") } });
  }
  return out;
}

/** O que a resposta do modelo gastou. */
function usoDaResposta(resposta: unknown, modelo: string, ms: number): UsoDoModelo {
  const u = (resposta as { response?: { usageMetadata?: Record<string, number> } })?.response?.usageMetadata ?? {};
  const entrada = Number(u.promptTokenCount) || 0;
  const saida = Number(u.candidatesTokenCount) || 0;
  const total = Number(u.totalTokenCount) || 0;
  const pensamento = Number(u.thoughtsTokenCount) || Math.max(0, total - entrada - saida);
  return { modelo, entrada, saida, pensamento, ms };
}

/*
 * A MEMÓRIA CURTA — o mesmo pedido duas vezes em dez minutos (a app volta
 * ao ecrã, a pessoa carrega outra vez) não paga outra chamada.
 */
const MEMORIA = new Map<string, { em: number; leitura: LeituraDoPedido }>();
const MS_DA_MEMORIA = 10 * 60 * 1000;

function chaveDoPedido(p: PedidoParaOLeitor): string {
  return createHash("sha256")
    .update(JSON.stringify([p.servico, p.descricao, p.respostas, p.fotografias]))
    .digest("hex");
}

/** Só para os testes. */
export function esquecerAsLeituras(): void {
  MEMORIA.clear();
}

/** Sem o modelo: a resposta de sempre, para a app seguir com as perguntas. */
function semSugestoes(p: PedidoParaOLeitor, vistas = 0): LeituraDoPedido {
  return { ok: true, sugestoes: [], nasFotografias: null, fotografias: { recebidas: p.fotografiasRecebidas, vistas } };
}

/**
 * O MODELO LÊ O PEDIDO — ou a resposta vem vazia e a falha fica anotada.
 * Nunca atira. O mesmo modelo, a mesma chave, a mesma escada e o mesmo
 * castigo de quem fica sem quota da descrição dos pedidos e da Vitória
 * (`modeloDoAssistente`, `escadaDeModelos`, `porDeCastigo`); fora do formato
 * pergunta-se outra vez (ao mesmo, se a escada só tem um).
 */
export async function lerOPedido(p: PedidoParaOLeitor): Promise<{ leitura: LeituraDoPedido; uso: UsoDoModelo | null }> {
  if (camposDoServico(p.servico).length === 0) return { leitura: semSugestoes(p), uso: null };
  if (p.descricao.replace(/\s+/g, "").length < 3 && p.fotografias.length === 0) return { leitura: semSugestoes(p), uso: null };

  const chave = chaveDoPedido(p);
  const lembrada = MEMORIA.get(chave);
  if (lembrada && Date.now() - lembrada.em < MS_DA_MEMORIA) return { leitura: lembrada.leitura, uso: null };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[ler-pedido] sem GEMINI_API_KEY — a app segue sem sugestões");
    await anotar("sem GEMINI_API_KEY — a app seguiu sem sugestões");
    return { leitura: semSugestoes(p), uso: null };
  }

  const imagens = p.fotografias.length > 0 ? await abrirAsFotografias(p.fotografias) : [];
  if (p.fotografias.length > 0 && imagens.length === 0) {
    console.error(`[ler-pedido] nenhuma das ${p.fotografias.length} fotografias se abriu — lê-se só a descrição`);
  }
  if (p.descricao.replace(/\s+/g, "").length < 3 && imagens.length === 0) return { leitura: semSugestoes(p), uso: null };
  const entrada = entradaDoLeitor(p, imagens.length);

  let motivo = "nenhum modelo respondeu";
  try {
    const { escadaDeModelos, modeloDoAssistente, porDeCastigo } = await import("./whatsapp-compreensao");
    const modelos = (await escadaDeModelos(modeloDoAssistente())).slice(0, 2);
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const client = new GoogleGenerativeAI(apiKey);
    const tentativas = modelos.length === 1 ? [modelos[0], modelos[0]] : modelos;
    for (const [i, nome] of tentativas.entries()) {
      const segundos = i === 0 ? 15 : 10;
      const comecou = Date.now();
      try {
        const model = client.getGenerativeModel({
          model: nome,
          systemInstruction: INSTRUCAO_DO_LEITOR,
          generationConfig: { responseMimeType: "application/json", responseSchema: ESQUEMA_DO_LEITOR as never, temperature: 0 },
        });
        const resposta = await Promise.race([
          model.generateContent([...imagens, { text: entrada }]),
          new Promise<never>((_, rejeitar) => setTimeout(() => rejeitar(new Error(`demorou mais de ${segundos} s`)), segundos * 1000)),
        ]);
        const uso = usoDaResposta(resposta, nome, Date.now() - comecou);
        const texto = resposta.response.text();
        const lida = lerRespostaDoLeitor(texto);
        if (!lida) {
          const fim = (resposta.response as { candidates?: Array<{ finishReason?: string }> }).candidates?.[0]?.finishReason;
          // A forma da resposta, nunca o conteúdo (pode trazer o que o cliente escreveu).
          motivo = `${nome} respondeu fora do formato (${formaDaResposta(texto, fim)})`;
          console.error(`[ler-pedido] ${motivo}`);
          continue;
        }
        const leitura: LeituraDoPedido = {
          ok: true,
          sugestoes: sugestoesQuePassam(lida, p, imagens.length),
          nasFotografias: oQueSeViuQuePassa(lida, imagens.length),
          fotografias: { recebidas: p.fotografiasRecebidas, vistas: imagens.length },
        };
        console.log(
          `[ler-pedido] ${nome}: ${leitura.sugestoes.length} sugestão(ões) de ${lida.sugestoes.length}, ${imagens.length} fotografia(s), ` +
            `${uso.entrada} + ${uso.saida} + ${uso.pensamento} tokens, ${uso.ms} ms`,
        );
        MEMORIA.set(chave, { em: Date.now(), leitura });
        // As mais antigas saem primeiro (o Map guarda a ordem de entrada).
        for (const k of MEMORIA.keys()) {
          if (MEMORIA.size <= 300) break;
          MEMORIA.delete(k);
        }
        await anotar(null);
        return { leitura, uso };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        motivo = `${nome}: ${msg}`;
        console.error(`[ler-pedido] ${nome} falhou aos ${Date.now() - comecou} ms:`, msg);
        await porDeCastigo(nome, msg);
        if (tentativas[i + 1] === nome) break;
      }
    }
  } catch (e) {
    motivo = e instanceof Error ? e.message : String(e);
    console.error("[ler-pedido] falhou antes do modelo:", motivo);
  }
  await anotar(`${motivo.slice(0, 300)} — a app seguiu sem sugestões`);
  return { leitura: semSugestoes(p, imagens.length), uso: null };
}
