import {
  NOME_DA_LINGUA,
  PORTUGUES,
  TITULO_DO_BOTAO_MAX,
  precisaDeTraducao,
  type Lingua,
} from "./lingua-do-cliente";

/**
 * ESCREVER NA LÍNGUA DE QUEM LÊ.
 *
 * O texto nasce sempre em português — é assim que está escrito nos trinta e
 * cinco sítios que falam com o cliente, e não vale a pena mexer em nenhum
 * deles. Traduz-se à saída, no último momento, para o que a pessoa escreveu.
 *
 * FALHAR AQUI É DEVOLVER O PORTUGUÊS. Sem chave, sem rede, com o Gemini em
 * baixo ou a demorar: sai o original. O pior caso desta função é exactamente o
 * comportamento de ontem — uma mensagem em português — e nunca o silêncio, que
 * seria muito pior do que a língua errada.
 *
 * O QUE NÃO SE TRADUZ está na instrução, e é metade do trabalho: os valores, o
 * número do pedido, as moradas, os nomes dos profissionais e a palavra CLYON.
 * Um «pedido #316» que vire «request #316» ainda se percebe; um «600,00 €» que
 * vire «$600.00» é outro preço.
 */

/*
 * ⚠️ O TRADUTOR ESTEVE MORTO UM MÊS — 14-10-2026.
 *
 *   CLIENTE: Hello, I just sent a request for collection of bulky items…
 *   CLYON:   Bom dia! Aqui é a Vitória, assistente online da CLYON 😊 …
 *   CLIENTE: Thank you, my name is Hannah
 *   CLYON:   De nada. Qualquer coisa, é só dizer.
 *
 * — a Hannah. «A Vitória deveria adaptar-se ao idioma do cliente; tivemos de
 * continuar à mão.» — o dono. A língua dela estava detectada; quem falhava era
 * isto: o modelo por omissão era o 2.5 flash, e a Google retirou-o a
 * 15-09-2026 (ver `modelo-do-gemini.ts`). Cada tradução dava 404 e saía o
 * português, calado, como esta função manda.
 *
 * A varredura desse dia, que trocou o nome em seis ficheiros, não passou por
 * aqui: a chave da cache tinha um carácter NUL escrito à mão, e o `grep` lia o
 * ficheiro como binário e saltava-o. A chave é agora texto, e o modelo é o do
 * assistente, com a mesma escada e o mesmo castigo de quem fica sem quota.
 */

/** Quanto se espera por cada degrau da escada antes de passar ao seguinte. */
const SEGUNDOS = 8;

/**
 * O que já se traduziu, nesta instância.
 *
 * A recolha faz as mesmas seis perguntas a toda a gente. Sem isto, cada
 * «Em que andar é?» era uma ida ao Gemini — e o mesmo dinheiro e os mesmos
 * segundos, repetidos para sempre. O tecto existe porque uma instância que
 * sirva mil conversas não pode guardar mil traduções.
 */
const GUARDADAS = new Map<string, string>();
const TECTO_DA_CACHE = 300;

function lembrar(chave: string, valor: string): void {
  if (GUARDADAS.size >= TECTO_DA_CACHE) {
    // Deita fora a mais antiga: o Map do JavaScript mantém a ordem de entrada.
    const primeira = GUARDADAS.keys().next().value;
    if (primeira !== undefined) GUARDADAS.delete(primeira);
  }
  GUARDADAS.set(chave, valor);
}

