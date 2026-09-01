import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { especieDoAnexo, TIPOS_ACEITES, tipoDoFicheiro } from "./tipo-ficheiro";

/**
 * PDFs e vídeos, e não só fotografias.
 *
 * "No arquivo nós só aceitamos fotos, mas devemos aceitar também PDFs e
 * vídeos. Atualize isso com urgência."
 *
 * O caso que deu origem a isto é um ficheiro chamado «reportagem fotográfica e
 * notas.pdf»: várias fotos e um texto num documento só. Recusá-lo obrigava a
 * desmontá-lo em imagens à mão, e quem o faz vinte vezes por semana acaba por
 * mandar por WhatsApp — fora do pedido, onde ninguém o volta a encontrar.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("o que se aceita", () => {
  it("o PDF entra na lista", () => {
    expect(TIPOS_ACEITES).toContain("application/pdf");
  });

  it("os vídeos JÁ lá estavam — o que faltava era deixá-los escolher", () => {
    /*
     * Este é o detalhe que explica o "só aceitamos fotos": o servidor aceitava
     * vídeo há muito, mas o `accept="image/*"` do ecrã não os deixava sequer
     * aparecer no selector de ficheiros. Aceitava-se o que não se podia enviar.
     */
    for (const t of ["video/mp4", "video/quicktime", "video/webm"]) {
      expect(TIPOS_ACEITES).toContain(t);
    }
  });

  it("um PDF passa a validação, com tipo declarado ou só pela extensão", () => {
    // Certos browsers não declaram tipo nenhum — ver o cabeçalho do ficheiro.
    expect(tipoDoFicheiro("reportagem.pdf", "application/pdf")).toMatchObject({ ok: true });
    expect(tipoDoFicheiro("reportagem.pdf", "")).toMatchObject({ ok: true, origem: "extensao" });
  });

  it("e o que não está na lista continua de fora", () => {
    // A lista fechada é que manda. Isto não é um alargamento geral.
    expect(tipoDoFicheiro("virus.exe", "application/x-msdownload").ok).toBe(false);
    expect(tipoDoFicheiro("folha.xlsx", "").ok).toBe(false);
  });
});

describe("que espécie é cada anexo", () => {
  it("distingue as três", () => {
    expect(especieDoAnexo("foto.jpg")).toBe("imagem");
    expect(especieDoAnexo("obra.mp4")).toBe("video");
    expect(especieDoAnexo("reportagem fotografica e notas.pdf")).toBe("pdf");
  });

  it("aguenta a URL do armazenamento, com parâmetros atrás", () => {
    // O que fica guardado é uma URL, e vem com query string e âncoras.
    expect(
      especieDoAnexo("https://xyz.public.blob.vercel-storage.com/simulador/123-relatorio.pdf?v=2"),
    ).toBe("pdf");
    expect(especieDoAnexo("https://x.com/a/b/video.MOV#t=3")).toBe("video");
  });

  it("na dúvida, imagem — que é o caso de longe mais comum", () => {
    /*
     * Uma URL sem extensão acontece. Num `<img>` que falhe, o ecrã mostra o
     * texto alternativo; um PDF tratado como imagem daria o mesmo desfecho, e
     * este é o palpite que acerta quase sempre.
     */
    expect(especieDoAnexo("https://x.com/ficheiro-sem-extensao")).toBe("imagem");
    expect(especieDoAnexo(null)).toBe("imagem");
    expect(especieDoAnexo("")).toBe("imagem");
  });

  it("não se engana com um nome que contenha 'pdf' no meio", () => {
    // "manual-pdf-antigo.jpg" é uma fotografia.
    expect(especieDoAnexo("manual-pdf-antigo.jpg")).toBe("imagem");
  });
});

describe("os ecrãs deixam de barrar o que o servidor aceita", () => {
  it("os selectores de ficheiro abrem-se a vídeo e PDF", () => {
    for (const p of [
      "src/components/EnviarFotos.tsx",
      "src/components/admin/RegistarPedido.tsx",
    ]) {
      const F = ler(p);
      expect(F).toContain('accept="image/*,video/*,application/pdf"');
      expect(F).not.toContain('accept="image/*"');
    }
  });
});

describe("cada espécie mostra-se como deve", () => {
  const ANEXO = ler("src/components/Anexo.tsx");

  it("a imagem vai num <img>, o vídeo num <video>, o PDF num cartão com o nome", () => {
    /*
     * Um vídeo num `<img>` não aparece. Um PDF num `<img>` dá o ícone de
     * imagem partida com o texto alternativo ao lado — parece uma avaria, e
     * quem o vê pensa que o anexo se perdeu no envio.
     */
    expect(ANEXO).toContain('especie === "imagem" ? (');
    expect(ANEXO).toContain('especie === "video" ? (');
    expect(ANEXO).toContain("<video");
    expect(ANEXO).toContain("FileText");
  });

  it("o vídeo não descarrega megabytes para desenhar uma miniatura", () => {
    // `preload="metadata"` traz só o cabeçalho — o suficiente para a capa.
    expect(ANEXO).toContain('preload="metadata"');
  });

  it("o PDF mostra o NOME, que é a única coisa que o distingue", () => {
    // Numa fila de seis anexos, é o que separa "reportagem" de "orçamento".
    expect(ANEXO).toContain('(nome ?? "PDF")');
  });

  it("o visor grande sabe as três, e o PDF abre num iframe", () => {
    expect(ANEXO).toContain("export function AnexoGrande");
    expect(ANEXO).toContain("<iframe");
    expect(ANEXO).toContain("Abrir à parte");
  });
});

describe("nenhum ecrã ficou para trás", () => {
  /*
   * Cinco sítios mostravam estes ficheiros, todos com `<img src={url}>`. Um
   * que ficasse de fora dava a imagem partida só nesse — e ninguém repara num
   * ecrã que não usa todos os dias.
   */
  const ECRAS = [
    "src/app/profissionais/painel/Trabalhos.tsx",
    "src/app/pedido/[token]/PropostasRecebidas.tsx",
    "src/components/admin/AdminNegociacoesPanel.tsx",
    "src/app/profissionais/pedidos/[token]/page.tsx",
    "src/components/EnviarFotos.tsx",
    "src/components/admin/RegistarPedido.tsx",
  ];

  it.each(ECRAS)("%s usa a Miniatura", (p) => {
    expect(ler(p)).toContain("<Miniatura");
  });

  it("a mesa do backoffice já não tem <img> nenhum para anexos", () => {
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).not.toContain("<img");
  });

  it("o visor único passou a usar a peça partilhada", () => {
    const V = ler("src/components/VisorDeFotos.tsx");
    expect(V).toContain("<AnexoGrande");
    // A expressão regular própria dos vídeos saiu: não conhecia PDFs.
    expect(V).not.toContain("const eVideo =");
  });
});
