import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { quemNegoceia, clyonPodeConfirmar, porqueNaoPodeConfirmar } from "./quem-negoceia";

/**
 * A CLYON confirma o trabalho em nome de quem não tem como o fazer.
 *
 * O BECO QUE ISTO FECHA
 *
 * O #206 chegou por WhatsApp: a cliente não tem email. O profissional fez o
 * trabalho e mandou a prova — e não havia ninguém no mundo que pudesse
 * confirmar. Sem link no email dela, sem conta onde entrasse, e sem botão no
 * painel. `confirmadoEm` ficava NULL para sempre, e é essa data que fecha o
 * trabalho, que deixa apagar o pedido, e que deixa apagar qualquer das duas
 * contas.
 *
 * O PORTÃO QUE ISTO NÃO PODE ABRIR
 *
 * Confirmar liberta o dinheiro do profissional. Se a CLYON pudesse fazê-lo em
 * qualquer pedido, a promessa da plataforma — "só paga depois de confirmar" —
 * passava a valer o que vale a boa-fé de quem está do lado de dentro.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ROTA = ler("src/app/api/admin/negociacoes/agir/route.ts");
const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const CRON = ler("src/app/api/cron/libertar-por-prazo/route.ts");
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const VERCEL = JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };

describe("quem responde pelo lado do cliente", () => {
  it("é a CLYON quando o pedido foi registado pela equipa", () => {
    // Chegou por WhatsApp ou telefone: a pessoa nunca foi ao site.
    expect(quemNegoceia({ origem: "backoffice", contactEmail: "a@b.pt" })).toBe("clyon");
  });

  it("é a CLYON quando não há email", () => {
    // Sem email não há link, e sem link não há como responder.
    expect(quemNegoceia({ origem: "simulador", contactEmail: null })).toBe("clyon");
    expect(quemNegoceia({ origem: "simulador", contactEmail: "   " })).toBe("clyon");
  });

  it("é o cliente em tudo o resto", () => {
    expect(quemNegoceia({ origem: "simulador", contactEmail: "ana@exemplo.pt" })).toBe("cliente");
  });

  it("um cliente que pode confirmar sozinho não é confirmado por nós", () => {
    /*
     * ESTE É O TESTE QUE IMPORTA.
     *
     * Se isto passar a devolver `true`, a CLYON ganha o poder de libertar o
     * pagamento de qualquer profissional sem o cliente ter dito nada — e a
     * frase que o site repete em todas as páginas deixa de ser verdade.
     */
    const comEmail = { origem: "simulador", contactEmail: "ana@exemplo.pt" };
    expect(clyonPodeConfirmar(comEmail)).toBe(false);
    expect(porqueNaoPodeConfirmar(comEmail)).toContain("Só ele pode libertar");
  });

  it("diz porquê, para o ecrã não ficar mudo", () => {
    expect(porqueNaoPodeConfirmar({ origem: "backoffice", contactEmail: null })).toBeNull();
  });
});

describe("a rota", () => {
  it("aceita confirmar", () => {
    expect(ROTA).toContain('"confirmar"');
  });

  it("verifica o portão no SERVIDOR e não só no ecrã", () => {
    // A regra vivia dentro do painel, e servia para desenhar dois grupos. Um
    // portão que vive no browser não é um portão.
    expect(ROTA).toContain("clyonPodeConfirmar");
    expect(ROTA).toMatch(/status:\s*403/);
  });

  it("usa a mesma regra que o painel, e não uma cópia", () => {
    // Copiada em dois sítios, o dia em que uma delas mudasse era o dia em que
    // o ecrã escondia um botão que a rota continuava a aceitar.
    expect(ROTA).toContain('from "@/lib/quem-negoceia"');
    expect(PAINEL).toContain('from "@/lib/quem-negoceia"');
  });

  it("deixa escrito que foi a CLYON a confirmar", () => {
    /*
     * Um trabalho fechado pela CLYON e um fechado pelo cliente não são a mesma
     * coisa. No dia de um desacordo, esta é a única versão escrita.
     */
    expect(ROTA).toContain('acontecimento: "execucao_confirmada"');
    expect(ROTA).toContain('autorTipo: "clyon"');
  });
});

