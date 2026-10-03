/**
 * O MODO ESCURO DO PAINEL DO PROFISSIONAL — 03-10-2026.
 *
 * *«Um botão na conta do pro para ele decidir se quer claro ou escuro quando
 * quiser.»*
 *
 * COMO FUNCIONA. O escuro não está escrito classe a classe nos ecrãs — eram
 * quase 7500 linhas a precisar de um `dark:` em cada cor. As classes do
 * Tailwind 4 lêem as cores de variáveis (`bg-white` é `var(--color-white)`,
 * `text-slate-500` é `var(--color-slate-500)`), e o `globals.css` dá-lhes
 * outros valores quando o `<html>` tem `data-tema="escuro"`: o branco passa a
 * ser o cartão escuro, as escalas viram ao contrário (o 50 passa a 950, o 700
 * a 300), e os tokens da CLYON têm a sua versão escura. Cada ecrã continua a
 * dizer «branco» e «tinta», e o tema decide o que isso quer dizer.
 *
 * SÓ NO PAINEL. O atributo põe-se ao entrar no painel e tira-se ao sair: o
 * resto do site continua claro, mesmo para quem escolheu o escuro.
 *
 * A ESCOLHA FICA NO APARELHO (`localStorage`), como nas aplicações: o telemóvel
 * pode estar no escuro e o computador do escritório no claro.
 */

export type TemaDoPainel = "claro" | "escuro";

export const CHAVE_DO_TEMA = "clyon:tema-do-painel";

/** Onde o tema vale. Fora daqui o site é sempre claro. */
export const CAMINHO_DO_PAINEL = "/profissionais/painel";

export function lerTemaGuardado(): TemaDoPainel {
  try {
    return window.localStorage.getItem(CHAVE_DO_TEMA) === "escuro" ? "escuro" : "claro";
  } catch {
    // Navegação privada, ou o browser a recusar o armazenamento: fica o claro.
    return "claro";
  }
}

export function guardarTema(tema: TemaDoPainel): void {
  try {
    window.localStorage.setItem(CHAVE_DO_TEMA, tema);
  } catch {
    /* Sem armazenamento, o tema vale só até fechar a página. */
  }
}

/** Põe (ou tira) o tema no `<html>`, que é onde o `globals.css` o procura. */
export function aplicarTema(tema: TemaDoPainel | null): void {
  const html = document.documentElement;
  if (tema === "escuro") html.setAttribute("data-tema", "escuro");
  else html.removeAttribute("data-tema");
}

/*
 * ANTES DE PINTAR. Corre no `<head>` de todas as páginas (layout.tsx) e só
 * faz alguma coisa no painel: sem isto, quem escolheu o escuro via a página
 * branca durante um instante, até o React acordar e aplicar o tema.
 *
 * É uma string em JS simples, como o `SCRIPT_DO_FUSO_DE_LISBOA`: vai tal e
 * qual para dentro de um `<script>`.
 */
export const SCRIPT_DO_TEMA_DO_PAINEL = `(function () {
  try {
    if (location.pathname.indexOf("${CAMINHO_DO_PAINEL}") === 0 && localStorage.getItem("${CHAVE_DO_TEMA}") === "escuro") {
      document.documentElement.setAttribute("data-tema", "escuro");
    }
  } catch (e) {}
})();`;
