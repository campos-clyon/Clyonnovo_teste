import { eDaEquipa, eMarcaDeImagem, MARCA_DE_AUDIO, oQueSeViuNaFotografia, semMarcaDeMao } from "./rajada-do-whatsapp";
import { servicosPorExtenso } from "./servicos-da-vitoria";

/**
 * A VITÓRIA LÊ AS CONVERSAS E FECHA AS QUE ACABARAM — 21-10-2026.
 *
 * *«Tanto a gente quanto o assistente sozinho pode ler as mensagens e ele
 * mesmo fechar o fluxo. Não estou a dizer que ele tenha de responder aos
 * clientes: lê as conversas e identifica que aquele serviço já foi
 * concluído.»* — o dono. E decidiu: quando ela conclui que acabou, fecha
 * sozinha, com o porquê escrito (reabre-se com um clique); e lê também as 193
 * que estavam em «Entregues a si».
 *
 * Aqui está o que se manda ao Gemini e como se lê a resposta. Quem escolhe as
 * conversas e fecha é `ler-as-conversas.ts`. Nunca se escreve ao cliente.
 */

export const ESTADOS_DA_LEITURA = ["resolvida", "por_responder", "a_espera_do_cliente", "a_meio", "em_curso"] as const;
export type EstadoDaLeitura = (typeof ESTADOS_DA_LEITURA)[number];

export type Leitura = { estado: EstadoDaLeitura; motivo: string };

/** As mensagens que se mostram ao modelo — as últimas, que é onde está o fim. */
export const MENSAGENS_LIDAS = 40;

// O que a CLYON faz sai da lista do site (`servicosPorExtenso`): dizia só
// recolhas, esvaziamentos e mudanças, e a manutenção da casa voltou (25-10-2026).
export const INSTRUCAO_DA_LEITURA = `És a Vitória, assistente da CLYON, uma empresa portuguesa de ${servicosPorExtenso()}. Vais ler uma conversa de WhatsApp entre um cliente e a CLYON, e dizer em que pé ela está. NÃO vais responder ao cliente — só classificar.

As linhas começam por quem escreveu: CLIENTE, VITÓRIA (a assistente automática) ou EQUIPA (uma pessoa da CLYON, à mão).

Devolve SÓ um objecto JSON: {"estado": "...", "motivo": "..."}

"estado" é um destes:
- "resolvida": a conversa ACABOU e não falta fazer nada do lado da CLYON. Exemplos: o serviço foi feito e ficou confirmado ou pago; o cliente disse que já não precisa, que arranjou outra empresa, ou recusou o orçamento; era só uma pergunta e já foi respondida, sem mais nada pendente; número errado, publicidade ou spam.
- "por_responder": o cliente perguntou ou pediu alguma coisa e ninguém lhe respondeu.
- "a_espera_do_cliente": a CLYON respondeu (mandou orçamento, pediu fotografias, a morada, uma data…) e falta o cliente responder.
- "a_meio": a recolha dos dados do pedido ficou a meio.
- "em_curso": há um serviço combinado por fazer — falta agendar, adjudicar, pagar ou fazer o trabalho.

Regras:
- Na dúvida, NÃO é "resolvida". Só é "resolvida" quando a razão está escrita na conversa.
- Um orçamento sem resposta do cliente NÃO é "resolvida": é "a_espera_do_cliente", por muito tempo que tenha passado.
- O cliente aceitar («combinado», «podemos prosseguir», «estou de acordo») NÃO é "resolvida": é "em_curso", ou "por_responder" se ninguém lhe respondeu.
- Um «obrigado» do cliente no fim, depois de tudo tratado, pode ser "resolvida"; depois de um orçamento por aceitar, não.

"motivo": uma frase curta em português de Portugal (no máximo 15 palavras) a dizer porquê. Exemplos: «o cliente disse que já arranjou quem fizesse», «serviço feito e pago», «só queria saber o preço — já respondido», «falta o cliente aceitar o orçamento de 135 €», «o cliente pediu para ligar amanhã».`;

