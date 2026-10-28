import {
  NOME_DA_LINGUA,
  PORTUGUES,
  TITULO_DO_BOTAO_MAX,
  precisaDeTraducao,
  type Lingua,
} from "./lingua-do-cliente";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";

/**
 * ESCREVER NA LÍNGUA DE QUEM LÊ.
 *
 * O texto nasce sempre em português — é assim que está escrito nos trinta e
 * cinco sítios que falam com o cliente, e não vale a pena mexer em nenhum
 * deles. Traduz-se à saída, no último momento, para o que a pessoa escreveu.
 *
 * FALHAR AQUI ERA DEVOLVER O PORTUGUÊS. Desde 28-10-2026 (decisão d35) é
 * devolver a tradução fixa e revista (`traducoes-fixas-da-vitoria`); e, para a
 * Vitória, sem ela não sai nada — a conversa passa à equipa, que escreve na
 * língua do cliente (`traduzirSemLinguaErrada`). O português continua a ser o
 * último recurso só do que uma pessoa escreve à mão e dos avisos.
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

/*
 * ⚠️ OITO SEGUNDOS ERAM POUCOS — 28-10-2026 (decisão d35).
 *
 * «gemini-3.6-flash: demorou mais de 8 s — saiu em português (en)», duas
 * vezes seguidas, no dia em que um cliente que pediu «Do you speak English?»
 * levou o resumo em português. Não se mede a demora sem a chave (está só na
 * Vercel); estima-se pelo vizinho: a leitura das conversas, com o mesmo
 * modelo e um aviso bem maior, tem 18 s na primeira tentativa e 10 s na
 * segunda. Uma tradução é mais curta: 12 s na primeira, UMA nova tentativa de
 * 8 s quando a falha é de tempo ou do servidor, e só então o modelo leve
 * (`GEMINI_MODELO_LEVE`, se estiver definido na Vercel — não se inventa um
 * nome de modelo) com 6 s. Tudo dentro de um tecto de 26 s: a rota da ponte
 * tem 60 s, e antes da tradução já correram a janela da rajada (8 s) e a
 * leitura da mensagem.
 *
 * Se mesmo assim falhar, há as traduções fixas (`traducoes-fixas-da-vitoria`)
 * — e, sem elas, a mensagem NÃO sai em português a um cliente estrangeiro:
 * a conversa passa à equipa (ver `whatsapp-cloud.ts`).
 */
/** Quanto se espera pela primeira tentativa. */
const SEGUNDOS = 12;
/** A nova tentativa, no mesmo modelo, quando a primeira falhou por tempo ou pelo servidor. */
const SEGUNDOS_DA_NOVA_TENTATIVA = 8;
/** O modelo leve, por último. */
const SEGUNDOS_DO_MODELO_LEVE = 6;
/** O tecto de tudo junto. */
const TECTO_EM_SEGUNDOS = 26;
/** Abaixo disto não vale a pena começar outra tentativa. */
const MINIMO_POR_TENTATIVA = 3;

/** O modelo leve configurado na Vercel — ou nada. Nunca um nome escrito aqui. */
export function modeloLeve(): string | null {
  const nome = process.env.GEMINI_MODELO_LEVE?.trim();
  return nome ? nome : null;
}

/** Falhou por tempo ou pelo servidor (vale a pena tentar outra vez), e não por quota ou acesso. */
export function valeTentarOutraVez(motivo: string): boolean {
  return /demorou|timeout|timed out|\b50[0-4]\b|unavailable|overloaded|internal|fetch failed|ECONNRESET|ETIMEDOUT|socket/i.test(motivo);
}

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

type PedidoAoGemini = { saiu: string; motivo: null } | { saiu: null; motivo: string };

/**
 * AS TENTATIVAS, POR ORDEM — 28-10-2026 (decisão d35). A escada do assistente
 * (o primeiro degrau com UMA nova tentativa, se falhou por tempo ou pelo
 * servidor), e o modelo leve no fim. Cada uma com o seu prazo, todas dentro
 * do tecto.
 */
