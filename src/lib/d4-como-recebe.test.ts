import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

/* O Resend de mentira: guarda o HTML que sairia, sem mandar nada a ninguém. */
const enviados: Array<{ subject: string; html: string }> = [];
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (m: { subject: string; html: string }) => {
        enviados.push({ subject: m.subject, html: m.html });
        return { error: null };
      },
    };
  },
}));
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLIENTE_AINDA_NAO_ESCOLHEU,
  comoRecebeNoNovoModelo,
  diaEMesEmLisboa,
  linhaDoValorAPassar,
} from "./como-recebe-no-novo-modelo";
import { estadoDoValorEmAtraso } from "./estado-do-valor-em-atraso";
import { COMO_PAGAR_EM_PALAVRAS } from "./pagar-ao-parceiro";
import {
  FICA_CONSIGO_E_PASSA_A_CLYON,
  FICA_CONSIGO_E_PASSA_A_CLYON_NO_INICIO,
  REGIME_DE_IVA_EM_AVISO_ATE_POR_EXTENSO,
} from "./novo-modelo";
import { DEPOIS_DE_APROVADO_NO_NOVO_MODELO } from "./como-funciona-para-o-profissional";
import { TEXTOS_DA_ACEITACAO } from "./aceitacao-dos-termos";
import { O_MEIO_DE_RECEBER_EM_PALAVRAS } from "./dados-para-receber";
import { avisarQueFoiContratado } from "./email-trabalho";

const RAIZ = join(__dirname, "..", "..");
const ler = (f: string) => readFileSync(join(RAIZ, f), "utf8").replace(/\r\n/g, "\n");
const DIA = 86_400_000;

