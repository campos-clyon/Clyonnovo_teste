import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TAMANHO_MAXIMO_POR_ESPECIE,
  tamanhoMaximoDoTipo,
  tiposDaMesmaEspecie,
} from "./tipo-ficheiro";
import { urlDeAnexoPermitido } from "./url-externo-seguro";

/**
 * O ARMAZENAMENTO PÚBLICO DEIXA DE SER UM DISCO À BORLA.
 *
 * A rota que assina envios é pública (o simulador corre sem conta). Assinava
 * 300 MB para qualquer tipo, sessenta vezes em dez minutos por IP, num
 * caminho previsível — `simulador/<hora>-<nome>` num armazenamento público.
 * E as rotas do pedido gravavam o endereço de anexo que o browser mandasse.
 */

const semComentarios = (f: string) =>
  f.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
const lerNu = (p: string) => semComentarios(readFileSync(join(process.cwd(), p), "utf8"));
const MB = 1024 * 1024;

describe("o tecto é o do tipo", () => {
  it("imagem 50, PDF 25, vídeo 150 MB", () => {
    expect(tamanhoMaximoDoTipo("image/jpeg")).toBe(50 * MB);
    expect(tamanhoMaximoDoTipo("image/heic")).toBe(50 * MB);
    expect(tamanhoMaximoDoTipo("application/pdf")).toBe(25 * MB);
    expect(tamanhoMaximoDoTipo("video/mp4")).toBe(150 * MB);
    expect(tamanhoMaximoDoTipo("video/quicktime")).toBe(150 * MB);
  });

  it("nunca recusa o que os formulários deixam escolher", () => {
    /*
     * O simulador e o formulário da plataforma aceitam imagens E vídeos até
     * `maxSizeMB`. Se o servidor tivesse um tecto abaixo disso, o ecrã deixava
     * escolher um ficheiro que depois morria no envio.
     */
    const limitesDosEcras = [
      "src/app/simulador/components/CompactOrderDetails.tsx",
      "src/app/plataforma/pedir/components/CompactOrderDetails.tsx",
      "src/app/simulador/SimulatorThreePhaseForm.tsx",
      "src/app/plataforma/pedir/FormularioDePedido.tsx",
    ].flatMap((f) =>
      [...lerNu(f).matchAll(/maxSizeMB(?:\s*=\s*|=\{)(\d+)/g)].map((m) => Number(m[1])),
    );
    expect(limitesDosEcras.length).toBeGreaterThanOrEqual(4);
    for (const mb of limitesDosEcras) {
      expect(mb * MB).toBeLessThanOrEqual(TAMANHO_MAXIMO_POR_ESPECIE.imagem);
      expect(mb * MB).toBeLessThanOrEqual(TAMANHO_MAXIMO_POR_ESPECIE.video);
    }
  });

  it("a mesma espécie, e só ela", () => {
    const videos = tiposDaMesmaEspecie("video/mp4");
    expect(videos).toContain("video/quicktime");
    expect(videos).not.toContain("image/jpeg");
    expect(tiposDaMesmaEspecie("application/pdf")).toEqual(["application/pdf"]);
  });
});

describe("a assinatura pública", () => {
  const PRESIGN = lerNu("src/app/api/blob/presign/route.ts");
  const TOKEN = lerNu("src/app/api/blob/token/route.ts");

  it("o caminho leva um UUID, e não a hora", () => {
    expect(PRESIGN).toContain("simulador/${randomUUID()}-${nomeSeguro(nome)}");
    expect(PRESIGN).not.toContain("simulador/${Date.now()}");
    // No envio directo do SDK é o sufixo aleatório que faz o mesmo.
    expect(TOKEN).toContain("addRandomSuffix: true");
  });

  it("só o tipo apurado, com o tecto desse tipo", () => {
    expect(PRESIGN).toContain("allowedContentTypes: [veredicto.tipo]");
    expect(PRESIGN).toContain("maximumSizeInBytes: maximo");
    expect(TOKEN).toContain("allowedContentTypes: tiposDaMesmaEspecie(veredicto.tipo)");
    expect(TOKEN).toContain("maximumSizeInBytes: tamanhoMaximoDoTipo(veredicto.tipo)");
    for (const rota of [PRESIGN, TOKEN]) {
      expect(rota).not.toContain("300 * 1024 * 1024");
    }
  });

  it("trinta por hora e por IP", () => {
    for (const rota of [PRESIGN, TOKEN]) {
      expect(rota).toContain("ENVIOS_POR_HORA = 30");
      expect(rota).toContain("JANELA_SEGUNDOS = 60 * 60");
    }
    // No envio directo, só os pedidos de autorização contam — o aviso de fim
    // de envio vem dos servidores da Vercel, todos do mesmo IP.
    expect(TOKEN).toContain('corpo?.type === "blob.generate-client-token"');
  });
});

describe("os anexos de um pedido só podem ser nossos", () => {
  it("aceita o armazenamento público do Vercel Blob", () => {
    const bom = "https://abc123.public.blob.vercel-storage.com/simulador/foto.jpg";
    expect(urlDeAnexoPermitido(bom)).toBe(bom);
    expect(urlDeAnexoPermitido(`  ${bom}  `)).toBe(bom);
  });

  it("deita fora o resto", () => {
    for (const mau of [
      "javascript:alert(1)",
      "http://abc123.public.blob.vercel-storage.com/x.jpg",
      "https://outro.com/x.jpg",
      "https://abc123.public.blob.vercel-storage.com.outro.com/x.jpg",
      "https://eu:segredo@abc123.public.blob.vercel-storage.com/x.jpg",
      "https://abc123.public.blob.vercel-storage.com:8443/x.jpg",
      "/simulador/x.jpg",
      "",
      null,
      42,
    ]) {
      expect(urlDeAnexoPermitido(mau), String(mau)).toBeNull();
    }
  });

  it("as duas rotas públicas que gravam pedidos passam por ele", () => {
    const PEDIDO = lerNu("src/app/api/simulador/pedido/route.ts");
    expect(PEDIDO).toContain("urlDeAnexoPermitido(rec.url ?? rec.path)");
    expect(PEDIDO).not.toContain("url: rec.url ?? rec.path ?? null");
    expect(lerNu("src/app/api/hero-quote/route.ts")).toContain("urlDeAnexoPermitido(f.url)");
  });
});
