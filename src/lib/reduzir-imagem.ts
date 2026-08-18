/**
 * Reduzir uma fotografia antes de a enviar.
 *
 * PORQUE ISTO EXISTE
 *
 * O Vercel recusa qualquer pedido com mais de 4,5 MB de corpo, e recusa-o à
 * entrada — o ficheiro nem chega à nossa função, que fica com o seu limite de
 * 30 MB por escrever. O cliente via "uma foto não chegou a ser enviada" e a
 * única saída que lhe dávamos era mandá-la por WhatsApp, que é exactamente o
 * atrito que esta plataforma existe para remover.
 *
 * Uma fotografia de telemóvel tem hoje 4 a 12 MB. A 1920 px de lado maior, com
 * qualidade 0.82, fica tipicamente entre 200 e 600 KB — e para avaliar um sofá,
 * um monte de entulho ou o acesso a uma escada, 1920 px é muito mais do que
 * suficiente. O profissional quer ver o que é, não contar os pontos do tecido.
 *
 * O que NÃO se reduz: vídeos, e imagens que já sejam pequenas. Recodificar uma
 * imagem de 300 KB só a tornaria pior sem ganhar nada.
 */

/** Lado maior, em pixels, depois de reduzir. */
export const LADO_MAXIMO = 1920;

/** Abaixo disto não vale a pena mexer. */
export const TAMANHO_A_PARTIR_DO_QUAL_VALE_A_PENA = 1024 * 1024; // 1 MB

const QUALIDADE = 0.82;

export type ResultadoDaReducao = {
  ficheiro: File;
  /** `true` quando o ficheiro devolvido é o original, sem alterações. */
  intacto: boolean;
};

function ehImagemReduzivel(ficheiro: File): boolean {
  // O GIF pode ser animado e recodificá-lo para JPEG perde a animação. O SVG é
  // vectorial e não tem tamanho para reduzir.
  return (
    ficheiro.type.startsWith("image/") &&
    !ficheiro.type.includes("gif") &&
    !ficheiro.type.includes("svg")
  );
}

/**
 * Reduz, se valer a pena. Nunca lança: se alguma coisa correr mal — um
 * formato que o browser não sabe desenhar, memória a faltar num telemóvel
 * antigo — devolve o original. Uma foto grande que talvez passe é melhor do
 * que nenhuma foto de certeza.
 */
export async function reduzirImagem(ficheiro: File): Promise<ResultadoDaReducao> {
  if (!ehImagemReduzivel(ficheiro)) return { ficheiro, intacto: true };
  if (ficheiro.size < TAMANHO_A_PARTIR_DO_QUAL_VALE_A_PENA) {
    return { ficheiro, intacto: true };
  }
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
    return { ficheiro, intacto: true };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    // `createImageBitmap` respeita a orientação EXIF quando lhe dizemos — sem
    // isto, fotos tiradas na vertical chegavam deitadas.
    bitmap = await createImageBitmap(ficheiro, { imageOrientation: "from-image" });

    const maior = Math.max(bitmap.width, bitmap.height);
    if (maior <= LADO_MAXIMO) return { ficheiro, intacto: true };

    const escala = LADO_MAXIMO / maior;
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);

    const tela = document.createElement("canvas");
    tela.width = largura;
    tela.height = altura;
    const ctx = tela.getContext("2d");
    if (!ctx) return { ficheiro, intacto: true };
    ctx.drawImage(bitmap, 0, 0, largura, altura);

    const blob = await new Promise<Blob | null>((resolve) =>
      tela.toBlob(resolve, "image/jpeg", QUALIDADE),
    );
    if (!blob || blob.size >= ficheiro.size) {
      // Se ficou maior — acontece com imagens já muito comprimidas — o
      // original é a melhor escolha.
      return { ficheiro, intacto: true };
    }

    const nome = ficheiro.name.replace(/\.[^.]+$/, "") + ".jpg";
    return {
      ficheiro: new File([blob], nome, { type: "image/jpeg", lastModified: Date.now() }),
      intacto: false,
    };
  } catch {
    return { ficheiro, intacto: true };
  } finally {
    bitmap?.close?.();
  }
}
