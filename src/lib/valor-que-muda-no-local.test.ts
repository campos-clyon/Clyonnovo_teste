import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AJUSTE_FORA_DA_APP, VALOR_QUE_MUDA_NO_LOCAL } from "./ajuste-no-local";
import { O_QUE_A_CLYON_NAO_FAZ } from "./como-funciona-para-o-profissional";

/*
 * O VALOR QUE MUDA NO LOCAL — UMA SÓ REGRA (28-10-2026, d7).
 *
 * O painel e a app diziam «Valores fala sempre com a CLYON, nunca
 * directamente com o cliente… diga-nos — nós corrigimos o valor», a caixa do
 * ajuste da app manda pedir o ajuste ao cliente, e o «Como funciona» diz que
 * se corrige na plataforma, com registo. Decisão do dono: o painel não ganha
 * o ajuste; diz onde o pedir (na app, ou pelo WhatsApp).
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("a regra, dita uma vez", () => {
  it("as duas frases são as da decisão", () => {
    expect(VALOR_QUE_MUDA_NO_LOCAL).toBe(
      "Se o valor mudar no local, corrige-se na plataforma, com registo — nunca combinado por fora.",
    );
    expect(AJUSTE_FORA_DA_APP).toBe(
      "Se o valor mudar no local, peça o ajuste na app CLYON Pro ou fale connosco pelo WhatsApp.",
    );
  });

  it("diz o mesmo que o «Como funciona»: corrige-se na plataforma, com registo", () => {
    expect(O_QUE_A_CLYON_NAO_FAZ.join(" ")).toContain("corrige-se na plataforma, com registo");
    expect(VALOR_QUE_MUDA_NO_LOCAL).toContain("corrige-se na plataforma, com registo");
  });
});

describe("o painel", () => {
  const PAINEL = ler("src/app/profissionais/painel/Trabalhos.tsx");

  it("usa as duas constantes, com a ligação ao WhatsApp da CLYON", () => {
    expect(PAINEL).toContain("{VALOR_QUE_MUDA_NO_LOCAL}");
    expect(PAINEL).toContain("{AJUSTE_FORA_DA_APP}");
    expect(PAINEL).toContain("href={WHATSAPP_DA_CLYON}");
  });

  it("e a frase antiga saiu", () => {
    expect(PAINEL).not.toContain("Valores fala");
    expect(PAINEL).not.toContain("nós corrigimos o valor");
  });
});

/*
 * A APP MUDA DEPOIS, pela Engenharia — Apps (EAS Update): a frase de
 * TrabalhoContratado.tsx passa a `VALOR_QUE_MUDA_NO_LOCAL`. Até lá fica aqui,
 * e a lista só encolhe — quando a frase sair da app, sai daqui.
 */
const AINDA_NA_APP = ["Valores fala sempre com a CLYON"];

describe("a app (à espera da Engenharia — Apps)", () => {
  it("as frases antigas que ainda lá estão, e só essas", () => {
    const APP = readFileSync(join(process.cwd(), "app-pro/src/componentes/TrabalhoContratado.tsx"), "utf8");
    for (const f of AINDA_NA_APP) expect(APP, `«${f}» já saiu da app: tire-a da lista`).toContain(f);
  });
});
