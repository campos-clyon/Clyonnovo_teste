import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * AS FOTOGRAFIAS DA CARRINHA NA CANDIDATURA — 04-11-2026 (decisão d17).
 *
 * «Quero que os candidatos a pro enviem imagens dos veículos.» — o dono.
 *
 * O que estes testes guardam, pela ordem da decisão:
 *   1. a candidatura sem fotografia é recusada NO SERVIDOR (a rota é pública,
 *      e qualquer um a chama sem passar pelo formulário);
 *   2. aceita de 1 a 4, e só endereços do nosso envio;
 *   3. as fotografias não aparecem em nenhuma rota pública nem nos ecrãs do
 *      cliente — são só para a equipa.
 */

vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
}));
vi.mock("@/lib/candidaturas", () => ({
  guardarCandidatura: vi.fn(async () => ({ id: 1, repetida: false, orfas: [] as string[] })),
}));
vi.mock("@/lib/db", () => ({
  apagarFotosDoBlob: vi.fn(async (urls: string[]) => urls.length),
}));

import { POST } from "@/app/api/parceiros/candidatura/route";
import { guardarCandidatura } from "@/lib/candidaturas";
import { apagarFotosDoBlob } from "@/lib/db";
import {
  fotografiaDaCandidatura,
  lerFotografiasDaCandidatura,
  MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA,
  MENSAGEM_FOTOGRAFIA_ESTRANHA,
  MENSAGEM_FOTOGRAFIAS_A_MAIS,
  MENSAGEM_SEM_FOTOGRAFIA,
  MENSAGEM_SEM_FOTOGRAFIA_NA_APP,
  MINIMO_DE_FOTOGRAFIAS_DA_CARRINHA,
  AJUDA_DAS_FOTOGRAFIAS_DA_CARRINHA,
  ROTULO_DAS_FOTOGRAFIAS_DA_CARRINHA,
} from "./fotografias-da-carrinha";

const LOJA = "loja1abc.public.blob.vercel-storage.com";
const foto = (n: number) => `https://${LOJA}/candidaturas/0000000${n}-aaaa-bbbb-cccc-dddddddddddd.jpg`;

/** Uma candidatura que só falha pelas fotografias. */
const CORPO = {
  nome: "Transportes e Mudanças, Lda.",
  email: "candidato@exemplo.pt",
  telefone: "912345678",
  cidade: "Seixal",
  tipoVeiculo: "carrinha_media",
  servicos: ["recolhas"],
  mensagem: null,
};

function pedido(corpo: unknown, cabecalhos: Record<string, string> = {}) {
  return new NextRequest("https://clyon.pt/api/parceiros/candidatura", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cabecalhos },
    body: JSON.stringify(corpo),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CLYON_BLOB_HOST", LOJA);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("1. sem fotografia, a candidatura não segue — no servidor", () => {
  it("sem o campo: 400, com a mensagem nova no campo das fotografias, e nada gravado", async () => {
    const r = await POST(pedido(CORPO));
    expect(r.status).toBe(400);
    const d = await r.json();
    expect(d.erros).toContainEqual({ campo: "fotografias", mensagem: MENSAGEM_SEM_FOTOGRAFIA });
    expect(guardarCandidatura).not.toHaveBeenCalled();
  });

  it("com a lista vazia, o mesmo", async () => {
    const r = await POST(pedido({ ...CORPO, fotografiasDoVeiculo: [] }));
    expect(r.status).toBe(400);
    expect((await r.json()).erros).toContainEqual({ campo: "fotografias", mensagem: MENSAGEM_SEM_FOTOGRAFIA });
    expect(guardarCandidatura).not.toHaveBeenCalled();
  });

  it("um corpo vazio diz também o das fotografias, ao lado dos outros", async () => {
    const r = await POST(pedido({}));
    expect(r.status).toBe(400);
    const campos = ((await r.json()).erros as Array<{ campo: string }>).map((e) => e.campo);
    expect(campos).toContain("fotografias");
    expect(campos).toContain("nome");
  });

  it("a mensagem é clara: diz o que juntar, e que sem ela não segue", () => {
    expect(MENSAGEM_SEM_FOTOGRAFIA).toContain("fotografia da carrinha");
    expect(MENSAGEM_SEM_FOTOGRAFIA).toContain("não segue");
  });

  it("a app (que ainda não tem o campo) recebe uma mensagem geral, que mostra, e não um erro sem sítio", async () => {
    const r = await POST(pedido(CORPO, { "x-app-versao": "0.1.0 (abc)" }));
    expect(r.status).toBe(400);
    const d = await r.json();
    expect(d.error).toBe(MENSAGEM_SEM_FOTOGRAFIA_NA_APP);
    expect(d.erros).toBeUndefined();
    expect(MENSAGEM_SEM_FOTOGRAFIA_NA_APP).toContain("clyon.pt/quero-ser-parceiro");
    expect(guardarCandidatura).not.toHaveBeenCalled();
  });
});

