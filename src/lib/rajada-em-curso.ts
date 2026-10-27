/**
 * A RAJADA QUE ESTÁ A SER RESPONDIDA — 27-10-2026 (decisão d2).
 *
 * A rota da ponte responde a uma rajada dentro da tranca do número; aqui fica
 * o número e a última mensagem do cliente que essa execução leu. O envio
 * (`enviarTextoWhatsApp`) olha para isto antes de mandar uma pergunta: se
 * entretanto chegou outra mensagem, a pergunta cala-se — ver
 * `calarAPerguntaPorChegarOutra` em `rajada-do-whatsapp.ts`.
 *
 * Fora de uma rajada (os avisos, o painel, as rotinas) não há nada aqui, e o
 * envio é o de sempre.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type RajadaEmCurso = { telefone: string; ultimaLida: number };

const guarda = new AsyncLocalStorage<RajadaEmCurso>();

/** Corre `fazer` como a resposta à rajada deste número. */
export function dentroDaRajada<T>(rajada: RajadaEmCurso, fazer: () => Promise<T>): Promise<T> {
  return guarda.run(rajada, fazer);
}

/** A rajada a ser respondida agora, se este envio é parte de uma. */
export function rajadaEmCurso(): RajadaEmCurso | undefined {
  return guarda.getStore();
}

/** O mesmo número, escreva-se como se escrever — pelos últimos nove algarismos. */
export function mesmoNumero(a: string, b: string): boolean {
  const x = a.replace(/\D/g, "").slice(-9);
  return x.length === 9 && x === b.replace(/\D/g, "").slice(-9);
}
