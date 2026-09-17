import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { contarNovidades, marcarSeccaoVista, vistosDoBackoffice } from "@/lib/db";
import {
  SECCOES_COM_AVISO,
  desdeQuando,
  eSeccaoComAviso,
  nenhumaNovidade,
} from "@/lib/novidades-do-backoffice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O SELO VERMELHO DE CADA SECÇÃO DO MENU.
 *
 * "Coloque todas as categorias — Pedidos, Profissionais, Agenda, WhatsApp,
 * Carteiras — para terem notificações como no supp, mas devem sumir ao abrir
 * ou visualizar." — 17-09-2026.
 *
 * O Suporte já tinha o dele. As outras secções não tinham nada: para saber se
 * entrou um pedido era preciso abrir Pedidos e comparar de cabeça com o que lá
 * estava da última vez — que é trabalho que o ecrã devia fazer.
 *
 * ⚠️ NÃO CONFUNDIR COM O SELO DO SUPORTE. Ali o número é «quantos esperam por
 * resposta» e só se apaga respondendo; aqui é «o que aconteceu desde que
 * olhaste» e apaga-se por se olhar. São perguntas diferentes, e ter as duas é
 * o que faz o WhatsApp funcionar: o círculo com número desaparece ao abrir, e
 * a conversa continua na lista até alguém responder.
 *
 * UMA CHAMADA SÓ para o menu inteiro. Seis pedidos de dois em dois minutos,
 * um por secção, era o género de coisa que se paga na factura e no tempo de
 * resposta de toda a gente.
 */
export async function GET(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  if (!colab) return NextResponse.json({ novidades: nenhumaNovidade() });

  try {
    const vistos = await vistosDoBackoffice(colab.id);
    const agora = Date.now();
    const desde: Record<string, Date> = {};
    for (const s of SECCOES_COM_AVISO) desde[s] = desdeQuando(vistos[s], agora);

    /*
     * As que a consulta não conseguiu contar ficam a zero, e não em falta: um
     * `undefined` a chegar ao menu desenhava «NaN» ao lado do nome da secção.
     */
    return NextResponse.json({ novidades: { ...nenhumaNovidade(), ...(await contarNovidades(desde)) } });
  } catch (e) {
    /*
     * Um selo a menos é um problema pequeno; um menu que não desenha é um
     * backoffice que não abre. Devolve zeros e fica nos registos.
     */
    console.error("[novidades GET]", e);
    return NextResponse.json({ novidades: nenhumaNovidade() });
  }
}

/**
 * VISTO — apaga o selo desta secção, para esta pessoa.
 *
 * Chamado quando ele abre a secção. É o mesmo gesto do WhatsApp: abrir é ler,
 * e não há um botão «marcar como lido» para ninguém se lembrar de carregar.
 */
export async function PATCH(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  if (!colab) return NextResponse.json({ error: "Sem sessão." }, { status: 401 });

  let corpo: { seccao?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  // Só as secções que têm selo. Sem isto, a tabela enchia-se do que quer que
  // alguém mandasse no corpo.
  if (!eSeccaoComAviso(corpo.seccao)) {
    return NextResponse.json({ error: "Secção desconhecida." }, { status: 400 });
  }

  try {
    await marcarSeccaoVista(colab.id, corpo.seccao);
    return NextResponse.json({ ok: true });
  } catch (e) {
    /*
     * Falhar a marcar não diz nada a quem está a olhar: a secção abriu e o
     * número já desapareceu do ecrã. Volta na passagem seguinte, que é a
     * forma certa de dizer que não ficou gravado.
     */
    console.error("[novidades PATCH]", e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
