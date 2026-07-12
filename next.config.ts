import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        // Avatar do Google OAuth
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        // Uploads para Vercel Blob
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
  },
  async redirects() {
    return [
      // Páginas de orçamento da recolha
      {
        source: "/recolha/orcamento",
        destination: "/orcamento-recolha-lisboa",
        permanent: true,
      },
      {
        source: "/recolha/orçamento",
        destination: "/orcamento-recolha-lisboa",
        permanent: true,
      },
      {
        source: "/recolha",
        destination: "/recolha-de-moveis",
        permanent: true,
      },
      // Redirect orçamento para simulador
      {
        source: "/orcamento",
        destination: "/simulador",
        permanent: true,
      },
      {
        source: "/orçamento",
        destination: "/simulador",
        permanent: true,
      },
      // URLs antigas deprecated
      {
        source: "/credito-fiscal",
        destination: "/servicos",
        permanent: true,
      },
      // mudanças com cedilha (ç) → redirect para mudancas sem cedilha
      {
        source: "/mudan%C3%A7as",
        destination: "/mudancas",
        permanent: true,
      },
      {
        source: "/mudan%C3%A7as-:city*",
        destination: "/mudancas",
        permanent: true,
      },
      {
        source: "/contato",
        destination: "/contactos",
        permanent: true,
      },
      {
        source: "/avaliacoes-clientes",
        destination: "/avaliacoes",
        permanent: true,
      },
      {
        source: "/central-ajuda",
        destination: "/faq",
        permanent: true,
      },
      {
        source: "/recolha-moveis-parque-das-nacoes",
        destination: "/recolha-moveis-lisboa",
        permanent: true,
      },
      // Redirects de mudanças-cidade → páginas dedicadas em /mudancas/cidade
      // (antes colapsavam todas em /mudancas — matava o SEO das long-tails)
      { source: "/mudancas-alcochete",        destination: "/mudancas/alcochete",        permanent: true },
      { source: "/mudancas-sintra",           destination: "/mudancas/sintra",           permanent: true },
      { source: "/mudancas-montijo",          destination: "/mudancas/montijo",          permanent: true },
      { source: "/mudancas-oeiras",           destination: "/mudancas/oeiras",           permanent: true },
      { source: "/mudancas-barreiro",         destination: "/mudancas/barreiro",         permanent: true },
      { source: "/mudancas-lisboa",           destination: "/mudancas/lisboa",           permanent: true },
      // Todas as cidades agora têm página dedicada
      { source: "/mudancas-carnaxide",        destination: "/mudancas/carnaxide",        permanent: true },
      { source: "/mudancas-corroios",         destination: "/mudancas/corroios",         permanent: true },
      { source: "/mudancas-palmela",          destination: "/mudancas/palmela",          permanent: true },
      { source: "/mudancas-odivelas",         destination: "/mudancas/odivelas",         permanent: true },
      { source: "/mudancas-lumiar",           destination: "/mudancas/lumiar",           permanent: true },
      { source: "/mudancas-sesimbra",         destination: "/mudancas/sesimbra",         permanent: true },
      { source: "/mudancas-costa-da-caparica",destination: "/mudancas/costa-da-caparica",permanent: true },
      // URLs 404 identificadas - redirecionar para páginas relevantes
      {
        source: "/recolha-de-moveis-usados",
        destination: "/recolha-de-moveis",
        permanent: true,
      },
      {
        source: "/recolha-moveis",
        destination: "/recolha-de-moveis",
        permanent: true,
      },
      {
        source: "/remocao-de-moveis",
        destination: "/recolha-de-moveis",
        permanent: true,
      },
      {
        source: "/retirada-de-moveis",
        destination: "/retirar-moveis-velhos",
        permanent: true,
      },
      {
        source: "/esvaziamento-apartamento",
        destination: "/esvaziamento-de-casas",
        permanent: true,
      },
      {
        source: "/esvaziar-casa",
        destination: "/esvaziamento-de-casas",
        permanent: true,
      },
      {
        source: "/limpeza-de-casa",
        destination: "/esvaziamento-de-casas",
        permanent: true,
      },
      {
        source: "/recolha-entulho",
        destination: "/recolha-de-entulho",
        permanent: true,
      },
      {
        source: "/entulho",
        destination: "/recolha-de-entulho",
        permanent: true,
      },
      {
        source: "/monos",
        destination: "/recolha-de-moveis",
        permanent: true,
      },
      {
        source: "/recolha-monos",
        destination: "/recolha-de-moveis",
        permanent: true,
      },
      // /recolha-de-monos tem página própria — não redirecionar
      // Serviço de limpeza pós-obra descontinuado — redirect para /servicos
      {
        source: "/limpeza-obra",
        destination: "/servicos",
        permanent: true,
      },
      {
        source: "/limpeza-pos-obra",
        destination: "/servicos",
        permanent: true,
      },
      {
        source: "/limpeza-pos-obra-:city*",
        destination: "/servicos",
        permanent: true,
      },
      // Serviço "camião com motorista" descontinuado — redirect para /mudancas
      {
        source: "/camiao-com-motorista",
        destination: "/mudancas",
        permanent: true,
      },
      {
        source: "/camiao-com-motorista-:city*",
        destination: "/mudancas",
        permanent: true,
      },
      {
        source: "/mudanca",
        destination: "/mudancas",
        permanent: true,
      },
      {
        source: "/mudancas-residenciais",
        destination: "/mudancas",
        permanent: true,
      },
      {
        source: "/empresa-mudancas",
        destination: "/mudancas",
        permanent: true,
      },
      {
        source: "/sofas",
        destination: "/recolha-de-sofas",
        permanent: true,
      },
      {
        source: "/recolha-sofa",
        destination: "/recolha-de-sofas",
        permanent: true,
      },
      {
        source: "/camas",
        destination: "/recolha-de-camas",
        permanent: true,
      },
      {
        source: "/armarios",
        destination: "/recolha-de-armarios",
        permanent: true,
      },
      {
        source: "/electrodomesticos",
        destination: "/recolha-de-eletrodomesticos",
        permanent: true,
      },
      {
        source: "/eletrodomesticos",
        destination: "/recolha-de-eletrodomesticos",
        permanent: true,
      },
      {
        source: "/sobre",
        destination: "/sobre-nos",
        permanent: true,
      },
      {
        source: "/quem-somos",
        destination: "/sobre-nos",
        permanent: true,
      },
      {
        source: "/contacto",
        destination: "/contactos",
        permanent: true,
      },
      {
        source: "/contact",
        destination: "/contactos",
        permanent: true,
      },
      {
        source: "/contacts",
        destination: "/contactos",
        permanent: true,
      },
      {
        source: "/preco",
        destination: "/precos",
        permanent: true,
      },
      {
        source: "/price",
        destination: "/precos",
        permanent: true,
      },
      {
        source: "/prices",
        destination: "/precos",
        permanent: true,
      },
      {
        source: "/tabela-precos",
        destination: "/precos",
        permanent: true,
      },
      {
        source: "/areas",
        destination: "/regioes",
        permanent: true,
      },
      {
        source: "/zonas",
        destination: "/regioes",
        permanent: true,
      },
      {
        source: "/cobertura",
        destination: "/regioes",
        permanent: true,
      },
      {
        source: "/servico",
        destination: "/servicos",
        permanent: true,
      },
      {
        source: "/services",
        destination: "/servicos",
        permanent: true,
      },
      {
        source: "/reviews",
        destination: "/avaliacoes",
        permanent: true,
      },
      {
        source: "/testimonials",
        destination: "/avaliacoes",
        permanent: true,
      },
      {
        source: "/gallery",
        destination: "/trabalhos",
        permanent: true,
      },
      {
        source: "/galeria",
        destination: "/trabalhos",
        permanent: true,
      },
      {
        source: "/portfolio",
        destination: "/trabalhos",
        permanent: true,
      },
    ];
  },
  async headers() {
    // Cabeçalhos de segurança aplicados a todas as rotas
    const securityHeaders = [
      { key: "X-Content-Type-Options",    value: "nosniff" },
      { key: "X-Frame-Options",           value: "SAMEORIGIN" },
      { key: "X-XSS-Protection",          value: "1; mode=block" },
      { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=(self)" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          // Scripts: self + Next.js inline + Google Analytics/Tag Manager
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
          // Estilos: self + inline (necessário para Tailwind/shadcn)
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          // Fontes
          "font-src 'self' https://fonts.gstatic.com",
          // Imagens: self + blobs Vercel + Google
          "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.public.blob.vercel-storage.com",
          // Ligações de rede: self + APIs externas
          "connect-src 'self' https://generativelanguage.googleapis.com https://api.resend.com https://*.upstash.io",
          // Frames: nenhum (embeds externos não usados)
          "frame-src 'none'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
    ];

    return [
      {
        // Aplicar cabeçalhos de segurança a todas as páginas e rotas
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/site.webmanifest",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
};

export default nextConfig;
