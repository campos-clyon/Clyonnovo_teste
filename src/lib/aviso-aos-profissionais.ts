/**
 * O AVISO A TODOS OS PROFISSIONAIS — d11 (15-11-2026).
 *
 * Uma ferramenta do backoffice (só o administrador) para avisar todos os
 * profissionais aprovados do modelo de 15-11: um email (pelo Resend, como os
 * outros) e uma mensagem de WhatsApp (pela ponte, pela fila de sempre). Este
 * ficheiro é PURO — as regras, os textos de partida e a conta do HTML. A base
 * está em `aviso-aos-profissionais-na-base.ts`; o motor, que decide o que sai
 * em cada passagem, em `aviso-aos-profissionais-motor.ts`.
 *
 * As regras que não se passam:
 *  - só os APROVADOS e activos, nunca uma conta de teste (`contaDeTeste` ou o
 *    nome com «teste», como o Fred Teste), nunca a conta da casa (`isClyon`);
 *  - cada profissional recebe ESTE aviso uma só vez por canal, mesmo que se
 *    carregue duas vezes em «Enviar» (a chave única da tabela);
 *  - o WhatsApp sai um de cada vez, com 20 a 45 s ao acaso entre mensagens, e
 *    só das 9h às 21h de Lisboa; fora disso fica na fila para as 9h;
 *  - nada sai sem o administrador escrever ENVIAR, e «Parar» pára.
 */

import { e } from "./escapar-html";
import { TELEFONE_DA_CLYON_NACIONAL } from "./telefone-da-clyon";

/** A chave DESTE aviso. Uma versão nova do texto não volta a enviar a quem já recebeu. */
export const CHAVE_DO_AVISO = "novo-modelo-15-11";

/** O título do interruptor nas Configs — o nome que o dono confirma. */
export const NOME_DO_INTERRUPTOR_DO_AVISO = "Mostrar o aviso do novo modelo";

/** A página fixa do «Saber mais», para onde o WhatsApp e a faixa do painel ligam. */
export const CAMINHO_DO_SABER_MAIS = "/profissionais/novo-modelo";

export const JANELA_DO_WHATSAPP = { das: 9, as: 21 } as const;
export const INTERVALO_DO_WHATSAPP_S = { min: 20, max: 45 } as const;
/** O Resend aceita 2 pedidos por segundo; com folga. */
export const ESPERA_ENTRE_EMAILS_MS = 600;

export type Canal = "email" | "whatsapp";
export const CANAIS: readonly Canal[] = ["email", "whatsapp"];

export type EstadoDoDestinatario = "pendente" | "a_enviar" | "enviado" | "falhou" | "parado";

/* ── Os destinatários ─────────────────────────────────────────────────────── */

export type ProfissionalParaOAviso = {
  id: number;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  estado: string | null;
  isActive: number | boolean | null;
  isClyon: number | boolean | null;
  contaDeTeste: number | boolean | null;
};

const verdade = (v: number | boolean | null | undefined) => v === true || Number(v) === 1;

/** O mesmo critério do resto do site (`eContaDeTeste`): «teste» no nome. */
export function nomeDeTeste(nome: string | null | undefined): boolean {
  return typeof nome === "string" && /\bteste?\b/i.test(nome);
}

export function eDestinatarioDoAviso(p: ProfissionalParaOAviso): boolean {
  if (p.estado !== "aprovado") return false;
  if (!verdade(p.isActive)) return false;
  if (verdade(p.isClyon)) return false;
  if (verdade(p.contaDeTeste) || nomeDeTeste(p.nome)) return false;
  return true;
}

export function emailValido(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const limpo = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpo) ? limpo : null;
}

/**
 * Só telemóveis portugueses (9 dígitos a começar por 9). Igual a
 * `telemovelParaWhatsApp`: um fixo sem indicativo chegava a outra pessoa.
 */
export function telemovelDoAviso(telefone: string | null | undefined): string | null {
  if (typeof telefone !== "string") return null;
  const d = telefone.replace(/\D/g, "");
  if (/^9\d{8}$/.test(d)) return `351${d}`;
  if (/^3519\d{8}$/.test(d)) return d;
  if (/^003519\d{8}$/.test(d)) return d.slice(2);
  return null;
}

