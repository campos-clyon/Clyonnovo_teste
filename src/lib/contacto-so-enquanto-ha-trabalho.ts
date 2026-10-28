import type { FaseDoTrabalho } from "./trabalho";

/**
 * O CONTACTO DO CLIENTE SÓ ENQUANTO HÁ TRABALHO — 28-10-2026 (decisão d3).
 *
 * A regra é de 16-09-2026: o nome, o telefone e a morada do cliente são para
 * FAZER o trabalho. Confirmado ou pago, saem. Só os ecrãs a cumpriam (o painel
 * e a app CLYON Pro escondiam-nos); a API continuava a mandá-los, porque
 * `vistaParaOEstado` decide pelo estado da negociação, e esse fica «acordada»
 * depois de pago. A app guarda a lista no telemóvel para usar sem rede, e com
 * ela ia o contacto de todos os clientes que o profissional já serviu.
 *
 * Agora a regra está no servidor, depois de `vistaParaOEstado`: confirmado,
 * pago, arquivado ou morto, estes campos vão a `null`. É `null` e não `""`
 * porque é assim que a API sempre os mandou antes da contratação: o painel
 * (`tipos.ts`) e a app (`app-pro/src/lib/trabalhos.ts`) declaram-nos
 * `string | null` e lêem-nos com `?.`, `??` e `&&` — um `""` trocava o
 * `morada ?? city` da agenda por uma linha vazia.
 *
 * Enquanto o trabalho está por fazer ou à espera de confirmação, ficam: o
 * profissional ainda pode ter de ligar ao cliente.
 */

/** Os campos do contacto do cliente na resposta de /api/profissionais/meus-pedidos. */
export const CAMPOS_DO_CONTACTO_DO_CLIENTE = ["contactoNome", "contactoTelefone", "morada", "moradaDestino"] as const;

type CampoDoContacto = (typeof CAMPOS_DO_CONTACTO_DO_CLIENTE)[number];

export type TrabalhoComContacto = {
  estado: string;
  fase: FaseDoTrabalho;
  arquivadoEm?: unknown;
} & Record<CampoDoContacto, string | null>;

/** O contacto já não serve: confirmado, pago, arquivado pelo profissional, ou a negociação morreu. */
export function contactoJaNaoServe(t: { estado: string; fase: FaseDoTrabalho; arquivadoEm?: unknown }): boolean {
  if (t.estado !== "acordada") return true; // morta, desistida — ou nunca chegou a trabalho
  if (t.fase === "confirmado" || t.fase === "pago") return true;
  return t.arquivadoEm != null && t.arquivadoEm !== "";
}

/** O trabalho como sai para o profissional: sem o contacto do cliente quando já não serve. */
export function semContactoDepoisDoFim<T extends TrabalhoComContacto>(t: T): T {
  if (!contactoJaNaoServe(t)) return t;
  return { ...t, contactoNome: null, contactoTelefone: null, morada: null, moradaDestino: null };
}
