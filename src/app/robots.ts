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
 * O QUE TEM DE FICAR ABERTO, mesmo estando dentro de uma pasta fechada.
 *
 * O Search Console reportou-o a 19-09-2026, em «Bloqueada pelo robots.txt»:
 * um ficheiro `/_next/static/css/….css`. Não é um descuido do Google — é o
 * `Disallow: /_next/` aqui de baixo a apanhar o CSS e o JavaScript de que a
 * página precisa para se desenhar.
 *
 * E isso não é uma página a menos no índice: é o Googlebot a RENDERIZAR o
 * site sem folha de estilos e sem os chunks do Next. O que ele avalia deixa
 * de ser a página que as pessoas vêem — o texto desalinhado, o conteúdo que
 * só aparece depois da hidratação em lado nenhum, e a versão para telemóvel
 * impossível de julgar. Num site inteiro feito em Next, é o rastreio todo
 * que fica a ver outra coisa.
 *
 * A Google escreve-o por palavras dela: «não bloqueie ficheiros CSS ou
 * JavaScript de que a página precisa». A intenção do `Disallow` continua
 * certa para o resto de `/_next/` — `/_next/image?url=…` e `/_next/data/…`
 * não são páginas e não têm nada a indexar. Só os estáticos é que são peças
 * da página e têm de estar ao alcance dele.
 *
 * Porque é que isto chega para o desbloquear: no robots.txt manda a regra
 * MAIS LONGA que casa com o endereço, e não a ordem das linhas.
 * `/_next/static/` tem catorze caracteres contra os sete de `/_next/` —
 * ganha sempre, e nos dois motores.
 */
const ABERTO = ["/", "/_next/static/"];

/** Caminhos que nenhum motor de busca deve rastrear. */
const PRIVADO = [
  // Endpoints e artefactos de build: não são páginas e não têm nada a indexar
  "/api/",
  // ⚠️ Não alargue esta linha: /_next/static/ está aberto de propósito, acima.
  "/_next/",
  // Backoffice e áreas autenticadas
  "/admin",
  "/admin/",
  "/painel/",
  /*
   * ⚠️ `/conta` À SECA BLOQUEAVA `/contactos`.
   *
   * Em robots.txt um `Disallow` é um PREFIXO, não um caminho: `/conta` casa
   * com tudo o que comece por essas seis letras — `/contactos`, `/contacto`,
   * `/contactos/seja-o-que-for`. A página de contactos do site estava
   * bloqueada ao Google desde sempre, e o Search Console dizia-o em «Indexada,
   * mas bloqueada pelo robots.txt», com a validação a falhar a 15-09-2026.
   *
   * Uma página de contactos bloqueada é das piores para um negócio local: é
   * ela que carrega a morada, o telefone e o horário, e é dela que o Google
   * tira metade do que sabe sobre uma empresa com sede física.
   *
   * `$` ancora no fim — `/conta` exactamente — e a linha seguinte apanha tudo
   * o que está lá dentro. As duas juntas dizem o que `/conta` queria dizer.
   */
  "/conta$",
  "/conta/",
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
        allow: ABERTO,
        disallow: PRIVADO,
      },
    ],
    sitemap: "https://clyon.pt/sitemap.xml",
    host: "https://clyon.pt",
  };
}
