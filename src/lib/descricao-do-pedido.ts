import type { DadosDaRecolha } from "./whatsapp-recolha";
import { DESCRICAO_DAS_FOTOS } from "./leitor-da-recolha";

/**
 * A DESCRIÇÃO QUE O PROFISSIONAL LÊ — escrita pela Vitória. 26-10-2026.
 *
 * *«A descrição não pode pegar de maneira vaga no que o cliente fala; tem de
 * analisar o que ele já disse e criar a descrição para que [o profissional]
 * trabalhe de forma excepcional.»* — o dono (decisão d30).
 *
 * Era a frase dele, tal e qual: «Trata-se da recolha de um sofá. Deste
 * sofá.» Passa a ser o pedido arrumado em linhas curtas — o que é para levar
 * e quantos, o volume, o andar e o elevador, o estacionamento, quem carrega,
 * quando, as fotografias — e só no fim os pormenores que ele contou e que não
 * cabem em nenhuma dessas linhas.
 *
 * SÓ FACTOS. Cada linha sai de um campo que ele respondeu, ou de palavras que
 * ele escreveu: um sofá sem número dito é «sofá», e não «1 sofá»; uma frase
 * que não diz nada para lá do que já está arrumado sai («Deste sofá.»), e
 * uma que diz fica com as palavras dele. E SEM CONTACTOS: o nome, o telefone
 * e o email têm campo próprio, e a descrição vai aos profissionais.
 *
 * Puro e sem base de dados — também o lê o formulário «Criar pedido desta
 * conversa», no navegador.
 */

/** A nota que os profissionais lêem quando é o cliente que carrega (26-10-2026). */
export const O_CLIENTE_CARREGA = "O cliente carrega para a viatura.";

const MARCAS = /[̀-ͯ]/g;

/**
 * Minúsculas e sem acentos, LETRA A LETRA — o mesmo comprimento do original,
 * para uma posição encontrada aqui valer no texto que ele escreveu.
 */
function plano(t: string): string {
  let out = "";
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    const p = c.toLowerCase().normalize("NFD").replace(MARCAS, "");
    out += p.length === 1 ? p : c;
  }
  return out;
}

const limpo = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/* ──────────────────────────────────────────────────────────────────────────
 * O QUE É PARA LEVAR, E QUANTOS
 * ────────────────────────────────────────────────────────────────────────── */

type Coisa = {
  /** Como se escreve uma. */
  um: string;
  /** Como se escrevem várias. */
  varias: string;
  /** O plural e o singular, sem acentos (expressões regulares). */
  plural: string;
  singular: string;
  /** Só com um número à frente: «à porta» não é uma porta, «no banco» não é um banco. */
  soComNumero?: boolean;
  /** Um material, que não se conta: «cartão», «roupa». */
  material?: boolean;
};

const c = (
  um: string,
  varias: string,
  plural: string,
  singular: string,
  extra: Pick<Coisa, "soComNumero" | "material"> = {},
): Coisa => ({ um, varias, plural, singular, ...extra });

/**
 * O QUE AS PESSOAS MANDAM LEVAR — os nomes compostos primeiro («mesa de
 * cabeceira» antes de «mesa», «sofá-cama» antes de «sofá»), e os materiais no
 * fim, para só apanharem o que os móveis deixaram.
 */
