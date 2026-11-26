/**
 * «AVISAR NO WHATSAPP» QUEM NÃO USA A CLYON PRO — d134 (26-11-2026, pedida e
 * aprovada pelo dono).
 *
 * No quadro «Quem conta para os 12» (Profissionais), quem está em «Nunca
 * entrou» ou «Instalou e parou» tem um botão que abre o texto (editável) e só
 * o manda pelo WhatsApp da plataforma ao carregar em «Enviar». Há também
 * «Avisar todos os que nunca entraram», um a um, com intervalo entre envios.
 * Ninguém recebe dois no mesmo dia (de Lisboa): a linha mostra «avisado a
 * DD/MM às HH:MM».
 *
 * Só regras puras (o texto, quem se pode avisar); a base e o envio estão em
 * `aviso-da-app-pro-na-base.ts`. Os links de adesão vêm de `links-da-app.ts`.
 */

import { APP_PRO_NA_PLAY, LINK_DO_TESTE_DA_APP_PRO } from "./links-da-app";
import { diaEmLisboa, diaMesEHoraEmLisboa, pecasEmLisboa } from "./hora-de-lisboa";
import type { EstadoDeUso } from "./quem-conta-para-os-12";

export type EstadoQueSeAvisa = Exclude<EstadoDeUso, "usa">;

/** Só quem nunca entrou ou instalou e parou leva o aviso. */
export function estadoQueSeAvisa(estado: EstadoDeUso): estado is EstadoQueSeAvisa {
  return estado === "nunca" || estado === "parou";
}

/** O texto mais comprido que se aceita (o WhatsApp leva até 4096). */
export const MAXIMO_DO_TEXTO_DO_AVISO = 2000;

export const FRASE_DA_DESCONTINUACAO =
  "Todos os parceiros vão passar a usar a app: o uso da CLYON Pro pelo site vai ser descontinuado no próximo ano.";

export const FRASE_DO_GMAIL = "A Play precisa de um Gmail: diga-nos qual usa no telemóvel.";

const dois = (n: number) => String(n).padStart(2, "0");

/** «26/11/2026» — o dia em Lisboa. */
function diaPorExtenso(d: Date): string {
  const p = pecasEmLisboa(d);
  return `${dois(p.dia)}/${dois(p.mes)}/${p.ano}`;
}

/** «14h05» — a hora em Lisboa. */
function horaPorExtenso(d: Date): string {
  const p = pecasEmLisboa(d);
  return `${dois(p.hora)}h${dois(p.minuto)}`;
}

