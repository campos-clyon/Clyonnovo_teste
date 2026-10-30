import { pedir } from "./api";
import type { Morada } from "./novo-pedido";
import { apagarDoCofre, CHAVE_DA_MORADA, guardarNoCofre, lerDoCofre, lerToken } from "./sessao";

export { CHAVE_DA_MORADA };

/**
 * A MORADA DA BARRA DE CIMA (30-10-2026) — a que o cliente escolhe no Início.
 *
 * Com sessão, vai para a conta (`PATCH /api/users/me`, o campo `addressLine`,
 * o mesmo do Perfil) e fica também no cofre do telemóvel para aparecer logo.
 * Sem sessão, fica só no cofre (expo-secure-store). Apaga-se ao sair da conta
 * (`esquecerSessao`). O Pedir usa-a quando o rascunho ainda não tem morada.
 */
export const SEM_MORADA = "Escolher morada";

export function moradaValida(v: unknown): Morada | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Morada;
  return typeof m.formattedAddress === "string" && m.formattedAddress.trim() ? m : null;
}

export async function lerMoradaGuardada(): Promise<Morada | null> {
  const t = await lerDoCofre(CHAVE_DA_MORADA);
  if (!t) return null;
  try {
    return moradaValida(JSON.parse(t));
  } catch {
    return null;
  }
}

/** Lê a da conta (com sessão) e, se houver, deixa-a no cofre. */
export async function lerMoradaDaConta(): Promise<Morada | null> {
  if (!(await lerToken())) return lerMoradaGuardada();
  try {
    const r = await pedir<{ user?: { addressLine?: string | null } }>("/api/users/me");
    const linha = r.user?.addressLine?.trim();
    if (!linha) return lerMoradaGuardada();
    const guardada = await lerMoradaGuardada();
    if (guardada?.formattedAddress === linha) return guardada;
    const m: Morada = { formattedAddress: linha, aMao: true };
    await guardarNoCofre(CHAVE_DA_MORADA, JSON.stringify(m)).catch(() => undefined);
    return m;
  } catch {
    return lerMoradaGuardada();
  }
}

export async function guardarMorada(m: Morada, comSessao: boolean): Promise<void> {
  await guardarNoCofre(CHAVE_DA_MORADA, JSON.stringify(m)).catch(() => undefined);
  if (comSessao) await pedir("/api/users/me", { metodo: "PATCH", corpo: { addressLine: m.formattedAddress } });
}

export const esquecerMorada = () => apagarDoCofre(CHAVE_DA_MORADA);
