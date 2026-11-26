/**
 * A RECOLHA PELO AGENTE — d99 (23-11-2026), FASE 1: ENSAIO. PURO.
 *
 * Um número sem pedido: o agente (Claude) conduz a recolha dos dados, desde
 * a primeira mensagem até ao resumo que pede o SIM. Nesta fase NADA SAI: o
 * que ele teria respondido e o que teria gravado ficam ao lado do que a
 * Vitória de sempre fez, para comparar (`recolha-em-ensaio.ts`).
 *
 * As regras que não mudam com o modelo:
 *  - o nome, a morada (e a de destino), o NIF e o código postal LÊ-OS O
 *    CÓDIGO, antes de chamar o modelo (`lerDadosPessoais`: os mesmos leitores
 *    da recolha), e troca-os por marcas (`marcarDadosPessoais`). O modelo
 *    nunca os vê nem os grava;
 *  - o resto grava-o o modelo no rascunho (`gravarNoRascunho`), e cada valor
 *    passa pelos MESMOS validadores da recolha (`fundirCampos`): o que não
 *    passa volta ao modelo com a razão;
 *  - o resumo é o do código (`resumo()`), posto no lugar da marca
 *    «[resumo do pedido]»; o modelo NUNCA cria o pedido — só o SIM do
 *    cliente, lido pelo código (`respostaAoResumo`), o regista.
 *
 * As fotografias e os áudios ficam com o Gemini, como sempre.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { nomeDoTexto } from "../leitor-da-recolha";
import { nifDaFactura } from "../pedido-valores";
import { NOME_DA_ASSISTENTE, O_QUE_ELA_FAZ, QUEM_FALA, SE_PREFERIR_UMA_PESSOA, SOU_A_ASSISTENTE_AUTOMATICA } from "../voz-da-vitoria";
import { PROPRIO_DIA } from "../frases-proibidas";
import { IDS_DA_LISTA, SERVICOS_DA_VITORIA } from "../servicos-da-vitoria";
import type { CamposCrus } from "../whatsapp-compreensao";
import {
  fundirCampos,
  lerMensagemLivre,
  linhasDoResumo,
  localidadeNoFimDaMorada,
  moradaNaFrase,
  nifComControloCerto,
  nifNaFrase,
  passosEmFalta,
  primeiroPassoEmFalta,
  resumo,
  temPalavraDeRua,
  type DadosDaRecolha,
  type PassoDaRecolha,
} from "../whatsapp-recolha";
import { MARCA_DO_CODIGO_POSTAL, MARCA_DO_CONTACTO, textoAnonimizado, type QuemEscreve } from "./anonimizar";
import { linhaDoDia, linhaDoFioParaOModelo, type LinhaParaOModelo } from "./aviso-ao-modelo";
import { correrFerramenta, FERRAMENTAS_DA_VITORIA, type DependenciasDasFerramentas, type EstadoDaConversa, type ResultadoDaFerramenta } from "./ferramentas";
import { eOSimDoCodigo } from "./pendentes";
import { MINUTOS_PARA_O_SIM } from "./propostas-do-agente";

/* ── As marcas ───────────────────────────────────────────────────────────── */

export const MARCA_DO_NOME = "[nome recebido]";
export const MARCA_DO_NIF = "[NIF recebido]";
/** Onde o resumo do código entra na resposta (o modelo nunca o escreve). */
export const MARCA_DO_RESUMO = "[resumo do pedido]";

/** «[morada recebida: Almada]» — a localidade fica: não identifica ninguém e é o que o pedido precisa. */
export function marcaDaMorada(localidade: string | null | undefined, destino = false): string {
  const l = String(localidade ?? "").replace(/[[\]]/g, "").trim();
  const quem = destino ? "morada de destino recebida" : "morada recebida";
  return l ? `[${quem}: ${l}]` : `[${quem}]`;
}

/** Uma marca de dado tapado num texto (que nunca pode ir ao cliente nem ser gravada pelo modelo). */
const MARCA_TAPADA = /\[(?:nome recebido|morada(?: de destino)? recebida[^\]]*|NIF recebido|código postal recebido|contacto recebido)\]/i;

/* ── O que se sabe de quem escreve ───────────────────────────────────────── */

/** Os dados pessoais desta conversa: para os tapar no que vai ao modelo e para ver se algum escapou. */
export type DadosConhecidos = {
  nomes: string[];
  moradas: Array<{ texto: string; localidade: string | null; destino?: boolean }>;
  nifs: string[];
};

export function semConhecidos(): DadosConhecidos {
  return { nomes: [], moradas: [], nifs: [] };
}

export function juntarConhecidos(...todos: DadosConhecidos[]): DadosConhecidos {
  const out = semConhecidos();
  for (const k of todos) {
    for (const n of k.nomes) if (n.trim() && !out.nomes.includes(n)) out.nomes.push(n);
    for (const m of k.moradas) if (m.texto.trim() && !out.moradas.some((x) => x.texto === m.texto)) out.moradas.push(m);
    for (const f of k.nifs) if (f && !out.nifs.includes(f)) out.nifs.push(f);
  }
  return out;
}

/** O que os dados de um rascunho dizem de quem escreve (o da Vitória de sempre, ou o da sombra). */
export function conhecidosDoRascunho(d: DadosDaRecolha | null | undefined): DadosConhecidos {
  const k = semConhecidos();
  if (!d) return k;
  if (d.contactName) k.nomes.push(d.contactName);
  if (d.address) k.moradas.push({ texto: d.address, localidade: d.city ?? null });
  if (d.moradaDestino) k.moradas.push({ texto: d.moradaDestino, localidade: d.localidadeDestino ?? null, destino: true });
  if (d.nifFactura) k.nifs.push(d.nifFactura);
  return k;
}

