import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { obterTokenDoBlob } from "@/lib/blob-token";
import { tipoDoFicheiro } from "@/lib/tipo-ficheiro";
import {
  COOKIE_SESSAO_PROFISSIONAL,
  verificarSessaoDoProfissional,
} from "@/lib/profissional-auth";
import {
  apagarFotosDoBlob,
  fotosDaViatura,
  guardarFotosDaViatura,
  MAX_FOTOS_DA_VIATURA,
} from "@/lib/db";

export const runtime = "nodejs";

/**
 * A FOTOGRAFIA DA VIATURA DELE.
 *
 * "Vamos adicionar a opção de colocar a foto do camião no perfil, para nós
 * sabermos qual é o camião/carrinha." — 14-09-2026.
 *
 * O `tipoVeiculo` já existia e diz «carrinha» ou «camião» — uma palavra que
 * não distingue uma carrinha de caixa aberta de uma fechada, e é essa
 * diferença que decide se um sofá apanha chuva a caminho. A fotografia diz
 * numa vez o que a palavra nunca disse.
 *
 * Rota própria, e não o upload do simulador: aquele é público e aceita
 * ficheiros de quem passar por lá. Este exige a sessão do profissional e
 * escreve no perfil DELE — ninguém pode pôr uma viatura no perfil de outro.
 *
 * SÃO VÁRIAS desde 19-09-2026: "vamos colocar a opção deles colocarem fotos
 * dos veículos". Era uma, e quem tem uma carrinha de caixa aberta e um camião
 * tinha de escolher qual mostrava. O POST ACRESCENTA à lista; o DELETE tira
 * uma. Ver `guardarFotosDaViatura`, que mantém a coluna antiga a apontar para
 * a primeira.
 */

/** Dois megabytes. Uma fotografia de telemóvel cabe; um vídeo não. */
const TAMANHO_MAXIMO = 2 * 1024 * 1024;

/**
 * TIRAR UMA DA LISTA.
 *
 * Enquanto era uma só, trocar era apagar — não havia nada a decidir. Com
 * várias, ele tem de poder remover a que ficou tremida sem mexer nas outras.
 *
 * O ficheiro sai do Blob a seguir: uma fotografia de uma carrinha tem a
 * matrícula à vista, e uma matrícula num endereço público que ninguém sabe
 * que existe é o pior dos dois mundos.
 */
export async function DELETE(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let url = "";
  try {
    const corpo = (await req.json()) as { url?: unknown };
    url = typeof corpo.url === "string" ? corpo.url.trim() : "";
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!url) return NextResponse.json({ error: "Falta dizer qual." }, { status: 400 });

  try {
    /*
     * SÓ AS DELE. A lista vem da base e o que se grava é ela sem o endereço
     * pedido — quem mandar o URL da viatura de outro não tira nada a ninguém,
     * porque esse endereço não está nesta lista.
     */
    const antes = await fotosDaViatura(sessao.providerId);
    if (!antes.includes(url)) {
      return NextResponse.json({ ok: true, fotos: antes });
    }

    const { fotos, orfas } = await guardarFotosDaViatura(
      sessao.providerId,
      antes.filter((u) => u !== url),
    );

    if (orfas.length > 0) {
      const saiu = await apagarFotosDoBlob(orfas).catch(() => 0);
      if (saiu < orfas.length) console.error("[foto-viatura] ficaram no Blob:", orfas);
    }

    return NextResponse.json({ ok: true, fotos });
  } catch (e) {
    console.error("[foto-viatura DELETE]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível apagar." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let ficheiro: File | null = null;
  try {
    const fd = await req.formData();
    const f = fd.get("file");
    if (f instanceof File) ficheiro = f;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!ficheiro) return NextResponse.json({ error: "Escolha uma fotografia." }, { status: 400 });

  /*
   * O LIMITE VERIFICA-SE ANTES DE SUBIR O FICHEIRO.
   *
   * Depois de subir, recusar deixava o ficheiro no Blob sem ponteiro nenhum na
   * base — público, e sem ninguém saber que existe.
   */
  const jaTem = await fotosDaViatura(sessao.providerId);
  if (jaTem.length >= MAX_FOTOS_DA_VIATURA) {
    return NextResponse.json(
      {
        error: `Já tem ${MAX_FOTOS_DA_VIATURA} fotografias. Apague uma antes de acrescentar outra.`,
        fotos: jaTem,
      },
      { status: 409 },
    );
  }

  if (ficheiro.size > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { error: "A fotografia é grande de mais (máximo 2 MB). Tire-a com menos qualidade." },
      { status: 413 },
    );
  }

  /*
   * O tipo decide-se pelo conteúdo declarado E pela extensão, como no upload
   * do simulador — não se aceita «imagem» por o nome acabar em .jpg.
   */
  const veredicto = tipoDoFicheiro(ficheiro.name, ficheiro.type);
  if (!veredicto.ok || !veredicto.tipo.startsWith("image/")) {
    return NextResponse.json(
      { error: "Só fotografias (JPG, PNG ou WEBP)." },
      { status: 415 },
    );
  }

  const tokenBlob = await obterTokenDoBlob();
  if (!tokenBlob.ok) {
    console.error("[foto-viatura] sem token do Blob:", tokenBlob.motivo);
    return NextResponse.json(
      { error: "O armazenamento de fotografias não está configurado." },
      { status: 503 },
    );
  }

  /*
   * O id do profissional no nome, e a hora a seguir. O id diz de quem é sem
   * abrir a base; a hora faz de cada envio um ficheiro novo, para a
   * fotografia antiga não ficar em cache no telemóvel de ninguém.
   */
  const chave = `viaturas/${sessao.providerId}-${Date.now()}.${veredicto.tipo.split("/")[1] ?? "jpg"}`;

  try {
    const blob = await put(chave, ficheiro, {
      access: "public",
      contentType: veredicto.tipo,
      addRandomSuffix: false,
      ...(tokenBlob.modo === "token"
        ? { token: tokenBlob.token }
        : { storeId: tokenBlob.storeId }),
    });

    // Grava-se aqui e não no ecrã seguinte: uma fotografia que sobe e não fica
    // no perfil é o pior dos dois mundos — ocupa espaço e não serve a ninguém.
    const { fotos, orfas } = await guardarFotosDaViatura(sessao.providerId, [
      ...jaTem,
      blob.url,
    ]);

    /*
     * E O QUE FICOU SEM PONTEIRO SAI DO BLOB.
     *
     * A hora no nome faz de cada envio um ficheiro novo — é o que evita a
     * cache no telemóvel — mas nada apagava o de antes. Trocar a fotografia
     * cinco vezes deixava cinco fotografias da viatura de alguém, públicas, e
     * só a última com ponteiro na base: as outras ficavam sem ninguém saber
     * que existiam. Verificado a 14-09-2026.
     *
     * Depois de a base já ter a nova, e nunca antes: se o Blob falhar, fica
     * uma fotografia a mais — chato. Ao contrário, ficava o perfil a apontar
     * para um ficheiro apagado — uma imagem partida no ecrã do cliente.
     */
    if (orfas.length > 0) {
      const saiu = await apagarFotosDoBlob(orfas).catch(() => 0);
      if (saiu < orfas.length) console.error("[foto-viatura] ficaram no Blob:", orfas);
    }

    // `url` continua a sair para quem só quer a que acabou de subir; `fotos` é
    // a lista inteira, que é o que o ecrã desenha.
    return NextResponse.json({ ok: true, url: blob.url, fotos });
  } catch (e) {
    console.error("[foto-viatura] falhou:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível guardar a fotografia." }, { status: 500 });
  }
}
