import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { obterTokenDoBlob } from "./blob-token";
import { tipoDoFicheiro } from "./tipo-ficheiro";
import { registarSemFalhar } from "./db";
import { MENSAGENS_DA_FATURA, NOME_DA_FATURA, TAMANHO_MAXIMO_DA_FATURA, tipoDaFaturaAceite, type DeQuemEAFatura } from "./faturas-do-trabalho";
import { guardarFaturaDoTrabalho } from "./faturas-do-trabalho-na-base";

/** A variável do token do armazenamento PRIVADO das faturas (um store do Blob «Private»). */
export const TOKEN_DO_BLOB_DAS_FATURAS = "FATURAS_BLOB_READ_WRITE_TOKEN";

/** O token do armazenamento privado das faturas, ou `null` quando não está ligado. */
export function tokenDoBlobDasFaturas(env: Record<string, string | undefined> = process.env): string | null {
  const v = env[TOKEN_DO_BLOB_DAS_FATURAS]?.trim().replace(/^["']|["']$/g, "") ?? "";
  return v.startsWith("vercel_blob_rw_") && v.length > 30 ? v : null;
}

/**
 * RECEBER UMA FATURA DO TRABALHO — d10. As portas (o parceiro no painel e na app;
 * a equipa no backoffice) chegam aqui com o trabalho já decidido e autorizado:
 * esta função só confere o ficheiro, sobe-o (nome com sufixo ao acaso) e grava-o.
 */
export async function receberFaturaDoTrabalho(
  req: NextRequest,
  t: { negociacaoId: number; pedidoId: number; deQuem: DeQuemEAFatura; quem: string; autorTipo: "profissional" | "clyon" },
): Promise<NextResponse> {
  let ficheiro: File | null = null;
  try {
    const fd = await req.formData();
    const f = fd.get("file");
    if (f instanceof File) ficheiro = f;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!ficheiro || ficheiro.size === 0) return NextResponse.json({ error: MENSAGENS_DA_FATURA.semFicheiro }, { status: 400 });
  if (ficheiro.size > TAMANHO_MAXIMO_DA_FATURA) return NextResponse.json({ error: MENSAGENS_DA_FATURA.grande }, { status: 413 });
  const veredicto = tipoDoFicheiro(ficheiro.name, ficheiro.type);
  if (!veredicto.ok || !tipoDaFaturaAceite(veredicto.tipo)) {
    return NextResponse.json({ error: MENSAGENS_DA_FATURA.tipo }, { status: 415 });
  }

  const tokenBlob = await obterTokenDoBlob();
  if (!tokenBlob.ok) {
    console.error("[fatura-do-trabalho] sem token do Blob:", tokenBlob.motivo);
    return NextResponse.json({ error: MENSAGENS_DA_FATURA.falhou }, { status: 503 });
  }
  const extensao = veredicto.tipo === "application/pdf" ? "pdf" : (veredicto.tipo.split("/")[1] ?? "jpg");
  const nome = ficheiro.name.replace(/[^\w.\- ]/g, "_").slice(-120) || `fatura.${extensao}`;

  try {
    /*
     * NO ARMAZENAMENTO PRIVADO, quando existe — d28 (15-11-2026). A fatura tem
     * nome, NIF e morada: lê-se só pela rota autenticada
     * (`/api/faturas-do-trabalho/[id]`). Sem o armazenamento privado ligado
     * (`TOKEN_DO_BLOB_DAS_FATURAS`), fica no de sempre, e mesmo assim o
     * endereço nunca sai do servidor (`faturasDaNegociacao` dá o link da rota).
     */
    const privado = tokenDoBlobDasFaturas();
    if (!privado) console.warn("[fatura-do-trabalho] sem o armazenamento privado das faturas — vai para o de sempre.");
    const caminho = `faturas/${t.pedidoId}-${t.negociacaoId}-${t.deQuem}.${extensao}`;
    const blob = privado
      ? await put(caminho, ficheiro, { access: "private", contentType: veredicto.tipo, addRandomSuffix: true, token: privado })
      : await put(caminho, ficheiro, {
          access: "public",
          contentType: veredicto.tipo,
          addRandomSuffix: true,
          ...(tokenBlob.modo === "token" ? { token: tokenBlob.token } : { storeId: tokenBlob.storeId }),
        });
    await guardarFaturaDoTrabalho({
      negociacaoId: t.negociacaoId,
      pedidoId: t.pedidoId,
      deQuem: t.deQuem,
      url: blob.url,
      nome,
      carregadaPor: t.quem,
    });
    // A anterior fica na base (inactiva) e no armazenamento: é um documento fiscal.
    await registarSemFalhar({
      acontecimento: "fatura_do_trabalho",
      pedidoId: t.pedidoId,
      negociacaoId: t.negociacaoId,
      autorTipo: t.autorTipo,
      autorNome: t.quem,
      resumo: `${NOME_DA_FATURA[t.deQuem]} junta ao pedido.`,
      detalhe: { deQuem: t.deQuem, nome },
    });
    return NextResponse.json({ ok: true, deQuem: t.deQuem, nome });
  } catch (e) {
    console.error("[fatura-do-trabalho]", e);
    return NextResponse.json({ error: MENSAGENS_DA_FATURA.falhou }, { status: 500 });
  }
}