export type ContagemDosDestinatarios = {
  total: number;
  comEmail: number;
  comWhatsApp: number;
  semContacto: number;
  ids: number[];
};

export function contarDestinatarios(lista: ProfissionalParaOAviso[]): ContagemDosDestinatarios {
  const bons = lista.filter(eDestinatarioDoAviso);
  return {
    total: bons.length,
    comEmail: bons.filter((p) => emailValido(p.email)).length,
    comWhatsApp: bons.filter((p) => telemovelDoAviso(p.telefone)).length,
    semContacto: bons.filter((p) => !emailValido(p.email) && !telemovelDoAviso(p.telefone)).length,
    ids: bons.map((p) => p.id).sort((a, b) => a - b),
  };
}

/* ── A janela e o intervalo do WhatsApp ──────────────────────────────────── */

export function horaEmLisboa(agora: Date): number {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "2-digit", hourCycle: "h23" }).format(agora),
  );
  return Number.isFinite(h) ? h : -1;
}

/** Das 9h00 às 20h59 de Lisboa, seja qual for o fuso de quem corre isto. */
export function dentroDaJanelaDoWhatsApp(agora: Date): boolean {
  const h = horaEmLisboa(agora);
  return h >= JANELA_DO_WHATSAPP.das && h < JANELA_DO_WHATSAPP.as;
}

/** 20 a 45 s, ao acaso (`aleatorio` em [0, 1)). */
export function intervaloAoAcaso(aleatorio: number = Math.random()): number {
  const r = Math.min(Math.max(Number.isFinite(aleatorio) ? aleatorio : 0, 0), 0.999999);
  const { min, max } = INTERVALO_DO_WHATSAPP_S;
  return min + Math.floor(r * (max - min + 1));
}

/* ── Os textos ───────────────────────────────────────────────────────────── */

export type ConteudoDoAviso = {
  titulo: string;
  textoEmail: string;
  textoWhatsApp: string;
};

export const LIMITES_DO_CONTEUDO = { titulo: 140, textoEmail: 12000, textoWhatsApp: 3500 } as const;

export function validarConteudo(c: Partial<Record<keyof ConteudoDoAviso, unknown>>): ConteudoDoAviso | string {
  const titulo = typeof c.titulo === "string" ? c.titulo.trim() : "";
  const textoEmail = typeof c.textoEmail === "string" ? c.textoEmail.replace(/\r\n/g, "\n").trim() : "";
  const textoWhatsApp = typeof c.textoWhatsApp === "string" ? c.textoWhatsApp.replace(/\r\n/g, "\n").trim() : "";
  if (!titulo) return "Falta o título.";
  if (!textoEmail) return "Falta o texto do email.";
  if (!textoWhatsApp) return "Falta o texto do WhatsApp.";
  if (titulo.length > LIMITES_DO_CONTEUDO.titulo) return `O título tem mais de ${LIMITES_DO_CONTEUDO.titulo} caracteres.`;
  if (textoEmail.length > LIMITES_DO_CONTEUDO.textoEmail) return "O texto do email é comprido de mais.";
  if (textoWhatsApp.length > LIMITES_DO_CONTEUDO.textoWhatsApp) return "O texto do WhatsApp é comprido de mais.";
  return { titulo, textoEmail, textoWhatsApp };
}

/** `{nome}` é o primeiro nome; sem nome, sai a palavra e o espaço antes dela. */
export function comONome(texto: string, nome: string | null | undefined): string {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!primeiro) return texto.replace(/[ \t]*\{nome\}/g, "");
  return texto.replace(/\{nome\}/g, primeiro);
}

/** O texto liga para o «Saber mais»? (a página só existe com o interruptor ligado). */
export function ligaAoSaberMais(c: Pick<ConteudoDoAviso, "textoEmail" | "textoWhatsApp">): boolean {
  return c.textoEmail.includes(CAMINHO_DO_SABER_MAIS) || c.textoWhatsApp.includes(CAMINHO_DO_SABER_MAIS);
}

/*
 * O FORMATO DO TEXTO DO EMAIL — simples, para quem escreve no backoffice:
 *   uma linha em branco separa parágrafos;
 *   «### Título» é um subtítulo;
 *   linhas a começar por «- » são uma lista; por «1. » uma lista numerada;
 *   **assim** fica a negrito; os endereços https:// ficam ligações.
 * O HTML é feito AQUI, com tudo escapado: o texto nunca entra cru na página.
 */
