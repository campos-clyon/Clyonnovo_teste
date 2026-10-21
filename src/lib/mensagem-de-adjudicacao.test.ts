import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { linkDaAdjudicacao, mensagemDeAdjudicacao, METODOS_DE_PAGAMENTO } from "./mensagem-de-adjudicacao";

/**
 * O BOTÃO DA ADJUDICAÇÃO — 21-10-2026.
 *
 * A Daniela (pedido #475, recolha de monos) aceitou a proposta — «Ok. Estou de
 * acordo.» — e a TRSul ficou com o trabalho. O dono escrevia a seguir, à mão,
 * a mensagem de adjudicação com os métodos de pagamento; pediu um botão ao
 * lado de «Alterar valor ou taxa» que abrisse o WhatsApp dela com a mensagem
 * já escrita.
 */

// 21-10-2026 às 16:55 em Lisboa; o trabalho é sexta, 23, às 10:30 (UTC+1).
const AGORA = new Date("2026-10-21T15:55:00Z");
const SEXTA = "2026-10-23T09:30:00.000Z";

describe("a mensagem", () => {
  const m = mensagemDeAdjudicacao({ cliente: "Daniela Lucas", quando: SEXTA }, AGORA);

  it("trata-a pelo nome e diz o dia, como o dono a escrevia", () => {
    expect(m).toMatch(
      /^Excelente, Daniela! O serviço fica então agendado e adjudicado para sexta-feira, 23 de outubro, às 10:30\.\n\n/,
    );
    expect(m).toContain("Um colega vai entrar em contacto para alinhar os detalhes");
  });

  it("leva os métodos de pagamento, tal e qual, e o pedido do comprovativo no fim", () => {
    expect(m).toContain(METODOS_DE_PAGAMENTO);
    for (const linha of [
      "💳 MB WAY: +351 931 632 622",
      "IBAN: PT50 0007 0000 0034 4144 7492 3",
      "BIC/SWIFT: BESCPTPL",
      "🌍 Revolut: revolut.me/cpss",
      "🏦 IBAN Revolut: LT72 3250 0157 4466 0473",
      "Titular: Wanderson Campos Silva",
    ]) {
      expect(m, linha).toContain(linha);
    }
    expect(m).toMatch(/\n\nApós o pagamento, envie o comprovativo para agilizar o processo\.$/);
  });

  it("sem nome, sem nome; sem dia (ou com um dia que já passou), sem dia", () => {
    expect(mensagemDeAdjudicacao({ cliente: null, quando: SEXTA }, AGORA)).toMatch(/^Excelente! O serviço/);
    expect(mensagemDeAdjudicacao({ cliente: "Daniela", quando: null }, AGORA)).toMatch(
      /^Excelente, Daniela! O serviço fica então adjudicado\.\n\n/,
    );
    expect(mensagemDeAdjudicacao({ cliente: "Daniela", quando: "2026-10-20T09:30:00.000Z" }, AGORA)).toMatch(
      /^Excelente, Daniela! O serviço fica então adjudicado\.\n\n/,
    );
  });
});

describe("o link", () => {
  it("abre a conversa do cliente com a mensagem escrita", () => {
    const link = linkDaAdjudicacao({ cliente: "Daniela Lucas", telefone: "964 764 157", quando: SEXTA }, AGORA);
    expect(link).toMatch(/^https:\/\/wa\.me\/351964764157\?text=/);
    expect(decodeURIComponent(link!.split("?text=")[1])).toBe(
      mensagemDeAdjudicacao({ cliente: "Daniela Lucas", quando: SEXTA }, AGORA),
    );
  });

  it("sem telefone, não há link", () => {
    expect(linkDaAdjudicacao({ cliente: "Daniela", telefone: null, quando: SEXTA }, AGORA)).toBeNull();
  });
});

describe("o botão, no cartão do trabalho", () => {
  const CARTAO = readFileSync(join(process.cwd(), "src/components/admin/TrabalhoClyon.tsx"), "utf8");

  it("só com profissional e por fazer, com o dia combinado", () => {
    expect(CARTAO).toMatch(
      /const adjudicacao =\s*r\.fase === "atribuida" && a && !a\.confirmadoEm\s*\?\s*linkDaAdjudicacao\(\{ \.\.\.t, quando: a\.dataCombinada \?\? t\.dataAgendada \}, new Date\(\)\)\s*:\s*null;/,
    );
  });

  it("ao lado de «Alterar valor ou taxa», como um link que abre o WhatsApp", () => {
    const alterar = CARTAO.indexOf("Alterar valor ou taxa\n");
    const alterarCrlf = CARTAO.indexOf("Alterar valor ou taxa\r\n");
    const i = Math.max(alterar, alterarCrlf);
    expect(i).toBeGreaterThan(-1);
    const depois = CARTAO.slice(i, i + 900);
    expect(depois).toMatch(/\{adjudicacao && \(\s*<a\s+href=\{adjudicacao\}\s+target="_blank"\s+rel="noopener noreferrer"/);
    expect(depois).toContain("Enviar adjudicação ao cliente");
  });
});
