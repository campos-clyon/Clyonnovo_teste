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
/*
 * 18-11-2026 (d8): «trabalho com carrinha» é como quem tem carrinha pesquisa, e
 * «Lisboa» dá a âncora local. A descrição diz as zonas onde mais queremos
 * parceiros (Lisboa, Loures e Sintra), sem dizer que já há parceiros nelas.
 */
export const TITULO_DO_RECRUTAMENTO = "Trabalho com carrinha: recolhas e mudanças em Lisboa";
export const DESCRICAO_DO_RECRUTAMENTO =
  "Pedidos de recolhas de móveis e mudanças em Lisboa, Loures e Sintra, com fotografias, zona e andar. Responder é grátis: sem mensalidade nem créditos.";

/*
 * AS ZONAS ONDE MAIS QUEREMOS PARCEIROS — 18-11-2026 (d8). O bloco vem logo a
 * seguir aos cartões do «porquê». Cada ligação leva o `?zona=` (d16): a página
 * diz «Há N pedidos na sua zona» quando a base o permite, e a zona fica gravada
 * na candidatura, para se medir que zona recruta. Sem números escritos à mão.
 */
export const ZONAS_DO_RECRUTAMENTO = {
  titulo: "Procuramos parceiros em Lisboa, Loures e na Linha de Sintra",
  texto:
    "É aqui que os clientes mais pedem recolhas de móveis, esvaziamentos e mudanças, e onde queremos ter mais parceiros a responder. Se trabalha a partir de Lisboa, de Loures ou de qualquer ponto da Linha de Sintra, os pedidos dessas zonas chegam-lhe com as fotografias, a zona e o andar. Indica o raio a partir da sua base e só lhe aparece o que cabe nele.",
  terras:
    "Lisboa (todas as freguesias), Loures, Odivelas, Amadora, Queluz, Agualva-Cacém, Rio de Mouro, Mem Martins e Sintra.",
  ligacoes: [
    { href: "/quero-ser-parceiro?zona=lisboa#candidatura", texto: "Candidatar-me a partir de Lisboa" },
    { href: "/quero-ser-parceiro?zona=loures#candidatura", texto: "Candidatar-me a partir de Loures" },
    { href: "/quero-ser-parceiro?zona=sintra#candidatura", texto: "Candidatar-me a partir de Sintra" },
  ],
} as const;

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
