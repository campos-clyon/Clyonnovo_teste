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

/** Os endereços que entram no sitemap. Só aprovados, e só com slug. */
export async function slugsDosProfissionais(): Promise<string[]> {
  /*
   * TUDO dentro do try, e o `ensureProvidersSchema` é o que mais importa lá
   * estar: é ele que abre ligação à base, e foi ele que ficou de fora à
   * primeira tentativa. O sitemap passou a rebentar sem `DATABASE_URL` — que é
   * exactamente o caso que este `catch` existe para cobrir.
   */
  try {
    await ensureProvidersSchema();
    const pool = await getPool();
    if (!pool) return [];
    const [linhas] = (await pool.execute(
      `SELECT slug FROM providers
        WHERE estado = 'aprovado' AND isActive = 1 AND isClyon = 0
          AND slug IS NOT NULL AND slug <> ''
        ORDER BY slug`,
    )) as any[];
    return (linhas as Array<{ slug: string }>).map((l) => String(l.slug));
  } catch {
    /* O sitemap gera-se com o que houver. Uma base em baixo não o parte. */
    return [];
  }
}
