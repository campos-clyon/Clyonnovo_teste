/**
 * OS EMAILS SOBRE A APP DE CLIENTE — 24-11-2026 (d106, textos v3 da d107
 * aprovados à letra pelo dono).
 *
 * Um só molde para o convite, o lembrete, o «Já pode instalar» e o convite
 * aos profissionais, equipa e conhecidos: parágrafos, uma lista, botões, a
 * assinatura e, em letra pequena no fim, «Não quero receber mensagens sobre
 * a app» ({LINK_RECUSA}). Os textos estão em `textos-do-seguimento-da-app.ts`
 * (o ponto único onde se trocam); aqui só se monta o texto simples e o HTML.
 *
 * Sem píxel de abertura nem seguimento de cliques: o HTML não leva imagens
 * nem links reescritos, e os links são os nossos.
 *
 * Puro, sem base.
 */

import { escaparHtml } from "./escapar-html";

/** «Olá, Ana.» ou, sem nome, «Olá,» — a mesma regra de `saudacao` (convite-app-cliente.ts), aqui para não haver import circular. */
function saudacao(nome: unknown): string {
  if (typeof nome !== "string") return "Olá,";
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";
  if (primeiro.length < 2 || primeiro.includes("@") || !/\p{L}/u.test(primeiro)) return "Olá,";
  return `Olá, ${primeiro.charAt(0).toLocaleUpperCase("pt-PT") + primeiro.slice(1).toLocaleLowerCase("pt-PT")}.`;
}

/** Os destinos dos botões: a ligação da pessoa, as três respostas do lembrete e a recusa. */
export type DestinoDoBotao = "link" | "r1" | "r2" | "r3" | "recusa";

export type BlocoDoEmail =
  | string
  | { lista: string[]; numerada?: boolean }
  | { botao: string; destino: DestinoDoBotao };

export type ModeloDeEmailDaApp = {
  assunto: string;
  preCabecalho?: string;
  /** «Olá, Ana.» num parágrafo à parte (omissão) ou no início do 1.º parágrafo. */
  saudacaoNaMesmaLinha?: boolean;
  /** Os parágrafos; `{ligacao}` dentro de um parágrafo é a ligação da pessoa. */
  blocos: BlocoDoEmail[];
  /** Por omissão «Equipa CLYON»; `null` sem assinatura. Uma «\n» parte a linha. */
  assinatura?: string | null;
};

export const TEXTO_DA_RECUSA = "Não quero receber mensagens sobre a app";

/** A ligação com uma resposta (r=1, 2 ou 3) — a 3 é a recusa. */
export function linkComResposta(link: string, r: 1 | 2 | 3): string {
  return `${link}${link.includes("?") ? "&" : "?"}r=${r}`;
}

/** {LINK_RECUSA}: a recusa num toque, sem sessão (a mesma que o botão r=3). */
export function linkDaRecusa(link: string): string {
  return linkComResposta(link, 3);
}

function destino(link: string, d: DestinoDoBotao): string {
  if (d === "r1") return linkComResposta(link, 1);
  if (d === "r2") return linkComResposta(link, 2);
  if (d === "r3" || d === "recusa") return linkDaRecusa(link);
  return link;
}

export type EmailMontado = { assunto: string; texto: string; html: string };

export function montarEmailDaApp(modelo: ModeloDeEmailDaApp, p: { nome: unknown; link: string }): EmailMontado {
  const ola = saudacao(p.nome);
  const assinatura = modelo.assinatura === undefined ? "Equipa CLYON" : modelo.assinatura;
  const recusa = linkDaRecusa(p.link);

  /* ─── Texto simples ─── */
  const linhas: string[] = [];
  if (!modelo.saudacaoNaMesmaLinha) linhas.push(ola, "");
  modelo.blocos.forEach((b, i) => {
    if (typeof b === "string") {
      const t = b.replace(/\{ligacao\}/g, p.link);
      linhas.push(i === 0 && modelo.saudacaoNaMesmaLinha ? `${ola} ${t}` : t, "");
    } else if ("lista" in b) {
      b.lista.forEach((l, j) => linhas.push(b.numerada ? `${j + 1}. ${l}` : `- ${l}`));
      linhas.push("");
    } else {
      linhas.push(`${b.botao}: ${destino(p.link, b.destino)}`, "");
    }
  });
  if (assinatura) linhas.push(...assinatura.split("\n"), "");
  linhas.push(`${TEXTO_DA_RECUSA}: ${recusa}`);
  const texto = linhas.join("\n");

  /* ─── HTML ─── */
  const par = (t: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">${t}</p>`;
  const comLink = (t: string) =>
    escaparHtml(t).replace(
      /\{ligacao\}/g,
      `<a href="${escaparHtml(p.link)}" style="color:#0891b2;word-break:break-all;">${escaparHtml(p.link)}</a>`,
    );
  const corpo = modelo.blocos
    .map((b, i) => {
      if (typeof b === "string") {
        const t = comLink(b);
        return par(
          i === 0 && modelo.saudacaoNaMesmaLinha ? `<strong style="color:#0B1929;">${escaparHtml(ola)}</strong> ${t}` : t,
        );
      }
      if ("lista" in b) {
        const tag = b.numerada ? "ol" : "ul";
        const itens = b.lista.map((l) => `<li style="margin:0 0 6px;">${escaparHtml(l)}</li>`).join("");
        return `<${tag} style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.6;color:#475569;">${itens}</${tag}>`;
      }
      const href = escaparHtml(destino(p.link, b.destino));
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
            <tr><td style="border-radius:12px;background:#00B4CC;">
              <a href="${href}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">${escaparHtml(b.botao)}</a>
            </td></tr>
          </table>`;
    })
    .join("\n          ");
  const ola1 = modelo.saudacaoNaMesmaLinha ? "" : par(`<strong style="color:#0B1929;">${escaparHtml(ola)}</strong>`);
  const fim = assinatura
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0B1929;font-weight:600;">${assinatura
        .split("\n")
        .map(escaparHtml)
        .join("<br>")}</p>`
    : "";
  const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  ${modelo.preCabecalho ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escaparHtml(modelo.preCabecalho)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#00B4CC;padding:20px 24px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">CLYON</span>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          ${ola1}
          ${corpo}
          ${fim}
          <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;"><a href="${escaparHtml(recusa)}" style="color:#94a3b8;">${escaparHtml(TEXTO_DA_RECUSA)}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { assunto: modelo.assunto, texto, html };
}
