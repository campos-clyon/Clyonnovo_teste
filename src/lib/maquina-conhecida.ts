import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A MÁQUINA QUE JÁ ENTROU — d2 (CEO e dono, 23-11-2026).
 *
 * O travão total da entrada por código (100 erros em 15 min, de toda a gente)
 * deixava qualquer pessoa trancar a equipa com erradas. Agora conta só as
 * tentativas ERRADAS, e deixa passar a máquina que já entrou com êxito nos
 * últimos 30 dias: um cookie assinado (HMAC com o segredo das sessões),
 * posto no navegador no momento da entrada e verificado antes do travão.
 * Não identifica ninguém — só diz «este navegador já entrou».
 *
 * PURO (usa só o `crypto` do Node): a rota passa o segredo e o relógio.
 */

export const COOKIE_DA_MAQUINA = "clyon_maquina";
export const DIAS_DA_MAQUINA_CONHECIDA = 30;
const SEGUNDOS = DIAS_DA_MAQUINA_CONHECIDA * 24 * 3600;

function assinatura(expira: number, segredo: string): string {
  return createHmac("sha256", `maquina:${segredo}`).update(String(expira)).digest("hex");
}

/** O valor do cookie: «<expira em segundos>.<assinatura>». */
export function valorDaMaquina(segredo: string, agora: Date = new Date()): string {
  const expira = Math.floor(agora.getTime() / 1000) + SEGUNDOS;
  return `${expira}.${assinatura(expira, segredo)}`;
}

/** O cookie é nosso e ainda não expirou? */
export function maquinaConhecida(valor: string | null | undefined, segredo: string | undefined, agora: Date = new Date()): boolean {
  if (!valor || !segredo) return false;
  const [expiraTexto, assina] = valor.split(".");
  const expira = Number(expiraTexto);
  if (!Number.isFinite(expira) || !assina) return false;
  if (expira * 1000 <= agora.getTime()) return false;
  const certa = Buffer.from(assinatura(expira, segredo));
  const dada = Buffer.from(assina);
  return certa.length === dada.length && timingSafeEqual(certa, dada);
}

export const SEGUNDOS_DA_MAQUINA_CONHECIDA = SEGUNDOS;
