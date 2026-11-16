import { reviews, type Review } from "./reviews-data";

/**
 * OS TESTEMUNHOS DA PÁGINA INICIAL — d51, 16-11-2026.
 *
 * Os testemunhos são as palavras dos clientes, e em `reviews-data.ts` ficam
 * como foram escritos. Mas a inicial é a montra: um testemunho que diz «vieram
 * no mesmo dia» lê-se ali como uma promessa da plataforma, e a CLYON não a faz
 * (o dia combina-se com o parceiro). Na inicial não entra nenhum que fale do
 * mesmo dia ou do próprio dia; a página das avaliações continua a tê-los todos.
 */
export const FALA_DO_MESMO_DIA = /(?<!\p{L})(no |o )?(mesmo|pr[óo]prio) dia(?!\p{L})/iu;

export const TESTEMUNHOS_DA_INICIAL: readonly Review[] = reviews.filter((r) => !FALA_DO_MESMO_DIA.test(r.text));
