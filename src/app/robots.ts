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

/** Caminhos que nenhum motor de busca deve rastrear. */
const PRIVADO = [
  // Endpoints e artefactos de build: não são páginas e não têm nada a indexar
  "/api/",
  "/_next/",
  // Backoffice e áreas autenticadas
  "/admin",
  "/admin/",
  "/painel/",
  "/parceiros/",
  "/conta",
  // Ecrãs de autenticação
  "/auth",
  "/auth/",
  "/entrar",
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