const COISAS: Coisa[] = [
  c("roupa de cama", "roupa de cama", "roupas\\s+de\\s+cama", "roupa\\s+de\\s+cama", { material: true }),
  c("sofá-cama", "sofás-cama", "sofas[\\s-]camas?", "sofa[\\s-]cama"),
  c("chaise longue", "chaises longues", "chaises(?:\\s+longues?)?", "chaise(?:\\s+longue)?"),
  c("mesa de cabeceira", "mesas de cabeceira", "mesas\\s+de\\s+cabeceira", "mesa\\s+de\\s+cabeceira"),
  c("móvel de TV", "móveis de TV", "moveis\\s+de\\s+(?:tv|televisao)", "movel\\s+de\\s+(?:tv|televisao)"),
  c(
    "máquina de lavar loiça",
    "máquinas de lavar loiça",
    "maquinas\\s+de\\s+lavar\\s+(?:a\\s+)?lo[iu]ca",
    "maquina\\s+de\\s+lavar\\s+(?:a\\s+)?lo[iu]ca",
  ),
  c(
    "máquina de secar roupa",
    "máquinas de secar roupa",
    "maquinas\\s+de\\s+secar(?:\\s+(?:a\\s+)?roupa)?",
    "maquina\\s+de\\s+secar(?:\\s+(?:a\\s+)?roupa)?",
  ),
  c(
    "máquina de lavar roupa",
    "máquinas de lavar roupa",
    "maquinas\\s+de\\s+lavar(?:\\s+(?:a\\s+)?roupa)?",
    "maquina\\s+de\\s+lavar(?:\\s+(?:a\\s+)?roupa)?",
  ),
  c("arca congeladora", "arcas congeladoras", "arcas\\s+(?:congeladoras|frigorificas)", "arca\\s+(?:congeladora|frigorifica)"),
  c("base de duche", "bases de duche", "bases\\s+de\\s+duche", "base\\s+de\\s+duche"),
  c("ar condicionado", "aparelhos de ar condicionado", "aparelhos\\s+de\\s+ar[\\s-]condicionado", "ar[\\s-]condicionado"),
  c("sofá", "sofás", "sofas", "sofa"),
  c("colchão", "colchões", "colchoes", "colchao"),
  c("estrado", "estrados", "estrados", "estrado"),
  c("beliche", "beliches", "beliches", "beliche"),
  c("berço", "berços", "bercos", "berco"),
  c("cama", "camas", "camas", "cama"),
  c("guarda-fato", "guarda-fatos", "guarda[\\s-]?fatos", "guarda[\\s-]?fato"),
  c("guarda-roupa", "guarda-roupas", "guarda[\\s-]?roupas", "guarda[\\s-]?roupa"),
  c("roupeiro", "roupeiros", "roupeiros", "roupeiro"),
  c("armário", "armários", "armarios", "armario"),
  c("cómoda", "cómodas", "comodas", "comoda"),
  c("estante", "estantes", "estantes", "estante"),
  c("prateleira", "prateleiras", "prateleiras", "prateleira"),
  c("aparador", "aparadores", "aparadores", "aparador"),
  c("cristaleira", "cristaleiras", "cristaleiras", "cristaleira"),
  c("vitrine", "vitrines", "vitrines", "vitrine"),
  c("louceiro", "louceiros", "louceiros", "louceiro"),
  c("sapateira", "sapateiras", "sapateiras", "sapateira"),
  c("secretária", "secretárias", "secretarias", "secretaria"),
  c("escrivaninha", "escrivaninhas", "escrivaninhas", "escrivaninha"),
  c("cadeirão", "cadeirões", "cadeiroes", "cadeirao"),
  c("poltrona", "poltronas", "poltronas", "poltrona"),
  c("cadeira", "cadeiras", "cadeiras", "cadeira"),
  c("mesa", "mesas", "mesas", "mesa"),
  c("banco", "bancos", "bancos", "banco", { soComNumero: true }),
  c("puff", "puffs", "puffs|pufes", "puff|pufe"),
  c("móvel", "móveis", "moveis", "movel"),
  c("frigorífico", "frigoríficos", "frigorificos", "frigorifico"),
  c("arca", "arcas", "arcas", "arca", { soComNumero: true }),
  c("fogão", "fogões", "fogoes", "fogao"),
  c("forno", "fornos", "fornos", "forno"),
  c("micro-ondas", "micro-ondas", "micro[\\s-]?ondas", "micro[\\s-]?ondas"),
  c("esquentador", "esquentadores", "esquentadores", "esquentador"),
  c("termoacumulador", "termoacumuladores", "termo[\\s-]?acumuladores", "termo[\\s-]?acumulador"),
  c("televisão", "televisões", "televisoes|televisores|tvs", "televisao|televisor|tv"),
  c("tapete", "tapetes", "tapetes", "tapete"),
  c("espelho", "espelhos", "espelhos", "espelho"),
  c("candeeiro", "candeeiros", "candeeiros", "candeeiro"),
  c("quadro", "quadros", "quadros", "quadro", { soComNumero: true }),
  c("porta", "portas", "portas", "porta", { soComNumero: true }),
  c("janela", "janelas", "janelas", "janela", { soComNumero: true }),
  c("sanita", "sanitas", "sanitas", "sanita"),
  c("lavatório", "lavatórios", "lavatorios", "lavatorio"),
  c("lava-loiça", "lava-loiças", "lava[\\s-]?lo[iu]cas", "lava[\\s-]?lo[iu]ca"),
  c("bancada", "bancadas", "bancadas", "bancada"),
  c("banheira", "banheiras", "banheiras", "banheira"),
  c("bidé", "bidés", "bides", "bide"),
  c("radiador", "radiadores", "radiadores", "radiador"),
  c("aquecedor", "aquecedores", "aquecedores", "aquecedor"),
  c("bicicleta", "bicicletas", "bicicletas", "bicicleta"),
  c("piano", "pianos", "pianos", "piano"),
  c("cofre", "cofres", "cofres", "cofre", { soComNumero: true }),
  c("big bag", "big bags", "big[\\s-]?bags", "big[\\s-]?bag"),
  c("saco", "sacos", "sacos", "saco", { soComNumero: true }),
  c("caixa", "caixas", "caixas", "caixa", { soComNumero: true }),
  c("mala", "malas", "malas", "mala", { soComNumero: true }),
  c("palete", "paletes", "paletes", "palete"),
  c("pneu", "pneus", "pneus", "pneu"),
  // Os materiais — não se contam.
  c("electrodomésticos", "electrodomésticos", "e(?:le|lec)trodomesticos", "e(?:le|lec)trodomestico", { material: true }),
  c("plástico bolha", "plástico bolha", "plasticos\\s+bolha", "plastico\\s+bolha", { material: true }),
  c("cartão", "cartão", "cartoes", "cartao", { material: true }),
  c("plástico", "plástico", "plasticos", "plastico", { material: true }),
  c("película", "película", "peliculas", "pelicula", { material: true }),
  c("esferovite", "esferovite", "esferovites", "esferovite", { material: true }),
  c("embalagens", "embalagens", "embalagens", "embalagem", { material: true }),
  c("roupa", "roupa", "roupas", "roupa", { material: true }),
  c("livros", "livros", "livros", "livro", { material: true }),
  c("brinquedos", "brinquedos", "brinquedos", "brinquedo", { material: true }),
  c("loiça", "loiça", "lo[iu]cas", "lo[iu]ca", { material: true }),
  c("madeira", "madeira", "madeiras", "madeira", { material: true }),
  c("sucata", "sucata", "sucatas", "sucata", { material: true }),
  c("tralha", "tralha", "tralhas", "tralha", { material: true }),
  c("azulejos", "azulejos", "azulejos", "azulejo", { material: true }),
  c("tijolos", "tijolos", "tijolos", "tijolo", { material: true }),
  c("telhas", "telhas", "telhas", "telha", { material: true }),
  c("caliça", "caliça", "calicas", "calica", { material: true }),
  c("restos de obra", "restos de obra", "restos\\s+de\\s+obras?", "resto\\s+de\\s+obras?", { material: true }),
];

