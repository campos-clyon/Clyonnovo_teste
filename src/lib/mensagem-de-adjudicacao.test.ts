import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { linkDaAdjudicacao, mensagemDeAdjudicacao } from "./mensagem-de-adjudicacao";
import {
  ABERTURA_DOS_METODOS,
  blocoDosMetodosDePagamento,
  limparMetodosDePagamento,
  SEM_METODOS_DE_PAGAMENTO,
} from "./metodos-de-pagamento";

/**
 * O BOTÃO DA ADJUDICAÇÃO — 21-10-2026, reescrito a 22-10-2026.
 *
 * O dono escrevia a mensagem de adjudicação à mão; pediu um botão que abrisse
 * o WhatsApp do cliente com ela escrita. Depois: *«parece muito robotizada e
 * está com caracteres especiais»* (os emojis chegavam como «�»), e tem de
 * dizer quem faz o trabalho — a empresa, o responsável e o telefone.
 */

// 22-10-2026 às 11:00 em Lisboa; a mudança do exemplo é quinta, 29, às 10:00 (UTC+0 no inverno).
const AGORA = new Date("2026-10-22T10:00:00Z");
const QUINTA = "2026-10-29T10:00:00.000Z";
const EXEMPLO = {
  cliente: "Marta",
  quando: QUINTA,
  servico: "mudanca",
  localidade: "Benfica",
  empresa: "Recolhas Exemplo",
  responsavel: "Paulo",
  telefoneDaEmpresa: "930000494",
};

