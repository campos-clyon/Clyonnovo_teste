import { after } from "next/server";
import { appendOrderHistory, gravarAjustes, negociacaoNoTerreno, registarSemFalhar } from "./db";
import { ajustesDe, responderAjuste } from "./ajuste-no-local";
import { lerForma, excedeONumerario, MAXIMO_EM_NUMERARIO } from "./forma-de-pagamento";
import { valorEmNumerario } from "./divida-do-profissional";
import { modeloDaNegociacao } from "./iva-incluido";
import { taxasDaNegociacao } from "./taxas-plataforma";
import { avisarProfissionalDaResposta, eTrabalhoClyon } from "./avisos-do-terreno";

/**
 * A RESPOSTA A UM PEDIDO DE AJUSTE — 18-10-2026. Ver `ajuste-no-local.ts`.
 *
 * Um sítio só, chamado por três portas: o link do pedido do cliente
 * (`/api/negociacao/[token]`), a área de cliente (`/api/users/me/negociacao`)
 * e o backoffice (a CLYON responde em nome do cliente, e é a única que
 * responde nos trabalhos CLYON de valor fixo).
 *
 * Aprovar escreve `valorAcordado` e mais nada; recusar deixa-o. Nunca se
 * aprova sozinho — só aqui, com alguém do outro lado a dizer que sim.
 */

const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

export type RespostaDaRota = { status: number; corpo: Record<string, unknown> };

export async function responderAoAjuste(a: {
  negociacaoId: number;
  resposta: "aprovar" | "recusar";
  porQuem: "cliente" | "clyon";
  autorNome: string | null;
  nota?: string | null;
}): Promise<RespostaDaRota> {
  const n = await negociacaoNoTerreno(a.negociacaoId);
  if (!n) return { status: 404, corpo: { ok: false, error: "Trabalho não encontrado." } };
  if (a.porQuem === "cliente" && eTrabalhoClyon(n)) {
    return { status: 403, corpo: { ok: false, error: "Este trabalho é tratado directamente pela CLYON." } };
  }

  const agora = new Date();
  const antes = n.ajustesJson ?? null;
  const r = responderAjuste(ajustesDe(antes), a.resposta, a.porQuem, agora, a.nota);
  if (!r.ok) return { status: 409, corpo: { ok: false, error: r.erro } };

  if (
    a.resposta === "aprovar" &&
    lerForma(n.formaDePagamento) === "dinheiro" &&
    excedeONumerario(valorEmNumerario(r.ajuste.valorNovo, taxasDaNegociacao(n), modeloDaNegociacao(n.createdAt)))
  ) {
    return {
      status: 409,
      corpo: {
        ok: false,
        error: `Este trabalho é pago em dinheiro e a lei não permite numerário a partir de ${MAXIMO_EM_NUMERARIO} €. Fale com a CLYON.`,
      },
    };
  }

  const gravou = await gravarAjustes(a.negociacaoId, {
    antes,
    depois: JSON.stringify(r.ajustes),
    valorAcordado: r.valorAcordadoNovo,
  });
  if (!gravou) {
    return { status: 409, corpo: { ok: false, error: "Este pedido mudou entretanto. Recarregue a página." } };
  }

  const quem = a.porQuem === "clyon" ? `${a.autorNome ?? "A CLYON"} (CLYON), pelo cliente,` : "O cliente";
  const resumo =
    a.resposta === "aprovar"
      ? `${quem} aprovou o ajuste: o valor passa de ${eur(r.ajuste.valorAntigo)} para ${eur(r.ajuste.valorNovo)}.`
      : `${quem} recusou o ajuste. O valor fica em ${eur(r.ajuste.valorAntigo)}.`;
  after(async () => {
    await appendOrderHistory(n.pedidoId, { type: "created", message: resumo }).catch(() => {});
    await registarSemFalhar({
      acontecimento: "ajuste_respondido",
      pedidoId: n.pedidoId,
      negociacaoId: a.negociacaoId,
      providerId: n.providerId,
      providerNome: n.profissionalNome,
      autorTipo: a.porQuem === "clyon" ? "clyon" : "cliente",
      autorNome: a.autorNome,
      resumo,
      detalhe: r.ajuste,
    });
    await avisarProfissionalDaResposta(n, r.ajuste).catch(() => {});
  });

  return {
    status: 200,
    corpo: {
      ok: true,
      ajusteRespondido: true,
      estadoDoAjuste: r.ajuste.estado,
      valorAcordado: r.valorAcordadoNovo ?? r.ajuste.valorAntigo,
    },
  };
}

/** A acção do corpo, se for uma resposta a um ajuste. */
export function respostaDoCorpo(accao: unknown): "aprovar" | "recusar" | null {
  return accao === "aprovar_ajuste" ? "aprovar" : accao === "recusar_ajuste" ? "recusar" : null;
}
