import { nomeDoServico } from "./service-categories";
import {
  camposQueContam,
  frasesDoCliente,
  oQueSeVe,
  type FontesDaDescricao,
} from "./fontes-da-descricao";
import { segundaParagemPorExtenso, zonaDoCodigoPostal, type SegundaMorada } from "./segunda-morada";
import { instanteDaBase } from "./hora-de-lisboa";

/**
 * A DESCRIÇÃO ESCRITA PELO MODELO — 29-10-2026 (ordem do CEO, aprovada pelo
 * dono: «automático + botão»).
 *
 * Sempre que o pedido muda, o Gemini lê AS FONTES (o texto da equipa, o que o
 * cliente disse, o que se viu nas fotografias — `fontes-da-descricao.ts`) e
 * os campos do pedido, e a descrição sai num formato fixo, curto, para o
 * profissional:
 *
 *   Serviço: Recolha de móveis
 *   Para levar: 2 roupeiros, 1 cama, 3 sofás, 1 fogão, 1 máquina de lavar roupa.
 *   Confirmar se também vai: 1 colchão.
 *   Morada: Lisboa (1100), 3.º andar, com elevador.
 *   2.ª paragem: Lisboa (1400), 6.º andar C, elevador por confirmar.
 *   Quando: sábado, 31 de outubro, de manhã.
 *   Estacionamento: por confirmar.
 *   Fotografias: 4, enviadas pelo cliente.
 *   Por confirmar: o estacionamento; o elevador da 2.ª paragem.
 *
 * O MODELO SÓ FAZ A PARTE DIFÍCIL. Devolve JSON com o que é para levar (as
 * frases da equipa e do cliente juntas, com as quantidades, sem «móveis»
 * vagos quando se sabe quais), o que só se vê nas fotografias, o «quando»
 * dito por palavras, as notas e o que falta confirmar. As linhas que vêm de
 * campos — a morada, a 2.ª paragem, o andar, o elevador, as fotografias —
 * escrevem-se aqui, pelas colunas do pedido: o modelo nunca vê a rua, a
 * porta, o nome, o telefone nem o email do cliente.
 *
 * E NADA PASSA SEM SER LIDO (`validarAResposta`): sem preços nem valores, sem
 * contactos, sem moradas, português de Portugal, e cada coisa «para levar»
 * tem de estar nas fontes — o que não está, foi inventado. Uma resposta que
 * não passa não se usa: fica a descrição das regras (`descricaoPelasRegras`),
 * e a falha fica no termómetro do painel do WhatsApp («Descrição dos pedidos»).
 *
 * As partes puras (o aviso, a entrada, a validação, a composição) testam-se
 * sem modelo; `escreverADescricao` é a chamada.
 */

/** O que o modelo precisa de saber do pedido — e o que só serve para verificar. */
export type PedidoParaADescricao = {
  serviceType: string | null;
  city: string | null;
  postalCode: string | null;
  floor: string | null;
  hasElevator: string | null;
  parkingDistance: string | null;
  dataAgendada: Date | string | null;
  /** As fotografias que o pedido tem. */
  fotos: number;
  /** O destino de uma mudança, como o pedido o guarda. */
  destino?: { localidade: string | null; codigoPostal: string | null; andar: string | null; elevador: string | null } | null;
  /** SÓ PARA VERIFICAR a resposta — nunca vão ao modelo. */
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  address?: string | null;
};

/** O que o modelo devolve. */
export type RespostaDoModelo = {
  paraLevar: string[];
  confirmarSeTambemVai: string[];
  quando: string;
  estacionamento: string;
  notas: string[];
  porConfirmar: string[];
};

/* ──────────────────────────────────────────────────────────────────────────
 * O AVISO AO MODELO
 * ────────────────────────────────────────────────────────────────────────── */

