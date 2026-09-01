import { NextRequest, NextResponse } from "next/server";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { obterTokenDoBlob } from "@/lib/blob-token";
import { TIPOS_ACEITES, tipoDoFicheiro } from "@/lib/tipo-ficheiro";

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

/** 300 MB. Um vídeo de telemóvel de alguns minutos cabe; um filme não. */
const TAMANHO_MAXIMO = 300 * 1024 * 1024;

/** Uma hora chega para qualquer envio, e não deixa a assinatura a arrastar. */
const VALIDADE_MS = 60 * 60 * 1000;

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
  const rl = await checkRateLimit(`blob-presign:${getClientIp(req)}`, 60, 600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados envios. Aguarde um momento." },
      { status: 429, headers: { "Retry-After": "600" } },
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
  if (tamanho > TAMANHO_MAXIMO) {
    return NextResponse.json(
      {
        error: `O ficheiro tem ${Math.round(tamanho / 1024 / 1024)} MB e o máximo são ${TAMANHO_MAXIMO / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
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

  const credencial = obterTokenDoBlob();
  if (!credencial.ok) {
    return NextResponse.json(
      { error: "O armazenamento não está configurado.", detalhe: credencial.motivo },
      { status: 501 },
    );
  }

  try {
    const caminho = `simulador/${Date.now()}-${nomeSeguro(nome)}`;

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
      allowedContentTypes: [...TIPOS_ACEITES],
      maximumSizeInBytes: TAMANHO_MAXIMO,
      validUntil: Date.now() + VALIDADE_MS,
      ...(credencial.modo === "token"
        ? { token: credencial.token }
        : { storeId: credencial.storeId }),
    });

    const { presignedUrl } = await presignUrl(assinado, {
      operation: "put",
      pathname: caminho,
      access: "public",
      allowedContentTypes: [...TIPOS_ACEITES],
      maximumSizeInBytes: TAMANHO_MAXIMO,
      /*
       * Sem sufixo aleatório: o caminho já leva a hora à frente, e é o que
       * permite reconhecer o ficheiro na listagem do armazenamento. Dois
       * envios do mesmo nome no mesmo milissegundo é um problema que ainda
       * não temos.
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
