import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * d24 (10-11-2026) — as correcções baixas da Segurança, cada uma com o seu
 * teste. Dados de teste.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const NOSSO = "nossostoreteste.public.blob.vercel-storage.com";
const ENV = { CLYON_BLOB_HOST: NOSSO };

const conta: { p: Record<string, unknown> | undefined } = { p: undefined };

vi.mock("@/lib/admin-auth-helper", () => ({
  requireAdmin: vi.fn(async () => ({ err: null, colab: { id: 1, nome: "Equipa", papel: "admin" } })),
}));
vi.mock("@/lib/db", () => ({
  profissionalParaEntrar: vi.fn(async () => conta.p),
  registarAcessoDoProfissional: vi.fn(async () => {}),
}));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));

import { urlDoNossoBlob } from "./url-externo-seguro";
import { GET as fotoDoBackoffice } from "@/app/api/admin/fotos/route";
import { POST as entrar } from "@/app/api/profissionais/entrar/route";
import {
  DIAS_DO_LINK_DO_COMPROVATIVO,
  LINKS_ANTIGOS_ATE,
  lerTokenDoComprovativo,
  tokenDoComprovativo,
} from "./comprovativo-do-trabalho";
import {
  TAMANHO_MAXIMO_SEM_SESSAO,
  recusaDoEnvioSemSessao,
  tamanhoMaximoDoEnvio,
  tamanhoMaximoDoTipo,
} from "./tipo-ficheiro";
import crypto from "crypto";

describe("o formulário de contacto escapa o serviço no email", () => {
  it("o serviço passa pelo escape no HTML", () => {
    const ROTA = ler("src/app/api/contact/route.ts");
    expect(ROTA).toContain("${e(servico)}</p>");
    expect(ROTA).not.toMatch(/>\$\{servico\}</);
  });
});

describe("só endereços do NOSSO store (perfil e descarregar fotografias)", () => {
  it("o nosso passa; o de outro store, outro anfitrião ou http não", () => {
    expect(urlDoNossoBlob(`https://${NOSSO}/viaturas/a.jpg`, ENV)).toBe(`https://${NOSSO}/viaturas/a.jpg`);
    expect(urlDoNossoBlob("https://outrostore.public.blob.vercel-storage.com/a.jpg", ENV)).toBeNull();
    expect(urlDoNossoBlob("https://exemplo.pt/x.public.blob.vercel-storage.com/a.jpg", ENV)).toBeNull();
    expect(urlDoNossoBlob(`http://${NOSSO}/a.jpg`, ENV)).toBeNull();
    expect(urlDoNossoBlob("javascript:alert(1)", ENV)).toBeNull();
  });

  it("sem saber qual é o nosso, fica o sufixo do Blob público", () => {
    expect(urlDoNossoBlob("https://qualquer.public.blob.vercel-storage.com/a.jpg", {})).not.toBeNull();
    expect(urlDoNossoBlob("https://exemplo.pt/x.public.blob.vercel-storage.com/a.jpg", {})).toBeNull();
  });

  it("o perfil do parceiro grava a fotografia da viatura só por aí", () => {
    const PERFIL = ler("src/app/api/profissionais/perfil/route.ts");
    expect(PERFIL).toContain("else if (!urlDoNossoBlob(u)) {");
    expect(PERFIL).not.toContain('u.includes(".public.blob.vercel-storage.com/")');
  });

  describe("o descarregar do backoffice", () => {
    const antes = process.env.CLYON_BLOB_HOST;
    const pedido = (url: string) =>
      fotoDoBackoffice(new NextRequest(`https://clyon.pt/api/admin/fotos?url=${encodeURIComponent(url)}&nome=foto`));
    let buscar: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      process.env.CLYON_BLOB_HOST = NOSSO;
      buscar = vi.fn(async () => new Response("imagem", { headers: { "content-type": "image/jpeg" } }));
      vi.stubGlobal("fetch", buscar);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      if (antes === undefined) delete process.env.CLYON_BLOB_HOST;
      else process.env.CLYON_BLOB_HOST = antes;
    });

    it("recusa o Blob de outro store sem lhe tocar", async () => {
      const r = await pedido("https://outrostore.public.blob.vercel-storage.com/a.jpg");
      expect(r.status).toBe(400);
      expect(buscar).not.toHaveBeenCalled();
    });

    it("entrega a do nosso, sem seguir redirecções", async () => {
      const r = await pedido(`https://${NOSSO}/simulador/a.jpg`);
      expect(r.status).toBe(200);
      expect(r.headers.get("content-disposition")).toContain("attachment;");
      expect(buscar.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
    });
  });
});

