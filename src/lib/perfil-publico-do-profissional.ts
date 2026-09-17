import { getPool, ensureProvidersSchema } from "@/lib/db";

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
};

export type PerfilPublico = {
  nome: string;
  /** O endereço da página dele. Só existe depois de aprovado. */
  slug: string | null;
  /** A base dele, para a página dizer de onde parte. Nunca a morada. */
  cidade: string | null;
  naClyonDesde: Date | null;
  categorias: string[];
  zonas: string[];
  raioKm: number | null;
  emiteFatura: boolean;
  guiaVerificada: boolean;
  trabalhosConcluidos: number;
  notaMedia: number | null;
  quantasAvaliacoes: number;
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
            AVG(CASE WHEN estrelas IS NOT NULL THEN estrelas END) AS media,
            SUM(CASE WHEN estrelas IS NOT NULL THEN 1 ELSE 0 END) AS avaliados
       FROM negociacoes
      WHERE providerId = ? AND estado = 'acordada' AND confirmadoEm IS NOT NULL`,
    [providerId],
  )) as any[];
  const stats = (nLinhas as Array<{ concluidos: number; media: string | null; avaliados: number }>)[0];

  const [aLinhas] = (await pool.execute(
    // O serviço e a cidade vêm do pedido QUANDO ele ainda existe; a avaliação
    // sobrevive-lhe (LEFT JOIN) e mostra-se sem esse contexto.
    `SELECT n.estrelas, n.comentario, n.avaliadoEm, o.serviceType, o.city
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

  return {
    nome: String(p.name ?? ""),
    slug: typeof p.slug === "string" && p.slug ? p.slug : null,
    cidade: typeof p.city === "string" && p.city ? p.city : null,
    naClyonDesde: (p.createdAt as Date | null) ?? null,
    categorias: lista(p.categorias),
    zonas: lista(p.zonas),
    raioKm: p.raioKm == null ? null : Number(p.raioKm),
    emiteFatura: Number(p.emiteFatura) === 1,
    guiaVerificada: p.guiaVerificadaEm != null,
    trabalhosConcluidos: Number(stats?.concluidos ?? 0),
    notaMedia: stats?.media != null ? Math.round(Number(stats.media) * 10) / 10 : null,
    quantasAvaliacoes: Number(stats?.avaliados ?? 0),
    avaliacoes: (aLinhas as Array<Record<string, unknown>>).map((a) => ({
      estrelas: Number(a.estrelas),
      comentario: typeof a.comentario === "string" && a.comentario.trim() ? a.comentario : null,
      avaliadoEm: a.avaliadoEm as Date,
      servicoTipo: (a.serviceType as string | null) ?? null,
      cidade: (a.city as string | null) ?? null,
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
    `SELECT id FROM providers
      WHERE slug = ? AND estado = 'aprovado' AND isActive = 1 AND isClyon = 0
      LIMIT 1`,
    [slug],
  )) as any[];
  const id = (linhas as Array<{ id: number }>)[0]?.id;
  if (!id) return null;
  return perfilPublicoDoProfissional(Number(id));
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
              SUM(CASE WHEN n.estrelas IS NOT NULL THEN 1 ELSE 0 END) AS avaliados
         FROM providers p
         LEFT JOIN negociacoes n
           ON n.providerId = p.id
          AND n.estado = 'acordada'
          AND n.confirmadoEm IS NOT NULL
        WHERE p.estado = 'aprovado' AND p.isActive = 1 AND p.isClyon = 0
          AND p.slug IS NOT NULL AND p.slug <> ''
        GROUP BY p.id, p.slug, p.name, p.city, p.zonas, p.categorias
        ORDER BY avaliados DESC, concluidos DESC, p.name ASC`,
    )) as any[];
    const saida = (linhas as Array<Record<string, unknown>>).map((l) => ({
      slug: String(l.slug),
      nome: String(l.name ?? ""),
      cidade: typeof l.city === "string" && l.city ? l.city : null,
      zonas: lista(l.zonas),
      categorias: lista(l.categorias),
      notaMedia: l.media != null ? Math.round(Number(l.media) * 10) / 10 : null,
      quantasAvaliacoes: Number(l.avaliados ?? 0),
      trabalhosConcluidos: Number(l.concluidos ?? 0),
    }));
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
