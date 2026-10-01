import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * TIRAR OS COMENTÁRIOS SEM COMER CÓDIGO.
 *
 * Mais de cem testes deste repositório lêem o código-fonte e tiram-lhe os
 * comentários antes de procurar uma frase. Todos faziam-no com a mesma regra,
 * copiada de uns para os outros, que tratava QUALQUER `/*` como o início de
 * um comentário — incluindo o de um tipo MIME:
 *
 *     accept="image/*,video/*,application/pdf"
 *
 * Esse comentário falso só acabava no `*` + `/` seguinte, que podia ser o fim
 * de um comentário verdadeiro dezenas de linhas abaixo. Em RegistarPedido.tsx
 * eram setenta e três linhas, com o botão «Calcular» lá dentro. Tudo o que um
 * teste dissesse sobre essas linhas passava sem olhar para elas: um
 * `not.toContain` não via o que proibia, e um teste que juntava todos os
 * `fetch(` ou todos os `maxSizeMB` contava menos do que havia. Em 01-10-2026
 * eram 9 testes com zonas destas, a maior de 74 linhas — e cada uma foi
 * provada por mutação: o texto proibido metido lá dentro passava com a regra
 * antiga e chumba com esta.
 *
 * A regra que fica só aceita um comentário que começa a sua própria linha,
 * com `{` à frente ou sem ele (o `{/* … *\/}` do JSX). Um `/*` no meio de uma
 * string nunca começa uma linha.
 *
 * ⚠️ O PREÇO, ESCOLHIDO DE PROPÓSITO. Os poucos comentários que começam a meio
 * de uma linha de código — `} catch { /* silencioso *\/ }`, `: /*` a seguir a
 * um ternário, `<p /*` dentro de uma etiqueta — ficam no texto que os testes
 * lêem. Se um dia um deles citar uma frase proibida, o teste chumba alto e a
 * correcção é mudar o comentário de sítio. É o lado bom do erro: o contrário
 * era voltar a passar em silêncio.
 */

const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("a regra", () => {
  const FICHEIRO = [
    "/**",
    " * O formulário do backoffice.",
    " */",
    "export function Formulario() {",
    "  return (",
    "    <form>",
    '      <input type="file" accept="image/*,video/*,application/pdf" />',
    '      <button onClick={calcular}>Calcular</button>',
    "      {/* O botão faz as contas — não envia nada. */}",
    "      {",
    "        /* Um comentário em bloco, sozinho entre chavetas. */",
    "      }",
    "    </form>",
    "  );",
    "}",
    "/* fim */",
  ].join("\r\n");

  it("deixa ficar o código que vem depois de um `/*` dentro de uma string", () => {
    const limpo = semNotas(FICHEIRO);
    expect(limpo).toContain('accept="image/*,video/*,application/pdf"');
    expect(limpo).toContain("<button onClick={calcular}>Calcular</button>");
  });

  it("e continua a tirar os comentários que começam a linha, os do JSX incluídos", () => {
    const limpo = semNotas(FICHEIRO);
    expect(limpo).not.toContain("O formulário do backoffice");
    expect(limpo).not.toContain("não envia nada");
    expect(limpo).not.toContain("sozinho entre chavetas");
    expect(limpo).not.toContain("fim");
  });
});

/** Todos os ficheiros de teste em src/. */
function testes(dir = join(process.cwd(), "src"), acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) testes(caminho, acc);
    else if (/\.test\.tsx?$/.test(nome)) acc.push(caminho);
  }
  return acc;
}

describe("nenhum teste volta à regra antiga", () => {
  /*
   * A regra antiga espalhou-se por cópia: cada teste novo levava o `semNotas`
   * do vizinho. Agora todos os vizinhos têm a nova — e isto apanha quem a
   * escreva de memória.
   *
   * Procura-se cada `.replace(/…/flags` cuja expressão tire comentários em
   * bloco (tem `\/\*` lá dentro). Só passam duas formas: a ancorada ao início
   * da linha, com a flag `m` (senão o `^` é só o início do ficheiro), e a que
   * exige a chaveta colada — `\{\/\*` —, que uma string como `image/*` não
   * tem como imitar.
   */
  const REMOVEDOR = /\.replace(?:All)?\(\s*\/((?:\\.|[^/\\\r\n])+)\/([a-z]*)/g;

  it("todos os removedores de comentários em bloco exigem o início da linha", () => {
    const maus: string[] = [];
    let vistos = 0;
    for (const f of testes()) {
      const fonte = readFileSync(f, "utf8");
      for (const m of fonte.matchAll(REMOVEDOR)) {
        const [, padrao, flags] = m;
        if (!padrao.includes(String.raw`\/\*`)) continue;
        vistos++;
        const ancorado = padrao.startsWith("^[ \\t]*") && flags.includes("m");
        const soJsx = padrao.startsWith(String.raw`\{\/\*`);
        if (!ancorado && !soJsx) {
          const linha = fonte.slice(0, m.index).split("\n").length;
          maus.push(`${relative(process.cwd(), f)}:${linha} → /${padrao}/${flags}`);
        }
      }
    }
    // Eram 116 a 01-10-2026; se isto cair para perto de zero, é a procura que
    // se partiu, não os testes que melhoraram.
    expect(vistos).toBeGreaterThan(100);
    expect(maus, `Removedores que tratam qualquer /* como comentário:\n${maus.join("\n")}`).toEqual([]);
  });
});
