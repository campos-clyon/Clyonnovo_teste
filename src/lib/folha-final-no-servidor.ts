import { appendOrderHistory, folhaDaNegociacao, getSimulatorOrderById, registarSemFalhar } from "./db";
import { avisarProfissional } from "./avisos-do-backoffice";
import { trabalhoVistoPeloBackoffice } from "./acesso-ao-pagamento";
import { lerBase } from "./base-do-preco";
import { isMudancaType } from "./calendar-helpers";
import { tarifaCongeladaDeJson, type TarifaCongelada } from "./conta-da-mudanca";
import { excedeONumerario, lerForma, MAXIMO_EM_NUMERARIO } from "./forma-de-pagamento";
import { fazerAFolhaFinal, fraseDaFolhaFinal, type CorpoDaFolhaFinal, type FolhaFinalFeita } from "./folha-final";
import { folhasFinaisDe, gravarFolhaFinal, transferidoAntesDasFolhasFinais, type FolhaFinalGravada } from "./folha-final-na-base";
import { quantoOProfissionalRecebe, taxasDaNegociacao } from "./taxas-plataforma";
import type { RegimeDoProfissional } from "./pagamento-directo";
import { acordoDasPessoasAMaisDe, type QuemRegistaOAcordo } from "./tabela-das-mudancas";

/**
 * A FOLHA FINAL NO SERVIDOR — d38 v2, commit b. A rota das horas
 * (`/api/admin/negociacoes/horas`, accao «folha_final») chama isto; a conta é
 * a de `folha-final.ts`, a escrita a de `folha-final-na-base.ts`.
 */

type Linha = Record<string, unknown> & { id?: unknown; providerId?: unknown; estado?: unknown };

const numero = (v: unknown): number | null => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export type ContextoDaFolhaFinal = {
  pode: boolean;
  porqueNao: string | null;
  trabalhoClyon: boolean;
  porHora: boolean;
  tarifa: TarifaCongelada | null;
  pessoasEscolhidas: 2 | 3 | null;
  kmDoPercurso: number | null;
  antes: { valorAcordado: number | null; taxaProfissional: number | null; profissional: number | null };
  taxa: Parameters<typeof fazerAFolhaFinal>[0]["taxa"];
  modelo: { novoModelo: boolean; regime: RegimeDoProfissional };
  jaPago: boolean;
  emDinheiro: boolean;
  historico: FolhaFinalGravada[];
};

export async function contextoDaFolhaFinal(pedidoId: number, linha: Linha): Promise<ContextoDaFolhaFinal> {
  const pedido = (await getSimulatorOrderById(pedidoId)) as Record<string, unknown> | undefined;
  const historico = await folhasFinaisDe(Number(linha.id)).catch(() => [] as FolhaFinalGravada[]);
  const daFolha = await folhaDaNegociacao(Number(linha.id)).catch(() => null);
  const tarifa = tarifaCongeladaDeJson((linha.tarifaCongeladaJson as string | null) ?? null);
  const trabalhoClyon = (typeof linha.ofertaClyon === "string" && linha.ofertaClyon !== "") || pedido?.valorFixoClyon != null;
  const porHora = lerBase(pedido?.baseDoPreco) === "hora";
  const mudanca = isMudancaType((pedido?.serviceType as string | null) ?? null) || tarifa != null;
  const acesso = await trabalhoVistoPeloBackoffice(Number(linha.id)).catch(() => null);
  const congelado = linha.regimeDoProfissional;
  const regime: RegimeDoProfissional =
    congelado === "normal" || congelado === "isento" ? congelado : acesso && acesso.ok ? acesso.trabalho.regime : "isento";
  const valorAcordado = numero(linha.valorAcordado);
  const taxaProfissional = numero(linha.taxaProfissional);
  const horasConfirmadas = linha.horasConfirmadasEm != null;
  // Num trabalho à hora por confirmar o valor é o preço da hora: o profissional recebe o que se souber depois.
  const profissional =
    valorAcordado != null && (!porHora || horasConfirmadas) ? quantoOProfissionalRecebe(valorAcordado, taxasDaNegociacao(linha as { taxaCliente?: unknown; taxaProfissional?: unknown })) : null;
  const pessoas = Number(linha.pessoasEscolhidas);
  let porqueNao: string | null = null;
  if (!mudanca) porqueNao = "A folha final é só para mudanças: corrija o valor à mão.";
  else if (linha.estado !== "acordada") porqueNao = "Este trabalho ainda não tem quem o faça.";
  return {
    pode: porqueNao == null,
    porqueNao,
    trabalhoClyon,
    porHora,
    tarifa,
    pessoasEscolhidas: pessoas === 2 || pessoas === 3 ? pessoas : null,
    kmDoPercurso: numero(daFolha?.kmPercurso),
    antes: { valorAcordado, taxaProfissional, profissional },
    taxa: {
      daFolhaAnterior: historico[0]?.taxaBase ?? null,
      trabalhoClyon,
      taxaClyon: numero(pedido?.taxaClyon),
      tarifa,
      taxaCliente: numero(linha.taxaCliente),
      taxaProfissional,
    },
    modelo: { novoModelo: Boolean(acesso && acesso.ok && acesso.trabalho.novoModelo), regime },
    jaPago: linha.pagoEm != null,
    emDinheiro: lerForma(linha.formaDePagamento) === "dinheiro",
    historico,
  };
}

