import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { obterTokenDoBlob } from "@/lib/blob-token";
import { tamanhoMaximoDoTipo, tipoDoFicheiro } from "@/lib/tipo-ficheiro";

export const runtime = "nodejs";

/**
 * ENVIO DIRECTO **SEM TOKEN DE ESCRITA**.
 *
 * "reportagem fotografica e notas.pdf tem 8 MB (…) falta um
 * BLOB_READ_WRITE_TOKEN nas variáveis de ambiente do Vercel."
 *
 * Só que esse token NÃO EXISTE PARA CRIAR. O store da CLYON é do modelo novo:
 * na página dele o separador `.env.local` mostra apenas `BLOB_STORE_ID`, e as
 * definições têm «Store Access», «Base URL» e «Firewall» — nenhuma secção de
 * tokens. O deployment autentica-se pela sua própria identidade (OIDC) e não
 * há credencial de longa duração nenhuma para guardar.
 *
 * A rota `/api/blob/token` — o `handleUpload` do SDK — precisa mesmo de um
 * token: o identificador do store sai de dentro dele. Por isso devolvia 501, e
 * por isso NENHUM ficheiro acima de 4 MB entrava na plataforma, fosse PDF,
 * vídeo ou fotografia.
 *
 * ESTE É O OUTRO CAMINHO, e está na documentação do próprio SDK:
 *
 *   «Requests short-lived signed-token material from the Blob control API.
 *    Use OIDC (VERCEL_OIDC_TOKEN + storeId / BLOB_STORE_ID)»
 *
 * `issueSignedToken` aceita a identidade do deployment. Com ela assina-se um
 * `presignUrl` de operação `put`, e o browser carrega DIRECTAMENTE para o
 * armazenamento — sem passar pela nossa função, e portanto sem o tecto de
 * 4,5 MB que o Vercel impõe ao corpo de qualquer pedido.
 *
 * O QUE A AUTORIZAÇÃO PERMITE ESTÁ FECHADO AQUI, e não em quem chama: um só
 * caminho, os tipos da lista, um tamanho máximo, e uma hora de validade. Quem
 * apanhasse a URL assinada não conseguia escrever noutro sítio nem outra
 * coisa.
 */

/*
 * O TAMANHO MÁXIMO É O DO TIPO — 30-09-2026.
 *
 * Era 300 MB para tudo. Passou a ser por espécie (imagem 50, PDF 25, vídeo
 * 150 MB), com os números em `tipo-ficheiro.ts` e alinhados com o que os
 * formulários já deixam escolher. E a assinatura só aceita o TIPO que aqui se
 * apurou: quem dissesse «é um PDF» para ter 25 MB não pode mandar outra coisa.
 */

/** Uma hora chega para qualquer envio, e não deixa a assinatura a arrastar. */
const VALIDADE_MS = 60 * 60 * 1000;

/*
 * Trinta autorizações por hora, por IP. Só os ficheiros acima de 4 MB passam
 * por aqui — as fotografias reduzidas vão pelo caminho pequeno — e um pedido
 * de orçamento tem dez anexos no máximo. Eram sessenta a cada dez minutos:
 * trezentas e sessenta por hora, um disco à borla.
 */
const ENVIOS_POR_HORA = 30;
const JANELA_SEGUNDOS = 60 * 60;

/**
 * O nome, limpo, mas ainda reconhecível.
 *
 * Guardar "8f3a2b1c.pdf" faz o ficheiro perder o que ele é — e o nome é a
 * única coisa que distingue uma reportagem de um orçamento numa lista de
 * anexos. Tira-se o que pode partir um caminho e deixa-se o resto.
 */
