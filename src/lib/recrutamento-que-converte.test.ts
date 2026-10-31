import { describe, it, expect, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DESCRICAO_DO_RECRUTAMENTO,
  FOTOGRAFIA_DE_UM_PARCEIRO,
  IMAGENS_QUE_NAO_SAO_REAIS,
  TITULO_DO_RECRUTAMENTO,
} from "./pagina-de-recrutamento";
import { MINIMO_PARA_MOSTRAR, pedidosParaMostrar } from "./pedidos-da-semana";
import { APP_PRO_NA_PLAY, APP_PRO_SO_EM_TESTE } from "./links-da-app";
import {
  lerOrigemDaCandidatura,
  limparOrigemDaCandidatura,
  origemGuardada,
  origemParaACandidatura,
} from "./origem-da-candidatura";
import { caminhoDoSite, paginaAnterior, registarPagina } from "./pagina-anterior";

/**
 * /QUERO-SER-PARCEIRO QUE CONVERTE, E A CANDIDATURA COM A ORIGEM — d6 de
 * 28-10-2026, aprovada pelo dono e pelo CEO, feita a 31-10-2026.
 *
 * Nenhum botão no primeiro ecrã, nenhuma ligação no rodapé, e uma candidatura
 * que não dizia de onde vinha — nenhum canal de recrutamento se conseguia
 * medir.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** Sem comentários e com o espaço normalizado: o que se lê no ecrã. */
const semNotas = (f: string) =>
  f
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/\s+/g, " ");

const PAGINA = ler("src/app/quero-ser-parceiro/page.tsx");
const FORM = ler("src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx");

describe("o título e a descrição para quem procura trabalho", () => {
  it("cabem no que o Google mostra, e a página usa-os", () => {
    expect([...`${TITULO_DO_RECRUTAMENTO} | CLYON`].length).toBeLessThanOrEqual(60);
    expect([...DESCRICAO_DO_RECRUTAMENTO].length).toBeLessThanOrEqual(155);
    expect(PAGINA).toContain("title: TITULO_DO_RECRUTAMENTO,");
    expect(PAGINA).toContain("description: DESCRICAO_DO_RECRUTAMENTO,");
  });

  it("não prometem a morada: o profissional vê a zona e o andar", () => {
    expect(DESCRICAO_DO_RECRUTAMENTO).not.toMatch(/morada/i);
    expect(DESCRICAO_DO_RECRUTAMENTO).toContain("zona");
  });
});

