import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A AVARIA QUE NÃO SE VIA.
 *
 * A 14-09-2026 a quota do Gemini esgotou-se:
 *
 *   [GoogleGenerativeAI Error] ... gemini-2.5-flash:generateContent:
 *   [429 Too Many Requests] You exceeded your current quota
 *
 * O assistente passou o dia a responder por palavras-chave a clientes que
 * escreviam frases normais — «Sim serve», «Revolution 94», «Aceito a proposta
 * da Revolution» — e não houve UM sinal em lado nenhum. A falha é apanhada e o
 * caminho antigo segue, que é o comportamento certo: uma avaria na Google não
 * pode fechar nem recusar negócio nenhum. Só que ninguém ficava a saber.
 *
 * Foi descoberta a ler uma conversa à mão, um dia depois.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const COMPREENSAO = ler("src/lib/whatsapp-compreensao.ts");
const DB = ler("src/lib/db.ts");
const ROTA = ler("src/app/api/admin/whatsapp/route.ts");
const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");

describe("a falha fica registada", () => {
  it("a leitura das respostas dos clientes anota quando falha", () => {
    // Era o caminho silencioso: devolvia null e o cérebro seguia pelas
    // expressões regulares, sem deixar rasto.
    const i = COMPREENSAO.indexOf("export async function compreenderResposta");
    const corpo = COMPREENSAO.slice(i);
    expect(corpo).toContain("await anotar(null);");
    expect(corpo).toContain("await anotar(primeiroMotivo ??");
  });

  it("a leitura do fio também", () => {
    const i = COMPREENSAO.indexOf("export async function compreenderFioComMotivo");
    const corpo = COMPREENSAO.slice(i, COMPREENSAO.indexOf("export async function compreenderFio(", i));
    expect(corpo).toContain("await anotar(null);");
    expect(corpo).toContain("await anotar(motivo);");
  });

  it("e uma leitura boa limpa o aviso", () => {
    expect(DB).toContain("compreensaoFalhouEm = NULL, compreensaoMotivo = NULL");
  });
});

describe("o termómetro não trava o doente", () => {
  /*
   * Se anotar a avaria pudesse atirar, uma base em baixo passava a impedir o
   * assistente de responder — trocava uma avaria silenciosa por uma barulhenta
   * e pior.
   */
  it("anotar nunca atira", () => {
    const i = DB.indexOf("export async function anotarSaudeDaCompreensao");
    const corpo = DB.slice(i, i + 1400);
    expect(corpo).toContain("try {");
    expect(corpo).toContain("catch {");
  });

  it("ler a saúde também não", () => {
    const i = DB.indexOf("export async function saudeDaCompreensao");
    const corpo = DB.slice(i, i + 1200);
    expect(corpo).toContain("return null;");
  });

  it("e o painel aguenta a resposta sem o campo", () => {
    expect(PAINEL).toContain("compreensao?: { quando: string; motivo: string } | null;");
  });
});

describe("e aparece onde não se pode ignorar", () => {
  it("a rota devolve-o", () => {
    expect(ROTA).toContain("saudeDaCompreensao().catch(() => null)");
  });

  it("o painel diz o que está partido, e com que consequência", () => {
    expect(PAINEL).toContain("O assistente não está a PERCEBER as");
    // O que ainda funciona, para ninguém pensar que está tudo parado.
    expect(PAINEL).toContain("Continua a responder");
  });

  /*
   * «429 quota excedida» e «falta a chave» têm remédios diferentes — um é
   * facturação, o outro é uma variável de ambiente. Esconder o motivo obrigava
   * a ir aos registos da Vercel para saber qual deles é.
   */
  it("e mostra o motivo de quem recusou", () => {
    expect(PAINEL).toContain("estado.compreensao.motivo");
  });
});
