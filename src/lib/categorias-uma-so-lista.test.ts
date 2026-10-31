import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CATEGORIAS_DOS_PROFISSIONAIS,
  FORA_DO_PLANO,
  GRUPOS_DE_SERVICOS,
  SERVICOS_PUBLICOS,
  grupoDoServico,
  gruposDe,
  normalizarCategorias,
  servicosDasCategorias,
} from "./service-categories";
import { avaliarElegibilidade, type ProfissionalParaAvaliar } from "./profissional-elegivel";
import { planoDaMigracao } from "./categorias-em-grupos";
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

describe("a lista única: quatro grupos (29-10-2026)", () => {
  it("são estes, por esta ordem", () => {
    expect(CATEGORIAS_DOS_PROFISSIONAIS).toBe(GRUPOS_DE_SERVICOS);
    expect(GRUPOS_DE_SERVICOS.map((g) => g.label)).toEqual(["Recolhas", "Esvaziamentos", "Mudanças", "Manutenção da casa"]);
  });

  it("cada serviço que o cliente escolhe tem um grupo, e só um; montagem, jardinagem e «outro» não têm", () => {
    const doCliente = SERVICOS_PUBLICOS.map((c) => c.id).filter((id) => id !== "outro");
    for (const id of doCliente) {
      expect(grupoDoServico(id), id).not.toBeNull();
      expect(GRUPOS_DE_SERVICOS.filter((g) => g.servicos.includes(id)).length, id).toBe(1);
    }
    // Os grupos não têm serviços que o cliente não pode escolher (os «em breve» estão à parte).
    expect(GRUPOS_DE_SERVICOS.flatMap((g) => g.servicos).sort()).toEqual([...doCliente].sort());
    for (const id of [...FORA_DO_PLANO, "outro"]) expect(grupoDoServico(id), id).toBeNull();
    expect(grupoDoServico("recolha_entulho")).toBe("recolhas");
    expect(grupoDoServico("esvaziamento_apartamento")).toBe("esvaziamentos");
  });

  it("a garagem, o sótão e a cave são esvaziamentos e já se oferecem (29-10-2026)", () => {
    for (const id of ["esvaziamento_garagem", "esvaziamento_sotao", "esvaziamento_cave"]) {
      expect(grupoDoServico(id), id).toBe("esvaziamentos");
      expect(SERVICOS_PUBLICOS.some((c) => c.id === id), id).toBe(true);
    }
    expect(GRUPOS_DE_SERVICOS.every((g) => g.servicosEmBreve.length === 0)).toBe(true);
  });

  it("o simulador e o catálogo da app de cliente continuam com o serviço exacto", () => {
    expect(SERVICOS_PUBLICOS.map((c) => c.id)).toEqual([
      "recolha_moveis",
      "recolha_monos",
      "recolha_entulho",
      "esvaziamento_casa",
      "esvaziamento_apartamento",
      "esvaziamento_garagem",
      "esvaziamento_sotao",
      "esvaziamento_cave",
      "mudanca",
      "manutencao_casa",
      "outro",
    ]);
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

describe("as categorias gravadas, em grupos", () => {
  it("um serviço antigo passa ao seu grupo; montagem, jardinagem e «outro» ficam; o resto cai", () => {
    expect(normalizarCategorias(["recolha_monos", "mudanca", "recolha_moveis"])).toEqual(["recolhas", "mudancas"]);
    expect(normalizarCategorias(["jardinagem", "esvaziamento_casa", "inventada", "outro"])).toEqual([
      "esvaziamentos",
      "jardinagem",
      "outro",
    ]);
    expect(normalizarCategorias(["recolhas", "recolha_entulho"])).toEqual(["recolhas"]);
    expect(gruposDe(["montagem_moveis"])).toEqual([]);
  });

  it("as páginas públicas recebem os serviços dos grupos", () => {
    expect(servicosDasCategorias(["recolhas"])).toEqual(["recolha_moveis", "recolha_monos", "recolha_entulho"]);
    expect(servicosDasCategorias(["mudancas", "jardinagem"])).toEqual(["mudanca", "jardinagem"]);
  });
});

describe("o motor decide pelo grupo", () => {
  const pro = (categorias: string[]): ProfissionalParaAvaliar => ({
    id: 1,
    isActive: true,
    estado: "aprovado",
    categorias,
    raioKm: 30,
    emiteFatura: false,
    emiteGuiaTransporte: false,
    guiaVerificadaEm: null,
  });
  const pedido = (serviceType: string) => ({
    serviceType,
    precisaFatura: false,
    precisaGuiaTransporte: serviceType === "recolha_entulho",
    distanciaKm: 5,
    city: "Lisboa",
  });

  it("quem tem Recolhas recebe móveis, monos e entulho; não recebe mudanças", () => {
    for (const s of ["recolha_moveis", "recolha_monos", "recolha_entulho"]) {
      expect(avaliarElegibilidade(pedido(s), pro(["recolhas"])).elegivel, s).toBe(true);
    }
    expect(avaliarElegibilidade(pedido("mudanca"), pro(["recolhas"])).motivos).toContain("categoria_diferente");
  });

  it("um perfil ainda com serviços antigos conta pelo grupo", () => {
    expect(avaliarElegibilidade(pedido("esvaziamento_apartamento"), pro(["esvaziamento_casa"])).elegivel).toBe(true);
  });

  it("o entulho continua a avisar de que precisa da guia de transporte verificada", () => {
    expect(avaliarElegibilidade(pedido("recolha_entulho"), pro(["recolhas"])).avisos).toContain("trabalho_exige_guia");
  });

  it("a garagem, o sótão e a cave chegam a quem tem Esvaziamentos", () => {
    expect(avaliarElegibilidade(pedido("esvaziamento_garagem"), pro(["esvaziamentos"])).elegivel).toBe(true);
  });

  it("um serviço sem grupo só chega a quem o tem gravado, como antes", () => {
    expect(avaliarElegibilidade(pedido("montagem_moveis"), pro(["manutencao_da_casa"])).elegivel).toBe(false);
    expect(avaliarElegibilidade(pedido("montagem_moveis"), pro(["recolhas", "montagem_moveis"])).elegivel).toBe(true);
    expect(avaliarElegibilidade(pedido("outro"), pro(["recolhas"])).elegivel).toBe(false);
    expect(avaliarElegibilidade(pedido("outro"), pro(["recolhas", "outro"])).elegivel).toBe(true);
  });

  it("o «Outro serviço» chega também a quem tem Manutenção da casa (d6, 31-10-2026)", () => {
    expect(avaliarElegibilidade(pedido("outro"), pro(["manutencao_da_casa"])).elegivel).toBe(true);
    // Um perfil antigo com o serviço, e não o grupo, conta pelo grupo.
    expect(avaliarElegibilidade(pedido("outro"), pro(["manutencao_casa"])).elegivel).toBe(true);
    // Com as regras de sempre: fora do raio, ou por aprovar, não recebe.
    expect(avaliarElegibilidade({ ...pedido("outro"), distanciaKm: 80 }, pro(["manutencao_da_casa"])).motivos).toEqual([
      "fora_de_alcance",
    ]);
    expect(
      avaliarElegibilidade(pedido("outro"), { ...pro(["manutencao_da_casa"]), estado: "pendente" }).motivos,
    ).toEqual(["nao_aprovado"]);
    // E o grupo do «outro» não muda: quem o tem gravado não passa a fazer reparações.
    expect(grupoDoServico("outro")).toBeNull();
    expect(normalizarCategorias(["outro"])).toEqual(["outro"]);
  });
});

describe("a migração dos dados (com cópia antes)", () => {
  it("converte só quem muda, e diz quem passa a receber mais serviços", () => {
    const plano = planoDaMigracao([
      { id: 1, categorias: JSON.stringify(["recolha_moveis"]) },
      { id: 2, categorias: JSON.stringify(["recolha_moveis", "recolha_monos", "recolha_entulho"]) },
      { id: 3, categorias: JSON.stringify(["recolhas"]) },
      { id: 4, categorias: JSON.stringify(["montagem_moveis", "jardinagem"]) },
      { id: 5, categorias: null },
      { id: 6, categorias: JSON.stringify(["mudanca", "jardinagem"]) },
    ]);
    expect(plano.map((m) => m.providerId)).toEqual([1, 2, 6]);
    const [um, dois, seis] = plano;
    expect(um.depois).toEqual(["recolhas"]);
    expect(um.ganhaServicos).toBe(true);
    expect(um.servicosNovos).toEqual(["recolha_monos", "recolha_entulho"]);
    expect(dois.depois).toEqual(["recolhas"]);
    expect(dois.ganhaServicos).toBe(false);
    expect(seis.depois).toEqual(["mudancas", "jardinagem"]);
    expect(seis.ganhaServicos).toBe(false);
  });

  it("a cópia é feita antes de mudar a linha, e nunca reescrita", () => {
    const fonte = cru("src/lib/categorias-em-grupos.ts");
    const copia = fonte.indexOf("INSERT IGNORE INTO ${TABELA_DA_COPIA}");
    const muda = fonte.indexOf("UPDATE providers SET categorias = ?");
    expect(copia).toBeGreaterThan(-1);
    expect(muda).toBeGreaterThan(copia);
    expect(cru("src/lib/db.ts")).toContain("await migrarCategoriasParaGrupos(");
  });

  it("todas as gravações guardam grupos", () => {
    expect(semNotas("src/lib/db.ts")).toContain("JSON.stringify(normalizarCategorias(dados.categorias))");
    expect(semNotas("src/lib/db.ts")).toContain("JSON.stringify(normalizarCategorias(alteracoes.categorias))");
    for (const f of [
      "src/lib/inscricao-profissional.ts",
      "src/lib/edicao-profissional.ts",
      "src/app/api/profissionais/perfil/route.ts",
      "src/app/api/parceiros/candidatura/route.ts",
      "src/app/api/admin/candidaturas/route.ts",
    ]) {
      expect(semNotas(f), f).toContain("categoriasDoCorpo(");
    }
  });
});
