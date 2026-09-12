import { NextRequest, NextResponse } from "next/server";
import { registarSemFalhar } from "@/lib/db";
import { correrOAssistente } from "@/lib/assistente-automatico";

export const runtime = "nodejs";

/**
 * A PASSAGEM DO ASSISTENTE — de dez em dez minutos.
 *
 * "Sempre que tenha novidade deve informar o cliente. Caso o cliente não
 * responda, deve reenviar mensagens para garantir que o pedido fique
 * finalizado." — 12-09-2026.
 *
 * O que acontece em cada passagem está em `correrOAssistente`; esta rota só
 * lhe abre a porta e escreve o que ela fez. A decisão de QUANDO falar vive nos
 * seis interruptores, não aqui: com todos em baixo esta rota corre à mesma,
 * não faz nada, e não custa nada.
 *
 * DEZ MINUTOS, E NÃO UMA VEZ POR DIA. As novidades que este cron conta são
 * sobre dinheiro à espera de uma resposta — uma proposta que fica um dia por
 * anunciar é uma proposta perdida para quem respondeu primeiro. O que se
 * protege contra o excesso não é a frequência da passagem: é a chave única de
 * cada novidade, que faz da segunda passagem uma passagem em branco.
 *
 * A HORA A QUE SE CALA está em `horaDeFalar`, e não no horário do cron. O
 * mesmo cron que não manda um lembrete às 3 da manhã continua a precisar de
 * correr nessa hora para fechar avisos a que o cliente já respondeu.
 */
export async function GET(req: NextRequest) {
  // Falha fechada: sem CRON_SECRET definido, a rota recusa. Aberta, seria um
  // endereço público que manda mensagens a clientes reais.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/assistente] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const r = await correrOAssistente();

    /*
     * Só se regista quando houve alguma coisa. Cento e quarenta e quatro
     * linhas por dia a dizer "zero" enterravam as poucas que interessam — e
     * este registo é permanente, não é um ficheiro de depuração.
     */
    const mexeu = r.novidades + r.lembretes + r.entregues + r.alertas;
    if (mexeu > 0) {
      await registarSemFalhar({
        acontecimento: "assistente_alerta",
        autorTipo: "assistente",
        autorNome: "passagem",
        resumo:
          `${r.novidades} novidade(s), ${r.lembretes} lembrete(s), ` +
          `${r.alertas} alerta(s) à equipa, ${r.entregues} conversa(s) entregue(s).`,
        detalhe: { linhas: r.linhas.slice(0, 40) },
      });
    }

    return NextResponse.json({ ok: true, ...r });
  } catch (error) {
    console.error("[cron/assistente]", error);
    return NextResponse.json({ error: "Erro na passagem do assistente" }, { status: 500 });
  }
}