function instrucoes(lingua: Lingua): string {
  /*
   * «UMA EMPRESA DE MUDANÇAS» — 29-09-2026. A CLYON não faz mudanças nem
   * recolhas: liga os clientes aos profissionais que as fazem. Um tradutor que
   * acha que traduz para uma transportadora escolhe «we will move your
   * furniture» onde a mensagem diz que é o profissional que o faz.
   */
  return [
    `És o tradutor da CLYON, uma plataforma portuguesa que liga clientes a profissionais ` +
      `independentes de mudanças, recolhas e outros serviços da casa. Quem faz o trabalho ` +
      `é o profissional que o cliente escolhe, e não a CLYON.`,
    `Recebes uma mensagem escrita em português e devolves a MESMA mensagem em ${NOME_DA_LINGUA[lingua]}.`,
    ``,
    `REGRAS:`,
    `- Devolve SÓ a tradução. Sem aspas à volta, sem explicações, sem alternativas.`,
    `- Mantém exactamente iguais: valores e moedas (600,00 €), números de pedido`,
    `  (#316), percentagens, datas, horas, moradas, códigos postais, links, e os`,
    `  nomes próprios — de pessoas, de empresas e de profissionais.`,
    `- Não traduzas a palavra CLYON.`,
    `- Mantém as quebras de linha, os traços de lista e os emoji onde estão.`,
    `- Mantém o tom: directo, cordial, de quem trata de um serviço por WhatsApp.`,
    `  Sem formalidades a mais e sem linguagem de folheto.`,
    `- Quem escreve é a Vitória, assistente online da CLYON: fala no feminino`,
    `  onde a língua o marcar ("Obrigada", "encantada"), e com a mesma delicadeza.`,
    `- Se a mensagem pedir uma resposta com uma palavra (por exemplo "responda SIM"),`,
    `  traduz essa palavra e mantém-na em maiúsculas, para a pessoa saber o que escrever.`,
  ].join("\n");
}

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

async function pedirAoGemini(texto: string, lingua: Lingua): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    await anotar("tradutor", "sem GEMINI_API_KEY — saiu em português");
    return null;
  }
  let ultimoMotivo = "nenhum modelo respondeu";

  // O modelo do assistente, com a escada e o castigo dele — ver o aviso acima.
  const { modeloDoAssistente, escadaDeModelos, porDeCastigo } = await import("./whatsapp-compreensao");
  const escada = await escadaDeModelos(modeloDoAssistente());
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(apiKey);

  for (const modelName of escada) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: instrucoes(lingua),
        generationConfig: { temperature: 0 },
      });

      const resposta = await Promise.race([
        model.generateContent(texto),
        new Promise<never>((_, rejeitar) =>
          setTimeout(() => rejeitar(new Error(`demorou mais de ${SEGUNDOS} s`)), SEGUNDOS * 1000),
        ),
      ]);

      const saiu = resposta.response.text().trim();
      if (saiu) {
        await anotar("tradutor", null);
        return saiu;
      }
      ultimoMotivo = `${modelName} devolveu uma resposta vazia`;
    } catch (e) {
      // Um tradutor em baixo não pode calar o assistente: tenta-se o degrau
      // seguinte, e no fim quem chama fica com o português.
      const msg = e instanceof Error ? e.message : String(e);
      ultimoMotivo = `${modelName}: ${msg}`;
      console.error(`[traduzir] ${modelName} falhou (${lingua}):`, msg);
      await porDeCastigo(modelName, msg);
    }
  }
  // Saiu em português — e agora diz-se, no painel do WhatsApp (d7).
  await anotar("tradutor", `${ultimoMotivo} — saiu em português (${lingua})`);
  return null;
}

/**
 * A mensagem na língua do cliente — ou em português, se alguma coisa correr mal.
 */
export async function traduzirParaOCliente(
  texto: string,
  lingua: Lingua | null | undefined,
): Promise<string> {
  if (!precisaDeTraducao(lingua) || !texto.trim()) return texto;
  const alvo = lingua as Lingua;

  const chave = JSON.stringify([alvo, texto]);
  const jaVista = GUARDADAS.get(chave);
  if (jaVista !== undefined) return jaVista;

  const traduzida = await pedirAoGemini(texto, alvo);
  if (!traduzida) return texto;

  lembrar(chave, traduzida);
  return traduzida;
}

/**
 * O título de um botão, que tem 20 caracteres e nem um a mais.
 *
 * É limite da API do WhatsApp, não nosso: um título maior faz a mensagem
 * INTEIRA ser recusada. Entre um botão em português que aparece e um em inglês
 * que rebenta a mensagem toda, fica o português — a pessoa ainda percebe
 * «Fechar 600 €» pelo número, e não percebe nada de uma mensagem que não chega.
 */
export async function traduzirTituloDeBotao(
  titulo: string,
  lingua: Lingua | null | undefined,
): Promise<string> {
  if (!precisaDeTraducao(lingua)) return titulo;
  const traduzido = (await traduzirParaOCliente(titulo, lingua)).trim();
  if (!traduzido || traduzido.length > TITULO_DO_BOTAO_MAX) return titulo;
  return traduzido;
}

/** Para os testes e para o painel: esquecer o que está guardado. */
export function esquecerTraducoes(): void {
  GUARDADAS.clear();
}

export { PORTUGUES };
