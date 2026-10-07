import type { SimulatorOrder } from "../../drizzle/schema";
import { appendOrderHistory, assistentePode, getPool, registarMudancaDeData } from "./db";
import { enviarAvisoWhatsApp, telemovelParaWhatsApp } from "./whatsapp-cloud";
import { textoDoAvisoDeMoradaAoProfissional } from "./aviso-de-morada-ao-profissional";

/**
 * QUEM JÁ TEM O TRABALHO FICA A SABER DA EDIÇÃO — 07-10-2026.
 *
 * *«Sim, avisa por WhatsApp»*, à pergunta: «quando o trabalho já está
 * atribuído e mudas a data ou a morada, o profissional não recebe aviso».
 *
 * Editar um pedido com alguém contratado não o recomeça (`recomecarDoZero`
 * recusa), e até aqui a edição ficava só na base: ele dava pela morada nova
 * ao chegar à antiga. Agora, quando a edição muda o que ele precisa para lá
 * chegar:
 *
 *   · O DIA passa para o trabalho dele (`dataCombinada` — é o que ele vê, e o
 *     que a agenda mostra) e regista-se a mudança como a do arrasto da agenda.
 *     O WhatsApp sai pela passagem do assistente, como o desse: com a data
 *     quieta uns minutos, entre as 9h e as 21h, e o cliente avisado primeiro.
 *     Sem caminho novo, sem texto novo.
 *   · A MORADA (ou o destino de uma mudança) não tinha aviso nenhum. Sai já,
 *     como o de quando a CLYON o escolhe: foi uma pessoa a mudá-la agora, e
 *     é uma mensagem só.
 *
 * Só ao contratado, e só enquanto o trabalho está por fazer: depois de ele
 * dizer que está feito, a morada já não lhe serve de nada. Os dois avisos
 * obedecem ao interruptor «Avisar o profissional» do dono, e chegam a todos
 * — com ou sem os avisos do painel ligados, como o da data.
 *
 * NUNCA LANÇA. A edição já está gravada quando isto corre.
 */

export type AvisoAQuemTemOTrabalho = {
  profissional: string;
  /** O dia novo ficou no trabalho dele, e o aviso ficou à espera da passagem. */
  dia: boolean;
  /** O WhatsApp da morada. `null` quando nem a morada nem o destino mudaram. */
  morada: "saiu" | "nao_saiu" | "desligado" | "sem_telemovel" | null;
  /** O interruptor «Avisar o profissional». Desligado, nenhum dos dois sai. */
  avisosLigados: boolean;
};

/** Os campos do retrato (`recomecar-do-zero.ts`) que fazem a morada. */
const CAMPOS_DA_MORADA = ["address", "city", "postalCode"];

/** «Rua das Acácias, 12, 2975-000 Quinta do Conde» — sem repetir a localidade. */
export function moradaPorExtenso(p: {
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
}): string | null {
  const rua = p.address?.trim() ?? "";
  const cidade = p.city?.trim() ?? "";
  const cp = p.postalCode?.trim() ?? "";
  const resto = cidade && !rua.toLowerCase().includes(cidade.toLowerCase()) ? [cp, cidade].filter(Boolean).join(" ") : "";
  return [rua, resto].filter(Boolean).join(", ") || null;
}

function destinoDe(rawOrderJson: string | null | undefined): string | null {
  try {
    const cru = JSON.parse(rawOrderJson ?? "{}");
    const d = cru?.destinationAddress?.formattedAddress;
    return typeof d === "string" && d.trim() ? d.trim() : null;
  } catch {
    return null;
  }
}

