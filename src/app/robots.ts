import type { MetadataRoute } from "next";

/**
 * O que os motores de busca podem rastrear.
 *
 * ⚠️ Em robots.txt vence o grupo de user-agent MAIS ESPECÍFICO, e um robô só
 * lê esse. Havia aqui um grupo `Googlebot`/`Bingbot` com `Allow: /` e sem
 * nenhum `Disallow` — o Googlebot lia-o e ignorava por completo a lista do
 * grupo `*`. Na prática, todas as restrições abaixo não valiam para o Google.
 *
 * Era isso que punha /api/media/gallery/render/..., /_next/static/chunks/...,
 * /auth, /favicon.ico e /colaboradores/dashboard em "Rastreada — atualmente
 * não indexada": o Google gastava orçamento de rastreio nelas em vez das
 * páginas de serviço.
 *
 * Por isso há agora um grupo só. Um `Allow: /` sem restrições não acrescenta
 * nada — é o comportamento por omissão — mas cria esta armadilha.
 */

/**
 * Caminhos que nenhum motor de busca deve rastrear.
 *
 * ⚠️ Bloquear aqui NÃO desindexa. Uma página em `Disallow` nunca chega a ser
 * lida, por isso um `noindex` que ela traga no HTML nunca é visto — e o URL
 * pode continuar a aparecer nos resultados, sem descrição. Só entram nesta
 * lista caminhos que não são páginas ou que não devem sequer ser tocados.
 *
 * `/entrar` e `/conta` saíram daqui de propósito: são as duas únicas que o
 * menu liga em todas as páginas do site, logo o Google conhece-lhes o URL de
 * qualquer maneira. Ambas declaram `robots: { index: false }` na metadata e é
 * preciso deixá-lo ser lido para que saiam do índice de vez — bloqueadas aqui,
 * ficavam indexadas como URL sem descrição, para sempre. Continuam protegidas
 * por sessão, que é o mecanismo a sério; robots.txt nunca foi segurança.
 *
 * `/auth` fica bloqueado: são ecrãs de callback que nada no site liga, e
 * rastreá-los é só queimar orçamento.
 */
const PRIVADO = [
  // Endpoints e artefactos de build: não são páginas e não têm nada a indexar
  "/api/",
  "/_next/",
  // Backoffice
  "/admin",
  "/admin/",
  "/painel/",
  // Ecrãs de autenticação que nada liga publicamente
  "/auth",
  "/auth/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVADO,
      },
    ],
    sitemap: "https://clyon.pt/sitemap.xml",
    host: "https://clyon.pt",
  };
}
