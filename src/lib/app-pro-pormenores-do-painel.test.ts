import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cincoPorAbrir, type Trabalho } from "../../app-pro/src/lib/trabalhos";

/**
 * OS PORMENORES DO PAINEL NA APP — 21-10-2026.
 *
 * O dono escolheu «Pormenores do painel» para depois da versão 13. As frases
 * vêm do painel; cada teste lê os dois lados e exige o mesmo. Com a 13
 * instalada, isto chega aos telemóveis pelo EAS Update, sem passar pela loja.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\s+/g, " ");
const NEGOCIACAO = ler("src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx");
const DETALHE = ler("app-pro/src/app/trabalho/[id].tsx");

function novo(id: number, actualizadoEm: string, abertoEm: string | null = null): Trabalho {
  return { negociacaoId: id, estado: "aberta", propostas: null, arquivadoEm: null, abertoEm, actualizadoEm } as unknown as Trabalho;
}

describe("«Novo» só nos cinco mais recentes por abrir", () => {
  it("é a regra do painel: dos Novos, por abrir, os cinco actualizados há menos tempo", () => {
    const lista = [
      ...Array.from({ length: 7 }, (_, i) => novo(i + 1, `2026-10-2${i % 2}T1${i}:00:00Z`)),
      novo(99, "2026-10-21T23:00:00Z", "2026-10-21T23:30:00Z"),
    ];
    const marcados = cincoPorAbrir(lista);
    expect(marcados.size).toBe(5);
    expect(marcados.has(99)).toBe(false);
    const painel = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(painel).toContain(".slice(0, 5)");
    expect(ler("app-pro/src/app/(app)/index.tsx")).toContain("porAbrir={porAbrir.has(item.trabalho.negociacaoId)}");
  });
});

describe("as frases do painel na negociação", () => {
  it("o trabalho CLYON diz se foi escolhido ou oferecido a mais, e como acabou", () => {
    for (const frase of [
      "A CLYON escolheu-o para este trabalho. Se aceitar, é seu — a morada e o contacto do cliente aparecem logo.",
      "Foi oferecido a mais profissionais. Se aceitar, fica na lista de quem o quer; a CLYON escolhe e avisa-o.",
      "Deseja aceitar este trabalho? Não há propostas: só aceitar ou recusar.",
      "Este trabalho foi cancelado pela CLYON",
      "A CLYON escolheu outro profissional",
      "Recusou este trabalho",
      "Aceitou — a CLYON vai escolher",
      "A CLYON escolhe entre os profissionais que aceitaram, e avisa-o se for o escolhido.",
    ]) {
      expect(NEGOCIACAO).toContain(frase);
      expect(DETALHE).toContain(frase);
    }
  });

  it("à espera do cliente, o pagamento em mão, e as propostas gastas", () => {
    expect(NEGOCIACAO).toContain("cliente confirmar que o contrata — pode estar a falar com mais profissionais.");
    expect(DETALHE).toContain("Falta o cliente confirmar que o contrata — pode estar a falar com mais profissionais.");
    expect(NEGOCIACAO).toContain('{emMao ? " em mão" : ""}');
    expect(DETALHE).toContain('t.formaDePagamento === "dinheiro" ? " em mão" : ""');
    expect(NEGOCIACAO).toContain("propostas. Só pode aceitar o que está em cima da mesa ou desistir.");
    expect(DETALHE).toContain("propostas. Só pode aceitar o que está em cima da mesa ou desistir.");
    expect(NEGOCIACAO).toContain("A negociação é só de valores. Sem conversa não há combinação por fora");
    expect(DETALHE).toContain("a negociação é só de valores. Sem conversa não há combinação por fora");
  });
});

describe("a dívida à entrada e o arquivar na agenda", () => {
  it("a dívida que fecha os trabalhos em dinheiro aparece nos Trabalhos e leva à carteira", () => {
    expect(ler("src/app/profissionais/painel/PainelDoProfissional.tsx")).toContain("carteira.bloqueioEmDinheiro.explicacao");
    const LISTA = ler("app-pro/src/app/(app)/index.tsx");
    expect(LISTA).toContain("carteira.bloqueioEmDinheiro.explicacao");
    expect(LISTA).toContain('router.push("/carteira")');
  });

  it("a agenda tem «Arquivar — o cliente não responde», com a pergunta do painel", () => {
    expect(ler("src/app/profissionais/painel/Agenda.tsx")).toContain("Arquivar — o cliente não responde");
    const AGENDA = ler("app-pro/src/app/(app)/agenda.tsx");
    expect(AGENDA).toContain("Arquivar — o cliente não responde");
    expect(AGENDA).toContain("perguntaAntesDeArquivar(t)");
    expect(AGENDA).toContain('"/api/profissionais/arquivar"');
  });
});

describe("pronto para o iPhone", () => {
  it("os formulários sobem acima do teclado", () => {
    for (const f of [
      "app-pro/src/app/conta/perfil.tsx",
      "app-pro/src/app/conta/servicos.tsx",
      "app-pro/src/app/conta/faturacao.tsx",
      "app-pro/src/app/conta/banco.tsx",
      "app-pro/src/app/conta/palavra-passe.tsx",
      "app-pro/src/app/conta/ajuda.tsx",
      "app-pro/src/app/trabalho/[id].tsx",
      "app-pro/src/app/(app)/carteira.tsx",
    ]) {
      expect(ler(f)).toContain("<ScrollView automaticallyAdjustKeyboardInsets");
    }
  });

  it("o caminho das definições é o de cada telemóvel", () => {
    const FOTOS = ler("app-pro/src/componentes/Fotografias.tsx");
    expect(FOTOS).toContain('Platform.OS === "ios" ? "em Definições › CLYON Pro" : "em Definições › Aplicações › CLYON Pro"');
    expect(FOTOS).not.toContain("telemóvel, em Aplicações › CLYON Pro");
  });
});
