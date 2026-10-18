import { caminhoDoLink } from "../lib/destino";

/**
 * Os links de clyon.pt/profissionais/… que abrem a app (WhatsApp, email, SMS)
 * chegam aqui antes de qualquer ecrã. As páginas do site não existem na app,
 * por isso traduzem-se para a lista de trabalhos. Nunca lança.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return caminhoDoLink(path);
}
