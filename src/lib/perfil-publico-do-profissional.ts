import { getPool, ensureProvidersSchema } from "@/lib/db";
import { cidadePublica, zonasPublicas } from "@/lib/localidade-publica";
import { instanteDaBase } from "@/lib/hora-de-lisboa";
import { servicosDasCategorias } from "@/lib/service-categories";
import { SQL_DA_EQUIPA, eDaEquipa } from "@/lib/origem-da-avaliacao";

/**
 * O perfil do profissional como o CLIENTE o vê — só o que é verdade.
 *
 * A homepage promete "vê o nome, a nota e os trabalhos do profissional antes
 * de aceitar", e até aqui o cliente via só o nome. Isto fecha a promessa —
 * mas fecha-a com dados REAIS: a nota é a média das avaliações que existem,
 * os trabalhos são os confirmados, e quando não há nada, o perfil di-lo por
 * extenso em vez de inventar. A decisão foi dele: "não vamos inventar,
 * apenas deixar o fluxo funcional".
 *
 * O QUE NUNCA SAI DAQUI
 *
 * Telefone, email, NIF, IBAN, morada. O perfil dá confiança, não dá o
 * contacto — esse abre só depois de contratar, pela mesma regra que protege
 * a morada do cliente do outro lado.
 */

export type AvaliacaoPublica = {
  estrelas: number;
  comentario: string | null;
  avaliadoEm: Date;
  servicoTipo: string | null;
  cidade: string | null;
  /** Registada pela CLYON a pedido do cliente (d6, 31-10-2026) — ver `origem-da-avaliacao.ts`. */
  registadaPelaClyon: boolean;
};

export type PerfilPublico = {
  nome: string;
  /** O endereço da página dele. Só existe depois de aprovado. */
  slug: string | null;
  /**
   * A base dele, para a página dizer de onde parte. Nunca a morada.
   *
   * A coluna `city` guarda a MORADA da base (é o que mede as distâncias), por
   * isso isto não é a coluna: é a terra conhecida que ela nomeia, ou nada.
   * Ver `localidade-publica.ts`.
   */
  cidade: string | null;
  naClyonDesde: Date | null;
  categorias: string[];
  raioKm: number | null;
  emiteFatura: boolean;
  guiaVerificada: boolean;
  trabalhosConcluidos: number;
  notaMedia: number | null;
  quantasAvaliacoes: number;
  /**
   * SÓ AS DOS CLIENTES (d6, 31-10-2026): a média e quantas, sem as registadas
   * pela CLYON a pedido do cliente. São estas as estrelas dos dados
   * estruturados (o Google quer só as dos clientes).
   */
  notaDosClientes: number | null;
  avaliacoesDosClientes: number;
  avaliacoes: AvaliacaoPublica[];
  /**
   * QUANDO É QUE ELE ESTEVE CÁ PELA ÚLTIMA VEZ.
   *
   * «Online nas últimas 48h» é das linhas mais rentáveis da app da Fixando, e
   * não por vaidade: transforma uma lista de nomes numa lista de pessoas
   * DISPONÍVEIS. Para o cliente que está a escolher entre três propostas, é o
   * desempate — e a coluna `ultimoAcesso` já estava gravada há meses sem
   * ninguém a mostrar.
   *
   * Vai em dias e não em data: a data exacta da última visita de alguém é
   * informação sobre a vida dele, e o que o cliente precisa de saber é só se
   * está por perto.
   */
  diasDesdeOUltimoAcesso: number | null;
};

