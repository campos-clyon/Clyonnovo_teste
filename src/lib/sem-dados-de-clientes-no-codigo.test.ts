import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * NENHUM DADO DE UM CLIENTE NO CÓDIGO — 31-10-2026 (d1, urgência).
 *
 * O repositório é público e o Google lê o GitHub. Os testes contavam casos
 * verdadeiros com o nome completo de quem escreveu, a hora, e a morada com o
 * número da porta e o código postal — e um comentário punha um nome completo
 * ao lado do número do pedido. Os casos continuam (são eles que ensinam a
 * Vitória), mas com a pessoa INVENTADA: o nome, a rua, a porta, o código
 * postal e a hora.
 *
 * A guarda não guarda os dados verdadeiros (isso seria publicá-los outra
 * vez): guarda REGRAS. Um nome ou uma rua que não está nas listas de
 * inventados chumba, e para passar tem de se inventar outro — ou de o pôr
 * aqui de propósito, o que se vê na revisão.
 *
 *   1. Um nome completo ao lado de «#NNN» chumba.
 *   2. Nos testes, um nome completo de cliente (contactName, nomeCliente,
 *      cliente, «O meu nome é…», a assinatura, uma mensagem que é só o nome)
 *      só com nomes da lista de inventados.
 *   3. Nos ficheiros de conversas (a-conversa-…, a-mudanca-…, as-conversas-…)
 *      o cabeçalho diz «INVENTADOS», o nome do ficheiro é da lista, e cada
 *      nome de cliente também.
 *   4. Nos testes, uma rua com o número da porta só se for uma das ruas de
 *      exemplo.
 *
 * Os telefones têm a sua guarda (sem-telemoveis-de-pessoas.test.ts) e os
 * dados de pagamento a deles (sem-dados-de-pagamento-no-codigo.test.ts).
 */

const RAIZ = process.cwd();
const ESTE = "src/lib/sem-dados-de-clientes-no-codigo.test.ts";

function ficheirosDoGit(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: RAIZ, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\0")
    .filter(Boolean)
    .filter((f) => f !== ESTE);
}

const eBinario = (b: Buffer) => b.subarray(0, 8000).includes(0);

/** Os ficheiros de texto do git, já lidos, com as linhas. */
function textos(filtro: (f: string) => boolean): Array<{ f: string; linhas: string[] }> {
  const saida: Array<{ f: string; linhas: string[] }> = [];
  for (const f of ficheirosDoGit().filter(filtro)) {
    let b: Buffer;
    try {
      b = readFileSync(join(RAIZ, f));
    } catch {
      continue; // apagado na árvore de trabalho e ainda no índice
    }
    if (eBinario(b) || b.length > 3_000_000) continue;
    saida.push({ f, linhas: b.toString("utf8").split(/\r?\n/) });
  }
  return saida;
}

const TESTE = (f: string) => /\.test\.(ts|tsx|js|mjs)$/.test(f);
const CONVERSA =
  /(?:^|\/)(?:a-conversa-d[ao]-|a-mudanca-d[ao]-)([a-z]+)\.test\.ts$|(?:^|\/)as-conversas-de-[a-z]+\.test\.ts$/;

const semAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const lista = (s: string) => new Set(s.split(/\s+/).filter(Boolean).map(semAcentos));

/* ── As listas do que é inventado ─────────────────────────────────────────── */

/**
 * Nomes de pessoas inventados (primeiros nomes e apelidos). Um nome novo num
 * teste entra aqui só se for inventado.
 */
const NOMES_INVENTADOS = lista(`
  Aaron Abel Abílio Alda Ana Anselmo Augusta Aurélio Berta Bruno Célia Célio Dalila Débora Elvira
  Ernesto Fátima Graciete Joana Jorge João Júlia Leonor Leopoldo Leónia Lívia Luciana Maria
  Marcelo Maximiano Nádia Odete Ofélia Oliver Olímpio Patricia Raquel Rita Romão Rosalina Rui Silvério
  Sofia Telmo Teodoro Tomé Valter Vasco
  Arvoredo Castanhal Castanheira Costa Fontoura Gomes Lameirão Lopes Moreirinha Pinhal Prates
  Ramalhete Ribamar Ribeiro Silva Sobral Sobreirinho Teixo Valdeira
  Exemplo Teste Modelo Inventado Inventada
`);

