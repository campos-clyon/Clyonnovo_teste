import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CATEGORIAS_DOS_PROFISSIONAIS,
  FORA_DO_PLANO,
  NOMES_DOS_SERVICOS,
  SERVICOS_PUBLICOS,
} from "./service-categories";
import { SERVICOS_DA_INSCRICAO } from "../../app-pro/src/lib/conta";
import { porqueNaoRecebeu, regraDoEnvio } from "./regra-do-envio";

/**
 * UMA SÓ LISTA DE CATEGORIAS, E SEM ZONAS — 29-10-2026 (ordem do dono).
 *
 * O perfil do profissional no backoffice tinha nove categorias (com a
 * montagem e a jardinagem, fora da oferta desde 25-10), a app Pro sete, a
 * candidatura oito, a Mesa seis (sem a manutenção da casa) e o registo de
 * pedidos da Mesa trazia a montagem. E o perfil ainda tinha um campo
 * «Zonas» que o envio dos pedidos já não lia. Este teste chumba uma lista
 * que se afaste da fonte, e um campo de zonas que volte.
 */

const RAIZ = join(__dirname, "..", "..");
const cru = (f: string) => readFileSync(join(RAIZ, f), "utf8").replace(/\r\n/g, "\n");
/** Sem comentários: o que explica porque é que uma coisa saiu contém-na. */
const semNotas = (f: string) =>
  cru(f)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ");

describe("a lista única das categorias", () => {
  it("é esta, por esta ordem, com os nomes de NOMES_DOS_SERVICOS", () => {
    expect(CATEGORIAS_DOS_PROFISSIONAIS.map((c) => c.label)).toEqual([
      "Recolha de móveis",
      "Recolha de monos",
      "Recolha de entulho",
      "Esvaziamento de casa",
      "Esvaziamento de apartamento",
      "Mudança",
      "Manutenção da casa",
    ]);
    for (const c of CATEGORIAS_DOS_PROFISSIONAIS) expect(c.label).toBe(NOMES_DOS_SERVICOS[c.id]);
    for (const id of [...FORA_DO_PLANO, "outro"]) {
      expect(CATEGORIAS_DOS_PROFISSIONAIS.some((c) => c.id === id), id).toBe(false);
    }
  });

  it("o simulador e o catálogo da app de cliente são a mesma lista, com «Outro serviço» no fim", () => {
    expect(SERVICOS_PUBLICOS.map((c) => c.id)).toEqual([...CATEGORIAS_DOS_PROFISSIONAIS.map((c) => c.id), "outro"]);
    expect(semNotas("src/app/simulador/SimulatorThreePhaseForm.tsx")).toContain("SERVICOS_PUBLICOS.map((category) =>");
    expect(semNotas("src/lib/catalogo-da-app.ts")).toContain("servicos: SERVICOS_PUBLICOS.map((c) =>");
  });

  it("a app Pro escolhe da mesma lista (registo e perfil)", () => {
    expect(SERVICOS_DA_INSCRICAO).toBe(CATEGORIAS_DOS_PROFISSIONAIS);
    expect(semNotas("app-pro/src/app/registo.tsx")).toContain("{SERVICOS_DA_INSCRICAO.map((s) =>");
    expect(semNotas("app-pro/src/app/conta/servicos.tsx")).toContain("const escolhas = SERVICOS_DA_INSCRICAO;");
  });

  it("o perfil no backoffice, o painel, a inscrição e as candidaturas lêem da lista única", () => {
    expect(semNotas("src/components/admin/AdminProfissionaisPanel.tsx")).toContain(
      "const CATEGORIAS = CATEGORIAS_DOS_PROFISSIONAIS;",
    );
    expect(semNotas("src/app/profissionais/InscricaoForm.tsx")).toContain("const CATEGORIAS = CATEGORIAS_DOS_PROFISSIONAIS;");
    expect(semNotas("src/app/profissionais/painel/Perfil.tsx")).toContain("{CATEGORIAS_DOS_PROFISSIONAIS.map((c) =>");
    expect(semNotas("src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx")).toContain(
      "{CATEGORIAS_DOS_PROFISSIONAIS.map((c) =>",
    );
    expect(semNotas("src/components/admin/AdminCandidaturasPanel.tsx")).toContain(
      "{CATEGORIAS_DOS_PROFISSIONAIS.map((s) =>",
    );
  });

  it("a Mesa (detalhe, registo de pedidos, trabalhos) e os formulários do site usam a lista do simulador", () => {
    for (const f of [
      "src/components/admin/PedidoDetailModal.tsx",
      "src/app/admin/pedidos/[id]/AdminPedidoDetalheClient.tsx",
      "src/app/admin/trabalhos/AdminTrabalhosClient.tsx",
      "src/components/HeroQuoteForm.tsx",
      "src/app/trabalhos/TrabalhosGallery.tsx",
    ]) {
      expect(semNotas(f), f).toContain("SERVICOS_PUBLICOS.map((c) => ({ value: c.id, label: c.label }))");
    }
    expect(semNotas("src/components/admin/RegistarPedido.tsx")).toContain(
      "const SERVICOS = SERVICOS_PUBLICOS.map((c) => [c.id, c.label] as const);",
    );
    expect(semNotas("src/app/contactos/ContactosClient.tsx")).toContain("{SERVICOS_PUBLICOS.map((c) =>");
  });

  it("nenhuma lista de serviços escrita à mão no site nem nas apps", () => {
    const ficheiros: string[] = [];
    const andar = (d: string) => {
      for (const n of readdirSync(join(RAIZ, d))) {
        if (n === "node_modules" || n.startsWith(".")) continue;
        const p = `${d}/${n}`;
        if (statSync(join(RAIZ, p)).isDirectory()) andar(p);
        else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) ficheiros.push(p);
      }
    };
    for (const d of ["src", "app-pro/src", "app-cliente/src"]) andar(d);
    const maoEscrita = /value:\s*"recolha_moveis",\s*label:|<option value="recolha_moveis">|\["recolha_moveis",\s*"Recolha/;
    const culpados = ficheiros.filter((f) => maoEscrita.test(cru(f)));
    expect(culpados).toEqual([]);
  });
});

