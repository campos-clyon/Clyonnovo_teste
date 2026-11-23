import { perfilDoProfissional } from "./db";
import type { TrabalhoAPagar } from "./acesso-ao-pagamento";
import { dadosParaPagarAoParceiro } from "./dados-para-receber";
import { perfilFiscalDoParceiro } from "./perfil-fiscal";
import { totalAoCliente } from "./total-ao-cliente";
import {
  AS_DUAS_FATURAS,
  COMO_PAGAR_EM_PALAVRAS,
  PAGA_DIRETAMENTE_AO_PARCEIRO_CONTRATADO,
  PARCEIRO_SEM_DADOS_PARA_PAGAR,
  comoPagarDisponiveis,
  lerComoPagar,
} from "./pagar-ao-parceiro";
import { congelarRegimeDoProfissional, oQueONovoModeloGravou } from "./pagar-ao-parceiro-na-base";
import { negociacoesComDadosDePagamentoMudados } from "./dados-de-pagamento-mudados-na-base";
import { DADOS_DE_PAGAMENTO_MUDARAM } from "./dados-de-pagamento-mudados";
import { faturasDaNegociacao } from "./faturas-do-trabalho-na-base";
import { asDuasFaturas } from "./faturas-do-trabalho";
import { negociacoesComDadosPorConfirmar } from "./dados-de-pagamento-por-confirmar-na-base";
import { DADOS_DE_PAGAMENTO_A_CONFIRMAR, dadosQueOClienteRecebe } from "./dados-de-pagamento-por-confirmar";

