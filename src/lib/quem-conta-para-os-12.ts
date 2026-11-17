/**
 * «QUEM CONTA PARA OS 12» — 17-11-2026 (d60, aprovada pelo dono: «se a gente
 * souber quem está e quem não está, consegue entrar em contacto e descobrir
 * porquê»).
 *
 * A Play Console só diz QUANTOS testadores participam no teste fechado (são
 * precisos 12 durante 14 dias seguidos), nunca QUEM. Este quadro diz quem,
 * pelos nossos dados: a última vez que cada pessoa abriu a app (gravada pelo
 * servidor quando a app renova a sessão ou entra — ver `registarAppAberta` e
 * `registarAppDoClienteAberta`).
 *
 *   · «Usa»               — abriu a app nos últimos 14 dias;
 *   · «Instalou e parou»  — já entrou na app, mas não nos últimos 14 dias;
 *   · «Nunca entrou»      — não há sinal nenhum de que a app abriu.
 *
 * E cruza com a lista de testadores da Play, que não se lê por API: o dono
 * cola-a. Emails da Play sem conta CLYON aparecem à parte (provável email
 * errado); emails que não são Gmail ficam assinalados (a Play pode não os
 * reconhecer).
 *
 * Só regras puras; a base está em `quem-conta-para-os-12-na-base.ts`.
 */

import { eGmail } from "./seguimento-da-app";

export const DIAS_DO_TESTE = 14;
const DIA_MS = 24 * 60 * 60 * 1000;

export const APPS_DO_TESTE = ["pro", "cliente"] as const;
export type AppDoTeste = (typeof APPS_DO_TESTE)[number];
export function eAppDoTeste(v: unknown): v is AppDoTeste {
  return v === "pro" || v === "cliente";
}

export type EstadoDeUso = "usa" | "parou" | "nunca";

export const ROTULOS_DO_USO: Record<EstadoDeUso, string> = {
  usa: "Usa",
  parou: "Instalou e parou",
  nunca: "Nunca entrou",
};

/**
 * O estado de uma pessoa. `abertaEm` é a última abertura gravada; `entrouAlgumaVez`
 * é um sinal mais fraco (os avisos ligados na app) para quem instalou antes de
 * a abertura se gravar — conta como «parou», nunca como «usa».
 */
export function estadoDeUso(abertaEm: Date | null, agora: Date, entrouAlgumaVez = false): EstadoDeUso {
  if (abertaEm && !Number.isNaN(abertaEm.getTime())) {
    return agora.getTime() - abertaEm.getTime() <= DIAS_DO_TESTE * DIA_MS ? "usa" : "parou";
  }
  return entrouAlgumaVez ? "parou" : "nunca";
}

/** O tamanho máximo do que se cola (a lista da Play tem, no máximo, umas centenas). */
export const MAXIMO_DE_EMAILS_COLADOS = 2000;
const UM_EMAIL = /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

/**
 * Os emails do que o dono colou: separados por vírgulas, pontos e vírgulas,
 * espaços ou linhas; em minúsculas, sem repetidos, pela ordem em que vieram.
 * O que não é email (cabeçalhos, nomes) fica de fora.
 */
export function emailsDaListaColada(texto: unknown): string[] {
  if (typeof texto !== "string") return [];
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const bruto of texto.split(/[\s,;<>"]+/)) {
    const e = bruto.trim().toLowerCase().replace(/^mailto:/, "");
    if (!e || e.length > 200 || !UM_EMAIL.test(e)) continue;
    const k = chaveDoEmail(e);
    if (vistos.has(k)) continue;
    vistos.add(k);
    saida.push(e);
    if (saida.length >= MAXIMO_DE_EMAILS_COLADOS) break;
  }
  return saida;
}

/**
 * A chave para comparar dois emails como o Google os compara: num Gmail os
 * pontos e o que vem depois do «+» não contam, e googlemail.com é gmail.com.
 */
export function chaveDoEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const arroba = e.lastIndexOf("@");
  if (arroba < 1) return e;
  let local = e.slice(0, arroba);
  let dominio = e.slice(arroba + 1);
  if (dominio === "googlemail.com") dominio = "gmail.com";
  if (dominio === "gmail.com") {
    local = local.split("+")[0].replace(/\./g, "");
  }
  return `${local}@${dominio}`;
}

