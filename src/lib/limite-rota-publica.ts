import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Travão para as rotas públicas que custam dinheiro a cada chamada.
 *
 * O simulador precisa de falar com o Google Maps e com o Gemini antes de a
 * pessoa ter conta — não há como exigir autenticação. Só que sem limite
 * nenhum, essas rotas são uma fatura aberta: quem descobrir /api/maps/route
 * ou /api/simulator/chat manda pedidos em ciclo e a conta é nossa. Também
 * dão para usar o nosso servidor e a nossa quota como proxy de graça.
 *
 * Os números são generosos para quem está mesmo a preencher um orçamento e
 * apertados para quem está a raspar: escrever uma morada dispara autocomplete
 * a cada tecla, calcular uma rota acontece uma ou duas vezes por pedido.
 */
export type LimiteResultado = { erro: NextResponse } | { erro: null };

export async function limitarRotaPublica(
  request: Request,
  nome: string,
  limite: number,
  janelaSegundos: number,
): Promise<LimiteResultado> {
  const rl = await checkRateLimit(`${nome}:${getClientIp(request)}`, limite, janelaSegundos);
  if (rl.allowed) return { erro: null };

  return {
    erro: NextResponse.json(
      { error: "Demasiados pedidos. Aguarde um momento e tente novamente." },
      { status: 429, headers: { "Retry-After": String(janelaSegundos) } },
    ),
  };
}
