import type { ResultadoDoEnvio } from "./enviar-ficheiro";

/**
 * QUANDO O SERVIDOR DIZ «DEMASIADOS ENVIOS», ESPERA-SE E TENTA-SE OUTRA VEZ —
 * d145, 27-11-2026.
 *
 * No backoffice, quatro fotografias do WhatsApp ficaram todas em «Falhou» com
 * «Demasiados envios». A resposta 429 não diz que a foto é má: diz «agora
 * não». Por isso não se mostra falha à primeira — espera-se um pouco, cada vez
 * mais, e tenta-se de novo. Quem chama envia uma fotografia de cada vez (a
 * fila do formulário), e é isso que deixa o limite respirar entre tentativas.
 *
 * Qualquer outra falha (formato, tamanho, rede) volta logo: repetir não a
 * resolve.
 */
export const ESPERAS_ENTRE_TENTATIVAS_MS = [3_000, 6_000, 12_000, 24_000, 48_000];

export async function enviarComNovasTentativas(
  enviar: () => Promise<ResultadoDoEnvio>,
  opcoes: {
    esperas?: number[];
    dormir?: (ms: number) => Promise<void>;
    /** Antes de cada espera: qual tentativa vem a seguir e quanto se espera. */
    aoEsperar?: (tentativa: number, ms: number) => void;
  } = {},
): Promise<ResultadoDoEnvio> {
  const esperas = opcoes.esperas ?? ESPERAS_ENTRE_TENTATIVAS_MS;
  const dormir = opcoes.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let r = await enviar();
  for (let i = 0; i < esperas.length && !r.ok && r.demasiados; i++) {
    opcoes.aoEsperar?.(i + 2, esperas[i]);
    await dormir(esperas[i]);
    r = await enviar();
  }
  return r;
}
