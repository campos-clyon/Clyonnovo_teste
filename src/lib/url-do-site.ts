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
