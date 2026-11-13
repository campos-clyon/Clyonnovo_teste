import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { falaDoModeloAntigo } from "./palavras-do-modelo-antigo";
import { NOVO_MODELO_DESDE } from "./novo-modelo";
import {
  COMO_SE_PAGA as COMO_SE_PAGA_DO_PAGAMENTO,
  NO_NOVO_MODELO,
  PROMESSA,
  PROMESSA_POR_FORMA,
  comoSePagaNoSite,
  promessaDaForma,
  promessaGeral,
} from "./pagamento-na-plataforma";
import { COMO_SE_PAGA, FACTURA_EM_PALAVRAS, comoSePaga, faturaEmPalavras } from "./seo-data";
import { PASSOS_DE_COMO_FUNCIONA, passosDeComoFunciona } from "./como-funciona";
import { COMO_RECEBE, PASSOS_DO_PROFISSIONAL, comoRecebe, passosDoProfissional } from "./como-funciona-para-o-profissional";
import { perguntasDoProfissional } from "./ajuda-plataforma";
import { perguntasFrequentes, PERGUNTAS_FREQUENTES } from "./perguntas-frequentes";
import { estadoDoValorEmAtraso } from "./estado-do-valor-em-atraso";
import { validarInscricao } from "./inscricao-profissional";

/**
 * OS TEXTOS DO SITE NOS DOIS LADOS DE 15-11-2026 — d10.
 *
 * A 14-11 cada texto é o de hoje (o mesmo objecto, a mesma frase). A 15-11 os que
 * falam do dinheiro escolhem o modelo novo, e nenhum diz a caução, o «cativo», a
 * CLYON a receber ou a guardar o pagamento, o cliente a pagar à CLYON ou «pela
 * plataforma», nem «em dívida» (`palavras-do-modelo-antigo.ts`, a regra s da
 * orquestra lida em tempo de execução).
 */
const ANTES = new Date("2026-11-14T23:59:59Z");
const DEPOIS = NOVO_MODELO_DESDE;

const limpo = (t: string, aQuem: "cliente" | "todos" = "cliente") => expect(falaDoModeloAntigo(t, aQuem), t).toBeNull();

describe("antes de 15-11, tudo igual", () => {
  it("os mesmos textos de sempre", () => {
    expect(promessaGeral(ANTES)).toBe(PROMESSA);
    expect(comoSePaga(ANTES)).toBe(COMO_SE_PAGA);
    expect(comoSePagaNoSite(ANTES)).toBe(COMO_SE_PAGA_DO_PAGAMENTO);
    expect(faturaEmPalavras(ANTES)).toBe(FACTURA_EM_PALAVRAS);
    expect(passosDeComoFunciona(ANTES)).toBe(PASSOS_DE_COMO_FUNCIONA);
    expect(comoRecebe(ANTES)).toBe(COMO_RECEBE);
    expect(passosDoProfissional(ANTES)).toBe(PASSOS_DO_PROFISSIONAL);
    expect(perguntasFrequentes({ tipo: "referencia" } as never, ANTES)).toBe(PERGUNTAS_FREQUENTES);
    expect(promessaDaForma("na_plataforma", "iva_incluido")).toBe(PROMESSA_POR_FORMA.na_plataforma);
  });
});

describe("a partir de 15-11, o modelo novo", () => {
  it("as frases gerais do cliente", () => {
    const p = promessaGeral(DEPOIS);
    for (const t of [p.clienteCorpo, p.faqComoSePaga, comoSePaga(DEPOIS), comoSePagaNoSite(DEPOIS), faturaEmPalavras(DEPOIS)]) limpo(t);
    expect(comoSePaga(DEPOIS)).toContain("Paga diretamente ao parceiro");
    for (const passo of passosDeComoFunciona(DEPOIS)) limpo(passo.texto);
    for (const c of perguntasFrequentes({ tipo: "referencia" } as never, DEPOIS)) for (const q of c.questions) limpo(q.a);
  });

  it("as do profissional: «valor em atraso», nunca «em dívida»", () => {
    const p = promessaGeral(DEPOIS);
    for (const t of [p.proCorpo, p.proComoRecebe, p.recrutamentoCorpo]) limpo(t, "todos");
    for (const r of comoRecebe(DEPOIS)) limpo(r.texto, "todos");
    for (const passo of passosDoProfissional(DEPOIS)) limpo(passo.texto, "todos");
    const ajuda = perguntasDoProfissional({ cliente: 0, profissional: 0.1 }, DEPOIS);
    for (const q of ajuda) limpo(q.resposta, "todos");
    expect(ajuda.map((q) => q.resposta).join(" ")).toContain("valor em atraso");
    expect(ajuda.some((q) => q.pergunta === "O cliente pagou-me: e agora?")).toBe(true);
  });

  it("um trabalho do modelo novo lê os textos novos, seja qual for a forma", () => {
    for (const forma of ["na_plataforma", "dinheiro", null]) {
      expect(promessaDaForma(forma, "iva_incluido", true)).toBe(NO_NOVO_MODELO);
    }
    for (const [campo, t] of Object.entries(NO_NOVO_MODELO)) {
      if (campo === "backofficeAConfirmar") continue;
      limpo(t, campo.startsWith("pro") || campo.startsWith("emailPro") ? "todos" : "cliente");
    }
  });
});

