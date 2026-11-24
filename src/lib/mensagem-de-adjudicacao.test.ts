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

  // Desde 03-11-2026 (d15) só com os «Dados do dono» marcados e um motivo escrito.
  const COM_O_DONO = { formas: { comDadosDoDono: true, motivoDosDadosDoDono: "O cliente pediu transferência", referencias: [] } };

  it("com métodos nas Configs e os dados do dono escolhidos, leva-os tal e qual", () => {
    const com = mensagemDeAdjudicacao({ ...EXEMPLO, metodosDePagamento: INVENTADOS, ...COM_O_DONO }, AGORA);
    expect(com).toContain(`Para o pagamento:\n\n${INVENTADOS}\n\nDepois de pagar`);
    expect(com).not.toContain(SEM_METODOS_DE_PAGAMENTO);
  });

  it("o texto das Configs sai arrumado: sem emojis, sem linhas em branco a mais, sem abertura repetida", () => {
    expect(limparMetodosDePagamento("  \n ")).toBeNull();
    expect(limparMetodosDePagamento(null)).toBeNull();
    expect(limparMetodosDePagamento("💳 Conta: 0000\r\n\r\n\r\n\r\nOutra   opção  ")).toBe("Conta: 0000\n\nOutra opção");
    expect(blocoDosMetodosDePagamento(`${ABERTURA_DOS_METODOS}\n\nConta: 0000`)).toBe(
      `${ABERTURA_DOS_METODOS}\n\nConta: 0000`,
    );
    const com = mensagemDeAdjudicacao({ ...EXEMPLO, metodosDePagamento: "💳 " + INVENTADOS, ...COM_O_DONO }, AGORA);
    expect(com).toContain("Transferência bancária");
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
    expect(link).toMatch(/^https:\/\/api\.whatsapp\.com\/send\?phone=351930000494&text=/);
    expect(decodeURIComponent(link!.split("&text=")[1])).toBe(mensagemDeAdjudicacao(EXEMPLO, AGORA));
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
    // d55: pela regra das fases — nos Contratados, e nos Feitos do modelo novo («dados para pagamento»).
    expect(bloco).toContain("botoes.adjudicacao && a && !a.confirmadoEm");
    expect(bloco).toContain("quando: a.dataCombinada ?? t.dataAgendada");
    expect(bloco).toContain("empresa: a.profissional");
    expect(bloco).toContain("responsavel: a.responsavel ?? null");
    expect(bloco).toContain("telefoneDaEmpresa: a.telefone ?? null");
  });

  it("ao lado dos dados para pagamento, com a escolha das formas de pagamento (d14, d55)", () => {
    // d55: saiu do «Alterar valor ou taxa» (que acaba nos Contratados) para estar também nos Feitos.
    const i = CARTAO.indexOf("{valoresParaPagamento && <EnviarValoresParaPagamento");
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

/**
 * d103 (CEO e dono, 24-11-2026): no modelo antigo, pelo trabalho todo, com só o
 * link do pedido para pagar, a mensagem não dizia valor nenhum («… fica
 * confirmada. Inclui o que está nas fotografias…»). Agora diz o total com IVA,
 * logo a seguir ao «fica confirmada/marcada» e antes do que cobre.
 */
describe("d103: o total no modelo antigo, pelo trabalho todo", () => {
  const RECOLHA = {
    cliente: "Rui",
    quando: null,
    servico: "recolha_moveis",
    localidade: "Amadora",
    empresa: "Recolhas Exemplo",
    base: "total" as const,
    valor: { semIva: 100, total: 123 },
    formas: { comDadosDoDono: false, referencias: [], link: "https://clyon.pt/pedido/exemplo" },
  };

  it("só o link, base total: diz o total com IVA, entre o «fica confirmada» e o «Inclui»", () => {
    const m = mensagemDeAdjudicacao(RECOLHA, AGORA);
    expect(m).toContain("A recolha de móveis em Amadora fica confirmada.\n\nO total é 100 € + IVA = 123 €. Inclui o que está nas fotografias e na descrição.");
    expect(m).toContain("Pode pagar por MB WAY, por Multibanco ou por transferência, no seu pedido:");
    // No modelo antigo o cliente paga um total à CLYON: sem a cauda da taxa da plataforma.
    expect(m).not.toContain("taxa da plataforma");
    expect(m.match(/O total é/g)).toHaveLength(1);
  });

  it("também com o dia por vir e sem formas escolhidas", () => {
    const m = mensagemDeAdjudicacao({ ...RECOLHA, quando: QUINTA, formas: undefined }, AGORA);
    expect(m).toMatch(/fica marcada para [^\n]+\.\n\nO total é 100 € \+ IVA = 123 €\. Inclui /);
  });

  it("sem IVA a acrescer, o total sozinho; nunca o sem IVA sozinho", () => {
    const m = mensagemDeAdjudicacao({ ...RECOLHA, valor: { semIva: 282, total: 282 } }, AGORA);
    expect(m).toContain("O total é 282 €. Inclui ");
  });

  it("sem valor gravado, nada muda", () => {
    const m = mensagemDeAdjudicacao({ ...RECOLHA, valor: null }, AGORA);
    expect(m).not.toContain("O total é");
    expect(m).toContain("A recolha de móveis em Amadora fica confirmada.\n\nInclui o que está nas fotografias");
  });

  it("por carga e por hora o número já vai na frase da base: não se duplica", () => {
    const carga = mensagemDeAdjudicacao({ ...RECOLHA, base: "carga" as const, valor: { semIva: 360, total: 442.8 } }, AGORA);
    expect(carga).not.toContain("O total é");
    expect(carga.match(/360 € \+ IVA/g)).toHaveLength(1);
    const hora = mensagemDeAdjudicacao({ ...RECOLHA, servico: "mudanca", base: "hora" as const, valor: { semIva: 50, total: 61.5 } }, AGORA);
    expect(hora).not.toContain("O total é");
  });

  it("no modelo de 15-11 o total vai no bloco do pagamento, uma só vez", () => {
    const m = mensagemDeAdjudicacao(
      {
        ...RECOLHA,
        formas: { ...RECOLHA.formas, novoModelo: { total: 123, semIva: 100, base: "total" as const, formas: ["transferencia" as const] } },
      },
      AGORA,
    );
    expect(m.match(/O total é/g)).toHaveLength(1);
    expect(m).toContain("O total é 100 € + IVA = 123 €, já com a taxa da plataforma.");
  });
});
