/**
 * O SEGUIMENTO DA APP DE CLIENTE — 17-11-2026 (d59, ordem do CEO aprovada
 * pelo dono): «porque ninguém adere à app de cliente».
 *
 *   · um inscrito parado mais de 24 h em «inscrito» acende o aviso;
 *   · a lista para a Play só leva emails que a Play reconhece (Gmail); uma
 *     conta com outro email fica «falta o Gmail do telemóvel»;
 *   · um lembrete único, 3 dias depois do convite, a quem ainda não aderiu.
 *
 * «ADERIU» — a Play não diz quem se tornou testador. Conta como aderiu:
 *   1. a app de cliente registou o telemóvel dessa conta para avisos
 *      (`pushSubscriptions` com `app = 'cliente'`) — o único sinal automático;
 *   2. ou a equipa marcou «Já instalou» no Programa da app.
 *
 * ESTE FICHEIRO É PURO. A base está em `seguimento-da-app-na-base.ts`; os
 * textos novos (do Marketing, por aprovar) em `textos-do-seguimento-da-app.ts`.
 */

import { escaparHtml } from "./escapar-html";

/** Os domínios de email que a Play aceita de certeza como conta Google. */
export const DOMINIOS_QUE_A_PLAY_RECONHECE = ["gmail.com", "googlemail.com"] as const;

/** O email limpo, ou `null` se não for um email. */
function limpo(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/.test(e) ? e : null;
}

/** É um Gmail — o que a lista de testadores da Play reconhece. */
export function eGmail(email: unknown): boolean {
  const e = limpo(email);
  if (!e) return false;
  const dominio = e.slice(e.lastIndexOf("@") + 1);
  return (DOMINIOS_QUE_A_PLAY_RECONHECE as readonly string[]).includes(dominio);
}

/* ─── 1. Os inscritos parados ───────────────────────────────────────────── */

export const HORAS_ATE_UM_INSCRITO_FICAR_PARADO = 24;

/** Um `inscrito` há mais de 24 h ainda por pôr na Play. */
export function inscritoParado(
  l: { estado: string; consentimentoEm: Date | null },
  agora: Date,
): boolean {
  if (l.estado !== "inscrito" || !l.consentimentoEm) return false;
  return agora.getTime() - l.consentimentoEm.getTime() > HORAS_ATE_UM_INSCRITO_FICAR_PARADO * 3600_000;
}

/* ─── 2. A lista para a Play ────────────────────────────────────────────── */

export type ListaParaAPlay = {
  /** Os emails, sem repetidos, pela ordem: inscritos do programa, depois contas novas. */
  emails: string[];
  /** Quantos vêm do programa (inscritos por adicionar). */
  deInscritos: number;
  /** Quantos são contas novas, ainda sem convite. */
  deContas: number;
  /** Contas novas sem Gmail: não vão para a Play — falta o Gmail do telemóvel. */
  faltaGmail: number;
};

/**
 * A lista que se cola na Play Console.
 *
 * `inscritos` — os `inscrito` do programa: o email que escreveram é o da
 * conta Google do telemóvel (o formulário pede-o assim), e vai como está.
 * `contas` — as contas de cliente ainda sem convite e fora do programa: só
 * vão as que têm Gmail; as outras contam em `faltaGmail`.
 */
export function listaParaAPlay(
  inscritos: Array<{ email: string; estado: string }>,
  contas: Array<{ email: string }>,
): ListaParaAPlay {
  const vistos = new Set<string>();
  let deInscritos = 0;
  let deContas = 0;
  let faltaGmail = 0;
  for (const l of inscritos) {
    if (l.estado !== "inscrito") continue;
    const e = limpo(l.email);
    if (!e || vistos.has(e)) continue;
    vistos.add(e);
    deInscritos++;
  }
  for (const c of contas) {
    const e = limpo(c.email);
    if (!e || vistos.has(e)) continue;
    if (!eGmail(e)) {
      faltaGmail++;
      continue;
    }
    vistos.add(e);
    deContas++;
  }
  return { emails: [...vistos], deInscritos, deContas, faltaGmail };
}

/* ─── 3. O lembrete ─────────────────────────────────────────────────────── */

export const DIAS_ATE_AO_LEMBRETE = 3;

export type ComoAderiu = "avisos-da-app" | "marcado" | null;

/** Quem recebe o lembrete: convidado há 3 dias ou mais, sem ter aderido, e uma vez só. */
export function precisaDoLembrete(
  p: { convidadoEm: Date | null; aderiu: ComoAderiu; lembreteEm: Date | null },
  agora: Date,
): boolean {
  if (!p.convidadoEm || p.aderiu || p.lembreteEm) return false;
  return agora.getTime() - p.convidadoEm.getTime() >= DIAS_ATE_AO_LEMBRETE * 86_400_000;
}

/** Quando sai o lembrete (para o painel mostrar). */
export function quandoSaiOLembrete(convidadoEm: Date): Date {
  return new Date(convidadoEm.getTime() + DIAS_ATE_AO_LEMBRETE * 86_400_000);
}

/* ─── Os textos do Marketing: trocar as marcas e fazer o HTML ───────────── */

/**
 * Troca `{Nome}`, `{linkDeAdesao}`, `{linkDaPlayStore}`, `{linkDaConta}`; uma
 * marca de link sem valor fica vazia. Sem nome, «{Nome}» sai com a vírgula
 * antes: «Olá, {Nome}!» → «Olá!», «Olá, {Nome}, é a Vitória» → «Olá, é a Vitória».
 */
export function preencherTexto(texto: string, valores: Record<string, string>): string {
  const nome = (valores.Nome ?? "").trim();
  const comNome = nome ? texto.replace(/\{Nome\}/g, nome) : texto.replace(/,? ?\{Nome\}/g, "");
  return comNome.replace(/\{(linkDeAdesao|linkDaPlayStore|linkDaConta)\}/g, (_, k: string) => valores[k] ?? "");
}

/** Os links https dentro de um texto já escapado ficam clicáveis. */
function ligarOsLinks(escapado: string): string {
  return escapado.replace(
    /https:\/\/[^\s<>"]+[^\s<>".,;:!?)»]/g,
    (u) => `<a href="${u}" style="color:#0891b2;word-break:break-all;">${u}</a>`,
  );
}

/** O HTML de um texto simples, no estilo dos outros emails da CLYON. */
export function htmlDeTextoSimples(texto: string): string {
  const paragrafos = texto
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      if (/^https:\/\/\S+$/.test(p)) {
        const href = escaparHtml(p);
        return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;"><a href="${href}" style="color:#0891b2;word-break:break-all;">${href}</a></p>`;
      }
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">${ligarOsLinks(escaparHtml(p)).replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n          ");
  return `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#00B4CC;padding:20px 24px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">CLYON</span>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          ${paragrafos}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