describe("o ecrã", () => {
  it("só mostra o botão a quem a CLYON representa mesmo", () => {
    expect(PAINEL).toContain("podeConfirmar={clyonPodeConfirmar(p)}");
    expect(PAINEL).toContain("negociacao.execucaoEnviadaEm && podeConfirmar");
  });

  it("mostra as três contas, e tira-as de taxas-plataforma", () => {
    // O painel dizia "200,00 €" e mais nada — o valor acordado, que não é o que
    // nenhuma das partes vê. Quem está ao telefone precisa do número certo.
    expect(PAINEL).toContain("quantoOClientePaga");
    expect(PAINEL).toContain("quantoOProfissionalRecebe");
    expect(PAINEL).toContain("comissaoDaClyon");
  });

  it("escreve o dinheiro com vírgula", () => {
    // Escrevia `{n.valorAcordado} €` — o valor cru da base — e saía "200.00 €".
    expect(semNotas(PAINEL)).not.toContain("{n.valorAcordado} €");
    expect(PAINEL).toContain("function euros(");
  });

  it("pede dois toques antes de libertar", () => {
    expect(PAINEL).toContain("Confirma que o trabalho está feito e pago?");
  });
});

describe("a libertação por prazo", () => {
  it("passou a ter quem a chame", () => {
    /*
     * `libertarTrabalhosPorPrazo` estava escrita em db.ts com o comentário a
     * explicar porque era precisa — e sem um único chamador. Código morto desde
     * o dia em que nasceu.
     *
     * A carteira calculava a libertação, por isso o profissional via o dinheiro
     * e ninguém deu por nada. Mas `confirmadoEm` ficava NULL, e um cliente que
     * simplesmente não voltasse ao site prendia para sempre o pedido dele, a
     * conta dele e a conta do profissional.
     */
    expect(CRON).toContain("libertarTrabalhosPorPrazo");
    expect(VERCEL.crons.some((c) => c.path === "/api/cron/libertar-por-prazo")).toBe(true);
  });

  it("corre todos os dias e não à segunda-feira", () => {
    // O prazo é de sete dias a contar da entrega. Num cron semanal, um trabalho
    // entregue à terça esperava até seis dias a mais por uma data já devida.
    const cron = VERCEL.crons.find((c) => c.path === "/api/cron/libertar-por-prazo");
    expect(cron?.schedule.split(" ")[4]).toBe("*");
    expect(cron?.schedule.split(" ")[2]).toBe("*");
  });

  it("falha fechada sem CRON_SECRET", () => {
    // Aberta, seria um endereço público que mexe em datas de pagamento.
    expect(CRON).toContain("if (!secret)");
    expect(CRON).toMatch(/status:\s*503/);
  });
});


describe("o ecrã das negociações da CLYON", () => {
  it("editar é um botão com nome, não um título clicável", () => {
    // O editar sempre existiu — era o título, clicável, sem nada que o
    // dissesse. Um botão que só se descobre por acidente não é um botão.
    expect(PAINEL).toContain("Abrir e editar tudo");
  });

  it("ver como o cliente abre a página verdadeira, não uma cópia", () => {
    /*
     * Uma pré-visualização desenhada à parte divergia da real na primeira
     * alteração à página. Abre-se `/pedido/[token]` noutro separador — o que
     * o admin vê é EXACTAMENTE o que o cliente vê.
     */
    expect(PAINEL).toContain("verComoCliente");
    expect(PAINEL).toMatch(/window\.open\(`\/pedido\/\$\{/);
  });

  it("avisa antes de matar um link que o cliente pode ter", () => {
    // Gerar link novo invalida o anterior. Sem email não há quem o tenha;
    // com email, pergunta-se primeiro.
    expect(PAINEL).toContain("o dele deixa de funcionar");
  });

  it("no ecrã próprio o título do grupo não se repete", () => {
    expect(PAINEL).toContain('mostrar !== "clyon" && (');
  });
});
