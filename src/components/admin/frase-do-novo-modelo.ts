import { DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO } from "@/lib/novo-modelo";

/**
 * O BLOCO «DEU O TRABALHO POR FEITO» DA MESA NUM TRABALHO DO MODELO DE 15-11 —
 * d53 (16-11-2026). O cliente paga ao profissional; a CLYON não recebe nada
 * dele. O valor é o que o profissional passa à CLYON (a taxa da plataforma e o
 * IVA dela), o mesmo da «Conta do pagamento» (`aPassarAClyonDaConta`); sem ele
 * (a ler), a frase sai sem número. Só no backoffice: diz-se «profissional».
 */
export function backofficeAConfirmarNoNovoModelo(aPassar: number | null): string {
  const valor = aPassar != null && Number.isFinite(aPassar) ? ` (${aPassar.toFixed(2).replace(".", ",")} €)` : "";
  return (
    "O cliente paga diretamente ao profissional. Quando o trabalho fica confirmado, o profissional recebe a " +
    `referência para passar à CLYON a taxa da plataforma e o IVA dela${valor}, e tem ${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias para pagar.`
  );
}
