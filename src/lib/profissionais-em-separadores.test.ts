import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A SECÇÃO DOS PROFISSIONAIS DO BACKOFFICE, ARRUMADA.
 *
 * *«Organize essa tela, coloque link em botões, está tudo sem nexo nem
 * organização.»* — 01-10-2026.
 *
 * Estava tudo numa coluna, pela ordem em que foi sendo acrescentado: as
 * candidaturas, uma caixa com o link de entrada, o formulário de convite sempre
 * aberto, a lista dos convites — e só no fundo os inscritos, que é o que se vem
 * cá ver. Ficou: duas acções em botões, três listas em separadores.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** Sem os comentários que começam a linha — os de dentro de strings ficam. */
function semNotas(s: string): string {
  return s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
}

const SECCAO = semNotas(ler("src/components/admin/AdminProfissionaisSeccao.tsx"));
const CONVITES = semNotas(ler("src/components/admin/AdminConvitesPanel.tsx"));
const CASCA = semNotas(ler("src/components/admin/LegacyAdminClient.tsx"));

describe("as acções são botões", () => {
  it("o link de entrada copia-se com um botão, e deixou de ser uma caixa de texto", () => {
    expect(SECCAO).toContain("Copiar link de entrada");
    expect(SECCAO).toContain("navigator.clipboard?.writeText(link)");
    /* A caixa com o endereço por extenso saiu do painel dos convites. */
    expect(CONVITES).not.toContain("Link de entrada dos profissionais");
    expect(CONVITES).toContain("onLinkDeEntrada?.(linkDeEntrada)");
  });

  it("convidar é um botão que abre o formulário — e o formulário não está sempre aberto", () => {
    expect(SECCAO).toContain("Convidar profissional");
    expect(SECCAO).toContain("setAConvidar(true)");
    expect(SECCAO).toContain("formularioAberto={aConvidar}");
    expect(CONVITES).toContain("{formularioAberto && (");
  });

  it("e enviado o convite, o formulário fecha-se", () => {
    const i = CONVITES.indexOf("async function convidar()");
    expect(CONVITES.slice(i, i + 500)).toContain("onFormulario?.(false)");
  });
});

describe("as listas são separadores", () => {
  it("três, com os papéis de separador para quem lê com leitor de ecrã", () => {
    expect(SECCAO).toContain('role="tablist"');
    expect(SECCAO).toContain('role="tab"');
    expect(SECCAO).toContain("aria-selected={activa}");
    expect(SECCAO.match(/role="tabpanel"/g)).toHaveLength(3);
  });

  it("abre nos inscritos, que é o que se vem cá ver", () => {
    expect(SECCAO).toContain('useState<Aba>("inscritos")');
  });

  it("os três painéis ficam montados — o número de cada separador está certo antes de se lá ir", () => {
    /*
     * Montar só o separador aberto deixava o número das candidaturas a zero
     * até alguém carregar nelas — e o número existe para fazer alguém carregar.
     */
    expect(SECCAO).toContain('hidden={aba !== "inscritos"}');
    expect(SECCAO).toContain('hidden={aba !== "candidaturas"}');
    expect(SECCAO).toContain('hidden={aba !== "convites"}');
  });

  it("as candidaturas por tratar acendem o separador", () => {
    expect(SECCAO).toContain("alerta: porTratar > 0");
  });

  it("e o backoffice monta a secção nova, e não a coluna antiga", () => {
    expect(CASCA).toContain('{activeSection === "profissionais" && <AdminProfissionaisSeccao />}');
    expect(CASCA).not.toContain("<AdminConvitesPanel />");
  });
});

/*
 * Havia aqui um teste a proibir `bg-cyan-5x0` nestes quatro ficheiros: a regra
 * `[class*="bg-cyan-50"]` do globals.css casava com «bg-cyan-500» e o «Enviar
 * convite» quase não se lia (captura de 01-10-2026). A regra foi corrigida no
 * mesmo dia e tem o seu próprio teste (`globals-ciano.test.ts`). Os botões
 * cheios (`bg-[#0891B2]`) passaram depois a `bg-acao`, como os do resto do
 * site; os tons tingidos em hexadecimal (`bg-[#06B6D4]/15`) ficaram — é a mesma
 * cor e não faz mal.
 */
