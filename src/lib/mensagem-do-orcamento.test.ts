import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  eurosCurtos,
  extraComPreco,
  extraNoLocal,
  INCLUI,
  linhasDoOrcamento,
  mensagemDoOrcamento,
  PAGA_A_CLYON_NO_MODELO_ANTIGO,
  PAGA_AO_PARCEIRO,
  TAMANHO_MAXIMO_DO_ORCAMENTO,
  valorComIva,
  zonaCurta,
  type DadosDoOrcamento,
} from "./mensagem-do-orcamento";
import { mensagemDaPropostaClyon, precoDaPropostaClyon } from "./proposta-clyon-ao-cliente";
import { mensagemDoValorUnico } from "./valor-unico";
import { PRECO_POR_ITEM, PRECO_POR_SACO } from "./precos-publicos";
import { PRECO_POR_HORA } from "./tabela-das-mudancas";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";

/**
 * A MENSAGEM DO ORÇAMENTO, CURTA — 15-11-2026 (decisão d47).
 *
 * O #623: o «Enviar pela CLYON» saiu duas vezes (português e inglês), e longa.
 * Guarda-se: uma só língua por envio; as quatro partes; o tamanho; o extra com preço.
 */

// 21h40 em Lisboa — «Boa noite».
const NOITE = new Date("2026-11-15T21:40:00Z");

const DO_623: DadosDoOrcamento = {
  cliente: "Jason",
  servicoComArtigo: "a recolha de monos",
  servicoId: "recolha_monos",
  localidade: "Campo de Ourique Lisboa",
  semIva: 105,
  total: 129.15,
  base: "total",
  modelo: "clyon",
};

/** O tamanho sem o nome, o serviço e a zona — é isso que o tecto mede. */
function semOsVariaveis(m: string, ...partes: string[]): number {
  let t = m;
  for (const p of partes) t = t.split(p).join("");
  return t.length;
}

describe("as quatro partes", () => {
  it("o exemplo aprovado pelo dono, letra a letra", () => {
    expect(mensagemDoOrcamento(DO_623, NOITE)).toBe(
      [
        "Boa noite, Jason! O orçamento para a recolha de monos em Campo de Ourique é 105 € + IVA = 129,15 €.",
        // Texto do Vendas desde 17-11-2026 (d66): o que ganha, o extra combinado antes, e sem emoji.
        `Inclui o que está nas fotografias e na descrição. O parceiro carrega e leva tudo: não tem de mexer em nada. O que aparecer a mais combina-se consigo antes de carregar, pela tabela (peça pequena ${PRECO_POR_ITEM.pequeno} €, média ${PRECO_POR_ITEM.medio} €, grande 65 € a primeira e ${PRECO_POR_ITEM.grande} € as seguintes, + IVA).`,
        "Paga à CLYON depois do trabalho feito.",
        "Responda SIM e reservamos o parceiro; o dia combina-se consigo.",
      ].join("\n"),
    );
  });

  it("(a) o valor nunca vai sem IVA sozinho", () => {
    expect(valorComIva(105, 129.15)).toBe("105 € + IVA = 129,15 €");
    expect(valorComIva(282, 346.86)).toBe("282 € + IVA = 346,86 €");
    expect(eurosCurtos(1230)).toBe("1 230 €");
    // Sem fatura: o total, que é o que se paga.
    expect(valorComIva(100, 100)).toBe("100 €");
  });

  it("(c) o extra tem preço em cada serviço que o tem", () => {
    expect(extraNoLocal("recolha_moveis")).toContain(`peça pequena ${PRECO_POR_ITEM.pequeno} €`);
    expect(extraNoLocal("recolha_monos")).toContain(`grande 65 € a primeira e ${PRECO_POR_ITEM.grande} € as seguintes, + IVA`); // d63: a primeira grande a 65 €, as seguintes a 50 €.
    // O esvaziamento e a mudança têm a regra deles, não a tabela das peças.
    expect(extraNoLocal("esvaziamento_casa")).toContain("volume a mais");
    expect(extraNoLocal("esvaziamento_casa")).not.toContain("peça");
    expect(extraNoLocal("mudanca")).not.toContain("peça");
    expect(extraNoLocal("recolha_entulho")).toContain(PRECO_POR_SACO.minimo.toFixed(2).replace(".", ","));
    expect(extraNoLocal("recolha_entulho")).toContain("por saco");
    // O preço por hora é o do parceiro da lista (d7) — não o da referência.
    expect(extraNoLocal("mudanca")).toContain("preço por hora do parceiro");
    expect(extraNoLocal("mudanca")).not.toContain(`${PRECO_POR_HORA} €`);
    expect(extraNoLocal("mudanca", "hora")).toContain("mesmo preço por hora");
    expect(extraNoLocal("recolha_moveis", "carga")).toContain("mesmo preço por carga");
    for (const s of ["recolha_moveis", "recolha_monos", "recolha_entulho", "mudanca"]) {
      const e = extraNoLocal(s);
      expect(extraComPreco(e), s).toBe(true);
      expect(e).toMatch(/combinad[ao]s? consigo antes|combina-se consigo antes/); // d66: sempre combinado antes.
    }
  });

  it("(d) como se paga, pelo modelo do trabalho", () => {
    expect(linhasDoOrcamento(DO_623, NOITE)[2]).toBe(PAGA_A_CLYON_NO_MODELO_ANTIGO);
    expect(linhasDoOrcamento({ ...DO_623, modelo: "parceiro" }, NOITE)[2]).toBe(PAGA_AO_PARCEIRO);
    expect(linhasDoOrcamento({ ...DO_623, modelo: "valor_unico" }, NOITE)[2]).toContain("parceiro verificado da sua zona");
  });

  it("a zona sem o «Lisboa» colado do simulador", () => {
    expect(zonaCurta("Campo de Ourique Lisboa")).toBe("Campo de Ourique");
    expect(zonaCurta("Lisboa")).toBe("Lisboa");
    expect(zonaCurta("Amadora")).toBe("Amadora");
    expect(zonaCurta(null)).toBeNull();
  });
});

