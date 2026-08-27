import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A CLYON dá a nota por quem não tem como a dar.
 *
 * "Eu devia ter a opção de abrir o pedido, sendo admin, ver toda a troca e
 * inclusive abrir o perfil do pro e dar a nota, já que foi criado o pedido
 * aqui."
 *
 * É o mesmo beco do `confirmar`, um passo mais à frente. Um pedido que chegou
 * por WhatsApp, com o cliente sem email, não tem quem avalie: a estrela é dada
 * no link do cliente, e ele não tem link nem conta. O trabalho fica feito, pago
 * e confirmado — e o profissional continua com «sem avaliações» para sempre.
 *
 * Isso não é um detalhe de vaidade: é o que abre a porta ao cliente seguinte.
 * Quem escolhe entre dois nomes numa lista escolhe pelas estrelas, e um
 * profissional que só trabalha por WhatsApp nunca chega a ter nenhuma.
 */

const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const ROTA = ler("src/app/api/admin/negociacoes/agir/route.ts");
const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const DB = ler("src/lib/db.ts");

describe("o portão", () => {
  it("é o mesmo do confirmar, e decidido pela mesma função", () => {
    /*
     * Se o cliente TEM como avaliar — tem email, recebeu o link — a nota é
     * dele e ninguém a dá por ele. Uma cópia da regra divergiria da original,
     * e a divergência apareceria como estrelas dadas onde não podiam ser.
     */
    const i = ROTA.indexOf('if (accao === "avaliar")');
    const bloco = ROTA.slice(i, ROTA.indexOf("const gravou = await avaliarProfissional", i));
    expect(bloco).toContain("clyonPodeConfirmar(alvo)");
    expect(bloco).toContain("porqueNaoPodeConfirmar(alvo)");
    expect(bloco).toContain("403");
  });

  it("recusa notas fora de 1 a 5", () => {
    const i = ROTA.indexOf('if (accao === "avaliar")');
    const bloco = ROTA.slice(i, i + 700);
    expect(bloco).toContain("estrelas < 1 || estrelas > 5");
  });

  it("os guardas do trabalho vivem no SQL, e não no ecrã", () => {
    // Só grava se estiver acordada, confirmada e por avaliar. Um botão pode
    // aparecer por engano; a consulta não engana.
    const i = DB.indexOf("export async function avaliarProfissional(");
    const corpo = DB.slice(i, DB.indexOf("\nexport ", i + 10));
    expect(corpo).toContain("estado = 'acordada'");
    expect(corpo).toContain("confirmadoEm IS NOT NULL");
    expect(corpo).toContain("avaliadoEm IS NULL");
  });

  it("uma nota que não gravou devolve o motivo, e não um ok", () => {
    const i = ROTA.indexOf("Não há nada para avaliar");
    expect(i).toBeGreaterThan(-1);
    expect(ROTA.slice(i - 200, i + 200)).toContain("409");
  });
});

describe("fica escrito quem avaliou", () => {
  it("no histórico do pedido e no registo permanente", () => {
    // Uma nota da CLYON e uma do cliente não são a mesma coisa, e no dia em
    // que alguém contar estrelas essa diferença é a única coisa que responde.
    const i = ROTA.indexOf('if (accao === "avaliar")');
    const bloco = ROTA.slice(i, ROTA.indexOf('if (accao === "confirmar")', i));
    expect(bloco).toContain("appendOrderHistory");
    expect(bloco).toContain('acontecimento: "avaliacao_feita"');
    expect(bloco).toContain('autorTipo: "clyon"');
    expect(bloco).toContain("em nome do cliente");
  });
});

describe("o ecrã", () => {
  it("as estrelas aparecem no cartão do trabalho concluído", () => {
    // É o único sítio onde alguém olha para um trabalho fechado, e o único
    // momento em que a memória do que correu bem ainda está fresca.
    expect(PAINEL).toContain("function AvaliarPelaClyon(");
    expect(PAINEL).toContain("<AvaliarPelaClyon");
    expect(PAINEL).toContain('accao: "avaliar"');
  });

  it("não se pede duas vezes a mesma nota", () => {
    expect(PAINEL).toContain("acordada.avaliadoEm ?");
    expect(PAINEL).toContain("de 5 · avaliado a");
  });

  it("quando a nota é do cliente, diz-se — em vez de um botão que dá 403", () => {
    expect(semComentarios(PAINEL)).toContain("a nota é do cliente, que recebeu o link");
  });

  it("a nota viaja da base até ao painel", () => {
    expect(DB).toContain("n.estrelas, n.avaliadoEm,");
    expect(PAINEL).toContain("estrelas?: number | null;");
  });
});