async function pedirAoGemini(texto: string, lingua: Lingua): Promise<PedidoAoGemini> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { saiu: null, motivo: "sem GEMINI_API_KEY" };
  let ultimoMotivo = "nenhum modelo respondeu";

  // O modelo do assistente, com a escada e o castigo dele — ver o aviso acima.
  const { modeloDoAssistente, escadaDeModelos, porDeCastigo } = await import("./whatsapp-compreensao");
  const escada = await escadaDeModelos(modeloDoAssistente());
  const leve = modeloLeve();
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(apiKey);
  const comecou = Date.now();
  const restam = () => TECTO_EM_SEGUNDOS - (Date.now() - comecou) / 1000;

  const tentar = async (modelName: string, segundos: number): Promise<string | null> => {
    const prazo = Math.min(segundos, restam());
    if (prazo < MINIMO_POR_TENTATIVA) {
      ultimoMotivo = `${ultimoMotivo} (sem tempo para mais tentativas)`;
      return null;
    }
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: instrucoes(lingua),
        generationConfig: { temperature: 0 },
      });
      let relogio: ReturnType<typeof setTimeout> | undefined;
      const resposta = await Promise.race([
        model.generateContent(texto),
        new Promise<never>((_, rejeitar) => {
          relogio = setTimeout(() => rejeitar(new Error(`demorou mais de ${Math.round(prazo)} s`)), prazo * 1000);
        }),
      ]).finally(() => clearTimeout(relogio));
      const saiu = resposta.response.text().trim();
      if (saiu) return saiu;
      ultimoMotivo = `${modelName} devolveu uma resposta vazia`;
    } catch (e) {
      // Um tradutor em baixo não pode calar o assistente: tenta-se outra vez,
      // ou o degrau seguinte; no fim decide quem chama.
      const msg = e instanceof Error ? e.message : String(e);
      ultimoMotivo = `${modelName}: ${msg}`;
      console.error(`[traduzir] ${modelName} falhou (${lingua}):`, msg);
      await porDeCastigo(modelName, msg);
    }
    return null;
  };

  const vistos = new Set<string>();
  for (const [i, modelName] of escada.entries()) {
    vistos.add(modelName);
    const primeira = await tentar(modelName, i === 0 ? SEGUNDOS : SEGUNDOS_DA_NOVA_TENTATIVA);
    if (primeira) return { saiu: primeira, motivo: null };
    // UMA nova tentativa, só no primeiro degrau e só se a falha foi de tempo ou do servidor.
    if (i === 0 && valeTentarOutraVez(ultimoMotivo)) {
      const outra = await tentar(modelName, SEGUNDOS_DA_NOVA_TENTATIVA);
      if (outra) return { saiu: outra, motivo: null };
    }
  }
  if (leve && !vistos.has(leve)) {
    const doLeve = await tentar(leve, SEGUNDOS_DO_MODELO_LEVE);
    if (doLeve) return { saiu: doLeve, motivo: null };
  }
  return { saiu: null, motivo: ultimoMotivo };
}

/**
 * A MENSAGEM NA LÍNGUA DO CLIENTE, OU NADA — 28-10-2026 (decisão d35).
 *
 * O Gemini (com a nova tentativa e o modelo leve); se falhar, as traduções
 * fixas e revistas; se nem essas tiverem a mensagem, `null` — e quem chama
 * não a manda em português a um cliente estrangeiro: passa a conversa à
 * equipa. Cada falha fica no termómetro do painel («A IA está a falhar»).
 */
export async function traduzirSemLinguaErrada(
  texto: string,
  lingua: Lingua | null | undefined,
): Promise<string | null> {
  if (!precisaDeTraducao(lingua) || !texto.trim()) return texto;
  const alvo = lingua as Lingua;

  const chave = JSON.stringify([alvo, texto]);
  const jaVista = GUARDADAS.get(chave);
  if (jaVista !== undefined) return jaVista;

  const pedido = await pedirAoGemini(texto, alvo);
  if (pedido.saiu) {
    await anotar("tradutor", null);
    lembrar(chave, pedido.saiu);
    return pedido.saiu;
  }
  const fixa = traducaoFixa(texto, alvo);
  if (fixa != null) {
    await anotar("tradutor", `${pedido.motivo} — saiu pela tradução fixa (${alvo})`);
    return fixa;
  }
  await anotar("tradutor", `${pedido.motivo} — sem tradução fixa: não saiu (${alvo})`);
  return null;
}

/**
 * A mensagem na língua do cliente — ou, se o tradutor falhar e não houver
 * tradução fixa, em português. É a do envio À MÃO e dos avisos: quem escreve à
 * mão manda no que escreve. A Vitória usa `traduzirSemLinguaErrada`.
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

  const pedido = await pedirAoGemini(texto, alvo);
  const traduzida = pedido.saiu;
  if (!traduzida) {
    const fixa = traducaoFixa(texto, alvo);
    // Saiu pela tradução fixa, ou em português — e diz-se, no painel do WhatsApp (d7).
    await anotar("tradutor", `${pedido.motivo} — ${fixa != null ? `saiu pela tradução fixa (${alvo})` : `saiu em português (${alvo})`}`);
    return fixa ?? texto;
  }
  await anotar("tradutor", null);

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