const plano = (t: string) =>
  String(t ?? "")
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** As palavras do nome que identificam: «Ana Sofia Prates» → ana, sofia, prates. */
function palavrasDoNome(nome: string | null | undefined): string[] {
  return plano(String(nome ?? ""))
    .split(/[^a-z]+/)
    .filter((p) => p.length >= 3 && !/^(cliente|whatsapp|dona|senhor|senhora|nome|recebido)$/.test(p));
}

/** A rua sem o número: «Rua das Flores 12, 6.º C» → «rua das flores». */
function ruaDaMorada(morada: string | null | undefined): string | null {
  const r = plano(String(morada ?? ""))
    .split(/[,\n]/)[0]
    .replace(/\d+.*$/, "")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return r.length >= 6 ? r : null;
}

/* ── 1. O código lê o nome, a morada, o NIF e o código postal ────────────── */

const CP_COM_LOCALIDADE =
  /(?<!\d)(\d{4})(?:\s?-\s?|\s)(\d{3})(?![\d,.]?\d)(?!\s?€)[ \t,]*([A-ZÀ-Ý][a-zà-ÿ'’-]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ý][a-zà-ÿ'’-]+){0,3})?/;

export type LidoPeloCodigo = {
  /** Os campos crus, para os validadores de sempre (`fundirCampos`). */
  campos: CamposCrus;
  /** O que se leu, para o tapar. */
  conhecidos: DadosConhecidos;
  /** Os passos que o código guardou nesta mensagem (para o «o que teria feito»). */
  lidos: string[];
};

/**
 * O NOME, A MORADA, O NIF E O CÓDIGO POSTAL DE UMA MENSAGEM, pelos leitores
 * da recolha (`lerMensagemLivre`, `moradaNaFrase`, `nifNaFrase`) — e, quando
 * é isso que falta no rascunho, a resposta curta à pergunta («Ana Prates» à
 * pergunta do nome). Nunca o modelo.
 */
export function lerDadosPessoais(texto: string, dados: DadosDaRecolha): LidoPeloCodigo {
  const t = String(texto ?? "").trim();
  const campos: CamposCrus = {};
  const conhecidos = semConhecidos();
  const lidos: string[] = [];
  if (!t) return { campos, conhecidos, lidos };
  const livre = lerMensagemLivre(t);
  const falta = primeiroPassoEmFalta(dados);

  const nome = livre.nome ?? (falta === "nome" && t.length <= 60 && !/\d/.test(t) ? nomeDoTexto(t, true) : null);
  if (nome) {
    campos.nome = nome;
    conhecidos.nomes.push(nome);
    lidos.push("nome");
  }

  const primeiraLinha = t.split(/\n+/)[0].trim();
  const morada = livre.morada ?? moradaNaFrase(t) ?? (falta === "morada" && temPalavraDeRua(primeiraLinha) ? primeiraLinha : null);
  if (morada) {
    campos.morada = morada;
    const local = fundirCampos({}, { morada }).city ?? localidadeNoFimDaMorada(morada);
    conhecidos.moradas.push({ texto: morada, localidade: local ?? null });
    lidos.push("morada");
  }
  if (livre.moradaDestino) {
    campos.moradaDestino = livre.moradaDestino;
    const local = fundirCampos({}, { moradaDestino: livre.moradaDestino }).localidadeDestino ?? localidadeNoFimDaMorada(livre.moradaDestino);
    conhecidos.moradas.push({ texto: livre.moradaDestino, localidade: local ?? null, destino: true });
    lidos.push("moradaDestino");
  }

  // O código postal chega tapado ao modelo: guarda-o o código (com a localidade a seguir, se vier).
  const cp = t.match(CP_COM_LOCALIDADE);
  if (cp && !(morada && morada.includes(cp[0].trim()))) {
    campos.codigoPostal = `${cp[1]}-${cp[2]} ${cp[3] ?? ""}`.trim();
    lidos.push("codigoPostal");
  }

  // O NIF: à pergunta dele, nove algarismos; no meio de outra frase, só com «NIF» por perto e o controlo certo.
  const pedeNif = falta === "nif" || falta === "fatura";
  const falaDoNif = /\b(nif|contribuinte)\b/i.test(t);
  const lido = nifNaFrase(t);
  const nif = pedeNif && !lido ? nifDaFactura(t) : lido && (pedeNif || (falaDoNif && nifComControloCerto(lido))) ? lido : null;
  if (nif) {
    campos.nif = nif;
    conhecidos.nifs.push(nif);
    lidos.push("nif");
  }
  return { campos, conhecidos, lidos };
}

/* ── 2. O que vai ao modelo vai com marcas ───────────────────────────────── */

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Troca todas as vezes que `alvo` aparece (sem olhar a maiúsculas nem a espaços a mais). */
function trocarTodas(texto: string, alvo: string, marca: string): string {
  const a = alvo.trim();
  if (a.length < 3) return texto;
  const re = new RegExp(escapar(a).replace(/\s+/g, "\\s+"), "giu");
  return texto.replace(re, marca);
}