const emEuros = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2).replace(".", ",")} €`;

/**
 * O TOTAL PELO REGIME DO PARCEIRO, NUMA FRASE — d18 (13-11-2026). A mesma do
 * bloco do site (`src/components/PagarAoParceiro.tsx`): o total com IVA, o sem IVA
 * ao lado (nunca sozinho) e as duas faturas. A app de cliente não escreve preços
 * nem IVA: recebe esta frase pronta. `null` sem total.
 *
 * d6 (19-11-2026): ao parceiro isento (art. 53.º) não se diz «com IVA» do total —
 * a fatura do trabalho não leva IVA; só a da taxa da plataforma o leva.
 */
export function totalAoParceiroEmTexto(
  c: { total: number | null; semIva: number; faturaDoParceiro: number; faturaDaTaxa: number },
  regime?: string | null,
): string | null {
  if (c.total == null) return null;
  if (regime === "isento") {
    return (
      `Total: ${emEuros(c.total)} — fatura do trabalho ${emEuros(c.faturaDoParceiro)} (o parceiro é isento de IVA) ` +
      `e fatura da taxa da plataforma ${emEuros(c.faturaDaTaxa)}, com IVA.`
    );
  }
  return (
    `Total: ${emEuros(c.total)} com IVA (${emEuros(c.semIva)} sem IVA) — fatura do trabalho ` +
    `${emEuros(c.faturaDoParceiro)} e fatura da taxa da plataforma ${emEuros(c.faturaDaTaxa)}.`
  );
}

/**
 * «PAGAR A …» — O QUE O CLIENTE VÊ DE UM TRABALHO DO MODELO DE 15-11 (d10; uma
 * função só desde a d17, 13-11-2026).
 *
 * Era o corpo de `/api/pagamentos/ao-parceiro`. Saiu para aqui para a app de
 * cliente (R5, `pagamentoParaAApp`) dizer o mesmo sem um segundo pedido: o
 * total pelo regime do parceiro (`total-ao-cliente.ts`, o mesmo do cartão e do
 * email), quem passa a fatura, o IBAN e o MB WAY — só depois de contratar e só
 * no modelo novo (quem chama já o confirmou: `trabalhoQueSePodePagar`) —, as
 * formas de pagar que ele tem dados para receber, e as faturas já juntas.
 *
 * Congela o regime na primeira leitura, como sempre fez a rota: o número que o
 * cliente leu não muda se o parceiro mudar o perfil depois.
 */
export async function oQueOClienteVeDoParceiro(t: TrabalhoAPagar) {
  const perfil = await perfilDoProfissional(t.providerId);
  const fiscal = perfilFiscalDoParceiro(perfil ?? {});
  const regime = await congelarRegimeDoProfissional(t.negociacaoId, fiscal.regimeParaAConta);
  const gravado = await oQueONovoModeloGravou(t.negociacaoId);
  // A reserva do valor único (d39) entra na fatura da CLYON, como na dívida do parceiro.
  const c = totalAoCliente(t.acordado, t.taxas, regime, t.reservaCent ?? 0);
  const faturas = asDuasFaturas(await faturasDaNegociacao(t.negociacaoId));
  const total = c ? c.total : null;
  /*
   * d5 (19-11-2026): os dados mudaram depois de contratar, ou o titular do IBAN
   * não bate com o nome do parceiro nem da empresa — o cliente não recebe o IBAN
   * nem o MB WAY até o administrador confirmar com o parceiro («Confirmei com o
   * parceiro», na Mesa). Fica o dinheiro no local. Se a leitura falhar, retém-se
   * (o lado seguro).
   */
  const porConfirmar = await negociacoesComDadosPorConfirmar([t.negociacaoId])
    .then((m) => m.has(t.negociacaoId))
    .catch((e) => {
      console.error("[pagar-ao-parceiro] dados por confirmar:", e instanceof Error ? e.message : e);
      return true;
    });
  const paraPagar = dadosQueOClienteRecebe(
    dadosParaPagarAoParceiro(perfil ?? {}, { contratado: true, doNovoModelo: true }),
    porConfirmar,
  );
  const opcoes = comoPagarDisponiveis(total, paraPagar ?? null);
  // d28: os dados de pagamento mudaram depois de contratar? Se a leitura falhar, avisa-se (o lado seguro).
  const dadosMudados = await negociacoesComDadosDePagamentoMudados([t.negociacaoId])
    .then((s) => s.has(t.negociacaoId))
    .catch((e) => {
      console.error("[pagar-ao-parceiro] dados de pagamento mudados:", e instanceof Error ? e.message : e);
      return true;
    });
  return {
    pagaAoParceiro: true as const,
    frase: PAGA_DIRETAMENTE_AO_PARCEIRO_CONTRATADO,
    parceiro: t.profissionalNome,
    paraPagar,
    /** Sem IBAN nem MB WAY (d17, texto F): o que o cliente lê em vez dos dados. */
    semDados: porConfirmar
      ? DADOS_DE_PAGAMENTO_A_CONFIRMAR
      : paraPagar && !paraPagar.iban && !paraPagar.mbway
        ? PARCEIRO_SEM_DADOS_PARA_PAGAR
        : null,
    /** d5: os dados de pagamento estão retidos até a CLYON os confirmar com o parceiro. */
    dadosPorConfirmar: porConfirmar,
    /**
     * O IBAN, o titular ou o MB WAY mudaram DEPOIS de o cliente contratar (d28):
     * a frase que ele lê antes de transferir — o site e a app de cliente
     * mostram-na tal como vem. `null` quando não mudaram.
     */
    dadosMudaram: dadosMudados && !porConfirmar ? DADOS_DE_PAGAMENTO_MUDARAM : null,
    perfilFiscal: { ...fiscal, regimeParaAConta: regime },
    /** A frase do total, a mesma do bloco do site — a app de cliente mostra-a tal e qual (d18). */
    totalEmTexto: c ? totalAoParceiroEmTexto({ total, semIva: c.semIva, faturaDoParceiro: c.faturaDoParceiro, faturaDaTaxa: c.faturaDaTaxa }, regime) : null,
    conta: c
      ? {
          semIva: c.semIva,
          faturaDoParceiro: c.faturaDoParceiro,
          ivaDoParceiro: c.ivaDoParceiro,
          faturaDaTaxa: c.faturaDaTaxa,
          ivaDaTaxa: c.ivaDaTaxa,
          total,
        }
      : null,
    comoPagar: lerComoPagar(gravado.pagarAoParceiroPor),
    opcoes: opcoes.map((id) => ({ id, ...COMO_PAGAR_EM_PALAVRAS[id] })),
    faturas: {
      frase: AS_DUAS_FATURAS,
      daTaxa: faturas.clyon ? { url: faturas.clyon.url, nome: faturas.clyon.nome, em: faturas.clyon.carregadaEm } : null,
      doTrabalho: faturas.parceiro ? { url: faturas.parceiro.url, nome: faturas.parceiro.nome, em: faturas.parceiro.carregadaEm } : null,
    },
  };
}

export type ParceiroParaOCliente = Awaited<ReturnType<typeof oQueOClienteVeDoParceiro>>;
