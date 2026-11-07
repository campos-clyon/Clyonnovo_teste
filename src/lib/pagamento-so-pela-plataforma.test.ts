import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerMotivoDosDadosDoDono, mensagemDeAdjudicacao } from "./mensagem-de-adjudicacao";
import { oQueNaoPodeIr } from "./valores-para-pagamento";
import { perguntasDoProfissional, PERGUNTAS_DO_PROFISSIONAL } from "./ajuda-plataforma";
import { DIAS_PARA_PAGAR_A_DIVIDA } from "./divida-do-profissional";
import { ABERTURA_DO_QUE_FALTA } from "./mensagem-do-que-falta";
import { MENSAGEM_DE_PASSAR_A_UMA_PESSOA } from "./voz-da-vitoria";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { assistenteComSeccoesPodeChamar } from "./papel-do-painel";

/**
 * PAGAMENTO SÓ PELA PLATAFORMA — d15 (03-11-2026, aprovada pelo dono a 04-11).
 *
 * O bloco «Métodos de pagamento» das Configs (dados de uma pessoa) saía por
 * omissão no «Enviar adjudicação». Desde hoje o link do pedido vem marcado, os dados do
 * dono desmarcados e só com motivo; e a ajuda do parceiro diz o que fazer ao
 * dinheiro recebido em mão. E duas frases ao cliente deixam de prometer o que
 * não acontece.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

// Valores inventados: nenhum destes dados existe.
const DADOS_DO_DONO = "MB WAY: 912 345 678\nIBAN: PT50 0000 0000 0000 0000 0000 0\nRevolut: @exemplo";
const AGORA = new Date("2026-11-03T15:00:00Z");
const TRABALHO = { cliente: "Marta", quando: null, servico: "recolha_monos", localidade: "Lisboa", empresa: "Empresa Exemplo" };

describe("a mensagem de adjudicação por omissão", () => {
  it("sem formas escolhidas, os dados do dono nunca entram — mesmo escritos nas Configs", () => {
    const m = mensagemDeAdjudicacao({ ...TRABALHO, metodosDePagamento: DADOS_DO_DONO }, AGORA);
    expect(m).not.toMatch(/\bIBAN\b/i);
    expect(m).not.toMatch(/revolut/i);
    expect(oQueNaoPodeIr(m)).toBeNull();
    expect(m).toContain("Enviamos-lhe os dados para o pagamento a seguir.");
  });

  it("com a escolha por omissão do botão (o link do pedido), paga-se pela plataforma, sem dados de pessoas", () => {
    const m = mensagemDeAdjudicacao(
      {
        ...TRABALHO,
        metodosDePagamento: DADOS_DO_DONO,
        formas: { comDadosDoDono: false, referencias: [], link: "https://clyon.pt/pedido/abc?pagar=1" },
      },
      AGORA,
    );
    expect(m).toContain("Pode pagar por MB WAY, por Multibanco ou por transferência, no seu pedido:\nhttps://clyon.pt/pedido/abc?pagar=1");
    expect(m).toContain("Paga à CLYON, que só paga ao parceiro depois de o trabalho estar feito.");
    expect(m).not.toMatch(/\bIBAN\b|revolut/i);
    expect(oQueNaoPodeIr(m)).toBeNull();
  });

  it("os dados do dono só entram com um motivo escrito", () => {
    const sem = mensagemDeAdjudicacao(
      { ...TRABALHO, metodosDePagamento: DADOS_DO_DONO, formas: { comDadosDoDono: true, referencias: [] } },
      AGORA,
    );
    expect(sem).not.toContain("Revolut");
    const curto = mensagemDeAdjudicacao(
      { ...TRABALHO, metodosDePagamento: DADOS_DO_DONO, formas: { comDadosDoDono: true, motivoDosDadosDoDono: "x", referencias: [] } },
      AGORA,
    );
    expect(curto).not.toContain("Revolut");
    const com = mensagemDeAdjudicacao(
      {
        ...TRABALHO,
        metodosDePagamento: DADOS_DO_DONO,
        formas: { comDadosDoDono: true, motivoDosDadosDoDono: "O cliente não tem MB WAY nem homebanking", referencias: [] },
      },
      AGORA,
    );
    expect(com).toContain("Revolut: @exemplo");
    expect(lerMotivoDosDadosDoDono("   ").ok).toBe(false);
    expect(lerMotivoDosDadosDoDono("Pediu transferência").ok).toBe(true);
  });
});

describe("o botão «Enviar adjudicação»", () => {
  const BOTAO = ler("src/components/admin/EnviarAdjudicacao.tsx");
  const ROTA = ler("src/app/api/admin/negociacoes/adjudicacao/route.ts");

  it("o link do pedido vem marcado; os dados do dono, desmarcados", () => {
    expect(BOTAO).toContain("const [comLink, setComLink] = useState(true);");
    expect(BOTAO).toContain("const [doDono, setDoDono] = useState(false);");
    expect(BOTAO).not.toContain("useState(temDadosDoDono)");
  });

  it("com os dados do dono, pede o motivo e não prepara sem ele", () => {
    expect(BOTAO).toContain("Motivo de não ir pela plataforma (obrigatório)");
    expect(BOTAO).toContain("(comDono && !motivoValido)");
  });

  it("o servidor gera o link (como na d19, a abrir no pagamento) e guarda o motivo no histórico", () => {
    expect(ROTA).toContain("linkParaQuemFechou(pedidoId");
    expect(ROTA).toContain("linkParaPagar(gerado)");
    expect(ROTA).toContain("lerMotivoDosDadosDoDono(corpo.motivoDosDadosDoDono)");
    expect(ROTA).toContain("Adjudicação com os dados de pagamento do dono (Configs), e não pela plataforma. Motivo:");
    expect(ROTA).not.toContain("enviarTexto");
  });

  it("abre-se a quem tem a Mesa ou os Trabalhos CLYON, e a mais ninguém", () => {
    const rota = "/api/admin/negociacoes/adjudicacao";
    expect(assistenteComSeccoesPodeChamar(["negociacoes_clyon"], rota, "POST")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(["trabalhos_clyon"], rota, "POST")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(["pagamentos", "whatsapp"], rota, "POST")).toBe(false);
  });
});

describe("«Recebi em dinheiro: e agora?» na Ajuda do painel e da app Pro", () => {
  const p = PERGUNTAS_DO_PROFISSIONAL.find((x) => x.pergunta === "Recebi em dinheiro: e agora?");

  it("está na lista que o painel e a app lêem, com os cinco pontos e o exemplo", () => {
    expect(p).toBeDefined();
    expect(perguntasDoProfissional({ cliente: 0, profissional: 0.11 }).some((x) => x.pergunta === p!.pergunta)).toBe(true);
    const linhas = p!.resposta.split("\n");
    expect(linhas.slice(0, 5).map((l) => l.slice(0, 2))).toEqual(["1.", "2.", "3.", "4.", "5."]);
    expect(linhas[5]).toMatch(/^Exemplo/);
  });

  it("diz por onde se paga, com os nomes dos botões da Carteira, e os dias do prazo", () => {
    expect(p!.resposta).toContain("Carteira › Pagamentos em dinheiro");
    expect(p!.resposta).toContain("«Pagar por MB WAY» ou «Gerar referência Multibanco»");
    expect(p!.resposta).toContain(`Tem ${DIAS_PARA_PAGAR_A_DIVIDA} dias`);
    for (const botao of ["Pagar por MB WAY", "Gerar referência Multibanco", "Pagamentos em dinheiro"]) {
      expect(ler("src/app/profissionais/painel/Carteira.tsx")).toContain(botao);
      expect(ler("app-pro/src/app/(app)/carteira.tsx")).toContain(botao);
    }
  });

  it("a conta do exemplo bate: 100 € + IVA, 11 % de taxa", () => {
    expect(p!.resposta).toContain("Exemplo, num pedido com a taxa de 11 %: proposta de 100 € + IVA. O cliente paga-lhe 123 €");
    expect(p!.resposta).toContain("fica com 89 €");
    expect(p!.resposta).toContain("entrega 34 € à CLYON (23 € de IVA e 11 € de taxa)");
  });

  it("o recibo verde não é parecer: remete para a CLYON ou para o contabilista", () => {
    expect(p!.resposta).toContain("fale com a CLYON ou com o seu contabilista");
  });

  it("o painel mostra as linhas partidas", () => {
    expect(ler("src/app/profissionais/painel/Ajuda.tsx")).toContain('<span className="whitespace-pre-line">{p.resposta}</span>');
  });
});

describe("as duas frases ao cliente que prometiam o que não acontece", () => {
  it("o que falta no pedido vai aos parceiros da sua zona, e não aos profissionais", () => {
    expect(ABERTURA_DO_QUE_FALTA).toBe("Para enviar o seu pedido aos parceiros da sua zona, falta:");
    const rota = ler("src/app/api/admin/pedidos/[id]/o-que-falta/route.ts");
    expect(rota).toContain("[ABERTURA_DO_QUE_FALTA, ...faltas");
    expect(rota).not.toContain("aos profissionais");
  });

  it("a Vitória passa a uma pessoa da CLYON, sem prometer «já de seguida»", () => {
    expect(MENSAGEM_DE_PASSAR_A_UMA_PESSOA).toBe(
      "Percebi o que me disse. Vou passar isto a uma pessoa da CLYON, que lhe responde por aqui (de segunda a sábado, das 8h às 20h).",
    );
    const negociacao = ler("src/lib/whatsapp-negociacao.ts");
    expect(negociacao).toContain("mensagem = MENSAGEM_DE_PASSAR_A_UMA_PESSOA,");
    expect(negociacao).not.toContain("um colega para confirmar tudo consigo, e ele fala-lhe já de seguida");
  });

  it("com a tradução fixa nas três línguas", () => {
    expect(traducaoFixa(MENSAGEM_DE_PASSAR_A_UMA_PESSOA, "en")).toBe(
      "I understood what you told me. I'll pass this to a person from CLYON, who will reply to you here (Monday to Saturday, 8am to 8pm).",
    );
    expect(traducaoFixa(MENSAGEM_DE_PASSAR_A_UMA_PESSOA, "fr")).toContain("du lundi au samedi, de 8h à 20h");
    expect(traducaoFixa(MENSAGEM_DE_PASSAR_A_UMA_PESSOA, "es")).toContain("de lunes a sábado, de 8:00 a 20:00");
  });
});