/** Troca a rua (sem olhar a acentos) e o número da porta que vier logo a seguir. */
function trocarARua(texto: string, rua: string, marca: string): string {
  let t = texto;
  for (let vezes = 0; vezes < 5; vezes++) {
    const p = plano(t);
    if (p.length !== t.length) return t;
    const i = p.indexOf(rua);
    if (i < 0) return t;
    const depois = t.slice(i + rua.length).match(/^[\s,]*(?:n[.ºo°]*\s*)?\d+[a-zA-Z]?/);
    t = t.slice(0, i) + marca + t.slice(i + rua.length + (depois ? depois[0].length : 0));
  }
  return t;
}

/**
 * O TEXTO COM OS DADOS PESSOAIS TROCADOS POR MARCAS: as moradas (inteiras e
 * pela rua), o NIF e o nome; depois a guarda de sempre (`textoAnonimizado`:
 * contactos, códigos postais, o nome e a rua dos pedidos).
 */
export function marcarDadosPessoais(texto: string, k: DadosConhecidos, quem: readonly QuemEscreve[] = []): string {
  let t = String(texto ?? "").normalize("NFC");
  const moradas = [...k.moradas].sort((a, b) => b.texto.length - a.texto.length);
  for (const m of moradas) t = trocarTodas(t, m.texto, marcaDaMorada(m.localidade, m.destino));
  for (const m of moradas) {
    const rua = ruaDaMorada(m.texto);
    if (rua) t = trocarARua(t, rua, marcaDaMorada(m.localidade, m.destino));
  }
  for (const q of quem) {
    const rua = ruaDaMorada(q.address);
    if (rua) t = trocarARua(t, rua, marcaDaMorada(null));
  }
  for (const nif of k.nifs) {
    const re = new RegExp(nif.split("").map(escapar).join("[\\s.]?"), "g");
    t = t.replace(re, MARCA_DO_NIF);
  }
  const palavras = new Set([...k.nomes, ...quem.map((q) => q.contactName ?? "")].flatMap((n) => palavrasDoNome(n)));
  if (palavras.size > 0) {
    t = t.replace(/\p{L}+/gu, (w) => (palavras.has(plano(w)) ? MARCA_DO_NOME : w));
    t = t.replace(new RegExp(`${escapar(MARCA_DO_NOME)}(?:\\s+${escapar(MARCA_DO_NOME)})+`, "g"), MARCA_DO_NOME);
  }
  return textoAnonimizado(t, quem);
}

/**
 * QUANTOS DADOS PESSOAIS CONHECIDOS AINDA ESTÃO NO TEXTO — uma palavra do
 * nome, uma rua, um NIF. Tem de ser zero no que vai ao modelo; se não for,
 * o modelo não se chama (`recolha-em-ensaio.ts`).
 */
export function fugasNoTexto(texto: string, k: DadosConhecidos, quem: readonly QuemEscreve[] = []): number {
  const p = ` ${plano(texto).replace(/[^a-z0-9]+/g, " ")} `;
  let n = 0;
  const nomes = new Set([...k.nomes, ...quem.map((q) => q.contactName ?? "")].flatMap((x) => palavrasDoNome(x)));
  for (const w of nomes) if (p.includes(` ${w} `)) n += 1;
  for (const m of [...k.moradas.map((x) => x.texto), ...quem.map((q) => q.address ?? "")]) {
    const rua = ruaDaMorada(m);
    if (rua && p.includes(` ${rua} `)) n += 1;
  }
  const digitos = String(texto ?? "").replace(/[\s.]/g, "");
  for (const nif of k.nifs) if (digitos.includes(nif)) n += 1;
  return n;
}

/* ── 3. O rascunho como o modelo o vê ────────────────────────────────────── */

/** Os passos que o modelo grava (o resto lê-o o código). */
export const PASSOS_QUE_O_AGENTE_GRAVA_NA_RECOLHA = [
  "servico",
  "codigoPostal",
  "codigoPostalDestino",
  "andar",
  "elevador",
  "estacionamento",
  "andarDestino",
  "elevadorDestino",
  "estacionamentoDestino",
  "entulhoQuantidade",
  "quando",
  "descricao",
  "fatura",
] as const satisfies readonly PassoDaRecolha[];
export type PassoQueOAgenteGrava = (typeof PASSOS_QUE_O_AGENTE_GRAVA_NA_RECOLHA)[number];

/** Os que lê o código, da mensagem do cliente (e que o modelo nunca vê). */
export const PASSOS_QUE_O_CODIGO_LE = ["nome", "morada", "moradaDestino", "nif"] as const satisfies readonly PassoDaRecolha[];

const CAMPO_CRU: Record<PassoQueOAgenteGrava, keyof CamposCrus> = {
  servico: "servico",
  codigoPostal: "codigoPostal",
  codigoPostalDestino: "codigoPostalDestino",
  andar: "andar",
  elevador: "elevador",
  estacionamento: "estacionamento",
  andarDestino: "andarDestino",
  elevadorDestino: "elevadorDestino",
  estacionamentoDestino: "estacionamentoDestino",
  entulhoQuantidade: "entulho",
  quando: "quando",
  descricao: "descricao",
  fatura: "fatura",
};

const CAMPOS_DOS_DADOS: Record<PassoQueOAgenteGrava, Array<keyof DadosDaRecolha>> = {
  servico: ["serviceType"],
  codigoPostal: ["postalCode", "city"],
  codigoPostalDestino: ["codigoPostalDestino", "localidadeDestino"],
  andar: ["floor", "hasElevator"],
  elevador: ["hasElevator"],
  estacionamento: ["parkingDistance", "metrosAtePorta"],
  andarDestino: ["andarDestino"],
  elevadorDestino: ["elevadorDestino"],
  estacionamentoDestino: ["estacionamentoDestino", "metrosAtePortaDestino"],
  entulhoQuantidade: ["entulhoQuantidade", "volumeDito"],
  quando: ["quandoTexto", "dataDesejada", "urgency", "quandoComTodas"],
  descricao: ["description", "fotosDitas"],
  fatura: ["precisaFatura"],
};

