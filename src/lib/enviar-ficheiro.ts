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

/**
 * ENVIO DIRECTO PELA URL ASSINADA — sem token de escrita nenhum.
 *
 * O caminho do `handleUpload` do SDK precisa de um BLOB_READ_WRITE_TOKEN, e o
 * store da CLYON é do modelo novo: não tem nenhum, nem há onde o criar. Ver
 * `src/app/api/blob/presign/route.ts`, que explica a história toda.
 *
 * Aqui o servidor assina uma autorização com a identidade do deployment e
 * devolve uma URL; o browser faz `PUT` directamente para ela. O ficheiro nunca
 * passa pela nossa função, e por isso não há tecto de 4,5 MB.
 */
async function porUrlAssinada(f: File): Promise<ResultadoDoEnvio> {
  const r = await fetch("/api/blob/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: f.name, tipo: f.type, tamanho: f.size }),
  });
  const d = (await r.json()) as { url?: string; tipo?: string; error?: string; detalhe?: string };
  if (!r.ok || !d.url) {
    return { ok: false, motivo: d.error ?? d.detalhe ?? `autorização recusada (${r.status})` };
  }

  /*
   * O tipo vai no cabeçalho, e é O QUE FOI ASSINADO.
   *
   * A autorização fecha a lista de tipos permitidos; mandar aqui um tipo
   * diferente do que o servidor apurou faz o armazenamento recusar o envio.
   * Usa-se o que ele devolveu — que já passou pela mesma função de sempre e
   * sabe ler a extensão quando o browser não declara nada.
   */
  const envio = await fetch(d.url, {
    method: "PUT",
    headers: { "Content-Type": d.tipo ?? f.type ?? "application/octet-stream" },
    body: f,
  });
  if (!envio.ok) {
    return { ok: false, motivo: `o armazenamento recusou o ficheiro (${envio.status})` };
  }

  /*
   * A URL final vem na resposta do armazenamento.
   *
   * Calculá-la a partir do id do store obrigava a adivinhar o nome do host, e
   * essa transformação não é nossa. Se a resposta não a trouxer, isto falha em
   * vez de inventar uma URL que não abre.
   */
  const feito = (await envio.json().catch(() => null)) as { url?: string } | null;
  if (!feito?.url) {
    return { ok: false, motivo: "o ficheiro subiu mas o armazenamento não devolveu o endereço" };
  }
  return { ok: true, ficheiro: { url: feito.url, name: f.name, size: f.size, type: f.type } };
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

  /*
   * PRIMEIRO A URL ASSINADA, que é a que funciona sem token de escrita.
   *
   * O `diretoAoArmazenamento` (o `handleUpload` do SDK) fica como recurso: é
   * melhor quando HÁ um token — parte o ficheiro e reenvia os pedaços que
   * falharem, o que numa rede móvel conta. Mas hoje não há token nenhum, e por
   * isso devolvia 501 a tudo o que passasse dos 4 MB.
   */
  const assinado = await porUrlAssinada(ficheiro).catch((err) => ({
    ok: false as const,
    motivo: err instanceof Error ? err.message : String(err),
  }));
  if (assinado.ok) return assinado;

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

    /*
     * Os DOIS caminhos falharam. O que interessa a quem lê é o motivo do
     * PRIMEIRO — a URL assinada é o caminho que devia funcionar hoje; o erro
     * do SDK é o do recurso, e é sempre a mesma frase genérica.
     */
    return {
      ok: false,
      motivo: `${ficheiro.name} (${mb} MB): ${assinado.motivo || bruto}`,
    };
  }
}
