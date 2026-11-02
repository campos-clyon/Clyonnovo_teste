/**
 * TRANSFERÊNCIA BANCÁRIA, A PARTIR DE 700 € — 02-11-2026 (dono).
 *
 * Num trabalho grande, o MB WAY e o Multibanco têm tectos e comissões; o
 * cliente pode pagar por transferência para a conta da CLYON. O método só
 * aparece quando o total COM IVA chega a `LIMITE_DA_TRANSFERENCIA` e quando o
 * IBAN está escrito nas Configs do backoffice.
 *
 * O IBAN e o titular NUNCA vivem no código: o repositório é público. Escreve-os
 * o administrador (Configs → «Conta para a transferência bancária») e
 * guardam-se na base, em `plataformaConfiguracoes`.
 *
 * Quem diz que a transferência entrou é uma pessoa, nos Pagamentos do
 * backoffice («Recebido» → transferência). Até lá o pedido fica «À espera da
 * transferência» e o parceiro sabe que não deve começar.
 *
 * Este ficheiro não toca na base — serve ao browser e ao servidor.
 */

/** O total com IVA a partir do qual a transferência aparece. Um sítio só. */
export const LIMITE_DA_TRANSFERENCIA = 700;

/** A chave na tabela das configurações da plataforma. */
export const CHAVE_DA_CONTA_DA_TRANSFERENCIA = "conta_transferencia_bancaria";

/** O nome do método na base (`pagamentos.metodo`), o mesmo do registo à mão. */
export const METODO_TRANSFERENCIA = "transferencia";

export type ContaDaTransferencia = { iban: string; titular: string };

/** O IBAN sem espaços, em maiúsculas. */
export function ibanCompacto(v: string): string {
  return v.replace(/[\s.-]+/g, "").toUpperCase();
}

/**
 * Um IBAN que passa o controlo (ISO 13616, módulo 97). Um dígito trocado no
 * IBAN é uma transferência que vai para outra pessoa — por isso confere-se ao
 * guardar, e não se confia no olho.
 */
export function ibanValido(v: string): boolean {
  const iban = ibanCompacto(v);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  // Portugal tem 25 caracteres; um PT com outro tamanho está errado.
  if (iban.startsWith("PT") && iban.length !== 25) return false;
  const rodado = iban.slice(4) + iban.slice(0, 4);
  let resto = 0;
  for (const c of rodado) {
    const n = c >= "A" && c <= "Z" ? String(c.charCodeAt(0) - 55) : c;
    for (const d of n) resto = (resto * 10 + Number(d)) % 97;
  }
  return resto === 1;
}

/** «PT50 0000 0000 …» — de quatro em quatro, como o banco o mostra. */
export function ibanAgrupado(v: string): string {
  return ibanCompacto(v).replace(/(.{4})/g, "$1 ").trim();
}

/** O titular escrito por uma pessoa, arrumado. Vazio, `null`. */
export function titularLimpo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim().slice(0, 120);
  return t || null;
}

/**
 * A conta como se guarda (texto JSON na base) ou como chega do formulário.
 * `null` quando falta o IBAN, o titular, ou o IBAN não confere.
 */
export function contaLimpa(v: unknown): ContaDaTransferencia | null {
  let o: unknown = v;
  if (typeof v === "string") {
    try {
      o = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const iban = typeof r.iban === "string" ? ibanCompacto(r.iban) : "";
  const titular = titularLimpo(r.titular);
  if (!titular || !ibanValido(iban)) return null;
  return { iban, titular };
}

/** O que o cliente escreve no descritivo da transferência. */
export function descritivoDaTransferencia(pedidoId: number): string {
  return `Pedido #${pedidoId}`;
}

/** O total com IVA chega para a transferência? */
export function chegaParaTransferencia(totalComIva: number): boolean {
  return Number.isFinite(totalComIva) && totalComIva + 1e-9 >= LIMITE_DA_TRANSFERENCIA;
}

/** O que o cliente vê para pagar por transferência. */
export type TransferenciaParaOCliente = {
  iban: string;
  titular: string;
  /** O total com IVA — o que se transfere. */
  valor: number;
  /** O mesmo sem IVA, para mostrar ao lado (nunca sozinho). */
  valorSemIva: number;
  descritivo: string;
  limite: number;
};

/**
 * A transferência que se oferece a este trabalho, ou `null` quando não se
 * oferece: abaixo do limite, sem conta nas Configs, já pago, ou um pagamento
 * que não é do cliente (a dívida do parceiro em dinheiro).
 */
export function transferenciaParaOCliente(d: {
  conta: ContaDaTransferencia | null;
  totalComIva: number;
  totalSemIva: number;
  pedidoId: number;
  pago: boolean;
  doCliente: boolean;
}): TransferenciaParaOCliente | null {
  if (!d.conta || d.pago || !d.doCliente || !chegaParaTransferencia(d.totalComIva)) return null;
  return {
    iban: ibanAgrupado(d.conta.iban),
    titular: d.conta.titular,
    valor: d.totalComIva,
    valorSemIva: d.totalSemIva,
    descritivo: descritivoDaTransferencia(d.pedidoId),
    limite: LIMITE_DA_TRANSFERENCIA,
  };
}