const COMO_SE_DIZ: Record<PassoQueOAgenteGrava, string> = {
  servico: "um dos ids de servicosDoSite (ler_rascunho)",
  codigoPostal: "a localidade («Almada») ou o código postal com a localidade",
  codigoPostalDestino: "a localidade de destino («Setúbal») ou o código postal com a localidade",
  andar: "o andar: «3», «r/c», «cave», «moradia», «-2»",
  elevador: "«sim» ou «não» (e «sim, pequeno» se o elevador for pequeno)",
  estacionamento: "«sim» (a carrinha pára à porta), «não», ou os metros («a 50 metros»)",
  andarDestino: "o andar no destino: «3», «r/c», «moradia»",
  elevadorDestino: "«sim» ou «não»",
  estacionamentoDestino: "«sim», «não», ou os metros",
  entulhoQuantidade: "a quantidade, como o cliente a disse («20 sacos», «1 m³»)",
  quando: "a data ou o período, como o cliente o disse («sexta de manhã», «12/12»)",
  descricao: "o que há para levar ou fazer, arrumado numa ou duas frases (sem nomes nem moradas)",
  fatura: "«sim» (quer NIF na fatura) ou «não»",
};

const ETIQUETA_DO_SERVICO = new Map(SERVICOS_DA_VITORIA.map((c) => [c.id, c.label]));

/** O RASCUNHO COMO O MODELO O VÊ: o que já se sabe (com marcas), o que falta, e os serviços do site. */
export function vistaDoRascunho(d: DadosDaRecolha) {
  const falta = passosEmFalta(d);
  const estac = (v: string | null | undefined) => (v === undefined ? null : v === null ? "por saber" : v === "near" ? "sim, à porta" : "não, fica longe");
  return {
    jaSeSabe: {
      servico: d.serviceType ? { id: d.serviceType, nome: ETIQUETA_DO_SERVICO.get(d.serviceType) ?? d.serviceType } : null,
      nome: d.contactName ? MARCA_DO_NOME : null,
      morada: d.address ? marcaDaMorada(d.city) : null,
      localidade: d.city ?? null,
      codigoPostal: d.postalCode ? MARCA_DO_CODIGO_POSTAL : null,
      moradaDestino: d.moradaDestino ? marcaDaMorada(d.localidadeDestino, true) : null,
      localidadeDestino: d.localidadeDestino ?? null,
      andar: d.floor ?? null,
      elevador: d.hasElevator ?? null,
      estacionamento: estac(d.parkingDistance),
      andarDestino: d.andarDestino ?? null,
      elevadorDestino: d.elevadorDestino ?? null,
      estacionamentoDestino: estac(d.estacionamentoDestino),
      entulho: d.entulhoQuantidade ?? null,
      quando: d.quandoTexto ?? null,
      descricao: d.description ? marcarDadosPessoais(d.description, conhecidosDoRascunho(d)) : null,
      fatura: d.precisaFatura === undefined ? null : d.precisaFatura ? "com NIF" : "sem NIF",
      nif: d.nifFactura ? MARCA_DO_NIF : null,
    },
    passosEmFalta: falta,
    primeiroPassoEmFalta: primeiroPassoEmFalta(d),
    resumoPronto: falta.length === 0,
    quemGrava: {
      osistema: [...PASSOS_QUE_O_CODIGO_LE, "codigoPostal (com os números)"],
      tu: [...PASSOS_QUE_O_AGENTE_GRAVA_NA_RECOLHA],
    },
    servicosDoSite: SERVICOS_DA_VITORIA.map((c) => ({ id: c.id, nome: c.label })),
  };
}

export type GravacaoNoRascunho =
  | { ok: true; dados: DadosDaRecolha; gravado: Record<string, unknown>; jaEstava: boolean }
  | { ok: false; porque: string };

/**
 * GRAVAR UM VALOR NO RASCUNHO — pelos validadores da recolha (`fundirCampos`,
 * literalmente o mesmo código). O que não passa não entra, e a razão volta ao
 * modelo. Puro: devolve os dados novos.
 */
export function gravarNoRascunho(dados: DadosDaRecolha, passo: unknown, valor: unknown, agora: Date): GravacaoNoRascunho {
  const p = String(passo ?? "").trim() as PassoQueOAgenteGrava;
  if ((PASSOS_QUE_O_CODIGO_LE as readonly string[]).includes(p)) {
    return { ok: false, porque: `O ${p} lê-o o sistema da mensagem do cliente (chega-te tapado): não o graves; se faltar, pergunta-o ao cliente.` };
  }
  if (!(PASSOS_QUE_O_AGENTE_GRAVA_NA_RECOLHA as readonly string[]).includes(p)) return { ok: false, porque: "Esse passo não se grava por aqui." };
  const v = typeof valor === "string" ? valor.replace(/\s+/g, " ").trim().slice(0, p === "descricao" ? 1000 : 200) : "";
  if (!v) return { ok: false, porque: "Falta o valor." };
  if (MARCA_TAPADA.test(v)) return { ok: false, porque: "Esse valor tem a marca de um dado tapado: o sistema já o guardou — não o graves." };
  const crus: CamposCrus = { [CAMPO_CRU[p]]: v };
  const depois = fundirCampos(dados, crus, agora);
  const campos = CAMPOS_DOS_DADOS[p];
  const mudou = (a: DadosDaRecolha, b: DadosDaRecolha) => campos.some((c) => JSON.stringify(a[c]) !== JSON.stringify(b[c]));
  if (!mudou(dados, depois)) {
    // Já estava assim? (o mesmo valor, aceite pelo validador de raiz.)
    if (mudou({}, fundirCampos({}, crus, agora))) return { ok: true, dados, gravado: {}, jaEstava: true };
    return { ok: false, porque: `O validador da recolha não aceitou «${v}» para ${p}. Diz-se assim: ${COMO_SE_DIZ[p]}. Se o cliente não o disse, pergunta-lhe.` };
  }
  const gravado = Object.fromEntries(campos.filter((c) => JSON.stringify(dados[c]) !== JSON.stringify(depois[c])).map((c) => [c, depois[c] ?? null]));
  return { ok: true, dados: depois, gravado, jaEstava: false };
}

