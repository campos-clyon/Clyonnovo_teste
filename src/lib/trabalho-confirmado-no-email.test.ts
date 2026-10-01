import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { carteiraDe, destinoDoValorConcluido, type TrabalhoNaCarteira } from "./carteira";
import { textoDoTrabalhoConfirmado } from "./email-proposta";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";

/**
 * O EMAIL DO «TRABALHO CONFIRMADO» DIZ ONDE ESTÁ O DINHEIRO — 29-09-2026.
 *
 * Dizia sempre «ficaram disponíveis na sua carteira — pode pedir a
 * transferência quando quiser». Há três casos, e só um é esse:
 *
 *   · pago pela plataforma → disponível, e o levantamento é tratado em menos de
 *     24 horas;
 *   · confirmado mas o cliente ainda não pagou → passa para a carteira
 *     quando o pagamento entrar; prometer-lhe a transferência era a CLYON a
 *     oferecer dinheiro que não recebeu;
 *   · pago em dinheiro, no local → não há nada a transferir.
 *
 * E quem decide qual é a CARTEIRA, com as mesmas regras (`foiPagoEmMao`,
 * `oClientePagou`), para o email nunca dizer outra coisa do que o painel.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (t: string) =>
  t.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const agora = new Date("2026-09-29T12:00:00Z");
const ontem = new Date(agora.getTime() - 86_400_000);

const trabalho = (p: Partial<TrabalhoNaCarteira>): TrabalhoNaCarteira => ({
  negociacaoId: 1,
  estado: "acordada",
  valorAcordado: 200,
  execucaoEnviadaEm: ontem,
  confirmadoEm: ontem,
  ...p,
});

/*
 * O mundo em que a carteira pergunta à base quem pagou. Passa-se à mão, como
 * em `carteira.test.ts`, para se provar sem mexer no interruptor de hoje.
 */
const COBRA = { aPlataformaCobra: true } as const;

describe("para onde vai o valor de um trabalho dado por concluído", () => {
  it("em dinheiro, está em mão — e isso decide-se antes de tudo", () => {
    expect(destinoDoValorConcluido(trabalho({ formaDePagamento: "dinheiro" }), COBRA)).toBe("em_mao");
    expect(destinoDoValorConcluido(trabalho({ formaDePagamento: "dinheiro" }))).toBe("em_mao");
  });

  it("pela plataforma e por pagar, fica por cobrar", () => {
    expect(destinoDoValorConcluido(trabalho({}), COBRA)).toBe("por_cobrar");
  });

  it("pago, fica disponível", () => {
    expect(destinoDoValorConcluido(trabalho({ clientePagouEm: ontem }), COBRA)).toBe("disponivel");
  });

  it("é a mesma resposta que a carteira dá, caso a caso", () => {
    for (const t of [
      trabalho({ formaDePagamento: "dinheiro" }),
      trabalho({}),
      trabalho({ clientePagouEm: ontem }),
    ]) {
      const c = carteiraDe([t], [], agora, COBRA);
      const destino = destinoDoValorConcluido(t, COBRA);
      expect({
        emMao: c.recebidoEmMao > 0,
        porCobrar: c.porCobrar > 0,
        disponivel: c.disponivel > 0,
      }).toEqual({
        emMao: destino === "em_mao",
        porCobrar: destino === "por_cobrar",
        disponivel: destino === "disponivel",
      });
    }
  });

  it("com o interruptor como está, o email e a carteira continuam a concordar", () => {
    /*
     * Enquanto `A_PLATAFORMA_COBRA` for falso, a carteira não pergunta pelos
     * pagamentos (os trabalhos anteriores a 17-09-2026 foram pagos em mão sem
     * registo, e o que fazer com eles é decisão do dono). O email segue-a: o
     * que ela mostrar como disponível, ele diz disponível.
     */
    const t = trabalho({});
    expect(destinoDoValorConcluido(t)).toBe("disponivel");
    expect(carteiraDe([t], [], agora).disponivel).toBeGreaterThan(0);
  });
});

describe("o email diz o que é verdade em cada caso", () => {
  const liquido = quantoOProfissionalRecebe(200);

  it("disponível: na carteira, e o levantamento tratado em menos de 24 horas", () => {
    const t = textoDoTrabalhoConfirmado({ pedidoId: 7, liquido, destino: "disponivel" });
    expect(t.assunto).toBe("Trabalho #7 confirmado — 188,00 € na sua carteira");
    expect(t.corpo).toContain("ficaram disponíveis na sua carteira");
    expect(t.corpo).toContain("o pedido de levantamento é tratado em menos de 24 horas");
  });

  it("por cobrar: passa para a carteira quando o pagamento do cliente entrar", () => {
    const t = textoDoTrabalhoConfirmado({ pedidoId: 7, liquido, destino: "por_cobrar" });
    expect(t.corpo).toContain("passam para a sua carteira assim que o pagamento do cliente entrar");
    expect(t.corpo).not.toContain("disponíveis");
    expect(t.corpo).not.toContain("Pode pedir a transferência");
    expect(t.assunto).not.toContain("na sua carteira");
  });

  it("em mão: foi pago no local, e não há nada a transferir", () => {
    const t = textoDoTrabalhoConfirmado({ pedidoId: 7, liquido: 200, destino: "em_mao" });
    expect(t.corpo).toContain("foi pago em dinheiro no local");
    expect(t.corpo).toContain("não há nada a transferir");
    expect(t.corpo).not.toContain("carteira");
    expect(t.botao).not.toContain("carteira");
    expect(t.assunto).toContain("pago em dinheiro, no local");
  });
});

describe("o aviso pergunta como a carteira pergunta", () => {
  it("usa a mesma conversão e a mesma regra, com as taxas da negociação", () => {
    const aviso = semComentarios(ler("src/lib/avisar-confirmacao.ts"));
    expect(aviso).toContain("trabalhosDaCarteira([n])");
    expect(aviso).toContain("destino: destinoDoValorConcluido(trabalho)");
    expect(aviso).toContain("taxas: taxasDaNegociacao(n),");
  });

  it("e o email não se manda sem saber o destino", () => {
    // Opcional, quem se esquecesse de o passar voltava a prometer a todos uma
    // transferência.
    const email = semComentarios(ler("src/lib/email-proposta.ts"));
    expect(email).toMatch(/destino: DestinoDoValor;/);
    expect(email).toContain("textoDoTrabalhoConfirmado({");
  });
});
