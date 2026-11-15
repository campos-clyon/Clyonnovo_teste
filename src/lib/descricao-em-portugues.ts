import { contarMarcas, linguaEvidente, NOME_DA_LINGUA, PORTUGUES, type Lingua } from "./lingua-do-cliente";

/**
 * A DESCRIÇÃO DO PEDIDO É SEMPRE EM PORTUGUÊS — 15-11-2026 (decisão d46).
 *
 * O #623, registado pela Vitória, ficou assim:
 *
 *   Pormenores (ditos pelo cliente): A lot of cardboard boxes, a few trash
 *   bags of styrofoam, two lamps, a twin size mattress and a rug.
 *
 * — e é isto que o parceiro lê no Feed, na app e no email. «A descrição tem
 * que estar sempre em português.» — o dono.
 *
 * Aqui decide-se, linha a linha, o que está noutra língua (a mesma detecção
 * simples da Vitória, `lingua-do-cliente.ts`), e só isso vai ao tradutor (a
 * escada do Gemini de `traduzir-para-o-cliente.ts`, ao contrário). O rótulo
 * português da linha («Pormenores (ditos pelo cliente):») fica como está.
 * O português não vai a lado nenhum: fica igual, letra a letra.
 *
 * O TRADUTOR FALHA CALADO (ver a memória do tradutor). Aqui não: sem
 * tradução, a descrição fica como o cliente a escreveu MAS marcada «por
 * traduzir» — e quem chama passa-a à equipa. Nunca se grava noutra língua
 * como se estivesse tudo bem. O original fica sempre guardado à parte.
 */

export type DescricaoEmPortugues = {
  /** A descrição a gravar: traduzida, ou a original quando não havia nada a traduzir ou o tradutor falhou. */
  descricao: string;
  /** O texto como o cliente o escreveu — só quando havia alguma coisa noutra língua. */
  original: string | null;
  /** A língua do que se traduziu (a mais frequente), ou null. */
  lingua: Lingua | null;
  /** O tradutor falhou: a descrição ficou noutra língua, e a equipa tem de a ver. */
  porTraduzir: boolean;
  /** Porque ficou por traduzir. */
  motivo: string | null;
};

/** Quem traduz um pedaço — o Gemini por omissão; os testes passam o seu. */
export type TradutorParaPortugues = (
  texto: string,
  de: Lingua,
) => Promise<{ saiu: string; motivo: null } | { saiu: null; motivo: string }>;

/*
 * OS NOMES QUE SE USAM CÁ. O tradutor genérico escreve «colchão twin», ou
 * o nome do Brasil para a esferovite; o parceiro procura «colchão de solteiro» e
 * «esferovite». A lista vai na instrução, e o teste verifica que lá está.
 */
export const NOMES_DE_CA: Array<[string, string]> = [
  ["twin / single (size) mattress · matelas une place · colchón individual", "colchão de solteiro"],
  ["double / full / queen / king (size) mattress · matelas deux places · colchón de matrimonio", "colchão de casal"],
  ["styrofoam · polystyrene · polystyrène · poliestireno · porexpán · corcho blanco", "esferovite"],
  ["cardboard boxes · cartons · cajas de cartón", "caixas de cartão"],
  ["trash / garbage / bin bags · sacs poubelle · bolsas de basura", "sacos do lixo"],
  ["rug · tapis · alfombra", "tapete"],
  ["lamp · lampe · lámpara", "candeeiro"],
  ["couch / sofa · canapé · sofá", "sofá"],
  ["wardrobe / closet · armoire · armario", "roupeiro"],
  ["chest of drawers / dresser · commode · cómoda", "cómoda"],
  ["nightstand / bedside table · table de chevet · mesita de noche", "mesa de cabeceira"],
  ["desk · bureau · escritorio", "secretária"],
  ["bookcase / bookshelf · bibliothèque · estantería", "estante"],
  ["bed frame · cadre de lit · estructura de cama", "estrutura da cama"],
  ["box spring · sommier · somier", "estrado"],
  ["fridge / refrigerator · frigo / réfrigérateur · nevera / frigorífico", "frigorífico"],
  ["washing machine · lave-linge · lavadora", "máquina de lavar roupa"],
  ["dryer · sèche-linge · secadora", "máquina de secar roupa"],
  ["dishwasher · lave-vaisselle · lavavajillas", "máquina de lavar loiça"],
  ["stove / cooker · cuisinière · cocina", "fogão"],
  ["microwave · micro-ondes · microondas", "micro-ondas"],
  ["TV · télé · televisor", "televisão"],
  ["mirror · miroir · espejo", "espelho"],
  ["rubble / debris · gravats · escombros", "entulho"],
  ["bathroom · salle de bain · baño", "casa de banho"],
  ["truck / lorry · camion · camión", "camião"],
  ["mobile phone · portable · móvil", "telemóvel"],
];

