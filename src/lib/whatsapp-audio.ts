/**
 * OS ÁUDIOS DO WHATSAPP, OUVIDOS PELO GEMINI — 06-10-2026.
 *
 * «Quando um cliente manda um áudio, o que faz o assistente?» — «Ouve e
 * responde.» Até aqui a ponte deitava-os fora: um áudio não tem texto, e o que
 * não tinha texto não chegava ao site. O cliente ficava sem resposta e o
 * painel nem sabia que ele tinha falado.
 *
 * O Gemini passa o áudio a texto, e daí para a frente é uma mensagem como as
 * outras: entra na rajada, vai ao cérebro, e fica no fio com a marca «[áudio]»
 * à frente, para quem lê o painel saber que foi dito e não escrito.
 *
 * FALHAR AQUI É PEDIR PARA ESCREVER, e nunca o silêncio. Sem chave, sem quota,
 * ou com um áudio que só tem barulho, o cliente ouve que não se conseguiu
 * ouvir e que pode escrever — `PEDIR_PARA_ESCREVER`.
 *
 * A canalização do modelo é a da compreensão (a escada, e o castigo de quem
 * está sem quota): uma segunda cópia divergia no dia em que alguém corrigisse
 * uma.
 */

/** A frase de quando não se conseguiu ouvir. Sai à pessoa, e só a ela. */
export const PEDIR_PARA_ESCREVER =
  "Recebi o seu áudio, mas não o consegui ouvir. Pode escrever-me o que precisa?";

/**
 * O que o Gemini aceita como áudio. O WhatsApp manda as notas de voz como
 * «audio/ogg; codecs=opus» — o parâmetro sai — e os ficheiros de música como
 * «audio/mpeg», que para a Google se chama mp3.
 */
export function mimeParaOGemini(mime: string | null | undefined): string {
  const base = String(mime ?? "").split(";")[0].trim().toLowerCase();
  if (!base.startsWith("audio/")) return "audio/ogg";
  if (base === "audio/mpeg") return "audio/mp3";
  return base;
}

/**
 * O que o Gemini devolveu, limpo: sem aspas à volta, e null quando não houve
 * fala que se percebesse.
 */
export function limparTranscricao(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  const t = bruto
    .trim()
    .replace(/^["“«']+|["”»']+$/g, "")
    .trim();
  if (!t || /^\(?\s*vazio\s*\)?\.?$/i.test(t)) return null;
  return t.slice(0, 4000);
}

const INSTRUCAO =
  "Transcreve este áudio de WhatsApp, palavra por palavra, na língua em que foi falado " +
  "(quase sempre português de Portugal ou do Brasil). Devolve SÓ o texto dito: sem aspas, " +
  "sem comentários, sem descrever sons nem quem fala. Se não houver fala que se perceba, " +
  "devolve exactamente: (vazio)";

/**
 * O áudio em texto, ou null.
 *
 * Vinte segundos para o primeiro modelo e doze para o de reserva: quem mandou
 * um áudio está à espera de uma resposta, e a seguir a isto ainda vem a
 * rajada e o cérebro. O que já não cabe aqui volta como «escreva, por favor».
 */
export async function transcreverAudio(base64: string, mime: string | null): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !base64) return null;

  const { escadaDeModelos, modeloDoAssistente, porDeCastigo } = await import("./whatsapp-compreensao");
  const modelos = await escadaDeModelos(modeloDoAssistente());
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(apiKey);

  for (const [i, nome] of modelos.entries()) {
    const segundos = i === 0 ? 20 : 12;
    const comecou = Date.now();
    try {
      const model = client.getGenerativeModel({ model: nome, generationConfig: { temperature: 0 } });
      const resposta = await Promise.race([
        model.generateContent([
          { inlineData: { data: base64, mimeType: mimeParaOGemini(mime) } },
          { text: INSTRUCAO },
        ]),
        new Promise<never>((_, rejeitar) =>
          setTimeout(() => rejeitar(new Error(`demorou mais de ${segundos} s`)), segundos * 1000),
        ),
      ]);
      const texto = limparTranscricao(resposta.response.text());
      console.log(
        `[whatsapp/audio] ${nome}: ${texto ? `${texto.length} caracteres` : "sem fala"}, ${Date.now() - comecou} ms`,
      );
      // Sem fala é uma resposta: outro modelo não ouve o que lá não está.
      return texto;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[whatsapp/audio] ${nome} falhou aos ${Date.now() - comecou} ms:`, msg);
      await porDeCastigo(nome, msg);
    }
  }
  return null;
}