function lista(v: unknown): string[] {
  if (typeof v !== "string" || !v) return [];
  try {
    const l = JSON.parse(v);
    return Array.isArray(l) ? l.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * UMA CONTA DE TESTE NÃO É UM PROFISSIONAL.
 *
 * Havia uma no Google: «Fred Teste», aprovada para se experimentar o fluxo,
 * com página própria, entrada no sitemap e cartão nas páginas de cidade — e
 * com a morada de quem a criou. Um cliente que a encontrasse via um
 * profissional que não existe.
 *
 * Quando isto se escreveu, a tabela não tinha coluna que as marcasse; o que
 * as distinguia era o nome: «teste» ou «test» como palavra inteira.
 * «Testemunho» ou «Contest» não são. Fica de fora das listas públicas e a
 * página responde 404; a conta continua a funcionar para o que foi criada.
 *
 * DESDE 28-10-2026 (d9), TAMBÉM PELA MARCA. A coluna `contaDeTeste` existe
 * desde 01-10 (marca-se no backoffice), e uma conta marcada com um nome que
 * não diga «teste» aparecia na mesma. As consultas da página e da lista (o
 * sitemap e os blocos das cidades) pedem `COALESCE(contaDeTeste, 0) = 0`; o
 * nome continua a valer, para as que ninguém marcou.
 */
export function eContaDeTeste(nome: string | null | undefined): boolean {
  return typeof nome === "string" && /\bteste?\b/i.test(nome);
}

export async function perfilPublicoDoProfissional(
  providerId: number,
): Promise<PerfilPublico | null> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) return null;

  const [pLinhas] = (await pool.execute(
    `SELECT name, slug, city, createdAt, categorias, zonas, raioKm, emiteFatura,
            guiaVerificadaEm, ultimoAcesso
       FROM providers WHERE id = ? AND (estado IS NULL OR estado <> 'apagado') LIMIT 1`,
    [providerId],
  )) as any[];
  const p = (pLinhas as Array<Record<string, unknown>>)[0];
  if (!p) return null;

  /*
   * Sem passar pelos pedidos: os pedidos expiram aos 60 dias e as
   * negociações ficam — um trabalho confirmado em Junho continua a contar
   * para o perfil em Setembro, mesmo com o pedido já expurgado.
   */
  const [nLinhas] = (await pool.execute(
    `SELECT COUNT(*) AS concluidos,
            AVG(CASE WHEN n.estrelas IS NOT NULL THEN n.estrelas END) AS media,
            SUM(CASE WHEN n.estrelas IS NOT NULL THEN 1 ELSE 0 END) AS avaliados,
            AVG(CASE WHEN n.estrelas IS NOT NULL AND NOT ${SQL_DA_EQUIPA()} THEN n.estrelas END) AS mediaDosClientes,
            SUM(CASE WHEN n.estrelas IS NOT NULL AND NOT ${SQL_DA_EQUIPA()} THEN 1 ELSE 0 END) AS dosClientes
       FROM negociacoes n
      WHERE n.providerId = ? AND n.estado = 'acordada' AND n.confirmadoEm IS NOT NULL`,
    [providerId],
  )) as any[];
  const stats = (
    nLinhas as Array<{ concluidos: number; media: string | null; avaliados: number; mediaDosClientes: string | null; dosClientes: number | null }>
  )[0];

  const [aLinhas] = (await pool.execute(
    // O serviço e a cidade vêm do pedido QUANDO ele ainda existe; a avaliação
    // sobrevive-lhe (LEFT JOIN) e mostra-se sem esse contexto.
    `SELECT n.estrelas, n.comentario, n.avaliadoEm, o.serviceType, o.city, ${SQL_DA_EQUIPA()} AS daEquipa
       FROM negociacoes n
       LEFT JOIN simulatorOrders o ON o.id = n.pedidoId
      WHERE n.providerId = ? AND n.estrelas IS NOT NULL
      ORDER BY n.avaliadoEm DESC
      LIMIT 10`,
    [providerId],
  )) as any[];

  const visto = p.ultimoAcesso ? new Date(p.ultimoAcesso as string) : null;
  const diasDesdeOUltimoAcesso =
    visto && !Number.isNaN(visto.getTime())
      ? Math.max(0, Math.floor((Date.now() - visto.getTime()) / 86_400_000))
      : null;

  const zonas = lista(p.zonas);

  return {
    nome: String(p.name ?? ""),
    slug: typeof p.slug === "string" && p.slug ? p.slug : null,
    // A terra, e nunca o texto da coluna — que é a morada da base.
    cidade: cidadePublica(typeof p.city === "string" ? p.city : null, zonas),
    naClyonDesde: (p.createdAt as Date | null) ?? null,
    // Os serviços dos grupos dele (29-10-2026): as páginas públicas falam de serviços.
    categorias: servicosDasCategorias(lista(p.categorias)),
    raioKm: p.raioKm == null ? null : Number(p.raioKm),
    emiteFatura: Number(p.emiteFatura) === 1,
    guiaVerificada: p.guiaVerificadaEm != null,
    trabalhosConcluidos: Number(stats?.concluidos ?? 0),
    notaMedia: stats?.media != null ? Math.round(Number(stats.media) * 10) / 10 : null,
    quantasAvaliacoes: Number(stats?.avaliados ?? 0),
    notaDosClientes: stats?.mediaDosClientes != null ? Math.round(Number(stats.mediaDosClientes) * 10) / 10 : null,
    avaliacoesDosClientes: Number(stats?.dosClientes ?? 0),
    avaliacoes: (aLinhas as Array<Record<string, unknown>>).map((a) => ({
      estrelas: Number(a.estrelas),
      comentario: typeof a.comentario === "string" && a.comentario.trim() ? a.comentario : null,
      avaliadoEm: a.avaliadoEm as Date,
      servicoTipo: (a.serviceType as string | null) ?? null,
      // A coluna do pedido é o que o cliente escreveu (pode ser a morada ou o
      // código postal): na página pública só sai a terra, se a conhecermos.
      cidade: cidadePublica(typeof a.city === "string" ? a.city : null),
      registadaPelaClyon: eDaEquipa(a.daEquipa),
    })),
    diasDesdeOUltimoAcesso,
  };
}

