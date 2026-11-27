import { appendOrderHistory, getPool, marcarConcluidoComoVisto } from "./db";
import { instanteDaBase } from "./hora-de-lisboa";
import { NOTA_SEM_RESPOSTA, respostaDoPosTrabalho, type MensagemDaConversa, type PosTrabalho } from "./pos-trabalho";

/**
 * DEPOIS DO TRABALHO, NA BASE — d147 (27-11-2026). As regras estão em
 * `pos-trabalho.ts`. Aqui: ler a conversa do WhatsApp de cada pedido (a
 * ponte grava tudo em `whatsappMensagens`) e fechar o «por ver».
 *
 * Quando as apps de cliente e Pro passarem a trazer respostas, juntam-se as
 * mensagens delas à mesma `respostaDoPosTrabalho`, com o canal delas.
 */

const marcas = (n: number) => Array.from({ length: n }, () => "?").join(", ");
const ultimosNove = (t: string | null | undefined) => String(t ?? "").replace(/\D/g, "").slice(-9);

/** Sem a data do trabalho, lê-se a conversa destes últimos dias. */
const DIAS_DA_CONVERSA = 45;
/** Um pouco antes do «está feito», para apanhar a pergunta que saiu nesse mesmo momento. */
const FOLGA_MS = 60 * 60 * 1000;

export type PosTrabalhoDoPedido = PosTrabalho & { pedidoId: number };

export async function lerPosTrabalhoDosPedidos(ids: ReadonlyArray<number>): Promise<PosTrabalhoDoPedido[]> {
  const unicos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 50);
  if (unicos.length === 0) return [];
  const p = await getPool();
  if (!p) return [];

  const [pedidos] = (await p.execute(
    `SELECT id, contactPhone FROM simulatorOrders WHERE id IN (${marcas(unicos.length)})`,
    unicos,
  )) as [Array<{ id: number; contactPhone: string | null }>, unknown];

  // Desde quando: o «está feito» (ou a confirmação) do trabalho acordado.
  const desde = new Map<number, Date>();
  try {
    const [neg] = (await p.execute(
      `SELECT pedidoId, execucaoEnviadaEm, confirmadoEm FROM negociacoes
        WHERE pedidoId IN (${marcas(unicos.length)}) AND estado = 'acordada'`,
      unicos,
    )) as [Array<{ pedidoId: number; execucaoEnviadaEm: unknown; confirmadoEm: unknown }>, unknown];
    for (const n of neg) {
      const d = instanteDaBase((n.execucaoEnviadaEm ?? n.confirmadoEm ?? null) as never);
      if (!d) continue;
      const antes = desde.get(Number(n.pedidoId));
      if (!antes || d < antes) desde.set(Number(n.pedidoId), d);
    }
  } catch {
    /* sem as datas, conta a janela dos últimos dias */
  }

  const noves = [...new Set(pedidos.map((x) => ultimosNove(x.contactPhone)).filter((t) => t.length === 9))];
  const conversa = new Map<string, MensagemDaConversa[]>();
  if (noves.length > 0) {
    try {
      const formas = noves.flatMap((t) => [t, `351${t}`]);
      const [linhas] = (await p.execute(
        `SELECT telefone, direccao, texto, criadoEm FROM whatsappMensagens
          WHERE telefone IN (${marcas(formas.length)})
            AND criadoEm > NOW() - INTERVAL ${DIAS_DA_CONVERSA} DAY
          ORDER BY id ASC`,
        formas,
      )) as [Array<{ telefone: string; direccao: string; texto: string; criadoEm: Date | string }>, unknown];
      for (const l of linhas) {
        const em = instanteDaBase(l.criadoEm as never);
        if (!em || (l.direccao !== "in" && l.direccao !== "out")) continue;
        const nove = ultimosNove(l.telefone);
        const lista = conversa.get(nove) ?? [];
        lista.push({ direccao: l.direccao, texto: String(l.texto ?? ""), em });
        conversa.set(nove, lista);
      }
    } catch {
      /* sem a tabela da ponte, não há conversa para ler */
    }
  }

  return pedidos.map((x) => {
    const id = Number(x.id);
    const d = desde.get(id);
    return {
      pedidoId: id,
      ...respostaDoPosTrabalho(conversa.get(ultimosNove(x.contactPhone)) ?? [], "whatsapp", d ? new Date(d.getTime() - FOLGA_MS) : null),
    };
  });
}

/**
 * FECHAR O «POR VER» DE UM CONCLUÍDO.
 *   · «guardada» — a nota já foi gravada pelo «Dar a nota como CLYON»; aqui só se tira o realce.
 *   · «sem_resposta» — fica uma nota INTERNA no histórico (o tipo «note», que o
 *     cliente não vê) e tira-se o realce. Não toca nas avaliações: nada de
 *     estrelas, nada no site nem no perfil do parceiro.
 */
export async function fecharOPosTrabalho(
  pedidoId: number,
  como: "guardada" | "sem_resposta",
  por: { id: number; nome: string; role: string } | null,
): Promise<void> {
  if (como === "sem_resposta") {
    await appendOrderHistory(pedidoId, { type: "note", by: por, message: `${NOTA_SEM_RESPOSTA}.` });
  }
  await marcarConcluidoComoVisto(pedidoId);
}
