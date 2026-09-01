import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { A_PLATAFORMA_COBRA, PROMESSA, prazoAutomaticoPorExtenso, prazoDoEmailPorExtenso } from "./pagamento-na-plataforma";

/**
 * A PLATAFORMA NÃO PODE PROMETER DINHEIRO QUE NÃO GUARDA.
 *
 * Havia nove sítios a dizer que a CLYON recebia o dinheiro do cliente e o
 * guardava até à confirmação — a carteira dos dois lados, dois emails, a página
 * de recrutamento dos profissionais, duas perguntas frequentes do site público,
 * o ecrã do trabalho em curso e a mensagem de WhatsApp. Nenhum era verdade: não
 * existe cobrança nenhuma no projeto.
 *
 * A pior das nove era o cartão «Pagamento garantido» da página de inscrição.
 * Alguém decidia trabalhar connosco a partir dela.
 *
 * ESTE FICHEIRO É UM GUARDA, e existe porque a frase que se apaga hoje é
 * exactamente a que alguém volta a escrever daqui a três meses — de boa-fé, por
 * lhe parecer que descreve o modelo. Enquanto `A_PLATAFORMA_COBRA` for `false`,
 * nenhuma delas pode voltar ao código.
 *
 * NO DIA EM QUE A COBRANÇA EXISTIR, este teste desliga-se sozinho: as frases
 * passam a ser verdadeiras e deixam de ser proibidas. Não é preciso vir cá
 * apagar nada — basta o interruptor.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Todos os `.ts`/`.tsx` de produção — sem testes e sem a própria fonte. */
function ficheirosDeProducao(dir = "src", acc: string[] = []): string[] {
  for (const nome of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${nome}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) {
      ficheirosDeProducao(rel, acc);
    } else if (/\.tsx?$/.test(nome) && !nome.includes(".test.")) {
      acc.push(rel);
    }
  }
  return acc;
}

const PRODUCAO = ficheirosDeProducao().filter(
  (f) => !f.endsWith("lib/pagamento-na-plataforma.ts"),
);

/**
 * As frases proibidas enquanto não houver cobrança.
 *
 * São as literais que estavam mesmo no código, e não uma busca por «retido» —
 * a palavra é legítima noutros contextos, e um teste que apanha demais acaba
 * por ser desligado.
 */
const PROMESSAS_FALSAS = [
  "fica retido",
  "está retido na",
  "valor fica do lado da CLYON",
  "paga logo à CLYON",
  "liberta o pagamento",
  "pagamento foi libertado",
  "pagamento é libertado",
  "valor é libertado",
  "é libertado quando",
  "Pagamento garantido",
  "Valor cativo",
  "dinheiro ainda está cá",
];

describe("enquanto a CLYON não cobrar, não diz que cobra", () => {
  it("o interruptor está desligado — e é ele que manda em tudo o resto", () => {
    /*
     * Se este teste falhar porque alguém pôs `true`, a pergunta a fazer não é
     * sobre o teste: é se a cobrança existe mesmo. Ver a fase 1 do plano.
     */
    expect(A_PLATAFORMA_COBRA).toBe(false);
  });

  it("nenhuma das nove frases sobrevive em código de produção", () => {
    const reincidentes: string[] = [];
    for (const f of PRODUCAO) {
      const texto = ler(f);
      for (const frase of PROMESSAS_FALSAS) {
        if (texto.includes(frase)) reincidentes.push(`${f} → «${frase}»`);
      }
    }
    expect(reincidentes, `A promessa voltou em:\n${reincidentes.join("\n")}`).toEqual([]);
  });

  it("os nove sítios lêem a fonte única, em vez de terem texto próprio", () => {
    // Não chega apagar as frases: se o ecrã passar a ter texto escrito à mão
    // que diz o mesmo por outras palavras, volta-se ao princípio.
    const ligados = [
      "src/app/conta/components/Carteira.tsx",
      "src/app/profissionais/painel/Carteira.tsx",
      "src/app/pedido/[token]/PropostasRecebidas.tsx",
      "src/app/contactos/page.tsx",
      "src/app/profissionais/page.tsx",
      "src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx",
      "src/app/servicos/[slug]/page.tsx",
      "src/lib/email-trabalho.ts",
      "src/lib/mensagem-das-propostas.ts",
    ];
    for (const f of ligados) {
      expect(ler(f), `${f} não lê a fonte única`).toContain("pagamento-na-plataforma");
    }
  });
});

describe("o que se diz hoje descreve o que acontece", () => {
  it("ao cliente: paga ao profissional, e a CLYON guarda o acordo", () => {
    expect(PROMESSA.clienteCorpo).toContain("é a ele que o paga");
    expect(PROMESSA.clienteCorpo).toContain("não recebe esse dinheiro");
    expect(PROMESSA.clienteRotuloDoTotal).toBe("Combinado");
  });

  it("ao profissional: é o cliente que lhe paga, e o saldo é o que tem a receber", () => {
    /*
     * A distinção que este texto tem de fazer, e que a versão antiga não fazia:
     * um saldo que diz o que se tem a receber não é dinheiro guardado. Ele
     * decide se vai a um trabalho com esta frase na mão.
     */
    expect(PROMESSA.proCorpo).toContain("Quem lhe paga é o cliente");
    expect(PROMESSA.proCorpo).toContain("não dinheiro que esteja guardado");
    expect(PROMESSA.proRotuloDoCativo).toBe("Por receber");
  });

  it("no recrutamento: promete o acordo escrito, e não uma garantia", () => {
    expect(PROMESSA.recrutamentoTitulo).not.toContain("garantido");
    expect(PROMESSA.recrutamentoCorpo).toContain("acordado antes de sair de casa");
  });

  it("a confirmação fecha o trabalho, em vez de libertar dinheiro", () => {
    expect(PROMESSA.botaoDeConfirmar).toBe("Está bem feito, dar por concluído");
    expect(PROMESSA.depoisDeConfirmar).not.toContain("libertado");
  });

  it("a taxa da CLYON continua a ser dita — não desapareceu com a caução", () => {
    // Corrigir a promessa não podia virar esconder a comissão.
    expect(PROMESSA.proCorpo).toContain("taxa da CLYON descontada");
  });
});

describe("os prazos escrevem-se por extenso, e no singular certo", () => {
  it("um dia é «1 dia», dois são «2 dias»", () => {
    expect(prazoAutomaticoPorExtenso(1)).toContain("1 dia.");
    expect(prazoAutomaticoPorExtenso(2)).toContain("2 dias");
    expect(prazoDoEmailPorExtenso(1)).toContain("1 dia.");
    expect(prazoDoEmailPorExtenso(7)).toContain("7 dias");
  });

  it("meio dia arredonda para cima — nunca se anuncia menos prazo do que há", () => {
    // Dizer «0 dias» a quem ainda tem parte da tarde é apressá-lo sem razão.
    expect(prazoAutomaticoPorExtenso(0.2)).toContain("1 dia");
    expect(prazoAutomaticoPorExtenso(6.1)).toContain("7 dias");
  });

  it("nenhum dos dois fala de libertar pagamento", () => {
    expect(prazoAutomaticoPorExtenso(3)).not.toContain("libertado");
    expect(prazoDoEmailPorExtenso(3)).not.toContain("libertado");
  });
});
