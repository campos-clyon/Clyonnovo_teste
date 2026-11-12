import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O IBAN, O TITULAR E O MB WAY — d1, 12-11-2026.
 *
 * Mudá-los pede a palavra-passe (401 sem ela ou errada), grava a data
 * (`ibanMudadoEm`) e manda um email ao profissional; os Levantamentos do
 * backoffice e o painel mostram «IBAN mudado há X dias» (forte nos primeiros
 * 7) e «o titular não bate com o nome». Um teste por regra.
 */

vi.mock("@/lib/sessao-activa-do-profissional", () => ({ sessaoActivaDoProfissional: vi.fn() }));
vi.mock("@/lib/profissional-auth", () => ({
  tokenDoProfissional: () => "x",
  sessaoVemDaApp: () => true,
  renovarSessaoSePreciso: vi.fn(),
  palavraPasseConfere: vi.fn(),
}));
vi.mock("@/lib/limite-rota-publica", () => ({ limitarRotaPublica: vi.fn(async () => ({})) }));
vi.mock("@/lib/geocodificar", () => ({ geocodificarLocalidade: vi.fn(async () => null) }));
vi.mock("@/lib/sugestao-para-o-profissional", () => ({ margemDeReferenciaPercent: vi.fn(async () => 40) }));
vi.mock("@/lib/email-dados-de-pagamento-do-profissional", async (original) => ({
  ...(await original<typeof import("@/lib/email-dados-de-pagamento-do-profissional")>()),
  enviarEmailDosDadosDePagamento: vi.fn(async () => true),
}));
vi.mock("@/lib/db", () => ({
  perfilDoProfissional: vi.fn(),
  avaliacoesDoProfissional: vi.fn(async () => []),
  actualizarPerfilDoProfissional: vi.fn(async () => {}),
  apagarFotosDoBlob: vi.fn(async () => 0),
  fotosDaViatura: vi.fn(async () => []),
  urlDaFotoDaViatura: vi.fn(async () => null),
  invalidarVerificacaoDaGuia: vi.fn(async () => {}),
  custosFixosDeJson: () => null,
  trabalhosConcluidosDoProfissional: vi.fn(async () => 0),
  tarifaDasMudancasDe: vi.fn(async () => null),
  palavraPasseGuardada: vi.fn(),
}));

import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { palavraPasseConfere } from "@/lib/profissional-auth";
import { actualizarPerfilDoProfissional, palavraPasseGuardada, perfilDoProfissional } from "@/lib/db";
import { enviarEmailDosDadosDePagamento } from "@/lib/email-dados-de-pagamento-do-profissional";
import { GET, PUT } from "@/app/api/profissionais/perfil/route";
import {
  CODIGOS_DA_PALAVRA_PASSE,
  camposDePagamentoMudados,
  mudancaDosDadosDePagamento,
  titularBateComONome,
  haQuantoTempo,
} from "./dados-de-pagamento-mudados";
import { montarHtmlDosDadosDePagamento } from "./email-dados-de-pagamento-do-profissional";

const IBAN_GUARDADO = "PT50000201231234567890154";
const IBAN_NOVO = "PT78000350651234567890172";

const GUARDADO = {
  id: 7,
  name: "João Pedro Silva",
  email: "pro@exemplo.pt",
  iban: IBAN_GUARDADO,
  ibanTitular: "João Silva",
  mbway: "912345678",
  responsavel: null,
  ibanMudadoEm: null,
};

const pedido = (corpo: unknown) =>
  new NextRequest("https://clyon.pt/api/profissionais/perfil", {
    method: "PUT",
    body: JSON.stringify(corpo),
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sessaoActivaDoProfissional).mockResolvedValue({ providerId: 7 } as never);
  vi.mocked(perfilDoProfissional).mockResolvedValue({ ...GUARDADO });
  vi.mocked(palavraPasseGuardada).mockResolvedValue("$2a$hash");
  vi.mocked(palavraPasseConfere).mockImplementation(async (v) => v === "certa");
});

