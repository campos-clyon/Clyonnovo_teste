/**
 * O MESMO CHAT, NO ENDEREÇO ANTIGO.
 *
 * Havia dois endpoints para a mesma conversa do simulador — este e
 * `/api/simulator/chat` — com 350 linhas quase iguais cada um. Quase, e é
 * aí que estava o problema: divergiam no modelo (este lia `GEMINI_MODEL`, o
 * outro `CHAT_MODEL`) e na forma da resposta (este descrevia o `orderPatch`
 * campo a campo, o outro usa `Partial<OrderData>` e acompanha o tipo
 * sozinho). Duas cópias que respondem diferente à mesma pergunta são pior do
 * que uma cópia só: o dia em que uma se corrige, a outra fica a mentir.
 *
 * Nenhum dos dois é chamado de dentro do site — procurei em todo o
 * repositório. Mas um endereço público pode estar a ser chamado de fora (a
 * app, um teste, uma automação), e apagá-lo às cegas é partir o que não se
 * vê. Por isso este fica, a reencaminhar para o que ficou como bom.
 *
 * Quando os registos mostrarem que ninguém lhe bate à porta, apaga-se.
 */

export { POST } from "../simulator/chat/route";

export const runtime = "nodejs";