describe("2. aceita de 1 a 4, e só as do nosso envio", () => {
  it("os números são 1 e 4", () => {
    expect(MINIMO_DE_FOTOGRAFIAS_DA_CARRINHA).toBe(1);
    expect(MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA).toBe(4);
  });

  it.each([1, 2, 3, 4])("%i fotografia(s): grava, e passa-as à base", async (n) => {
    const fotos = Array.from({ length: n }, (_, i) => foto(i + 1));
    const r = await POST(pedido({ ...CORPO, fotografiasDoVeiculo: fotos }));
    expect(r.status).toBe(200);
    expect(guardarCandidatura).toHaveBeenCalledTimes(1);
    expect(vi.mocked(guardarCandidatura).mock.calls[0][0].fotografiasDoVeiculo).toEqual(fotos);
  });

  it("a resposta não devolve as fotografias: só ok e repetida", async () => {
    const r = await POST(pedido({ ...CORPO, fotografiasDoVeiculo: [foto(1)] }));
    expect(Object.keys(await r.json()).sort()).toEqual(["ok", "repetida"]);
  });

  it("5 é demais: 400, e nada gravado", async () => {
    const fotos = Array.from({ length: 5 }, (_, i) => foto(i + 1));
    const r = await POST(pedido({ ...CORPO, fotografiasDoVeiculo: fotos }));
    expect(r.status).toBe(400);
    expect((await r.json()).erros).toContainEqual({ campo: "fotografias", mensagem: MENSAGEM_FOTOGRAFIAS_A_MAIS });
    expect(guardarCandidatura).not.toHaveBeenCalled();
  });

  it("repetidas contam uma vez", () => {
    const r = lerFotografiasDaCandidatura([foto(1), foto(1)], { CLYON_BLOB_HOST: LOJA });
    expect(r).toEqual({ ok: true, fotos: [foto(1)] });
  });

  it.each([
    ["outro store", `https://outra.public.blob.vercel-storage.com/candidaturas/a.jpg`],
    ["a pasta dos pedidos", `https://${LOJA}/simulador/sofa.jpg`],
    ["a pasta das viaturas de outro", `https://${LOJA}/viaturas/7-1.jpg`],
    ["http em claro", `http://${LOJA}/candidaturas/a.jpg`],
    ["outro servidor", "https://exemplo.pt/candidaturas/a.jpg"],
    ["com parâmetros", `https://${LOJA}/candidaturas/a.jpg?x=1`],
    ["um PDF", `https://${LOJA}/candidaturas/a.pdf`],
    ["um javascript:", "javascript:alert(1)"],
    ["um número", 7],
  ])("recusa %s", async (_, valor) => {
    expect(fotografiaDaCandidatura(valor, { CLYON_BLOB_HOST: LOJA })).toBeNull();
    const r = await POST(pedido({ ...CORPO, fotografiasDoVeiculo: [foto(1), valor] }));
    expect(r.status).toBe(400);
    expect((await r.json()).erros).toContainEqual({ campo: "fotografias", mensagem: MENSAGEM_FOTOGRAFIA_ESTRANHA });
    expect(guardarCandidatura).not.toHaveBeenCalled();
  });

  it("sem saber o store, aceita o Blob público — mas só a pasta das candidaturas", () => {
    expect(fotografiaDaCandidatura(foto(1), {})).toBe(foto(1));
    expect(fotografiaDaCandidatura(`https://${LOJA}/simulador/a.jpg`, {})).toBeNull();
  });

  it("quem se candidata outra vez troca-as: as da vez anterior saem do Blob depois de gravar", async () => {
    vi.mocked(guardarCandidatura).mockResolvedValueOnce({ id: 3, repetida: true, orfas: [foto(9)] });
    const r = await POST(pedido({ ...CORPO, fotografiasDoVeiculo: [foto(1)] }));
    expect(r.status).toBe(200);
    expect(apagarFotosDoBlob).toHaveBeenCalledWith([foto(9)]);
  });
});