describe("a rota do perfil pede a palavra-passe para os dados de pagamento", () => {
  it("mudar o IBAN sem palavra-passe dá 401, com o código, e não grava nem manda email", async () => {
    const r = await PUT(pedido({ iban: IBAN_NOVO }));
    expect(r.status).toBe(401);
    expect((await r.json()).codigo).toBe(CODIGOS_DA_PALAVRA_PASSE.emFalta);
    expect(actualizarPerfilDoProfissional).not.toHaveBeenCalled();
    expect(enviarEmailDosDadosDePagamento).not.toHaveBeenCalled();
  });

  it("com a palavra-passe errada também é 401", async () => {
    const r = await PUT(pedido({ iban: IBAN_NOVO, palavraPasse: "errada" }));
    expect(r.status).toBe(401);
    expect((await r.json()).codigo).toBe(CODIGOS_DA_PALAVRA_PASSE.errada);
    expect(actualizarPerfilDoProfissional).not.toHaveBeenCalled();
  });

  it("o titular e o MB WAY pedem-na da mesma forma", async () => {
    for (const corpo of [{ ibanTitular: "Outra Pessoa" }, { mbway: "934 000 111" }]) {
      const r = await PUT(pedido(corpo));
      expect(r.status, JSON.stringify(corpo)).toBe(401);
    }
    expect(actualizarPerfilDoProfissional).not.toHaveBeenCalled();
  });

  it("uma conta sem palavra-passe recebe o código próprio", async () => {
    vi.mocked(palavraPasseGuardada).mockResolvedValue(null);
    const r = await PUT(pedido({ iban: IBAN_NOVO, palavraPasse: "qualquer" }));
    expect(r.status).toBe(401);
    expect((await r.json()).codigo).toBe(CODIGOS_DA_PALAVRA_PASSE.semPalavraPasse);
  });

  it("com a palavra-passe certa grava e manda o email ao profissional", async () => {
    const r = await PUT(pedido({ iban: IBAN_NOVO, ibanTitular: "João Silva", palavraPasse: "certa" }));
    expect(r.status).toBe(200);
    expect((await r.json()).dadosDePagamentoMudados).toEqual(["iban"]);
    expect(actualizarPerfilDoProfissional).toHaveBeenCalledWith(7, expect.objectContaining({ iban: IBAN_NOVO }));
    expect(enviarEmailDosDadosDePagamento).toHaveBeenCalledWith(
      expect.objectContaining({ para: "pro@exemplo.pt", campos: ["iban"], ibanFinal: "0172" }),
    );
  });

  it("gravar os mesmos valores (o painel e a app mandam-nos sempre) não pede a palavra-passe", async () => {
    const r = await PUT(pedido({ ibanTitular: " João Silva ", mbway: "912 345 678", iban: "PT50 ···· 0154" }));
    expect(r.status).toBe(200);
    expect(enviarEmailDosDadosDePagamento).not.toHaveBeenCalled();
  });

  it("os outros campos do perfil continuam sem palavra-passe", async () => {
    const r = await PUT(pedido({ telefone: "912345678", raioKm: 30 }));
    expect(r.status).toBe(200);
    expect(palavraPasseConfere).not.toHaveBeenCalled();
  });

  it("o GET diz ao painel e à app quando mudou e se o titular bate", async () => {
    const tresDias = new Date(Date.now() - 3 * 86_400_000);
    vi.mocked(perfilDoProfissional).mockResolvedValue({ ...GUARDADO, ibanTitular: "Maria Costa", ibanMudadoEm: tresDias });
    const r = await GET(new NextRequest("https://clyon.pt/api/profissionais/perfil"));
    const { perfil } = await r.json();
    expect(perfil.ibanMudadoEm).toBe(tresDias.toISOString());
    expect(perfil.ibanMudadoRecente).toBe(true);
    expect(perfil.titularBateComONome).toBe(false);
  });
});

describe("a data da mudança fica gravada na base", () => {
  const DB = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");

  it("a coluna ibanMudadoEm só se acrescenta", () => {
    expect(DB).toContain('"ALTER TABLE providers ADD COLUMN ibanMudadoEm DATETIME NULL DEFAULT NULL"');
  });

  it("o UPDATE do perfil põe-na a agora quando o IBAN, o titular ou o MB WAY mudam de facto", () => {
    const i = DB.indexOf("export async function actualizarPerfilDoProfissional(");
    expect(i).toBeGreaterThan(-1);
    const corpo = DB.slice(i, DB.indexOf("UPDATE providers SET", i) + 200);
    expect(corpo).toMatch(/\["iban", "ibanTitular", "mbway"\]/);
    expect(corpo).toContain("ibanMudadoEm = IF(");
    expect(corpo).toContain("ibanMudadoEm, UTC_TIMESTAMP())");
  });

  it("os Levantamentos do backoffice lêem-na com o nome e o responsável", () => {
    const i = DB.indexOf("export async function levantamentosParaAdmin(");
    const corpo = DB.slice(i, DB.indexOf("FROM levantamentos l", i));
    expect(corpo).toContain("p.ibanMudadoEm AS ibanMudadoEm");
    expect(corpo).toContain("p.responsavel AS profissionalResponsavel");
  });
});