describe("o primeiro ecrã", () => {
  it("tem o botão para a candidatura, antes de tudo o resto", () => {
    const botao = PAGINA.indexOf('href="#candidatura"');
    expect(botao).toBeGreaterThan(-1);
    expect(semNotas(PAGINA)).toContain("Candidatar-me (1 minuto)");
    // Antes dos cartões, do «Como funciona» e do formulário.
    expect(botao).toBeLessThan(PAGINA.indexOf("{PORQUE.map("));
    expect(botao).toBeLessThan(PAGINA.indexOf('id="como-funciona"'));
    expect(PAGINA).toContain('<section id="candidatura"');
  });

  it("começa no título, sem selo por cima", () => {
    const heroi = PAGINA.slice(PAGINA.indexOf('<section className="sob-o-menu'), PAGINA.indexOf("<h1"));
    expect(heroi).not.toMatch(/uppercase|tracking-\[/);
  });

  it("o número da semana vem da base, guardado uma hora, e nunca escrito à mão", () => {
    expect(PAGINA).toContain("pedidosDosUltimos7Dias()");
    expect(PAGINA).toContain("export const revalidate = 3600;");
    expect(PAGINA).toContain("{pedidosDaSemana} pedidos");
    expect(semNotas(PAGINA)).not.toMatch(/\b\d{2,4} pedidos\b/);
    const SQL = ler("src/lib/pedidos-da-semana.ts");
    expect(SQL).toContain("createdAt >= NOW() - INTERVAL 7 DAY");
    expect(SQL).toContain("status <> 'arquivado'");
  });

  it("um número pequeno, ou desconhecido, não aparece", () => {
    expect(pedidosParaMostrar(null)).toBeNull();
    expect(pedidosParaMostrar(MINIMO_PARA_MOSTRAR - 1)).toBeNull();
    expect(pedidosParaMostrar(MINIMO_PARA_MOSTRAR)).toBe(MINIMO_PARA_MOSTRAR);
    expect(pedidosParaMostrar(37)).toBe(37);
    expect(pedidosParaMostrar(Number.NaN)).toBeNull();
  });

  it("a fotografia, quando houver, é real e está no site", () => {
    if (FOTOGRAFIA_DE_UM_PARCEIRO) {
      expect(IMAGENS_QUE_NAO_SAO_REAIS).not.toContain(FOTOGRAFIA_DE_UM_PARCEIRO.src);
      expect(existsSync(join(process.cwd(), "public", FOTOGRAFIA_DE_UM_PARCEIRO.src))).toBe(true);
      expect(FOTOGRAFIA_DE_UM_PARCEIRO.alt.length).toBeGreaterThan(10);
    }
    // Sem ela não se desenha nada: nem caixa vazia, nem imagem gerada.
    expect(PAGINA).toContain("{FOTOGRAFIA_DE_UM_PARCEIRO && (");
    for (const img of IMAGENS_QUE_NAO_SAO_REAIS) expect(PAGINA).not.toContain(img);
  });
});

describe("a app CLYON Pro", () => {
  it("liga à Google Play e, enquanto está em teste, não promete a instalação", () => {
    expect(APP_PRO_NA_PLAY).toBe("https://play.google.com/store/apps/details?id=pt.clyon.pro");
    expect(PAGINA).toContain("href={APP_PRO_NA_PLAY}");
    const visivel = semNotas(PAGINA);
    expect(visivel).toContain("A CLYON Pro: os pedidos no seu telemóvel");
    if (APP_PRO_SO_EM_TESTE) {
      expect(visivel).toContain("está em teste com os primeiros profissionais");
      expect(visivel).toContain("só abre a quem já está no teste");
    }
    expect(visivel).not.toMatch(/descarregue|download/i);
    // Nem a página nem o formulário falam de convite a quem se candidata.
    expect(visivel).not.toContain("convite");
  });
});

describe("o rodapé liga à candidatura", () => {
  it("em todas as páginas, na coluna da empresa", () => {
    const RODAPE = ler("src/components/Footer.tsx");
    const empresa = RODAPE.slice(RODAPE.indexOf("const EMPRESA = ["), RODAPE.indexOf("];", RODAPE.indexOf("const EMPRESA = [")));
    expect(empresa).toContain('{ href: "/quero-ser-parceiro", texto: "Quero ser parceiro" }');
  });
});

describe("a candidatura guarda de onde veio a pessoa", () => {
  it("no browser: a campanha, o site que mandou e a página anterior, com o código", () => {
    const visita = {
      utm_source: "facebook",
      utm_medium: "grupo",
      utm_campaign: "recrutamento",
      gclid: "nao-deve-ir",
      entrada: "/",
      quando: "2026-10-31T10:00:00Z",
    };
    const o = origemParaACandidatura(visita, "/");
    expect(o).toEqual({
      codigo: "F2",
      utm_source: "facebook",
      utm_medium: "grupo",
      utm_campaign: "recrutamento",
      entrada: "/",
      vindoDe: "/",
    });
    expect(JSON.stringify(o)).not.toContain("gclid");
    // Entrou direto na página da candidatura, sem origem guardada: D0.
    expect(origemParaACandidatura(null, null)).toEqual({ codigo: "D0" });
    // Do Google sem anúncio, vinda de uma página de cidade.
    expect(origemParaACandidatura({ utm_source: "google.com", utm_medium: "organic", referrer: "google.com", quando: "x" }, "/recolha-moveis-almada").codigo).toBe("G7");
  });

  it("no servidor: só o que se conhece, do tamanho certo, e nunca o gclid", () => {
    expect(limparOrigemDaCandidatura(null)).toBeNull();
    expect(limparOrigemDaCandidatura({ codigo: "Z9" })).toBeNull();
    expect(limparOrigemDaCandidatura({ codigo: "a1", gclid: "x", outro: "y", vindoDe: "https://mau.pt/x", utm_campaign: "<b>x</b>" })).toEqual({
      codigo: "A1",
      utm_campaign: "bx/b",
    });
    const longa = limparOrigemDaCandidatura({ codigo: "O0", utm_source: "x".repeat(500) });
    expect(longa?.utm_source?.length).toBe(120);
    expect(origemGuardada('{"codigo":"G2","vindoDe":"/"}')).toEqual({ codigo: "G2", vindoDe: "/" });
    expect(origemGuardada("{")).toBeNull();
    expect(origemGuardada(null)).toBeNull();
  });

  it("o backoffice lê-a em português", () => {
    expect(
      lerOrigemDaCandidatura({ codigo: "F2", utm_source: "facebook", utm_medium: "grupo", utm_campaign: "recrutamento", vindoDe: "/" }),
    ).toBe("Facebook · campanha recrutamento (grupo) · veio de: Página inicial (/) · F2");
    expect(lerOrigemDaCandidatura({ codigo: "O0", referrer: "olx.pt" })).toBe(
      "Outro site · por olx.pt · entrou direto na página da candidatura · O0",
    );
    expect(lerOrigemDaCandidatura({ codigo: "D0" })).toBe("Direto (escreveu clyon.pt ou já conhecia) · entrou direto na página da candidatura · D0");
    expect(lerOrigemDaCandidatura(null)).toBeNull();
  });

  it("o formulário manda-a, a rota limpa-a, a base guarda-a, e a ficha mostra-a", () => {
    expect(FORM).toContain("origem: origemParaACandidatura(origemDaVisita(), paginaAnterior()),");
    const ROTA = ler("src/app/api/parceiros/candidatura/route.ts");
    expect(ROTA).toContain("origem: limparOrigemDaCandidatura(corpo.origem),");
    const LIB = ler("src/lib/candidaturas.ts");
    // A coluna no CREATE (bases novas) e no ALTER (a que já existe).
    expect(LIB).toContain("origemJson  VARCHAR(1500) NULL DEFAULT NULL,");
    expect(LIB).toContain("ALTER TABLE candidaturasProfissionais ADD COLUMN origemJson VARCHAR(1500) NULL DEFAULT NULL");
    expect(LIB).toContain("(nome, email, telefone, cidade, tipoVeiculo, servicosJson, mensagem, origemJson)");
    // Repetida, a origem da primeira vez fica.
    expect(LIB).toContain("origemJson = COALESCE(origemJson, ?)");
    expect(LIB).toContain("origem: origemGuardada(l.origemJson),");
    const PAINEL = ler("src/components/admin/AdminCandidaturasPanel.tsx");
    expect(PAINEL).toContain("Origem: {lerOrigemDaCandidatura(c.origem ?? null)");
  });
});

describe("a página anterior, para o número do código", () => {
  const original = (globalThis as { window?: unknown }).window;
  afterEach(() => {
    (globalThis as { window?: unknown }).window = original;
  });

  it("guarda a página vista antes desta, e um recarregar não a apaga", () => {
    const guardado = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      sessionStorage: {
        getItem: (k: string) => guardado.get(k) ?? null,
        setItem: (k: string, v: string) => void guardado.set(k, v),
      },
    };
    registarPagina("/");
    expect(paginaAnterior()).toBeNull();
    registarPagina("/recolha-moveis-almada");
    registarPagina("/quero-ser-parceiro");
    registarPagina("/quero-ser-parceiro");
    expect(paginaAnterior()).toBe("/recolha-moveis-almada");
  });

  it("só caminhos do site", () => {
    expect(caminhoDoSite("/blog/x?utm_source=y#z")).toBe("/blog/x");
    expect(caminhoDoSite("https://outro.pt/")).toBeNull();
    expect(caminhoDoSite("/<script>")).toBeNull();
    expect(caminhoDoSite(42)).toBeNull();
  });

  it("o layout regista cada página", () => {
    const ORIGEM = ler("src/components/OrigemECliques.tsx");
    expect(ORIGEM).toContain("if (caminho) registarPagina(caminho);");
  });
});
