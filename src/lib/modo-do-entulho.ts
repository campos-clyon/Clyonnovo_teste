/**
 * COMO SE CONTA O ENTULHO — 03-11-2026. *«Pergunta 2 vezes se o entulho está em
 * sacos.»* — o dono, a testar a app de cliente: «Como está o entulho? Já está
 * em sacos» e logo a seguir «Quanto é? Em sacos».
 *
 * Já em sacos (todo ou em parte), conta-se em sacos e não se pergunta outra
 * vez; no chão (ou «Não sei»), pergunta-se como se conta. Só isto: sem números
 * (as contas dos sacos estão em `sacos-de-entulho.ts`, que a app não lê), para
 * a app de cliente e a R12 decidirem igual.
 */

/** Os estados do entulho em que ele já está (todo ou em parte) em sacos. */
export const eEntulhoEmSacos = (estado: string | null | undefined): boolean => estado === "ensacado" || estado === "misto";

/** Em sacos, por volume, sem certeza — ou `null` enquanto não se disse. */
export function modoDoEntulho(estado: string | null | undefined, modo: string | null | undefined): "sacos" | "volume" | "incerto" | null {
  if (eEntulhoEmSacos(estado)) return "sacos";
  return modo === "sacos" || modo === "volume" || modo === "incerto" ? modo : null;
}