/** A instrução ao tradutor, para uma língua de origem. */
export function instrucaoParaPortugues(de: Lingua): string {
  return [
    `És o tradutor da CLYON, uma plataforma portuguesa que liga clientes a parceiros independentes ` +
      `de recolhas, esvaziamentos, mudanças e manutenção da casa.`,
    `Recebes um pedaço da descrição de um pedido, escrito pelo cliente em ${NOME_DA_LINGUA[de]}, e devolves ` +
      `o MESMO texto em português de Portugal (nunca do Brasil), para o parceiro ler antes de fazer o preço.`,
    ``,
    `REGRAS:`,
    `- Devolve SÓ a tradução. Sem aspas à volta, sem explicações, sem alternativas, sem notas.`,
    `- Não acrescentes nem tires nada: as mesmas coisas, as mesmas quantidades (por extenso ou em número, como estão).`,
    `- Mantém iguais: números, medidas, datas, horas, moradas, códigos postais e nomes próprios.`,
    `- Não traduzas a palavra CLYON.`,
    `- Português de Portugal, nunca do Brasil: frigorífico, casa de banho, camião, telemóvel, esferovite.`,
    `- Os objectos com o nome que se usa em Portugal:`,
    ...NOMES_DE_CA.map(([de_, para]) => `  ${de_} → ${para}`),
  ].join("\n");
}

/** O Gemini, pela escada do tradutor — importado só quando é preciso. */
const tradutorDoGemini: TradutorParaPortugues = async (texto, de) => {
  const { pedirTraducaoParaPortugues } = await import("./traduzir-para-o-cliente");
  return pedirTraducaoParaPortugues(texto, de, instrucaoParaPortugues(de));
};

/* ──────────────────────────────────────────────────────────────────────────
 * QUE LINHAS ESTÃO NOUTRA LÍNGUA
 * ────────────────────────────────────────────────────────────────────────── */

/** «Rótulo: resto» — o rótulo até 60 caracteres, antes dos dois pontos. */
const COM_ROTULO = /^([^:\n]{1,60}):[ \t]+(\S[\s\S]*)$/;

/** Um rótulo é português quando não tem nenhuma marca de outra língua. */
function rotuloPortugues(rotulo: string): boolean {
  return contarMarcas(rotulo).every((c) => c.lingua === PORTUGUES || c.pontos === 0);
}

/** A linha em rótulo e texto. Sem rótulo português, a linha inteira é texto. */
export function partirALinha(linha: string): { rotulo: string; texto: string } {
  const m = linha.match(COM_ROTULO);
  if (m && rotuloPortugues(m[1])) return { rotulo: `${m[1]}: `, texto: m[2] };
  const espacos = linha.match(/^\s*/)?.[0] ?? "";
  return { rotulo: espacos, texto: linha.slice(espacos.length) };
}

/** A língua de um texto curto para a descrição: a evidente, ou null. */
function linguaDoTexto(texto: string): Lingua | null {
  return linguaEvidente(texto);
}

export type LinhaPorTraduzir = { indice: number; rotulo: string; texto: string; lingua: Lingua };

/**
 * AS LINHAS A TRADUZIR. Uma linha vai ao tradutor quando a língua dela é
 * evidente e não é o português; ou quando é curta demais para ser evidente
 * («two lamps and a rug»), o resto do texto está claramente noutra língua, e
 * ela tem marcas dessa língua e nenhuma do português. Puro.
 */
export function linhasNoutraLingua(descricao: string | null | undefined): LinhaPorTraduzir[] {
  const texto = descricao ?? "";
  if (!texto.trim()) return [];
  const linhas = texto.split("\n").map((l, indice) => ({ indice, ...partirALinha(l) }));
  const doCliente = linhas.map((l) => l.texto).join("\n");
  const geral = linguaDoTexto(doCliente);
  const fora: LinhaPorTraduzir[] = [];
  for (const l of linhas) {
    if (!/\p{L}/u.test(l.texto)) continue;
    const propria = linguaDoTexto(l.texto);
    if (propria && propria !== PORTUGUES) {
      fora.push({ indice: l.indice, rotulo: l.rotulo, texto: l.texto, lingua: propria });
      continue;
    }
    if (propria || !geral || geral === PORTUGUES) continue;
    const marcas = contarMarcas(l.texto);
    const pt = marcas.find((c) => c.lingua === PORTUGUES)?.pontos ?? 0;
    const daGeral = marcas.find((c) => c.lingua === geral)?.pontos ?? 0;
    if (pt === 0 && daGeral >= 1) fora.push({ indice: l.indice, rotulo: l.rotulo, texto: l.texto, lingua: geral });
  }
  return fora;
}

