import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A caixa da descrição cresce com o texto.
 *
 * O pedido do João Moreira ocupava treze linhas — um esvaziamento de um oitavo
 * andar, com os móveis item a item. A caixa mostrava duas e escondia as outras
 * onze atrás de uma barra de deslocamento. "Se o texto é grande ele não deve
 * ocultar partes, deve crescer junto garantindo a leitura total dele."
 *
 * As alturas não se medem aqui: num DOM de teste o scrollHeight é sempre zero e
 * um teste desses passaria sem provar nada. Foram medidas no browser — 192 px
 * para o texto do João, 48 px para "Só uma cómoda", zero escondido em ambos.
 * O que fica escrito são as três coisas que, se caírem, voltam a cortar texto.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const CAIXA = ler("src/components/CaixaDeTextoQueCresce.tsx");
const FORMULARIO = ler("src/components/admin/RegistarPedido.tsx");

describe("a caixa que cresce", () => {
  it("encolhe antes de medir — senão a altura só sabe subir", () => {
    const posAuto = CAIXA.indexOf('el.style.height = "auto"');
    const posMedir = CAIXA.indexOf("el.scrollHeight");
    expect(posAuto).toBeGreaterThan(-1);
    expect(posMedir).toBeGreaterThan(posAuto);
  });

  it("soma a borda: com box-sizing border-box faltavam dois píxeis", () => {
    // Medido: sem esta soma, scrollHeight - clientHeight ficava em 2 e a
    // última linha saía cortada ao meio.
    expect(CAIXA).toContain("el.offsetHeight - el.clientHeight");
    expect(CAIXA).toContain("el.scrollHeight + borda");
  });

  it("volta a medir quando o texto muda — inclusive quando chega da base", () => {
    // No editor o texto do pedido chega DEPOIS da primeira pintura. Sem esta
    // dependência a caixa abria com a altura do vazio.
    expect(CAIXA).toMatch(/useLayoutEffect\([\s\S]*?\}, \[value\]\)/);
  });

  it("mede outra vez quando a largura muda — ela reparte as linhas todas", () => {
    expect(CAIXA).toContain("ResizeObserver");
    // Sem guarda, quebra onde não existe (renderização no servidor, testes).
    expect(CAIXA).toContain('typeof ResizeObserver === "undefined"');
  });

  it("não deixa barra de deslocamento nem pega de redimensionar", () => {
    expect(CAIXA).toContain("resize-none");
    expect(CAIXA).toContain("overflow-hidden");
  });
});

describe("o campo no formulário", () => {
  it("chama-se Descrição, como em todo o resto do site", () => {
    // O RÓTULO, não o ficheiro: o comentário ao lado explica como o campo se
    // chamava antes, e um teste que varra o ficheiro inteiro chumba por causa
    // da própria explicação.
    const i = FORMULARIO.indexOf("<CaixaDeTextoQueCresce");
    const rotulo = FORMULARIO.slice(FORMULARIO.lastIndexOf("<label", i), i);
    expect(rotulo).toContain("Descrição");
    expect(rotulo.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")).not.toContain(
      "O que é preciso fazer",
    );
  });

  it("usa a caixa que cresce, e não uma textarea de duas linhas", () => {
    expect(FORMULARIO).toContain("CaixaDeTextoQueCresce");
    const i = FORMULARIO.indexOf("<CaixaDeTextoQueCresce");
    const uso = FORMULARIO.slice(i, FORMULARIO.indexOf("/>", i));
    expect(uso).toContain('value={f.description}');
    // `rows` fixo aqui voltaria a impor um tecto à mão.
    expect(uso).not.toContain("rows=");
  });
});