/** O que o formulário precisa para abrir (GET). */
export function folhaFinalParaOEcra(c: ContextoDaFolhaFinal) {
  const t = c.tarifa;
  const ultima = c.historico[0] ?? null;
  return {
    pode: c.pode,
    porqueNao: c.porqueNao,
    trabalhoClyon: c.trabalhoClyon,
    jaPago: c.jaPago,
    novoModelo: c.modelo.novoModelo,
    antes: c.antes,
    tarifa: t
      ? {
          precoHora2: t.precoHora2Cent / 100,
          precoHora3: t.precoHora3Cent == null ? null : t.precoHora3Cent / 100,
          minimoHoras: t.minimoHoras,
          precoKm: t.precoKmCent / 100,
          kmMinimo: t.kmMinimo,
        }
      : null,
    pessoasEscolhidas: c.pessoasEscolhidas,
    kmDoPercurso: c.kmDoPercurso,
    ultima: ultima ? { entrada: ultima.entrada, previa: ultima.previa, porQuem: ultima.porQuem, criadaEm: ultima.criadaEm } : null,
    historico: c.historico.map((h) => ({
      id: h.id,
      criadaEm: h.criadaEm,
      porQuem: h.porQuem,
      valorAntes: h.valorAntes,
      valorDepois: h.valorDepois,
      profissionalAntes: h.profissionalAntes,
      profissionalDepois: h.profissionalDepois,
      jaPago: h.jaPago,
      motivo: h.motivo,
    })),
  };
}

type Resposta = { status: number; corpo: Record<string, unknown> };

/**
 * Faz a conta e, sem `previsualizar`, grava. A pré-visualização devolve os
 * mesmos números que se vão gravar — é o que a equipa vê antes do «Gravar».
 */