describe("a entrada do parceiro não diz se a conta tem palavra-passe", () => {
  const tentar = () =>
    entrar(
      new NextRequest("https://clyon.pt/api/profissionais/entrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "parceiro.teste@exemplo.pt", palavraPasse: "qualquer-coisa-1" }),
      }),
    );

  beforeEach(() => {
    process.env.JWT_SECRET ||= "segredo-de-teste";
  });

  it("sem palavra-passe criada: o mesmo 401 de um email que não existe", async () => {
    conta.p = { id: 9, name: "Parceiro Teste", email: "parceiro.teste@exemplo.pt", estado: "aprovado", isActive: 1, passwordHash: null };
    const semPalavraPasse = await tentar();
    conta.p = undefined;
    const naoExiste = await tentar();
    expect(semPalavraPasse.status).toBe(401);
    expect(naoExiste.status).toBe(401);
    expect(await semPalavraPasse.json()).toEqual(await naoExiste.json());
  });

  it("o ecrã mostra a todos o caminho do link novo", () => {
    const FORM = ler("src/app/profissionais/entrar/EntrarForm.tsx");
    expect(FORM).toContain("if (res.status === 401) setSemPalavraPasse(true);");
    expect(FORM).toContain("Ainda não criou palavra-passe, ou esqueceu-se dela?");
  });
});

