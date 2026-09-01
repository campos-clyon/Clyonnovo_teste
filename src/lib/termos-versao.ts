/**
 * A VERSÃO DOS TERMOS, num sítio só.
 *
 * PORQUE É QUE ISTO PRECISA DE EXISTIR
 *
 * Porque a partir do momento em que a candidatura abriu ao público, a caixa
 * «Li e aceito os Termos» deixou de ser um formalismo e passou a ser a única
 * prova de que houve contrato. Antes, o token do convite dizia que tínhamos
 * falado com aquela pessoa; agora não há convite nenhum, e o que fica é a
 * data e a versão que ela aceitou.
 *
 * Gravar uma versão obriga a que a versão gravada e a versão MOSTRADA sejam a
 * mesma. Se a data viver escrita à mão na página dos Termos e a constante
 * viver aqui, elas divergem no primeiro dia em que os Termos mudarem — e uma
 * prova que diz "aceitou a versão de 21 de agosto" quando a pessoa leu outra
 * coisa é pior do que não haver prova nenhuma. Nada disto dá erro: compila,
 * renderiza, e fica ali a certificar o que não aconteceu.
 *
 * Ao mudar os Termos, muda-se aqui — e a página segue.
 */

/**
 * A versão, em ISO, que é o que fica gravado em `providers.termosVersao`.
 *
 * Formato de data e não `v1`/`v2` porque é o que permite responder à pergunta
 * que alguém vai fazer um dia: "que texto é que esta pessoa leu?". Uma data
 * localiza-o no histórico do repositório; um número de série não.
 */
export const VERSAO_DOS_TERMOS = "2026-08-21";

/** A mesma data, como a página a escreve. */
export const TERMOS_ATUALIZADOS_EM = "21 de agosto de 2026";
