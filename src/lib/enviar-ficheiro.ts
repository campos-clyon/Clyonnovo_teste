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

async function diretoAoArmazenamento(f: File): Promise<ResultadoDoEnvio> {
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
    return await diretoAoArmazenamento(ficheiro);
  } catch (err) {
    const bruto = err instanceof Error ? err.message : String(err);
    const mb = Math.round(ficheiro.size / 1024 / 1024);

    /*
     * PERGUNTAR À ROTA PORQUÊ — o SDK não no-lo diz.
     *
     * Quando a autorização falha, o `upload()` do Vercel lança sempre a mesma
     * frase: "Failed to retrieve the client token". O CORPO da resposta, que é
     * onde está o motivo, fica pelo caminho — e por isso o `includes(...)` que
     * estava aqui nunca acertava: o texto que ele procurava nunca chegava a
     * existir na mensagem.
     *
     * Resultado: quem tentasse enviar um ficheiro grande via um erro que não
     * explica nada, com a explicação escrita e pronta a três linhas de
     * distância. Foi o que aconteceu com o "reportagem fotografica e notas.pdf".
     *
     * Agora pergunta-se à rota. É um pedido extra, mas SÓ quando já falhou —
     * e o que se ganha é a diferença entre "falhou" e "falta configurar o
     * BLOB_READ_WRITE_TOKEN no Vercel".
     */
    if (/client token|failed to retrieve/i.test(bruto)) {
      try {
        const r = await fetch("/api/blob/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "blob.generate-client-token",
            payload: {
              pathname: nomeSeguro(ficheiro.name),
              callbackUrl: "/api/blob/token",
              clientPayload: null,
              multipart: false,
            },
          }),
        });
        const d = (await r.json()) as { error?: string; message?: string };
        if (d?.error === "ENVIO_DIRECTO_INDISPONIVEL") {
          return {
            ok: false,
            motivo:
              `${ficheiro.name} tem ${mb} MB e os ficheiros acima de 4 MB precisam ` +
              `de envio direto, que não está configurado neste site. ` +
              `Falta um BLOB_READ_WRITE_TOKEN nas variáveis de ambiente do Vercel.`,
          };
        }
        if (r.status === 429) {
          return {
            ok: false,
            motivo: `${ficheiro.name}: demasiados envios seguidos. Espere um minuto e tente outra vez.`,
          };
        }
        if (d?.message || d?.error) {
          return { ok: false, motivo: `${ficheiro.name}: ${d.message ?? d.error}` };
        }
      } catch {
        /* Sem resposta da rota, fica a mensagem crua — melhor do que nada. */
      }
    }

    return { ok: false, motivo: `${ficheiro.name} (${mb} MB): ${bruto}` };
  }
}