describe("curta: o tecto", () => {
  it(`≤ ${TAMANHO_MAXIMO_DO_ORCAMENTO} caracteres sem o nome, o serviço e a zona — em todos os serviços e bases`, () => {
    for (const servicoId of ["recolha_moveis", "recolha_monos", "recolha_entulho", "esvaziamento_casa", "mudanca", "manutencao_casa"]) {
      for (const base of ["total", "carga", "hora"] as const) {
        for (const modelo of ["clyon", "parceiro", "valor_unico"] as const) {
          const m = mensagemDoOrcamento({ ...DO_623, servicoId, base, modelo }, NOITE);
          expect(semOsVariaveis(m, "Jason", "a recolha de monos", "Campo de Ourique"), `${servicoId}/${base}/${modelo}`).toBeLessThanOrEqual(
            TAMANHO_MAXIMO_DO_ORCAMENTO,
          );
        }
      }
    }
  });
});

describe("as mensagens que mandam valores usam as quatro partes", () => {
  it("o «Enviar proposta» / «Enviar pela CLYON» de um Trabalho CLYON", () => {
    const preco = precoDaPropostaClyon({ valorFixo: 105, taxa: 0.1, precoAoCliente: null })!;
    const m = mensagemDaPropostaClyon(
      { cliente: "Jason", servico: "recolha_monos", localidade: "Campo de Ourique Lisboa", quando: null, preco, base: "total" },
      NOITE,
    );
    expect(m).toContain("105 € + IVA = 129,15 €");
    expect(m).toContain(INCLUI);
    expect(m).toContain("O que aparecer a mais combina-se consigo antes de carregar, pela tabela");
    expect(m).toContain(PAGA_A_CLYON_NO_MODELO_ANTIGO);
    expect(m.split("\n")).toHaveLength(4);
  });

  it("o valor único (d39) — WhatsApp e email", () => {
    const m = mensagemDoValorUnico(
      { nomeCliente: "Jason", servico: "recolha de monos", servicoId: "recolha_monos", cidade: "Lisboa", valorSemIva: 105, base: "total" },
      NOITE,
    );
    expect(m).toContain("105 € + IVA = 129,15 €");
    expect(m).toContain(INCLUI);
    expect(m).toContain("parceiro verificado da sua zona");
    expect(m).not.toMatch(/\n\n/);
  });

  it("a adjudicação e a lista das propostas dizem o que cobre e o extra", () => {
    const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(ler("src/lib/mensagem-de-adjudicacao.ts")).toContain("`${INCLUI} ${extraNoLocal(t.servico ?? null)}`");
    expect(ler("src/lib/mensagem-de-adjudicacao.ts")).toContain("valorComIva(n.semIva, n.total)");
    expect(ler("src/lib/mensagem-das-propostas.ts")).toContain("`${INCLUI} ${extraNoLocal(d.servicoId ?? null, base)}`");
  });
});

describe("uma só língua por envio", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("os links do WhatsApp do backoffice levam o texto já na língua do cliente", () => {
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain("abrirWhatsAppNaLingua(t.telefone, proposta.texto, token)");
    expect(ler("src/components/admin/EnviarAdjudicacao.tsx")).toContain("abrirWhatsAppNaLingua(adjudicacao.telefone");
    const painel = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(painel).toContain('fetch("/api/admin/whatsapp/na-lingua"');
    expect(painel).toContain("abrirWhatsAppNaLingua(telefone, mensagem, token)");
    const rota = ler("src/app/api/admin/whatsapp/na-lingua/route.ts");
    expect(rota).toContain("traduzirParaOCliente(texto, lingua)");
    expect(rota).toContain("linguaDoNumero(telefone)");
  });

  it("o canal manda UMA mensagem, traduzida — e não o português e a tradução", () => {
    const cloud = ler("src/lib/whatsapp-cloud.ts");
    const canal = cloud.slice(cloud.indexOf("async function enviarTextoPorCanal("), cloud.indexOf("export async function enviarTextoWhatsApp("));
    // Um só envio por chamada (meta, ponte ou fila), sempre com o texto já na língua dele.
    expect(canal.match(/saiu = await (enviar|porNaFila)\(/g)?.length).toBe(2);
    expect(canal).toContain("naLinguaDoCliente(para, emPortugues)");
  });

  it("mandar outra vez a proposta, há pouco enviada, pede confirmação", () => {
    for (const p of ["src/app/api/admin/negociacoes/route.ts", "src/app/api/admin/trabalhos-clyon/route.ts"]) {
      const r = ler(p);
      expect(r, p).toContain("minutosDesdeAPropostaEnviada(pedidoId)");
      expect(r, p).toContain("jaEnviada: true");
    }
  });

  it("as frases novas têm tradução fixa em inglês, francês e espanhol", () => {
    for (const lingua of ["en", "fr", "es"] as const) {
      const m = mensagemDoOrcamento(DO_623, NOITE);
      const t = traducaoFixa(m, lingua);
      expect(t, lingua).not.toBeNull();
      expect(t, lingua).toContain("129,15");
      expect(t, lingua).not.toContain("Inclui o que está");
    }
  });
});