export const INSTRUCAO_DA_DESCRICAO = [
  "És quem arruma a descrição de um pedido da CLYON, uma plataforma portuguesa que liga clientes a profissionais verificados.",
  "A descrição é para o PROFISSIONAL ler antes de propor o preço dele: tem de perceber o trabalho num relance.",
  "Recebes as fontes do pedido: o texto da equipa da CLYON (que manda, se houver conflito), as frases do cliente, " +
    "o que se viu nas fotografias e os campos do pedido.",
  "Devolve SÓ um objecto JSON com estas chaves:",
  '  "paraLevar": lista curta das coisas, cada uma com a quantidade quando se sabe («2 roupeiros», «1 máquina de lavar roupa»). ' +
    "Junta o que a equipa e o cliente disseram, sem repetir a mesma coisa. Se uma palavra vaga («móveis», «tralha») já está " +
    "explicada por coisas concretas, tira-a; se não está, deixa-a. Numa mudança é o que se transporta; numa reparação, o que há para fazer.",
  '  "confirmarSeTambemVai": o que SÓ se vê nas fotografias e ninguém disse — para o profissional confirmar se também vai.',
  '  "quando": o dia e a parte do dia ditos (por exemplo «sábado, 31 de outubro, de manhã»), ou "" se ninguém disse.',
  '  "estacionamento": o que foi dito sobre estacionar ou a distância da carrinha à porta, ou "".',
  '  "notas": pormenores úteis ao profissional que não cabem acima (o que NÃO é para levar, acessos difíceis, desmontagens, ' +
    "quem carrega), em frases curtas escritas por ti — nunca copies a frase do cliente tal e qual. O que o cliente disse que não é para levar fica SEMPRE aqui.",
  '  "porConfirmar": o que falta saber para fazer o preço, em poucas palavras («as medidas do roupeiro»).',
  "REGRAS: só o que está nas fontes — não inventes coisas, quantidades, dias nem acessos. Sem preços, sem valores, sem euros. " +
    "Sem nomes, telefones, emails nem moradas (nem ruas, nem números de porta, nem códigos postais). " +
    "Português de Portugal, frases curtas, sem cumprimentos nem emojis. Listas vazias quando não há nada.",
].join("\n");

/* ──────────────────────────────────────────────────────────────────────────
 * O QUE SE LIMPA ANTES DE IR AO MODELO
 * ────────────────────────────────────────────────────────────────────────── */

const CONTACTO = /(?:\+|00)?\d(?:[\s.-]?\d){8,}|\S+@\S+\.\S+|\bhttps?:\/\/\S+|\bwww\.\S+/g;
const CODIGO_POSTAL = /(?<!\d)\d{4}-\d{3}(?!\d)/g;