describe("a mensagem", () => {
  const m = mensagemDeAdjudicacao(EXEMPLO, AGORA);

  it("fala como uma pessoa: o nome, o trabalho e o dia", () => {
    expect(m).toMatch(/^Olá, Marta! Obrigado pela confirmação\.\n\n/);
    expect(m).toContain("A mudança em Benfica fica marcada para quinta-feira, 29 de outubro, às 10:00.");
  });

  it("diz quem faz o trabalho, quem liga, e o telefone dele", () => {
    expect(m).toContain("O trabalho fica a cargo da empresa Recolhas Exemplo.");
    expect(m).toContain(
      "O Paulo, responsável da Recolhas Exemplo, vai entrar em contacto consigo o mais breve possível para combinar os pormenores.",
    );
    expect(m).toContain("Se preferir, pode ligar-lhe directamente para o 930 000 494.");
  });

  it("sem emojis nem outros símbolos que o WhatsApp do cliente mostre como «�»", () => {
    // Só letras, números, pontuação de escrita e quebras de linha.
    expect(m).toMatch(/^[\p{L}\p{N}\s.,:;!?()€/@+\-—'«»]+$/u);
    expect(m).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("sem métodos nas Configs, diz que os dados seguem a seguir — e pede o comprovativo", () => {
    expect(m).toContain(`\n\n${SEM_METODOS_DE_PAGAMENTO}\n\n`);
    expect(m).not.toContain(ABERTURA_DOS_METODOS);
    expect(m).toContain("Depois de pagar, envie-nos o comprovativo por aqui, por favor.");
    expect(m).toMatch(/\n\nObrigado pela preferência,\nEquipa CLYON$/);
  });

  // Valores inventados: nenhum destes dados existe.
  const INVENTADOS = "Transferência bancária\nConta: 0000 FALSA 0000\nTitular: Fulano de Tal";

  it("com métodos nas Configs, leva-os depois da abertura, tal e qual", () => {
    const com = mensagemDeAdjudicacao({ ...EXEMPLO, metodosDePagamento: INVENTADOS }, AGORA);
    expect(com).toContain(`${ABERTURA_DOS_METODOS}\n\n${INVENTADOS}\n\nDepois de pagar`);
    expect(com).not.toContain(SEM_METODOS_DE_PAGAMENTO);
  });

  it("o texto das Configs sai arrumado: sem emojis, sem linhas em branco a mais, sem abertura repetida", () => {
    expect(limparMetodosDePagamento("  \n ")).toBeNull();
    expect(limparMetodosDePagamento(null)).toBeNull();
    expect(limparMetodosDePagamento("💳 Conta: 0000\r\n\r\n\r\n\r\nOutra   opção  ")).toBe("Conta: 0000\n\nOutra opção");
    expect(blocoDosMetodosDePagamento(`${ABERTURA_DOS_METODOS}\n\nConta: 0000`)).toBe(
      `${ABERTURA_DOS_METODOS}\n\nConta: 0000`,
    );
    const com = mensagemDeAdjudicacao({ ...EXEMPLO, metodosDePagamento: "💳 " + INVENTADOS }, AGORA);
    expect(com).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("sem responsável escrito, fala da equipa da empresa; sem telefone, não o inventa", () => {
    const sem = mensagemDeAdjudicacao({ ...EXEMPLO, responsavel: null, telefoneDaEmpresa: null }, AGORA);
    expect(sem).toContain("A equipa da Recolhas Exemplo vai entrar em contacto consigo o mais breve possível");
    expect(sem).not.toContain("ligar-lhe");
  });

  it("sem empresa, um colega entra em contacto", () => {
    const sem = mensagemDeAdjudicacao({ ...EXEMPLO, empresa: null }, AGORA);
    expect(sem).toContain("Um colega vai entrar em contacto consigo o mais breve possível");
    expect(sem).not.toContain("a cargo da empresa");
  });

  it("sem nome, sem nome; sem dia (ou com um que já passou), confirmado sem dia", () => {
    expect(mensagemDeAdjudicacao({ ...EXEMPLO, cliente: null }, AGORA)).toMatch(/^Olá! Obrigado pela confirmação\./);
    expect(mensagemDeAdjudicacao({ ...EXEMPLO, quando: null }, AGORA)).toContain("A mudança em Benfica fica confirmada.");
    expect(mensagemDeAdjudicacao({ ...EXEMPLO, quando: "2026-10-20T09:30:00.000Z" }, AGORA)).toContain(
      "A mudança em Benfica fica confirmada.",
    );
  });
});

describe("o link", () => {
  it("abre a conversa do cliente com a mensagem escrita", () => {
    const link = linkDaAdjudicacao({ ...EXEMPLO, telefone: "930 000 494" }, AGORA);
    expect(link).toMatch(/^https:\/\/wa\.me\/351930000494\?text=/);
    expect(decodeURIComponent(link!.split("?text=")[1])).toBe(mensagemDeAdjudicacao(EXEMPLO, AGORA));
  });

  it("sem telefone, não há link", () => {
    expect(linkDaAdjudicacao({ ...EXEMPLO, telefone: null }, AGORA)).toBeNull();
  });
});

describe("o botão, no cartão do trabalho", () => {
  const CARTAO = readFileSync(join(process.cwd(), "src/components/admin/TrabalhoClyon.tsx"), "utf8").replace(/\r\n/g, "\n");

  it("só com profissional e por fazer, com o dia combinado, a empresa, o responsável e o telefone dela", () => {
    // Desde 27-10-2026 (d14) os dados vêm num objecto à parte, para o botão das formas de pagamento.
    const i = CARTAO.indexOf("const dadosDaAdjudicacao =");
    const bloco = CARTAO.slice(i, CARTAO.indexOf(": null;", i));
    expect(bloco).toContain('r.fase === "atribuida" && a && !a.confirmadoEm');
    expect(bloco).toContain("quando: a.dataCombinada ?? t.dataAgendada");
    expect(bloco).toContain("empresa: a.profissional");
    expect(bloco).toContain("responsavel: a.responsavel ?? null");
    expect(bloco).toContain("telefoneDaEmpresa: a.telefone ?? null");
  });

  it("ao lado de «Alterar valor ou taxa», com a escolha das formas de pagamento (d14)", () => {
    const i = CARTAO.indexOf("Alterar valor ou taxa\n");
    expect(i).toBeGreaterThan(-1);
    const depois = CARTAO.slice(i, i + 900);
    expect(depois).toMatch(/\{adjudicacao && \(\s*<EnviarAdjudicacao/);
    const botao = readFileSync(join(process.cwd(), "src/components/admin/EnviarAdjudicacao.tsx"), "utf8");
    expect(botao).toContain("Enviar adjudicação ao cliente");
    expect(botao).toMatch(/target="_blank"\s+rel="noopener noreferrer"/);
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