const POR_EXTENSO: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30,
};
/** Os que dizem «um»: «o sofá», «deste sofá», «a bancada». */
const DE_UM = [
  "o", "a", "este", "esta", "esse", "essa", "aquele", "aquela", "deste", "desta", "desse", "dessa",
  "daquele", "daquela", "do", "da", "no", "na", "num", "numa", "dum", "duma", "meu", "minha", "outro", "outra",
];
/** Os que dizem «vários», sem dizer quantos. */
const DE_VARIOS = [
  "os", "as", "uns", "umas", "estes", "estas", "esses", "essas", "aqueles", "aquelas", "alguns", "algumas",
  "varios", "varias", "dos", "das", "nos", "nas", "meus", "minhas", "muitos", "muitas", "outros", "outras",
];
const APROXIMADO = "(?:uns|umas|cerca\\s+de|mais\\s+ou\\s+menos|aproximadamente|aprox\\.?|quase|para\\s+ai)";

/** O que ele diz de cada coisa, logo a seguir a ela: «velho», «de 3 lugares», «em bom estado». */
const QUALIFICADOR =
  "(?:" +
  [
    "velh[oa]s?", "antig[oa]s?", "partid[oa]s?", "estragad[oa]s?", "avariad[oa]s?", "usad[oa]s?", "nov[oa]s?",
    "grandes?", "pequen[oa]s?", "enormes?", "desmontad[oa]s?", "montad[oa]s?", "insuflave(?:l|is)",
    "ele(?:c)?tric[oa]s?", "american[oa]s?", "combinad[oa]s?", "dupl[oa]s?", "individua(?:l|is)",
    "articulad[oa]s?", "extensive(?:l|is)", "dobrave(?:l|is)", "vazi[oa]s?", "chei[oa]s?", "inteir[oa]s?",
    "rasgad[oa]s?", "manchad[oa]s?", "molhad[oa]s?", "podres?", "ferrugent[oa]s?", "pesad[oa]s?",
    "branc[oa]s?", "pret[oa]s?", "cinzent[oa]s?", "castanh[oa]s?", "azu(?:l|is)", "verdes?", "vermelh[oa]s?",
    "de\\s+\\d{1,3}\\s*(?:lugares|lugar|portas|gavetas|pecas|modulos|polegadas)",
    "de\\s+(?:um|dois|tres|quatro|cinco|seis)\\s+(?:lugares|lugar|portas|gavetas)",
    "de\\s+(?:casal|solteiro|crianca|bebe|canto|cozinha|jantar|sala|quarto|escritorio|jardim|exterior|campismo|" +
      "madeira|ferro|vidro|metal|marmore|pladur|pele|tecido|verga|plastico|entulho|roupa|obras?|cama|parede|" +
      "apoio|centro|arrumacao|arrumos)",
    "com\\s+(?:chaise(?:\\s+longue)?|gavetas|espelho|rodas)",
    "em\\s+l", "em\\s+(?:bom|mau|razoavel)\\s+estado", "sem\\s+pes", "\\d{2,3}\\s*polegadas",
  ].join("|") +
  ")";
