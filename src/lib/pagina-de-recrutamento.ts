/*
 * /QUERO-SER-PARCEIRO — o que a página diz de si mesma ao Google, e a
 * fotografia do primeiro ecrã. 31-10-2026 (d6 de 28-10, aprovada pelo dono e
 * pelo CEO). Ficam aqui, e não no page.tsx, porque o Next.js só aceita da
 * página as exportações dele, e o teste precisa de os ler.
 */

/*
 * O TÍTULO E A DESCRIÇÃO PARA QUEM PROCURA TRABALHO. Diziam «Trabalhar com a
 * CLYON — receba pedidos na sua zona», e quase ninguém os via nem carregava.
 * Agora falam como quem tem carrinha pesquisa, e dizem logo as três coisas:
 * há pedidos, vêm com fotografias, e responder não custa nada. A morada
 * exacta não: antes de fechar, o profissional vê a zona e o andar
 * (`vistaDoProfissional`). Para o Marketing rever. Título ≤ 60 com
 * « | CLYON», descrição ≤ 155 (o teste da página guarda).
 */
export const TITULO_DO_RECRUTAMENTO = "Tem carrinha? Receba pedidos de recolhas e mudanças";
export const DESCRICAO_DO_RECRUTAMENTO =
  "Pedidos de recolhas e mudanças de Lisboa a Setúbal, com fotografias, zona e andar. Responder é grátis: sem mensalidade nem créditos. Taxa só ao fechar.";

/*
 * A FOTOGRAFIA DE UM PARCEIRO A TRABALHAR.
 *
 * Tem de ser REAL: um profissional da plataforma a carregar a carrinha, com o
 * ok dele para a usarmos. No repositório não há nenhuma — as imagens do herói
 * da página inicial são geradas, e as de `public/images/` são capturas de
 * conversas e de perfis. O lugar fica pronto: põe-se o ficheiro em `public/`
 * e o caminho aqui, e a fotografia aparece no primeiro ecrã, por baixo dos
 * botões. Sem ela, a página não desenha caixa nenhuma (nada de vazios).
 */
export type FotografiaReal = { src: string; alt: string; largura: number; altura: number };
export const FOTOGRAFIA_DE_UM_PARCEIRO = null as FotografiaReal | null;

/** As imagens que NÃO são fotografias reais — não servem para aqui. */
export const IMAGENS_QUE_NAO_SAO_REAIS: readonly string[] = [
  "/hero-clyon-carrinha-lisboa.jpg",
  "/hero-team-truck-lisbon.jpg",
  "/hero-recolha-moveis.jpg",
  "/hero-entulho-bg.jpg",
  "/truck-bg.webp",
  "/og-image.jpg",
];