/** Palavras que não são nomes e podem vir com maiúscula onde se procura um nome. */
const NAO_SAO_NOMES = lista(`
  App Whats Cliente Empresa Lda Assistente Profissional Pessoa Outra Obrigado Olá Nova Recolha
  Recolhas Mudança Mudanças Transportes Quinta Conde Monte Abraão Minified React
  Caparica Margem Sul Grande Lisboa Sem Proposta Big Bags Camiões
`);

/**
 * Nomes de profissionais (estão no perfil público do site) e da conta de
 * teste: não são clientes, e podem estar ao lado de um pedido.
 */
const PROFISSIONAIS_E_CONTAS_DE_TESTE = new Set(["Manuel Martins", "Sthefanny Lemos", "Fred Teste", "Fred Silva"]);

/**
 * Ruas de exemplo (sem acentos, em minúsculas, sem o tipo da via): inventadas,
 * ou das grandes avenidas que todos conhecem, sempre sem pessoa nenhuma.
 */
const RUAS_DE_EXEMPLO = new Set<string>([
  "das flores", "das flores dos santos", "dos jasmins", "da liberdade", "nova", "velha", "do ouro", "da republica",
  "augusta", "nacional", "do sol", "da paz", "de lisboa", "de cima", "sem fim", "do forno", "dos lagares",
  "dos pinheiros", "das oliveiras", "das acacias", "das acacias velhas", "das camelias", "das camelias brancas",
  "das gaivotas", "das gaivotas mansas", "das amendoeiras", "dos lirios", "dos choupos brancos", "foros de amora",
  "capitao bras lemos",
  // As que substituíram as verdadeiras a 31-10-2026 (d1).
  "das nespereiras bravas", "das andorinhas pretas", "dos melros azuis", "dos loendros roxos", "do vale dos corvos",
  "dos pardais ruivos", "das gralhas mansas", "das betulas altas", "da torre dos mochos", "professor augusto valdeira",
  "ilidio castanheira", "jacinto valdeira", "de s sebastiao valdeira", "capitao faustino ribamar",
  "dona brites de valdeira", "arquiteto bernardo telhado sobral", "actriz zulmira arvoredo", "gil sobreirinho",
]);

/** Frases com maiúsculas que aparecem ao lado de um «#NNN» e não são nomes de pessoas. */
const AO_LADO_DO_NUMERO = new Set<string>([
  "Trabalhos CLYON", "Nova Recolha", "Minified React", "Recolhas Exemplo", "Avenida Mouzinho", "Rua Professor",
  "Rua das Amendoeiras", "Rua das Amendoeiras Inventadas", "Rua Professor Augusto Valdeira", "Olá Graciete",
]);

/* ── As regras ────────────────────────────────────────────────────────────── */

const PALAVRA = "[A-ZÁÉÍÓÚÂÊÔÃÕÇÀ][a-záéíóúâêôãõçàü]+";
const LIGA = "(?:d[aeo]s?|e)";
/** Antes de uma palavra: nada que seja letra — ou um «\n» escrito dentro de uma string. */
const ANTES = String.raw`(?:(?<=\\[nrt])|(?<![\p{L}\\]))`;
/** Duas a cinco palavras com maiúscula (com «da», «de», «dos»… pelo meio): a forma de um nome completo. */
const NOME = String.raw`${PALAVRA}(?:\s+(?:${LIGA}\s+)?${PALAVRA}){1,4}`;
const NOME_COMPLETO = new RegExp(String.raw`${ANTES}${NOME}(?![\p{L}])`, "gu");

const palavrasDoNome = (nome: string) =>
  nome
    .split(/\s+/)
    .filter((p) => !new RegExp(`^${LIGA}$`).test(p))
    .map(semAcentos);

/** Um nome completo é inventado se todas as palavras estão na lista (ou não são nomes). */
const nomeInventado = (nome: string) =>
  PROFISSIONAIS_E_CONTAS_DE_TESTE.has(nome) ||
  // Uma rua escrita no campo do nome (os testes do «isto parece uma morada»): a regra 4 é que a vê.
  /^(?:Rua|Avenida|Travessa|Praceta|Estrada|Largo|Alameda)\s/.test(nome) ||
  palavrasDoNome(nome).every((p) => NOMES_INVENTADOS.has(p) || NAO_SAO_NOMES.has(p));