const ANTES_DO_NOME = "(?:velh[oa]s?|antig[oa]s?|grandes?|pequen[oa]s?|enormes?)";

/**
 * AS FRASES QUE FALAM DO SERVIÇO, E NÃO DAS COISAS — «recolha de móveis» não
 * é uma lista de móveis; «roupa de cama» não é uma cama.
 */
const SERVICO_DITO =
  /\b(?:recolhas?|remocao|transporte|montagem|desmontagem|levantamento|esvaziamento|retirada)\s+de\s+(?:moveis|monos|entulho|e(?:le|lec)trodomesticos|mobilia|tralha|lixo|roupa)\b/g;

type Item = {
  coisa: Coisa;
  quantidade: number | null;
  aproximado: boolean;
  plural: boolean;
  qualificador: string;
  /** Onde aparece no texto — a lista sai pela ordem em que ele as disse. */
  posicao: number;
};

function compilar(coisa: Coisa): RegExp {
  const numeros = Object.keys(POR_EXTENSO).join("|");
  const det =
    `(?:(${APROXIMADO}\\s+)?(\\d{1,3})|(meia\\s+duzia\\s+de|uma\\s+duzia\\s+de)|(${numeros})|(${DE_UM.join("|")})|(${DE_VARIOS.join("|")}))`;
  /*
   * O «e» só JUNTA qualificadores — «velho e partido». À frente do primeiro
   * não: «o sofá é de 3 lugares» sem acentos é «o sofa e de 3 lugares», e o
   * verbo passava por ligação.
   */
  const q = `${QUALIFICADOR}(?![a-z])`;
  return new RegExp(
    `(?<![a-z0-9])(?:${det}\\s+)?(?:(${ANTES_DO_NOME})\\s+)?((?:${coisa.plural})|(?:${coisa.singular}))(?![a-z])` +
      `((?:\\s*,?\\s+${q})(?:(?:\\s*,?\\s+|\\s+e\\s+)${q})*)?`,
    "g",
  );
}
const COMPILADAS = COISAS.map((coisa) => ({ coisa, re: compilar(coisa), plural: new RegExp(`^(?:${coisa.plural})$`) }));

