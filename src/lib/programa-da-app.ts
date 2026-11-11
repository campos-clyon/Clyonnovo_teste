/**
 * O PROGRAMA DE ACESSO ANTECIPADO DA APP — 11-11-2026 (ordem do CEO, pedida e
 * aprovada pelo dono).
 *
 * «Sempre que um cliente criar conta no site, perguntamos se tem interesse em
 * entrar no programa de testes da app da CLYON. Se tiver, põe o e-mail.» — o
 * dono. Depois a equipa cola a lista na Play Console (lista de testadores do
 * teste fechado), marca-os como adicionados e envia-lhes o convite.
 *
 * Ao cliente diz-se «programa de acesso antecipado»: é um convite para
 * experimentar antes de todos, e não um aviso de que a app pode falhar.
 *
 * ESTE FICHEIRO É PURO (sem base nem Resend): os textos, os estados e as
 * regras. A base está em `programa-da-app-na-base.ts`, o envio em
 * `programa-da-app-envio.ts`.
 *
 * OS ESTADOS, por esta ordem:
 *   · `inscrito`   — disse que sim, com o consentimento; falta pô-lo na Play;
 *   · `adicionado` — a equipa já o pôs na lista de testadores da Play;
 *   · `convidado`  — recebeu o email com os dois passos;
 *   · `saiu`       — saiu do programa (na conta). Pode voltar a entrar.
 */

import { escaparHtml } from "./escapar-html";

export const ESTADOS_DO_PROGRAMA = ["inscrito", "adicionado", "convidado", "saiu"] as const;
export type EstadoNoPrograma = (typeof ESTADOS_DO_PROGRAMA)[number];

export function eEstadoDoPrograma(v: unknown): v is EstadoNoPrograma {
  return typeof v === "string" && (ESTADOS_DO_PROGRAMA as readonly string[]).includes(v);
}

/** De onde veio a inscrição: o fim do registo (email confirmado) ou a área de conta. */
export const ORIGENS_DA_INSCRICAO = ["registo", "conta"] as const;
export type OrigemDaInscricao = (typeof ORIGENS_DA_INSCRICAO)[number];

export function origemDaInscricao(v: unknown): OrigemDaInscricao {
  return v === "registo" ? "registo" : "conta";
}

/** O pacote da app de cliente na Google Play. */
export const PACOTE_DA_APP_DE_CLIENTE = "pt.clyon.cliente";

/** A página da app na Play Store — sai do nome do pacote, não de uma configuração. */
export const LINK_DA_PLAY_STORE = `https://play.google.com/store/apps/details?id=${PACOTE_DA_APP_DE_CLIENTE}`;

/** Quantos dias fica uma inscrição de quem saiu, antes de a purga a apagar. */
export const DIAS_DO_PROGRAMA_DEPOIS_DE_SAIR = 30;

/* ─── O convite no site ─────────────────────────────────────────────────── */

export const TEXTOS_DO_CONVITE_NO_SITE = {
  titulo: "Quer experimentar a app da CLYON antes de todos?",
  corpo:
    "Entre no programa de acesso antecipado da app para Android. Pede, acompanha e paga os seus pedidos no telemóvel, e fala com o parceiro.",
  rotuloDoEmail: "Email da conta Google do seu telemóvel",
  notaDoEmail:
    "Tem de ser o email da conta Google que usa no telemóvel Android: é por ele que a Google Play lhe dá acesso à app.",
  consentimento:
    "Aceito que a CLYON use este email para me dar acesso à app na Google Play e para me enviar o convite. Posso sair do programa quando quiser.",
  sim: "Quero entrar",
  nao: "Agora não",
  feito:
    "Inscrição feita. Quando o seu acesso estiver pronto, enviamos-lhe um email com os dois passos para instalar a app.",
  semConsentimento: "Para entrar no programa, marque a caixa a autorizar o uso do email.",
  emailMal: "Escreva um email válido.",
} as const;