describe("as regras", () => {
  it("só conta como mudança o que muda de facto", () => {
    expect(camposDePagamentoMudados(GUARDADO, { iban: IBAN_GUARDADO, ibanTitular: "João Silva", mbway: "912345678" })).toEqual([]);
    expect(camposDePagamentoMudados(GUARDADO, { iban: IBAN_NOVO })).toEqual(["iban"]);
    expect(camposDePagamentoMudados(GUARDADO, { mbway: null })).toEqual(["mbway"]);
    expect(camposDePagamentoMudados({ ...GUARDADO, mbway: null }, { mbway: "" })).toEqual([]);
    expect(camposDePagamentoMudados(undefined, { iban: IBAN_NOVO })).toEqual(["iban"]);
  });

  it("IBAN mudado há menos de 7 dias é marca forte; depois deixa de ser; sem data não há marca", () => {
    const agora = new Date("2026-11-12T12:00:00Z");
    expect(mudancaDosDadosDePagamento(new Date("2026-11-09T12:00:00Z"), agora)).toEqual({ dias: 3, recente: true });
    expect(mudancaDosDadosDePagamento(new Date("2026-11-05T13:00:00Z"), agora)).toEqual({ dias: 6, recente: true });
    expect(mudancaDosDadosDePagamento(new Date("2026-11-05T12:00:00Z"), agora)).toEqual({ dias: 7, recente: false });
    expect(mudancaDosDadosDePagamento(null, agora)).toBeNull();
    expect(haQuantoTempo(0)).toBe("hoje");
    expect(haQuantoTempo(1)).toBe("há 1 dia");
    expect(haQuantoTempo(12)).toBe("há 12 dias");
  });

  it("o titular bate com o nome: acentos, partículas e «Lda» não contam; outra pessoa não bate", () => {
    expect(titularBateComONome("JOAO SILVA", "João Pedro Silva")).toBe(true);
    expect(titularBateComONome("João Pedro da Silva", "João Pedro Silva")).toBe(true);
    expect(titularBateComONome("Mudanças Rápidas, Lda", "Mudanças Rápidas Unipessoal")).toBe(true);
    expect(titularBateComONome("Ana Sousa", "Mudanças Rápidas Lda", "Ana Maria Sousa")).toBe(true);
    expect(titularBateComONome("Maria Costa", "João Pedro Silva")).toBe(false);
    expect(titularBateComONome("Silva", "João Pedro Silva")).toBe(false);
    expect(titularBateComONome("", "João Silva")).toBe(false);
    expect(titularBateComONome("João Silva", null, "")).toBeNull();
  });

  it("o email diz o que mudou, sem o IBAN inteiro, e «se não reconhece a mudança, fale connosco»", () => {
    const html = montarHtmlDosDadosDePagamento({
      para: "pro@exemplo.pt",
      nome: "João Pedro Silva",
      campos: ["iban", "ibanTitular"],
      ibanFinal: "0172",
      em: new Date("2026-11-12T14:30:00Z"),
    });
    expect(html).toContain("IBAN e titular da conta");
    expect(html).toContain("terminado em 0172");
    expect(html).not.toContain(IBAN_NOVO);
    expect(html).toContain("Se não reconhece esta mudança, fale connosco");
    expect(html).toContain("12/11/2026 · 14:30");
  });
});

describe("o backoffice e o painel mostram o aviso", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("os Levantamentos marcam o IBAN mudado e o titular que não bate", () => {
    const painel = ler("src/components/admin/AdminLevantamentosPanel.tsx");
    expect(painel).toContain("IBAN mudado {haQuantoTempo(l.ibanMudado.dias)}");
    expect(painel).toContain("l.ibanMudado.recente");
    expect(painel).toContain("o titular não bate com o nome");
    const rota = ler("src/app/api/admin/levantamentos/route.ts");
    expect(rota).toContain("mudancaDosDadosDePagamento(");
    expect(rota).toContain("titularBateComONome(");
  });

  it("o painel do profissional mostra o mesmo aviso e manda a palavra-passe no campo «palavraPasse»", () => {
    const perfil = ler("src/app/profissionais/painel/Perfil.tsx");
    expect(perfil).toContain("<AvisoDosDadosDePagamento");
    expect(perfil).toContain("IBAN mudado {haQuantoTempo(mudanca.dias)}");
    expect(perfil).toContain("palavraPasse: palavraPasseDoBanco");
    // O 401 com código não é a sessão que expirou.
    expect(perfil).toContain("res.status === 401 && !r.codigo");
  });
});
