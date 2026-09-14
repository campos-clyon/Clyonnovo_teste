import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACRESCIMO_POR_ITEM_EXTRA,
  acrescimoPorItens,
  acrescimoPorExtenso,
  avisoDosItens,
  haAcrescimoPorItem,
} from "./itens-a-mais";

/**
 * "Nestes casos o cliente diz sempre que são só 2 sacos, mas depois aparecem
 * mais coisas." — um profissional, 14-09-2026. E o caso concreto: "Aconteceu
 * agora com o Louis em Lisboa. Além do colchão apareceram mais 4 almofadas."
 *
 * "Caso o cliente tenha mais coisas deve ter um acréscimo de 32 euros por item
 * adicionado a mais."
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("quanto vale o que aparece a mais", () => {
  it("trinta e dois euros por item", () => {
    expect(ACRESCIMO_POR_ITEM_EXTRA).toBe(32);
    expect(acrescimoPorItens(1)).toBe(32);
    expect(acrescimoPorItens(4)).toBe(128);
  });

  it("nada a mais é nada a pagar", () => {
    expect(acrescimoPorItens(0)).toBe(0);
  });

  /*
   * Um orçamento não DESCE por terem aparecido menos coisas do que as
   * descritas — isso combina-se, e é outra conversa. Um número negativo aqui
   * seria um desconto que ninguém autorizou.
   */
  it("menos coisas do que as descritas não faz o valor descer sozinho", () => {
    expect(acrescimoPorItens(-3)).toBe(0);
  });

  it("meios itens não existem", () => {
    expect(acrescimoPorItens(2.7)).toBe(64);
  });

  it("um número que não é número não inventa uma conta", () => {
    expect(acrescimoPorItens(Number.NaN)).toBe(0);
    expect(acrescimoPorItens(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("escreve-se como se fala, com vírgula decimal", () => {
    expect(acrescimoPorExtenso(1)).toBe("1 item a mais — 32,00 €");
    expect(acrescimoPorExtenso(4)).toBe("4 itens a mais — 128,00 €");
    expect(acrescimoPorExtenso(0)).toBe("0 itens a mais — 0,00 €");
  });
});

describe("o preço por carga é a excepção, e é a única", () => {
  /*
   * Um valor por carga já mede quantidade: se aparecer mais coisa, faz-se
   * outra carga e cobra-se outra carga. Somar-lhe 32 € por item seria cobrar
   * a mesma quantidade duas vezes.
   */
  it("por carga, não há acréscimo por item", () => {
    expect(haAcrescimoPorItem("carga")).toBe(false);
    expect(avisoDosItens("carga", "cliente")).toBeNull();
    expect(avisoDosItens("carga", "profissional")).toBeNull();
  });

  it("por total, há", () => {
    expect(haAcrescimoPorItem("total")).toBe(true);
    expect(avisoDosItens("total", "cliente")).not.toBeNull();
  });
});

describe("o aviso é escrito para quem o lê", () => {
  it("ao cliente diz o que cobre e quanto acresce", () => {
    const t = avisoDosItens("total", "cliente")!;
    expect(t).toContain("fotografias e na descrição");
    expect(t).toContain("32 €");
    // O acréscimo não é uma autorização para cobrar sozinho.
    expect(t).toContain("combinado consigo antes de o trabalho avançar");
  });

  it("ao profissional diz o mesmo do lado dele", () => {
    const t = avisoDosItens("total", "profissional")!;
    expect(t).toContain("A sua proposta cobre");
    expect(t).toContain("32 €");
    expect(t).toContain("combine-o com o cliente antes de carregar");
  });

  /*
   * O QUE O AVISO NÃO PODE PROMETER.
   *
   * O ecrã de aprovação do ajuste ainda não existe — está planeado em
   * `docs/plano-ajuste-no-local.md`. Escrever "você aprova aqui" seria
   * prometer um botão que não há, que é exactamente o género de frase que a
   * auditoria de 11-09 andou a arrancar do site.
   */
  it("não promete um botão de aprovação que ainda não existe", () => {
    for (const quem of ["cliente", "profissional"] as const) {
      const t = avisoDosItens("total", quem)!;
      expect(t).not.toContain("aprova aqui");
      expect(t).not.toContain("aprovar no site");
    }
  });
});

describe("a regra não se confunde com o que a casa leva", () => {
  it("não vive no ficheiro das taxas da plataforma", () => {
    // A CLYON não cobra isto nem o recebe: é o preço do trabalho a mais, e vai
    // inteiro para quem o faz.
    const TAXAS = ler("src/lib/taxas-plataforma.ts");
    expect(TAXAS).not.toContain("ACRESCIMO_POR_ITEM_EXTRA");
  });
});

describe("chega aos dois ecrãs onde se fecha um valor", () => {
  it("ao cliente, ao lado do aviso da carga", () => {
    const VISTA = ler("src/app/pedido/[token]/VistaDoPedido.tsx");
    expect(VISTA).toContain('avisoDosItens(base, "cliente")');
  });

  it("ao profissional, no mesmo sítio", () => {
    const PAINEL = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(PAINEL).toContain('avisoDosItens(lerBase(pedido.baseDoPreco), "profissional")');
  });
});