describe("o link do comprovativo: segredo próprio e prazo", () => {
  const antes = { jwt: process.env.JWT_SECRET, prop: process.env.COMPROVATIVO_SECRET };
  beforeEach(() => {
    process.env.JWT_SECRET = "segredo-de-teste";
    delete process.env.COMPROVATIVO_SECRET;
  });
  afterEach(() => {
    if (antes.jwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = antes.jwt;
    if (antes.prop === undefined) delete process.env.COMPROVATIVO_SECRET;
    else process.env.COMPROVATIVO_SECRET = antes.prop;
  });
  const hoje = new Date("2026-11-10T12:00:00Z");
  const dia = 86_400_000;

  it("abre dentro do prazo, e só o dele", () => {
    const t = tokenDoComprovativo(464, "cliente", hoje)!;
    expect(t).toMatch(/^464-c-[0-9a-z]+-[A-Za-z0-9_-]{32}$/);
    expect(lerTokenDoComprovativo(t, hoje)).toEqual({ negociacaoId: 464, para: "cliente" });
    expect(lerTokenDoComprovativo(t.replace("464-", "465-"), hoje)).toBeNull();
    expect(lerTokenDoComprovativo(t.replace("-c-", "-p-"), hoje)).toBeNull();
  });

  it("caduca ao fim do prazo, e mudar a data no link não o estica", () => {
    const t = tokenDoComprovativo(464, "cliente", hoje)!;
    const depois = new Date(hoje.getTime() + (DIAS_DO_LINK_DO_COMPROVATIVO + 1) * dia);
    expect(lerTokenDoComprovativo(t, depois)).toBeNull();
    const [, n, p, , a] = /^([0-9]+)-([cp])-([0-9a-z]+)-(.{32})$/.exec(t)!;
    const esticado = `${n}-${p}-${Math.floor(depois.getTime() / 1000 + 9 * dia).toString(36)}-${a}`;
    expect(lerTokenDoComprovativo(esticado, depois)).toBeNull();
  });

  it("não é assinado com o JWT_SECRET tal e qual", () => {
    const t = tokenDoComprovativo(464, "cliente", hoje)!;
    const caduca = /^[0-9]+-[cp]-([0-9a-z]+)-/.exec(t)![1];
    const comOJwt = crypto
      .createHmac("sha256", "segredo-de-teste")
      .update(`comprovativo:v2:464:cliente:${caduca}`)
      .digest("base64url")
      .slice(0, 32);
    expect(t.endsWith(comOJwt)).toBe(false);
    // Com COMPROVATIVO_SECRET, é esse que assina.
    process.env.COMPROVATIVO_SECRET = "outro-segredo-de-teste";
    expect(lerTokenDoComprovativo(t, hoje)).toBeNull();
    const novo = tokenDoComprovativo(464, "cliente", hoje)!;
    expect(lerTokenDoComprovativo(novo, hoje)).toEqual({ negociacaoId: 464, para: "cliente" });
  });

  it("os links antigos, sem prazo, abrem até LINKS_ANTIGOS_ATE e depois não", () => {
    const antigo = `464-c-${crypto
      .createHmac("sha256", "segredo-de-teste")
      .update("comprovativo:464:cliente")
      .digest("base64url")
      .slice(0, 24)}`;
    expect(lerTokenDoComprovativo(antigo, hoje)).toEqual({ negociacaoId: 464, para: "cliente" });
    expect(lerTokenDoComprovativo(antigo, new Date(LINKS_ANTIGOS_ATE.getTime() + 1000))).toBeNull();
    expect(lerTokenDoComprovativo("464-c-xxxxxxxxxxxxxxxxxxxxxxxx", hoje)).toBeNull();
  });
});

describe("o envio directo sem sessão", () => {
  const MB = 1024 * 1024;

  it("com sessão, os tectos de sempre", () => {
    expect(tamanhoMaximoDoEnvio("video/mp4", true)).toBe(tamanhoMaximoDoTipo("video/mp4"));
    expect(tamanhoMaximoDoEnvio("application/pdf", true)).toBe(25 * MB);
  });

  it("sem sessão: fotografias até 20 MB, vídeos até 50 MB, e nada de PDF", () => {
    expect(TAMANHO_MAXIMO_SEM_SESSAO).toEqual({ imagem: 20 * MB, video: 50 * MB, pdf: 0 });
    expect(tamanhoMaximoDoEnvio("image/jpeg", false)).toBe(20 * MB);
    expect(tamanhoMaximoDoEnvio("video/mp4", false)).toBe(50 * MB);
    expect(tamanhoMaximoDoEnvio("application/pdf", false)).toBe(0);
    expect(recusaDoEnvioSemSessao("video/mp4", 140 * MB)).toContain("o máximo para este tipo são 50 MB");
    expect(recusaDoEnvioSemSessao("application/pdf", 5 * MB)).toContain("Envie fotografias ou vídeos");
    expect(recusaDoEnvioSemSessao("image/heic", 8 * MB)).toBeNull();
    expect(recusaDoEnvioSemSessao("video/mp4", 45 * MB)).toBeNull();
  });

  it("as duas rotas do envio directo decidem o tecto pela sessão", () => {
    const TOKEN = ler("src/app/api/blob/token/route.ts");
    const PRESIGN = ler("src/app/api/blob/presign/route.ts");
    expect(TOKEN).toContain("await envioComSessao(req)");
    expect(TOKEN).toContain("tamanhoMaximoDoEnvio(veredicto.tipo, comSessao)");
    expect(PRESIGN).toContain("const comSessao = await envioComSessao(req);");
    expect(PRESIGN).toContain("recusaDoEnvioSemSessao(veredicto.tipo, tamanho)");
  });

  it("o backoffice manda a sua sessão ao enviar", () => {
    expect(ler("src/components/admin/RegistarPedido.tsx")).toContain("enviarFicheiro(original, { autorizacao: token ? `Bearer ${token}` : null })");
    expect(ler("src/components/admin/financas/FormularioDoMovimento.tsx")).toContain("enviarFicheiro(f, { autorizacao: token ? `Bearer ${token}` : null })");
    const ENVIO = ler("src/lib/enviar-ficheiro.ts");
    expect(ENVIO).toContain("headers: cabecalhosDoEnvio(o),");
    expect(ENVIO).toContain('headers: { "Content-Type": "application/json", ...cabecalhosDoEnvio(o) },');
  });

  it("a candidatura a parceiro tem a sua rota, imagem a imagem, e não depende disto", () => {
    const FORM = ler("src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx");
    expect(FORM).toContain('fetch("/api/parceiros/candidatura/fotografias", { method: "POST", body: fd })');
    expect(FORM).not.toContain("enviarFicheiro");
    const ROTA = ler("src/app/api/parceiros/candidatura/fotografias/route.ts");
    expect(ROTA).not.toContain("envioComSessao");
    expect(ROTA).toContain('veredicto.tipo.startsWith("image/")');
  });
});
