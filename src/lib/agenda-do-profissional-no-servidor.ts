import { getPool, negociacoesDoProfissional } from "@/lib/db";
import { vistaParaOEstado } from "@/lib/pedido-valores";
import { faseDoTrabalho } from "@/lib/trabalho";
import { SITE_URL } from "@/lib/seo-data";
import {
  eventoDoTrabalho,
  podeIrParaAAgenda,
  type EventoDaAgenda,
} from "@/lib/evento-na-agenda-do-profissional";

/**
 * O EVENTO DE UM TRABALHO DELE, PARA A AGENDA DELE — d144 (27-11-2026).
 *
 * Lê pela mesma consulta do painel (`negociacoesDoProfissional`, com o
 * `providerId` da sessão no WHERE — nunca do pedido), passa pela mesma vista
 * (`vistaParaOEstado`: a morada e o contacto só depois de contratado) e pela
 * regra `podeIrParaAAgenda` (por fazer, com o dia marcado, contacto ainda a
 * servir). Um trabalho de outro profissional é «não encontrado».
 */
export type ResultadoDaAgenda =
  | { ok: true; evento: EventoDaAgenda; dataCombinada: Date }
  | { ok: false; estado: 404 | 409; erro: string };

export async function eventoDaAgendaDoProfissional(
  providerId: number,
  negociacaoId: number,
): Promise<ResultadoDaAgenda> {
  const linhas = await negociacoesDoProfissional(providerId);
  const l = linhas.find((x) => Number(x.id) === negociacaoId);
  if (!l) return { ok: false, estado: 404, erro: "Trabalho não encontrado." };

  const extra = l as unknown as { dataCombinada?: Date | string | null; duracaoMinutos?: number | string | null };
  const fase = faseDoTrabalho(l as never);
  if (
    !podeIrParaAAgenda({
      estado: l.estado,
      fase,
      arquivadoEm: l.arquivadoProfissionalEm,
      dataCombinada: extra.dataCombinada ?? null,
    })
  ) {
    return {
      ok: false,
      estado: 409,
      erro: "Só se põe na agenda um trabalho seu, por fazer e com o dia marcado.",
    };
  }

  const vista = vistaParaOEstado(l as unknown as Record<string, unknown>, l.estado) as Record<string, unknown>;
  const texto = (k: string) => (typeof vista[k] === "string" && (vista[k] as string).trim() ? (vista[k] as string) : null);
  const evento = eventoDoTrabalho(
    {
      negociacaoId,
      pedidoId: Number(l.pedidoId),
      serviceType: texto("serviceType"),
      dataCombinada: extra.dataCombinada ?? null,
      duracaoMinutos: extra.duracaoMinutos != null ? Number(extra.duracaoMinutos) : null,
      morada: texto("address"),
      city: texto("city"),
      moradaDestino: texto("moradaDestino"),
      contactoNome: texto("contactName"),
      contactoTelefone: texto("contactPhone"),
      description: texto("description"),
      floor: texto("floor"),
      hasElevator: texto("hasElevator"),
      parkingDistance: texto("parkingDistance"),
      andarDestino: texto("andarDestino"),
      elevadorDestino: texto("elevadorDestino"),
      estacionamentoDestino: texto("estacionamentoDestino"),
    },
    SITE_URL,
  );
  if (!evento) return { ok: false, estado: 409, erro: "Este trabalho ainda não tem o dia marcado." };
  return { ok: true, evento, dataCombinada: evento.inicio };
}

/** Guarda o dia que estava marcado quando ele o pôs na agenda — para o «O dia mudou». */
export async function marcarAgendaAdicionada(providerId: number, negociacaoId: number, para: Date): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  await pool.execute("UPDATE negociacoes SET agendaAdicionadaPara = ? WHERE id = ? AND providerId = ?", [
    para,
    negociacaoId,
    providerId,
  ]);
}
