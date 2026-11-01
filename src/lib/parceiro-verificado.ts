/**
 * «VERIFICADO» SÓ NOS QUE TÊM AS TRÊS CONFIRMAÇÕES — 01-11-2026 (dono:
 * «Selo só nos que tiverem os 3»).
 *
 * Os Termos (§10) dizem ao cliente o que quer dizer: antes de aprovar, a
 * CLYON confirmou o NIF, a identidade e o contacto do parceiro. Até aqui o
 * site chamava «verificado» a toda a gente, e nada no sistema guardava essas
 * três coisas. Passam a ser três colunas em `providers`, cada uma com a data
 * e quem confirmou, marcadas no «Editar perfil» do backoffice (o
 * administrador ou a secção Profissionais). Aprovar continua como era.
 *
 * O cliente só lê «verificado» junto de um parceiro com as três — o selo
 * nas propostas, no perfil público, no link do pedido, na /conta e na app de
 * cliente vem do campo `verificado` que a API calcula com `SQL_DO_VERIFICADO`.
 * As frases que falavam de «parceiros verificados» como garantia de todos
 * passaram a «parceiros». A regra q da orquestra guarda isto.
 *
 * Mudar o NIF tira a confirmação do NIF; mudar o telefone ou o email tira a
 * do contacto (`actualizarPerfilDoProfissional`, `mudarEmailDoProfissional`).
 */

export const CONFIRMACOES = ["nif", "identidade", "contacto"] as const;
export type Confirmacao = (typeof CONFIRMACOES)[number];

export const COLUNAS_DA_CONFIRMACAO: Record<Confirmacao, { em: string; por: string; rotulo: string }> = {
  nif: { em: "nifConfirmadoEm", por: "nifConfirmadoPor", rotulo: "NIF" },
  identidade: { em: "identidadeConfirmadaEm", por: "identidadeConfirmadaPor", rotulo: "Identidade" },
  contacto: { em: "contactoConfirmadoEm", por: "contactoConfirmadoPor", rotulo: "Contacto" },
};

/** As três, numa expressão SQL (1 ou 0), para as consultas que levam o parceiro ao cliente. */
export function sqlDoVerificado(alias = "p"): string {
  return `(${CONFIRMACOES.map((c) => `${alias}.${COLUNAS_DA_CONFIRMACAO[c].em} IS NOT NULL`).join(" AND ")})`;
}
export const SQL_DO_VERIFICADO = sqlDoVerificado("p");

/** O que vem da base (1, "1", true, ou as três datas) → verdadeiro só com as três. */
export function estaVerificado(l: Record<string, unknown> | null | undefined): boolean {
  if (!l) return false;
  if ("parceiroVerificado" in l) return Number(l.parceiroVerificado) === 1 || l.parceiroVerificado === true;
  return CONFIRMACOES.every((c) => l[COLUNAS_DA_CONFIRMACAO[c].em] != null);
}

/** O selo, como o cliente o lê. */
export const SELO_DO_VERIFICADO = "verificado pela CLYON";

/** Quem faz o trabalho, numa frase: com «verificado» só se o for. */
export function parceiroNaFrase(nome: string, verificado: boolean): string {
  return verificado ? `${nome}, parceiro verificado pela CLYON` : `${nome}, parceiro da CLYON`;
}