/** Há alguma coisa noutra língua? */
export function temOutraLingua(descricao: string | null | undefined): boolean {
  return linhasNoutraLingua(descricao).length > 0;
}

/* ──────────────────────────────────────────────────────────────────────────
 * TRADUZIR
 * ────────────────────────────────────────────────────────────────────────── */

/** O que já se traduziu nesta instância — a descrição reescreve-se a cada mensagem. */
const TRADUZIDAS = new Map<string, string>();
const TECTO = 300;

function lembrar(chave: string, valor: string): void {
  if (TRADUZIDAS.size >= TECTO) {
    const primeira = TRADUZIDAS.keys().next().value;
    if (primeira !== undefined) TRADUZIDAS.delete(primeira);
  }
  TRADUZIDAS.set(chave, valor);
}

/** Para os testes: esquecer o que está guardado. */
export function esquecerAsDescricoesTraduzidas(): void {
  TRADUZIDAS.clear();
}

/** A tradução serve? Não vazia, sem aspas à volta, e já não na língua de origem. */
export function traducaoQueServe(saiu: string | null | undefined, original: string, de: Lingua): string | null {
  let t = (saiu ?? "").trim();
  t = t.replace(/^["«“']([\s\S]*)["»”']$/, "$1").trim();
  if (!t) return null;
  if (t.length > original.length * 3 + 80) return null;
  const agora = linguaEvidente(t);
  if (agora && agora !== PORTUGUES && agora === de) return null;
  // Uma linha só: a descrição é linha a linha.
  return t.replace(/\s*\n+\s*/g, " ");
}

/** A língua mais frequente das linhas traduzidas. */
function aMaisFrequente(linhas: LinhaPorTraduzir[]): Lingua | null {
  const n = new Map<Lingua, number>();
  for (const l of linhas) n.set(l.lingua, (n.get(l.lingua) ?? 0) + 1);
  let melhor: Lingua | null = null;
  let max = 0;
  for (const [l, c] of n) if (c > max) [melhor, max] = [l, c];
  return melhor;
}

/**
 * A DESCRIÇÃO EM PORTUGUÊS. Português: igual, sem ir ao tradutor. Outra
 * língua: as linhas dela traduzidas, o original à parte. O tradutor falhou:
 * a original, «por traduzir», com o motivo. Nunca atira.
 */
export async function descricaoEmPortugues(
  descricao: string | null | undefined,
  opcoes: { traduzir?: TradutorParaPortugues } = {},
): Promise<DescricaoEmPortugues> {
  const texto = descricao ?? "";
  const fora = linhasNoutraLingua(texto);
  if (fora.length === 0) return { descricao: texto, original: null, lingua: null, porTraduzir: false, motivo: null };
  const traduzir = opcoes.traduzir ?? tradutorDoGemini;
  const lingua = aMaisFrequente(fora);

  const linhas = texto.split("\n");
  let motivo: string | null = null;
  await Promise.all(
    fora.map(async (l) => {
      const chave = JSON.stringify([l.lingua, l.texto]);
      let pt = TRADUZIDAS.get(chave) ?? null;
      if (pt == null) {
        try {
          const r = await traduzir(l.texto, l.lingua);
          pt = traducaoQueServe(r.saiu, l.texto, l.lingua);
          if (pt == null) motivo = r.motivo ?? "a tradução veio vazia ou na mesma língua";
          else lembrar(chave, pt);
        } catch (e) {
          motivo = e instanceof Error ? e.message : String(e);
        }
      }
      if (pt != null) linhas[l.indice] = `${l.rotulo}${pt}`;
    }),
  );
  if (motivo != null) return { descricao: texto, original: texto, lingua, porTraduzir: true, motivo };
  return { descricao: linhas.join("\n"), original: texto, lingua, porTraduzir: false, motivo: null };
}

/** O que vai para a base com a descrição — as três colunas da d46. */
export type TraducaoParaABase = { original: string | null; lingua: Lingua | null; porTraduzir: boolean };

export function paraABase(r: DescricaoEmPortugues): TraducaoParaABase {
  return { original: r.original, lingua: r.lingua, porTraduzir: r.porTraduzir };
}

/** «Dito pelo cliente (inglês)» — o rótulo do original no backoffice. */
export function rotuloDoOriginal(lingua: string | null | undefined): string {
  const nome = lingua && lingua in NOME_DA_LINGUA && lingua !== PORTUGUES ? NOME_DA_LINGUA[lingua as Lingua] : null;
  return nome ? `Dito pelo cliente (${nome})` : "Dito pelo cliente";
}
