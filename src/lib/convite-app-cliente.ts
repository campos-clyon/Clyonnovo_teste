/**
 * O CONVITE PARA TESTAR A APP DE CLIENTE — 01-11-2026 (ordem do CEO, aprovada
 * pelo dono).
 *
 * As contas de cliente activas recebem um email a convidá-las para o teste
 * fechado da app CLYON na Google Play. O texto foi aprovado À LETRA pelo dono:
 * não se reescreve aqui sem nova aprovação.
 *
 * Este ficheiro é puro (sem base nem Resend): serve o painel, que mostra a
 * pré-visualização, e a rota, que envia. O envio está em
 * `convite-app-cliente-envio.ts`, o registo em `convite-app-cliente-na-base.ts`.
 */

import { escaparHtml } from "./escapar-html";

/** A chave do link de adesão em `plataformaConfiguracoes`. */
export const CHAVE_DO_LINK_DE_ADESAO = "linkDeAdesaoDaAppDeCliente";

/** O link do teste da app de cliente, para sugerir no campo. */
export const LINK_DE_ADESAO_SUGERIDO = "https://play.google.com/apps/testing/pt.clyon.cliente";

export const ASSUNTO_DO_CONVITE = "Convite: experimente primeiro a app CLYON";

/**
 * Entre um envio e o seguinte. O Resend aceita poucos pedidos por segundo por
 * chave; um a cada 600 ms fica abaixo do limite com folga, e os emails de
 * entrada do site (a mesma chave) continuam a sair entretanto.
 */
export const INTERVALO_ENTRE_ENVIOS_MS = 600;

/** Quantos emails por chamada à rota: cada chamada acaba em ~10 s, longe do limite da função. */
export const ENVIOS_POR_LOTE = 10;

/**
 * O link de adesão tem de ser da Google Play e em https. Devolve o link limpo,
 * ou `null` se não servir — um email com um link errado não se desfaz.
 */
export function linkDeAdesaoValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  if (limpo.length === 0 || limpo.length > 500) return null;
  let url: URL;
  try {
    url = new URL(limpo);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "play.google.com") return null;
  return url.toString();
}

/** O primeiro nome, com a primeira letra em maiúscula; `null` se não houver nome que sirva. */
export function primeiroNome(nome: unknown): string | null {
  if (typeof nome !== "string") return null;
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";
  // Um «nome» que é um email ou só números não é um nome.
  if (primeiro.length < 2 || primeiro.includes("@") || !/\p{L}/u.test(primeiro)) return null;
  return primeiro.charAt(0).toLocaleUpperCase("pt-PT") + primeiro.slice(1);
}

/** «Olá, Ana.» ou, sem nome, «Olá,» — como o dono escreveu. */
export function saudacao(nome: unknown): string {
  const p = primeiroNome(nome);
  return p ? `Olá, ${p}.` : "Olá,";
}

/** Os parágrafos do corpo, aprovados à letra (01-11-2026). */
export function paragrafosDoConvite(link: string): {
  abertura: string;
  passo1: string;
  passo2: string;
  fecho: string;
  saida: string;
  assinatura: string;
} {
  return {
    abertura:
      "Como já tem conta na CLYON, convidamo-lo a experimentar a nossa app antes de toda a gente. Pode pedir, acompanhar e pagar os seus pedidos no telemóvel, e falar com o parceiro.",
    passo1: `1. Abra este link no telemóvel Android, com a mesma conta Google: ${link}`,
    passo2: "2. Carregue em «Tornar-me testador» e instale a app na Play Store.",
    fecho: "Fique com a app pelo menos 14 dias. A sua opinião ajuda-nos a melhorar.",
    saida: "Se não quiser participar, basta ignorar este email; não voltamos a escrever sobre isto.",
    assinatura: "Equipa CLYON",
  };
}

/** A versão em texto simples — também a que o painel mostra na pré-visualização. */
export function textoDoConvite(params: { nome: unknown; link: string }): string {
  const p = paragrafosDoConvite(params.link);
  return [
    saudacao(params.nome),
    "",
    p.abertura,
    "",
    p.passo1,
    p.passo2,
    "",
    p.fecho,
    "",
    p.saida,
    "",
    p.assinatura,
  ].join("\n");
}