export async function folhaFinalPelaEquipa(a: {
  pedidoId: number;
  negociacaoId: number;
  linha: Linha;
  corpo: CorpoDaFolhaFinal & { previsualizar?: unknown; motivo?: unknown };
  porQuem: string;
  /** O papel de quem grava (d70: fica no acordo do cliente com as pessoas a mais). */
  papel?: QuemRegistaOAcordo;
}): Promise<Resposta> {
  const c = await contextoDaFolhaFinal(a.pedidoId, a.linha);
  if (!c.pode) return { status: 409, corpo: { error: c.porqueNao } };
  const anterior = acordoDasPessoasAMaisDe((c.historico[0]?.entrada as { acordoDasPessoasAMais?: unknown } | null)?.acordoDasPessoasAMais);
  const feito = fazerAFolhaFinal({
    corpo: a.corpo,
    tarifa: c.tarifa,
    taxa: c.taxa,
    modelo: c.modelo,
    registo: { quem: { por: a.papel ?? "admin", nome: a.porQuem }, agora: new Date(), anterior },
  });
  if (!feito.ok) return { status: 400, corpo: { error: feito.erro } };
  const f = feito.folha;
  const motivo = typeof a.corpo.motivo === "string" && a.corpo.motivo.trim() ? a.corpo.motivo.trim().slice(0, 300) : null;
  /*
   * JÁ PAGO AO PROFISSIONAL (d38 v2, commit c): o que se lhe transferiu e a
   * diferença. A favor dele fica-lhe na carteira (acerto da folha final); contra
   * ele é uma dívida.
   */
  let acerto: { transferido: number; diferenca: number } | null = null;
  if (c.jaPago) {
    const t = (await transferidoAntesDasFolhasFinais([a.negociacaoId]).catch(() => new Map<number, number>())).get(a.negociacaoId);
    const transferido = t ?? c.antes.profissional;
    if (transferido != null) acerto = { transferido, diferenca: Math.round((f.previa.profissional - transferido) * 100) / 100 };
  }
  const resposta = (extra: Record<string, unknown> = {}) => ({ ok: true, previa: f.previa, conta: f.conta, antes: c.antes, acerto, ...extra });

  if (c.emDinheiro && excedeONumerario(f.previa.total)) {
    return {
      status: 409,
      corpo: {
        error: `Este trabalho é pago em dinheiro e a lei não permite numerário a partir de ${MAXIMO_EM_NUMERARIO} €. Mude a forma de pagamento primeiro.`,
      },
    };
  }
  if (a.corpo.previsualizar === true) return { status: 200, corpo: resposta({ previsualizado: true, precisaMotivo: c.jaPago }) };
  if (c.jaPago && !motivo) {
    return { status: 409, corpo: { error: "O profissional já foi pago. Escreva o motivo — fica no histórico.", precisaMotivo: true } };
  }

  const gravou = await gravarFolhaFinal({
    negociacaoId: a.negociacaoId,
    pedidoId: a.pedidoId,
    antes: c.antes,
    gravar: f.gravar,
    entrada: f.entrada,
    conta: f.conta,
    previa: f.previa,
    porHora: c.porHora,
    precoClyonAcompanha: c.trabalhoClyon && c.taxa.taxaClyon != null,
    jaPago: c.jaPago,
    porQuem: a.porQuem,
    motivo,
  });
  if (!gravou.ok) {
    return {
      status: 409,
      corpo: {
        error: gravou.porque === "mudou" ? "O valor deste trabalho mudou entretanto — veja de novo a conta e grave." : "Este trabalho já não está fechado com um profissional.",
        mudou: gravou.porque === "mudou",
      },
    };
  }

  const frase = fraseDaFolhaFinal(f, { porQuem: a.porQuem, antes: c.antes.valorAcordado, jaPago: c.jaPago, motivo });
  await appendOrderHistory(a.pedidoId, { type: "valor_corrigido", by: null, message: frase }).catch(() => {});
  await registarSemFalhar({
    acontecimento: "valor_corrigido",
    pedidoId: a.pedidoId,
    negociacaoId: a.negociacaoId,
    providerId: Number(a.linha.providerId),
    autorTipo: "clyon",
    autorNome: a.porQuem,
    valor: f.gravar.valorAcordado,
    valorProfissional: f.previa.profissional,
    resumo: frase,
  });
  // O profissional fica a saber do valor novo, como no «Corrigir o valor». O cliente não: isso é o «Enviar o valor final».
  await avisarProfissional(Number(a.linha.providerId), "valor_corrigido", { pedidoId: a.pedidoId, negociacaoId: a.negociacaoId }).catch(() => {});
  return { status: 200, corpo: resposta({ gravado: true, id: gravou.id }) };
}

export type { FolhaFinalFeita };