/* ── 4. O SIM ao resumo ─────────────────────────────────────────────────── */

export type RespostaAoResumo = { tipo: "confirmou" } | { tipo: "expirou" } | { tipo: "outra" };

/** O SIM ao resumo, lido pelo código (a mesma regra do SIM do agente: curto, sem «não», em 30 min). Puro. */
export function respostaAoResumo(propostoEm: string, texto: string | null | undefined, agora: Date): RespostaAoResumo {
  const desde = (agora.getTime() - new Date(propostoEm).getTime()) / 60_000;
  const sim = eOSimDoCodigo(texto);
  if (!(desde >= 0 && desde <= MINUTOS_PARA_O_SIM)) return sim ? { tipo: "expirou" } : { tipo: "outra" };
  return sim ? { tipo: "confirmou" } : { tipo: "outra" };
}

/** A resposta com o resumo do código no lugar da marca (para a fase 2; no ensaio guarda-se com a marca). */
export function comOResumo(texto: string, dados: DadosDaRecolha): string {
  return texto.includes(MARCA_DO_RESUMO) ? texto.replace(MARCA_DO_RESUMO, resumo(dados)) : texto;
}

/* ── 5. A comparação com a Vitória de sempre ─────────────────────────────── */

/** As linhas do resumo que levam dados de pessoas: comparam-se, mas o valor não se guarda. */
const ROTULOS_PESSOAIS = new Set(["Nome", "Morada", "Destino", "Fatura"]);

export type CampoComparado = { campo: string; igual: boolean; agente: string | null; antiga: string | null };

function camposDoResumo(d: DadosDaRecolha): Map<string, string> {
  const m = new Map<string, string>();
  for (const linha of linhasDoResumo(d)) {
    const partes = linha.split(" · ");
    const i = partes[0].indexOf(": ");
    if (i < 0) continue;
    const rotulo = partes[0].slice(0, i);
    m.set(rotulo, partes[0].slice(i + 2));
    for (const sub of partes.slice(1)) {
      const j = sub.indexOf(": ");
      if (j > 0) m.set(`${rotulo} › ${sub.slice(0, j)}`, sub.slice(j + 2));
    }
  }
  return m;
}

const valorNormal = (v: string | undefined) => plano(String(v ?? "")).replace(/[^a-z0-9]+/g, " ").trim();
const vazioNoResumo = (v: string | undefined) => v == null || v.trim() === "—" || v.trim() === "";

/**
 * O RESUMO DO AGENTE AO LADO DO DA VITÓRIA DE SEMPRE, campo a campo (as
 * linhas de `linhasDoResumo`, as mesmas que o cliente lê). A descrição conta
 * igual quando as duas a têm (o texto é livre de propósito). O nome, a morada,
 * o destino e a fatura comparam-se, mas o valor guarda-se tapado.
 */
export function compararOsResumos(agente: DadosDaRecolha, antiga: DadosDaRecolha): { campos: CampoComparado[]; iguais: number; comparados: number } {
  const a = camposDoResumo(agente);
  const b = camposDoResumo(antiga);
  const rotulos = [...new Set([...a.keys(), ...b.keys()])];
  const campos: CampoComparado[] = [];
  for (const r of rotulos) {
    const va = a.get(r);
    const vb = b.get(r);
    if (vazioNoResumo(va) && vazioNoResumo(vb)) continue;
    const igual =
      r === "Descrição" ? !vazioNoResumo(va) && !vazioNoResumo(vb) : !vazioNoResumo(va) && !vazioNoResumo(vb) && valorNormal(va) === valorNormal(vb);
    const tapar = (v: string | undefined) => (vazioNoResumo(v) ? null : ROTULOS_PESSOAIS.has(r.split(" › ")[0]) ? "[dado tapado]" : String(v).slice(0, 160));
    campos.push({ campo: r, igual, agente: tapar(va), antiga: tapar(vb) });
  }
  return { campos, iguais: campos.filter((c) => c.igual).length, comparados: campos.length };
}

/* ── 6. Os números do ensaio ─────────────────────────────────────────────── */

/** O prazo de uma volta a sério (o mesmo da «conversa livre»: `PRAZO_DA_VOLTA_AO_VIVO_MS`). */
export const PRAZO_DA_RECOLHA_MS = 22_000;

/** Os critérios para passar à fase 2 (decisão d99). */
export const CRITERIOS_DA_RECOLHA = Object.freeze({
  camposIguais: 0.9,
  fugasNoModelo: 0,
  avaliadasMelhorOuIgual: 0.7,
  custoPorPedidoUsd: 0.35,
  passaramOPrazo: 0.05,
});

