import { instanteDaBase } from "./hora-de-lisboa";
import { TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE, novoModeloEmVigor } from "./novo-modelo";

/**
 * UM TRABALHO CLYON SEGUE O MODELO DE 15-11? — d33 (CEO e dono, 15-11-2026,
 * proposta A).
 *
 * Pela CRIAÇÃO do Trabalho CLYON: criado a partir das 00:00 de 16-11-2026 em
 * Lisboa → modelo novo (o cliente paga ao parceiro; a CLYON fatura a taxa do
 * escalão); criado antes → modelo antigo, até ao fim.
 *
 * A data vem da base: um `Date` (coluna DATETIME, lida em UTC) ou o texto sem
 * fuso que a base devolve (`instanteDaBase`, memória «a base é lida em UTC»).
 * Sem data, fica no ANTIGO — nunca se passa um trabalho ao modelo novo por não
 * se saber quando nasceu.
 *
 * ⚠️ AINDA NÃO LIGADO: enquanto `TRABALHOS_CLYON_NO_MODELO_ANTIGO` estiver a
 * `true` (`novo-modelo.ts`), `eDoNovoModelo` não pergunta isto. Ver lá porquê.
 */
export function trabalhoClyonNoNovoModelo(
  criadoEm: Date | string | null | undefined,
  agora: Date,
): boolean {
  if (!novoModeloEmVigor(agora)) return false;
  const criado = instanteDaBase(criadoEm ?? null);
  if (!criado) return false;
  return criado.getTime() >= TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE.getTime();
}