const valida = (v: string | null | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** O primeiro nome, ou nada (o quadro põe «Sem nome (#12)» a quem não o tem). */
export function primeiroNome(nome: string | null | undefined): string {
  const n = (nome ?? "").trim();
  if (!n || /^sem nome\b/i.test(n)) return "";
  return n.split(/\s+/)[0] ?? "";
}

export type DadosDoAviso = {
  nome: string | null;
  estado: EstadoQueSeAvisa;
  /** A inscrição na CLYON (ISO), ou null. */
  inscritoEm: string | null;
  /** A última abertura da app (ISO), ou null. */
  abertaEm: string | null;
  /** O email da linha tem o aviso «a Play pode não reconhecer este email». */
  naoGmail: boolean;
};

/** O texto do aviso, pelo estado da pessoa. Datas e horas em Lisboa. */
export function textoDoAvisoDaAppPro(d: DadosDoAviso): string {
  const nome = primeiroNome(d.nome);
  const ola = nome ? `Olá, ${nome}!` : "Olá!";
  const inscrito = valida(d.inscritoEm);
  const inscricao = inscrito
    ? `Inscreveu-se na CLYON a ${diaPorExtenso(inscrito)} às ${horaPorExtenso(inscrito)}`
    : "Inscreveu-se na CLYON";
  const linhas: string[] = [];

  if (d.estado === "nunca") {
    linhas.push(
      `${ola} Aqui é a equipa da CLYON 😊 ${inscricao} e, até hoje, ainda não entrou na app CLYON Pro. ${FRASE_DA_DESCONTINUACAO}`,
      "Para instalar (Android):",
      `1) No telemóvel, abra ${LINK_DO_TESTE_DA_APP_PRO} com a conta Google da Play Store e carregue em «Tornar-se testador».`,
      `2) Instale em ${APP_PRO_NA_PLAY}`,
      "3) Entre com o mesmo email e palavra-passe do painel.",
      "4) Aceite as notificações — é assim que recebe os pedidos a tempo.",
      "Se aparecer «Este item não está disponível», diga-nos qual é o Gmail do seu telemóvel e pomo-lo na lista.",
    );
  } else {
    const aberta = valida(d.abertaEm);
    const desde = aberta ? `não a abre desde ${diaPorExtenso(aberta)}` : "não a abre há mais de duas semanas";
    linhas.push(
      `${ola} Aqui é a equipa da CLYON 😊 ${inscricao} e instalou a app CLYON Pro, mas ${desde}. ${FRASE_DA_DESCONTINUACAO}`,
      "Para voltar:",
      "1) Abra a app CLYON Pro e entre com o mesmo email e palavra-passe do painel.",
      "2) Aceite as notificações — é assim que recebe os pedidos a tempo.",
      `Se já não tiver a app, instale-a em ${APP_PRO_NA_PLAY}`,
    );
  }
  if (d.naoGmail) linhas.push(FRASE_DO_GMAIL);
  return linhas.join("\n");
}

/** Já levou o aviso hoje (dia de Lisboa)? */
export function avisadoHoje(avisadoEm: string | null | undefined, agora: Date): boolean {
  const d = valida(avisadoEm ?? null);
  return d !== null && diaEmLisboa(d) === diaEmLisboa(agora);
}

/** «avisado a 26/11 às 14:05» (hora de Lisboa). */
export function rotuloDoAvisado(avisadoEm: string | null | undefined): string | null {
  const d = valida(avisadoEm ?? null);
  if (!d) return null;
  const [dia, hora] = diaMesEHoraEmLisboa(d).split(" ");
  return `avisado a ${dia} às ${hora}`;
}

/** O texto que o administrador deixou na pré-visualização, limpo; null se não serve. */
export function textoParaEnviar(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const t = texto.replace(/\r\n/g, "\n").trim();
  if (!t || t.length > MAXIMO_DO_TEXTO_DO_AVISO) return null;
  return t;
}

export type LinhaQueSeAvisa = {
  id: string;
  estado: EstadoDeUso;
  contaDeTeste: boolean;
  /** Há um telemóvel português com que se fala no WhatsApp. */
  temWhatsApp: boolean;
  avisadoEm: string | null;
};

/** Pode levar o aviso agora (pelo botão da linha)? */
export function podeAvisarAgora(l: LinhaQueSeAvisa, agora: Date): boolean {
  return estadoQueSeAvisa(l.estado) && l.temWhatsApp && !avisadoHoje(l.avisadoEm, agora);
}

/** «Avisar todos os que nunca entraram»: os «Nunca entrou» com WhatsApp, ainda não avisados hoje, sem contas de teste. */
export function quemAvisarEmMassa<T extends LinhaQueSeAvisa>(linhas: T[], agora: Date): T[] {
  return linhas.filter((l) => l.estado === "nunca" && !l.contaDeTeste && podeAvisarAgora(l, agora));
}

/** O id do profissional a partir do id do quadro («p12» → 12). */
export function idDoProfissional(id: unknown): number | null {
  if (typeof id === "number") return Number.isInteger(id) && id > 0 ? id : null;
  if (typeof id !== "string") return null;
  const m = /^p?(\d{1,9})$/.exec(id.trim());
  return m ? Number(m[1]) : null;
}
