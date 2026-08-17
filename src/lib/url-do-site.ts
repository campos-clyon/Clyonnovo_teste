import { SITE_URL } from "./seo-data";

/**
 * O endereço a usar nos links que alguém vai clicar.
 *
 * Existe separado do `SITE_URL` de propósito, e a distinção importa:
 *
 *   · o **`SITE_URL`** é a identidade do site. Vai nos canónicos, no sitemap e
 *     nos dados estruturados, e deve dizer `clyon.pt` sempre — mesmo num
 *     deploy de pré-visualização. Um canónico a apontar para o host temporário
 *     do Vercel é um convite ao Google para indexar o preview;
 *
 *   · isto é o sítio **onde a pessoa está agora**. Um email enviado a partir
 *     de um preview tem de trazer o link desse preview, senão manda a pessoa
 *     para produção, onde o pedido que ela acabou de criar não existe.
 *
 * Foi exactamente isso que aconteceu: os emails do pedido e da notificação ao
 * profissional apontavam para `clyon.pt` a partir de qualquer ambiente, o que
 * tornava impossível testar o fluxo sem publicar em produção primeiro.
 */
/**
 * O endereço a partir do pedido HTTP que está a decorrer.
 *
 * É a fonte mais fiável de todas, e por isso a primeira a tentar: o email é
 * gerado durante um pedido feito ao próprio deployment, e os cabeçalhos dizem
 * exactamente em que endereço a pessoa está.
 *
 * As variáveis `VERCEL_URL` e `VERCEL_BRANCH_URL` são variáveis de SISTEMA e só
 * existem se o projecto tiver ligada a opção que as expõe. Neste não tinha — e
 * o resultado foi um link de preview a apontar para clyon.pt, onde o pedido
 * acabado de criar não existe. Isto deixa de depender dessa definição.
 */
export function urlDeAccaoDoPedido(cabecalhos: Headers): string {
  // Um NEXT_PUBLIC_SITE_URL explícito continua a mandar: quem o define está a
  // dizer de propósito qual é o endereço público.
  const explicito = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicito) return explicito.replace(/\/+$/, "");

  const anfitriao =
    cabecalhos.get("x-forwarded-host")?.trim() || cabecalhos.get("host")?.trim();

  if (anfitriao) {
    // Confia-se no cabeçalho porque estas rotas correm atrás do proxy da Vercel,
    // que o reescreve. Fora daí um Host forjado só afectaria o link enviado a
    // quem fez o pedido — e nunca um destino externo, porque o caminho é sempre
    // nosso.
    const protocolo =
      cabecalhos.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      (anfitriao.startsWith("localhost") || anfitriao.startsWith("127.") ? "http" : "https");
    return `${protocolo}://${anfitriao.replace(/\/+$/, "")}`;
  }

  return urlDeAccao();
}

export function urlDeAccao(): string {
  // Escotilha manual, para quando nada disto adivinha bem.
  const explicito = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicito) return explicito.replace(/\/+$/, "");

  // Vercel: `VERCEL_ENV` é "production", "preview" ou "development".
  //
  // Preferimos o `VERCEL_BRANCH_URL` ao `VERCEL_URL`, e a diferença conta num
  // email: o `VERCEL_URL` é o host daquele deployment em concreto e muda a cada
  // publicação, portanto um link enviado hoje aponta para o código de hoje e
  // não para o do ramo. O `VERCEL_BRANCH_URL` é estável por ramo — o link
  // continua a abrir a versão mais recente depois de publicar outra vez.
  const ambiente = process.env.VERCEL_ENV;
  if (ambiente && ambiente !== "production") {
    const host = process.env.VERCEL_BRANCH_URL?.trim() || process.env.VERCEL_URL?.trim();
    if (host) return `https://${host.replace(/\/+$/, "")}`;
  }

  // Fora do Vercel e fora de produção: a máquina de quem está a desenvolver.
  if (!ambiente && process.env.NODE_ENV !== "production") {
    const porta = process.env.PORT?.trim() || "3000";
    return `http://localhost:${porta}`;
  }

  return SITE_URL;
}
