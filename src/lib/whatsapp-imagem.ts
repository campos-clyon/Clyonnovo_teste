import { fazManutencaoDaCasa, servicosPorExtenso } from "./servicos-da-vitoria";

/**
 * O QUE SE VÊ NUMA FOTOGRAFIA DO CLIENTE — 21-10-2026.
 *
 * *«Quer que a Vitória passe também a ver o que está nas imagens?» — «Sim,
 * quero.»* — o dono, no dia a seguir a ela ter aprendido a agradecê-las.
 *
 * A ponte traz a fotografia já descarregada; o Gemini, o mesmo que ouve os
 * áudios (`whatsapp-audio.ts`), diz numa frase o que nela é para levar ou
 * fazer. A frase fica no fio a seguir à marca — «[fotografia] cerca de 30
 * sacos de entulho numa sala» —, vai para a descrição do pedido, e quando o
 * cliente ainda não disse o serviço é por ela que a Vitória o adivinha (e
 * diz que adivinhou, para ele corrigir).
 *
 * Cada fotografia é uma chamada ao modelo, e isso custa: só se vêem as de
 * quem ainda não tem pedido, e só as primeiras de cada rajada
 * (`IMAGENS_VISTAS_POR_RAJADA`). Os vídeos não se vêem — a ponte não os
 * descarrega.
 */

/** Quantas fotografias de uma rajada se mostram ao modelo — o resto conta, mas não se vê. */
export const IMAGENS_VISTAS_POR_RAJADA = 6;

/*
 * O QUE A CLYON FAZ, DITO AO MODELO, É A LISTA DO SITE — 25-10-2026.
 *
 * Dizia «recolhas, esvaziamentos e mudanças», e a manutenção da casa
 * (reparações e remodelações) voltou nesse dia: uma torneira a pingar ou uma
 * parede por pintar também são «para fazer», e é pela frase que a Vitória
 * adivinha o serviço (`aplicarOQueSeViu`). A frase dos serviços sai de
 * `servicosPorExtenso`, e a das reparações só enquanto a manutenção lá estiver.
 */
export const INSTRUCAO_DA_IMAGEM =
  `Esta fotografia foi enviada por WhatsApp por um cliente da CLYON, uma plataforma portuguesa que liga clientes a profissionais verificados de ${servicosPorExtenso()}, ` +
  "para pedir um orçamento. Diz numa frase curta (no máximo 20 palavras), " +
  "em português de Portugal, o que se vê que é para levar ou fazer: o tipo de coisas e mais ou menos " +
  "quantas, e o sítio se se perceber (sótão, garagem, sala, rua, quintal). Chama as coisas pelo nome: " +
  "«entulho» (sacos de obra, tijolos, caliça, terra), «móveis» (sofá, mesa, armário, cama…), " +
  "«electrodomésticos», «colchão», «caixas», «sacos», «ramos e restos de jardim». " +
  (fazManutencaoDaCasa()
    ? "Se for um arranjo na casa, diz o que é para reparar, pintar ou remodelar, e onde " +
      "(«torneira a pingar na cozinha», «parede para pintar na sala», «casa de banho para remodelar»). "
    : "") +
  "Começa logo pelas coisas, sem «Na imagem» nem «Vejo». Sem preços, sem cumprimentos, sem falar de pessoas. " +
  "Se a fotografia não mostrar nada para levar ou fazer (uma captura de ecrã, um documento, uma pessoa, " +
  "uma paisagem), devolve exactamente: (nada)";

/** A frase do modelo, limpa — ou `null` quando não há nada para levar. Pura. */
export function limparOQueSeVe(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  let t = bruto
    .trim()
    .replace(/^["“«']+|["”»']+$/g, "")
    .replace(/^(na|nesta)\s+(imagem|fotografia|foto)[^,:]*[,:]\s*/i, "")
    .replace(/^vejo\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || /^\(?\s*nada\s*\)?\.?$/i.test(t)) return null;
  t = t.replace(/[.\s]+$/, "");
  return `${t.charAt(0).toLowerCase()}${t.slice(1)}`.slice(0, 300);
}

/** Só imagens: o resto (um PDF, um autocolante) não se manda ao modelo. */
function mimeDaImagem(mime: string | null | undefined): string {
  const base = String(mime ?? "").split(";")[0].trim().toLowerCase();
  return base.startsWith("image/") ? base : "image/jpeg";
}

/**
 * Pergunta ao Gemini o que se vê. Nunca atira: sem chave, sem resposta ou
 * com o modelo em baixo, devolve `null` — e a fotografia conta na mesma,
 * como antes, só sem a frase.
 */
/**
 * O TERMÓMETRO DESTE USO — 27-10-2026 (d7). Ver `saude-da-ia.ts`. Nunca atira.
 */
async function anotar(uso: "tradutor" | "leitura" | "imagem", motivo: string | null): Promise<void> {
  try {
    const { anotarSaudeDaIa } = await import("./saude-da-ia-na-base");
    await anotarSaudeDaIa(uso, motivo);
  } catch {
    /* sem base, sem termómetro — e o resto segue na mesma */
  }
}

export async function verAImagem(base64: string, mime: string | null): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  // Sem chave não se anota aqui: a passagem da leitura das conversas já o diz (d7).
  if (!apiKey || !base64) return null;
  let ultimoMotivo = "nenhum modelo respondeu";

  const { escadaDeModelos, modeloDoAssistente, porDeCastigo } = await import("./whatsapp-compreensao");
  const modelos = await escadaDeModelos(modeloDoAssistente());
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(apiKey);

  // Pouco tempo de propósito: a resposta ao cliente ainda espera pela rajada
  // depois disto, e a rota da ponte tem 60 s ao todo.
  for (const [i, nome] of modelos.slice(0, 2).entries()) {
    const segundos = i === 0 ? 10 : 6;
    const comecou = Date.now();
    try {
      const model = client.getGenerativeModel({ model: nome, generationConfig: { temperature: 0 } });
      const resposta = await Promise.race([
        model.generateContent([{ inlineData: { data: base64, mimeType: mimeDaImagem(mime) } }, { text: INSTRUCAO_DA_IMAGEM }]),
        new Promise<never>((_, rejeitar) =>
          setTimeout(() => rejeitar(new Error(`demorou mais de ${segundos} s`)), segundos * 1000),
        ),
      ]);
      const visto = limparOQueSeVe(resposta.response.text());
      console.log(`[whatsapp/imagem] ${nome}: ${visto ? `«${visto.slice(0, 60)}»` : "nada para levar"}, ${Date.now() - comecou} ms`);
      await anotar("imagem", null);
      return visto;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ultimoMotivo = `${nome}: ${msg}`;
      console.error(`[whatsapp/imagem] ${nome} falhou aos ${Date.now() - comecou} ms:`, msg);
      await porDeCastigo(nome, msg);
    }
  }
  await anotar("imagem", ultimoMotivo);
  return null;
}
