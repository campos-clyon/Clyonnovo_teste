import { NextRequest, NextResponse } from "next/server";
import { registarSemFalhar } from "@/lib/db";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { correrOAssistente } from "@/lib/assistente-automatico";
import { correrAsRecolhasParadas } from "@/lib/recolhas-paradas";
import { correrOsAvisosDaEquipaNaBase } from "@/lib/avisos-a-equipa-na-base";
import { bearerConfere } from "@/lib/segredo-igual";

export const runtime = "nodejs";

/**
 * Sessenta segundos, e não os dez por omissão.
 *
 * A passagem mais pesada de todas é a PRIMEIRA — a que sela o que já existe —
 * e é também a única que não se pode dar ao luxo de ser cortada a meio.
 * Cortada, ficaria trabalho por fazer; e o que ficasse por selar seria
 * anunciado aos clientes como novidade. A semeadura foi reescrita para caber
 * numa consulta por lote, mas o tecto do relógio tem de ser dito à mesma:
 * confiar no valor por omissão é confiar num número que ninguém escolheu.
 */
export const maxDuration = 60;

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
  // Em tempo constante — ver segredo-igual.ts.
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    /*
     * CADA PASSAGEM FICA CARIMBADA — 27-10-2026 (d7). Também a que não fez
     * nada e a que rebentou: é o painel «Rotinas» que diz se ela está viva.
     * O carimbo leva só contagens — as linhas têm telefones.
     */
    const { r, paradas, paradasFalharam } = await carimbarPassagem(
      "assistente",
      async () => {
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

    /*
     * E AS RECOLHAS PARADAS — 23-10-2026. Dez minutos sem resposta a uma
     * pergunta, passa-se à seguinte; trinta sem resposta ao resumo, o pedido
     * regista-se sozinho. Ver `recolhas-paradas.ts`. Uma falha aqui não
     * estraga a passagem do assistente.
     */
    let paradasFalharam: string | null = null;
    const paradas = await correrAsRecolhasParadas().catch((e) => {
      console.error("[cron/assistente] recolhas paradas:", e);
      paradasFalharam = e instanceof Error ? e.message : String(e);
      return { saltadas: 0, registadas: 0, seguidas: 0, linhas: [] as string[] };
    });
    // E a mensagem gentil a quem ficou calado (d25 v2, interruptor nas Configs).
    if (paradas.saltadas + paradas.registadas + paradas.seguidas > 0) {
      await registarSemFalhar({
        acontecimento: "assistente_alerta",
        autorTipo: "assistente",
        autorNome: "recolhas paradas",
        resumo: `${paradas.seguidas} mensagem(ns) gentil(is) a quem ficou calado, ${paradas.saltadas} pergunta(s) deixada(s) para depois, ${paradas.registadas} pedido(s) registado(s) sem resposta ao resumo.`,
        detalhe: { linhas: paradas.linhas.slice(0, 40) },
      });
    }

    return { r, paradas, paradasFalharam: paradasFalharam as string | null };
      },
      (p) => ({
        ok: p.paradasFalharam == null,
        motivo: p.paradasFalharam ? `recolhas paradas: ${p.paradasFalharam}` : null,
        detalhe: {
          novidades: p.r.novidades,
          lembretes: p.r.lembretes,
          alertas: p.r.alertas,
          entregues: p.r.entregues,
          recolhasSaltadas: p.paradas.saltadas,
          recolhasRegistadas: p.paradas.registadas,
          recolhasSeguidas: p.paradas.seguidas,
        },
      }),
    );
    /*
     * OS AVISOS À EQUIPA — 10-11-2026 (d23). O que está parado no «Do nosso
     * lado» há mais de 2 h, no «Orçamentos novos» há mais de 1 h, e as conversas
     * que a Vitória entregou fora de horas: um aviso no telemóvel da equipa,
     * uma vez por espera, só das 08h às 21h. Ver `avisos-a-equipa.ts`. Uma
     * falha aqui não estraga a passagem.
     */
    const avisosDaEquipa = await correrOsAvisosDaEquipaNaBase().catch((e) => {
      console.error("[cron/assistente] avisos à equipa:", e);
      return null;
    });
    if (avisosDaEquipa && avisosDaEquipa.enviados + avisosDaEquipa.entregasEnviadas > 0) {
      await registarSemFalhar({
        acontecimento: "assistente_alerta",
        autorTipo: "assistente",
        autorNome: "avisos à equipa",
        resumo: `${avisosDaEquipa.enviados} aviso(s) do que está parado, ${avisosDaEquipa.entregasEnviadas} conversa(s) entregue(s) anunciada(s).`,
        detalhe: { linhas: avisosDaEquipa.linhas.slice(0, 40), falhas: avisosDaEquipa.falhas.slice(0, 10) },
      });
    }
    /*
     * A RUA DEPOIS DO ACEITE — 17-11-2026 (d69). Os pedidos só com a zona
     * aceites por outro caminho (o link, a app, a Mesa) levam a pergunta da
     * rua, uma vez; os que ficaram sem resposta há 2 h passam à equipa. Ver
     * `rua-depois-do-aceite.ts`. Uma falha aqui não estraga a passagem.
     */
    const { correrARuaDepoisDoAceite } = await import("@/lib/rua-depois-do-aceite-na-base");
    const daRua = await correrARuaDepoisDoAceite().catch((e) => {
      console.error("[cron/assistente] rua depois do aceite:", e);
      return { linhas: [] as string[] };
    });
    if (daRua.linhas.length > 0) {
      await registarSemFalhar({
        acontecimento: "assistente_alerta",
        autorTipo: "assistente",
        autorNome: "rua depois do aceite",
        resumo: `${daRua.linhas.length} pedido(s) sem a rua tratados: ${daRua.linhas.slice(0, 10).join("; ")}.`,
        detalhe: { linhas: daRua.linhas.slice(0, 40) },
      });
    }
    return NextResponse.json({
      ok: true,
      ruaDepoisDoAceite: daRua.linhas.length,
      ...r,
      recolhasParadas: paradas,
      paradasFalharam,
      avisosDaEquipa: avisosDaEquipa
        ? {
            emHorario: avisosDaEquipa.emHorario,
            acimaDosPrazos: avisosDaEquipa.acimaDosPrazos,
            enviados: avisosDaEquipa.enviados,
            entregasEnviadas: avisosDaEquipa.entregasEnviadas,
            semNinguem: avisosDaEquipa.semNinguem,
            falhas: avisosDaEquipa.falhas.length,
          }
        : null,
    });
  } catch (error) {
    console.error("[cron/assistente]", error);
    return NextResponse.json({ error: "Erro na passagem do assistente" }, { status: 500 });
  }
}
