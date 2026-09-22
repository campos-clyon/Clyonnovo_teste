import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ⚠️ O PAGAMENTO QUE CHEGOU E NINGUÉM VIU.
 *
 * *«A euPago não mostra se realmente foi feito.»* — 22-09-2026, com o
 * comprovativo da Caixa na mão: entidade 21921, referência 104295830, 42,00 €,
 * estado «Concluída». E o nosso ecrã a continuar a dizer «cobrar o cliente».
 *
 * Um pagamento chega-nos por um aviso do euPago. Das três coisas que acontecem
 * sempre a um webhook — chegar tarde, chegar duas vezes, não chegar — a pior é
 * a terceira, porque é SILENCIOSA: não há nenhum aviso a avisar que um aviso
 * não chegou. O cliente pagou, o dinheiro está lá, e o ecrã diz que não pagou.
 *
 * O que estes testes guardam é a forma da saída de emergência.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ROTA = "src/app/api/admin/pagamentos/conferir/route.ts";
const CRON = "src/app/api/cron/conferir-pagamentos/route.ts";

describe("perguntar ao euPago, à mão", () => {
  const CODIGO = semComentarios(ler(ROTA));

  it("é uma porta de administrador, como todas as outras deste lado", () => {
    expect(CODIGO).toContain("requireAdmin(req)");
    expect(CODIGO).toContain("trabalhoVistoPeloBackoffice(p.negociacaoId)");
  });

  /*
   * ⚠️ SÓ APANHA PAGAMENTOS; NUNCA FECHA NENHUM.
   *
   * Uma referência por pagar hoje pode ser paga amanhã. Fechá-la com base numa
   * consulta que talvez não tenhamos percebido seria inventar um desfecho — e
   * o desfecho inventado é o que deixa um cliente que pagou sem trabalho.
   */
  it("nunca fecha um pagamento — só o pode apanhar", () => {
    expect(CODIGO).toContain("darPorPago(");
    expect(CODIGO).not.toContain("fecharSemPagar");
    expect(CODIGO).not.toContain("marcarFalhado");
  });

  /*
   * A MESMA CONFERÊNCIA DE VALOR DO WEBHOOK. Uma referência antiga de um valor
   * que entretanto mudou continua a existir do lado deles: dar por pago um
   * trabalho de 105 € com uma consulta de 5 € é perder 100 € e ainda mandar o
   * profissional trabalhar.
   */
  it("confere o valor antes de creditar", () => {
    expect(CODIGO).toContain("0.011");
    const confere = CODIGO.indexOf("0.011");
    const credita = CODIGO.indexOf("darPorPago(");
    expect(confere).toBeLessThan(credita);
  });

  /*
   * A resposta em bruto volta sempre. A página do `multibanco/info` tem mais de
   * dois anos e não diz o nome do campo do estado — se ele disser «não» sobre
   * uma referência que sabemos paga, é por aqui que se descobre porquê.
   */
  it("devolve o que o euPago respondeu, para se perceber uma discordância", () => {
    expect(CODIGO).toContain("bruto");
  });

  it("um MB WAY não se consulta por referência, e isso diz-se", () => {
    expect(CODIGO).toContain("p.referencia");
    expect(ler(ROTA)).toContain("MB WAY");
  });
});

describe("a rede automática continua armada", () => {
  /*
   * O botão à mão não substitui a sondagem de hora a hora: quem carrega no
   * botão é alguém que já desconfia. O que apanha o pagamento de que ninguém
   * desconfiou é o cron.
   */
  it("a sondagem horária está registada na Vercel", () => {
    const vercel = JSON.parse(ler("vercel.json")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const cron = vercel.crons.find((c) => c.path === "/api/cron/conferir-pagamentos");
    expect(cron, "o cron de conferir pagamentos saiu do vercel.json").toBeTruthy();
    expect(cron!.schedule).toBeTruthy();
  });

  it("e falha fechada sem segredo — um endereço público não credita carteiras", () => {
    const codigo = semComentarios(ler(CRON));
    expect(codigo).toContain("CRON_SECRET");
    expect(codigo).toContain("status: 503");
  });

  it("as duas portas usam a mesma pergunta e a mesma chave de crédito", () => {
    for (const f of [ROTA, CRON]) {
      const codigo = semComentarios(ler(f));
      expect(codigo, f).toContain("estadoDaReferencia(conf.config");
      // `ref:<entidade>:<referencia>` — única por pagamento, e o `trid` do
      // aviso que vier depois não repete o crédito.
      expect(codigo, f).toContain("trid: `ref:${p.entidade ?? \"\"}:${p.referencia}`");
    }
  });
});

describe("o botão está no cartão de quem está a olhar", () => {
  const ECRA = ler("src/components/admin/GerarReferencia.tsx");
  const CODIGO = semComentarios(ECRA);

  it("pergunta ao servidor e não decide nada sozinho", () => {
    expect(CODIGO).toContain('"/api/admin/pagamentos/conferir"');
    expect(CODIGO).toContain("Já foi paga?");
  });

  it("só aparece onde há uma referência para consultar", () => {
    expect(CODIGO).toContain('mostrar.metodo === "multibanco" && mostrar.referencia');
  });

  /*
   * Um «ainda não» tem de dizer o que fazer a seguir. Sem isso, quem tem o
   * comprovativo à frente fica a olhar para uma frase que o contradiz.
   */
  it("um «ainda não» não é um beco", () => {
    expect(ECRA).toContain("comprovativo");
  });
});