/** As coisas de UM texto, com as posições que ocupam — para os pormenores saberem o que já foi dito. */
function coisasDoTexto(original: string): { itens: Item[]; ocupado: Array<[number, number]> } {
  const texto = original.normalize("NFC");
  let p = plano(texto);
  p = p.replace(SERVICO_DITO, (m) => " ".repeat(m.length));
  const itens: Item[] = [];
  const ocupado: Array<[number, number]> = [];
  const livre = (a: number, b: number) => ocupado.every(([x, y]) => b <= x || a >= y);
  for (const { coisa, re, plural } of COMPILADAS) {
    re.lastIndex = 0;
    for (const m of p.matchAll(re)) {
      const inicio = m.index ?? 0;
      const fim = inicio + m[0].length;
      const nome = m[8];
      if (!livre(inicio, fim)) continue;
      const numero = m[2] ? Number(m[2]) : m[3] ? (/meia/.test(m[3]) ? 6 : 12) : m[4] ? POR_EXTENSO[m[4]] : null;
      if (coisa.soComNumero && numero == null) continue;
      const ePlural = plural.test(nome);
      const quantidade = numero ?? (m[5] && !ePlural ? 1 : null);
      const antes = m[7] ? texto.slice(inicio + m[0].indexOf(m[7]), inicio + m[0].indexOf(m[7]) + m[7].length) : "";
      const depois = m[9]
        ? texto
            .slice(fim - m[9].length, fim)
            .replace(/^[\s,]+/, "")
            .replace(/^e\s+/i, "")
            .trim()
        : "";
      itens.push({
        coisa,
        quantidade: coisa.material && !m[2] ? null : quantidade,
        aproximado: Boolean(m[1]),
        plural: ePlural,
        qualificador: [antes, depois].filter(Boolean).join(" "),
        posicao: inicio,
      });
      ocupado.push([inicio, fim]);
    }
  }
  itens.sort((a, b) => a.posicao - b.posicao);
  return { itens, ocupado };
}

/** «1 sofá de 3 lugares», «2 cadeiras», «cerca de 20 sacos de entulho», «cartão». */
function escrito(i: Item): string {
  const varias = i.quantidade != null ? i.quantidade > 1 : i.plural;
  const nome = varias ? i.coisa.varias : i.coisa.um;
  const n = i.quantidade != null ? `${i.aproximado ? "cerca de " : ""}${i.quantidade} ` : "";
  return `${n}${nome}${i.qualificador ? ` ${i.qualificador}` : ""}`;
}

/**
 * JUNTAR O QUE É A MESMA COISA — «Trata-se da recolha de um sofá. Deste
 * sofá.» é UM sofá, dito duas vezes. Com qualificadores diferentes («um sofá
 * de 3 lugares e um de 2») ficam as duas linhas; o número que vale é o maior.
 */
function juntar(itens: Item[]): Item[] {
  const out: Item[] = [];
  for (const i of itens) {
    const igual = out.find(
      (o) =>
        o.coisa === i.coisa &&
        (!o.qualificador || !i.qualificador || plano(o.qualificador) === plano(i.qualificador)),
    );
    if (!igual) {
      out.push({ ...i });
      continue;
    }
    if (i.quantidade != null && (igual.quantidade == null || i.quantidade > igual.quantidade)) {
      igual.quantidade = i.quantidade;
      igual.aproximado = i.aproximado;
    }
    if (!igual.qualificador && i.qualificador) igual.qualificador = i.qualificador;
    igual.plural = igual.plural || i.plural;
  }
  return out;
}

/** As coisas para levar, ditas num ou mais textos — já escritas para a descrição. */
export function itensDitos(...textos: Array<string | null | undefined>): string[] {
  const todos = textos.flatMap((t) => (t ? coisasDoTexto(t).itens : []));
  return juntar(todos).map(escrito);
}

