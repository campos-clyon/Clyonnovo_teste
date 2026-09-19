import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * UMA NOTA NO PEDIDO, À VISTA NA MESA.
 *
 * "O Sr. Rui Santos pediu para esperar até segunda para tomar uma decisão; se
 * tivesse como colocarmos uma etiqueta no pedido dele ou uma anotação, seria
 * mais fácil." — 19-09-2026.
 *
 * O bloco «Precisa de si» tinha doze pedidos, todos com o mesmo ar de quem
 * espera por uma resposta. Um deles não esperava nada — esperava segunda —
 * e não havia onde escrever isso. A informação vivia na cabeça de quem tinha
 * atendido a chamada, e na segunda-feira seguinte já era de outra pessoa.
 *
 * ⚠️ É A MESMA COLUNA QUE O ECRÃ DO PEDIDO JÁ ESCREVIA. `notasInternas`
 * existia e era editada no detalhe; o que faltava era chegar à mesa. Um campo
 * novo dava duas notas sobre a mesma coisa, e a que ficasse por ler seria
 * sempre a que tinha a informação.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const DB = semComentarios(ler("src/lib/db.ts"));
const MESA = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));

describe("a nota chega à mesa", () => {
  it("a consulta traz a coluna que já existia", () => {
    const i = DB.indexOf("export async function pedidosComNegociacoes");
    const j = DB.indexOf("export async function", i + 10);
    const corpo = j === -1 ? DB.slice(i) : DB.slice(i, j);
    expect(corpo).toContain("o.notasInternas");
    expect(corpo).toContain("notasInternas: (p.notasInternas as string) ?? null");
  });

  it("e é a MESMA do ecrã do pedido — não um campo novo", () => {
    /*
     * A prova de que é a mesma: a mesa grava pela rota do pedido, que é a que
     * o detalhe já usa. Duas rotas a escrever o mesmo campo acabam com regras
     * diferentes sobre ele.
     */
    expect(MESA).toContain("`/api/admin/pedidos/${id}`");
    expect(MESA).toContain('JSON.stringify({ notasInternas: limpo || null })');
    const DETALHE = semComentarios(
      ler("src/app/admin/pedidos/[id]/AdminPedidoDetalheClient.tsx"),
    );
    expect(DETALHE).toContain("notasInternas: editNotasInternas || null");
  });
});

describe("escrever a nota", () => {
  it("aparece na linha, sem ser preciso abrir o pedido", () => {
    // Uma nota que só se lê abrindo os pedidos um a um não serve para decidir
    // o que fazer a seguir — que é a pergunta que esta mesa faz.
    expect(MESA).toContain("p.notasInternas ? (");
    expect(MESA).toContain("Anotar");
  });

  it("e guarda-se com Enter, sem ir ao rato", () => {
    // Uma nota é uma linha. Obrigar ao rato para a gravar é um passo a mais
    // numa coisa que se faz doze vezes seguidas.
    expect(MESA).toContain('if (e.key === "Enter" && !e.shiftKey)');
    expect(MESA).toContain('if (e.key === "Escape") setNotaAberta(null);');
  });

  it("some do ecrã antes de a rede responder", () => {
    /*
     * Quem escreve uma nota espera vê-la ficar; meio segundo de espera lê-se
     * como «não guardou». Se falhar, o `carregar` do fim traz a de antes.
     */
    const i = MESA.indexOf("async function guardarNota");
    const corpo = MESA.slice(i, i + 1400);
    expect(corpo.indexOf("setPedidos((lista)")).toBeLessThan(corpo.indexOf("await fetch("));
    expect(corpo).toContain("await carregar(true, temTudo);");
  });

  it("dá para apagar, e não só para reescrever", () => {
    // Uma nota que já não é verdade é pior do que nenhuma: em segunda-feira,
    // «esperar até segunda» manda a pessoa esperar mais uma semana.
    expect(MESA).toContain("Apagar a nota");
  });

  it("cabe em 500 caracteres — é uma nota, não um relatório", () => {
    expect(MESA).toContain("slice(0, 500)");
    expect(MESA).toContain("maxLength={500}");
  });

  it("e a batida de 30s pára enquanto ele escreve", () => {
    /*
     * Sem isto, a lista renovava-se por baixo de uma frase a meio e o que ele
     * estava a escrever voltava ao que estava. É a mesma lição da correcção
     * das candidaturas, dois dias antes.
     */
    expect(MESA).toContain("paused: notaAberta !== null");
  });

  it("uma de cada vez", () => {
    expect(MESA).toContain("const [notaAberta, setNotaAberta] = useState<number | null>(null);");
  });
});
