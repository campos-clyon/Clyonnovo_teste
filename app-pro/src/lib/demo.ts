/**
 * O MODO DE DEMONSTRAÇÃO FICA FORA DA APP PUBLICADA — 10-11-2026 (d25).
 *
 * A demonstração (`EXPO_PUBLIC_DEMO=1`, trabalhos de exemplo inventados) só
 * serve para ver os ecrãs no navegador, e vive em `demo.web.ts`: o Metro só a
 * junta ao bundle da web. No Android e no iPhone resolve-se este ficheiro, que
 * não leva exemplos nenhuns — nem os números de exemplo, que não são os reais.
 */
export const EM_DEMO = false;

export async function pedirEmDemo<T>(_caminho: string, _metodo: string, _corpo: unknown): Promise<T> {
  throw new Error("A demonstração só existe no navegador.");
}
