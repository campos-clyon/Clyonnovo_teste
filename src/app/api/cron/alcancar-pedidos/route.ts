import { NextRequest, NextResponse } from "next/server";
import { registarSemFalhar } from "@/lib/db";
import { correrOAlcance } from "@/lib/correr-o-alcance";
import { resumoDoAlcance } from "@/lib/alcancar-pedidos";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";

export const runtime = "nodejs";

/**
 * OS PEDIDOS ABERTOS VOLTAM A PROCURAR QUEM OS POSSA FAZER.
 *
 * "Os trabalhos colocados antes da conta ser criada continua a não aparecer
 * para eles mas devia. O Revolution por ex só recebeu 1 trabalho mas cumpre
 * todos os requisitos para receber todos." — 14-09-2026.
 *
 * A distribuição corria uma vez, ao promover, e nunca mais. Quem se inscrevia
 * depois nascia para um mercado vazio: os pedidos estavam lá, ele cumpria os
 * requisitos, e não os via — não por regra nenhuma, mas porque ninguém voltava
 * a perguntar. O painel já dizia a resposta em voz alta no #316 («4
 * profissionais · 1 proposta», e ao lado «Hoje chegaria a 5 de 9») e o sistema
 * não agia sobre ela.
 *
 * PORQUÊ UM CRON, E NÃO UM GATILHO NA APROVAÇÃO.
 *
 * Porque não é a aprovação que muda quem é elegível — é uma lista de coisas:
 * a conta nova, a aprovação, o raio corrigido, uma categoria acrescentada, a
 * fatura ligada, as coordenadas da base que só apareceram à segunda tentativa,
 * a guia verificada. Apanhar eventos um a um é esquecer-se de um, e o que se
 * esquece não dá erro nenhum: dá um profissional em silêncio durante semanas.
 * Refazer a conta cobre-os todos, incluindo os que ainda não existem.
 *
 * DE HORA A HORA, e não de dez em dez minutos: um pedido que espera mais uma
 * hora não perde nada, e cada passagem lê a mesa inteira.
 */
export async function GET(req: NextRequest) {
  // Falha fechada: sem CRON_SECRET definido, a rota recusa. Aberta, seria um
  // endereço público que manda emails a profissionais.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/alcancar-pedidos] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const r = await correrOAlcance({ baseUrl: urlDeAccaoDoPedido(req.headers) });

    /*
     * Só se regista quando houve alguma coisa. A esmagadora maioria das
     * passagens não cria nada — quem havia de receber já recebeu — e uma linha
     * por hora a dizer «zero» tornava o registo ilegível.
     */
    if (r.novas > 0) {
      await registarSemFalhar({
        acontecimento: "pedido_distribuido",
        autorTipo: "sistema",
        autorNome: "alcance",
        resumo: resumoDoAlcance(r),
      });
    }

    return NextResponse.json({ ok: true, ...r, resumo: resumoDoAlcance(r) });
  } catch (error) {
    console.error("[cron/alcancar-pedidos]", error);
    return NextResponse.json({ error: "Falhou" }, { status: 500 });
  }
}
