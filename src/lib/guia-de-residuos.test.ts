import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AJUDA_DA_GUIA,
  AVISO_DO_FORMATO_DO_CODIGO_APA,
  EXEMPLO_DO_CODIGO_APA,
  LISTA_DO_ADMINISTRADOR_DA_GUIA,
  avisoDoCodigoApa,
  codigoApaTemOFormato,
  destinoDosResiduosLimpo,
  tipoDaProvaAceite,
} from "./guia-de-residuos";

/**
 * A GUIA DE RESÍDUOS — 12-11-2026 (d5, textos do Jurídico).
 *
 * O que se guarda: o formato do código APA («APA» + 8 algarismos) avisa e não
 * bloqueia; o exemplo certo nos três sítios (painel, inscrição, backoffice) e
 * o errado em nenhum; a prova só a abre o administrador, e o endereço dela
 * nunca sai numa resposta ao parceiro; o texto A junto ao campo.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("o formato do código APA", () => {
  it("«APA» e 8 algarismos", () => {
    expect(codigoApaTemOFormato("APA13458563")).toBe(true);
    expect(codigoApaTemOFormato("APA00000000")).toBe(true);
  });

  it("aceita espaços, hífens e minúsculas (só para conferir)", () => {
    expect(codigoApaTemOFormato("apa 1345 8563")).toBe(true);
    expect(codigoApaTemOFormato("APA-13458563")).toBe(true);
  });

  it("recusa o exemplo antigo e o que não tem 8 algarismos", () => {
    expect(codigoApaTemOFormato("APA-123456")).toBe(false);
    expect(codigoApaTemOFormato("APA1234567")).toBe(false);
    expect(codigoApaTemOFormato("APA123456789")).toBe(false);
    expect(codigoApaTemOFormato("13458563")).toBe(false);
    expect(codigoApaTemOFormato("")).toBe(false);
    expect(codigoApaTemOFormato(null)).toBe(false);
  });

  it("o aviso só aparece com texto fora do formato, e vazio não avisa", () => {
    expect(avisoDoCodigoApa("")).toBeNull();
    expect(avisoDoCodigoApa("  ")).toBeNull();
    expect(avisoDoCodigoApa("APA13458563")).toBeNull();
    expect(avisoDoCodigoApa("APA-123456")).toBe(AVISO_DO_FORMATO_DO_CODIGO_APA);
  });

  it("o exemplo cumpre o formato", () => {
    expect(EXEMPLO_DO_CODIGO_APA).toBe("Ex.: APA00000000");
    expect(codigoApaTemOFormato(EXEMPLO_DO_CODIGO_APA.replace("Ex.: ", ""))).toBe(true);
  });
});

describe("o formato avisa e não bloqueia", () => {
  it("nem a inscrição, nem o painel, nem o backoffice recusam pelo formato", () => {
    for (const f of [
      "src/lib/inscricao-profissional.ts",
      "src/app/api/profissionais/perfil/route.ts",
      "src/lib/edicao-profissional.ts",
    ]) {
      const s = semNotas(ler(f));
      expect(s, f).not.toContain("codigoApaTemOFormato");
      expect(s, f).not.toContain("FORMATO_DO_CODIGO_APA");
    }
  });
});

describe("o exemplo certo nos três sítios, e o errado em nenhum", () => {
  const PAINEL = ler("src/app/profissionais/painel/Perfil.tsx");
  const INSCRICAO = ler("src/app/profissionais/InscricaoForm.tsx");
  const BACKOFFICE = ler("src/components/admin/AdminProfissionaisPanel.tsx");

  it("os três usam o exemplo, o aviso e o destino da fonte única", () => {
    for (const [nome, s] of [
      ["painel", PAINEL],
      ["inscrição", INSCRICAO],
      ["backoffice", BACKOFFICE],
    ] as const) {
      expect(s, nome).toContain("placeholder={EXEMPLO_DO_CODIGO_APA}");
      expect(s, nome).toContain("avisoDoCodigoApa(");
      expect(s, nome).toContain("EXEMPLO_DO_DESTINO_DOS_RESIDUOS");
    }
  });

  it("a prova no painel e na inscrição, e o texto A junto ao campo", () => {
    expect(PAINEL).toContain('fetch("/api/profissionais/prova-da-guia"');
    expect(INSCRICAO).toContain('fetch("/api/profissionais/inscricao/prova-da-guia"');
    expect(PAINEL).toContain("<AjudaDaGuia />");
    expect(INSCRICAO).toContain("<AjudaDaGuia />");
    const ajuda = ler("src/components/AjudaDaGuia.tsx");
    expect(ajuda).toContain("AJUDA_DA_GUIA.passos.map");
    expect(AJUDA_DA_GUIA.passos).toHaveLength(3);
  });

  it("o backoffice mostra a lista do administrador (texto C) e abre a prova pela rota dele", () => {
    expect(BACKOFFICE).toContain("LISTA_DO_ADMINISTRADOR_DA_GUIA.map");
    expect(BACKOFFICE).toContain("/prova-da-guia`");
    expect(LISTA_DO_ADMINISTRADOR_DA_GUIA).toHaveLength(5);
  });

  it("«APA-123456» não aparece em lado nenhum do site", () => {
    for (const s of [PAINEL, INSCRICAO, BACKOFFICE]) expect(s).not.toContain("APA-123456");
  });
});

describe("a prova só a vê o administrador", () => {
  it("a rota do administrador é requireAdminGeral e não deixa cache", () => {
    const r = ler("src/app/api/admin/profissionais/[id]/prova-da-guia/route.ts");
    expect(r).toContain("await requireAdminGeral(req)");
    expect(r).not.toMatch(/\brequireAdmin\(/);
    expect(r).toContain('"Cache-Control": "private, no-store"');
  });

  it("o endereço nunca sai numa resposta ao parceiro nem na lista do backoffice", () => {
    for (const f of [
      "src/app/api/profissionais/perfil/route.ts",
      "src/app/api/profissionais/prova-da-guia/route.ts",
      "src/app/api/profissionais/inscricao/prova-da-guia/route.ts",
      "src/app/api/admin/profissionais/route.ts",
      "src/lib/prova-da-guia-no-servidor.ts",
    ]) {
      const s = semNotas(ler(f));
      expect(s, f).not.toContain("provaDaGuiaUrl");
      expect(s, f).not.toMatch(/url:\s*blob\.url/);
    }
  });

  it("o parceiro não grava a prova pelo perfil: só pela rota dela", () => {
    const db = ler("src/lib/db.ts");
    const i = db.indexOf("export async function actualizarPerfilDoProfissional(");
    const corpo = db.slice(i, db.indexOf("\n}\n", i));
    expect(corpo).not.toContain('"provaDaGuiaUrl"');
    expect(corpo).toContain('"destinoDosResiduos"');
  });

  it("a prova pela inscrição só vale com o convite acabado de gastar, na primeira hora e sem prova", () => {
    const db = ler("src/lib/db.ts");
    expect(db).toContain("c.usadoEm > NOW() - INTERVAL 60 MINUTE");
    expect(db).toContain("AND p.provaDaGuiaUrl IS NULL AND p.estado = 'pendente'");
  });

  it("imagens e PDF; vídeos não", () => {
    expect(tipoDaProvaAceite("application/pdf")).toBe(true);
    expect(tipoDaProvaAceite("image/png")).toBe(true);
    expect(tipoDaProvaAceite("video/mp4")).toBe(false);
  });
});

describe("o destino", () => {
  it("limpa espaços, corta no tamanho, e vazio é null", () => {
    expect(destinoDosResiduosLimpo("  Aterro   do Seixal ")).toBe("Aterro do Seixal");
    expect(destinoDosResiduosLimpo("")).toBeNull();
    expect(destinoDosResiduosLimpo(42)).toBeNull();
    expect(destinoDosResiduosLimpo("x".repeat(500))).toHaveLength(200);
  });
});

describe("as perguntas para o advogado ficam fora dos textos públicos", () => {
  it("nem o IMT nem a pergunta da CAE aparecem nos textos da guia, nos Termos ou na Privacidade", () => {
    for (const f of ["src/lib/guia-de-residuos.ts", "src/app/termos/page.tsx", "src/app/privacidade/page.tsx"]) {
      const s = ler(f);
      expect(s, f).not.toMatch(/\bIMT\b|2 ?500 kg|alvará/i);
      expect(s, f).not.toContain("detentora ou transportadora");
    }
  });
});
