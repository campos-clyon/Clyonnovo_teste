import { DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO } from "./novo-modelo";
import { prazoDoValorEmAtraso } from "./valor-em-atraso";

/**
 * O ESTADO DO VALOR EM ATRASO DE UM TRABALHO, PARA OS PAGAMENTOS DO BACKOFFICE —
 * d10, desde 15-11-2026.
 *
 * No modelo novo o parceiro passa à CLYON a taxa da plataforma e o IVA dela, uma
 * referência por trabalho. Tem `DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO` dias contados
 * do fecho; no instante a seguir aos 4 dias certos (o 5.º dia) a conta fica em
 * stand-by (`valoresForaDoPrazo`, a mesma regra que trava propor e aceitar).
 * Aqui só se diz o estado, para a equipa ver em Pagamentos › A receber dos
 * profissionais: «pago», «no prazo» (com os dias que faltam), «stand-by» ou
 * «sem data» (sem fecho gravado não se castiga ninguém).
 *
 * Puro: a rota e o teste fazem a mesma conta.
 */
export type EstadoDoValorEmAtraso =
  | { estado: "pago"; frase: string }
  | { estado: "no_prazo"; frase: string; ate: string; diasQueFaltam: number }
  | { estado: "stand_by"; frase: string; desde: string }
  | { estado: "sem_data"; frase: string };

const DIA = 86_400_000;

export function estadoDoValorEmAtraso(
  v: { paga: boolean; porPagar: number; nasceuEm: Date | null },
  agora: Date,
): EstadoDoValorEmAtraso {
  if (v.paga || v.porPagar <= 0) return { estado: "pago", frase: "Pago" };
  const fim = prazoDoValorEmAtraso({ nasceuEm: v.nasceuEm });
  if (!fim) return { estado: "sem_data", frase: "Valor em atraso sem data de fecho — não conta para o stand-by" };
  if (agora.getTime() > fim.getTime()) {
    return { estado: "stand_by", frase: "Stand-by: passou o prazo de pagamento", desde: fim.toISOString() };
  }
  const diasQueFaltam = Math.max(0, Math.ceil((fim.getTime() - agora.getTime()) / DIA));
  return {
    estado: "no_prazo",
    frase: `Valor em atraso, no prazo (${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias): ${diasQueFaltam === 1 ? "falta 1 dia" : `faltam ${diasQueFaltam} dias`}`,
    ate: fim.toISOString(),
    diasQueFaltam,
  };
}
