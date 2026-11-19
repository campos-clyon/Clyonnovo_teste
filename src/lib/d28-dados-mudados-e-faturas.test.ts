import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DADOS_DE_PAGAMENTO_MUDARAM, mudaramDepoisDeContratar } from "./dados-de-pagamento-mudados";
import { HORAS_DO_LINK_DA_FATURA, ROTA_DA_FATURA, eDoBlobPublico, linkDaFatura, linkDaFaturaValido } from "./faturas-do-trabalho-link";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/*
 * d28 (CEO e dono, 15-11-2026), partes (b) e (c).
 */
describe("d28 (b) — os dados de pagamento mudaram depois de contratar", () => {
  it("a frase é curta, em PT-PT, e diz «parceiro»", () => {
    expect(DADOS_DE_PAGAMENTO_MUDARAM).toBe(
      "Os dados de pagamento deste parceiro mudaram depois de o contratar. Confirme com a CLYON antes de transferir.",
    );
    expect(DADOS_DE_PAGAMENTO_MUDARAM).not.toMatch(/profissional/i);
  });

  it("só avisa quando a mudança é depois da contratação", () => {
    expect(mudaramDepoisDeContratar("2026-11-16T10:00:00Z", "2026-11-15T10:00:00Z")).toBe(true);
    expect(mudaramDepoisDeContratar("2026-11-14T10:00:00Z", "2026-11-15T10:00:00Z")).toBe(false);
    expect(mudaramDepoisDeContratar(null, "2026-11-15T10:00:00Z")).toBe(false);
  });

  it("sem a data da contratação (as de antes), conta a abertura da negociação", () => {
    expect(mudaramDepoisDeContratar("2026-11-16T10:00:00Z", null, "2026-11-15T09:00:00Z")).toBe(true);
    expect(mudaramDepoisDeContratar("2026-11-16T10:00:00Z", null, null)).toBe(false);
  });

  it("o bloco «Pagar a …» devolve a frase em `dadosMudaram`, e o site e a Mesa mostram-na", () => {
    const bloco = ler("src/lib/pagar-ao-parceiro-para-o-cliente.ts");
    // d5 (19-11-2026): com os dados retidos, a frase dá lugar à de `semDados` (sem IBAN nem MB WAY).
    expect(bloco).toContain("dadosMudaram: dadosMudados && !porConfirmar ? DADOS_DE_PAGAMENTO_MUDARAM : null");
    expect(ler("src/components/PagarAoParceiro.tsx")).toContain("{visto.dadosMudaram}");
    expect(ler("src/app/api/admin/negociacoes/route.ts")).toContain("dadosDePagamentoMudados: true");
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain("{SELO_DOS_DADOS_MUDADOS}");
  });

  it("a contratação grava quando foi (v23)", () => {
    const db = ler("src/lib/db.ts");
    expect(db).toContain("ALTER TABLE negociacoes ADD COLUMN contratadaEm DATETIME NULL DEFAULT NULL");
    expect(db).toMatch(/SET contratadaEm = UTC_TIMESTAMP\(\) WHERE id = \? AND contratadaEm IS NULL/);
  });
});

describe("d28 (c) — as faturas saem do acesso público", () => {
  const antes = process.env.JWT_SECRET;
  beforeEach(() => {
    process.env.JWT_SECRET = "segredo-de-teste-para-as-faturas";
  });
  afterEach(() => {
    process.env.JWT_SECRET = antes;
  });

  it("o link é o da rota, assinado e com prazo", () => {
    const agora = new Date("2026-11-15T12:00:00Z");
    const link = linkDaFatura(7, agora);
    expect(link.startsWith(`${ROTA_DA_FATURA}/7?`)).toBe(true);
    const u = new URL(link, "https://exemplo.test");
    expect(linkDaFaturaValido(7, u.searchParams.get("ate"), u.searchParams.get("a"), agora)).toBe(true);
    // Outra fatura, outro prazo ou depois do prazo: não.
    expect(linkDaFaturaValido(8, u.searchParams.get("ate"), u.searchParams.get("a"), agora)).toBe(false);
    const depois = new Date(agora.getTime() + (HORAS_DO_LINK_DA_FATURA + 1) * 3600_000);
    expect(linkDaFaturaValido(7, u.searchParams.get("ate"), u.searchParams.get("a"), depois)).toBe(false);
    expect(linkDaFaturaValido(7, null, null, agora)).toBe(false);
  });

  it("distingue o armazenamento público do privado", () => {
    expect(eDoBlobPublico("https://abc.public.blob.vercel-storage.com/faturas/x.pdf")).toBe(true);
    expect(eDoBlobPublico("https://abc.private.blob.vercel-storage.com/faturas/x.pdf")).toBe(false);
  });

  it("a lista dá o link da rota, nunca o endereço do armazenamento", () => {
    const base = ler("src/lib/faturas-do-trabalho-na-base.ts");
    expect(base).toContain("url: linkDaFatura(Number(l.id)),");
    expect(base).not.toContain("url: String(l.url),\n      nome: l.nome == null ? null : String(l.nome),\n      carregadaEm");
  });

  it("as novas sobem para o armazenamento privado quando está ligado", () => {
    const s = ler("src/lib/faturas-do-trabalho-no-servidor.ts");
    expect(s).toMatch(/access: "private"[^\n]*token: privado/);
  });

  it("a rota de leitura pede o link assinado, o backoffice, a sessão do parceiro ou as credenciais do pedido", () => {
    const r = ler("src/app/api/faturas-do-trabalho/[id]/route.ts");
    expect(r).toContain("linkDaFaturaValido(");
    expect(r).toContain("requireAdmin(req)");
    expect(r).toContain("acesso.trabalho.providerId === sessao.providerId");
    expect(r).toContain("trabalhoQueSePodePagar(");
    expect(r).toContain("limitarRotaPublica(");
    expect(r).toContain('"Cache-Control": "private, no-store"');
  });
});