/**
 * O MESMO PERFIL, PELO ENDEREÇO PÚBLICO.
 *
 * A página `/profissionais/[slug]` é a primeira coisa que a CLYON põe no
 * Google que não é escrita por nós: escreve-se sozinha à medida que ele
 * trabalha, e é o único conteúdo do site que nenhum concorrente pode copiar.
 *
 * SÓ OS APROVADOS. Um profissional pendente ou suspenso não tem página — e
 * não é uma questão de estética: uma página indexada de alguém que a CLYON
 * ainda não verificou é a plataforma a emprestar-lhe credibilidade que não lhe
 * deu.
 */
export async function perfilPublicoPorSlug(slug: string): Promise<PerfilPublico | null> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) return null;

  const [linhas] = (await pool.execute(
    `SELECT id, name FROM providers
      WHERE slug = ? AND estado = 'aprovado' AND isActive = 1 AND isClyon = 0
        AND COALESCE(contaDeTeste, 0) = 0
      LIMIT 1`,
    [slug],
  )) as any[];
  const linha = (linhas as Array<{ id: number; name: string | null }>)[0];
  // Uma conta de teste não tem página: 404, como um slug que não existe.
  if (!linha?.id || eContaDeTeste(linha.name)) return null;
  return perfilPublicoDoProfissional(Number(linha.id));
}

/**
 * UM PROFISSIONAL COMO ELE APARECE NUMA LISTA — o cartão, não a página.
 *
 * A página dele faz três consultas à base (perfil, contagens, avaliações).
 * Uma lista de vinte não pode fazer sessenta: isto traz numa só o que um
 * cartão precisa de mostrar, e nada mais.
 */
export type ProfissionalNaLista = {
  slug: string;
  nome: string;
  cidade: string | null;
  zonas: string[];
  categorias: string[];
  notaMedia: number | null;
  quantasAvaliacoes: number;
  trabalhosConcluidos: number;
  /**
   * A última vez que a página dele mudou: o perfil editado, ou um trabalho
   * novo confirmado (que mexe na contagem e nas avaliações). Para o sitemap.
   */
  ultimaMudanca?: Date | null;
};

/**
 * TEM ALGUMA COISA PARA MOSTRAR?
 *
 * A regra é uma só, e vale nos três sítios: no sitemap, no `noindex` da
 * própria página, e na ordem da lista. Um perfil sem uma avaliação e sem um
 * trabalho concluído é um nome e pouco mais — e uma página assim não é
 * indexada por mais que se peça. Pedi-lo ao Google é gastar crédito nosso
 * para ele nos dizer que não.
 *
 * A página CONTINUA A EXISTIR e a responder 200: o cliente que recebeu uma
 * proposta chega lá pelo link e vê com quem vai lidar. O que ela não faz é
 * pedir para ser indexada antes de ter o que dizer. No dia em que ele fechar
 * o primeiro trabalho, passa a pedir — sozinha.
 */
export function temAlgoParaMostrar(p: {
  quantasAvaliacoes: number;
  trabalhosConcluidos: number;
}): boolean {
  return p.quantasAvaliacoes > 0 || p.trabalhosConcluidos > 0;
}

/**
 * TODOS OS QUE TÊM PÁGINA, numa consulta só.
 *
 * Ordena-se por quem tem mais para mostrar: avaliações primeiro, trabalhos a
 * seguir, e o nome a desempatar para a ordem não dançar entre dois pedidos
 * iguais — uma lista que muda de ordem sozinha lê-se como aleatória, e o
 * Google vê uma página diferente em cada rastreio.
 *
 * SE A BASE ESTIVER EM BAIXO devolve uma lista vazia em vez de rebentar. Quem
 * chama isto são páginas públicas e o sitemap: um bloco a menos é um problema
 * pequeno, uma página a 500 não é.
 */
