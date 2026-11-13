import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * O RESEND DE MENTIRA — guarda o HTML que sairia, sem mandar nada a ninguém.
 */
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

import { falaDoModeloAntigo } from "./palavras-do-modelo-antigo";
import { NOVO_MODELO_DESDE } from "./novo-modelo";
import { agoraDoModelo } from "./relogio-do-modelo";
import { FRASE_UNICA, FRASE_UNICA_NO_NOVO_MODELO, fraseUnica } from "./frase-unica";
import { TRES_PASSOS_DEPOIS_DE_ENVIAR, passosDaMudancaComEscolha, tresPassosDepoisDeEnviar } from "./textos-do-pedido";
import { QUEM_FACTURA_EM_PALAVRAS, QUEM_FATURA_NO_NOVO_MODELO, quemFaturaEmPalavras } from "./identificacao-legal";
import { FACTURA_EM_PALAVRAS, pagamentoDasEmpresas } from "./seo-data";
import { comissaoEmPalavras, depoisDeAprovado, DEPOIS_DE_APROVADO_NO_NOVO_MODELO, comoRecebe } from "./como-funciona-para-o-profissional";
import { perguntasFrequentes } from "./perguntas-frequentes";
import { montarHtml } from "./email-aprovacao-profissional";
import { textoDoTrabalhoConfirmado } from "./email-proposta";
import { avisoDoConfirmado } from "./fim-do-trabalho";
import { ajudaDoMbway } from "./rotulo-do-mbway";
import { rodapeDoPedido, RODAPE_DO_PEDIDO } from "./pedido-completo-para-a-app";
import { catalogoDaApp } from "./catalogo-da-app";
import { avisarQueFoiContratado, pedirConfirmacaoAoCliente } from "./email-trabalho";

/**
 * OS TEXTOS DO PAGAMENTO NOS DOIS LADOS DE 15-11-2026 — d16 (13-11-2026).
 *
 * Antes da data, cada texto é o de sempre. No dia 16 nenhum diz «a CLYON guarda o
 * valor», «recebe a referência para pagar», «o valor fica com a CLYON» nem «guarda
 * o acordo e o pagamento» (`palavras-do-modelo-antigo.ts`, a mesma lista da regra s
 * da orquestra). E nenhum promete «paga no fim» — o momento ainda não está decidido.
 */
const HOJE = new Date("2026-11-13T12:00:00Z");
const DIA_16 = new Date("2026-11-16T10:00:00Z");
const TAXAS = { cliente: 0, profissional: 0.1 };

const AS_TRES_DA_ORDEM = [/a CLYON guarda o valor/i, /recebe a referência para pagar/i, /o valor fica com a CLYON/i];
const SEM_O_MOMENTO = /paga(r)? no fim/i;

function limpo(t: string, aQuem: "cliente" | "todos" = "cliente") {
  expect(falaDoModeloAntigo(t, aQuem), t).toBeNull();
  for (const re of AS_TRES_DA_ORDEM) expect(t, t).not.toMatch(re);
  expect(t, t).not.toMatch(SEM_O_MOMENTO);
}

describe("antes de 15-11, nada muda", () => {
  it("os mesmos textos de sempre", () => {
    expect(fraseUnica(HOJE)).toBe(FRASE_UNICA);
    expect(tresPassosDepoisDeEnviar(HOJE)).toBe(TRES_PASSOS_DEPOIS_DE_ENVIAR);
    expect(passosDaMudancaComEscolha(2, HOJE)[2]).toBe(TRES_PASSOS_DEPOIS_DE_ENVIAR[2]);
    expect(quemFaturaEmPalavras(HOJE)).toBe(QUEM_FACTURA_EM_PALAVRAS);
    expect(rodapeDoPedido(HOJE)).toBe(RODAPE_DO_PEDIDO);
    expect(pagamentoDasEmpresas(HOJE)).toContain(FACTURA_EM_PALAVRAS);
    expect(comissaoEmPalavras(TAXAS, "iva_incluido", HOJE).frase).toBe(comissaoEmPalavras(TAXAS, "iva_incluido").frase);
    expect(depoisDeAprovado(HOJE)).toContain("com calma");
    expect(ajudaDoMbway(false)).toContain("lhe pagarmos");
    expect(montarHtml({ para: "a@exemplo.pt", nome: "Ana", token: "t", diasDeValidade: 7, agora: HOJE })).not.toContain(
      DEPOIS_DE_APROVADO_NO_NOVO_MODELO,
    );
  });
});

