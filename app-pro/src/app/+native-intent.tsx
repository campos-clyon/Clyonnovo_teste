import { caminhoDoLink, precisaDeSessao } from "../lib/destino";
import { guardarDestino } from "../lib/destino-pendente";
import { lerToken } from "../lib/sessao";

/**
 * Os links de clyon.pt/profissionais/… que abrem a app (WhatsApp, email, SMS)
 * chegam aqui antes de qualquer ecrã. As páginas do site não existem na app,
 * por isso traduzem-se para os ecrãs dela (`caminhoDoLink`). Nunca lança.
 *
 * SEM SESSÃO (29-10-2026, A12): o ecrã pedido está fechado até ele entrar; o
 * caminho fica guardado e abre-se logo a seguir a entrar (`Navegacao`, em
 * `_layout.tsx`). Com sessão, o caminho abre já, e não se guarda nada.
 */
export async function redirectSystemPath({ path }: { path: string; initial: boolean }): Promise<string> {
  const caminho = caminhoDoLink(path);
  try {
    if (precisaDeSessao(caminho) && !(await lerToken())) guardarDestino(caminho);
  } catch {
    /* sem cofre legível: o link abre a lista, como antes */
  }
  return caminho;
}
