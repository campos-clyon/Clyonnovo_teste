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

/**
 * A chave privada como ela vem do ambiente.
 *
 * A Vercel entrega-a numa linha só, com os `\n` LITERAIS — barra invertida
 * mais a letra n, dois caracteres — e é preciso trocá-los por quebras de linha
 * a sério ou o PEM não assina nada.
 *
 * ESTA LINHA JÁ ESTEVE ERRADA, E PASSOU POR TODOS OS TESTES. Estava
 * `.replace(/\n/g, "\n")`: num literal de expressão regular, `/\n/` é a quebra
 * de linha a sério, e o substituto é a mesma quebra de linha. Trocava uma
 * quebra de linha por uma quebra de linha — uma operação nula. A chave chegava
 * ao `google.auth.JWT` numa linha só, a assinatura rebentava com
 * «DECODER routines::unsupported», o catch apanhava, e o resultado era
 * `{ apagado: false }` em TODAS as chamadas: nenhum evento saía da agenda e a
 * purga contava-os como «ficaram». Uma funcionalidade inteira, feita por causa
 * do RGPD, que nunca teria apagado nada.
 *
 * Os outros três sítios do repositório que lêem esta variável escrevem-na bem
 * — `normalizePrivateKey` em pedidos/[id]/calendar/route.ts, o diagnóstico em
 * calendar/debug, e google-sheets.ts. São três cópias da mesma regra, e esta
 * foi a quarta a divergir à primeira tentativa. Há um teste em baixo que lhe
 * dá uma chave na forma escapada e exige quebras de linha a sério à saída.
 */
export function chavePrivada(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
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
  /**
   * Não havia nada para apagar, e isso é uma passagem limpa: sem id, um
   * marcador nosso, ou a Google a dizer 410 («foi apagado»).
   */
  naoExistia?: boolean;
  /**
   * A GOOGLE RESPONDEU 404 — E ISSO NÃO É BOA NOTÍCIA.
   *
   * Ela devolve o mesmo 404 para «este evento já não existe» e para «esta
   * agenda não existe, ou não está partilhada contigo» — a rota que cria os
   * eventos já trata o 404 como o segundo caso, e diz-o ao utilizador. Contar
   * os dois como «já não estava» fazia uma passagem em que os cem eventos
   * falharam por a agenda ter deixado de estar partilhada ler-se, no registo,
   * como cem apagados com sucesso.
   *
   * Fica à parte para que um número alto se leia pelo que é: configuração
   * partida, e não trabalho feito.
   */
  naoEncontrado?: boolean;
  /** Ficou por apagar, e isto é o que o impediu. */
  erro?: string;
};

/**
 * O código HTTP da resposta, quando houve uma.
 *
 * NÃO SE CLASSIFICA PELO TEXTO DA MENSAGEM. A primeira versão fazia
 * `/not found/i.test(msg)` e lia «invalid_grant: Invalid grant: account not
 * found» — que é a service account apagada no Google Cloud, uma avaria de
 * autenticação — como «o evento já não estava». Com a agenda inteira intacta e
 * nada apagado, a purga escrevia uma noite inteira de sucessos.
 *
 * `undefined` quando não houve resposta nenhuma: rede, DNS, o token a falhar.
 * Isso nunca é «já não estava».
 */
function codigoDaResposta(e: unknown): number | undefined {
  const err = e as {
    code?: number | string;
    status?: number;
    response?: { status?: number };
  };
  const bruto = err?.response?.status ?? err?.status ?? err?.code;
  const n = typeof bruto === "string" ? Number(bruto) : bruto;
  return typeof n === "number" && Number.isFinite(n) && n >= 100 && n < 600 ? n : undefined;
}

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
    const msg = (e as { message?: string })?.message ?? String(e);
    const codigo = codigoDaResposta(e);

    // 410 é a Google a dizer «isto foi apagado». É o resultado que se queria.
    if (codigo === 410) return { apagado: false, naoExistia: true };

    // 404 pode ser o evento OU a agenda. Ver `naoEncontrado`.
    if (codigo === 404) {
      console.warn("[apagarEventoDoCalendario] 404 no evento", id, "— evento ou agenda:", msg);
      return { apagado: false, naoEncontrado: true };
    }

    console.error("[apagarEventoDoCalendario] evento", id, "ficou na agenda:", msg);
    return { apagado: false, erro: msg.slice(0, 300) };
  }
}
