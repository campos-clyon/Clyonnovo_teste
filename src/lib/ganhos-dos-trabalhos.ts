import { diaQueConta, lucroDoTrabalho, trabalhosQueContam, type LinhaCruaDoTrabalho } from "./assistentes";
import type { GanhoDoTrabalho } from "./dinheiro-do-inicio";

/**
 * O GANHO DE CADA TRABALHO, PARA O BRUTO DO INÍCIO — d139, 27-11-2026.
 *
 * Uma fonte só: a mesma leitura (`trabalhosQueContam`: concluídos, sem contas
 * de teste) e a mesma conta (`lucroDoTrabalho`) das comissões das
 * assistentes e da sócia, que as Finanças já usam. O dia é o do trabalho
 * feito (`diaQueConta`).
 *
 * Os dois modelos dão a mesma conta: `lucroDoTrabalho` tira as taxas da
 * negociação sobre o acordado (`comissaoDaClyon`) — antes de 15-11 a parte da
 * CLYON do que o cliente lhe pagou; desde 15-11 a taxa que o parceiro passa
 * (a base da fatura da CLYON de `taxaAPassarAClyon`, sem IVA). Num Trabalho
 * CLYON, o preço ao cliente menos o que o profissional recebe.
 */
export function ganhosDosTrabalhos(linhas: LinhaCruaDoTrabalho[], hoje: string): GanhoDoTrabalho[] {
  const r: GanhoDoTrabalho[] = [];
  for (const l of linhas) {
    if (l.status !== "concluido") continue;
    const dia = diaQueConta(l);
    if (!dia || dia > hoje) continue;
    const t = lucroDoTrabalho(l);
    r.push({
      pedidoId: Number(l.id),
      dia,
      ganho: t.lucro,
      semValor: t.fonte === "falta_lucro" || t.fonte === "falta_preco_ao_cliente",
    });
  }
  return r;
}

/** Desde sempre: o «Total até hoje» conta todos os trabalhos feitos. */
export const DESDE_SEMPRE = "2000-01-01";

/** Lê os trabalhos feitos e devolve o ganho de cada um. Se a leitura falhar, `null`. */
export async function lerGanhosDosTrabalhos(hoje: string): Promise<GanhoDoTrabalho[] | null> {
  try {
    return ganhosDosTrabalhos(await trabalhosQueContam(DESDE_SEMPRE), hoje);
  } catch (e) {
    console.error("[início] ganhos dos trabalhos", e);
    return null;
  }
}