export type LinhaDaRecolhaEmEnsaio = {
  telefone: string;
  criadoEm: Date;
  camposIguais: number;
  camposComparados: number;
  ambosNoResumo: boolean;
  fugasEvitadas: number;
  fugasNoModelo: number;
  chamouOModelo: boolean;
  duracaoMs: number;
  custoUsd: number;
  avaliacao: string | null;
};

export type Criterio = { valor: number | null; meta: string; cumpre: boolean | null; base: number };

export type MetricasDaRecolha = {
  ensaios: number;
  camposIguais: Criterio;
  fugasNoModelo: Criterio;
  fugasEvitadas: number;
  avaliadasMelhorOuIgual: Criterio;
  custoPorPedidoUsd: Criterio;
  passaramOPrazo: Criterio;
  /** Todos os critérios com dados e cumpridos? (null: ainda sem dados para todos) */
  prontaParaAFase2: boolean | null;
};

const pct = (v: number) => Math.round(v * 1000) / 1000;

/** OS CINCO CRITÉRIOS DA d99, a partir das linhas do ensaio. Puro. */
export function metricasDaRecolha(linhas: readonly LinhaDaRecolhaEmEnsaio[]): MetricasDaRecolha {
  const C = CRITERIOS_DA_RECOLHA;
  // Campos: a última comparação de cada número com os dois resumos prontos.
  const ultimaPorNumero = new Map<string, LinhaDaRecolhaEmEnsaio>();
  for (const l of [...linhas].sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())) {
    if (l.ambosNoResumo && l.camposComparados > 0) ultimaPorNumero.set(l.telefone, l);
  }
  const noResumo = [...ultimaPorNumero.values()];
  const iguais = noResumo.reduce((s, l) => s + l.camposIguais, 0);
  const comparados = noResumo.reduce((s, l) => s + l.camposComparados, 0);
  const camposIguais: Criterio = {
    valor: comparados > 0 ? pct(iguais / comparados) : null,
    meta: `≥ ${C.camposIguais * 100} %`,
    cumpre: comparados > 0 ? iguais / comparados >= C.camposIguais : null,
    base: noResumo.length,
  };
  const fugas = linhas.reduce((s, l) => s + l.fugasNoModelo, 0);
  const chamadas = linhas.filter((l) => l.chamouOModelo);
  const fugasNoModelo: Criterio = { valor: chamadas.length > 0 ? fugas : null, meta: "0", cumpre: chamadas.length > 0 ? fugas === C.fugasNoModelo : null, base: chamadas.length };
  const avaliadas = linhas.filter((l) => l.avaliacao === "melhor" || l.avaliacao === "igual" || l.avaliacao === "pior");
  const boas = avaliadas.filter((l) => l.avaliacao !== "pior").length;
  const avaliadasMelhorOuIgual: Criterio = {
    valor: avaliadas.length > 0 ? pct(boas / avaliadas.length) : null,
    meta: `≥ ${C.avaliadasMelhorOuIgual * 100} %`,
    cumpre: avaliadas.length > 0 ? boas / avaliadas.length >= C.avaliadasMelhorOuIgual : null,
    base: avaliadas.length,
  };
  const numeros = new Set(chamadas.map((l) => l.telefone));
  const custo = linhas.reduce((s, l) => s + l.custoUsd, 0);
  const porPedido = numeros.size > 0 ? Math.round((custo / numeros.size) * 10000) / 10000 : null;
  const custoPorPedidoUsd: Criterio = {
    valor: porPedido,
    meta: `≤ ${C.custoPorPedidoUsd.toFixed(2)} USD`,
    cumpre: porPedido == null ? null : porPedido <= C.custoPorPedidoUsd,
    base: numeros.size,
  };
  const lentas = chamadas.filter((l) => l.duracaoMs > PRAZO_DA_RECOLHA_MS).length;
  const passaramOPrazo: Criterio = {
    valor: chamadas.length > 0 ? pct(lentas / chamadas.length) : null,
    meta: `< ${C.passaramOPrazo * 100} % acima de ${PRAZO_DA_RECOLHA_MS / 1000} s`,
    cumpre: chamadas.length > 0 ? lentas / chamadas.length < C.passaramOPrazo : null,
    base: chamadas.length,
  };
  const todos = [camposIguais, fugasNoModelo, avaliadasMelhorOuIgual, custoPorPedidoUsd, passaramOPrazo];
  return {
    ensaios: linhas.length,
    camposIguais,
    fugasNoModelo,
    fugasEvitadas: linhas.filter((l) => l.fugasEvitadas > 0).length,
    avaliadasMelhorOuIgual,
    custoPorPedidoUsd,
    passaramOPrazo,
    prontaParaAFase2: todos.some((c) => c.cumpre == null) ? null : todos.every((c) => c.cumpre === true),
  };
}

/* ── 7. O aviso, a mensagem do turno e as ferramentas ───────────────────── */

