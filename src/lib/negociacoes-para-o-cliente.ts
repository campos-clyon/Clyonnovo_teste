/**
 * AS NEGOCIAÇÕES QUE SAEM PARA O CLIENTE — 26-10-2026 (decisão d33).
 *
 * «A área do cliente mostra só o que é para o cliente.» Há três portas por
 * onde as negociações de um pedido chegam ao browser dele — a primeira carga
 * da conta (`conta-server.ts`), a lista da conta (`/api/users/me/orders`) e o
 * link do email (`VistaDoPedido.tsx`) — e cada uma tinha a sua versão da
 * regra. A API escondia as de um Trabalho CLYON; a primeira carga da conta e o
 * link não. O que se esconde no ecrã mas viaja no HTML ou no JSON não está
 * escondido: está à vista de quem abrir as ferramentas do browser.
 *
 * A regra fica aqui, uma vez, e as três portas passam por ela:
 *
 *   · UM TRABALHO CLYON NÃO MOSTRA NEGOCIAÇÃO NENHUMA. O valor dela é o que a
 *     CLYON paga ao profissional, e não o preço que o cliente combinou com a
 *     CLYON. Ver `oferta-clyon.ts`. O mesmo para uma negociação que nasceu de
 *     uma oferta da CLYON (`ofertaClyon`), mesmo que o pedido tenha mudado de
 *     tipo depois.
 *
 *   · SÓ QUEM FEZ PROPOSTA — `oClienteVeEsta`. Os profissionais a quem o
 *     pedido foi parar e que não disseram nada não saem da base: o nome deles
 *     é informação nossa, e não do cliente.
 *
 *   · SEM A TAXA DO PROFISSIONAL. O que lhe é descontado — e, com ela, o que
 *     ele recebe e a parte da CLYON — não entra em conta nenhuma do lado do
 *     cliente: o preço dele faz-se só com a taxa do cliente
 *     (`precoDoCliente`).
 *
 *   · O TELEFONE DO PROFISSIONAL SÓ DEPOIS DE CONTRATADO.
 */
import { oClienteVeEsta, type Proposta } from "./negociacao";

/** O mínimo que a regra precisa de ler numa linha de `negociacoes`. */
export type LinhaParaOCliente = {
  estado: string;
  propostasJson?: unknown;
  ofertaClyon?: unknown;
  taxaProfissional?: unknown;
  profissionalTelefone?: string | null;
};

/** O que nunca sai de uma negociação para o lado do cliente. */
export const CAMPOS_QUE_NAO_SAEM = ["taxaProfissional", "ofertaClyon"] as const;

export type NegociacaoParaOCliente<T extends LinhaParaOCliente> = Omit<
  T,
  (typeof CAMPOS_QUE_NAO_SAEM)[number]
>;

/**
 * A marca de Trabalho CLYON do pedido: `(o.valorFixoClyon IS NOT NULL)` vem da
 * base como 1 ou 0; quem tem o pedido inteiro passa um booleano.
 */
export function eTrabalhoClyonDoPedido(marca: unknown): boolean {
  return marca === true || Number(marca) === 1;
}

function nasceuDeUmaOferta(v: unknown): boolean {
  return typeof v === "string" && v.trim() !== "";
}

function propostasDe(v: unknown): Proposta[] {
  if (Array.isArray(v)) return v as Proposta[];
  if (typeof v !== "string" || v.trim() === "") return [];
  try {
    const l = JSON.parse(v);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

export function negociacoesParaOCliente<T extends LinhaParaOCliente>(
  linhas: readonly T[] | null | undefined,
  trabalhoClyon: unknown,
): Array<NegociacaoParaOCliente<T>> {
  if (eTrabalhoClyonDoPedido(trabalhoClyon)) return [];

  return (linhas ?? [])
    .filter((n) => !nasceuDeUmaOferta(n.ofertaClyon))
    .filter((n) => oClienteVeEsta({ estado: String(n.estado), propostas: propostasDe(n.propostasJson) }))
    .map((n) => {
      const copia: Record<string, unknown> = { ...n };
      for (const campo of CAMPOS_QUE_NAO_SAEM) delete copia[campo];
      if ("profissionalTelefone" in copia) {
        copia.profissionalTelefone = n.estado === "acordada" ? (n.profissionalTelefone ?? null) : null;
      }
      return copia as NegociacaoParaOCliente<T>;
    });
}
