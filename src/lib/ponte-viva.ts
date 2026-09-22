/**
 * A ponte do WhatsApp está viva? — 22-09-2026.
 *
 * A PERGUNTA QUE CUSTOU UMA MANHÃ. Uma cliente escreveu às 12:58 e o
 * assistente não lhe respondeu. Para saber porquê era preciso abrir o painel,
 * procurar o número, ver se a conversa lá estava, ver se a fila tinha
 * mensagens por sair — e mesmo assim ficava a dúvida. Quando a ponte morre, o
 * site continua a parecer normal: o assistente escreve, a fila enche-se, e
 * ninguém vê.
 *
 * PORQUE É QUE ISTO É UM SINAL HONESTO, e não um palpite: a ponte vem buscar a
 * fila de cinco em cinco segundos (`INTERVALO_MS`, por omissão 5000), e a
 * ronda começa por `if (!ligado) return` — o `ligado` só é verdade entre o
 * `ready` e o `disconnected` do WhatsApp. Ou seja, o pedido que carimba a hora
 * SÓ ACONTECE COM O TELEMÓVEL EMPARELHADO. Um carimbo fresco não quer dizer
 * apenas «o processo está de pé»: quer dizer que está de pé E emparelhado.
 *
 * A EXCEPÇÃO, para ninguém confiar a mais: ao arrancar, a ponte faz um pedido
 * antes de emparelhar, só para confirmar que o site a aceita (`confirmarOSite`).
 * Esse carimbo sozinho mantém o verde no máximo um minuto — o tempo até cair
 * para âmbar — e é por isso que a janela do verde é curta.
 *
 * Puro e sem imports: a régua prova-se sem base de dados nenhuma.
 */

/** De quanto em quanto tempo a ponte vem. É o `INTERVALO_MS` dela. */
export const RONDA_DA_PONTE_SEGUNDOS = 5;

/**
 * Até aqui está tudo bem. São doze rondas falhadas — folga que chegue para um
 * arranque a frio do Vercel ou um soluço de rede, sem chegar para esconder uma
 * ponte morta.
 */
export const SEGUNDOS_ATE_DESCONFIAR = 60;

/** A partir daqui é avaria: sessenta rondas sem aparecer não é rede. */
export const SEGUNDOS_ATE_ALARME = 5 * 60;

export type EstadoDaPonte = "viva" | "a-demorar" | "calada" | "nunca";

/** Os segundos desde o último carimbo. `null` quando nunca houve nenhum. */
export function segundosDesde(vistaEm: Date | string | null, agora: Date): number | null {
  if (!vistaEm) return null;
  const d = vistaEm instanceof Date ? vistaEm : new Date(vistaEm);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  /*
   * Um carimbo no futuro conta como agora mesmo, e não como um número
   * negativo. Os relógios da base e do servidor não são o mesmo relógio, e
   * alguns segundos de diferença não são uma avaria para mostrar a ninguém.
   */
  return Math.max(0, Math.floor((agora.getTime() - t) / 1000));
}

export function estadoDaPonte(vistaEm: Date | string | null, agora: Date): EstadoDaPonte {
  const s = segundosDesde(vistaEm, agora);
  if (s == null) return "nunca";
  if (s <= SEGUNDOS_ATE_DESCONFIAR) return "viva";
  if (s <= SEGUNDOS_ATE_ALARME) return "a-demorar";
  return "calada";
}

/**
 * «há 4 s», «há 26 min», «há 2 h».
 *
 * Nunca em segundos acima do minuto: «há 1847 s» obriga quem lê a fazer uma
 * conta, e quem abre este ecrã abre-o porque já tem um problema nas mãos.
 */
export function haQuantoTempo(segundos: number): string {
  if (segundos < 60) return `há ${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

export type FichaDaPonte = {
  estado: EstadoDaPonte;
  /** A linha grande: «A ponte veio há 4 s». */
  titulo: string;
  /** O que fazer, quando há o que fazer. Vazio quando está tudo bem. */
  explicacao: string;
};

/**
 * O que o painel mostra, numa frase.
 *
 * As palavras vivem aqui e não no componente porque são a metade do sinal que
 * interessa: um ponto vermelho sem dizer o que fazer manda a pessoa perguntar
 * a alguém, que é o custo que isto vem cortar.
 */
export function fichaDaPonte(vistaEm: Date | string | null, agora: Date): FichaDaPonte {
  const estado = estadoDaPonte(vistaEm, agora);
  const s = segundosDesde(vistaEm, agora);

  if (estado === "nunca") {
    return {
      estado,
      titulo: "A ponte nunca veio buscar nada",
      explicacao:
        "Desde que o site arrancou que ela não aparece. Confirme se está a correr no Railway, no projecto virtuous-creativity.",
    };
  }

  const quando = haQuantoTempo(s ?? 0);

  if (estado === "viva") {
    return { estado, titulo: `A ponte veio ${quando}`, explicacao: "" };
  }

  if (estado === "a-demorar") {
    return {
      estado,
      titulo: `A ponte veio ${quando}`,
      explicacao:
        "Devia vir de 5 em 5 segundos. Ainda pode ser um soluço de rede — se passar dos 5 minutos, é avaria.",
    };
  }

  return {
    estado,
    titulo: `A ponte não vem ${quando}`,
    explicacao:
      "Nada está a entrar nem a sair pelo WhatsApp. O que o assistente escrever fica na fila à espera. Veja o Railway (projecto virtuous-creativity): ou o serviço caiu, ou o telemóvel deixou de estar emparelhado e é preciso ler o código QR outra vez.",
  };
}