/** O que a área de conta diz, conforme o estado. */
export function fraseDoEstadoNaConta(estado: EstadoNoPrograma | null, email: string | null): string {
  switch (estado) {
    case "inscrito":
    case "adicionado":
      return `Está inscrito no programa de acesso antecipado com ${email ?? "o seu email"}. Quando o acesso estiver pronto, recebe um email com os dois passos para instalar a app.`;
    case "convidado":
      return `Já lhe enviámos o convite para ${email ?? "o seu email"}. Abra-o no telemóvel Android e siga os dois passos.`;
    case "saiu":
      return "Saiu do programa de acesso antecipado. Pode voltar a entrar quando quiser.";
    default:
      return TEXTOS_DO_CONVITE_NO_SITE.corpo;
  }
}

/* ─── Validação ─────────────────────────────────────────────────────────── */

/** O email limpo (minúsculas, sem espaços), ou `null` se não servir. */
export function emailDoPrograma(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  if (e.length < 6 || e.length > 254) return null;
  return /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/.test(e) ? e : null;
}

export type PedidoDeInscricao = { email: unknown; consentimento: unknown; origem?: unknown };

/**
 * O pedido de inscrição, validado. O consentimento é OBRIGATÓRIO e tem de ser
 * `true` à letra — uma caixa por marcar, um «sim» em texto ou um campo em
 * falta recusam a inscrição (RGPD: o consentimento é um acto, não um
 * pressuposto).
 */
export function validarInscricao(
  p: PedidoDeInscricao,
): { ok: true; email: string; origem: OrigemDaInscricao } | { ok: false; erro: string } {
  if (p.consentimento !== true) return { ok: false, erro: TEXTOS_DO_CONVITE_NO_SITE.semConsentimento };
  const email = emailDoPrograma(p.email);
  if (!email) return { ok: false, erro: TEXTOS_DO_CONVITE_NO_SITE.emailMal };
  return { ok: true, email, origem: origemDaInscricao(p.origem) };
}

/* ─── As regras da inscrição (sem duplicados por email) ────────────────── */

export type LinhaDoPrograma = {
  id: number;
  email: string;
  userId: number | null;
  estado: EstadoNoPrograma;
};

export type AccaoDaInscricao =
  /** Ninguém com este email nem esta conta: linha nova. */
  | { tipo: "nova" }
  /** Já está, ainda dentro: só renova a data do consentimento. */
  | { tipo: "renovar"; id: number }
  /** Tinha saído: volta a `inscrito`. */
  | { tipo: "reentrar"; id: number }
  /** A conta já tinha outra inscrição, com outro email: troca o email e volta a `inscrito`. */
  | { tipo: "mudar-email"; id: number }
  /** O email já está inscrito por outra conta: não se mexe em nada (nem se diz de quem é). */
  | { tipo: "de-outra-conta" };

/**
 * O que fazer com uma inscrição, sabendo a linha que já existe com o mesmo
 * email (`porEmail`) e a que já existe desta conta (`daConta`).
 *
 * UMA LINHA POR EMAIL, sempre: é o email que vai para a Play, e duas linhas
 * com o mesmo davam dois convites à mesma pessoa.
 */
export function accaoDaInscricao(
  userId: number | null,
  porEmail: LinhaDoPrograma | null,
  daConta: LinhaDoPrograma | null,
): AccaoDaInscricao {
  if (porEmail) {
    if (porEmail.userId != null && userId != null && porEmail.userId !== userId) return { tipo: "de-outra-conta" };
    return porEmail.estado === "saiu" ? { tipo: "reentrar", id: porEmail.id } : { tipo: "renovar", id: porEmail.id };
  }
  if (daConta) return { tipo: "mudar-email", id: daConta.id };
  return { tipo: "nova" };
}

/* ─── O backoffice ──────────────────────────────────────────────────────── */

/** Os emails por pôr na Play: só os `inscrito`, sem repetidos, separados por vírgulas. */
export function emailsPorAdicionar(linhas: Array<{ email: string; estado: string }>): string {
  const vistos = new Set<string>();
  for (const l of linhas) {
    if (l.estado !== "inscrito") continue;
    const e = emailDoPrograma(l.email);
    if (e) vistos.add(e);
  }
  return [...vistos].join(", ");
}

