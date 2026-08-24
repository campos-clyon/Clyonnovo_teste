import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A gestão completa da conta do cliente, no backoffice.
 *
 * O PATCH só aceitava `role` e `deletedAt`: um cliente que ditasse mal o
 * telefone ficava com ele errado para sempre, sem ecrã onde o corrigir.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ROTA = ler("src/app/api/admin/users/route.ts");
const PAINEL = ler("src/components/admin/ContasPanel.tsx");

describe("a rota", () => {
  it("aceita nome, telefone, NIF e email", () => {
    for (const c of ['texto(body.name, 160)', 'texto(body.phone, 30)', 'texto(body.nif, 20)']) {
      expect(ROTA).toContain(c);
    }
    expect(ROTA).toContain("emailNovo");
  });

  it("valida o email e normaliza para minúsculas", () => {
    expect(ROTA).toContain(".trim().toLowerCase()");
    expect(ROTA).toContain("Email inválido.");
  });

  it("o email duplicado responde com a verdade, não com um 500", () => {
    // Duas contas com o mesmo email seriam uma só aos olhos do login — o
    // índice único trava, e a mensagem diz o quê.
    expect(ROTA).toContain('"ER_DUP_ENTRY"');
    expect(ROTA).toContain("Já existe uma conta com esse email.");
  });

  it("migrar os pedidos é uma escolha explícita", () => {
    /*
     * O /conta encontra os pedidos por email da sessão. Mudar o email sem os
     * mover fá-los desaparecer da conta ao entrar — mas movê-los sem
     * perguntar seria mexer em dados históricos por efeito escondido.
     */
    expect(ROTA).toContain("body.migrarPedidos === true");
    expect(ROTA).toContain("UPDATE simulatorOrders SET contactEmail = ?");
  });
});

describe("o painel", () => {
  it("tem o lápis de editar em cada conta", () => {
    expect(PAINEL).toContain("setAEditar(u)");
    expect(PAINEL).toContain("function EditarConta");
  });

  it("o aviso do email só aparece quando o email muda", () => {
    // O email é a entrada (Google) e a ligação aos pedidos. O aviso ao lado
    // do campo, e não escondido num tooltip.
    expect(PAINEL).toContain("emailMudou && (");
    expect(PAINEL).toContain("cria uma conta nova");
  });

  it("o erro do servidor chega inteiro ao ecrã", () => {
    // "Já existe uma conta com esse email" não pode virar "Erro ao atualizar".
    expect(PAINEL).toContain("d.error ?? \"Erro ao atualizar\"");
  });
});
