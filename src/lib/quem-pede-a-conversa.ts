import type { NextRequest } from "next/server";
import { clienteDaSessao } from "./cliente-auth";
import { tokenDoProfissional } from "./profissional-auth";
import { sessaoActivaDoProfissional } from "./sessao-activa-do-profissional";
import { contaDoClientePorEmail } from "./conversas-na-base";
import type { QuemPede } from "./conversas-da-clyon";

/**
 * QUEM ESTÁ A PEDIR UMA CONVERSA — 30-10-2026 («Conversas», fase 1).
 *
 * Primeiro o cliente (`clienteDaSessao`: o Bearer da app de cliente, ou o
 * cookie do site com a conta confirmada na base); senão o parceiro (a sessão
 * da app Pro ou do painel, confirmada na base por `sessaoActivaDoProfissional`).
 * Um Bearer que não é de cliente não cai para o cookie do browser, e um token
 * de cliente não passa por token de parceiro. Nada do corpo nem do endereço
 * diz quem é a pessoa.
 */
export async function quemPedeAConversa(req: NextRequest): Promise<QuemPede | null> {
  const cliente = await clienteDaSessao(req);
  if (cliente) {
    const contaId = await contaDoClientePorEmail(cliente.email);
    return contaId ? { papel: "cliente", contaId } : null;
  }
  const pro = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (pro && Number(pro.providerId) > 0) return { papel: "profissional", providerId: Number(pro.providerId) };
  return null;
}
