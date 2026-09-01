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

describe("quando o envio de um ficheiro grande falha, a mensagem diz porquê", () => {
  const ENVIAR = ler("src/lib/enviar-ficheiro.ts");

  it("pergunta à rota o motivo — o SDK não o diz", () => {
    /*
     * Quando a autorização falha, o `upload()` do Vercel lança sempre a mesma
     * frase: "Failed to retrieve the client token". O CORPO da resposta, que é
     * onde está o motivo, fica pelo caminho.
     *
     * Havia aqui um `bruto.includes("ENVIO_DIRECTO_INDISPONIVEL")` que NUNCA
     * podia acertar: procurava um texto que a mensagem do SDK nunca contém. A
     * explicação estava escrita e pronta a três linhas de distância, e nunca
     * chegou a ninguém — foi o que aconteceu com o
     * "reportagem fotografica e notas.pdf".
     */
    expect(ENVIAR).toContain("/client token|failed to retrieve/i");
    expect(ENVIAR).toContain('d?.error === "ENVIO_DIRECTO_INDISPONIVEL"');
  });

  it("e diz o tamanho, o limite e o que falta configurar", () => {
    // "Falhou" manda quem lê procurar no sítio errado — foi o que nos custou
    // três dias no 413.
    expect(ENVIAR).toContain("acima de 4 MB precisam");
    expect(ENVIAR).toContain("BLOB_READ_WRITE_TOKEN");
  });

  it("distingue o limite de ritmo de uma falta de configuração", () => {
    // São dois problemas com remédios opostos: um espera-se, o outro configura-se.
    expect(ENVIAR).toContain("r.status === 429");
    expect(ENVIAR).toContain("Espere um minuto");
  });

  it("sem resposta da rota, mostra a mensagem crua com o tamanho", () => {
    // Melhor um erro técnico com o tamanho do que um erro técnico sozinho.
    expect(ENVIAR).toContain("${ficheiro.name} (${mb} MB):");
  });
});

describe("o nome do ficheiro aparece uma vez, e não duas", () => {
  it("o ecrã só o junta quando o motivo não o traz", () => {
    /*
     * Lia-se "reportagem fotografica e notas.pdf: reportagem fotografica e
     * notas.pdf tem 8 MB..." — o motivo já traz o nome quando isso ajuda a
     * perceber qual dos oito anexos falhou, e o ecrã voltava a colá-lo à
     * frente.
     */
    const FORM = ler("src/components/admin/RegistarPedido.tsx");
    expect(FORM).toContain("r.motivo.includes(original.name) ? r.motivo :");
  });
});

describe("o envio direto passa a funcionar SEM token de escrita", () => {
  const ROTA = ler("src/app/api/blob/presign/route.ts");
  const ENVIAR = ler("src/lib/enviar-ficheiro.ts");

  it("assina com a identidade do deployment, e não com um token", () => {
    /*
     * O store da CLYON é do modelo novo: `.env.local` mostra só o
     * `BLOB_STORE_ID`, e as definições não têm secção de tokens nenhuma. Não é
     * uma configuração que falta — é uma credencial que não existe para criar.
     *
     * A documentação do SDK diz que dá: «Requests short-lived signed-token
     * material from the Blob control API. Use OIDC (VERCEL_OIDC_TOKEN +
     * storeId / BLOB_STORE_ID)».
     */
    expect(ROTA).toContain("issueSignedToken");
    expect(ROTA).toContain("presignUrl");
    expect(ROTA).toContain("storeId: credencial.storeId");
  });

  it("mas usa o token quando ele existe", () => {
    // Se algum dia aparecer um, ele ganha — é o que o próprio SDK faz.
    expect(ROTA).toContain('credencial.modo === "token"');
    expect(ROTA).toContain("token: credencial.token");
  });

  it("a autorização é fechada aqui, e não por quem chama", () => {
    // Um só caminho, os tipos da lista, um tamanho máximo, uma hora.
    expect(ROTA).toContain('operations: ["put"]');
    expect(ROTA).toContain("allowedContentTypes: [...TIPOS_ACEITES]");
    expect(ROTA).toContain("maximumSizeInBytes: TAMANHO_MAXIMO");
    expect(ROTA).toContain("validUntil: Date.now() + VALIDADE_MS");
  });

  it("os tipos vêm da MESMA função dos outros dois caminhos", () => {
    // Uma terceira lista divergiria, e a divergência aparece como "este
    // ficheiro não é aceite" num caminho e não no outro.
    expect(ROTA).toContain("tipoDoFicheiro(nome,");
    expect(ROTA).not.toContain("const PERMITIDOS");
  });

  it("a URL final vem da resposta, e não de adivinhar o host", () => {
    // Deduzi-la do id do store é uma transformação que não é nossa.
    expect(ENVIAR).toContain("o armazenamento não devolveu o endereço");
    expect(ROTA).toContain("A URL final NÃO vem daqui");
  });

  it("o ecrã tenta a URL assinada ANTES do caminho que precisa de token", () => {
    const i = ENVIAR.indexOf("porUrlAssinada(ficheiro)");
    const j = ENVIAR.indexOf("diretoAoArmazenamento(ficheiro)", i);
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
  });

  it("e quando os dois falham, mostra o motivo do que devia ter funcionado", () => {
    // O erro do SDK é sempre a mesma frase genérica; o da URL assinada diz algo.
    expect(ENVIAR).toContain("${assinado.motivo || bruto}");
  });
});