describe("o valor em atraso nos Pagamentos (5.º dia = stand-by)", () => {
  const fecho = new Date("2026-11-16T10:00:00Z");
  const dia = 86_400_000;
  it("no prazo até aos 4 dias certos, stand-by no instante a seguir", () => {
    expect(estadoDoValorEmAtraso({ paga: false, porPagar: 12.3, nasceuEm: fecho }, new Date(fecho.getTime() + dia)).estado).toBe("no_prazo");
    expect(estadoDoValorEmAtraso({ paga: false, porPagar: 12.3, nasceuEm: fecho }, new Date(fecho.getTime() + 4 * dia)).estado).toBe("no_prazo");
    expect(estadoDoValorEmAtraso({ paga: false, porPagar: 12.3, nasceuEm: fecho }, new Date(fecho.getTime() + 4 * dia + 1)).estado).toBe("stand_by");
    expect(estadoDoValorEmAtraso({ paga: true, porPagar: 0, nasceuEm: fecho }, new Date(fecho.getTime() + 9 * dia)).estado).toBe("pago");
    expect(estadoDoValorEmAtraso({ paga: false, porPagar: 12.3, nasceuEm: null }, fecho).estado).toBe("sem_data");
  });
});

describe("a inscrição pede o IBAN, o MB WAY e o regime a partir de 15-11", () => {
  const base = {
    nome: "Recolhas Exemplo Lda",
    email: "exemplo@exemplo.pt",
    telefone: "912345678",
    cidade: "Almada",
    categorias: ["recolha"],
    raioKm: "30",
    tipoVeiculo: "",
  };
  it("antes, não os pede", () => {
    const r = validarInscricao(base, ANTES);
    if (r.ok) {
      expect(r.dados.iban).toBeNull();
      expect(r.dados.mbway).toBeNull();
    } else {
      expect(r.erros.map((e) => e.campo)).not.toContain("iban");
    }
  });
  it("depois, sem eles não passa; e o regime é sempre pedido", () => {
    const r = validarInscricao(base, DEPOIS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const campos = r.erros.map((e) => e.campo);
      for (const c of ["iban", "ibanTitular", "mbway", "regimeIva"]) expect(campos, c).toContain(c);
    }
    const mau = validarInscricao({ ...base, iban: "PT50 1234", ibanTitular: "Exemplo", mbway: "123" }, DEPOIS);
    expect(mau.ok).toBe(false);
    if (!mau.ok) {
      expect(mau.erros.find((e) => e.campo === "iban")?.mensagem).toBe("IBAN inválido.");
      expect(mau.erros.some((e) => e.campo === "mbway")).toBe(true);
    }
  });
  it("o regime escolhido na inscrição fica confirmado, e a base grava os três", () => {
    const db = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");
    const i = db.indexOf("export async function criarProfissional(");
    expect(i).toBeGreaterThan(-1);
    const corpo = db.slice(i, db.indexOf("return Number(res.insertId);", i));
    expect(corpo).toMatch(/iban, ibanTitular, mbway/);
    expect(corpo).toContain("dados.regimeConfirmado ?? dados.emiteFatura");
  });
});

describe("o regime congela ao contratar (d10)", () => {
  it("gravarNegociacao grava o regime do parceiro no fecho, só a partir da data e fora dos Trabalhos CLYON", () => {
    const db = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");
    const i = db.indexOf("export async function gravarNegociacao(");
    const corpo = db.slice(i, db.indexOf("export async function substituirTokenDoPedido(", i));
    expect(corpo).toContain("SET n.regimeDoProfissional = CASE WHEN");
    expect(corpo).toContain("n.regimeDoProfissional IS NULL AND n.ofertaClyon IS NULL");
    expect(corpo).toContain("NOVO_MODELO_DESDE.getTime()");
  });
});

describe("a regra d33 com o modelo novo: o cliente vê a fatura da taxa, e só aí", () => {
  it("a taxa do profissional continua sem sair nas negociações; a fatura da taxa só pela rota do pagar ao parceiro, num trabalho do modelo novo", async () => {
    const { CAMPOS_QUE_NAO_SAEM } = await import("./negociacoes-para-o-cliente");
    expect(CAMPOS_QUE_NAO_SAEM).toContain("taxaProfissional");
    const rota = readFileSync(join(process.cwd(), "src/app/api/pagamentos/ao-parceiro/route.ts"), "utf8");
    const get = rota.slice(rota.indexOf("export async function GET("));
    const fora = get.indexOf("if (!acesso.trabalho.novoModelo) return NextResponse.json({ pagaAoParceiro: false });");
    expect(fora).toBeGreaterThan(-1);
    expect(fora).toBeLessThan(get.indexOf("oQueOClienteVe(acesso.trabalho)"));
    // Desde a d17 o bloco é uma função só, para a rota e a R5 da app de cliente.
    expect(rota).toContain("oQueOClienteVeDoParceiro");
    const bloco = readFileSync(join(process.cwd(), "src/lib/pagar-ao-parceiro-para-o-cliente.ts"), "utf8");
    expect(bloco).toContain("faturaDaTaxa: c.faturaDaTaxa,");
  });
});

describe("o rótulo do MB WAY, igual no painel e na app Pro (paridade, d10)", () => {
  it("opcional antes de 15-11, obrigatório depois; os dois ecrãs lêem a mesma função", async () => {
    const { rotuloDoMbway } = await import("./rotulo-do-mbway");
    expect(rotuloDoMbway(false)).toBe("MB WAY (opcional)");
    expect(rotuloDoMbway(true)).toBe("MB WAY (obrigatório)");
    for (const f of ["src/app/profissionais/painel/Perfil.tsx", "app-pro/src/app/conta/banco.tsx"]) {
      const s = readFileSync(join(process.cwd(), f), "utf8");
      expect(s.includes("rotuloDoMbway(novoModeloEmVigor())") || s.includes("rotuloDoMbway(Boolean(perfil.novoModelo))"), f).toBe(true);
      expect(s, f).not.toContain('"MB WAY (opcional)"');
    }
  });
});
