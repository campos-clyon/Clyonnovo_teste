/**
 * «VERIFICADO» SÓ NOS QUE TÊM AS TRÊS CONFIRMAÇÕES — 01-11-2026 (dono:
 * «Selo só nos que tiverem os 3»).
 *
 * Os Termos (§10) dizem ao cliente o que quer dizer: antes de aprovar, a
 * CLYON confirmou o NIF, a identidade e o contacto do parceiro. Até aqui o
 * site chamava «verificado» a toda a gente, e nada no sistema guardava essas
 * três coisas. Passam a ser três colunas em `providers`, cada uma com a data
 * e quem confirmou, marcadas no «Editar perfil» do backoffice (o
 * administrador ou a secção Profissionais). Desde 04-11-2026 (d10.2) aprovar
 * exige as três e outra pessoa — ver o fim do ficheiro.
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

/** O selo no cartão da lista dos parceiros das mudanças (10-11-2026): só com as três. */
export const SELO_DO_CARTAO = "Parceiro verificado";

/** Quem faz o trabalho, numa frase: com «verificado» só se o for. */
export function parceiroNaFrase(nome: string, verificado: boolean): string {
  return verificado ? `${nome}, parceiro verificado pela CLYON` : `${nome}, parceiro da CLYON`;
}

/*
 * ── APROVAR COM AS TRÊS CONFIRMAÇÕES E DOIS PARES DE OLHOS ─────────────────
 * 04-11-2026 (d10.2, decisão do CEO e do dono: «Confiança antes de crescer»).
 *
 * Até aqui uma só pessoa com a secção Profissionais confirmava, aprovava e
 * verificava a guia, e um parceiro aprovado sem as três confirmações recebia
 * pedidos (só não tinha o selo). Agora:
 *
 *   · APROVAR exige as três confirmações JÁ FEITAS — NIF, identidade, contacto;
 *   · quem CONFIRMA não APROVA: a assistente confirma; o ADMINISTRADOR aprova
 *     (e verifica a guia), e não pode ter feito nenhuma das três;
 *   · fica registado quem fez cada passo — as confirmações já guardavam quem e
 *     quando; a aprovação passa a guardar `aprovadoEm` e `aprovadoPor`.
 *
 * Quem já estava aprovado NÃO PERDE a aprovação: fica marcado «por verificar»
 * na lista do backoffice até ter as três (`porVerificar`). O selo do cliente
 * continua a ser só o das três (`estaVerificado`). Reactivar um suspenso é
 * aprovar de novo, e segue a regra.
 *
 * As frases e as perguntas vivem aqui para o ecrã e a rota dizerem o mesmo.
 */

export const SO_O_ADMINISTRADOR_APROVA =
  "Só o administrador aprova um parceiro. A assistente confirma o NIF, a identidade e o contacto; o administrador aprova.";
export const SO_O_ADMINISTRADOR_VERIFICA_A_GUIA = "Só o administrador verifica a guia de resíduos.";
export const QUEM_CONFIRMA_NAO_APROVA =
  "Quem confirmou o NIF, a identidade ou o contacto não pode aprovar: são dois pares de olhos. Peça a outra pessoa.";
export const QUEM_APROVOU_NAO_CONFIRMA =
  "Foi quem aprovou este parceiro: as confirmações são de outra pessoa (dois pares de olhos).";

/** A mesma pessoa? Pelo nome com que entrou no backoffice, sem maiúsculas nem espaços a mais. */
export function mesmaPessoa(a: unknown, b: unknown): boolean {
  const n = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").toLowerCase() : "");
  return n(a) !== "" && n(a) === n(b);
}

/** As confirmações que faltam, pelos rótulos («NIF», «Identidade», «Contacto»). */
export function confirmacoesEmFalta(l: Record<string, unknown> | null | undefined): string[] {
  return CONFIRMACOES.filter((c) => l?.[COLUNAS_DA_CONFIRMACAO[c].em] == null).map(
    (c) => COLUNAS_DA_CONFIRMACAO[c].rotulo,
  );
}

/**
 * Porque é que ESTA pessoa não pode aprovar ESTE parceiro agora — ou null se
 * pode. A rota recusa com esta frase; o ecrã mostra-a ao lado do botão.
 */
export function porqueNaoPodeAprovar(
  l: Record<string, unknown> | null | undefined,
  quem: { nome: string | null | undefined; papel: string | null | undefined },
): string | null {
  if (quem.papel !== "admin") return SO_O_ADMINISTRADOR_APROVA;
  const falta = confirmacoesEmFalta(l);
  if (falta.length > 0) {
    return `Para aprovar, faltam as confirmações: ${falta.join(", ")}. Quem as faz é a assistente, no «Editar perfil».`;
  }
  if (CONFIRMACOES.some((c) => mesmaPessoa(l?.[COLUNAS_DA_CONFIRMACAO[c].por], quem.nome))) {
    return QUEM_CONFIRMA_NAO_APROVA;
  }
  return null;
}

/** Porque é que ESTA pessoa não pode marcar uma confirmação — ou null se pode. */
export function porqueNaoPodeConfirmar(
  l: Record<string, unknown> | null | undefined,
  quem: { nome: string | null | undefined },
): string | null {
  return l?.estado === "aprovado" && mesmaPessoa(l?.aprovadoPor, quem.nome) ? QUEM_APROVOU_NAO_CONFIRMA : null;
}

/** Aprovado (recebe pedidos) e ainda sem as três: «por verificar» na lista do backoffice. */
export function porVerificar(l: Record<string, unknown> | null | undefined): boolean {
  return l?.estado === "aprovado" && !estaVerificado(l);
}
