import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O portão da análise: nenhum pedido chega aos profissionais sem a CLYON
 * o rever, completar e aprovar.
 *
 * O QUE ACONTECEU SEM ELE
 *
 * O #220 foi criado por uma cliente e distribuído na hora: quatro
 * profissionais receberam "Quantidade incerta — a confirmar com a equipa",
 * sem descrição, e foram convidados a propor um preço sobre isso. Uma
 * proposta às cegas não protege ninguém — o profissional arrisca, o cliente
 * recebe números ao calhas, e a plataforma fica com fama de mandar lixo.
 *
 * A regra de negócio que este ficheiro guarda: na plataforma as informações
 * são o produto, e informação não revista não se publica.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ROTA_CLIENTE = ler("src/app/api/simulador/pedido/route.ts");
const ROTA_PROMOVER = ler("src/app/api/admin/negociacoes/promover/route.ts");
const ROTA_REDISTRIBUIR = ler("src/app/api/admin/negociacoes/redistribuir/route.ts");

describe("o portão da análise", () => {
  it("a rota do cliente NÃO distribui", () => {
    // Se `distribuirPedido` voltar a esta rota, o portão caiu e os pedidos
    // voltam a sair sem revisão nenhuma.
    expect(ROTA_CLIENTE).not.toContain("distribuirPedido");
  });

  it("fica escrito no histórico que espera pela análise", () => {
    expect(ROTA_CLIENTE).toContain("À espera da análise da CLYON");
  });

  it("a aprovação continua a existir — e é deliberada", () => {
    // O "Enviar aos profissionais" do backoffice é o ÚNICO caminho de
    // publicação, junto com o redistribuir. Se estes também deixarem de
    // distribuir, ninguém publica nada.
    expect(ROTA_PROMOVER).toContain("distribuirPedido(");
    expect(ROTA_PROMOVER).toContain("requireAdmin");
    expect(ROTA_REDISTRIBUIR).toContain("distribuirPedido(");
    expect(ROTA_REDISTRIBUIR).toContain("requireAdmin");
  });

  it("o email do link ao cliente continua a sair na hora", () => {
    // A análise trava a publicação aos profissionais, não a relação com o
    // cliente: ele recebe o link do pedido dele imediatamente.
    expect(ROTA_CLIENTE).toContain("enviarLinkDoPedido");
  });
});