export type Bloco =
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "paragrafo"; linhas: string[] }
  | { tipo: "lista"; numerada: boolean; itens: string[] };

export function blocosDoTexto(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  const grupos = texto.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  for (const g of grupos) {
    const linhas = g.split("\n").map((l) => l.trim()).filter(Boolean);
    if (linhas.length === 0) continue;
    let paragrafo: string[] = [];
    let lista: { numerada: boolean; itens: string[] } | null = null;
    const fecharParagrafo = () => {
      if (paragrafo.length) blocos.push({ tipo: "paragrafo", linhas: paragrafo });
      paragrafo = [];
    };
    const fecharLista = () => {
      if (lista) blocos.push({ tipo: "lista", numerada: lista.numerada, itens: lista.itens });
      lista = null;
    };
    for (const l of linhas) {
      const sub = /^#{2,3}\s+(.+)$/.exec(l);
      const ponto = /^[-•]\s+(.+)$/.exec(l);
      const numero = /^\d+[.)]\s+(.+)$/.exec(l);
      if (sub) {
        fecharParagrafo();
        fecharLista();
        blocos.push({ tipo: "subtitulo", texto: sub[1] });
      } else if (ponto || numero) {
        fecharParagrafo();
        const numerada = Boolean(numero);
        if (lista && lista.numerada !== numerada) fecharLista();
        if (!lista) lista = { numerada, itens: [] };
        lista.itens.push((ponto ?? numero)![1]);
      } else {
        fecharLista();
        paragrafo.push(l);
      }
    }
    fecharParagrafo();
    fecharLista();
  }
  return blocos;
}

/** Os pedaços de uma linha: texto, negrito e ligações. Para o HTML e para a página. */
export type Pedaco = { tipo: "texto" | "negrito"; texto: string } | { tipo: "ligacao"; texto: string; url: string };

