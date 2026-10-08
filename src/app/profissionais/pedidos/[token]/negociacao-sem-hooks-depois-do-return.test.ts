import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * NENHUM HOOK DEPOIS DE UM `return` — 08-10-2026.
 *
 * «Eu aceitei uma contra proposta e isso aconteceu!» — o ecrã «Não foi possível
 * abrir este ecrã», e depois de recarregar a aceitação estava gravada. O
 * `NegociacaoProfissional` tinha dois `useState` (o tempo e a equipa) depois
 * dos `return` de «À espera do cliente» e de «O trabalho é seu». A negociar,
 * o React contava seis hooks; ao aceitar, o estado mudava, o ecrã saía mais
 * cedo com quatro, e o React parava tudo.
 *
 * O projecto não corre o ESLint (não há `rules-of-hooks`), por isso a regra
 * fica aqui, para todos os componentes: dentro de uma função de topo, depois
 * do primeiro `if (…) return`, não aparece nenhum `useAlgo(`.
 */

const RAIZ = process.cwd();

function ficheiros(d: string, out: string[] = []): string[] {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) ficheiros(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

/** Os hooks chamados depois do primeiro `return` antecipado, função a função. */
function hooksDepoisDoReturn(fonte: string): string[] {
  const linhas = fonte.replace(/\r\n/g, "\n").split("\n");
  const achados: string[] = [];
  let funcao: string | null = null;
  let anteriorANivel2 = "";
  let primeiroReturn = -1;
  linhas.forEach((l, i) => {
    const topo = l.match(/^(?:export (?:default )?)?function ([A-Za-z0-9_]+)/);
    if (topo) {
      funcao = topo[1];
      primeiroReturn = -1;
      anteriorANivel2 = "";
      return;
    }
    if (l === "}") {
      funcao = null;
      return;
    }
    if (!funcao) return;
    const recuo = l.match(/^ */)![0].length;
    const t = l.trim();
    if (recuo === 2 && t) {
      const comentario = /^(\/\/|\/\*|\*)/.test(t);
      if (primeiroReturn >= 0 && !comentario && /(^|[^.\w])use[A-Z]\w*\s*[<(]/.test(t)) {
        achados.push(`${funcao}:${i + 1} (return na linha ${primeiroReturn + 1})`);
      }
      if (primeiroReturn < 0 && /^if \(.*\)\s*return\b/.test(t)) primeiroReturn = i;
      anteriorANivel2 = t;
    }
    // `  if (…) {` seguido de `    return` — e não o `return` de uma função
    // interna (o `agir`, por exemplo), que vem depois de outra linha.
    if (recuo === 4 && primeiroReturn < 0 && /^return\b/.test(t) && /^(if \(|\} else|else)/.test(anteriorANivel2)) {
      primeiroReturn = i;
    }
  });
  return achados;
}

describe("a regra dos hooks", () => {
  it("o detector apanha o caso que rebentou, e não se engana com funções internas", () => {
    const antes = [
      "export default function Negociacao() {",
      "  const [a, setA] = useState(0);",
      "  async function agir() {",
      "    return;",
      "  }",
      '  if (estado === "aguarda_contratacao") {',
      "    return <p />;",
      "  }",
      "  const [horas, setHoras] = useState<number | null>(null);",
      "  return <div />;",
      "}",
    ].join("\n");
    expect(hooksDepoisDoReturn(antes)).toEqual(["Negociacao:9 (return na linha 7)"]);

    const depois = [
      "export default function Negociacao() {",
      "  const [a, setA] = useState(0);",
      "  const [horas, setHoras] = useState<number | null>(null);",
      "  async function agir() {",
      "    return;",
      "  }",
      '  if (estado === "aguarda_contratacao") return <p />;',
      "  // useState aqui num comentário não conta",
      "  return <div />;",
      "}",
    ].join("\n");
    expect(hooksDepoisDoReturn(depois)).toEqual([]);
  });

  it("a negociação do profissional tem os hooks todos antes de «À espera do cliente»", () => {
    const N = readFileSync(join(RAIZ, "src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx"), "utf8")
      .replace(/\r\n/g, "\n");
    const espera = N.indexOf('if (negociacao.estado === "aguarda_contratacao") {');
    expect(espera).toBeGreaterThan(-1);
    expect(N.indexOf("const [horasDitas, setHorasDitas] = useState")).toBeLessThan(espera);
    expect(N.indexOf("const [pessoasDitas, setPessoasDitas] = useState")).toBeLessThan(espera);
    expect(N.indexOf("if (ofertaClyon) {")).toBeGreaterThan(N.indexOf("const [pessoasDitas"));
  });

  it("em todo o src, nenhum componente chama um hook depois de um return antecipado", () => {
    const achados = ficheiros(join(RAIZ, "src")).flatMap((f) =>
      hooksDepoisDoReturn(readFileSync(f, "utf8")).map((a) => `${relative(RAIZ, f)} ${a}`),
    );
    expect(achados).toEqual([]);
  });
});