/** Fixo (a cache de prompt é um prefixo): a data e a conversa vão na mensagem do turno. */
export const AVISO_DA_RECOLHA = `És a ${NOME_DA_ASSISTENTE}, a assistente automática da CLYON, no WhatsApp. Quando te apresentas: «${QUEM_FALA}». ${O_QUE_ELA_FAZ} ${SE_PREFERIR_UMA_PESSOA}

A CLYON
É uma plataforma: o cliente faz o pedido, os parceiros da zona respondem com o preço deles, o cliente escolhe, e a CLYON organiza e guarda o combinado. Quem faz o trabalho é sempre o parceiro escolhido — uma empresa parceira, com a sua equipa. Falas do «parceiro», e nunca dizes que a CLYON leva, recolhe ou faz.

O QUE ESTÁS A FAZER
Este número ainda não tem pedido. Recolhes, com naturalidade, os dados para criar o pedido dele: o serviço, o nome, a morada, o andar e o acesso, quando, o que há para levar ou fazer, e a fatura. No fim, o sistema mostra-lhe o resumo e só o SIM dele regista o pedido — tu nunca crias nem registas pedido nenhum, e nunca dizes que ficou registado.

COMO TRABALHAS
- Em cada volta, primeiro ler_rascunho: diz o que já se sabe, o que falta (passosEmFalta, pela ordem de perguntar) e os serviços do site (servicosDoSite). O que lá está não se pergunta outra vez.
- O que o cliente disse nesta mensagem e ainda não está no rascunho, gravas com gravar_no_rascunho(passo, valor), um passo de cada vez, com o valor arrumado (o serviço pelo id da lista; o andar «3», «r/c»; o elevador «sim»/«não»; a data como ele a disse). Cada valor passa pelos validadores da recolha: se for recusado, lê a razão, corrige o valor ou pergunta ao cliente. Nunca inventes um valor que ele não disse.
- Depois perguntas o primeiro passo que falta, uma pergunta de cada vez. Se ele fez perguntas, respondes primeiro.
- As linhas «[equipa]» foram escritas por uma pessoa da equipa da CLYON nesta conversa: o que ela perguntou ou disse conta como dito. Continua a partir daí — não a contradigas nem repitas a pergunta dela.
- Quando ler_rascunho disser resumoPronto, chamas propor_registo e pões na resposta a marca ${MARCA_DO_RESUMO}, tal e qual, numa linha à parte: o sistema troca-a pelo resumo com todos os dados, que já agradece e acaba a pedir o SIM. Não escrevas mais nada a seguir à marca.

OS DADOS TAPADOS
Por privacidade, o nome, a morada, o NIF, o código postal e os contactos chegam-te tapados: «${MARCA_DO_NOME}», «${marcaDaMorada("<localidade>")}», «${MARCA_DO_NIF}», «${MARCA_DO_CODIGO_POSTAL}», «${MARCA_DO_CONTACTO}». Querem dizer que o cliente os deu e que o sistema já os guardou: nunca os peças outra vez, nunca tentes gravá-los e nunca escrevas estas marcas na resposta ao cliente (trata-o sem nome). Se ler_rascunho disser que falta o nome, a morada ou o NIF, pergunta-os — o sistema lê a resposta dele.

COMO FALAS
Como uma pessoa simpática e competente no WhatsApp: calorosa, natural, directa, curta (duas a quatro frases). Varia as frases; nunca o mesmo molde. No máximo um emoji. Português de Portugal (nunca o do Brasil), a tratar por «o senhor»/«a senhora» ou sem pronome. Escreves sempre em português de Portugal: à saída, a mensagem é traduzida para a língua do cliente.

SER SINCERA
És uma assistente automática: no início da conversa apresentas-te assim e lembras que pode falar com uma pessoa da equipa. Se te perguntarem se és uma pessoa, dizes a verdade («${SOU_A_ASSISTENTE_AUTOMATICA}»). Nunca finjas ser uma pessoa.

O QUE TENS SEMPRE PRESENTE
- Só os serviços de servicosDoSite. Pedidos de outra coisa (jardinagem, limpezas, obras…): dizes com delicadeza que não é um serviço da CLYON.
- Preços e regras só de o_que_o_site_sabe e perguntas_frequentes, tal como vieram; um valor sem IVA nunca vai sozinho. O preço certo chega nas propostas dos parceiros, depois do pedido.
- Fotografias: se o cliente as tiver, pode enviá-las aqui; o sistema junta-as ao pedido.
- Nunca prometas «no ${PROPRIO_DIA}». A CLYON não tem contentores nem big bags.
- Se o cliente pedir uma pessoa, se queixar, ou não souberes responder com o que as ferramentas dão, passar_a_equipa com o motivo e a tua mensagem.

A RESPOSTA
Entrega a mensagem com propor_resposta, uma vez, no fim. Se a revisão a recusar, reescreve-a sem o que ela apontou; se não conseguires, passa a uma pessoa.`;

/** A mensagem do turno da recolha: o dia, a conversa (já com marcas) e uma nota do sistema. */
export function mensagemDaRecolha(agora: Date, conversa: readonly LinhaParaOModelo[], nota?: string): string {
  const fio = conversa
    .slice(-30)
    .map(linhaDoFioParaOModelo)
    .join("\n");
  const base = `${linhaDoDia(agora)}\nEste número ainda não tem pedido: estás a recolher os dados do pedido novo.\n\nA conversa até agora (a última linha do cliente é a que tens de responder):\n${fio}`;
  return nota && nota.trim() ? `${base}\n\nNota do sistema (não é do cliente): ${nota.replace(/\s+/g, " ").trim().slice(0, 600)}` : base;
}

const objecto = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object" as const,
  properties,
  required,
  additionalProperties: false,
});

const DA_VITORIA = (nome: string) => {
  const f = FERRAMENTAS_DA_VITORIA.find((x) => x.name === nome);
  if (!f) throw new Error(`falta a ferramenta ${nome}`);
  return f;
};