/** O HTML, no estilo dos outros emails da CLYON: o link como botão e também escrito. */
export function htmlDoConvite(params: { nome: unknown; link: string }): string {
  const p = paragrafosDoConvite(params.link);
  const link = escaparHtml(params.link);
  const ola = escaparHtml(saudacao(params.nome));
  const par = (t: string) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">${t}</p>`;

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
          ${par(`<strong style="color:#0B1929;">${ola}</strong>`)}
          ${par(escaparHtml(p.abertura))}
          ${par("1. Abra este link no telemóvel Android, com a mesma conta Google:")}

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
            <tr><td style="border-radius:12px;background:#00B4CC;">
              <a href="${link}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">
                Abrir o link de adesão
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#64748b;text-align:center;word-break:break-all;">
            <a href="${link}" style="color:#0891b2;">${link}</a>
          </p>

          ${par(escaparHtml(p.passo2))}
          ${par(escaparHtml(p.fecho))}
          <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#94a3b8;">${escaparHtml(p.saida)}</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#0B1929;font-weight:600;">${escaparHtml(p.assinatura)}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Uma conta como vem da tabela `users`, só com o que a escolha precisa. */
export type ContaParaConvidar = {
  id: number;
  name: string | null;
  email: string | null;
  role: string | null;
  deletedAt: unknown;
};

export type MotivoDeFora =
  | "desactivada"
  | "nao-e-cliente"
  | "sem-email"
  | "profissional"
  | "de-teste"
  | "email-repetido";

/** Um nome ou email com «teste»/«test» como palavra é de teste. */
const PARECE_DE_TESTE = /(^|[^\p{L}])tes?te([^\p{L}]|$)/iu;

function normalizarEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/**
 * Quem recebe o convite: contas de cliente activas, sem desactivadas, sem
 * contas de teste, sem administradores nem profissionais. Uma pessoa com duas
 * contas no mesmo email recebe um só.
 *
 * `emailsDeProfissionais` — os emails da tabela `providers`;
 * `emailsDeTeste` — os da lista de teste (`EUPAGO_EMAILS_DE_TESTE`).
 */
export function escolherDestinatarios(
  contas: ContaParaConvidar[],
  emailsDeProfissionais: Iterable<string>,
  emailsDeTeste: Iterable<string>,
): {
  destinatarios: Array<{ id: number; nome: string | null; email: string }>;
  deFora: Record<MotivoDeFora, number>;
} {
  const profissionais = new Set([...emailsDeProfissionais].map((e) => e.trim().toLowerCase()));
  const teste = new Set([...emailsDeTeste].map((e) => e.trim().toLowerCase()));
  const vistos = new Set<string>();
  const deFora: Record<MotivoDeFora, number> = {
    desactivada: 0,
    "nao-e-cliente": 0,
    "sem-email": 0,
    profissional: 0,
    "de-teste": 0,
    "email-repetido": 0,
  };
  const destinatarios: Array<{ id: number; nome: string | null; email: string }> = [];

  for (const c of contas) {
    if (c.deletedAt) { deFora.desactivada++; continue; }
    if ((c.role ?? "user") !== "user") { deFora["nao-e-cliente"]++; continue; }
    const email = normalizarEmail(c.email);
    if (!email) { deFora["sem-email"]++; continue; }
    if (profissionais.has(email)) { deFora.profissional++; continue; }
    if (teste.has(email) || PARECE_DE_TESTE.test(email.split("@")[0]) || PARECE_DE_TESTE.test(c.name ?? "")) {
      deFora["de-teste"]++;
      continue;
    }
    if (vistos.has(email)) { deFora["email-repetido"]++; continue; }
    vistos.add(email);
    destinatarios.push({ id: Number(c.id), nome: c.name ?? null, email });
  }
  return { destinatarios, deFora };
}

/** A lista para a Play Console: só os emails, um por linha, sem cabeçalho. */
export function csvParaAPlay(emails: string[]): string {
  return emails.map((e) => e.replace(/[\r\n,"]/g, "")).join("\r\n") + (emails.length ? "\r\n" : "");
}
