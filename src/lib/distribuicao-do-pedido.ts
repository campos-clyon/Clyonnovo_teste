import {
  getPool,
  ensureProvidersSchema,
  negociacoesDoPedido,
  getSimulatorOrderById,
  type ProfissionalNaBase,
} from "@/lib/db";
import { avaliarElegibilidade } from "@/lib/profissional-elegivel";
import { distanciaParaElegibilidade } from "@/lib/distancia-entre-pontos";

/**
 * A quem este pedido chegou — e a quem não chegou, com o porquê.
 *
 * PORQUE É QUE ISTO EXISTE
 *
 * O painel listava as negociações debaixo de cada pedido, uma linha por
 * profissional, sempre abertas. Com quatro ainda se lia; com mil seria uma
 * parede. A lista saiu do cartão, e esta função é o que a substitui: quem
 * quer saber abre o pedido e vê os dois lados — quem recebeu, e quem ficou
 * de fora com o motivo por extenso.
 *
 * PORQUE É QUE NÃO USA `profissionaisActivos`
 *
 * Essa função filtra `isActive = 1 AND estado = 'aprovado'` à entrada — os
 * suspensos nunca chegam a ser avaliados, e "conta suspensa" é precisamente
 * um dos motivos que se quer ver aqui. Vão todos menos os apagados, e a
 * avaliação diz de cada um o que o excluiu.
 */

const ROTULO_DO_MOTIVO: Record<string, string> = {
  inactivo: "conta desactivada",
  nao_aprovado: "conta suspensa ou por aprovar",
  categoria_diferente: "não faz este tipo de serviço",
  fora_de_alcance: "fora do raio dele",
  sem_morada: "não foi possível localizar a morada do pedido",
  nao_emite_fatura: "não emite fatura (o cliente pediu)",
  nao_emite_guia: "sem guia de transporte verificada",
};

export type LinhaDaDistribuicao = {
  providerId: number;
  nome: string;
  /** null = não recebeu. */
  negociacao: { id: number; estado: string; valorAcordado: number | null } | null;
  /** Vazio quando recebeu, ou quando é elegível e só não estava cá no envio. */
  motivos: string[];
  distanciaKm: number | null;
};

export async function distribuicaoDoPedido(pedidoId: number): Promise<{
  receberam: LinhaDaDistribuicao[];
  naoReceberam: LinhaDaDistribuicao[];
} | null> {
  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return null;

  let raw: Record<string, unknown> = {};
  try {
    raw = pedido.rawOrderJson ? JSON.parse(pedido.rawOrderJson) : {};
  } catch {
    /* JSON estragado — avalia-se sem coordenadas */
  }
  const morada = (raw.address ?? {}) as Record<string, unknown>;
  const trabalho =
    typeof morada.lat === "number" && typeof morada.lng === "number"
      ? { lat: morada.lat, lng: morada.lng }
      : null;

  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) return null;

  const [rows] = (await pool.execute(
    `SELECT id, name, email, isActive, estado, categorias, zonas, raioKm,
            emiteFatura, emiteGuiaTransporte, guiaVerificadaEm, baseLat, baseLng
       FROM providers
      WHERE isClyon = 0 AND (estado IS NULL OR estado <> 'apagado')`,
  )) as any[];

  const listaDeJson = (v: unknown): string[] => {
    if (typeof v !== "string" || !v) return [];
    try {
      const l = JSON.parse(v);
      return Array.isArray(l) ? l.map(String) : [];
    } catch {
      return [];
    }
  };

  const pros: ProfissionalNaBase[] = (rows as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ""),
    email: (r.email as string) ?? null,
    isActive: Number(r.isActive) === 1,
    estado: (r.estado as string) ?? null,
    categorias: listaDeJson(r.categorias),
    zonas: listaDeJson(r.zonas),
    raioKm: r.raioKm == null ? null : Number(r.raioKm),
    emiteFatura: Number(r.emiteFatura) === 1,
    emiteGuiaTransporte: Number(r.emiteGuiaTransporte) === 1,
    guiaVerificadaEm: (r.guiaVerificadaEm as Date | null) ?? null,
    baseLat: r.baseLat == null ? null : Number(r.baseLat),
    baseLng: r.baseLng == null ? null : Number(r.baseLng),
  }));

  const negociacoes = await negociacoesDoPedido(pedidoId);
  const porProfissional = new Map(
    negociacoes.map((n) => [
      Number(n.providerId),
      {
        id: Number(n.id),
        estado: String(n.estado),
        valorAcordado: n.valorAcordado != null ? Number(n.valorAcordado) : null,
      },
    ]),
  );

  const receberam: LinhaDaDistribuicao[] = [];
  const naoReceberam: LinhaDaDistribuicao[] = [];

  for (const p of pros) {
    const distanciaKm = distanciaParaElegibilidade(
      p.baseLat != null && p.baseLng != null ? { lat: p.baseLat, lng: p.baseLng } : null,
      trabalho,
    );
    const negociacao = porProfissional.get(p.id) ?? null;

    if (negociacao) {
      receberam.push({ providerId: p.id, nome: p.name, negociacao, motivos: [], distanciaKm });
      continue;
    }

    const r = avaliarElegibilidade(
      {
        serviceType: pedido.serviceType ?? null,
        precisaFatura: Number((pedido as { precisaFatura?: unknown }).precisaFatura) === 1,
        precisaGuiaTransporte:
          Number((pedido as { precisaGuiaTransporte?: unknown }).precisaGuiaTransporte) === 1,
        distanciaKm,
        city: (pedido.city as string | null) ?? null,
      },
      p,
    );

    naoReceberam.push({
      providerId: p.id,
      nome: p.name,
      negociacao: null,
      motivos: r.elegivel
        ? // Elegível e sem negociação: não estava cá (ou não estava elegível)
          // quando o pedido foi enviado. Não é um erro — é história.
          ["elegível agora — inscreveu-se ou ficou elegível depois do envio"]
        : r.motivos.map((m) => ROTULO_DO_MOTIVO[m] ?? m),
      distanciaKm,
    });
  }

  const ordem = (l: LinhaDaDistribuicao[]) => l.sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  return { receberam: ordem(receberam), naoReceberam: ordem(naoReceberam) };
}
