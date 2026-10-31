/**
 * DE ONDE VEM CADA AVALIAÇÃO — d6, 31-10-2026.
 *
 * Até aqui, as estrelas dadas pela equipa «em nome do cliente» (na Mesa e nos
 * Trabalhos CLYON) gravavam-se na mesma coluna que as do cliente, sem marca, e
 * qualquer assistente as podia dar. Saíam no perfil público e nas estrelas do
 * Google como se fossem de clientes — e as regras do Google não o aceitam.
 *
 * Agora cada avaliação nova guarda:
 *
 *   · `avaliacaoOrigem` — «cliente» (deu-a ele, na app, no link ou na conta)
 *     ou «equipa» (registada pela CLYON a pedido dele);
 *   · `avaliadoPor` — quem a gravou («cliente», ou o nome de quem está na
 *     equipa);
 *   · `avaliacaoComoDisse` — nas da equipa, como é que o cliente a deu
 *     («por telefone, a 31/10»). Obrigatório: sem isso não se grava.
 *
 * Só o ADMINISTRADOR grava em nome do cliente. As da equipa mostram-se com a
 * etiqueta «Registada pela CLYON a pedido do cliente» e ficam fora das
 * estrelas dos dados estruturados. E a nota do cliente substitui a da equipa:
 * quando ele próprio avalia, é a dele que fica.
 */

export type OrigemDaAvaliacao = "cliente" | "equipa";

/** A etiqueta, no perfil público, na app e no link do pedido. */
export const REGISTADA_PELA_CLYON = "Registada pela CLYON a pedido do cliente";

export const SO_O_ADMINISTRADOR = "Só o administrador pode registar uma avaliação em nome do cliente.";

export const COMO_O_CLIENTE_O_DISSE = {
  minimo: 5,
  maximo: 300,
  pergunta: "Como é que o cliente lhe deu esta nota?",
  exemplo: "Por telefone, a 31/10, depois de confirmar o trabalho",
  emFalta: "Diga como é que o cliente lhe deu esta nota (por exemplo: por telefone, a 31/10).",
} as const;

/** «Como é que o cliente o disse» — 5 a 300 caracteres, ou o erro. */
export function lerComoOClienteODisse(v: unknown): { ok: true; texto: string } | { ok: false; erro: string } {
  const t = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (t.length < COMO_O_CLIENTE_O_DISSE.minimo) return { ok: false, erro: COMO_O_CLIENTE_O_DISSE.emFalta };
  return { ok: true, texto: t.slice(0, COMO_O_CLIENTE_O_DISSE.maximo) };
}

/**
 * Uma avaliação é DA EQUIPA? Em SQL, para a linha `n` de `negociacoes`.
 *
 * As novas dizem-no na coluna. As de antes de 31-10-2026 (coluna vazia)
 * contam como da equipa quando o trabalho nasceu de uma oferta da CLYON (o
 * cliente de um Trabalho CLYON não tinha onde dar estrelas: foi sempre a
 * equipa) ou quando o registo permanente guarda que foi a CLYON ou uma
 * assistente a gravá-la (a Mesa, em nome de um cliente sem email).
 */
export const SQL_DA_EQUIPA = (n = "n") =>
  `(${n}.avaliacaoOrigem = 'equipa' OR (${n}.avaliacaoOrigem IS NULL AND (${n}.ofertaClyon IS NOT NULL OR EXISTS (` +
  `SELECT 1 FROM registoPermanente ra WHERE ra.negociacaoId = ${n}.id AND ra.acontecimento = 'avaliacao_feita' ` +
  `AND ra.autorTipo IN ('clyon', 'assistente')))))`;

/** Lê o 0/1 que a base devolve para `SQL_DA_EQUIPA`. */
export const eDaEquipa = (v: unknown) => v === true || Number(v) === 1;
