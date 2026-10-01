import { DIAS_PARA_PAGAR_A_DIVIDA } from "./divida-do-profissional";
import { dividasDe, type DividaNaCarteira, type TrabalhoNaCarteira } from "./carteira";

/**
 * O PROFISSIONAL QUE NÃO PAGA A DÍVIDA DEIXA DE FAZER TRABALHOS EM DINHEIRO —
 * 01-10-2026.
 *
 * "E se o profissional não pagar a dívida? — Abater no saldo + bloquear." E o
 * bloqueio, dito pelo dono no mesmo dia: se uma dívida ficar por pagar mais de
 * `DIAS_PARA_PAGAR_A_DIVIDA` dias depois de gerada, o profissional deixa de
 * poder ACEITAR e PROPOR em trabalhos pagos em `dinheiro` — continua nos pela
 * plataforma — até a dívida estar paga (por referência) ou abatida (no saldo).
 *
 * PORQUE SÓ NO DINHEIRO. A dívida nasce de o cliente lhe pagar em mão o preço
 * inteiro, com o IVA e a comissão da CLYON lá dentro. Num trabalho pela
 * plataforma o dinheiro passa pela CLYON e não há nada a dever; deixá-lo
 * continuar a trabalhar assim é deixá-lo ganhar o saldo com que a dívida se
 * vai abater. Fechar-lhe também esses era empurrá-lo para fora sem lhe deixar
 * maneira de pagar.
 *
 * TRÊS SÍTIOS, A MESMA FUNÇÃO (`bloqueioEmDinheiro`):
 *   · as rotas onde ele propõe e aceita (o painel e o link do email) recusam,
 *     com a explicação — `explicacaoDoBloqueio`;
 *   · a distribuição não lhe manda pedidos em dinheiro
 *     (`profissional-elegivel.ts`, motivo `divida_em_atraso`);
 *   · o painel diz-lhe porquê, com o valor e a referência.
 *
 * Pura: recebe os trabalhos como a carteira os lê (`trabalhosDaCarteira`), e
 * por isso uma dívida paga ou abatida deixa de bloquear no instante em que a
 * carteira a dá por paga — não há estado de «bloqueado» guardado em lado
 * nenhum que alguém se possa esquecer de levantar.
 */

const DIA = 86_400_000;

/** O fim do prazo para a pagar — `null` quando não se sabe quando nasceu. */
export function venceEm(d: Pick<DividaNaCarteira, "nasceuEm">): Date | null {
  if (!d.nasceuEm || Number.isNaN(d.nasceuEm.getTime())) return null;
  return new Date(d.nasceuEm.getTime() + DIAS_PARA_PAGAR_A_DIVIDA * DIA);
}

export type DividaEmAtraso = DividaNaCarteira & { venceuEm: Date };

/**
 * As dívidas por pagar há MAIS de `DIAS_PARA_PAGAR_A_DIVIDA` dias.
 *
 * «Mais de 7 dias» lê-se ao pé da letra: no sétimo dia ainda está a tempo, e
 * passa a atrasada no instante a seguir a fazer sete dias certos. Sem data de
 * nascimento não se conta prazo nenhum — e não bloqueia: bloquear alguém por
 * uma data que não se sabe era castigá-lo por um buraco nosso.
 */
export function dividasEmAtraso(trabalhos: TrabalhoNaCarteira[], agora: Date): DividaEmAtraso[] {
  const saida: DividaEmAtraso[] = [];
  for (const d of dividasDe(trabalhos, agora)) {
    if (d.paga) continue;
    const fim = venceEm(d);
    if (fim && agora.getTime() > fim.getTime()) saida.push({ ...d, venceuEm: fim });
  }
  return saida.sort((a, b) => a.venceuEm.getTime() - b.venceuEm.getTime());
}

export type BloqueioEmDinheiro = {
  /** Não pode propor nem aceitar trabalhos em dinheiro. */
  bloqueado: boolean;
  /** A soma das dívidas em atraso. */
  total: number;
  dividas: DividaEmAtraso[];
};

export function bloqueioEmDinheiro(trabalhos: TrabalhoNaCarteira[], agora: Date): BloqueioEmDinheiro {
  const dividas = dividasEmAtraso(trabalhos, agora);
  const total = Math.round(dividas.reduce((s, d) => s + d.total, 0) * 100) / 100;
  return { bloqueado: dividas.length > 0, total, dividas };
}

/** «124,95 €» */
function euros(v: number): string {
  return `${v.toFixed(2).replace(".", ",")} €`;
}

/** O que se sabe de cada dívida para a dizer: o pedido e a referência viva. */
export type DividaParaDizer = {
  total: number;
  pedidoId: number | null;
  /** A Multibanco viva para a pagar, quando há. */
  multibanco?: { entidade: string | null; referencia: string | null } | null;
};

/**
 * PORQUÊ, COM O VALOR E A REFERÊNCIA — a frase que o profissional lê na rota
 * que o recusa e no painel. Uma recusa sem o número nem por onde pagar é uma
 * chamada para o apoio.
 */
export function explicacaoDoBloqueio(dividas: DividaParaDizer[]): string {
  if (dividas.length === 0) return "";
  const total = Math.round(dividas.reduce((s, d) => s + d.total, 0) * 100) / 100;
  const cada = dividas
    .map((d) => {
      const de = d.pedidoId != null ? `${euros(d.total)} do pedido #${d.pedidoId}` : euros(d.total);
      const mb = d.multibanco;
      return mb?.referencia
        ? `${de} (Multibanco: entidade ${mb.entidade ?? "—"}, referência ${mb.referencia})`
        : de;
    })
    .join("; ");
  return (
    `Tem ${euros(total)} por pagar à CLYON há mais de ${DIAS_PARA_PAGAR_A_DIVIDA} dias — ` +
    `o IVA e a comissão de trabalhos que o cliente lhe pagou em dinheiro: ${cada}. ` +
    "Enquanto não estiver pago, não pode propor nem aceitar trabalhos pagos em dinheiro; " +
    "os pagos pela plataforma continuam abertos. Pode pagar pela referência na sua carteira — " +
    "ou, se tiver saldo que chegue, fica abatido nele quando a próxima transferência que pedir for paga."
  );
}
