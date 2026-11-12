import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { obterTokenDoBlob } from "./blob-token";
import { tipoDoFicheiro } from "./tipo-ficheiro";
import { apagarFotosDoBlob, guardarProvaDaGuia } from "./db";
import { MENSAGENS_DA_PROVA, TAMANHO_MAXIMO_DA_PROVA, tipoDaProvaAceite } from "./guia-de-residuos";

/**
 * RECEBER A PROVA DO REGISTO DE TRANSPORTADOR — 12-11-2026 (d5).
 *
 * As duas portas (o painel, com a sessão; a inscrição, com o convite acabado
 * de gastar) chegam aqui já com o profissional decidido. Daqui:
 *
 *   · o tamanho e o tipo confirmam-se ANTES de subir — imagem ou PDF, até
 *     4 MB, pelo tipo declarado e pela extensão (`tipoDoFicheiro`);
 *   · o nome do ficheiro no Blob leva um sufixo ao acaso: o armazenamento é
 *     público por endereço, e é o endereço que não se adivinha nem sai daqui.
 *     A resposta nunca o leva — nem ao próprio parceiro. Quem o abre é o
 *     administrador, pela rota dele, que o lê do lado do servidor;
 *   · o anterior sai do Blob depois de a base já ter o novo.
 */
export async function receberProvaDaGuia(req: NextRequest, providerId: number): Promise<NextResponse> {
  let ficheiro: File | null = null;
  try {
    const fd = await req.formData();
    const f = fd.get("file");
    if (f instanceof File) ficheiro = f;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!ficheiro || ficheiro.size === 0) {
    return NextResponse.json({ error: MENSAGENS_DA_PROVA.semFicheiro }, { status: 400 });
  }
  if (ficheiro.size > TAMANHO_MAXIMO_DA_PROVA) {
    return NextResponse.json({ error: MENSAGENS_DA_PROVA.grande }, { status: 413 });
  }
  const veredicto = tipoDoFicheiro(ficheiro.name, ficheiro.type);
  if (!veredicto.ok || !tipoDaProvaAceite(veredicto.tipo)) {
    return NextResponse.json({ error: MENSAGENS_DA_PROVA.tipo }, { status: 415 });
  }

  const tokenBlob = await obterTokenDoBlob();
  if (!tokenBlob.ok) {
    console.error("[prova-da-guia] sem token do Blob:", tokenBlob.motivo);
    return NextResponse.json({ error: MENSAGENS_DA_PROVA.falhou }, { status: 503 });
  }

  const extensao = veredicto.tipo === "application/pdf" ? "pdf" : (veredicto.tipo.split("/")[1] ?? "jpg");
  const nome = ficheiro.name.replace(/[^\w.\- ]/g, "_").slice(-120) || `prova.${extensao}`;

  try {
    const blob = await put(`guias/${providerId}.${extensao}`, ficheiro, {
      access: "public",
      contentType: veredicto.tipo,
      addRandomSuffix: true,
      ...(tokenBlob.modo === "token" ? { token: tokenBlob.token } : { storeId: tokenBlob.storeId }),
    });
    const { anterior } = await guardarProvaDaGuia(providerId, blob.url, nome);
    if (anterior) {
      const saiu = await apagarFotosDoBlob([anterior]).catch(() => 0);
      if (saiu < 1) console.error(`[prova-da-guia] a prova anterior de #${providerId} ficou no Blob`);
    }
    console.info(`[prova-da-guia] #${providerId}: prova nova (${veredicto.tipo})`);
    return NextResponse.json({ ok: true, provaDaGuia: { nome, em: new Date().toISOString() } });
  } catch (e) {
    console.error("[prova-da-guia] falhou:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: MENSAGENS_DA_PROVA.falhou }, { status: 500 });
  }
}