/** Regra 1: um nome completo ao lado de «#NNN». */
function nomesAoLadoDoNumero(linha: string): string[] {
  if (!/#\d{2,5}\b/.test(linha)) return [];
  return [...linha.matchAll(NOME_COMPLETO)]
    .map((m) => m[0])
    .filter((n) => !AO_LADO_DO_NUMERO.has(n) && !nomeInventado(n));
}

/** Regra 2: onde se escreve o nome de um cliente. O grupo 2 de cada regra é o texto onde está o nome. */
const ONDE_HA_NOME = [
  /\b(?:contactName|nomeCliente|clienteNome|nomeDoCliente|cliente|contacto|nome|NOME)\s*[:=]\s*(["'`])([^"'`\n]{2,80})\1/gu,
  /contactName\)\.toBe\((["'`])([^"'`\n]{2,80})\1/gu,
  new RegExp(String.raw`(?:O meu nome é|Chamo-me|Sou o|Sou a|Nome:)\s+()(${PALAVRA}(?:\s+(?:${LIGA}\s+)?${PALAVRA}){0,4})`, "gu"),
  // Uma mensagem que é só um nome.
  new RegExp(String.raw`^\s*(["'\x60])(${NOME})\1,?\s*$`, "gu"),
  // A assinatura no fim de uma mensagem.
  new RegExp(String.raw`(?:Cumprimentos|Atenciosamente|Obrigad[oa]),?(?:\\n|\s)+()(${NOME})`, "gu"),
];

function nomesDeCliente(linha: string): string[] {
  const saida: string[] = [];
  for (const regra of ONDE_HA_NOME) {
    for (const m of linha.matchAll(regra)) {
      for (const n of (m[2] ?? "").trim().match(NOME_COMPLETO) ?? []) saida.push(n);
    }
  }
  return saida;
}

/** Regra 4: uma rua com o número da porta. Devolve o nome da rua (sem o tipo) e o achado. */
const TIPO_DE_VIA =
  "(?:rua|r\\.|avenida|av\\.|travessa|tv\\.|praceta|prcta\\.?|largo|estrada|alameda|calçada|beco|praça|ria|urbanização)";
const RUA_COM_PORTA = new RegExp(
  ANTES +
    TIPO_DE_VIA +
    String.raw`\s+((?:[\p{L}º'.]+\s+){0,7}?[\p{L}º'.]+)\s*,?\s*(?:n\.?\s?º\s?|nº\s?|n\s|n(?=\d)|número\s+|lote\s+)?(\d{1,4})` +
    // Nem um código postal, nem uma hora, nem uma distância.
    String.raw`(?![\d:,.-]?\d)(?!\s?(?:h\b|km|min|%|€|horas|minutos|kg|anos|dias|m\b|metros|vezes|lugares|caracteres|letras))`,
  "giu",
);

function ruasComPorta(linha: string): Array<{ rua: string; achado: string }> {
  return [...linha.matchAll(RUA_COM_PORTA)].map((m) => ({
    rua: semAcentos(m[1]).replace(/\s+/g, " ").trim(),
    achado: m[0],
  }));
}

const ruaDeExemplo = (rua: string) => RUAS_DE_EXEMPLO.has(rua) || /\b(exemplo|teste|inventad\w*|x+|a|b)\b/.test(rua);

/* ── Os testes ────────────────────────────────────────────────────────────── */

describe("dados de clientes no código", () => {
  it("lê o repositório inteiro (a guarda não está a olhar para o vazio)", () => {
    const todos = ficheirosDoGit();
    expect(todos.length).toBeGreaterThan(1000);
    for (const pasta of ["src/", "app-pro/", "app-cliente/", "ponte-whatsapp/", "scripts/"]) {
      expect(todos.some((f) => f.startsWith(pasta)), pasta).toBe(true);
    }
  });

  it("as regras apanham o que devem (com casos montados aqui)", () => {
    // Montados por pedaços, para nenhum ficheiro ter um caso inteiro escrito.
    const nome = ["Zacarias", "Quimbundo"].join(" ");
    expect(nomesAoLadoDoNumero(`O #512 é do ${nome}, entrou pelo telefone`)).toEqual([nome]);
    expect(nomesAoLadoDoNumero(`O ${nome} ligou ontem`)).toEqual([]); // sem número de pedido
    expect(nomesAoLadoDoNumero(`O #512 é do Rui Exemplo`)).toEqual([]); // inventado
    expect(nomesDeCliente(`contactName: "${nome}",`)).toEqual([nome]);
    expect(nomesDeCliente(`expect(d.contactName).toBe("${nome}");`)).toEqual([nome]);
    expect(nomesDeCliente(`"O meu nome é ${nome} e aqui estão as fotos"`)).toEqual([nome]);
    expect(nomesDeCliente(`  "${nome}",`)).toEqual([nome]);
    expect(nomesDeCliente(`"É um T2.\\nCumprimentos,\\n${nome}";`)).toEqual([nome]);
    expect(nomesDeCliente(`"Sim, com factura",`)).toEqual([]);
    const rua = ["Rua", "dos", "Quimbundos", "Altos", "17"].join(" ");
    expect(ruasComPorta(`${rua}, 1950-321 Lisboa`).map((r) => r.rua)).toEqual(["dos quimbundos altos"]);
    expect(ruasComPorta(`"Moro aqui:\\n${rua}"`).map((r) => r.rua)).toEqual(["dos quimbundos altos"]);
    expect(ruasComPorta(["Rua", "Tal", "N24,", "1°esq"].join(" ")).map((r) => r.rua)).toEqual(["tal"]);
    expect(ruasComPorta(["Rua", "Tal,", "n.º", "38"].join(" ")).map((r) => r.rua)).toEqual(["tal"]);
    expect(ruasComPorta(["Ria", "Dona", "Brites,", "Número", "15"].join(" ")).map((r) => r.rua)).toEqual(["dona brites"]);
    // Um código postal, uma distância ou uma hora não é uma porta.
    expect(ruasComPorta("Praceta Tal 1600-321 Lisboa")).toEqual([]);
    expect(ruasComPorta("a estrada são 33 km")).toEqual([]);
    expect(ruasComPorta("está na rua desde as 9h")).toEqual([]);
  });

  it("nenhum nome completo ao lado do número de um pedido", () => {
    const achados: string[] = [];
    for (const { f, linhas } of textos(() => true)) {
      linhas.forEach((l, i) => {
        for (const n of nomesAoLadoDoNumero(l)) achados.push(`${f}:${i + 1} ${n}`);
      });
    }
    expect(achados).toEqual([]);
  });

  it("nos testes, os nomes completos de clientes são inventados", () => {
    const achados: string[] = [];
    for (const { f, linhas } of textos(TESTE)) {
      linhas.forEach((l, i) => {
        for (const n of nomesDeCliente(l)) if (!nomeInventado(n)) achados.push(`${f}:${i + 1} ${n}`);
      });
    }
    expect(achados).toEqual([]);
  });

  it("os ficheiros de conversas dizem que a pessoa é inventada, e o nome é da lista", () => {
    const conversas = textos((f) => CONVERSA.test(f));
    expect(conversas.length).toBeGreaterThan(5);
    const achados: string[] = [];
    const regra =
      /contactName\)?\s*(?:\.toBe\(|:)\s*["'`]([^"'`]+)["'`]|\b(?:const NOME\s*=\s*["'`]|Sou o |Sou a |Chamo-me |O meu nome é )(\p{Lu}\p{Ll}+)/gu;
    for (const { f, linhas } of conversas) {
      const cabecalho = linhas.slice(0, 60).join("\n");
      if (!/INVENTAD[OA]S?/.test(cabecalho)) achados.push(`${f}: o cabeçalho não diz «INVENTADOS»`);
      const doFicheiro = f.match(CONVERSA)?.[1];
      if (doFicheiro && !NOMES_INVENTADOS.has(doFicheiro)) achados.push(`${f}: «${doFicheiro}» não está na lista de inventados`);
      linhas.forEach((l, i) => {
        for (const m of l.matchAll(regra)) {
          for (const p of (m[1] ?? m[2] ?? "").match(new RegExp(PALAVRA, "gu")) ?? []) {
            const s = semAcentos(p);
            if (!NOMES_INVENTADOS.has(s) && !NAO_SAO_NOMES.has(s)) achados.push(`${f}:${i + 1} ${p}`);
          }
        }
      });
    }
    expect(achados).toEqual([]);
  });

  it("nos testes, uma rua com o número da porta só se for de exemplo", () => {
    const achados: string[] = [];
    for (const { f, linhas } of textos(TESTE)) {
      linhas.forEach((l, i) => {
        for (const r of ruasComPorta(l)) if (!ruaDeExemplo(r.rua)) achados.push(`${f}:${i + 1} ${r.achado} [${r.rua}]`);
      });
    }
    expect(achados).toEqual([]);
  });
});
