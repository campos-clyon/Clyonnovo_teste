import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { telefoneLegivel } from "./telefone-legivel";

/**
 * *«Passe a colocar o número à frente dos nomes, para a fácil identificação do
 * pedido.»* — 21-09-2026.
 *
 * Metade destes clientes não tem email: a conversa acontece toda no WhatsApp,
 * e o que o telemóvel mostra é um número, não um nome. Sem o número na linha,
 * encontrar o pedido de quem acabou de escrever era abrir a busca e colar.
 */

describe("o número como se lê em voz alta", () => {
  it("três grupos de três, que é como um número português se dita", () => {
    expect(telefoneLegivel("960000556")).toBe("960 000 556");
  });

  it("chega como o cliente o escreveu, e sai sempre igual", () => {
    for (const cru of [
      "960000556",
      "960 000 556",
      "960-000-556",
      "+351960000556",
      " (+351) 960 000 556 ",
      "00351960000556",
    ]) {
      expect(telefoneLegivel(cru), cru).toBe("960 000 556");
    }
  });

  it("com indicativo quando o indicativo importa", () => {
    expect(telefoneLegivel("931632622", { comIndicativo: true })).toBe("+351 931 632 622");
  });

  /*
   * O painel do WhatsApp recebe os números da ponte, que os entrega com o
   * indicativo e por vezes com o sufixo do protocolo colado ao fim.
   */
  it("aguenta o número como a ponte do WhatsApp o entrega", () => {
    expect(telefoneLegivel("351931632622", { comIndicativo: true })).toBe("+351 931 632 622");
    expect(telefoneLegivel("351931632622@c.us", { comIndicativo: true })).toBe(
      "+351 931 632 622",
    );
  });

  /*
   * ⚠️ O QUE NÃO SE PERCEBE MOSTRA-SE COMO VEIO.
   *
   * Vale mais um número com ar estranho, que se vê que está estranho, do que
   * um número arrumado que já não é o do cliente. Arrumar é a maneira de um
   * engano de escrita passar a parecer um número bom.
   */
  it("não arruma o que não percebe", () => {
    expect(telefoneLegivel("12345")).toBe("12345");
    expect(telefoneLegivel("9600005561234567")).toBe("9600005561234567");
    // Um português com um algarismo a mais não ganha o «+» de um estrangeiro.
    expect(telefoneLegivel("9123456789")).toBe("9123456789");
    expect(telefoneLegivel("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(telefoneLegivel("0044 20 7946 0958")).toBe("0044 20 7946 0958");
    expect(telefoneLegivel("não tem")).toBe("não tem");
  });

  /*
   * DE OUTRO PAÍS, SEM O «+» — 26-10-2026. A ponte grava-os só com os
   * algarismos; na linha da Mesa pareciam um português mal escrito. Ganham o
   * «+», para quem gere ver que é de fora. Números inventados.
   */
  it("um de fora que perdeu o «+» volta a tê-lo", () => {
    expect(telefoneLegivel("79000000000")).toBe("+79000000000");
    expect(telefoneLegivel("7 900 000 00 00")).toBe("+7 900 000 00 00");
    expect(telefoneLegivel("447700900123", { comIndicativo: true })).toBe("+447700900123");
    expect(telefoneLegivel("79000000000@c.us")).toBe("+79000000000");
  });

  it("sem número não inventa um traço — devolve vazio e quem chama decide", () => {
    expect(telefoneLegivel(null)).toBe("");
    expect(telefoneLegivel(undefined)).toBe("");
    expect(telefoneLegivel("")).toBe("");
    expect(telefoneLegivel("   ")).toBe("");
  });

  /*
   * A MESMA NORMALIZAÇÃO DO `wa.me`, de propósito: o número que aparece no
   * ecrã é o número para onde a mensagem vai. Duas regras diferentes para a
   * mesma coisa é como se mostra um e se manda para outro.
   */
  it("o que se mostra e o que se marca são o mesmo número", async () => {
    const { numeroParaWhatsApp } = await import("./link-de-whatsapp");
    for (const cru of ["960000556", "+351 960000556", "00351960000556"]) {
      expect(telefoneLegivel(cru).replace(/\s/g, ""), cru).toBe(
        numeroParaWhatsApp(cru)?.slice(3),
      );
    }
    // E o de fora sem «+»: o que se lê, sem o sinal e os espaços, é o do wa.me.
    for (const cru of ["79000000000", "7 900 000 00 00", "447700900123"]) {
      expect(telefoneLegivel(cru).replace(/[\s+]/g, ""), cru).toBe(numeroParaWhatsApp(cru));
    }
  });
});

describe("o número está na linha da mesa, ao lado do nome", () => {
  const PAINEL = readFileSync(
    join(process.cwd(), "src/components/admin/AdminNegociacoesPanel.tsx"),
    "utf8",
  );
  const CODIGO = PAINEL.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

  it("o nome e o telemóvel saem juntos", () => {
    expect(CODIGO).toContain("telefoneLegivel(p.contactPhone)");
    expect(CODIGO).toContain("{p.contactName ?? \"—\"}");
  });

  /*
   * O nome encolhe e o número fica inteiro. Um número cortado a meio é pior do
   * que nenhum, porque continua a parecer um número.
   */
  it("é o nome que encolhe, e nunca o número", () => {
    const i = CODIGO.indexOf("telefoneLegivel(p.contactPhone)");
    const bloco = CODIGO.slice(Math.max(0, i - 600), i + 400);
    expect(bloco).toContain("truncate");
    expect(bloco).toContain("shrink-0");
  });
});

/**
 * ⚠️ UMA REGRA SÓ PARA TODO O BACKOFFICE.
 *
 * Esta função existia duas vezes, copiada palavra por palavra entre o painel
 * do WhatsApp e o do assistente, e a mesa ia ser a terceira. Três cópias de
 * seis linhas é como o mesmo número passa a aparecer de três maneiras no mesmo
 * ecrã — e como uma correcção num sítio deixa os outros dois para trás.
 */
describe("não voltam a existir cópias privadas", () => {
  const CORPO = /function (telefoneBonito|formatarTelefone)\(t: string\): string \{/;

  for (const ficheiro of [
    "src/components/admin/AdminWhatsAppPanel.tsx",
    "src/components/admin/AdminAssistenteAutoPanel.tsx",
    "src/components/admin/AdminNegociacoesPanel.tsx",
  ]) {
    it(`${ficheiro} usa a função de todos`, () => {
      const texto = readFileSync(join(process.cwd(), ficheiro), "utf8");
      expect(texto).toContain('from "@/lib/telefone-legivel"');
      expect(texto).not.toMatch(CORPO);
    });
  }
});