function plano(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** As palavras do nome que identificam: «Ana Sofia Prates» → ana, sofia, prates. */
function palavrasDoNome(nome: string | null | undefined): string[] {
  return plano(String(nome ?? ""))
    .split(/[^a-z]+/)
    .filter((p) => p.length >= 3 && !/^(cliente|whatsapp|dona|senhor|senhora)$/.test(p));
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

/** Sem contactos, sem códigos postais, sem o nome e sem a rua do cliente. */
export function semDadosPessoais(texto: string, pedido: Pick<PedidoParaADescricao, "contactName" | "address">): string {
  let t = texto.replace(CONTACTO, " ").replace(CODIGO_POSTAL, " ");
  const nome = palavrasDoNome(pedido.contactName);
  if (nome.length > 0) t = t.replace(/\p{L}+/gu, (w) => (nome.includes(plano(w)) ? " " : w));
  const rua = ruaDaMorada(pedido.address);
  if (rua) {
    const i = plano(t).indexOf(rua);
    if (i >= 0) t = t.slice(0, i) + " " + t.slice(i + rua.length);
  }
  return t.replace(/[ \t]{2,}/g, " ").replace(/\s+([.,;!?])/g, "$1").trim();
}

/* ──────────────────────────────────────────────────────────────────────────
 * OS CAMPOS DO PEDIDO EM PALAVRAS
 * ────────────────────────────────────────────────────────────────────────── */

/** «3.º andar», «rés-do-chão», «cave», «2.º andar Esq». */
export function andarPorExtenso(floor: string | null | undefined): string | null {
  const f = String(floor ?? "").trim();
  if (!f) return null;
  const m = /^(-?\d{1,2})\s*[º°ª]?\s*(.*)$/.exec(f);
  if (m) {
    const n = m[1];
    const base = n === "0" ? "rés-do-chão" : n === "-1" ? "cave" : `${Number(n)}.º andar`;
    return m[2] ? `${base} ${m[2].trim()}` : base;
  }
  if (/^r\/?c\b/i.test(f)) return `rés-do-chão${f.replace(/^r\/?c/i, "")}`.trim();
  return f;
}

function ePisoTerreo(floor: string | null | undefined): boolean {
  return /^(0|r\/?c|res)/i.test(String(floor ?? "").trim());
}

/** O elevador como as várias partes do site o gravam. */
export function elevadorPorExtenso(v: string | null | undefined): string | null {
  const e = plano(String(v ?? "").trim());
  if (["yes", "sim", "true", "1"].includes(e)) return "com elevador";
  if (e === "small" || /pequen/.test(e)) return "com elevador pequeno";
  if (["no", "nao", "false", "0"].includes(e)) return "sem elevador";
  return null;
}

/** O estacionamento como as várias partes do site o gravam (ver `estacionamentoDoPedido`). */
export function estacionamentoPorExtenso(v: string | null | undefined): string | null {
  const e = String(v ?? "").trim();
  if (["door", "under_20m", "near", "easy"].includes(e)) return "à porta";
  if (["over_30m", "difficult", "far"].includes(e)) return "longe da porta";
  return null;
}

/** «sábado, 31 de outubro» — em Lisboa, sempre. */
export function diaEmLisboa(data: Date | string | null | undefined): string | null {
  // O texto da base vem sem fuso, e é UTC (ver `instanteDaBase`).
  const d = instanteDaBase(data);
  if (!d) return null;
  return d.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon", weekday: "long", day: "numeric", month: "long" });
}

/** «Lisboa (1100)». */
function ondeE(localidade: string | null | undefined, cp: string | null | undefined): string | null {
  const l = String(localidade ?? "").replace(/\s*,?\s*portugal\s*$/i, "").trim();
  const z = zonaDoCodigoPostal(cp);
  if (l) return z ? `${l} (${z})` : l;
  return z ? `código postal ${z}` : null;
}

/** «Lisboa (1100), 3.º andar, com elevador» — e o que falta, para o «Por confirmar». */
function moradaPorExtenso(
  localidade: string | null | undefined,
  cp: string | null | undefined,
  floor: string | null | undefined,
  elevador: string | null | undefined,
  falta: string[],
  qual: string,
): string {
  const onde = ondeE(localidade, cp);
  const andar = andarPorExtenso(floor);
  const elev = ePisoTerreo(floor) ? null : elevadorPorExtenso(elevador);
  if (!onde) falta.push(`a localidade${qual}`);
  if (!andar) falta.push(`o andar${qual}`);
  else if (!ePisoTerreo(floor) && !elev) falta.push(`o elevador${qual}`);
  return [onde ?? "localidade por confirmar", andar ?? "andar por confirmar", ePisoTerreo(floor) ? null : (elev ?? "elevador por confirmar")]
    .filter(Boolean)
    .join(", ");
}

/* ──────────────────────────────────────────────────────────────────────────
 * A ENTRADA DO MODELO
 * ────────────────────────────────────────────────────────────────────────── */

/** O que se manda ao modelo: as fontes, limpas, e os campos em palavras. Sem dados pessoais. */
export function entradaDoModelo(fontes: FontesDaDescricao, pedido: PedidoParaADescricao): string {
  const limpa = (t: string) => semDadosPessoais(t, pedido);
  const campos = camposQueContam(fontes);
  const partes: string[] = [`SERVIÇO: ${nomeDoServico(pedido.serviceType)}`];
  const equipa = limpa(fontes.equipa);
  partes.push(`TEXTO DA EQUIPA (manda):\n${equipa || "(nenhum)"}`);
  const cliente = frasesDoCliente(fontes).map(limpa).filter(Boolean);
  partes.push(`O QUE O CLIENTE DISSE:\n${cliente.length ? cliente.map((c) => `- ${c}`).join("\n") : "(nada)"}`);
  const visto = oQueSeVe(fontes).map(limpa).filter(Boolean);
  partes.push(`O QUE SE VÊ NAS FOTOGRAFIAS (ninguém o disse):\n${visto.length ? visto.map((c) => `- ${c}`).join("\n") : "(nada)"}`);
  const apurado: string[] = [];
  const texto = (v: unknown) => (typeof v === "string" ? limpa(v) : "");
  if (texto(campos.quandoComTodas)) apurado.push(`Quando (todas as datas ditas): ${texto(campos.quandoComTodas)}`);
  else if (texto(campos.quandoTexto)) apurado.push(`Quando (dito): ${texto(campos.quandoTexto)}`);
  if (texto(campos.volumeDito)) apurado.push(`Volume (dito): ${texto(campos.volumeDito)}`);
  if (texto(campos.entulhoQuantidade)) apurado.push(`Entulho (dito): ${texto(campos.entulhoQuantidade)}`);
  if (texto(campos.acessoDito)) apurado.push(`Acesso (dito): ${texto(campos.acessoDito)}`);
  if (campos.clienteCarrega === true) apurado.push("O cliente carrega para a viatura.");
  if (typeof campos.metrosAtePorta === "number") apurado.push(`A carrinha fica a cerca de ${campos.metrosAtePorta} m da porta.`);
  const notas = Array.isArray(campos.notas) ? (campos.notas as unknown[]).map((n) => texto(n)).filter(Boolean) : [];
  for (const n of notas) apurado.push(`Nota do cliente: ${n}`);
  partes.push(`O QUE A CONVERSA APUROU:\n${apurado.length ? apurado.join("\n") : "(nada)"}`);
  const dia = diaEmLisboa(pedido.dataAgendada);
  const campoDoPedido = [
    `Localidade: ${ondeE(pedido.city, pedido.postalCode) ?? "por confirmar"}`,
    `Andar: ${andarPorExtenso(pedido.floor) ?? "por confirmar"}`,
    `Elevador: ${ePisoTerreo(pedido.floor) ? "não interessa (rés-do-chão)" : (elevadorPorExtenso(pedido.hasElevator) ?? "por confirmar")}`,
    `Estacionamento: ${estacionamentoPorExtenso(pedido.parkingDistance) ?? "por confirmar"}`,
    `Dia no pedido: ${dia ?? "nenhum"}`,
    `Fotografias no pedido: ${pedido.fotos}`,
  ];
  const segunda = campos.segundaMorada as SegundaMorada | undefined;
  if (segunda) campoDoPedido.push(`2.ª paragem de recolha: ${segundaParagemPorExtenso(segunda)}`);
  partes.push(`CAMPOS DO PEDIDO:\n${campoDoPedido.join("\n")}`);
  return partes.join("\n\n");
}

/* ──────────────────────────────────────────────────────────────────────────
 * A RESPOSTA DO MODELO, LIDA E VERIFICADA
 * ────────────────────────────────────────────────────────────────────────── */

/** O JSON do modelo, lido sem confiar — ou null. */
export function lerResposta(cru: unknown): RespostaDoModelo | null {
  let o: unknown = cru;
  if (typeof cru === "string") {
    const s = cru.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    try {
      o = JSON.parse(s);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  const lista = (v: unknown): string[] | null =>
    v == null ? [] : Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : null;
  const frase = (v: unknown): string | null => (v == null ? "" : typeof v === "string" ? v.trim() : null);
  const paraLevar = lista(r.paraLevar);
  const confirmar = lista(r.confirmarSeTambemVai);
  const notas = lista(r.notas);
  const porConfirmar = lista(r.porConfirmar);
  const quando = frase(r.quando);
  const estacionamento = frase(r.estacionamento);
  if (!paraLevar || !confirmar || !notas || !porConfirmar || quando == null || estacionamento == null) return null;
  return { paraLevar, confirmarSeTambemVai: confirmar, quando, estacionamento, notas, porConfirmar };
}

/*
 * O QUE NÃO PODE SAIR. Expressões regulares, e não listas de palavras, de
 * propósito: o teste da orquestra lê os textos deste ficheiro.
 */
const PRECOS = /€|\beuros?\b|\bEUR\b|\biva\b|\bpre[cç]os?\b|\bvalor(es)?\b|\bcustos?\b/i;
const MORADA =
  /\b([Rr]ua|[Aa]venida|[Aa]v\.|[Tt]ravessa|[Ll]argo|[Pp]ra[cç]a|[Pp]raceta|[Ee]strada|[Cc]al[cç]ada|[Bb]eco|[Aa]lameda|[Aa]zinhaga)\s+(d[aeo]s?\s+)?[A-ZÀ-Ú0-9]/;
const DO_BRASIL: RegExp[] = [
  /(?<![\p{L}\d_])voc[êe]s?(?![\p{L}\d_])/iu,
  /\bcelular(es)?\b/i,
  /\bequipes?\b/i,
  /\bcontatos?\b/i,
  /\bgeladeiras?\b/i,
  /\bbanheiros?\b/i,
  /\bcaminh[ãa]o\b/i,
  /\bfreezer\b/i,
  /\b(estou|está|estão|estava)\s+[a-zà-ú]{2,}(ando|endo|indo)\b/i,
];
const PROMESSAS = /\b(pr[óo]prio|mesmo)\s+dia\b|\bintelig[êe]ncia\s+artificial\b|\bassistente\s+virtual\b|\brob[ôo]\b/i;

/** Plural para singular, sem acentos — «fogões» e «fogão» são a mesma palavra. */
function raiz(p: string): string {
  return p.replace(/(oes|aes|aos)$/, "ao").replace(/(ns)$/, "m").replace(/(is)$/, "l").replace(/(es)$/, "").replace(/s$/, "");
}

/** As palavras que não dizem que coisa é: «uma», «para», «grande». */
const PALAVRAS_VAZIAS = new Set([
  "umas", "para", "pela", "pelo", "como", "mais", "muito", "muita", "pequeno", "pequena", "grande", "grandes", "velho", "velha",
  "velhos", "velhas", "antigo", "antiga", "outro", "outra", "outros", "outras", "cada", "tipo", "conjunto", "varios", "varias",
  "alguns", "algumas", "cerca", "com", "sem", "dos", "das", "nos", "nas", "num", "numa", "esse", "essa", "este", "esta",
  "tambem", "ainda", "todo", "toda", "todos", "todas", "parte", "partes", "peca", "pecas", "unidade", "unidades",
]);

function palavras(t: string): string[] {
  return plano(t)
    .split(/[^a-z]+/)
    .filter((p) => p.length >= 4 && !PALAVRAS_VAZIAS.has(p))
    .map(raiz);
}

/** A coisa está nas fontes? Basta uma palavra dela (sem plurais nem acentos). */
function estaNasFontes(item: string, fontes: Set<string>): boolean {
  const ps = palavras(item);
  if (ps.length === 0) return true;
  return ps.some((p) => fontes.has(p) || [...fontes].some((f) => f.length >= 5 && p.length >= 5 && f.slice(0, 5) === p.slice(0, 5)));
}

export type Verificacao = { ok: true } | { ok: false; motivo: string };

/**
 * A RESPOSTA PASSA NAS REGRAS? Sem preços, sem contactos, sem moradas, sem o
 * nome do cliente, português de Portugal — e nada inventado: cada coisa para
 * levar está no texto da equipa ou nas frases do cliente, e cada «confirmar
 * se também vai» nas fontes todas (as fotografias incluídas).
 */
export function validarAResposta(r: RespostaDoModelo, fontes: FontesDaDescricao, pedido: PedidoParaADescricao): Verificacao {
  const todos = [...r.paraLevar, ...r.confirmarSeTambemVai, r.quando, r.estacionamento, ...r.notas, ...r.porConfirmar].filter(Boolean);
  if (r.paraLevar.length > 20 || r.confirmarSeTambemVai.length > 10 || r.notas.length > 8 || r.porConfirmar.length > 8) {
    return { ok: false, motivo: "listas compridas de mais" };
  }
  for (const t of todos) {
    if (t.length > 200) return { ok: false, motivo: "uma frase comprida de mais" };
    if (PRECOS.test(t)) return { ok: false, motivo: "falou de preços ou valores" };
    if (new RegExp(CONTACTO.source).test(t)) return { ok: false, motivo: "trazia um contacto" };
    if (new RegExp(CODIGO_POSTAL.source).test(t) || MORADA.test(t)) return { ok: false, motivo: "trazia uma morada" };
    if (DO_BRASIL.some((re) => re.test(t))) return { ok: false, motivo: "não estava em português de Portugal" };
    if (PROMESSAS.test(t)) return { ok: false, motivo: "fez uma promessa que a CLYON não faz" };
    if (/[*#`]|\p{Extended_Pictographic}/u.test(t)) return { ok: false, motivo: "trazia formatação ou emojis" };
  }
  const nome = palavrasDoNome(pedido.contactName);
  for (const t of todos) {
    const ps = plano(t).split(/[^a-z]+/);
    if (nome.some((n) => ps.includes(n))) return { ok: false, motivo: "trazia o nome do cliente" };
  }
  const rua = ruaDaMorada(pedido.address);
  if (rua && todos.some((t) => plano(t).includes(rua))) return { ok: false, motivo: "trazia a rua do cliente" };

  const ditas = new Set(palavras([fontes.equipa, ...frasesDoCliente(fontes)].join(" ")));
  const comFotos = new Set([...ditas, ...palavras(oQueSeVe(fontes).join(" "))]);
  const inventada = r.paraLevar.find((i) => !estaNasFontes(i, ditas));
  if (inventada) return { ok: false, motivo: `inventou «${inventada.slice(0, 40)}»` };
  const vista = r.confirmarSeTambemVai.find((i) => !estaNasFontes(i, comFotos));
  if (vista) return { ok: false, motivo: `inventou «${vista.slice(0, 40)}»` };
  // O que o cliente disse que não é para fazer não se pode perder.
  const notas = camposQueContam(fontes).notas;
  if (Array.isArray(notas) && notas.length > 0 && r.notas.length === 0) return { ok: false, motivo: "perdeu as notas do cliente" };
  return { ok: true };
}

/* ──────────────────────────────────────────────────────────────────────────
 * A DESCRIÇÃO INTEIRA
 * ────────────────────────────────────────────────────────────────────────── */

const comPonto = (s: string) => (/[.!?…)]$/.test(s) ? s : `${s}.`);
const semPonto = (s: string) => s.trim().replace(/[.;]+$/, "");

function juntarSemRepetir(listas: string[][]): string[] {
  const out: string[] = [];
  const vistas = new Set<string>();
  for (const l of listas) {
    for (const x of l) {
      const c = plano(x).replace(/[^a-z0-9]+/g, " ").trim();
      if (!c || vistas.has(c)) continue;
      vistas.add(c);
      out.push(semPonto(x));
    }
  }
  return out;
}

/** O que se transporta, ou se faz, pelo serviço. */
function rotuloDasCoisas(servico: string | null | undefined): string {
  if (servico === "mudanca") return "Para transportar";
  if (servico === "manutencao_casa") return "O que fazer";
  return "Para levar";
}

/**
 * A DESCRIÇÃO NO FORMATO FIXO — as linhas dos campos escrevem-se aqui; as
 * do modelo vêm verificadas. Pura.
 */
export function comporADescricao(r: RespostaDoModelo, fontes: FontesDaDescricao, pedido: PedidoParaADescricao): string {
  const campos = camposQueContam(fontes);
  const falta: string[] = [];
  const linhas: string[] = [`Serviço: ${nomeDoServico(pedido.serviceType)}`];

  if (r.paraLevar.length) linhas.push(comPonto(`${rotuloDasCoisas(pedido.serviceType)}: ${juntarSemRepetir([r.paraLevar]).join(", ")}`));
  else falta.push("o que é para levar");
  if (r.confirmarSeTambemVai.length) linhas.push(comPonto(`Confirmar se também vai: ${juntarSemRepetir([r.confirmarSeTambemVai]).join(", ")}`));

  const volume = typeof campos.volumeDito === "string" ? campos.volumeDito.trim() : "";
  const entulho = typeof campos.entulhoQuantidade === "string" ? campos.entulhoQuantidade.trim() : "";
  if (pedido.serviceType === "recolha_entulho" && entulho) linhas.push(comPonto(`Entulho: ${entulho}`));
  else if (volume) linhas.push(comPonto(`Volume: ${volume} (dito pelo cliente)`));

  if (pedido.serviceType === "mudanca") {
    linhas.push(comPonto(`Origem: ${moradaPorExtenso(pedido.city, pedido.postalCode, pedido.floor, pedido.hasElevator, falta, " da origem")}`));
    const d = pedido.destino;
    if (d && (d.localidade || d.codigoPostal || d.andar)) {
      linhas.push(comPonto(`Destino: ${moradaPorExtenso(d.localidade, d.codigoPostal, d.andar, d.elevador, falta, " do destino")}`));
    } else {
      linhas.push("Destino: por confirmar.");
      falta.push("o destino");
    }
  } else {
    linhas.push(comPonto(`Morada: ${moradaPorExtenso(pedido.city, pedido.postalCode, pedido.floor, pedido.hasElevator, falta, "")}`));
  }

  const segunda = campos.segundaMorada as SegundaMorada | undefined;
  if (segunda) {
    linhas.push(comPonto(`2.ª paragem: ${segundaParagemPorExtenso(segunda)}`));
    if (!segunda.localidade && !segunda.codigoPostal) falta.push("a localidade da 2.ª paragem");
    if (segunda.andar == null) falta.push("o andar da 2.ª paragem");
    else if (segunda.andar !== "0" && !segunda.elevador) falta.push("o elevador da 2.ª paragem");
  }

  const todas = typeof campos.quandoComTodas === "string" ? campos.quandoComTodas.trim() : "";
  const quandoDito = typeof campos.quandoTexto === "string" ? campos.quandoTexto.trim() : "";
  const dia = diaEmLisboa(pedido.dataAgendada);
  const quando = r.quando.trim() || todas || (dia && quandoDito ? `${dia} (${quandoDito})` : dia || quandoDito);
  if (quando) linhas.push(comPonto(`Quando: ${semPonto(quando)}`));
  else {
    linhas.push("Quando: por confirmar.");
    falta.push("o dia");
  }

  const metros = typeof campos.metrosAtePorta === "number" && campos.metrosAtePorta > 0 ? `a carrinha fica a cerca de ${campos.metrosAtePorta} m da porta` : null;
  const estacionamento = metros ?? estacionamentoPorExtenso(pedido.parkingDistance) ?? (r.estacionamento.trim() || null);
  if (estacionamento) linhas.push(comPonto(`Estacionamento: ${semPonto(estacionamento)}`));
  else {
    linhas.push("Estacionamento: por confirmar.");
    falta.push("o estacionamento");
  }

  linhas.push(pedido.fotos > 0 ? `Fotografias: ${pedido.fotos}, enviadas pelo cliente.` : "Fotografias: ainda não há.");

  const notas = juntarSemRepetir([campos.clienteCarrega === true ? ["O cliente carrega para a viatura"] : [], r.notas]);
  if (notas.length) linhas.push(`Notas: ${notas.map(comPonto).join(" ")}`);

  const porConfirmar = juntarSemRepetir([falta, r.porConfirmar]).slice(0, 8);
  if (porConfirmar.length) linhas.push(comPonto(`Por confirmar: ${porConfirmar.join("; ")}`));
  return linhas.join("\n");
}

/* ──────────────────────────────────────────────────────────────────────────
 * A CHAMADA
 * ────────────────────────────────────────────────────────────────────────── */

export type DescricaoEscrita = { ok: true; texto: string; modelo: string } | { ok: false; motivo: string };

/** O termómetro deste uso — ver `saude-da-ia.ts`. Nunca atira. */
async function anotar(motivo: string | null): Promise<void> {
  try {
    const { anotarSaudeDaIa } = await import("./saude-da-ia-na-base");
    await anotarSaudeDaIa("descricao", motivo);
  } catch {
    /* sem base, sem termómetro — e o resto segue na mesma */
  }
}

/**
 * O MODELO ESCREVE A DESCRIÇÃO — ou diz porque não. Nunca atira. Usa o mesmo
 * modelo da Vitória (`modeloDoAssistente`, que passa por `modeloDoGemini`), a
 * mesma escada e o mesmo castigo de quem fica sem quota
 * (`gemini-em-descanso.ts`). A falha fica no termómetro do painel.
 */
export async function escreverADescricao(fontes: FontesDaDescricao, pedido: PedidoParaADescricao): Promise<DescricaoEscrita> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    await anotar("sem GEMINI_API_KEY — ficou a descrição das regras");
    return { ok: false, motivo: "sem GEMINI_API_KEY" };
  }
  const entrada = entradaDoModelo(fontes, pedido);
  let motivo = "nenhum modelo respondeu";
  try {
    const { escadaDeModelos, modeloDoAssistente, porDeCastigo } = await import("./whatsapp-compreensao");
    const modelos = (await escadaDeModelos(modeloDoAssistente())).slice(0, 2);
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const client = new GoogleGenerativeAI(apiKey);
    for (const [i, nome] of modelos.entries()) {
      const segundos = i === 0 ? 20 : 12;
      const comecou = Date.now();
      try {
        const model = client.getGenerativeModel({
          model: nome,
          systemInstruction: INSTRUCAO_DA_DESCRICAO,
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        });
        const resposta = await Promise.race([
          model.generateContent(entrada),
          new Promise<never>((_, rejeitar) => setTimeout(() => rejeitar(new Error(`demorou mais de ${segundos} s`)), segundos * 1000)),
        ]);
        const lida = lerResposta(resposta.response.text());
        if (!lida) {
          motivo = `${nome} respondeu fora do formato`;
          console.error(`[descricao] ${motivo}`);
          break;
        }
        const v = validarAResposta(lida, fontes, pedido);
        if (!v.ok) {
          // A mesma pergunta a outro modelo dá quase sempre o mesmo: fica a das regras.
          motivo = `${nome} respondeu fora das regras (${v.motivo})`;
          console.error(`[descricao] ${motivo}`);
          break;
        }
        console.log(`[descricao] ${nome}: escrita em ${Date.now() - comecou} ms`);
        await anotar(null);
        return { ok: true, texto: comporADescricao(lida, fontes, pedido), modelo: nome };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        motivo = `${nome}: ${msg}`;
        console.error(`[descricao] ${nome} falhou aos ${Date.now() - comecou} ms:`, msg);
        await porDeCastigo(nome, msg);
      }
    }
  } catch (e) {
    motivo = e instanceof Error ? e.message : String(e);
  }
  await anotar(`${motivo.slice(0, 300)} — ficou a descrição das regras`);
  return { ok: false, motivo };
}