/** Uma pessoa que devia estar no teste (o que a base sabe dela). */
export type PessoaDoTeste = {
  /** «p12» (profissional) ou «c34» (conta de cliente) ou «e:email» (só email). */
  id: string;
  nome: string;
  /** O email da conta primeiro; depois outros (o Gmail do teste, o do programa). */
  emails: string[];
  telefone: string | null;
  /** A última abertura da app (ISO), ou null. */
  abertaEm: string | null;
  versao: string | null;
  /** Os avisos da app estão ligados neste aparelho — já entrou pelo menos uma vez. */
  temAvisosDaApp: boolean;
  /** Porque está no quadro: «Aprovado», «Convidado», «Adicionado à Play»… */
  porque: string;
  contaDeTeste: boolean;
};

export type LinhaDoQuadro = PessoaDoTeste & {
  estado: EstadoDeUso;
  /** Com uma lista colada: o email desta pessoa que está na Play, ou null se não está. */
  emailNaPlay: string | null;
  /** Há uma lista colada e esta pessoa não está nela. */
  foraDaPlay: boolean;
  /** O email com que conta na Play (ou o da conta) não é Gmail. */
  naoGmail: boolean;
};

export type EmailDaPlaySemConta = { email: string; gmail: boolean };

export type QuadroDosTestadores = {
  linhas: LinhaDoQuadro[];
  /** Emails da lista da Play sem conta CLYON correspondente. */
  semConta: EmailDaPlaySemConta[];
  totais: Record<EstadoDeUso, number>;
  /** Quantos «Usa» estão na lista da Play (só com lista colada) — o que se compara com a Play. */
  usaNaPlay: number | null;
  listaColada: boolean;
};

const ORDEM: Record<EstadoDeUso, number> = { usa: 0, parou: 1, nunca: 2 };

export function montarQuadro(
  pessoas: PessoaDoTeste[],
  listaDaPlay: string[] | null,
  agora: Date,
): QuadroDosTestadores {
  const temLista = listaDaPlay !== null && listaDaPlay.length > 0;
  const naPlay = new Map<string, string>();
  for (const e of listaDaPlay ?? []) naPlay.set(chaveDoEmail(e), e);
  const usadosDaPlay = new Set<string>();

  const linhas: LinhaDoQuadro[] = pessoas.map((p) => {
    const aberta = p.abertaEm ? new Date(p.abertaEm) : null;
    const estado = estadoDeUso(aberta, agora, p.temAvisosDaApp);
    let emailNaPlay: string | null = null;
    if (temLista) {
      for (const e of p.emails) {
        const k = chaveDoEmail(e);
        if (naPlay.has(k)) {
          emailNaPlay = naPlay.get(k) ?? e;
          usadosDaPlay.add(k);
          break;
        }
      }
    }
    const emailQueConta = emailNaPlay ?? p.emails.find((e) => eGmail(e)) ?? p.emails[0] ?? "";
    return {
      ...p,
      estado,
      emailNaPlay,
      foraDaPlay: temLista && emailNaPlay === null,
      naoGmail: emailQueConta !== "" && !eGmail(emailQueConta),
    };
  });

  linhas.sort((a, b) => {
    const o = ORDEM[a.estado] - ORDEM[b.estado];
    if (o !== 0) return o;
    const ta = a.abertaEm ? new Date(a.abertaEm).getTime() : 0;
    const tb = b.abertaEm ? new Date(b.abertaEm).getTime() : 0;
    if (ta !== tb) return tb - ta;
    return a.nome.localeCompare(b.nome, "pt");
  });

  const semConta: EmailDaPlaySemConta[] = [];
  for (const [k, e] of naPlay) {
    if (!usadosDaPlay.has(k)) semConta.push({ email: e, gmail: eGmail(e) });
  }

  const totais: Record<EstadoDeUso, number> = { usa: 0, parou: 0, nunca: 0 };
  for (const l of linhas) totais[l.estado] += 1;

  return {
    linhas,
    semConta,
    totais,
    usaNaPlay: temLista ? linhas.filter((l) => l.estado === "usa" && l.emailNaPlay !== null).length : null,
    listaColada: temLista,
  };
}

/** Só os algarismos e o «+» — para o link de chamada (`tel:`). */
export function telefoneParaLigar(t: string | null): string | null {
  if (!t) return null;
  const limpo = t.replace(/[^\d+]/g, "");
  return limpo.replace(/\D/g, "").length >= 9 ? limpo : null;
}
