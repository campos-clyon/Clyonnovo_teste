import { upload } from "@vercel/blob/client";
import { reduzirImagem } from "./reduzir-imagem";

/**
 * Enviar um ficheiro, pelo caminho que ele couber.
 *
 * Há dois caminhos, e a escolha é pelo tamanho:
 *
 *   · PEQUENO — vai à nossa função, que o grava. É o caminho de sempre, o que
 *     está provado, e o que continua a funcionar mesmo sem token de escrita
 *     configurado;
 *   · GRANDE — vai do browser direito ao armazenamento, com uma autorização
 *     assinada pela nossa função. É o único caminho possível acima de 4,5 MB:
 *     o Vercel recusa pedidos maiores do que isso à entrada, em qualquer plano.
 *
 * As imagens passam primeiro pela redução, o que faz quase todas caírem no
 * caminho pequeno. Os vídeos não se reduzem no browser — vão sempre pelo
 * grande, e era exactamente aí que se perdiam antes de isto existir.
 */

export type FicheiroEnviado = {
  url: string;
  name: string;
  size: number;
  type: string;
};

export type ResultadoDoEnvio =
  | { ok: true; ficheiro: FicheiroEnviado }
  | { ok: false; motivo: string };

/**
 * O tecto do Vercel é 4,5 MB de corpo. Ficamos abaixo com folga: o corpo leva
 * também os limites do multipart e o nome do ficheiro, e um envio que falhe
 * por trinta quilobytes é um envio perdido por uma conta mal feita.
 */
const LIMITE_DO_SERVIDOR = 4 * 1024 * 1024;

function nomeSeguro(nome: string): string {
  return nome.replace(/[^\w.\-]/g, "_").slice(-80);
}

async function pelaNossaFuncao(f: File): Promise<ResultadoDoEnvio> {
  const fd = new FormData();
  fd.append("fotos", f, f.name);
  const res = await fetch("/api/simulador/upload-fotos", { method: "POST", body: fd });
  const dados = await res.json().catch(() => null);
  const subidos = (dados?.files ?? []) as FicheiroEnviado[];

  if (subidos.length > 0) return { ok: true, ficheiro: subidos[0] };

  const porFicheiro = (dados?.falhados ?? []) as Array<{ name: string; motivo: string }>;
  return {
    ok: false,
    motivo:
      porFicheiro.length > 0
        ? porFicheiro.map((x) => x.motivo).join(" | ")
        : (dados?.motivoTecnico ?? dados?.message ?? dados?.error ?? `resposta ${res.status} do servidor`),
  };
}

async function directoAoArmazenamento(f: File): Promise<ResultadoDoEnvio> {
  const chave = `simulador/${nomeSeguro(f.name)}`;
  const blob = await upload(chave, f, {
    access: "public",
    handleUploadUrl: "/api/blob/token",
    // Parte o ficheiro e envia os pedaços em paralelo, com nova tentativa nos
    // que falharem. Num vídeo de 40 MB em rede móvel, sem isto uma falha a
    // meio deitava fora tudo o que já tinha subido.
    multipart: true,
  });
  return {
    ok: true,
    ficheiro: { url: blob.url, name: f.name, size: f.size, type: f.type },
  };
}

export async function enviarFicheiro(original: File): Promise<ResultadoDoEnvio> {
  let ficheiro = original;

  // Reduzir nunca deita nada fora: se falhar, devolve o original.
  if (original.type.startsWith("image/")) {
    try {
      ficheiro = (await reduzirImagem(original)).ficheiro;
    } catch {
      /* segue o original */
    }
  }

  if (ficheiro.size <= LIMITE_DO_SERVIDOR) {
    try {
      return await pelaNossaFuncao(ficheiro);
    } catch (err) {
      return {
        ok: false,
        motivo: `erro de rede — ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  try {
    return await directoAoArmazenamento(ficheiro);
  } catch (err) {
    const bruto = err instanceof Error ? err.message : String(err);
    // A mensagem tem de dizer o que se passa a quem a for ler nos registos.
    // "Falhou" sem mais nada foi o que nos custou três dias no 413.
    return {
      ok: false,
      motivo: bruto.includes("ENVIO_DIRECTO_INDISPONIVEL")
        ? `${ficheiro.name}: ficheiro grande (${Math.round(ficheiro.size / 1024 / 1024)} MB) e o envio directo não está configurado — falta BLOB_READ_WRITE_TOKEN`
        : `${ficheiro.name}: ${bruto}`,
    };
  }
}