/** Só um `inscrito` passa a `adicionado`. */
export function podeMarcarAdicionado(estado: string): boolean {
  return estado === "inscrito";
}

/** Só a quem já está na lista da Play (`adicionado`) se envia o convite — antes disso o link não lhe abre nada. */
export function podeReceberOConvite(estado: string): boolean {
  return estado === "adicionado";
}

export const ROTULOS_DOS_ESTADOS: Record<EstadoNoPrograma, string> = {
  inscrito: "Por adicionar na Play",
  adicionado: "Adicionado — falta o convite",
  convidado: "Convidado",
  saiu: "Saiu",
};

/** Quantos convites por chamada à rota, e o intervalo entre eles (os do convite antigo, no mesmo Resend). */
export const CONVITES_POR_LOTE = 10;
export const INTERVALO_ENTRE_CONVITES_MS = 600;

/* ─── O email do convite ────────────────────────────────────────────────── */

export const ASSUNTO_DO_CONVITE_DO_PROGRAMA = "O seu acesso antecipado à app da CLYON está pronto";

export function paragrafosDoConviteDoPrograma(p: { email: string }) {
  return {
    ola: "Olá,",
    abertura:
      "O seu acesso antecipado à app da CLYON para Android está pronto. Na app pede, acompanha e paga os seus pedidos no telemóvel, e fala com o parceiro.",
    passos: "São dois passos:",
    passo1: `1. No telemóvel Android, abra o link de adesão com a conta Google ${p.email} e carregue em «Tornar-me testador».`,
    passo2: "2. Instale a app CLYON pela Play Store.",
    saida:
      "Pode sair do programa quando quiser: na página do link de adesão ou na sua conta CLYON, em Segurança.",
    assinatura: "Equipa CLYON",
  };
}

export function textoDoConviteDoPrograma(p: { email: string; linkDeAdesao: string }): string {
  const t = paragrafosDoConviteDoPrograma(p);
  return [
    t.ola,
    "",
    t.abertura,
    "",
    t.passos,
    t.passo1,
    p.linkDeAdesao,
    "",
    t.passo2,
    LINK_DA_PLAY_STORE,
    "",
    t.saida,
    "",
    t.assinatura,
  ].join("\n");
}

/** O HTML, no estilo dos outros emails da CLYON (o cabeçalho ciano, um cartão branco). */
export function htmlDoConviteDoPrograma(p: { email: string; linkDeAdesao: string }): string {
  const t = paragrafosDoConviteDoPrograma(p);
  const adesao = escaparHtml(p.linkDeAdesao);
  const loja = escaparHtml(LINK_DA_PLAY_STORE);
  const par = (s: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">${s}</p>`;
  const botao = (href: string, rotulo: string, cheio: boolean) => `
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
            <tr><td style="border-radius:12px;${cheio ? "background:#00B4CC;" : "border:2px solid #00B4CC;"}">
              <a href="${href}" style="display:inline-block;padding:12px 24px;color:${cheio ? "#ffffff" : "#0891b2"};font-size:15px;font-weight:700;text-decoration:none;">${rotulo}</a>
            </td></tr>
          </table>`;

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
          ${par(`<strong style="color:#0B1929;">${escaparHtml(t.ola)}</strong>`)}
          ${par(escaparHtml(t.abertura))}
          ${par(`<strong style="color:#0B1929;">${escaparHtml(t.passos)}</strong>`)}
          ${par(escaparHtml(t.passo1))}
          ${botao(adesao, "Abrir o link de adesão", true)}
          ${par(escaparHtml(t.passo2))}
          ${botao(loja, "Abrir na Play Store", false)}
          <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#94a3b8;">${escaparHtml(t.saida)}</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#0B1929;font-weight:600;">${escaparHtml(t.assinatura)}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
