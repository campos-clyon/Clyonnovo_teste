/**
 * O CLIENTE E O PARCEIRO SÃO A MESMA PESSOA? — 04-11-2026 (d10.3).
 *
 * A porta mais barata para fabricar uma reputação é o parceiro pedir um
 * trabalho a si próprio e dar-se as estrelas. As estrelas públicas já só
 * contam com o contacto do cliente verificado e diferente
 * (`avaliacao-que-conta.ts`); isto é o alerta para a equipa ver na Mesa,
 * antes de fechar: o cliente e o parceiro partilham o telefone, o email ou a
 * morada.
 *
 * Puro, sem importações: lê-o a rota da Mesa e os testes.
 */

export type Coincidencia = "telefone" | "email" | "morada";

/** Os últimos nove dígitos — o número português, venha com +351, espaços ou não. */
export function noveDigitos(telefone: unknown): string | null {
  if (typeof telefone !== "string") return null;
  const d = telefone.replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : null;
}

/** O email em minúsculas e sem o «+etiqueta» (nome+qualquer@ é a mesma caixa). */
export function emailNormalizado(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  const arroba = e.indexOf("@");
  if (arroba < 1) return null;
  const local = e.slice(0, arroba).split("+")[0];
  return local ? `${local}${e.slice(arroba)}` : null;
}

/** A morada sem acentos, pontuação nem maiúsculas: «R. das Flores, 12 – 2.º» → «r das flores 12 2». */
export function moradaNormalizada(morada: unknown): string | null {
  if (typeof morada !== "string") return null;
  const m = morada
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return m || null;
}

/**
 * Duas moradas são a mesma? Iguais depois de normalizadas, ou uma dentro da
 * outra (a do pedido traz muitas vezes o código postal e o país a mais). Só
 * com um número de porta e com corpo: «Seixal» dentro de «Rua X, Seixal» não é
 * a mesma casa.
 */
export function mesmaMorada(a: unknown, b: unknown): boolean {
  const x = moradaNormalizada(a);
  const y = moradaNormalizada(b);
  if (!x || !y) return false;
  const [curta, longa] = x.length <= y.length ? [x, y] : [y, x];
  if (curta.length < 10 || !/\d/.test(curta)) return false;
  return longa === curta || ` ${longa} `.includes(` ${curta} `);
}

/** O que o cliente do pedido e o parceiro têm em comum. */
export function coincidenciasEntre(
  cliente: { telefone?: unknown; email?: unknown; morada?: unknown },
  parceiro: { telefone?: unknown; email?: unknown; moradas?: unknown[] },
): Coincidencia[] {
  const out: Coincidencia[] = [];
  const tc = noveDigitos(cliente.telefone);
  if (tc && tc === noveDigitos(parceiro.telefone)) out.push("telefone");
  const ec = emailNormalizado(cliente.email);
  if (ec && ec === emailNormalizado(parceiro.email)) out.push("email");
  if ((parceiro.moradas ?? []).some((m) => mesmaMorada(cliente.morada, m))) out.push("morada");
  return out;
}

const PALAVRA: Record<Coincidencia, string> = { telefone: "o telefone", email: "o email", morada: "a morada" };

/** «O cliente e o parceiro partilham o telefone e o email.» — ou null sem nada. */
export function avisoDasCoincidencias(c: readonly Coincidencia[] | null | undefined): string | null {
  if (!c || c.length === 0) return null;
  const partes = c.map((x) => PALAVRA[x]);
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
  return `O cliente e o parceiro partilham ${lista}. Confirme quem é o cliente antes de fechar.`;
}