function nomeSeguro(nome: string): string {
  const limpo = (nome || "ficheiro")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  return limpo || "ficheiro";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = await checkRateLimit(
    `blob-presign:${getClientIp(req)}`,
    ENVIOS_POR_HORA,
    JANELA_SEGUNDOS,
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados envios. Aguarde um pouco e tente novamente." },
      { status: 429, headers: { "Retry-After": String(JANELA_SEGUNDOS) } },
    );
  }

  let corpo: { nome?: unknown; tipo?: unknown; tamanho?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const nome = typeof corpo.nome === "string" ? corpo.nome : "";
  const tamanho = Number(corpo.tamanho);
  if (!nome) return NextResponse.json({ error: "Falta o nome do ficheiro." }, { status: 400 });
  if (!Number.isFinite(tamanho) || tamanho <= 0) {
    return NextResponse.json({ error: "Falta o tamanho do ficheiro." }, { status: 400 });
  }

  /*
   * O TIPO DECIDE-SE AQUI, com a mesma função dos outros dois caminhos.
   *
   * Uma terceira lista de tipos permitidos acabaria por divergir das outras
   * duas — e a divergência aparece como "este ficheiro não é aceite" num
   * caminho e não no outro, sem nada que o explique.
   */
  const veredicto = tipoDoFicheiro(nome, typeof corpo.tipo === "string" ? corpo.tipo : "");
  if (!veredicto.ok) {
    return NextResponse.json({ error: veredicto.motivo }, { status: 415 });
  }

  // O tecto é o do tipo, e decide-se depois de o tipo estar decidido.
  const maximo = tamanhoMaximoDoTipo(veredicto.tipo);
  if (tamanho > maximo) {
    return NextResponse.json(
      {
        error: `O ficheiro tem ${Math.round(tamanho / 1024 / 1024)} MB e o máximo para este tipo são ${maximo / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  }

  const credencial = obterTokenDoBlob();
  if (!credencial.ok) {
    return NextResponse.json(
      { error: "O armazenamento não está configurado.", detalhe: credencial.motivo },
      { status: 501 },
    );
  }

  try {
    /*
     * UM CAMINHO QUE NINGUÉM ADIVINHA.
     *
     * Era `simulador/<hora em ms>-<nome>`, num armazenamento PÚBLICO: com a
     * hora aproximada e um nome comum («image.jpg», «video.mp4»), as
     * fotografias da casa de um cliente estavam a umas centenas de tentativas
     * de distância. Um UUID à frente torna isso impraticável; o nome fica,
     * porque é o que distingue uma reportagem de um orçamento na lista.
     */
    const caminho = `simulador/${randomUUID()}-${nomeSeguro(nome)}`;

    /*
     * A identidade do deployment, quando não há token — e o token, quando há.
     *
     * O `issueSignedToken` lê `VERCEL_OIDC_TOKEN` e `BLOB_STORE_ID` do
     * ambiente sozinho; passa-se o `storeId` explicitamente para não depender
     * de o nome da variável estar certo. Se algum dia aparecer um token de
     * escrita, ele ganha — é o que a própria assinatura do SDK faz.
     */
    const assinado = await issueSignedToken({
      pathname: caminho,
      operations: ["put"],
      allowedContentTypes: [veredicto.tipo],
      maximumSizeInBytes: maximo,
      validUntil: Date.now() + VALIDADE_MS,
      ...(credencial.modo === "token"
        ? { token: credencial.token }
        : { storeId: credencial.storeId }),
    });

    const { presignedUrl } = await presignUrl(assinado, {
      operation: "put",
      pathname: caminho,
      access: "public",
      allowedContentTypes: [veredicto.tipo],
      maximumSizeInBytes: maximo,
      /*
       * Sem sufixo aleatório do SDK: o caminho já leva um UUID à frente, e é o
       * caminho assinado que o browser usa no PUT — com o sufixo, o endereço
       * final deixava de ser o que se assinou.
       */
      addRandomSuffix: false,
    });

    /*
     * A URL final NÃO vem daqui — vem da resposta do `PUT`.
     *
     * O armazenamento responde ao envio com o mesmo objecto que o `put()` do
     * servidor devolve, e lá dentro está a URL pública. Calculá-la aqui
     * obrigava a adivinhar o nome do host a partir do id do store, que é uma
     * transformação que não controlamos e que muda no dia em que a Vercel a
     * mudar. Melhor ler o que eles dizem do que deduzir.
     */
    return NextResponse.json({ url: presignedUrl, caminho, tipo: veredicto.tipo });
  } catch (e) {
    console.error("[api/blob/presign]", e);
    return NextResponse.json(
      {
        error: "Não foi possível autorizar o envio.",
        detalhe: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
