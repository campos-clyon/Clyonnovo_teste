import { MOTIVO_DA_RESERVA_RETIRADA } from "./reserva";

/**
 * REFAZER SEM A RESERVA — d101 (dono, 24-11-2026).
 *
 * Com o interruptor «Reserva do valor único» desligado, a conta de cada
 * trabalho volta à de antes da d39: o parceiro passa à CLYON só a taxa da
 * plataforma e o IVA dela. As referências já geradas COM a reserva ficaram com
 * o valor errado; a rota de admin (`/api/admin/reserva-do-valor-unico/refazer`)
 * anula as que estão por pagar e gera as novas pelo caminho de sempre
 * (`gerarReferenciaDaDivida`). As pagas não se mexem: ficam numa lista à parte
 * para o dono decidir.
 *
 * Puro: o que se faz a cada trabalho e com que texto.
 */

export const CONFIRMACAO_DO_REFAZER = "REFAZER";

export type EstadoDaParteDaClyon = "pago" | "referencia_pendente" | "sem_referencia";

export const ESTADO_EM_PALAVRAS: Record<EstadoDaParteDaClyon, string> = {
  pago: "pago",
  referencia_pendente: "referência pendente",
  sem_referencia: "sem referência",
};

/**
 * O estado da parte da CLYON de um trabalho. Qualquer pagamento pago, ou uma
 * parte já marcada (IVA ou taxa — `cobrancasAoProfissional`), conta como pago:
 * esses não se mexem.
 */
export function estadoDaParteDaClyon(
  pagamentos: ReadonlyArray<{ estado: string }>,
  marcas: ReadonlyArray<unknown> = [],
): EstadoDaParteDaClyon {
  if (pagamentos.some((p) => p.estado === "pago") || marcas.length > 0) return "pago";
  if (pagamentos.some((p) => p.estado === "pendente")) return "referencia_pendente";
  return "sem_referencia";
}

/** Só se refaz o que não está pago. */
export function refazSe(estado: EstadoDaParteDaClyon): boolean {
  return estado !== "pago";
}

/** «REFAZER», escrito à mão. */
export function confirmacaoDoRefazer(corpo: unknown): boolean {
  const c = (corpo as { confirmacao?: unknown } | null)?.confirmacao;
  return typeof c === "string" && c.trim().toUpperCase() === CONFIRMACAO_DO_REFAZER;
}

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/** A linha do histórico do pedido. Sem nomes nem telefones. */
export function fraseDoRefazer(d: {
  negociacaoId: number;
  anuladas: ReadonlyArray<{ valor: number }>;
  nova: { valor: number; referencia: string | null } | null;
  porqueSemNova?: string | null;
  quem: string;
}): string {
  const antes =
    d.anuladas.length > 0
      ? `Referência${d.anuladas.length > 1 ? "s" : ""} de ${d.anuladas.map((a) => euros(a.valor)).join(", ")} anulada${d.anuladas.length > 1 ? "s" : ""}`
      : "Sem referência por pagar";
  const depois = d.nova
    ? `nova referência de ${euros(d.nova.valor)}${d.nova.referencia ? ` (${d.nova.referencia})` : ""}: a taxa da plataforma e o IVA dela`
    : `sem referência nova${d.porqueSemNova ? ` (${d.porqueSemNova})` : ""}`;
  return `${MOTIVO_DA_RESERVA_RETIRADA} — negociação #${d.negociacaoId}, por ${d.quem}. ${antes}; ${depois}.`;
}
