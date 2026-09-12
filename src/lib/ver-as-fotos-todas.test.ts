import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ABRIR UMA FOTO E PASSAR ÀS OUTRAS.
 *
 * "Vamos adicionar a tecla de passar para os lados as imagens quando abrimos
 * elas." — 12-09-2026, com um esvaziamento de apartamento aberto à frente e
 * três fotografias para comparar.
 *
 * O visor do backoffice mostrava UMA fotografia e tinha um X. Para ver a
 * segunda era fechar, procurar a miniatura ao lado e abrir outra vez. É sobre
 * as fotos que se decide o preço de uma recolha, e olhar para elas é
 * exactamente o trabalho que se faz nesse ecrã.
 *
 * O que este teste guarda não é o desenho do visor: é que **há um só**. O
 * `VisorDeFotos` já existia, com setas, teclado, contador e Escape — e havia
 * dois ecrãs a escrever o seu próprio, pior. Quando um visor se copia, a
 * melhoria fica sempre numa das cópias.
 */

const RAIZ = join(process.cwd(), "src");
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const VISOR = ler("src/components/VisorDeFotos.tsx");

describe("o visor sabe passar de uma foto à seguinte", () => {
  it("tem setas e responde às teclas", () => {
    expect(VISOR).toContain('e.key === "ArrowLeft"');
    expect(VISOR).toContain('e.key === "ArrowRight"');
    expect(VISOR).toContain('e.key === "Escape"');
  });

  it("dá a volta em vez de parar na última", () => {
    // `% fotos.length` nas duas direcções: da última salta para a primeira.
    // Quem está a comparar três fotos anda para a frente e para trás sem
    // pensar em pontas.
    expect(VISOR).toContain("(n + 1) % fotos.length");
    expect(VISOR).toContain("(n - 1 + fotos.length) % fotos.length");
  });

  it("diz em que foto vai", () => {
    expect(VISOR).toContain("de {fotos.length}");
  });

  it("com uma foto só, não mostra setas que não levam a lado nenhum", () => {
    expect(VISOR).toContain("fotos.length > 1 &&");
  });
});

describe("os ecrãs do backoffice usam esse visor, e não um próprio", () => {
  const ECRAS = [
    "src/components/admin/PedidoDetailModal.tsx",
    "src/app/admin/pedidos/[id]/AdminPedidoDetalheClient.tsx",
  ];

  for (const caminho of ECRAS) {
    it(`${caminho.split("/").pop()} abre o visor partilhado com a lista toda`, () => {
      const f = ler(caminho);
      expect(f).toContain("<VisorDeFotos");
      expect(f).toContain("fotosDoPedido");
      // A que foi tocada é a que abre — e não a primeira da lista.
      expect(f).toContain("fotosDoPedido.indexOf(lightbox)");
    });

    it(`${caminho.split("/").pop()} deixou de ter visor próprio`, () => {
      const f = ler(caminho);
      // Era isto: uma <img> solta sobre fundo preto, sem setas e sem teclado.
      expect(f).not.toContain('alt="Preview"');
      expect(f).not.toContain("max-h-[90vh] max-w-[90vw]");
    });
  }
});

describe("não nasce outro visor por cópia", () => {
  it("nenhum ficheiro de produção desenha a sua própria foto em ecrã inteiro", () => {
    /*
     * A marca é a do visor que se copiava: uma imagem limitada a 90vh sobre um
     * fundo preto fixo. Se aparecer outra vez, é sinal de que alguém voltou a
     * escrever o que já existe — e a cópia nova nasce sem setas, como as duas
     * anteriores nasceram.
     */
    const reincidentes: string[] = [];
    const varrer = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) varrer(caminho);
        else if (/\.tsx$/.test(nome) && !/\.test\.tsx$/.test(nome)) {
          if (caminho.endsWith("VisorDeFotos.tsx")) continue;
          const texto = readFileSync(caminho, "utf8");
          if (texto.includes("max-h-[90vh] max-w-[90vw]")) {
            reincidentes.push(caminho.replace(process.cwd(), ""));
          }
        }
      }
    };
    varrer(RAIZ);
    expect(
      reincidentes,
      `Visor próprio outra vez em:\n${reincidentes.join("\n")}\nUse <VisorDeFotos>.`,
    ).toEqual([]);
  });
});
