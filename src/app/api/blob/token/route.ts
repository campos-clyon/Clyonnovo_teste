import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { obterTokenDoBlob } from "@/lib/blob-token";
import { TIPOS_ACEITES } from "@/lib/tipo-ficheiro";

export const runtime = "nodejs";

/**
 * Envio directo do browser para o armazenamento.
 *
 * O caminho normal — o browser manda o ficheiro à nossa função e a função
 * manda-o ao Blob — tem um tecto que não é nosso: o Vercel recusa qualquer
 * pedido com mais de 4,5 MB de corpo, à entrada, em todos os planos. Comprar
 * mais plano não levanta esse tecto; está escrito na documentação deles ao
 * lado do exemplo.
 *
 * Uma foto de telemóvel reduzida cabe. Um vídeo do WhatsApp não cabe, e não há
 * como o reduzir no browser. Perdemos exactamente assim o vídeo do pedido #198.
 *
 * Por aqui o ficheiro nunca passa pela função: esta rota só assina uma
 * autorização de curta duração, e o browser carrega directamente. O que a
 * autorização permite está fechado aqui — que tipos, que tamanho máximo — e é
 * o servidor que o decide, não quem chama.
 */

/** 300 MB. Um vídeo de telemóvel de alguns minutos cabe; um filme não. */
const TAMANHO_MAXIMO = 300 * 1024 * 1024;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Generoso de propósito: um pedido com oito ficheiros faz oito pedidos de
  // autorização e outras tantas confirmações. Isto trava quem tente usar o
  // nosso armazenamento como disco, não quem esteja a pedir um orçamento.
  const rl = await checkRateLimit(`blob-token:${getClientIp(req)}`, 60, 600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados envios. Aguarde um momento." },
      { status: 429, headers: { "Retry-After": "600" } },
    );
  }

  // Assinar uma autorização de cliente exige um token de escrita a sério: o
  // identificador do store sai de dentro dele. No modelo OIDC — em que o
  // deployment se autentica com a sua própria identidade e não há token — isto
  // não é possível, e é melhor dizê-lo com todas as letras do que devolver um
  // "Access denied" que manda quem está a resolver procurar no sítio errado.
  const credencial = obterTokenDoBlob();
  if (!credencial.ok || credencial.modo !== "token") {
    return NextResponse.json(
      {
        error: "ENVIO_DIRECTO_INDISPONIVEL",
        message:
          "O envio directo precisa de um BLOB_READ_WRITE_TOKEN. " +
          "Este ambiente autentica-se por identidade do deployment (OIDC), " +
          "que serve para gravar mas não para assinar autorizações de cliente.",
      },
      { status: 501 },
    );
  }

  try {
    const resposta = await handleUpload({
      request: req,
      body: (await req.json()) as HandleUploadBody,
      token: credencial.token,
      onBeforeGenerateToken: async () => ({
        // A lista é a mesma do envio pelo servidor. Duas listas diferentes para
        // a mesma decisão acabam sempre por divergir.
        allowedContentTypes: [...TIPOS_ACEITES],
        maximumSizeInBytes: TAMANHO_MAXIMO,
        addRandomSuffix: true,
      }),
      // Não há nada a fazer quando acaba: o browser recebe o URL e mete-o no
      // pedido, que é gravado a seguir. Um callback que grave o ficheiro numa
      // tabela antes de o pedido existir só criaria linhas órfãs.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(resposta);
  } catch (err) {
    console.error("[blob/token] falhou:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao autorizar o envio." },
      { status: 400 },
    );
  }
}