export function pedacosDaLinha(linha: string): Pedaco[] {
  const pedacos: Pedaco[] = [];
  const re = /\*\*(.+?)\*\*|(https:\/\/[^\s<>"')]+[^\s<>"').,;:!?])/g;
  let i = 0;
  for (let m = re.exec(linha); m; m = re.exec(linha)) {
    if (m.index > i) pedacos.push({ tipo: "texto", texto: linha.slice(i, m.index) });
    if (m[1] != null) pedacos.push({ tipo: "negrito", texto: m[1] });
    else pedacos.push({ tipo: "ligacao", texto: m[2], url: m[2] });
    i = m.index + m[0].length;
  }
  if (i < linha.length) pedacos.push({ tipo: "texto", texto: linha.slice(i) });
  return pedacos;
}

function linhaEmHtml(linha: string): string {
  return pedacosDaLinha(linha)
    .map((p) =>
      p.tipo === "negrito"
        ? `<strong style="color:#0B1929;">${e(p.texto)}</strong>`
        : p.tipo === "ligacao"
          ? `<a href="${e(p.url)}" style="color:#007A8C;">${e(p.texto)}</a>`
          : e(p.texto),
    )
    .join("");
}

export function corpoEmHtml(texto: string): string {
  return blocosDoTexto(texto)
    .map((b) => {
      if (b.tipo === "subtitulo") {
        return `<h2 style="margin:24px 0 10px;font-size:17px;color:#0B1929;">${linhaEmHtml(b.texto)}</h2>`;
      }
      if (b.tipo === "lista") {
        const etiqueta = b.numerada ? "ol" : "ul";
        const itens = b.itens
          .map((i) => `<li style="margin:0 0 8px;">${linhaEmHtml(i)}</li>`)
          .join("");
        return `<${etiqueta} style="margin:0 0 16px;padding-left:22px;font-size:15px;line-height:1.6;color:#475569;">${itens}</${etiqueta}>`;
      }
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">${b.linhas
        .map(linhaEmHtml)
        .join("<br>")}</p>`;
    })
    .join("\n");
}

/** O texto simples do email (a parte `text`), sem os asteriscos. */
export function corpoEmTexto(texto: string): string {
  return texto.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{2,3}\s+/gm, "");
}

export function htmlDoEmailDoAviso(p: {
  titulo: string;
  texto: string;
  urlDoPerfil: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${e(p.titulo)}</title></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <tr><td style="background:#00B4CC;padding:24px 32px;">
          <div style="color:#ffffff;font-size:20px;font-weight:700;">CLYON</div>
        </td></tr>

        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#0B1929;">${e(p.titulo)}</h1>
          ${corpoEmHtml(p.texto)}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
            <tr><td align="center">
              <a href="${e(p.urlDoPerfil)}" style="display:inline-block;background:#00B4CC;color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:10px;font-size:15px;font-weight:600;">
                Completar o perfil
              </a>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ── Os textos de partida (rascunho da d11, 12-11; o CEO dá a versão final) ─ */

export const FAIXA_DO_PAINEL =
  "A partir de 15/11 recebe directamente do cliente. Até 22/11, preencha o IBAN e o MB WAY no perfil.";

export function rascunhoDoAviso(urlDoSite: string): ConteudoDoAviso {
  const saberMais = `${urlDoSite.replace(/\/+$/, "")}${CAMINHO_DO_SABER_MAIS}`;
  return {
    titulo: "A partir de 15/11, recebe directamente do cliente",
    textoEmail: [
      "Olá {nome},",
      "### O que muda a 15 de novembro",
      "A partir de 15/11/2026, às 00h (hora de Lisboa):",
      [
        "1. **O cliente paga-lhe directamente.** Pode pagar por transferência, por MB WAY ou em dinheiro no local, e é ele que escolhe. O dinheiro do trabalho já não passa pela CLYON.",
        "2. **Passa à CLYON a taxa da plataforma e o IVA dela.** Cada trabalho fechado gera uma referência Multibanco, que também pode pagar por MB WAY. Tem 4 dias para pagar.",
        "3. **Se não pagar a tempo, o valor fica em atraso.** A partir do 5.º dia, continua a ver os pedidos, mas não pode aceitar nem enviar ofertas até pagar. O botão «Pagar o valor em atraso» mostra o que falta. Quando o pagamento é confirmado, a conta desbloqueia sozinha.",
        "4. **Cada um passa a sua fatura.** O profissional fatura o trabalho ao cliente e a CLYON fatura a taxa da plataforma. As duas faturas ficam juntas no pedido.",
        "5. **O perfil diz como trabalha.** Indique se emite fatura, se é com IVA ou com isenção, e se emite guia de transporte. O cliente vê isto quando escolhe.",
      ].join("\n"),
      "**O que tem de fazer:** preencher o IBAN e o MB WAY no perfil **até 22/11**. A partir dessa data, sem os dois, não pode aceitar nem enviar ofertas.",
      "**Trabalhos de antes:** os trabalhos de antes de 15/11 em que o cliente já pagou à CLYON continuam como estavam, até ao fim.",
      `Dúvidas: fale connosco pelo WhatsApp ${TELEFONE_DA_CLYON_NACIONAL}.`,
    ].join("\n\n"),
    textoWhatsApp: [
      "Olá {nome}! Uma novidade importante da CLYON para os profissionais.",
      "*A partir de 15/11, recebe directamente do cliente.* O cliente paga-lhe por transferência, MB WAY ou em dinheiro no local (é ele que escolhe).",
      "Depois de fechar o trabalho, passa à CLYON *a taxa da plataforma e o IVA dela*. Paga pela referência Multibanco ou por MB WAY, *em 4 dias*. Se passar o prazo, o valor fica em atraso: a partir do 5.º dia não pode aceitar nem enviar ofertas até pagar (botão «Pagar o valor em atraso»).",
      "O profissional fatura o trabalho e a CLYON fatura a taxa. No perfil, indique se emite fatura (com IVA ou isento) e guia de transporte. O cliente vê isto quando escolhe.",
      "👉 *Até 22/11, preencha o IBAN e o MB WAY no perfil.* Sem eles, deixa de poder aceitar e enviar ofertas.",
      "Os trabalhos de antes de 15/11 em que o cliente já pagou à CLYON continuam como estavam.",
      `Tudo explicado aqui: ${saberMais}`,
      "Dúvidas? Responda a esta mensagem.",
    ].join("\n\n"),
  };
}
