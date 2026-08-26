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
  "/conta",
  // Ecrãs de autenticação
  "/auth",
  "/auth/",
  "/entrar",
  /*
   * AS ROTAS QUE LEVAM UM SEGREDO NO PRÓPRIO ENDEREÇO.
   *
   * São as mesmas seis que `endereco-sem-segredos.ts` já protege da medição:
   * o URL É a credencial. Quem o tiver abre o pedido, a proposta ou a
   * definição de senha sem mais nada.
   *
   * Não estavam aqui. Um link colado num fórum, num comentário ou numa página
   * pública bastava para o Googlebot lá ir — e um pedido de um cliente com a
   * morada e o telefone dentro passava a estar num índice público. Ainda não
   * aconteceu; o custo de esperar para ver é que é desproporcionado.
   *
   * Isto NÃO substitui os cabeçalhos noindex nem a expiração dos tokens: o
   * robots.txt pede, não impede. É a primeira das camadas, não a única.
   */
  "/pedido/",
  "/orcamento/",
  "/profissionais/pedidos/",
  "/profissionais/definir-senha/",
  "/profissionais/inscricao/",
  /*
   * Áreas de trabalho de quem está de dentro. O Google já andou a gastar
   * orçamento de rastreio em /colaboradores/dashboard e /colaboradores/
   * alterar-senha — páginas que nunca vão ser um resultado de pesquisa.
   */
  "/colaboradores",
  "/colaboradores/",
  "/plataforma",
  "/profissionais/painel",
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
