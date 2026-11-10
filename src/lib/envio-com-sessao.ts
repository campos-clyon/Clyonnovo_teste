import { verifyColaboradorAuthHeader } from "./colaborador-auth";
import { clienteDaSessao } from "./cliente-auth";

/**
 * QUEM ENVIA TEM SESSÃO? — d24, 10-11-2026.
 *
 * Para o envio directo (`/api/blob/token`, `/api/blob/presign`) decidir os
 * tectos: com sessão, os de sempre; sem ela, os de `TAMANHO_MAXIMO_SEM_SESSAO`.
 *
 *   · a equipa — o token do backoffice no `Authorization` (o `enviarFicheiro`
 *     manda-o quando o ecrã o tem);
 *   · o cliente — a sessão do site (cookie) ou a da app (Bearer).
 *
 * Uma falha a ler a sessão conta como sem sessão: os tectos mais baixos, e o
 * envio segue na mesma para fotografias e vídeos curtos.
 */
export async function envioComSessao(req: { headers: { get: (nome: string) => string | null } }): Promise<boolean> {
  const autorizacao = req.headers.get("authorization");
  if (autorizacao) {
    try {
      if (await verifyColaboradorAuthHeader(autorizacao)) return true;
    } catch {
      /* não é da equipa: segue para o cliente */
    }
  }
  try {
    return (await clienteDaSessao(req)) !== null;
  } catch {
    return false;
  }
}
