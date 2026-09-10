import type { Pedido } from "./tipos";

/**
 * ARRUMAR UM TRABALHO — a mesma regra em «Os meus trabalhos» e na Agenda.
 *
 * Vivia dentro do `Trabalhos.tsx`, que era o único sítio com botão de
 * arquivar. Os profissionais queixaram-se de ter «a agenda cheia»: um
 * trabalho contratado onde o cliente deixou de responder nunca mais sai de
 * lá, porque só sai quando alguém o dá por feito — e não há ninguém do outro
 * lado para o fazer.
 *
 * Arquivar já resolvia isso e já escondia da agenda; o que faltava era o
 * botão ONDE a queixa nasce. Passa a haver nos dois ecrãs, com esta regra
 * partilhada: duas cópias divergiam à primeira alteração, e a que ficasse
 * para trás deixava de desistir antes de esconder — que é a parte que
 * protege o cliente.
 */

export function negociacaoAberta(p: Pedido): boolean {
  return p.estado === "aberta" || p.estado === "aguarda_contratacao";
}

/**
 * A pergunta antes de arquivar — só quando arquivar faz mais do que arrumar.
 *
 * Um pedido aberto: arquivar diz ao cliente que não há interesse (senão a
 * proposta dele ficava na mesa à espera de alguém que já não vai responder).
 * Um contratado: arquivar tira-o da vista E da agenda, e o trabalho continua
 * combinado — é melhor sabê-lo antes do toque.
 */
export function confirmarArrumacao(p: Pedido): boolean {
  if (negociacaoAberta(p)) {
    return window.confirm(
      "Arquivar este pedido diz ao cliente que não está interessado e tira-o da sua vista. Continuar?",
    );
  }
  if (p.estado === "acordada" && !p.confirmadoEm && !p.pagoEm) {
    return window.confirm(
      "Este trabalho está contratado. Arquivar só o tira da sua vista e da agenda — continua combinado com o cliente. Continuar?",
    );
  }
  return true;
}

/**
 * Arruma um trabalho, ou repõe-no. Devolve true se mexeu.
 *
 * Não apaga nada: muda de separador. O que o cliente vê fica igual, a
 * carteira conta o mesmo, e o "Arquivados" existe precisamente para nada
 * desaparecer de vez.
 *
 * SE AINDA ESTÁ ABERTO, DESISTE PRIMEIRO. Arquivar sem desistir deixava uma
 * negociação-fantasma: o cliente e a CLYON viam "à espera de resposta" de
 * alguém que tinha arrumado o pedido e nunca mais o ia ver. A desistência é
 * a mesma da rota de negociação — com o histórico e os avisos de sempre.
 */
export async function arrumarTrabalho(p: Pedido, arquivar: boolean): Promise<boolean> {
  if (arquivar && negociacaoAberta(p)) {
    const desistiu = await fetch("/api/profissionais/negociacao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accao: "desistir", negociacaoId: p.negociacaoId }),
    });
    // Se a desistência falhar (prazo, estado mudou), não se esconde nada: o
    // pedido continua à vista para ele perceber o que se passou.
    if (!desistiu.ok) return false;
  }
  const res = await fetch("/api/profissionais/arquivar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ negociacaoId: p.negociacaoId, arquivar }),
  });
  return res.ok;
}
