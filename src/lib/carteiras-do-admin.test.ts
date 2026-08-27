import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * As carteiras, no backoffice.
 *
 * "Todos esses pedidos já foram concluídos e recebemos os pagamentos, mas não
 * tenho acesso aos dados dos pros para efectuar o pagamento deles manual, já
 * que por enquanto estamos à espera do eupago validar a nossa conta. Devíamos
 * ver o IBAN dos pros, nome completo e morada fiscal, assim como o MB WAY como
 * outra opção de pagamento. Deixe o admin ver todas as carteiras e gerir os
 * pagamentos."
 *
 * O ecrã dos Levantamentos mostra quem PEDIU para receber, e dizia "nada por
 * transferir" com 570 € por transferir. Para pedir é preciso ter IBAN gravado,
 * e dois dos três profissionais com trabalho por pagar não o têm: a fila estava
 * vazia porque ninguém conseguia entrar nela.
 */

const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const ROTA = ler("src/app/api/admin/carteiras/route.ts");
const PAINEL = ler("src/components/admin/AdminCarteirasPanel.tsx");
const SHELL = ler("src/components/admin/LegacyAdminClient.tsx");
const DB = ler("src/lib/db.ts");
const PERFIL = ler("src/app/api/profissionais/perfil/route.ts");

describe("a pergunta certa", () => {
  it("olha para quem TEM A RECEBER, e não para quem pediu", () => {
    // É a diferença entre um ecrã vazio e 570 € à espera.
    expect(ROTA).toContain("n.confirmadoEm IS NOT NULL");
    expect(ROTA).toContain("n.pagoEm");
    expect(ROTA).not.toContain("FROM levantamentos");
  });

  it("exige admin — é a rota onde o IBAN sai inteiro", () => {
    // Em todo o resto da casa o IBAN volta encurtado. Aqui o número é o
    // produto: sem ele não há transferência.
    expect(ROTA).toContain("requireAdmin(req)");
    expect(ROTA).not.toContain("ibanEncurtado");
  });

  it("conta o líquido, e não o acordado", () => {
    // O que sai do banco é o que ele recebe, já com a taxa descontada.
    expect(ROTA).toContain("quantoOProfissionalRecebe");
  });

  it("põe à frente quem tem mais a receber", () => {
    expect(ROTA).toContain("b.totalPorPagar - a.totalPorPagar");
  });

  it("conta quem não tem por onde receber", () => {
    // Foi isto que explicou o ecrã vazio dos Levantamentos.
    expect(ROTA).toContain("c.totalPorPagar > 0 && !c.iban && !c.mbway");
  });
});

describe("marcar como pago", () => {
  it("os guardas vivem no SQL — carregar duas vezes não paga duas vezes", () => {
    const i = ROTA.indexOf("UPDATE negociacoes SET pagoEm = NOW()");
    const sql = ROTA.slice(i, i + 200);
    expect(sql).toContain("estado = 'acordada'");
    expect(sql).toContain("confirmadoEm IS NOT NULL");
    expect(sql).toContain("pagoEm IS NULL");
  });

  it("uma segunda tentativa devolve o motivo, e não um ok", () => {
    expect(ROTA).toContain("ou já foi pago");
    expect(ROTA).toContain("status: 409");
  });

  it("fica no histórico e no registo permanente, com quem marcou", () => {
    expect(ROTA).toContain("appendOrderHistory");
    expect(ROTA).toContain('acontecimento: "levantamento_pago"');
    expect(ROTA).toContain("Transferência feita fora da plataforma.");
  });

  it("o ecrã avisa que a transferência vem PRIMEIRO", () => {
    // O botão regista; não move dinheiro. Confundir os dois é pagar duas vezes
    // ou nenhuma.
    expect(PAINEL).toContain("Faça a transferência PRIMEIRO no banco");
  });
});

describe("o MB WAY", () => {
  it("tem coluna própria, e não é o telefone de contacto", () => {
    // Os dois números podem não ser o mesmo, e assumir que são é mandar
    // dinheiro para o sítio errado.
    expect(DB).toContain("ALTER TABLE providers ADD COLUMN mbway");
    expect(ROTA).toContain("p.mbway");
  });

  it("é validado ao gravar — um número errado paga a outra pessoa", () => {
    const i = PERFIL.indexOf('if ("mbway" in corpo)');
    const bloco = PERFIL.slice(i, PERFIL.indexOf('if ("iban" in corpo)', i));
    expect(bloco).toContain("digitos.length !== 9");
    expect(bloco).toContain("/^9/");
    // Apagar continua a ser possível: um campo opcional tem de se poder esvaziar.
    expect(bloco).toContain("mudancas.mbway = null;");
  });
});

describe("o ecrã", () => {
  it("está no menu, ao lado dos Levantamentos", () => {
    expect(semComentarios(SHELL)).toContain('"carteiras"');
    expect(SHELL).toContain("<AdminCarteirasPanel />");
  });

  it("mostra as três coisas que ele pediu", () => {
    expect(PAINEL).toContain("Transferência");
    expect(PAINEL).toContain("MB WAY");
    expect(PAINEL).toContain("Morada fiscal");
    expect(PAINEL).toContain("NIF");
  });

  it("copia o IBAN em vez de o obrigar a transcrever", () => {
    // Vinte e cinco caracteres à mão são vinte e cinco ocasiões para enganar.
    expect(PAINEL).toContain("navigator.clipboard.writeText");
  });

  it("diz quando falta o titular — um nome que não bate é transferência devolvida", () => {
    expect(PAINEL).toContain("Sem titular indicado.");
  });
});
