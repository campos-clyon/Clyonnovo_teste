import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Quem já tem um pedido a andar não está «a meio» de nada.
 *
 * "Os clientes estão a reclamar que recebem muitas informações e que ficam
 * confusos (…) enviar mensagens mais precisas, sem spam." — 17-09-2026.
 *
 * A insistência das recolhas paradas olhava só para a tabela delas e
 * perguntava uma coisa: esta conversa não chegou a criar um pedido. O que não
 * via é que a pessoa pode ter criado o pedido POR OUTRO CAMINHO — pelo site,
 * pelo telefone, pelo backoffice.
 *
 * O João Martins tinha uma recolha antiga por acabar no WhatsApp e o pedido
 * #322 contratado e marcado para a manhã seguinte. No mesmo dia recebeu
 * «ficámos a meio do seu pedido, continue de onde parámos» e, horas depois,
 * «se entretanto já não precisa, não se preocupe em responder» — sobre um
 * trabalho que estava agendado.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const DB = ler("src/lib/db.ts");

describe("a insistência pergunta primeiro se há pedido", () => {
  const consulta = DB.slice(
    DB.indexOf("export async function listarRecolhasWhatsAppEmCurso"),
    DB.indexOf("export async function podeOWhatsAppFalarCom"),
  );

  it("continua a só olhar para recolhas que não criaram pedido", () => {
    expect(consulta).toContain("r.pedidoId IS NULL");
  });

  it("e salta quem tem um pedido vivo com o mesmo número", () => {
    expect(consulta).toContain("NOT EXISTS");
    expect(consulta).toContain("FROM simulatorOrders o");
  });

  it("compara pelos últimos 9 dígitos, como o resto do WhatsApp", () => {
    /*
     * O mesmo critério de `pedidosDoTelefone`. Dois critérios diferentes para
     * a mesma pergunta acabam sempre a discordar — e aqui discordar quer dizer
     * escrever a alguém que não devia receber nada.
     */
    expect(consulta).toContain("RIGHT(REGEXP_REPLACE(COALESCE(o.contactPhone, ''), '[^0-9]', ''), 9)");
    expect(consulta).toContain("RIGHT(REGEXP_REPLACE(r.telefone, '[^0-9]', ''), 9)");
  });

  it("um pedido cancelado ou arquivado não trava a insistência", () => {
    // Esses não são trabalho a andar: quem cancelou pode estar mesmo a meio
    // de pedir outra coisa.
    expect(consulta).toContain("o.status NOT IN ('cancelado', 'arquivado')");
  });
});