/* ──────────────────────────────────────────────────────────────────────────
 * OS PORMENORES — o que ele contou e não cabe em nenhuma linha
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * As palavras que não dizem nada ao profissional por si: as ligações, o «trata-
 * -se da recolha de», os cumprimentos, e o que já tem linha própria (o andar,
 * o elevador). Uma frase feita só disto, e das coisas já contadas, sai.
 */
const NAO_DIZEM_NADA = new Set(
  (
    "a o os as um uma uns umas e ou de da do das dos em no na nos nas num numa para pra por pelo pela pelos pelas com sem " +
    "que se ja so apenas tambem mais muito muita muitos muitas tudo todo toda todos todas cada mesmo mesma " +
    "e sao era eram foi sera seria esta estao estou tenho tem temos ha havia fica ficam " +
    "isto isso aquilo este esta estes estas esse essa esses essas deste desta destes destas desse dessa desses dessas aqui ali la ca " +
    "trata tratase eu nos meu minha meus minhas seu sua " +
    "preciso precisava precisamos precisa quero queria queremos gostava gostaria pretendo pretendia necessito " +
    "pedir pedido pedidos orcamento orcamentos servico servicos " +
    "levar levem levam leve retirar retirem tirar tirem recolher recolham recolha recolhas buscar busquem " +
    "remover removam despejar recolhida recolhido levado levada " +
    "monos mono moveis entulho mobilia " +
    "ola oi bom boa dia tarde noite obrigado obrigada cumprimentos favor " +
    "foto fotos fotografia fotografias imagem imagens video videos " +
    "andar andares elevador rc res chao piso"
  ).split(/\s+/),
);

/** As frases que falam do pedido, e não do trabalho — «Consulte o pedido. Está lá tudo.» */
const SOBRE_O_PEDIDO = [
  /\b(consult\w*|veja|vejam|ver|verifique\w*|olhe|leia)\b[^.!?]*\b(pedido|orcamento|formulario|site)\b/,
  /\besta\s+(la\s+)?tudo\b/,
  /^(as\s+)?fotos?\s+tambem\b/,
  /\b(a\s+)?pessoa\s+que\s+(pediu|fez|enviou)\b/,
];

/** Um telefone, um email, um endereço da internet. */
const CONTACTO = /(?:\+|00)?\d(?:[\s.-]?\d){8,}|\S+@\S+\.\S+|\bhttps?:\/\/\S+|\bwww\.\S+/g;
const TEM_CONTACTO = new RegExp(CONTACTO.source);

function frases(texto: string): string[] {
  return texto
    .split(/\n+/)
    .flatMap((l) => l.split(/(?<=[.!?])\s+(?=\S)/))
    .map((f) => f.trim())
    .filter(Boolean);
}

/** Esta frase diz alguma coisa para lá das coisas já contadas e das palavras de ligação? */
function dizAlgumaCoisa(frase: string): boolean {
  const p = plano(frase.normalize("NFC"));
  if (SOBRE_O_PEDIDO.some((r) => r.test(p))) return false;
  const { ocupado } = coisasDoTexto(frase);
  let resto = p.replace(SERVICO_DITO, (m) => " ".repeat(m.length));
  for (const [a, b] of [...ocupado].sort((x, y) => y[0] - x[0])) resto = resto.slice(0, a) + " ".repeat(b - a) + resto.slice(b);
  const palavras = resto.split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !/^\d+$/.test(w) && !NAO_DIZEM_NADA.has(w));
  return palavras.length > 0;
}

/** Sem o telefone, o email e o nome dele — a descrição vai aos profissionais. */
function semContactos(frase: string, nome: string | null | undefined): string {
  let f = frase.replace(CONTACTO, " ");
  const n = limpo(nome);
  if (n.length >= 3) {
    const p = plano(f.normalize("NFC"));
    const alvo = plano(n.normalize("NFC"));
    const i = p.indexOf(alvo);
    if (i >= 0) f = f.normalize("NFC").slice(0, i) + f.normalize("NFC").slice(i + alvo.length);
  }
  return f.replace(/\s{2,}/g, " ").replace(/\s+([.,;!?])/g, "$1").trim();
}

