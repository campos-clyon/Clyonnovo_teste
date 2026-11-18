/**
 * O GMAIL DO PROFISSIONAL E A LISTA DA PLAY — 18-11-2026 (d6, o CEO e o dono).
 *
 * A /app-pro mandava carregar em «Tornar-me testador» logo a seguir a deixar
 * o Gmail, e dizia «tente outra vez mais tarde» se a Play não abrisse. Mas o
 * Gmail só entra no teste quando a equipa o põe na lista da Play Console — e
 * até lá a página da Play diz que não há acesso. Quem tentava e falhava
 * desistia.
 *
 * Agora a /app-pro confere o Gmail com a última lista da Play colada no
 * backoffice (› Quem conta para os 12), com a mesma regra de comparação do
 * quadro (`chaveDoEmail`: num Gmail, os pontos, as maiúsculas e o «+…» não
 * contam). Enquanto não está, o passo 3 diz que já recebemos o Gmail e que
 * avisamos; quando aparece numa lista colada, sai UM aviso (email e, se tiver,
 * push), guardado na base para não se repetir.
 *
 * Só regras puras; a base está em `lista-da-play-avisos-na-base.ts`.
 */

import { chaveDoEmail } from "./quem-conta-para-os-12";

/** Algum destes emails (o Gmail do teste, o da conta) está na lista colada? Lista vazia = não. */
export function estaNaListaDaPlay(emails: ReadonlyArray<string | null | undefined>, lista: ReadonlyArray<string>): boolean {
  if (!lista.length) return false;
  const naLista = new Set(lista.map(chaveDoEmail));
  return emails.some((e) => typeof e === "string" && e.trim() !== "" && naLista.has(chaveDoEmail(e)));
}

/**
 * O que o passo 3 («Tornar-me testador») mostra:
 *   · «pode»       — o Gmail está na lista: o botão do link do teste;
 *   · «espera»     — deixou o Gmail e ainda não está na lista (ou não há lista): o texto de espera, sem botão;
 *   · «sem-dados»  — sem sessão ou sem Gmail: os passos como sempre, com o link.
 */
export type EstadoDoPassoDoTeste = "pode" | "espera" | "sem-dados";

export function estadoDoPassoDoTeste(p: { sessao: boolean | null; temGmail: boolean; naLista: boolean | null }): EstadoDoPassoDoTeste {
  if (p.sessao !== true || !p.temGmail || p.naLista === null) return "sem-dados";
  return p.naLista ? "pode" : "espera";
}

export const TEXTO_DE_ESPERA_DO_TESTE = "Já recebemos o seu Gmail; avisamos assim que puder carregar em «Tornar-me testador».";

/** Um profissional, como a base o vê, para decidir a quem avisar. */
export type ProfissionalParaOAviso = {
  id: number;
  emails: ReadonlyArray<string | null | undefined>;
  /** Já recebeu este aviso (a data gravada), ou null. */
  avisadoEm: string | Date | null;
  /** Já abriu a app: já está no teste, não precisa do aviso. */
  abriuApp: boolean;
};

/** Os ids a avisar: estão na lista, nunca foram avisados e ainda não abriram a app. */
export function quemAvisarDaLista(pessoas: ReadonlyArray<ProfissionalParaOAviso>, lista: ReadonlyArray<string>): number[] {
  if (!lista.length) return [];
  return pessoas
    .filter((p) => p.avisadoEm == null && !p.abriuApp && estaNaListaDaPlay(p.emails, lista))
    .map((p) => p.id);
}

/** O aviso: o email e o push. O nome vai só no email (o ecrã de bloqueio vê-se de fora). */
export function avisoDaListaDaPlay(p: { nome: string | null; link: string }): {
  assunto: string;
  texto: string;
  titulo: string;
  corpo: string;
} {
  const primeiro = String(p.nome ?? "").trim().split(/\s+/)[0] ?? "";
  return {
    assunto: "Já pode entrar no teste da CLYON Pro",
    texto: [
      primeiro ? `Olá ${primeiro},` : "Olá,",
      "",
      "O seu Gmail já está na lista do teste da CLYON Pro. Abra este link no telemóvel, com esse Gmail, e toque em «Tornar-me testador»:",
      p.link,
      "",
      "Depois instale a app pela Play Store e entre com o mesmo email e a mesma palavra-passe do painel.",
      "",
      "Equipa CLYON",
    ].join("\n"),
    titulo: "Já pode entrar no teste",
    corpo: "O seu Gmail está na lista da CLYON Pro. Toque em «Tornar-me testador».",
  };
}