/** Uma linha da conversa, como o modelo a lê. */
function linhaParaALeitura(m: { direccao: string; texto: string }): string | null {
  const t = (m.texto ?? "").trim();
  if (!t) return null;
  if (m.direccao === "in") {
    if (eMarcaDeImagem(t)) {
      const visto = oQueSeViuNaFotografia(t);
      return visto ? `CLIENTE: [mandou uma fotografia: ${visto}]` : "CLIENTE: [mandou uma imagem]";
    }
    if (t === MARCA_DE_AUDIO) return "CLIENTE: [mandou um áudio que não se ouviu]";
    if (t.startsWith(MARCA_DE_AUDIO)) return `CLIENTE: [áudio] ${t.slice(MARCA_DE_AUDIO.length).trim()}`;
    return `CLIENTE: ${t}`;
  }
  return eDaEquipa(t) ? `EQUIPA: ${semMarcaDeMao(t)}` : `VITÓRIA: ${t}`;
}

/**
 * O fio, em texto para o modelo: as últimas `MENSAGENS_LIDAS`, e quanto tempo
 * passou desde a última — «uma pergunta de há cinco dias» lê-se diferente de
 * uma de há cinco minutos. Puro.
 */
export function fioParaALeitura(
  mensagens: Array<{ direccao: string; texto: string }>,
  ultimaHa: string,
): string {
  const linhas = mensagens
    .slice(-MENSAGENS_LIDAS)
    .map(linhaParaALeitura)
    .filter((l): l is string => l != null)
    .map((l) => (l.length > 600 ? `${l.slice(0, 599)}…` : l));
  return `${linhas.join("\n")}\n\n(A última mensagem foi ${ultimaHa}.)`;
}

/** A resposta do modelo, validada — ou `null` quando não se percebe. Pura. */
export function lerALeitura(bruto: string | null | undefined): Leitura | null {
  if (!bruto) return null;
  const json = bruto.slice(bruto.indexOf("{"), bruto.lastIndexOf("}") + 1);
  if (!json) return null;
  try {
    const o = JSON.parse(json) as { estado?: unknown; motivo?: unknown };
    const estado = String(o.estado ?? "").trim() as EstadoDaLeitura;
    if (!ESTADOS_DA_LEITURA.includes(estado)) return null;
    const motivo = String(o.motivo ?? "")
      .replace(/\s+/g, " ")
      .replace(/^["«]+|["»]+$/g, "")
      .trim()
      .slice(0, 200);
    // Fechar sem razão escrita não se faz — ver as regras do aviso.
    if (estado === "resolvida" && motivo.length < 3) return null;
    return { estado, motivo };
  } catch {
    return null;
  }
}

/**
 * Pede a leitura ao Gemini. Nunca atira: sem chave, com o modelo em baixo ou
 * com uma resposta que não se percebe, devolve `null` — e a conversa fica
 * como estava, para a próxima passagem.
 */
export async function lerAConversa(fio: string): Promise<Leitura | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !fio.trim()) return null;
  const { escadaDeModelos, modeloDoAssistente, porDeCastigo } = await import("./whatsapp-compreensao");
  const modelos = await escadaDeModelos(modeloDoAssistente());
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(apiKey);
  for (const [i, nome] of modelos.slice(0, 2).entries()) {
    const segundos = i === 0 ? 20 : 12;
    const comecou = Date.now();
    try {
      const model = client.getGenerativeModel({
        model: nome,
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      });
      const resposta = await Promise.race([
        model.generateContent([{ text: INSTRUCAO_DA_LEITURA }, { text: `A CONVERSA:\n\n${fio}` }]),
        new Promise<never>((_, rejeitar) =>
          setTimeout(() => rejeitar(new Error(`demorou mais de ${segundos} s`)), segundos * 1000),
        ),
      ]);
      return lerALeitura(resposta.response.text());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[whatsapp/leitura] ${nome} falhou aos ${Date.now() - comecou} ms:`, msg);
      await porDeCastigo(nome, msg);
    }
  }
  return null;
}