/** AS FERRAMENTAS DA RECOLHA, numa ordem fixa (a cache). As três novas e quatro das de sempre. */
export const FERRAMENTAS_DA_RECOLHA: Anthropic.Beta.BetaTool[] = [
  {
    name: "ler_rascunho",
    description:
      "O rascunho do pedido novo deste número: o que já se sabe (os dados pessoais tapados), os passos que faltam pela ordem de perguntar, se o resumo está pronto, e os serviços do site (id e nome).",
    input_schema: objecto({}, []),
    strict: true,
  },
  {
    name: "gravar_no_rascunho",
    description:
      "Grava no rascunho um dado que o cliente disse, com o valor arrumado, pelos validadores da recolha. Se o valor for recusado, devolve a razão. O nome, a morada, o NIF e o código postal com números grava-os o sistema: não os passes.",
    input_schema: objecto(
      {
        passo: { type: "string", enum: [...PASSOS_QUE_O_AGENTE_GRAVA_NA_RECOLHA], description: "O dado." },
        valor: { type: "string", description: "O valor arrumado (o serviço pelo id; o andar «3»; «sim»/«não»; a data como ele a disse)." },
      },
      ["passo", "valor"],
    ),
    strict: true,
  },
  {
    name: "propor_registo",
    description:
      "Quando o rascunho está completo (resumoPronto): prepara o resumo do pedido. Não regista nada — a resposta leva a marca [resumo do pedido], que o sistema troca pelo resumo com o pedido do SIM; só o SIM do cliente regista.",
    input_schema: objecto({}, []),
    strict: true,
  },
  DA_VITORIA("o_que_o_site_sabe"),
  DA_VITORIA("perguntas_frequentes"),
  DA_VITORIA("passar_a_equipa"),
  DA_VITORIA("propor_resposta"),
];

const NOMES_DA_RECOLHA = new Set(FERRAMENTAS_DA_RECOLHA.map((f) => f.name));

/** O que uma volta da recolha precisa (o rascunho-sombra, mudado aqui dentro; o resto das ferramentas de sempre). */
export type ContextoDaRecolha = {
  dados: DadosDaRecolha;
  agora: Date;
  ferramentas: DependenciasDasFerramentas;
  conhecidos: DadosConhecidos;
  quem: readonly QuemEscreve[];
  /** O que o modelo gravou nesta volta (os passos), e se propôs o registo. */
  gravados: string[];
  resumoProposto: boolean;
};

const erro = (mensagem: string): ResultadoDaFerramenta => ({ resultado: { erro: mensagem }, erro: true });

/** CORRE UMA FERRAMENTA DA RECOLHA. Nunca lança. O que vem das de sempre volta tapado. */
export async function correrFerramentaDaRecolha(
  nome: string,
  entrada: unknown,
  ctx: ContextoDaRecolha,
  estado: EstadoDaConversa,
): Promise<ResultadoDaFerramenta> {
  if (!NOMES_DA_RECOLHA.has(nome)) return erro(`Não há a ferramenta «${nome}» na recolha.`);
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  try {
    switch (nome) {
      case "ler_rascunho":
        return { resultado: vistaDoRascunho(ctx.dados) };
      case "gravar_no_rascunho": {
        const g = gravarNoRascunho(ctx.dados, e.passo, e.valor, ctx.agora);
        if (!g.ok) return erro(g.porque);
        ctx.dados = g.dados;
        const passo = String(e.passo);
        if (!g.jaEstava && !ctx.gravados.includes(passo)) ctx.gravados.push(passo);
        return { resultado: { gravado: !g.jaEstava, jaEstava: g.jaEstava, ensaio: true, primeiroPassoEmFalta: primeiroPassoEmFalta(ctx.dados) } };
      }
      case "propor_registo": {
        const falta = passosEmFalta(ctx.dados);
        if (falta.length > 0) return erro(`Ainda falta: ${falta.join(", ")}. Pergunta primeiro o ${falta[0]}.`);
        ctx.resumoProposto = true;
        estado.fraseObrigatoria = MARCA_DO_RESUMO;
        estado.teriaFeito.push("teria mostrado o resumo do pedido, à espera do SIM (o resumo e o registo são do código)");
        return {
          resultado: {
            proposto: true,
            registado: false,
            fraseQueTemDeIrNaResposta: MARCA_DO_RESUMO,
            nota: "Põe a marca numa linha à parte, tal e qual; o sistema troca-a pelo resumo (que já agradece e pede o SIM). Antes dela, só se precisares de responder a uma pergunta do cliente; depois dela, nada.",
          },
        };
      }
      case "propor_resposta":
      case "passar_a_equipa": {
        const t = String(e[nome === "propor_resposta" ? "texto" : "mensagem"] ?? "");
        if (MARCA_TAPADA.test(t)) {
          const motivo = "Tem a marca de um dado tapado: ao cliente não se escreve («[nome recebido]», «[morada recebida…]»…). Trata-o sem nome e sem a morada.";
          if (nome === "propor_resposta") {
            estado.recusadas.push({ texto: t, motivo });
            return { resultado: { aceite: false, motivo }, erro: true };
          }
          return correrFerramenta(nome, { ...e, mensagem: "" }, ctx.ferramentas, estado);
        }
        return correrFerramenta(nome, e, ctx.ferramentas, estado);
      }
      default:
        // O que o site sabe e as perguntas frequentes: textos da CLYON, sem nada do cliente.
        return correrFerramenta(nome, e, ctx.ferramentas, estado);
    }
  } catch (err) {
    return erro(err instanceof Error ? `Falhou: ${err.message.slice(0, 160)}` : "Falhou.");
  }
}

/** Os ids dos serviços (para os testes e o painel). */
export const SERVICOS_DA_RECOLHA = IDS_DA_LISTA;
