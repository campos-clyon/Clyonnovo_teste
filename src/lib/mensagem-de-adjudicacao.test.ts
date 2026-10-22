import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { linkDaAdjudicacao, mensagemDeAdjudicacao, METODOS_DE_PAGAMENTO } from "./mensagem-de-adjudicacao";

/**
 * O BOTÃO DA ADJUDICAÇÃO — 21-10-2026, reescrito a 22-10-2026.
 *
 * O dono escrevia a mensagem de adjudicação à mão; pediu um botão que abrisse
 * o WhatsApp do cliente com ela escrita. Depois: *«parece muito robotizada e
 * está com caracteres especiais»* (os emojis chegavam como «�»), e tem de
 * dizer quem faz o trabalho — a empresa, o responsável e o telefone.
 */

// 22-10-2026 às 11:00 em Lisboa; a mudança da Dipta é quinta, 29, às 10:00 (UTC+0 no inverno).
const AGORA = new Date("2026-10-22T10:00:00Z");
const QUINTA = "2026-10-29T10:00:00.000Z";
const DIPTA = {
  cliente: "Dipta",
  quando: QUINTA,
  servico: "mudanca",
  localidade: "Alcântara",
  empresa: "Revolution",
  responsavel: "William",
  telefoneDaEmpresa: "960081494",
};

describe("a mensagem", () => {
  const m = mensagemDeAdjudicacao(DIPTA, AGORA);

  it("fala como uma pessoa: o nome, o trabalho e o dia", () => {
    expect(m).toMatch(/^Olá, Dipta! Obrigado pela confirmação\.\n\n/);
    expect(m).toContain("A mudança em Alcântara fica marcada para quinta-feira, 29 de outubro, às 10:00.");
  });

  it("diz quem faz o trabalho, quem liga, e o telefone dele", () => {
    expect(m).toContain("O trabalho fica a cargo da empresa Revolution.");
    expect(m).toContain(
      "O William, responsável da Revolution, vai entrar em contacto consigo o mais breve possível para combinar os pormenores.",
    );
    expect(m).toContain("Se preferir, pode ligar-lhe directamente para o 960 081 494.");
  });

  it("sem emojis nem outros símbolos que o WhatsApp do cliente mostre como «�»", () => {
    // Só letras, números, pontuação de escrita e quebras de linha.
    expect(m).toMatch(/^[\p{L}\p{N}\s.,:;!?()€/@+\-—'«»]+$/u);
    expect(m).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("leva os métodos de pagamento e o pedido do comprovativo", () => {
    expect(m).toContain(METODOS_DE_PAGAMENTO);
    for (const linha of [
      "MB WAY: 931 632 622",
      "IBAN: PT50 0007 0000 0034 4144 7492 3",
      "BIC/SWIFT: BESCPTPL",
      "Revolut: revolut.me/cpss",
      "IBAN Revolut: LT72 3250 0157 4466 0473",
      "Titular: Wanderson Campos Silva",
    ]) {
      expect(m, linha).toContain(linha);
    }
    expect(m).toContain("Depois de pagar, envie-nos o comprovativo por aqui, por favor.");
    expect(m).toMatch(/\n\nObrigado pela preferência,\nEquipa CLYON$/);
  });

  it("sem responsável escrito, fala da equipa da empresa; sem telefone, não o inventa", () => {
    const sem = mensagemDeAdjudicacao({ ...DIPTA, responsavel: null, telefoneDaEmpresa: null }, AGORA);
    expect(sem).toContain("A equipa da Revolution vai entrar em contacto consigo o mais breve possível");
    expect(sem).not.toContain("ligar-lhe");
  });

  it("sem empresa, um colega entra em contacto", () => {
    const sem = mensagemDeAdjudicacao({ ...DIPTA, empresa: null }, AGORA);
    expect(sem).toContain("Um colega vai entrar em contacto consigo o mais breve possível");
    expect(sem).not.toContain("a cargo da empresa");
  });

  it("sem nome, sem nome; sem dia (ou com um que já passou), confirmado sem dia", () => {
    expect(mensagemDeAdjudicacao({ ...DIPTA, cliente: null }, AGORA)).toMatch(/^Olá! Obrigado pela confirmação\./);
    expect(mensagemDeAdjudicacao({ ...DIPTA, quando: null }, AGORA)).toContain("A mudança em Alcântara fica confirmada.");
    expect(mensagemDeAdjudicacao({ ...DIPTA, quando: "2026-10-20T09:30:00.000Z" }, AGORA)).toContain(
      "A mudança em Alcântara fica confirmada.",
    );
  });
});

describe("o link", () => {
  it("abre a conversa do cliente com a mensagem escrita", () => {
    const link = linkDaAdjudicacao({ ...DIPTA, telefone: "960 081 494" }, AGORA);
    expect(link).toMatch(/^https:\/\/wa\.me\/351960081494\?text=/);
    expect(decodeURIComponent(link!.split("?text=")[1])).toBe(mensagemDeAdjudicacao(DIPTA, AGORA));
  });

  it("sem telefone, não há link", () => {
    expect(linkDaAdjudicacao({ ...DIPTA, telefone: null }, AGORA)).toBeNull();
  });
});

describe("o botão, no cartão do trabalho", () => {
  const CARTAO = readFileSync(join(process.cwd(), "src/components/admin/TrabalhoClyon.tsx"), "utf8").replace(/\r\n/g, "\n");

  it("só com profissional e por fazer, com o dia combinado, a empresa, o responsável e o telefone dela", () => {
    const i = CARTAO.indexOf("const adjudicacao =");
    const bloco = CARTAO.slice(i, CARTAO.indexOf(": null;", i));
    expect(bloco).toContain('r.fase === "atribuida" && a && !a.confirmadoEm');
    expect(bloco).toContain("quando: a.dataCombinada ?? t.dataAgendada");
    expect(bloco).toContain("empresa: a.profissional");
    expect(bloco).toContain("responsavel: a.responsavel ?? null");
    expect(bloco).toContain("telefoneDaEmpresa: a.telefone ?? null");
  });

  it("ao lado de «Alterar valor ou taxa», como um link que abre o WhatsApp", () => {
    const i = CARTAO.indexOf("Alterar valor ou taxa\n");
    expect(i).toBeGreaterThan(-1);
    const depois = CARTAO.slice(i, i + 900);
    expect(depois).toMatch(/\{adjudicacao && \(\s*<a\s+href=\{adjudicacao\}\s+target="_blank"\s+rel="noopener noreferrer"/);
    expect(depois).toContain("Enviar adjudicação ao cliente");
  });
});

describe("o responsável escreve-se na ficha do profissional", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

  it("tem coluna, entra nos dados que o backoffice muda, e chega ao cartão", () => {
    expect(ler("src/lib/db.ts")).toContain("ALTER TABLE providers ADD COLUMN responsavel VARCHAR(120) NULL DEFAULT NULL");
    expect(ler("src/lib/edicao-profissional.ts")).toContain(
      'if ("responsavel" in c) colunas.responsavel = textoDe(c.responsavel).slice(0, 120) || null;',
    );
    expect(ler("src/components/admin/AdminProfissionaisPanel.tsx")).toContain("dadosMudados.responsavel = responsavel");
    expect(ler("src/app/api/admin/trabalhos-clyon/route.ts")).toContain("responsavel: n.responsavel,");
  });
});
