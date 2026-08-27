import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A prova do trabalho pode vir da galeria, e não só da câmara.
 *
 * "Vamos colocar a opção de enviar uma imagem da galeria para a confirmação do
 * trabalho, pois nem sempre o dono da conta está no local da recolha."
 *
 * Havia uma entrada só, com `capture="environment"` — num telemóvel isso abre
 * a câmara e mais nada. Serve para quem está no local com o trabalho acabado à
 * frente, que é a maioria das vezes.
 *
 * Mas o TRSul do #237 não estava lá: a equipa fez o trabalho e mandou-lhe as
 * fotografias pelo WhatsApp. Ele não tinha por onde as carregar, e a prova
 * acabou por ser uma frase escrita à mão — "não consegui carregar a foto do
 * serviço, porém foi enviado ao número particular do mesmo". A prova de um
 * trabalho de 60 € ficou fora do registo por causa de um atributo HTML.
 */

/** O ficheiro sem os comentários: a explicação não é o código que ela explica. */
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const COMPONENTE = semComentarios(
  readFileSync(join(process.cwd(), "src/components/EnviarFotos.tsx"), "utf8"),
);

describe("as duas entradas", () => {
  it("há dois campos: um com câmara e um sem", () => {
    /*
     * `capture` é uma sugestão ao sistema, não um filtro — não se liga e
     * desliga no mesmo campo conforme o botão. Para dar as duas opções é
     * mesmo preciso haver dois.
     */
    expect((COMPONENTE.match(/type="file"/g) ?? []).length).toBe(2);
    expect((COMPONENTE.match(/capture="environment"/g) ?? []).length).toBe(1);
    expect(COMPONENTE).toContain("const daGaleria = useRef<HTMLInputElement>(null);");
  });

  it("os dois passam pelo mesmo caminho de envio", () => {
    // Uma segunda função de envio divergia da primeira ao segundo mês.
    expect((COMPONENTE.match(/onChange=\{\(e\) => escolher\(e\.target\.files\)\}/g) ?? []).length).toBe(2);
  });

  it("a câmara continua a ser o botão grande", () => {
    // É o caso normal: quem está no local, com o trabalho acabado à frente.
    expect(COMPONENTE).toContain("input.current?.click()");
    expect(COMPONENTE).toContain("aspect-square");
  });

  it("a galeria é um alvo de 44 px, e diz o que faz", () => {
    expect(COMPONENTE).toContain("daGaleria.current?.click()");
    expect(COMPONENTE).toContain("min-h-[44px]");
    expect(COMPONENTE).toContain("Escolher da galeria");
  });

  it("desaparece quando já não cabem mais fotografias", () => {
    // Um botão que não pode fazer nada é pior do que botão nenhum.
    const i = COMPONENTE.indexOf("daGaleria.current?.click()");
    const bloco = COMPONENTE.slice(Math.max(0, i - 300), i);
    expect(bloco).toContain("fotos.length < maximo");
  });

  it("os dois ficam desactivados enquanto há envios a decorrer", () => {
    const i = COMPONENTE.indexOf("daGaleria.current?.click()");
    expect(COMPONENTE.slice(i, i + 200)).toContain("disabled={aEnviar > 0}");
  });
});
