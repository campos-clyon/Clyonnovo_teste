/**
 * O EVENTO NA AGENDA DO GOOGLE VAI-SE COM O PEDIDO.
 *
 * Apagar um pedido apagava a linha, as negociações e as fotografias — e
 * deixava, na agenda partilhada da CLYON, um evento com o nome do cliente, a
 * morada, o andar, o telefone e a descrição operacional inteira. Para sempre.
 *
 * Pior: o ponteiro para ele — `simulatorOrders.calendarEventId` — desaparecia
 * com a linha. Ninguém conseguia voltar a encontrá-lo para o apagar, nem sequer
 * saber que existia. Um cliente que exercesse o direito ao apagamento ficava
 * com os dados numa agenda a que ninguém se lembra de ir.
 *
 * Isto só se agrava quando a purga for armada: passa a acontecer todas as
 * noites, sozinho, sem ninguém a ver. Verificado a 14-09-2026: não havia um
 * único `events.delete` no repositório inteiro.
 *
 * FALHAR AQUI NÃO DESFAZ NADA. O pedido já está apagado quando isto corre — é
 * de propósito, a mesma ordem das fotografias no Blob: primeiro a transacção
 * fecha, depois vão-se as coisas que vivem fora da base. Se a Google estiver em
 * baixo, fica escrito nos registos com o id do evento, que é o que permite
 * apagá-lo à mão.
 */

/** A chave privada como ela vem do ambiente — com os \n por desescapar. */
function chavePrivada(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\n/g, "\n")
    .replace(/\r/g, "");
}

/**
 * A agenda onde o evento foi criado.
 *
 * O pedido guarda a sua (`calendarTargetId`) desde que a rota passou a
 * escrevê-la — e é essa que manda, porque a variável de ambiente pode ter
 * mudado desde que o evento foi criado. Apagar na agenda de hoje um evento
 * que ficou na de ontem não apaga nada, e ninguém dava por isso.
 *
 * Sem ela, a mesma regra da rota que os cria, incluindo a defesa contra um id
 * de exemplo («<id real...>») ter ficado na variável.
 */
export function agendaDaClyon(guardada?: string | null): string {
  const doPedido = (guardada ?? "").trim();
  if (doPedido && !doPedido.includes("<") && !doPedido.includes(">")) return doPedido;

  const raw = (process.env.CLYON_GOOGLE_CALENDAR_ID ?? "")
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/\r|\n/g, "");
  if (!raw || raw.includes("<") || raw.includes(">")) return "geral@clyon.pt";
  return raw;
}

/**
 * Um id que a Google reconheça.
 *
 * `clyon-order-...` é um marcador nosso de antes de haver agenda a sério — a
 * própria rota o trata como "ainda não existe evento". Pedir à Google que o
 * apague é uma chamada de rede para receber um 404.
 */
export function eEventoASerio(eventId: string | null | undefined): boolean {
  const id = (eventId ?? "").trim();
  return id.length > 0 && !id.startsWith("clyon-order-");
}

export type FimDoEvento = {
  /** Foi apagado agora. */
  apagado: boolean;
  /** Já lá não estava — o que também é o resultado que se queria. */
  naoExistia?: boolean;
  /** Ficou por apagar, e isto é o que o impediu. */
  erro?: string;
};

/**
 * Apaga um evento da agenda. Devolve o que aconteceu, e NUNCA atira.
 *
 * Quem chama está a acabar de apagar um pedido. Uma excepção aqui subia por
 * cima de uma transacção já fechada e fazia parecer que o apagar falhou,
 * quando o pedido já se foi. O resultado diz o que houve; o erro fica escrito.
 */
export async function apagarEventoDoCalendario(
  eventId: string | null | undefined,
  calendarId?: string | null,
): Promise<FimDoEvento> {
  if (!eEventoASerio(eventId)) return { apagado: false, naoExistia: true };
  const id = (eventId as string).trim();

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!clientEmail || !key) {
    return { apagado: false, erro: "Google Calendar não configurado neste ambiente." };
  }

  try {
    const { google } = await import("googleapis");
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: chavePrivada(key),
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.delete({ calendarId: agendaDaClyon(calendarId), eventId: id });
    return { apagado: true };
  } catch (e) {
    const err = e as { code?: number | string; message?: string };
    const msg = err?.message ?? String(e);
    /*
     * 404 e 410 são "já lá não está", e isso é o resultado que se queria.
     * Contá-los como falha enchia os registos de alarmes sobre trabalho feito.
     */
    const codigo = Number(err?.code);
    if (codigo === 404 || codigo === 410 || /\b(404|410)\b/.test(msg) || /not found|already deleted/i.test(msg)) {
      return { apagado: false, naoExistia: true };
    }
    console.error("[apagarEventoDoCalendario] evento", id, "ficou na agenda:", msg);
    return { apagado: false, erro: msg.slice(0, 300) };
  }
}