describe("d4 — a frase única do valor no modelo de 15-11", () => {
  it("diz a taxa e o IVA dela", () => {
    expect(FICA_CONSIGO_E_PASSA_A_CLYON).toBe("fica consigo; a taxa da plataforma e o IVA dela passam à CLYON");
    expect(FICA_CONSIGO_E_PASSA_A_CLYON_NO_INICIO).toBe("Fica consigo; a taxa da plataforma e o IVA dela passam à CLYON");
  });

  it("os sítios que diziam só «a taxa» lêem a constante", () => {
    for (const f of [
      "src/app/profissionais/page.tsx",
      "src/lib/email-proposta.ts",
      "src/app/profissionais/painel/Trabalhos.tsx",
      "src/app/api/profissionais/meus-pedidos/route.ts",
      "src/lib/email-trabalho.ts",
    ]) {
      const s = ler(f);
      expect(s, f).toMatch(/FICA_CONSIGO|A_TAXA_E_O_IVA_DELA_PASSAM_A_CLYON/);
      expect(s, f).not.toMatch(/passa-a à CLYON"/);
    }
  });
});

describe("d4 — «em atraso» só depois do prazo, em hora de Lisboa", () => {
  // Confirmado às 23:30 de 18-11 em Lisboa (UTC em Novembro): o prazo acaba a 22-11 às 23:30.
  const fecho = new Date("2026-11-18T23:30:00Z");
  const prazo = new Date(fecho.getTime() + 4 * DIA);

  it("no dia da confirmação: «A passar à CLYON · X € até dd/mm»", () => {
    const l = linhaDoValorAPassar({ total: 43.05, prazoAte: prazo, paga: false }, new Date(fecho.getTime() + 60_000));
    expect(l.estado).toBe("a_passar");
    expect(l.linha).toBe("A passar à CLYON · 43,05 € até 22/11");
  });

  it("no último instante do prazo ainda não está em atraso; no seguinte, está", () => {
    expect(linhaDoValorAPassar({ total: 10, prazoAte: prazo, paga: false }, prazo).estado).toBe("a_passar");
    const depois = linhaDoValorAPassar({ total: 10, prazoAte: prazo, paga: false }, new Date(prazo.getTime() + 1));
    expect(depois.estado).toBe("em_atraso");
    expect(depois.linha).toBe("Em atraso · 10,00 € · o prazo era 22/11");
  });

  it("pago e sem confirmação", () => {
    expect(linhaDoValorAPassar({ total: 10, prazoAte: prazo, paga: true }, prazo).linha).toBe("Já passou à CLYON · 10,00 €");
    expect(linhaDoValorAPassar({ total: 10, prazoAte: null, paga: false }, prazo).linha).toBe(
      "A passar à CLYON · 10,00 € até 4 dias depois de o trabalho ficar confirmado",
    );
  });

  it("o dia é o de Lisboa, no Verão também (23:30 UTC de 30-06 já é 01/07 em Lisboa)", () => {
    expect(diaEMesEmLisboa(new Date("2026-06-30T23:30:00Z"))).toBe("01/07");
    expect(diaEMesEmLisboa(new Date("2026-11-30T23:30:00Z"))).toBe("30/11");
  });

  it("o backoffice diz o mesmo: no prazo, «A passar à CLYON»; depois, «Em atraso»", () => {
    const no = estadoDoValorEmAtraso({ paga: false, porPagar: 43.05, nasceuEm: fecho }, new Date(fecho.getTime() + DIA));
    expect(no.estado).toBe("no_prazo");
    expect(no.frase).toMatch(/^A passar à CLYON · 43,05 € até 22\/11/);
    expect(no.frase).not.toMatch(/atraso/i);
    const fora = estadoDoValorEmAtraso({ paga: false, porPagar: 43.05, nasceuEm: fecho }, new Date(prazo.getTime() + 1));
    expect(fora.estado).toBe("stand_by");
    expect(fora.frase).toMatch(/^Em atraso desde 22\/11/);
  });
});

describe("d4 — «Como recebe» no trabalho contratado", () => {
  const fecho = new Date("2026-11-18T10:00:00Z");

  it("a forma que o cliente escolheu, com as palavras de COMO_PAGAR_EM_PALAVRAS.parceiro", () => {
    for (const forma of ["transferencia", "mbway", "dinheiro"] as const) {
      const c = comoRecebeNoNovoModelo({ forma, aPassarAClyon: 43.05, fecho, paga: false }, fecho);
      expect(c.titulo).toBe("Como recebe");
      expect(c.formaTexto).toBe(COMO_PAGAR_EM_PALAVRAS[forma].parceiro);
      expect(c.fraseDoValor).toBe(FICA_CONSIGO_E_PASSA_A_CLYON_NO_INICIO);
      expect(c.linhaDoValor).toBe("A passar à CLYON · 43,05 € até 22/11");
    }
  });

  it("sem escolha ainda, e antes de confirmar", () => {
    const c = comoRecebeNoNovoModelo({ forma: null, aPassarAClyon: 20, fecho: null, paga: false }, fecho);
    expect(c.forma).toBeNull();
    expect(c.formaTexto).toBe(CLIENTE_AINDA_NAO_ESCOLHEU);
    expect(c.estado).toBe("depois_de_confirmar");
  });

  it("a rota devolve-o, com a coluna que a /api/pagamentos/ao-parceiro grava", () => {
    expect(ler("src/lib/db.ts")).toMatch(/n\.pagarAoParceiroPor,/);
    const rota = ler("src/app/api/profissionais/meus-pedidos/route.ts");
    expect(rota).toMatch(/comoRecebe:/);
    expect(rota).toMatch(/forma: l\.pagarAoParceiroPor/);
    expect(rota).toMatch(/fraseDoValorNoNovoModelo:/);
  });
});

describe("d4 — o email do trabalho: «Fica consigo», e «com IVA» só no regime normal", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY_clyonsite", "chave-de-teste");
    enviados.length = 0;
  });
  afterEach(() => vi.unstubAllEnvs());

  async function texto(regime: "normal" | "isento") {
    await avisarQueFoiContratado({
      paraEmail: "pro@exemplo.pt",
      paraNome: "Rui",
      pedidoId: 900,
      serviceType: "recolha_moveis",
      morada: "Rua de Teste, 1",
      contactoNome: "Ana",
      contactoTelefone: "912 345 678",
      recebeLiquido: 315,
      formaDePagamento: "na_plataforma",
      criadaEm: "2026-11-16T10:00:00Z",
      novoModelo: { recebidoDoCliente: regime === "normal" ? 430.5 : 350, aPassarAClyon: 43.05, regime },
    });
    return enviados[enviados.length - 1].html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  }

  it("regime normal: «Fica consigo», a frase única e «com IVA»", async () => {
    const t = await texto("normal");
    expect(t).toContain("Fica consigo");
    expect(t).toContain(FICA_CONSIGO_E_PASSA_A_CLYON_NO_INICIO);
    expect(t).toMatch(/O cliente paga-lhe 430,50 € ?, com IVA/);
    expect(t).toContain("a taxa da plataforma e o IVA dela passam à CLYON");
  });

  it("isento: sem «com IVA»", async () => {
    const t = await texto("isento");
    expect(t).toContain("Fica consigo");
    expect(t).toMatch(/O cliente paga-lhe 350,00 € ?\./);
    expect(t).not.toMatch(/paga-lhe 350,00 € ?, com IVA/);
  });
});

describe("d4 — os dois prazos da d1 também nos textos da aprovação e dos Termos", () => {
  it("basta um meio de receber, e o regime até 30-11", () => {
    for (const t of [DEPOIS_DE_APROVADO_NO_NOVO_MODELO, TEXTOS_DA_ACEITACAO.resumo]) {
      expect(t).toContain(O_MEIO_DE_RECEBER_EM_PALAVRAS);
      expect(t).toContain("basta um");
      expect(t).toContain(REGIME_DE_IVA_EM_AVISO_ATE_POR_EXTENSO);
      expect(t).not.toMatch(/do IBAN, do titular e do número MB WAY|são obrigatórios/);
    }
  });
});
