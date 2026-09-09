/**
 * O RESUMO DO GMAIL NÃO PÕE ESPAÇOS.
 *
 * A notificação no telemóvel mostra o email a tirar as etiquetas ao HTML e a
 * colar o que sobra. Duas células seguidas viram uma palavra só:
 * «CLYONValor de partida (conta CLYON) 330,00 € Recebe 310,20 € já inclui a
 * taxa CLYONA morada exacta aparece…» — foi assim que chegou ao dono,
 * 09-09-2026. Os emails estão todos escritos em tabelas e divs, sem texto
 * entre uma etiqueta e a seguinte, por isso o defeito é de todos.
 *
 * A cura é um espaço antes de cada fecho de bloco. No HTML a mais não se vê
 * (um espaço no fim de um bloco não desenha nada); no resumo separa as
 * palavras. Aplica-se no envio, a todos os emails, em vez de emendar cada
 * modelo à mão.
 */
export function legivelNoResumo(html: string): string {
  // Só blocos. Num <strong> ou <a> dentro de uma frase o espaço via-se
  // («Bold ,»); num bloco não.
  return html.replace(/<\/(div|td|th|p|h[1-6]|li|tr)>/gi, " $&");
}
