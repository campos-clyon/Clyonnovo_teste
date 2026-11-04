import { getPool } from "./db";
import { guiaImpedeContratar } from "./guia-antes-de-contratar";
import { coincidenciasEntre, type Coincidencia } from "./coincidencias-cliente-parceiro";

/**
 * A CONFIANÇA, NA MESA E NOS TRABALHOS CLYON — 04-11-2026 (d10.1 e d10.3).
 *
 * Duas perguntas por negociação, numa consulta só, para o ecrã as mostrar
 * antes de alguém carregar no botão:
 *
 *   · `guiaPorVerificar` — o trabalho exige a guia de resíduos e a dele está
 *     por verificar: aceitar, contratar ou escolher é recusado pelo servidor
 *     (`guia-antes-de-contratar.ts`);
 *   · `coincidencias` — o cliente e o parceiro partilham o telefone, o email ou
 *     a morada (`coincidencias-cliente-parceiro.ts`).
 *
 * Só leitura, e nunca parte a lista: quem chama apanha o erro e mostra a Mesa
 * sem isto.
 */
export type ConfiancaDaNegociacao = { guiaPorVerificar: boolean; coincidencias: Coincidencia[] };

const POR_FECHAR = new Set(["aberta", "aguarda_contratacao"]);

export async function confiancaDasNegociacoes(ids: number[]): Promise<Map<number, ConfiancaDaNegociacao>> {
  const mapa = new Map<number, ConfiancaDaNegociacao>();
  const unicos = [...new Set(ids.filter((i) => Number.isInteger(i) && i > 0))];
  if (unicos.length === 0) return mapa;
  const pool = await getPool();
  if (!pool) return mapa;
  const [linhas] = (await pool.execute(
    `SELECT n.id, n.estado,
            o.serviceType, o.precisaGuiaTransporte, o.contactPhone, o.contactEmail, o.address,
            p.emiteGuiaTransporte, p.guiaVerificadaEm, p.phone, p.email, p.city AS base, p.moradaFiscal
       FROM negociacoes n
       JOIN simulatorOrders o ON o.id = n.pedidoId
       JOIN providers p ON p.id = n.providerId
      WHERE n.id IN (${unicos.map(() => "?").join(",")})`,
    unicos,
  )) as [Array<Record<string, unknown>>, unknown];
  for (const l of linhas) {
    mapa.set(Number(l.id), {
      // Só antes de fechar: depois de acordada, a pergunta já não se põe.
      guiaPorVerificar: POR_FECHAR.has(String(l.estado)) && guiaImpedeContratar(l, l),
      coincidencias: coincidenciasEntre(
        { telefone: l.contactPhone, email: l.contactEmail, morada: l.address },
        { telefone: l.phone, email: l.email, moradas: [l.base, l.moradaFiscal] },
      ),
    });
  }
  return mapa;
}