/*
 * A MESMA LISTA, UMA VEZ SÓ POR MINUTO.
 *
 * Este bloco vai ao fim de cada página de cidade, e são cento e cinquenta
 * páginas geradas no build. Sem isto era uma consulta igual por cada uma —
 * cento e cinquenta viagens à base para trazer as mesmas dez linhas, e um
 * build a abrir ligações em paralelo é onde uma pool se esgota.
 *
 * Um minuto: em produção cada instância guarda a lista esse tempo. É uma
 * lista pública de nomes e notas, e ninguém repara que um profissional novo
 * aparece sessenta segundos depois — as próprias páginas só revalidam de hora
 * a hora ou de dia a dia.
 */
let emCache: { quando: number; lista: ProfissionalNaLista[] } | null = null;
const VALIDADE_DA_LISTA = 60_000;

export async function profissionaisComPagina(): Promise<ProfissionalNaLista[]> {
  if (emCache && Date.now() - emCache.quando < VALIDADE_DA_LISTA) return emCache.lista;
  try {
    await ensureProvidersSchema();
    const pool = await getPool();
    if (!pool) return [];
    const [linhas] = (await pool.execute(
      `SELECT p.slug, p.name, p.city, p.zonas, p.categorias,
              COUNT(n.id) AS concluidos,
              AVG(CASE WHEN n.estrelas IS NOT NULL THEN n.estrelas END) AS media,
              SUM(CASE WHEN n.estrelas IS NOT NULL THEN 1 ELSE 0 END) AS avaliados,
              GREATEST(p.updatedAt, COALESCE(MAX(n.confirmadoEm), p.updatedAt)) AS ultimaMudanca
         FROM providers p
         LEFT JOIN negociacoes n
           ON n.providerId = p.id
          AND n.estado = 'acordada'
          AND n.confirmadoEm IS NOT NULL
        WHERE p.estado = 'aprovado' AND p.isActive = 1 AND p.isClyon = 0
          AND COALESCE(p.contaDeTeste, 0) = 0
          AND p.slug IS NOT NULL AND p.slug <> ''
        GROUP BY p.id, p.slug, p.name, p.city, p.zonas, p.categorias, p.updatedAt
        ORDER BY avaliados DESC, concluidos DESC, p.name ASC`,
    )) as any[];
    const saida = (linhas as Array<Record<string, unknown>>)
      // As contas de teste ficam de fora de tudo o que sai daqui: sitemap,
      // blocos das páginas de cidade, avaliações, trabalhos.
      .filter((l) => !eContaDeTeste(typeof l.name === "string" ? l.name : null))
      .map((l) => {
        const zonas = lista(l.zonas);
        return {
          slug: String(l.slug),
          nome: String(l.name ?? ""),
          // A terra, e nunca a morada da base — ver `localidade-publica.ts`.
          cidade: cidadePublica(typeof l.city === "string" ? l.city : null, zonas),
          zonas: zonasPublicas(zonas),
          categorias: servicosDasCategorias(lista(l.categorias)),
          notaMedia: l.media != null ? Math.round(Number(l.media) * 10) / 10 : null,
          quantasAvaliacoes: Number(l.avaliados ?? 0),
          trabalhosConcluidos: Number(l.concluidos ?? 0),
          ultimaMudanca: instanteDaBase(l.ultimaMudanca as string | Date | null),
        };
      });
    emCache = { quando: Date.now(), lista: saida };
    return saida;
  } catch {
    /*
     * A FALHA NÃO SE GUARDA. Guardar uma lista vazia por um minuto era
     * transformar um soluço da base em sessenta segundos de páginas sem
     * bloco — e, num build, em cento e cinquenta páginas sem ele.
     */
    return [];
  }
}

/**
 * Os endereços que entram no sitemap.
 *
 * SÓ OS QUE TÊM ALGUMA COISA PARA MOSTRAR — ver `temAlgoParaMostrar`.
 * Declarávamos todos os aprovados, e o Google respondia com «Detectada, mas
 * não indexada» em dezasseis deles. Um sitemap onde metade dos endereços é
 * recusada ensina-o a desconfiar do sitemap todo, incluindo das páginas de
 * serviço que nos interessam mesmo.
 */
export async function slugsDosProfissionais(): Promise<string[]> {
  return (await profissionaisComPagina()).filter(temAlgoParaMostrar).map((p) => p.slug);
}

/**
 * Os mesmos, com a data da última mudança — para o `lastmod` do sitemap, que
 * dizia a hora do pedido em todos (14-10-2026): um perfil parado há um mês
 * aparecia ao Google como mudado agora, em cada leitura.
 */
export async function profissionaisParaOSitemap(): Promise<Array<{ slug: string; ultimaMudanca: Date | null }>> {
  return (await profissionaisComPagina())
    .filter(temAlgoParaMostrar)
    .map((p) => ({ slug: p.slug, ultimaMudanca: p.ultimaMudanca ?? null }));
}