/** Os pormenores que ele contou: as frases que dizem mais do que as linhas arrumadas. */
export function pormenoresDoCliente(textos: string[], nome?: string | null): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const t of textos) {
    for (const f of frases(t)) {
      // Uma frase com um telefone ou um email é sobre como o contactar — sai inteira.
      if (TEM_CONTACTO.test(f)) continue;
      const s = semContactos(f, nome);
      if (!s || !dizAlgumaCoisa(s)) continue;
      const chave = plano(s);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      out.push(/[.!?…)]$/.test(s) ? s : `${s}.`);
    }
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
 * A DESCRIÇÃO INTEIRA
 * ────────────────────────────────────────────────────────────────────────── */

/** «Nas imagens: …» — o que a Vitória viu nas fotografias (21-10-2026). */
const NAS_IMAGENS = /^Nas imagens:/;

/** O que ele escreveu, sem as marcas das fotografias nem o que se viu nelas. */
function textosDoCliente(descricao: string | null | undefined): string[] {
  return limpo(descricao)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && l !== DESCRICAO_DAS_FOTOS && !NAS_IMAGENS.test(l));
}

function oQueSeViu(descricao: string | null | undefined): string[] {
  return limpo(descricao)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => NAS_IMAGENS.test(l));
}

/** «3.º andar», «rés-do-chão», «cave» — com o lado da porta, quando o disse. */
function andarPorExtenso(floor: string | null | undefined, lado?: string | null): string | null {
  const f = limpo(floor);
  if (!f) return null;
  const base = f === "0" ? "rés-do-chão" : f === "-1" ? "cave" : /^\d{1,2}$/.test(f) ? `${f}.º andar` : f;
  const l = limpo(lado);
  return l ? `${base} ${l}` : base;
}

function elevadorPorExtenso(e: string | null | undefined): string | null {
  if (e === "yes") return "com elevador";
  if (e === "small") return "com elevador pequeno";
  if (e === "no") return "sem elevador";
  return null;
}

function estacionamentoPorExtenso(e: string | null | undefined): string | null {
  if (e === "near") return "à porta";
  if (e === "far") return "longe da porta";
  if (e === null) return "a confirmar";
  return null;
}

/** «3.º andar Esq, com elevador» — ou só o que se sabe. */
function acesso(floor: string | null | undefined, lado: string | null | undefined, elevador: string | null | undefined): string | null {
  const andar = andarPorExtenso(floor, lado);
  const elev = limpo(floor) === "0" ? null : elevadorPorExtenso(elevador);
  if (andar && elev) return `${andar}, ${elev}`;
  return andar ?? elev;
}

/** Ele disse a hora? «às 9», «15h», «10:30». Sem isso, a hora não se escreve. */
function disseAHora(texto: string | null | undefined): boolean {
  const t = plano(limpo(texto));
  return /(?<!\d)\d{1,2}\s*(h\b|h\d{2}|:\d{2})|\b(as|pelas|por volta das)\s+\d{1,2}\b/.test(t);
}

/** «sábado, 31 de outubro, de manhã» — o dia dele, em Lisboa, sem uma hora que ele não disse. */
function diaPorExtenso(iso: string | null | undefined, quandoTexto: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const tz = { timeZone: "Europe/Lisbon" } as const;
  const dia = d.toLocaleDateString("pt-PT", { ...tz, weekday: "long", day: "numeric", month: "long" });
  if (disseAHora(quandoTexto)) {
    return `${dia} às ${d.toLocaleTimeString("pt-PT", { ...tz, hour: "2-digit", minute: "2-digit" })}`;
  }
  const t = plano(limpo(quandoTexto));
  const parte = /manha/.test(t) ? ", de manhã" : /tarde/.test(t) ? ", à tarde" : /noite|fim do dia/.test(t) ? ", ao fim do dia" : "";
  return dia + parte;
}

/** Um ponto no fim, se não tiver pontuação. */
const comPonto = (s: string) => (/[.!?…)]$/.test(s) ? s : `${s}.`);

export type OpcoesDaDescricao = {
  /** Quantas fotografias o cliente mandou — contadas por quem chama. */
  fotos?: number;
};