describe("no dia 16, o modelo novo", () => {
  it("o que o cliente lê: o fim do simulador, a frase única, quem fatura, as empresas", () => {
    for (const p of tresPassosDepoisDeEnviar(DIA_16)) limpo(p.texto);
    for (const p of passosDaMudancaComEscolha(3, DIA_16)) limpo(p.texto);
    expect(tresPassosDepoisDeEnviar(DIA_16)[2].texto).toContain("paga diretamente ao parceiro");
    expect(fraseUnica(DIA_16)).toBe(FRASE_UNICA_NO_NOVO_MODELO);
    limpo(fraseUnica(DIA_16));
    expect(quemFaturaEmPalavras(DIA_16)).toBe(QUEM_FATURA_NO_NOVO_MODELO);
    limpo(rodapeDoPedido(DIA_16));
    limpo(pagamentoDasEmpresas(DIA_16));
  });

  it("o que o profissional lê: o exemplo de /quero-ser-parceiro, o sucesso, o email de aprovação, o MB WAY", () => {
    const e = comissaoEmPalavras(TAXAS, "iva_incluido", DIA_16);
    limpo(e.frase, "todos");
    // 350 € a 10 %: o cliente paga-lhe 430,50 €, fica com 315 € + IVA e passa à CLYON 43,05 €.
    expect(e.frase).toContain("paga-lhe 430,50 €");
    expect(e.frase).toContain("fica com 315 € + IVA");
    expect(e.frase).toContain("passa à CLYON 43,05 €");
    for (const r of comoRecebe(DIA_16)) limpo(r.texto, "todos");
    limpo(depoisDeAprovado(DIA_16), "todos");
    for (const d of ["o IBAN", "o titular da conta", "o número MB WAY", "o regime de IVA"]) {
      expect(depoisDeAprovado(DIA_16)).toContain(d);
    }
    const html = montarHtml({ para: "a@exemplo.pt", nome: "Ana", token: "t", diasDeValidade: 7, agora: DIA_16 });
    expect(html).toContain("o regime de IVA");
    expect(ajudaDoMbway(true)).toContain("o cliente lhe paga");
  });

  it("o email e o aviso do trabalho confirmado: a taxa e o IVA dela, sem «em dinheiro»", () => {
    const t = textoDoTrabalhoConfirmado({
      pedidoId: 900,
      liquido: 315,
      destino: "em_mao",
      divida: { recebidoDoCliente: 430.5, iva: 8.05, comissao: 35, total: 43.05, referencia: null, noNovoModelo: true },
    });
    limpo(t.corpo, "todos");
    expect(t.corpo).not.toMatch(/dinheiro no local/);
    expect(t.corpo).toContain("43,05 €");
    expect(t.corpo).toContain("valor em atraso");
    const a = avisoDoConfirmado({ pedidoId: 900, caso: "em_mao_com_divida", liquido: 315, aPagarAClyon: 43.05, noNovoModelo: true });
    expect(a.body).not.toMatch(/dinheiro/);
    expect(a.body).toContain("43,05 €");
  });
});

describe("com NOVO_MODELO_DATA_SIMULADA, fora da produção", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NOVO_MODELO_DATA_SIMULADA", "2026-11-16T10:00:00Z");
    vi.stubEnv("RESEND_API_KEY_clyonsite", "chave-de-teste");
    enviados.length = 0;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("/quero-ser-parceiro, /faq e o catálogo da app dizem o modelo novo", () => {
    const agora = agoraDoModelo();
    expect(agora.getTime()).toBeGreaterThan(NOVO_MODELO_DESDE.getTime());
    limpo(comissaoEmPalavras(TAXAS, "iva_incluido", agora).frase, "todos");
    for (const c of perguntasFrequentes({ tipo: "referencia" } as never, agora)) for (const q of c.questions) limpo(q.a);
    const cat = catalogoDaApp();
    limpo(cat.textos.fraseUnica);
    limpo(cat.textos.rodape);
    for (const p of cat.textos.tresPassos) limpo(p.texto);
    // E o email de aprovação, sem «agora» à mão, lê o mesmo relógio.
    expect(montarHtml({ para: "a@exemplo.pt", nome: "Ana", token: "t", diasDeValidade: 7 })).toContain("o regime de IVA");
  });

  it("os emails do trabalho (contratação e confirmação) dizem o modelo novo", async () => {
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
      criadaEm: DIA_16,
      novoModelo: { recebidoDoCliente: 430.5, aPassarAClyon: 43.05 },
    });
    await pedirConfirmacaoAoCliente({
      paraEmail: "cliente@exemplo.pt",
      paraNome: "Ana",
      pedidoId: 900,
      profissionalNome: "Rui",
      token: "t",
      quantasFotos: 2,
      diasParaConfirmar: 7,
      formaDePagamento: "na_plataforma",
      criadaEm: DIA_16,
      novoModelo: true,
    });
    expect(enviados).toHaveLength(2);
    const [aoPro, aoCliente] = enviados;
    // O HTML tira as etiquetas para ler só o texto.
    const texto = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    limpo(texto(aoPro.html), "todos");
    limpo(texto(aoCliente.html));
    expect(aoCliente.html).toContain(QUEM_FATURA_NO_NOVO_MODELO);
  });
});