describe("as zonas saíram de todo o lado", () => {
  it("nenhum ecrã de edição tem o campo das zonas", () => {
    for (const f of [
      "src/components/admin/AdminProfissionaisPanel.tsx",
      "src/app/profissionais/InscricaoForm.tsx",
      "src/app/profissionais/painel/Perfil.tsx",
      "src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx",
      "app-pro/src/app/conta/servicos.tsx",
      "app-pro/src/app/registo.tsx",
    ]) {
      const s = semNotas(f);
      expect(s, f).not.toMatch(/zonas/i);
    }
  });

  it("as rotas não gravam zonas novas", () => {
    expect(semNotas("src/app/api/profissionais/perfil/route.ts")).not.toContain("mudancas.zonas");
    expect(semNotas("src/lib/edicao-profissional.ts")).not.toContain("alteracoes.zonas");
    expect(semNotas("src/app/api/admin/profissionais/[id]/route.ts")).not.toContain('"zonas"');
    expect(semNotas("src/lib/inscricao-profissional.ts")).not.toContain("c.zonas");
  });

  it("o motor do envio não lê zonas", () => {
    expect(semNotas("src/lib/profissional-elegivel.ts")).not.toMatch(/\.zonas\b/);
  });
});

describe("a regra do envio, escrita no perfil do backoffice", () => {
  it("diz as categorias e o raio", () => {
    expect(regraDoEnvio({ categorias: ["Recolha de móveis", "Mudança"], raioKm: 40, temPontoDaBase: true })).toBe(
      "Recebe pedidos destas categorias até 40 km da base: Recolha de móveis e Mudança.",
    );
  });

  it("diz porque é que não recebe nada", () => {
    expect(regraDoEnvio({ categorias: ["Mudança"], raioKm: 40, temPontoDaBase: false })).toMatch(/ponto no mapa/);
    expect(regraDoEnvio({ categorias: [], raioKm: 40, temPontoDaBase: true })).toMatch(/nenhuma categoria/);
    expect(
      regraDoEnvio({ categorias: ["Mudança"], raioKm: 40, temPontoDaBase: true, contaAprovada: false }),
    ).toMatch(/não está aprovada/);
  });

  it("«porque não recebeu o pedido #…» lê a distribuição do pedido", () => {
    const d = {
      receberam: [{ providerId: 1, negociacao: { estado: "aberta" }, distanciaKm: 12.34 }],
      naoReceberam: [{ providerId: 2, motivos: ["fora do raio dele"], distanciaKm: 61.2 }],
    };
    expect(porqueNaoRecebeu(500, 1, d)).toBe("Recebeu o pedido #500 (a 12,3 km da base) — está «aberta».");
    expect(porqueNaoRecebeu(500, 2, d)).toBe("Não recebeu o pedido #500 (a 61,2 km da base): fora do raio dele.");
    expect(porqueNaoRecebeu(500, 3, d)).toBe("Não aparece na distribuição do pedido #500.");
  });
});