/**
 * O que é para levar, chamado pelo serviço: numa mudança é o que se
 * transporta; numa reparação, o que ele referiu.
 */
function rotuloDasCoisas(servico: string | null | undefined): string {
  if (servico === "mudanca") return "Para transportar";
  if (servico === "manutencao_casa") return "O que referiu";
  return "Para levar";
}

/**
 * A DESCRIÇÃO DO PEDIDO, arrumada para o profissional — ou `null` quando não
 * há nada a dizer. Ver o comentário do ficheiro.
 */
export function descricaoOrganizada(d: DadosDaRecolha, opcoes: OpcoesDaDescricao = {}): string | null {
  const textos = textosDoCliente(d.description);
  const linhas: string[] = [];

  const coisas = itensDitos(...textos);
  if (coisas.length > 0) linhas.push(`${rotuloDasCoisas(d.serviceType)}: ${coisas.join(", ")}.`);

  // Num entulho a quantidade tem campo, e diz-se aqui também; nos outros, o volume dito.
  const entulho = limpo(d.entulhoQuantidade);
  const volume = limpo(d.volumeDito);
  if (d.serviceType === "recolha_entulho" && entulho) linhas.push(comPonto(`Entulho: ${entulho}`));
  else if (volume) linhas.push(comPonto(`Volume (dito pelo cliente): ${volume}`));

  if (d.serviceType === "mudanca") {
    const origem = acesso(d.floor, d.lado, d.hasElevator);
    const estOrigem = estacionamentoPorExtenso(d.parkingDistance);
    if (origem || estOrigem) {
      linhas.push(comPonto(`Origem: ${[origem, estOrigem ? `estacionamento ${estOrigem}` : null].filter(Boolean).join("; ")}`));
    }
    const destino = acesso(d.andarDestino, null, d.elevadorDestino);
    const estDestino = estacionamentoPorExtenso(d.estacionamentoDestino);
    if (destino || estDestino) {
      linhas.push(comPonto(`Destino: ${[destino, estDestino ? `estacionamento ${estDestino}` : null].filter(Boolean).join("; ")}`));
    }
  } else {
    const a = acesso(d.floor, d.lado, d.hasElevator);
    if (a) linhas.push(comPonto(`Acesso: ${a}`));
    const est = estacionamentoPorExtenso(d.parkingDistance);
    if (est) linhas.push(comPonto(`Estacionamento: ${est}`));
  }

  if (d.clienteCarrega) linhas.push(O_CLIENTE_CARREGA);

  /*
   * O DIA. Com uma data só, escreve-se por extenso; com duas à escolha («sábado
   * 31/10 ou domingo 01/11», o Gaspar) ou sem data nenhuma, ficam as palavras
   * dele — a primeira data sozinha seria metade do que ele disse.
   */
  const quando = limpo(d.quandoTexto);
  const comAlternativa = /\bou\b/i.test(quando);
  const dia = comAlternativa ? null : diaPorExtenso(d.dataDesejada, quando);
  if (dia) linhas.push(comPonto(`Quando: ${dia}`));
  else if (quando) linhas.push(`Quando (dito pelo cliente): ${quando}`);

  const fotos = Math.max(0, Math.floor(opcoes.fotos ?? d.fotosRecebidas ?? 0));
  if (fotos > 0) linhas.push(`Fotografias enviadas pelo cliente: ${fotos}.`);
  else if (d.fotosDitas || limpo(d.description).includes(DESCRICAO_DAS_FOTOS)) {
    linhas.push("Fotografias: o cliente diz que as enviou.");
  }
  linhas.push(...oQueSeViu(d.description));

  const pormenores = pormenoresDoCliente(textos, d.contactName);
  if (pormenores.length > 0) linhas.push(`Pormenores (ditos pelo cliente): ${pormenores.join(" ")}`);

  const acessoDito = semContactos(limpo(d.acessoDito), d.contactName);
  if (acessoDito) linhas.push(`Acesso (dito pelo cliente): ${acessoDito}`);

  return linhas.length > 0 ? linhas.join("\n") : null;
}
