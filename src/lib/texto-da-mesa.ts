/**
 * O QUE O CLIENTE LÊ SOBRE A MESA DELE, NO WHATSAPP.
 *
 * Está aqui, fora do cérebro, por uma razão prática: o cérebro importa a base
 * de dados no topo do ficheiro, e um texto que sai sozinho para o telemóvel de
 * um cliente — sem ninguém a rever — tem de poder ser lido num teste sem base
 * de dados nenhuma.
 *
 * QUEM DECIDE O QUE O CLIENTE VÊ NÃO É ESTE FICHEIRO. É `oClienteVeEsta()`, em
 * `negociacao.ts`, e é de propósito: há três ecrãs a mostrar a mesma lista — o
 * link do email, a conta e o WhatsApp — e uma regra escrita três vezes acaba
 * com três comportamentos. Aqui só se escreve o texto.
 */

/** "148,57 €" — vírgula decimal, que é como se escreve dinheiro em Portugal. */
export function euros(v: number): string {
  return v.toFixed(2).replace(".", ",") + " €";
}

/** Uma proposta que o cliente vê, como o texto precisa de a ver. */
export type LinhaDaMesa = {
  profissionalNome: string;
  valor: number;
  /** A última palavra é dele e está pendente: a bola está no cliente. */
  aSuaEspera: boolean;
};

/**
 * QUEM PROPÔS TEM NOME; QUEM AINDA NÃO PROPÔS É UMA CONTAGEM.
 *
 * Escrevia-se uma linha por negociação viva, e a de quem ainda não tinha
 * respondido saía «• Fred Teste: sem valor ainda». Uma cliente do #311 recebeu
 * quatro nomes, três deles assim: ficou a saber quem tinha o pedido dela na mão
 * e não lhe respondia — e um dos nomes era uma conta de ensaio. "O assistente
 * não deve expor os pros que ainda não enviaram propostas." — 13-09-2026.
 *
 * A linha nasce na DISTRIBUIÇÃO, não na proposta: existe desde o instante em
 * que o pedido lhe foi mostrado. Chamar «proposta em cima da mesa» a um convite
 * por responder é dar-lhe um nome que ele não tem.
 *
 * O QUE FICA NO LUGAR NÃO É SILÊNCIO. Esconder que há gente a olhar trocava um
 * problema por outro: o cliente ficava sem saber se vale a pena esperar mais um
 * bocado ou fechar já com quem propôs — que é exactamente a decisão que ele tem
 * em mãos. Diz-se QUANTOS são. É verdade, é útil, e não põe ninguém a
 * descoberto.
 *
 * @param propostas o que o cliente vê — já filtrado por `oClienteVeEsta()`
 * @param aVer      quantos têm o pedido à frente sem lhe terem tocado
 */
export function textoDaMesa(
  pedidoId: number,
  propostas: LinhaDaMesa[],
  aVer: number,
): string {
  if (propostas.length === 0) {
    return (
      `Pedido #${pedidoId}: ainda sem valores. ` +
      (aVer === 1
        ? "Está um profissional a ver o seu pedido"
        : `Estão ${aVer} profissionais a ver o seu pedido`) +
      ` — escrevo-lhe assim que chegar o primeiro.`
    );
  }

  const escritas = propostas.map(
    (l) => `• ${l.profissionalNome}: ${euros(l.valor)}${l.aSuaEspera ? " (à sua espera)" : ""}`,
  );
  const aindaAVer =
    aVer <= 0
      ? ""
      : aVer === 1
        ? "\n\nEstá mais um profissional a ver o seu pedido."
        : `\n\nEstão mais ${aVer} profissionais a ver o seu pedido.`;

  return (
    `Pedido #${pedidoId} — o que já recebeu:\n${escritas.join("\n")}${aindaAVer}\n\n` +
    `Use os botões da proposta para fechar ou recusar, ou responda com um valor (ex.: 300) para contrapropor.`
  );
}
