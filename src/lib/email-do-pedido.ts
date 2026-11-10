import { registarSemFalhar } from "./db";

/**
 * O EMAIL DE UM PEDIDO — d24, 10-11-2026.
 *
 * O cliente é o seu email: é por `contactEmail` que a /conta e a app de
 * cliente encontram os pedidos dele. Mudar o email de um pedido é mudá-lo de
 * conta, e por isso é do administrador, como o email das Contas. Cada mudança
 * fica no registo permanente, com quem a fez e o antes e o depois.
 */

export const SO_O_ADMINISTRADOR_MUDA_O_EMAIL_DO_PEDIDO = "Só o administrador muda o email de um pedido.";

const normal = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return t.length > 0 ? t : null;
};

/**
 * O email vindo do formulário muda o do pedido? `undefined` (o campo não veio)
 * não muda nada. Maiúsculas e espaços não contam como mudança.
 */
export function emailDoPedidoMuda(
  pedidoEmail: string | null | undefined,
  pedido: unknown,
): { muda: boolean; antes: string | null; depois: string | null } {
  const antes = normal(pedidoEmail);
  if (pedido === undefined) return { muda: false, antes, depois: antes };
  const depois = normal(pedido);
  return { muda: antes !== depois, antes, depois };
}

/** A linha do registo permanente. Nunca lança: a mudança já está gravada. */
export async function registarEmailDoPedidoMudado(l: {
  pedidoId: number;
  antes: string | null;
  depois: string | null;
  colab: { id?: number | null; nome?: string | null; papel?: string | null } | null | undefined;
  onde: string;
}): Promise<void> {
  const quem = l.colab?.nome ?? "a equipa";
  await registarSemFalhar({
    acontecimento: "pedido_email_mudado",
    pedidoId: l.pedidoId,
    clienteEmail: l.depois,
    autorTipo: "clyon",
    autorNome: quem,
    resumo: `Email do pedido #${l.pedidoId} mudado por ${quem} (${l.onde}).`,
    detalhe: {
      porId: l.colab?.id ?? null,
      papel: l.colab?.papel ?? null,
      onde: l.onde,
      mudancas: { email: { antes: l.antes, depois: l.depois } },
    },
  });
  console.info(`[pedidos] email do pedido #${l.pedidoId} mudado por ${quem} (${l.onde})`);
}
