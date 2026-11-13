import { perfilDoProfissional } from "./db";
import type { TrabalhoAPagar } from "./acesso-ao-pagamento";
import { dadosParaPagarAoParceiro } from "./dados-para-receber";
import { perfilFiscalDoParceiro } from "./perfil-fiscal";
import { totalAoCliente } from "./total-ao-cliente";
import {
  AS_DUAS_FATURAS,
  COMO_PAGAR_EM_PALAVRAS,
  PAGA_DIRETAMENTE_AO_PARCEIRO,
  PARCEIRO_SEM_DADOS_PARA_PAGAR,
  comoPagarDisponiveis,
  lerComoPagar,
} from "./pagar-ao-parceiro";
import { congelarRegimeDoProfissional, oQueONovoModeloGravou } from "./pagar-ao-parceiro-na-base";
import { faturasDaNegociacao } from "./faturas-do-trabalho-na-base";
import { asDuasFaturas } from "./faturas-do-trabalho";

const emEuros = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2).replace(".", ",")} €`;

/**
 * O TOTAL PELO REGIME DO PARCEIRO, NUMA FRASE — d18 (13-11-2026). A mesma do
 * bloco do site (`src/components/PagarAoParceiro.tsx`): o total com IVA, o sem IVA
 * ao lado (nunca sozinho) e as duas faturas. A app de cliente não escreve preços
 * nem IVA: recebe esta frase pronta. `null` sem total.
 */
export function totalAoParceiroEmTexto(c: { total: number | null; semIva: number; faturaDoParceiro: number; faturaDaTaxa: number }): string | null {
  if (c.total == null) return null;
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
  const c = totalAoCliente(t.acordado, t.taxas, regime);
  const faturas = asDuasFaturas(await faturasDaNegociacao(t.negociacaoId));
  const total = c ? c.total : null;
  const paraPagar = dadosParaPagarAoParceiro(perfil ?? {}, { contratado: true, doNovoModelo: true });
  const opcoes = comoPagarDisponiveis(total, paraPagar ?? null);
  return {
    pagaAoParceiro: true as const,
    frase: PAGA_DIRETAMENTE_AO_PARCEIRO,
    parceiro: t.profissionalNome,
    paraPagar,
    /** Sem IBAN nem MB WAY (d17, texto F): o que o cliente lê em vez dos dados. */
    semDados: paraPagar && !paraPagar.iban && !paraPagar.mbway ? PARCEIRO_SEM_DADOS_PARA_PAGAR : null,
    perfilFiscal: { ...fiscal, regimeParaAConta: regime },
    /** A frase do total, a mesma do bloco do site — a app de cliente mostra-a tal e qual (d18). */
    totalEmTexto: c ? totalAoParceiroEmTexto({ total, semIva: c.semIva, faturaDoParceiro: c.faturaDoParceiro, faturaDaTaxa: c.faturaDaTaxa }) : null,
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
