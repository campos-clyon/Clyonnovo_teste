import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * *«Abaixo da descrição deve ter todos os dados do pedido/cliente — deve
 * mostrar o nome e o número do pedido.»* — 29-09-2026.
 *
 * O nome e o telefone já existiam, mas lá em baixo, depois do aviso de
 * combinar, do mapa e dos botões. E o número do pedido não aparecia em lado
 * nenhum — que é justamente o que se diz quando se liga à CLYON.
 */

const ECRA = readFileSync(
  join(process.cwd(), "src/app/profissionais/painel/Trabalhos.tsx"),
  "utf8",
).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");

const inicio = ECRA.indexOf("O que o cliente pede");
const bloco = ECRA.slice(inicio, ECRA.indexOf("O acesso", inicio));

describe("o pedido e o cliente, logo abaixo da descrição", () => {
  it("vem a seguir à descrição, antes do acesso", () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(bloco).toContain("O pedido");
  });

  it("o número do pedido aparece sempre", () => {
    expect(bloco).toContain("#{pedido.pedidoId}");
  });

  it("nome, telefone e morada, e o telefone liga", () => {
    expect(bloco).toContain("pedido.contactoNome");
    expect(bloco).toContain("pedido.contactoTelefone");
    expect(bloco).toContain("pedido.morada");
    expect(bloco).toContain("href={`tel:");
  });

  /*
   * ⚠️ OS DADOS DO CLIENTE SÓ ENQUANTO O TRABALHO É DELE E ESTÁ POR FAZER.
   *
   * A mesma regra de «Onde e com quem» (16-09-2026): são dados que se recebem
   * PARA FAZER o trabalho. Antes de ser contratado não há motivo; depois de
   * confirmado, o motivo acabou.
   */
  it("o cliente só aparece contratado e antes de confirmado", () => {
    expect(bloco).toContain(
      'fechado && pedido.fase !== "confirmado" && pedido.fase !== "pago"',
    );
    for (const campo of ["contactoNome", "contactoTelefone", "morada"]) {
      expect(bloco).toContain(`verCliente && pedido.${campo}`);
    }
  });

  it("e o servidor continua a só os mandar quando o trabalho é dele", () => {
    const ROTA = readFileSync(
      join(process.cwd(), "src/app/api/profissionais/meus-pedidos/route.ts"),
      "utf8",
    );
    expect(ROTA).toContain("contactoNome: (vista.contactName");
    expect(ROTA).toContain("Só chegam preenchidos quando o trabalho é dele.");
  });
});
