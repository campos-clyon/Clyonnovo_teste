import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * DEPOIS DE CALCULAR, O ECRÃ É O DO ENVIO.
 *
 * "Após finalizar o cálculo deve ir direto para a tela de envio para os pros."
 * — 01-10-2026.
 *
 * O resumo já aparecia — e sempre apareceu. O que não acontecia era vê-lo:
 * ficava POR BAIXO do formulário inteiro, que num pedido de entulho são dezoito
 * campos, duas fotografias e a caixa da factura. Quem carregava em «Calcular»
 * continuava a olhar para os mesmos campos, sem nada que lhe dissesse que a
 * conta tinha acabado, e com o botão «Enviar aos profissionais» dois ecrãs
 * abaixo.
 *
 * ⚠️ ESTE FICHEIRO LÊ O CÓDIGO, e não o ecrã. O painel é do backoffice e abre
 * atrás de uma sessão de administrador, por isso não há aqui nenhum clique a
 * sério. O que se pode garantir sem o browser é a estrutura: que os campos se
 * recolhem, que o ecrã sobe, e que há porta de volta — e é isso que está aqui.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/**
 * O ficheiro sem comentários: um teste não se pode dar por satisfeito com uma
 * nota que fale do código em vez do código.
 *
 * ⚠️ SÓ OS COMENTÁRIOS QUE COMEÇAM UMA LINHA, e é por uma razão concreta.
 *
 * A versão de sempre — `/\/\*[\s\S]*?\*\//g` — engolia setenta e três linhas
 * deste ficheiro a partir daqui:
 *
 *     accept="image/*,video/*,application/pdf"
 *
 * O `/*` de um tipo MIME abre um comentário que nunca fecha onde devia, e o
 * fecho seguinte está muito mais abaixo. O botão «Calcular» desaparecia, e o
 * teste chumbava a dizer que o código não estava lá — estava.
 *
 * Um comentário a sério, neste repositório, começa quase sempre a sua própria
 * linha. Um `/*` no meio de uma string nunca começa. A regra é a mesma em todos
 * os testes — ver tirar-comentarios-sem-comer-codigo.test.ts.
 */
function semNotas(s: string): string {
  return s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
}

const PAINEL = semNotas(ler("src/components/admin/RegistarPedido.tsx"));

describe("o formulário recolhe-se quando há resultado", () => {
  it("os campos só se mostram sem resultado, ou a pedido", () => {
    /*
     * A condição é `!resultado || verCampos` e não `!resultado`: sem a segunda
     * metade, abrir os campos outra vez obrigava a deitar fora o que já se
     * tinha calculado.
     */
    expect(PAINEL).toContain("{(!resultado || verCampos) && (");
  });

  it("e o botão de calcular acompanha-os", () => {
    /*
     * Se o botão ficasse preso a `!resultado`, reabrir os campos dava um
     * formulário sem maneira de o voltar a submeter — um beco sem saída com
     * todos os campos editáveis a dizerem que sim.
     */
    const i = PAINEL.indexOf("onClick={calcular}");
    expect(i).toBeGreaterThan(-1);
    const antes = PAINEL.slice(Math.max(0, i - 220), i);
    expect(antes, "o botão de calcular deixou de acompanhar os campos").toContain(
      "{(!resultado || verCampos) && (",
    );
  });

  it("calcular deixa os campos recolhidos, e não abertos", () => {
    const i = PAINEL.indexOf("setResultado(dados);");
    expect(i).toBeGreaterThan(-1);
    expect(PAINEL.slice(i, i + 160)).toContain("setVerCampos(false)");
  });
});

describe("e o ecrã sobe até ao resumo", () => {
  it("há uma referência no painel e um efeito que a procura", () => {
    /*
     * Esconder o formulário não chega: o painel abre por cima da mesa de
     * pedidos, e quem carregou em «Calcular» já tinha descido até ao fundo da
     * página para lá chegar. Sem isto ficava a olhar para a mesa, com o
     * resultado acima da linha de água.
     */
    expect(PAINEL).toMatch(/const painel = useRef<HTMLDivElement \| null>\(null\)/);
    expect(PAINEL).toContain("ref={painel}");
    const i = PAINEL.indexOf("painel.current?.scrollIntoView");
    expect(i, "deixou de subir ao resumo").toBeGreaterThan(-1);
    expect(PAINEL.slice(i, i + 120)).toContain('block: "start"');
  });

  it("e só quando há mesmo um resultado", () => {
    /*
     * Um `scrollIntoView` sem guarda saltava a página a cada reposição do
     * componente — incluindo ao abrir o painel vazio, que é quando a pessoa
     * ainda está a escolher o serviço.
     */
    const i = PAINEL.indexOf("painel.current?.scrollIntoView");
    const bloco = PAINEL.slice(Math.max(0, i - 200), i);
    expect(bloco).toContain("if (!resultado) return;");
    expect(PAINEL.slice(i, i + 200)).toContain("}, [resultado]);");
  });
});

describe("⚠️ e há sempre porta de volta aos campos", () => {
  it("o botão existe e alterna, sem deitar fora o resultado", () => {
    expect(PAINEL).toContain("onVerCampos");
    expect(PAINEL).toContain("setVerCampos((v) => !v)");
    expect(PAINEL).toContain("Ver ou corrigir os campos");
  });

  it("E FORA do bloco dos botões de envio, que nem sempre existe", () => {
    /*
     * O TESTE QUE IMPORTA NESTE BLOCO.
     *
     * `{emEdicao && !podeEnviar ? null : …}` apaga o bloco inteiro dos botões
     * quando se está a editar um pedido que não pode ser reenviado. Com o
     * formulário recolhido e o botão lá dentro, esse ecrã ficava sem acção
     * nenhuma a não ser «Fechar» — e quem viesse corrigir uma morada tinha de
     * fechar o painel e abri-lo outra vez.
     */
    const volta = PAINEL.indexOf("Ver ou corrigir os campos");
    // Desde os Trabalhos CLYON (02-10-2026) o bloco começa por `{oferta ? (…) :`;
    // o envio normal continua a ser o mesmo pedaço.
    const bloco = PAINEL.indexOf("emEdicao && !podeEnviar ? null :");
    expect(volta).toBeGreaterThan(-1);
    expect(bloco).toBeGreaterThan(-1);
    expect(volta, "a porta de volta caiu para dentro do bloco de envio").toBeLessThan(bloco);
  });
});
