import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O orçamento fecha-se à porta, e o valor combinado tem de poder mudar.
 *
 * "Me dê a opção de editar o valor, pois tem trabalhos que o orçamento é no
 * local e que muda — ex.: esse trabalho foi 230."
 *
 * O #242 foi combinado a 135 € e o trabalho foram 230. Sem esta rota, ou se
 * pagava 128,25 € de um trabalho de 218,50 €, ou se pagava por fora — e fora
 * da carteira o dinheiro deixa de aparecer em conta nenhuma.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ROTA = ler("src/app/api/admin/negociacoes/valor/route.ts");
const PAINEL = ler("src/components/admin/AdminCarteirasPanel.tsx");

describe("a rota que corrige o valor", () => {
  it("é do admin, e mais ninguém", () => {
    expect(ROTA).toContain("requireAdmin(req)");
    expect(ROTA).toContain("if (err) return err;");
  });

  it("só mexe no que já está fechado", () => {
    /*
     * Numa negociação a decorrer o valor muda-se PROPONDO — é isso que a
     * negociação é. Mexer no número por baixo, com os dois lados a responder
     * um ao outro, seria mudar as regras a meio do jogo.
     */
    expect(ROTA).toContain('linha.estado !== "acordada"');
    expect(ROTA).toContain("status: 409");
  });

  it("recusa um número que não seja um valor", () => {
    expect(ROTA).toContain("!Number.isFinite(valor) || valor <= 0");
  });

  it("tem tecto — um dedo a mais transforma 230 em 2300", () => {
    // O erro de tecla só apareceria na transferência, e aí já saiu dinheiro.
    expect(ROTA).toContain("valor > 100_000");
  });

  it("recusa gravar o mesmo valor", () => {
    // Um registo a dizer "corrigido de 135 para 135" é ruído no histórico.
    expect(ROTA).toContain("Math.abs(antigo - novo) < 0.005");
  });

  it("um trabalho JÁ PAGO exige motivo escrito", () => {
    /*
     * Depois da transferência o número deixou de ser uma combinação e passou a
     * ser um facto contabilístico. Ainda se corrige — um engano registado é
     * pior do que um engano corrigido — mas não em silêncio.
     */
    expect(ROTA).toContain("linha.pagoEm && !motivo");
    expect(ROTA).toContain("precisaMotivo: true");
  });

  it("refaz as contas a partir do valor, e não guarda cópias", () => {
    // Do valor acordado saem o que ele recebe, o que o cliente paga, o IVA e a
    // comissão. Guardar quatro números seria guardar quatro discordâncias.
    expect(ROTA).toContain("quantoOProfissionalRecebe(novo)");
    expect(ROTA).toContain("contaDoCliente(novo, regime)");
    expect(ROTA).toContain("regimeDeIva(linha.regimeIva)");
  });

  it("deixa rasto: o antes, o depois, quem mudou e porquê", () => {
    // Daqui a três meses ninguém se lembra porque é que 135 passaram a 230.
    expect(ROTA).toContain("appendOrderHistory");
    expect(ROTA).toContain('acontecimento: "valor_corrigido"');
    expect(ROTA).toContain("corrigido de ");
    expect(ROTA).toContain("por ${porQuem}");
  });

  it("o acontecimento existe no vocabulário do registo", () => {
    // Sem isto, o TypeScript deixa passar e a linha nunca é gravada.
    expect(ler("src/lib/db.ts")).toContain('| "valor_corrigido"');
  });
});

describe("o botão na carteira", () => {
  it("está ao lado do valor, nos dois montes", () => {
    // Por pagar e a decorrer: o orçamento tanto muda antes como depois de o
    // trabalho estar feito.
    expect(PAINEL.split("corrigir\n").length - 1).toBeGreaterThanOrEqual(2);
  });

  it("mostra a conta refeita ANTES de gravar", () => {
    // Ver o número antes de o fixar é o que evita gravar 2300 por engano.
    expect(PAINEL).toContain("Ele passa a receber");
  });

  it("fecha pelo botão, e não por um toque ao lado", () => {
    // Já se perdeu trabalho a meio por isso; aqui perde-se um número que se
    // acabou de acertar ao telefone.
    const i = PAINEL.indexOf("Corrigir o valor");
    const bloco = PAINEL.slice(i, i + 4000);
    expect(bloco).toContain("Fechar");
    expect(bloco).not.toContain("onClick={() => setACorrigir(null)}\n            className=\"fixed");
  });
});

describe("a mensagem ao profissional depois de ser contratado", () => {
  const TRABALHOS = ler("src/app/profissionais/painel/Trabalhos.tsx");

  it("pede-lhe para combinar o dia e a hora depressa", () => {
    /*
     * Ser contratado não é o fim de nada: é o princípio de um telefonema que
     * alguém tem de fazer. Sem isto, quem espera é sempre o cliente — que
     * acabou de pagar e não sabe quando é.
     */
    expect(TRABALHOS).toContain("O trabalho é seu — combine já");
    expect(TRABALHOS).toContain("o mais\n            depressa possível para acertar o dia e a hora");
  });

  it("manda tratar de valores com a CLYON, e não com o cliente", () => {
    // Um valor combinado de boca à porta fica fora da plataforma: sem registo,
    // sem dinheiro cativo, sem nada a que agarrar se houver discussão.
    expect(TRABALHOS).toContain("Valores fala sempre com a CLYON");
    expect(TRABALHOS).toContain("nunca directamente com o cliente");
  });

  it("diz-lhe o que fazer quando o orçamento muda no local", () => {
    // É o caso real que deu origem a tudo isto. Sem uma saída dita, ele
    // combina por fora — que é exactamente o que não pode acontecer.
    expect(TRABALHOS).toContain("Se o\n            orçamento mudar no local, diga-nos");
  });

  it("só aparece enquanto há trabalho por fazer", () => {
    // Depois de feito é ruído, e ruído repetido deixa de se ler.
    const i = TRABALHOS.indexOf("O trabalho é seu — combine já");
    expect(TRABALHOS.slice(Math.max(0, i - 400), i)).toContain(
      'fechado && pedido.fase === "a_executar"',
    );
  });
});
