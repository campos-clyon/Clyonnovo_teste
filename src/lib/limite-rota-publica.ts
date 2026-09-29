import { createHash } from "node:crypto";
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

/**
 * O mesmo travão, mas por CONTA e não por máquina.
 *
 * `limitarRotaPublica` junta SEMPRE o IP à chave — é o que ela é. Chamá-la com
 * `entrada-link-email:${email}` dava um limite por email E por IP, e quem
 * mudasse de máquina (ou usasse cem) começava do zero em cada uma. Para travar
 * quem tenta uma conta a partir de muitos sítios, ou quem enche a caixa de
 * correio de outra pessoa, a chave tem de ser só a conta.
 *
 * Vai em resumo (SHA-256), sem maiúsculas: a chave fica escrita no Redis, e o
 * email ou o nome de entrada de alguém não tem nada que lá estar.
 */
export async function limitarPorConta(
  nome: string,
  conta: string,
  limite: number,
  janelaSegundos: number,
): Promise<LimiteResultado> {
  const resumo = createHash("sha256").update(conta.trim().toLowerCase()).digest("hex").slice(0, 32);
  const rl = await checkRateLimit(`${nome}:${resumo}`, limite, janelaSegundos);
  if (rl.allowed) return { erro: null };

  return {
    erro: NextResponse.json(
      { error: "Demasiadas tentativas. Aguarde alguns minutos e tente novamente." },
      { status: 429, headers: { "Retry-After": String(janelaSegundos) } },
    ),
  };
}
