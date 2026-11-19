import { DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO } from "./novo-modelo";
import { prazoDoValorEmAtraso } from "./valor-em-atraso";
import { diaEMesEmLisboa, linhaDoValorAPassar } from "./como-recebe-no-novo-modelo";

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
 * d4 (18-11-2026): «em atraso» só depois do prazo. Dentro dele a frase é a do
 * parceiro — «A passar à CLYON · X € até dd/mm» (`linhaDoValorAPassar`, em hora
 * de Lisboa), com os dias que faltam.
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
  if (!fim) return { estado: "sem_data", frase: "A passar à CLYON, sem data de fecho — não conta para a suspensão da conta" };
  if (agora.getTime() > fim.getTime()) {
    return {
      estado: "stand_by",
      frase: `Em atraso desde ${diaEMesEmLisboa(fim)} · conta suspensa: passou o prazo de pagamento`,
      desde: fim.toISOString(),
    };
  }
  const diasQueFaltam = Math.max(0, Math.ceil((fim.getTime() - agora.getTime()) / DIA));
  return {
    estado: "no_prazo",
    frase: `${linhaDoValorAPassar({ total: v.porPagar, prazoAte: fim, paga: false }, agora).linha} (${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias: ${diasQueFaltam === 1 ? "falta 1 dia" : `faltam ${diasQueFaltam} dias`})`,
    ate: fim.toISOString(),
    diasQueFaltam,
  };
}