// ── O que se lê no código ───────────────────────────────────────────────────

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const ficheirosEm = (pasta: string): string[] =>
  readdirSync(join(process.cwd(), pasta)).flatMap((nome) => {
    const caminho = `${pasta}/${nome}`;
    if (statSync(join(process.cwd(), caminho)).isDirectory()) return ficheirosEm(caminho);
    return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });

/** Tudo o que lê ou mexe nas fotografias da carrinha — da candidatura ou do perfil. */
const FOTOGRAFIAS =
  /fotografiasDoVeiculo|fotosViatura|fotoViaturaUrl|fotosDaViatura|guardarFotosDaViatura|lerFotos\(|PREFIXO_DAS_FOTOGRAFIAS_DA_CANDIDATURA|listarCandidaturas|candidaturaPorId/;

describe("3. as fotografias não aparecem em nenhuma rota pública", () => {
  /*
   * A LISTA DOS QUE PODEM — e porquê cada um. Uma rota ou um ecrã novo que as
   * leia chumba aqui, e tem de entrar na lista com a razão: é nesse momento
   * que vale a pena pensar se o cliente as vai ver.
   */
  const PODEM: Record<string, string> = {
    // O backoffice: atrás de requireAdmin (verificado abaixo).
    "src/app/api/admin/candidaturas/route.ts": "admin",
    "src/app/api/admin/profissionais/route.ts": "admin",
    "src/components/admin/AdminCandidaturasPanel.tsx": "ecrã do backoffice",
    "src/components/admin/AdminProfissionaisPanel.tsx": "ecrã do backoffice",
    // O parceiro, as dele, com a sessão dele (verificado abaixo).
    "src/app/api/profissionais/perfil/route.ts": "sessão do parceiro",
    "src/app/api/profissionais/foto-viatura/route.ts": "sessão do parceiro",
    "src/app/profissionais/painel/Perfil.tsx": "painel do parceiro",
    "src/app/profissionais/painel/CartaoDoPerfil.tsx": "painel do parceiro",
    "src/app/profissionais/painel/tipos.ts": "painel do parceiro",
    // Quem se candidata: só ENVIA, e só vê as que ele próprio juntou.
    "src/app/api/parceiros/candidatura/route.ts": "pública, só recebe",
    "src/app/api/parceiros/candidatura/fotografias/route.ts": "pública, só recebe",
    "src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx": "o formulário de quem se candidata",
  };

  const TODOS = [...ficheirosEm("src/app"), ...ficheirosEm("src/components")];

  it("ninguém fora da lista lê as fotografias", () => {
    expect(TODOS.length).toBeGreaterThan(100);
    const lêem = TODOS.filter((f) => FOTOGRAFIAS.test(semNotas(ler(f))));
    expect(lêem.filter((f) => !(f in PODEM))).toEqual([]);
  });

  it("as rotas do backoffice exigem o admin, e as do parceiro a sessão dele", () => {
    for (const [f, porque] of Object.entries(PODEM)) {
      if (porque === "admin") expect(ler(f), f).toContain("requireAdmin(req)");
      if (porque === "sessão do parceiro") expect(ler(f), f).toContain("sessaoActivaDoProfissional(");
    }
  });

  it("as rotas públicas da candidatura nunca devolvem a lista guardada", () => {
    // A da candidatura responde só { ok, repetida } (provado acima pelo comportamento).
    const ROTA = semNotas(ler("src/app/api/parceiros/candidatura/route.ts"));
    expect(ROTA).toContain("NextResponse.json({ ok: true, repetida })");
    expect(ROTA).not.toMatch(/listarCandidaturas|candidaturaPorId|fotosDaViatura/);
    // O envio devolve só o endereço do ficheiro que acabou de subir, a quem o subiu.
    const ENVIO = semNotas(ler("src/app/api/parceiros/candidatura/fotografias/route.ts"));
    expect(ENVIO).toContain("NextResponse.json({ ok: true, url: blob.url })");
    expect(ENVIO).not.toMatch(/listarCandidaturas|candidaturaPorId|fotosDaViatura|getPool/);
  });

  it("o perfil público e as propostas que o cliente vê não as lêem", () => {
    const COLUNAS = /fotoViatura|fotosViatura|fotografiasDoVeiculo/;
    for (const f of [
      ...ficheirosEm("src/app/pedido"),
      ...ficheirosEm("src/app/profissionais/[slug]"),
      "src/lib/perfil-publico-do-profissional.ts",
    ]) {
      expect(ler(f), f).not.toMatch(COLUNAS);
    }
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function negociacoesDoPedido(");
    expect(i).toBeGreaterThan(-1);
    const fim = DB.slice(i + 1).search(/\r?\nexport /);
    expect(DB.slice(i, i + 1 + fim)).not.toMatch(COLUNAS);
  });
});

describe("o envio das fotografias da candidatura", () => {
  const ENVIO = ler("src/app/api/parceiros/candidatura/fotografias/route.ts");

  it("tem limite por endereço, como o das fotografias dos pedidos", () => {
    expect(ENVIO).toContain('limitarRotaPublica(req, "candidatura-fotografias", 10, 300)');
    expect(ler("src/app/api/simulador/upload-fotos/route.ts")).toContain("10, 300)");
  });

  it("os mesmos tipos e o mesmo tecto, só imagens", () => {
    expect(ENVIO).toContain("tipoDoFicheiro(ficheiro.name, ficheiro.type)");
    expect(ENVIO).toContain('veredicto.tipo.startsWith("image/")');
    expect(ENVIO).toContain("tamanhoMaximoDoTipo(veredicto.tipo)");
  });

  it("grava na pasta das candidaturas, com um nome que não se adivinha, e confere tudo antes de subir", () => {
    expect(ENVIO).toContain("`${PREFIXO_DAS_FOTOGRAFIAS_DA_CANDIDATURA}${randomUUID()}.${extensao}`");
    const sobe = ENVIO.indexOf("await put(");
    for (const antes of ["limitarRotaPublica(", "tipoDoFicheiro(", "tamanhoMaximoDoTipo("]) {
      expect(ENVIO.indexOf(antes), antes).toBeGreaterThan(-1);
      expect(ENVIO.indexOf(antes), antes).toBeLessThan(sobe);
    }
  });

  it("a limpeza dos órfãos dos pedidos não lhes toca (só lê simulador/ e trabalhos/)", () => {
    expect(ler("src/lib/regras-novas-da-retencao.ts")).toContain(
      'PREFIXOS_DOS_FICHEIROS_DE_PEDIDOS = ["simulador/", "trabalhos/"]',
    );
  });
});

describe("o formulário, o backoffice e o perfil", () => {
  const FORM = semNotas(ler("src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx"));

  it("o campo tem o nome e a ajuda da ordem (d17 v2), a mesma no formulário e no perfil", () => {
    expect(ROTULO_DAS_FOTOGRAFIAS_DA_CARRINHA).toBe("Fotografias da carrinha");
    expect(AJUDA_DAS_FOTOGRAFIAS_DA_CARRINHA).toBe(
      "Por fora e a caixa de carga, para sabermos o que a sua carrinha leva. O cliente não as vê.",
    );
    // A v1 prometia aos clientes o que eles nunca vêem: não volta.
    expect(AJUDA_DAS_FOTOGRAFIAS_DA_CARRINHA).not.toMatch(/clientes saberem|cliente vê/);
    expect(FORM).toContain("{ROTULO_DAS_FOTOGRAFIAS_DA_CARRINHA} *");
    expect(FORM).toContain("{AJUDA_DAS_FOTOGRAFIAS_DA_CARRINHA}");
    expect(ler("src/app/profissionais/painel/Perfil.tsx")).toContain("ajuda={AJUDA_DAS_FOTOGRAFIAS_DA_CARRINHA}");
  });

  it("manda as fotografias, e não envia sem nenhuma", () => {
    expect(FORM).toContain("fotografiasDoVeiculo: fotografias,");
    expect(FORM).toContain('fetch("/api/parceiros/candidatura/fotografias"');
    const i = FORM.indexOf("async function enviar()");
    const pede = FORM.indexOf('fetch("/api/parceiros/candidatura",', i);
    const trava = FORM.indexOf("if (fotografias.length === 0)", i);
    expect(trava).toBeGreaterThan(i);
    expect(pede).toBeGreaterThan(trava);
  });

  it("o resto não muda: a zona e a origem continuam a ir", () => {
    expect(FORM).toContain('.get("zona")');
    expect(FORM).toContain("origemParaACandidatura(");
  });

  it("o cartão da candidatura mostra-as em miniatura, que abrem em grande", () => {
    const PAINEL = semNotas(ler("src/components/admin/AdminCandidaturasPanel.tsx"));
    expect(PAINEL).toContain("<Miniatura");
    expect(PAINEL).toContain("<VisorDeFotos");
    expect(PAINEL).toContain("setAVer({ lista: c.fotografiasDoVeiculo ?? [], i })");
  });

  it("aprovar passa-as para a conta, e a ficha mostra-as", () => {
    const ROTA = ler("src/app/api/admin/candidaturas/route.ts");
    const cria = ROTA.indexOf("await criarProfissional(");
    const passa = ROTA.indexOf("guardarFotosDaViatura(providerId, candidatura.fotografiasDoVeiculo)");
    expect(cria).toBeGreaterThan(-1);
    expect(passa).toBeGreaterThan(cria);
    expect(ler("src/components/admin/AdminProfissionaisPanel.tsx")).toContain("fotosDaViatura.map(");
  });

  it("o perfil chama-lhe «A minha carrinha», com o tecto de 4 e o triângulo do passo por fazer", () => {
    const PERFIL = ler("src/app/profissionais/painel/Perfil.tsx");
    expect(PERFIL).toContain('etiqueta="A minha carrinha"');
    expect(PERFIL).toContain("const MAXIMO_DE_VIATURAS = MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA;");
    expect(PERFIL).toContain('falta={porque("fotografias-da-carrinha")}');
    expect(ler("src/lib/db.ts")).toContain("export const MAX_FOTOS_DA_VIATURA = MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA;");
  });

  it("descer o tecto de 6 para 4 não apaga as de quem já tinha mais", () => {
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function guardarFotosDaViatura(");
    const corpo = DB.slice(i, DB.indexOf("\nexport ", i + 1));
    expect(corpo).toContain("Math.max(MAX_FOTOS_DA_VIATURA, antes.length)");
    expect(corpo).toContain(".slice(0, tecto)");
  });

  it("a coluna nova segue o padrão: no CREATE e num ALTER que tolera a segunda vez", () => {
    const LIB = ler("src/lib/candidaturas.ts");
    expect(LIB).toContain("fotografiasDoVeiculoJson TEXT NULL DEFAULT NULL,");
    expect(LIB).toContain(
      "ALTER TABLE candidaturasProfissionais ADD COLUMN fotografiasDoVeiculoJson TEXT NULL DEFAULT NULL",
    );
  });
});