export async function avisarQuemTemOTrabalho(a: {
  /** O pedido como ficou, relido da base depois de gravar. */
  pedido: SimulatorOrder;
  /** O que mudou (`oQueMudou`). */
  mudou: string[];
  /** A `dataAgendada` de ANTES da edição — a da base já é a nova. */
  diaAntesDaEdicao: Date | null;
  baseUrl: string;
}): Promise<AvisoAQuemTemOTrabalho | null> {
  const diaNovo = a.mudou.includes("dataAgendada") && a.pedido.dataAgendada ? new Date(a.pedido.dataAgendada) : null;
  const mudouAMorada = a.mudou.some((c) => CAMPOS_DA_MORADA.includes(c));
  const mudouODestino = a.mudou.includes("destino");
  if (!diaNovo && !mudouAMorada && !mudouODestino) return null;

  try {
    const pool = await getPool();
    if (!pool) return null;
    const [linhas] = (await pool.execute(
      `SELECT n.id, n.dataCombinada, p.name AS profissionalNome, p.phone AS profissionalTelefone
         FROM negociacoes n JOIN providers p ON p.id = n.providerId
        WHERE n.pedidoId = ? AND n.estado = 'acordada'
          AND n.execucaoEnviadaEm IS NULL AND n.confirmadoEm IS NULL AND n.pagoEm IS NULL
        LIMIT 1`,
      [a.pedido.id],
    )) as [
      Array<{ id: number; dataCombinada: Date | null; profissionalNome: string; profissionalTelefone: string | null }>,
      unknown,
    ];
    const linha = linhas[0];
    if (!linha) return null;

    const nome = linha.profissionalNome;
    const avisosLigados = await assistentePode("avisar_profissional").catch(() => false);
    const historia: string[] = [];

    let dia = false;
    if (diaNovo) {
      // O que ele sabia: o dia combinado, ou — sem ele — o que o cliente pediu.
      const antes = linha.dataCombinada ? new Date(linha.dataCombinada) : a.diaAntesDaEdicao;
      if ((antes?.getTime() ?? null) !== diaNovo.getTime()) {
        await pool.execute("UPDATE negociacoes SET dataCombinada = ? WHERE id = ?", [diaNovo, linha.id]);
        await registarMudancaDeData({
          negociacaoId: linha.id,
          pedidoId: a.pedido.id,
          antes,
          porQuem: "clyon",
          antesJaLido: true,
        });
        dia = true;
        historia.push(`o dia do trabalho de ${nome} passou para o da edição`);
      }
    }

    let morada: AvisoAQuemTemOTrabalho["morada"] = null;
    if (mudouAMorada || mudouODestino) {
      const telefone = telemovelParaWhatsApp(linha.profissionalTelefone);
      if (!avisosLigados) morada = "desligado";
      else if (!telefone) morada = "sem_telemovel";
      else {
        const texto = textoDoAvisoDeMoradaAoProfissional(
          {
            pedidoId: a.pedido.id,
            profissional: nome,
            servico: a.pedido.serviceType ?? null,
            localidade: a.pedido.city ?? null,
            morada: mudouAMorada ? moradaPorExtenso(a.pedido) : null,
            destino: mudouODestino ? destinoDe(a.pedido.rawOrderJson) : null,
            link: `${a.baseUrl}/profissionais/painel`,
          },
          new Date(),
        );
        morada = (await enviarAvisoWhatsApp(telefone, texto).catch(() => false)) ? "saiu" : "nao_saiu";
      }
      historia.push(
        morada === "saiu"
          ? `${nome} foi avisado por WhatsApp da morada nova`
          : `${nome} NÃO foi avisado por WhatsApp da morada nova (${morada})`,
      );
    }

    // O dia «mudado» para o mesmo que ele já tinha não é notícia.
    if (historia.length === 0) return null;

    await appendOrderHistory(a.pedido.id, {
      type: "agenda",
      by: null,
      message: `Depois da edição: ${historia.join("; ")}.`,
    }).catch(() => {});

    return { profissional: nome, dia, morada, avisosLigados };
  } catch (e) {
    console.error("[avisar-quem-tem-o-trabalho]", e);
    return null;
  }
}
