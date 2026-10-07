import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { obterTokenDoBlob } from "@/lib/blob-token";
import { tamanhoMaximoDoTipo, tipoDoFicheiro, tiposDaMesmaEspecie } from "@/lib/tipo-ficheiro";

export const runtime = "nodejs";

/**
 * Envio direto do browser para o armazenamento.
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
 * autorização de curta duração, e o browser carrega diretamente. O que a
 * autorização permite está fechado aqui — que tipos, que tamanho máximo — e é
 * o servidor que o decide, não quem chama.
 */

/*
 * O tamanho máximo é o do tipo (imagem 50, PDF 25, vídeo 150 MB) — ver
 * `tipo-ficheiro.ts`. Era 300 MB para tudo.
 */

/** Trinta autorizações por hora e por IP — ver a mesma conta em /api/blob/presign. */
const ENVIOS_POR_HORA = 30;
const JANELA_SEGUNDOS = 60 * 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let corpo: HandleUploadBody;
  try {
    corpo = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  /*
   * Só os pedidos de AUTORIZAÇÃO contam para o limite. O aviso de «acabou de
   * subir» vem dos servidores da Vercel, assinado, e todos do mesmo punhado
   * de IPs: contá-lo punha os envios de toda a gente no mesmo balde.
   */
  if (corpo?.type === "blob.generate-client-token") {
    const rl = await checkRateLimit(
      `blob-token:${getClientIp(req)}`,
      ENVIOS_POR_HORA,
      JANELA_SEGUNDOS,
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiados envios. Aguarde um pouco e tente novamente." },
        { status: 429, headers: { "Retry-After": String(JANELA_SEGUNDOS) } },
      );
    }
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
          "O envio direto precisa de um BLOB_READ_WRITE_TOKEN. " +
          "Este ambiente autentica-se por identidade do deployment (OIDC), " +
          "que serve para gravar mas não para assinar autorizações de cliente.",
      },
      { status: 501 },
    );
  }

  try {
    const resposta = await handleUpload({
      request: req,
      body: corpo,
      token: credencial.token,
      onBeforeGenerateToken: async (caminho) => {
        /*
         * O tipo sai da extensão do caminho, pela mesma função dos outros
         * dois caminhos. O tecto é o dessa espécie, e só os tipos dessa
         * espécie passam: quem chamasse «x.pdf» para ter 25 MB não mandava
         * um vídeo por aqui.
         */
        const veredicto = tipoDoFicheiro(caminho, "");
        if (!veredicto.ok) throw new Error(veredicto.motivo);
        return {
          allowedContentTypes: tiposDaMesmaEspecie(veredicto.tipo),
          maximumSizeInBytes: tamanhoMaximoDoTipo(veredicto.tipo),
          // O sufixo aleatório é o que torna o endereço público impossível de
          // adivinhar — o caminho que o browser escolhe não é.
          addRandomSuffix: true,
        };
      },
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
