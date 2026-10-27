/**
 * A ROTINA DAS LIÇÕES — uma vez por dia. 27-10-2026 (decisão d11).
 *
 * Lê as conversas das últimas 24 horas e, em cada sítio onde a equipa teve de
 * entrar (respondeu à mão, a pergunta ficou «anotada», o cliente repetiu a
 * pergunta, a conversa passou a uma pessoa), propõe uma lição: a pergunta sem
 * dados de pessoas e a resposta que a Vitória deve dar da próxima vez —
 * escrita pelo mesmo modelo que já lê as conversas, sem chave nova. Nasce
 * «por rever»; ninguém fala com ela antes de uma pessoa a aprovar.
 *
 * Nunca escreve ao cliente.
 */
import {
  casosDaConversa,
  mesmaPergunta,
  motivoParaBloquear,
  semDadosDePessoas,
  type CasoDaConversa,
} from "./licoes-da-vitoria";
import { PROPRIO_DIA } from "./frases-proibidas";
import { oQueOSiteSabe } from "./o-que-o-site-sabe";

/** Quantas lições, no máximo, por passagem — cada uma é uma chamada ao modelo. */
export const LICOES_POR_PASSAGEM = 25;

export type PassagemDasLicoes = {
  conversas: number;
  casos: number;
  propostas: number;
  repetidas: number;
  bloqueadas: number;
  semModelo: number;
  falhas: number;
};

export const INSTRUCAO_DA_LICAO = `És a Vitória, assistente online da CLYON. A CLYON é uma plataforma: o cliente faz o pedido, profissionais verificados da zona respondem com o preço deles e fazem o trabalho; a CLYON organiza, guarda o acordo e o pagamento.

Vais ler uma PERGUNTA de um cliente no WhatsApp a que tu não soubeste responder, e, quando houver, a RESPOSTA que uma pessoa da CLYON lhe deu à mão. O teu trabalho é escrever a LIÇÃO: a pergunta em geral e a resposta que deves dar da próxima vez que alguém perguntar o mesmo.

Devolve SÓ um objecto JSON: {"pergunta": "...", "resposta": "..."}

Regras:
- "pergunta": a pergunta em geral, numa frase, sem nomes, telefones, moradas, códigos postais nem números de pedido (ex.: «Pode ser enviado um vídeo em vez de fotografias?»).
- "resposta": como a Vitória a diria — português de Portugal, delicada, curta (no máximo 3 frases), no feminino, sem emojis. Usa SÓ o que o site diz (abaixo) e o que a pessoa da CLYON respondeu.
- Se a resposta depender do caso daquele cliente (o preço do pedido dele, a data, quem vai, um problema com um trabalho), ou se nem o site nem a equipa a respondem, deixa "resposta" vazia.
- Nunca um preço que não esteja no site; nunca um preço sem IVA sozinho; nunca «no ${PROPRIO_DIA}»; nunca contentores nem big bags; nunca «nós fazemos» — quem faz é o profissional escolhido; nunca digas que és uma IA.

${oQueOSiteSabe()}`;

/** A lição que o modelo escreveu — validada, ou `null`. Pura. */
export function lerALicao(bruto: string | null | undefined): { pergunta: string; resposta: string } | null {
  if (!bruto) return null;
  const json = bruto.slice(bruto.indexOf("{"), bruto.lastIndexOf("}") + 1);
  if (!json) return null;
  try {
    const o = JSON.parse(json) as { pergunta?: unknown; resposta?: unknown };
    const pergunta = String(o.pergunta ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
    const resposta = String(o.resposta ?? "").trim().slice(0, 1200);
    if (pergunta.length < 5) return null;
    return { pergunta, resposta };
  } catch {
    return null;
  }
}

/** Pede a lição ao modelo. Nunca atira: sem chave ou com o modelo em baixo, `null`. */
async function pedirALicao(pergunta: string, respostaDaEquipa: string | null): Promise<{ pergunta: string; resposta: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const { escadaDeModelos, modeloDoAssistente, porDeCastigo } = await import("./whatsapp-compreensao");
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(apiKey);
  const texto =
    `A PERGUNTA DO CLIENTE:\n${pergunta}\n\n` +
    (respostaDaEquipa ? `O QUE A PESSOA DA CLYON RESPONDEU:\n${respostaDaEquipa}` : "(Ninguém da CLYON respondeu ainda.)");
  for (const nome of (await escadaDeModelos(modeloDoAssistente())).slice(0, 2)) {
    try {
      const model = client.getGenerativeModel({
        model: nome,
        systemInstruction: INSTRUCAO_DA_LICAO,
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      });
      const r = await Promise.race([
        model.generateContent(texto),
        new Promise<never>((_, rejeitar) => setTimeout(() => rejeitar(new Error("demorou mais de 20 s")), 20_000)),
      ]);
      return lerALicao(r.response.text());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[propor-licoes] ${nome} falhou:`, msg);
      await porDeCastigo(nome, msg);
    }
  }
  return null;
}

/**
 * A LIÇÃO DE UM CASO, já sem dados de pessoas — pura, para se poder ensaiar:
 * o que o modelo propôs, ou (sem ele) a resposta da equipa tal e qual.
 */
export function licaoDoCaso(
  caso: CasoDaConversa,
  nomes: readonly string[],
  doModelo: { pergunta: string; resposta: string } | null,
): { pergunta: string; respostaDaEquipa: string | null; respostaProposta: string } {
  const pergunta = semDadosDePessoas(doModelo?.pergunta || caso.pergunta, nomes);
  const respostaDaEquipa = caso.respostaDaEquipa ? semDadosDePessoas(caso.respostaDaEquipa, nomes) : null;
  const respostaProposta = semDadosDePessoas(doModelo ? doModelo.resposta : (respostaDaEquipa ?? ""), nomes);
  return { pergunta, respostaDaEquipa, respostaProposta };
}

/** A passagem: lê, propõe, guarda. */
export async function proporLicoesDoDia(agora: Date = new Date()): Promise<PassagemDasLicoes> {
  const r: PassagemDasLicoes = { conversas: 0, casos: 0, propostas: 0, repetidas: 0, bloqueadas: 0, semModelo: 0, falhas: 0 };
  const base = await import("./licoes-da-vitoria-na-base");
  const desde = new Date(agora.getTime() - 24 * 3600 * 1000);
  const [conversas, existentes] = await Promise.all([base.conversasDasUltimasHoras(24), base.listarLicoes(500)]);
  r.conversas = conversas.length;

  const fila: Array<{ telefone: string; caso: CasoDaConversa }> = [];
  for (const c of conversas) {
    for (const caso of casosDaConversa(c.mensagens, desde)) fila.push({ telefone: c.telefone, caso });
  }
  r.casos = fila.length;

  const jaHa = existentes.filter((l) => l.estado !== "recusada").map((l) => l.pergunta);
  const destaVez: string[] = [];
  for (let i = 0; i < fila.length && r.propostas + r.repetidas < LICOES_POR_PASSAGEM * 2; i += 4) {
    await Promise.all(
      fila.slice(i, i + 4).map(async ({ telefone, caso }) => {
        try {
          if (r.propostas >= LICOES_POR_PASSAGEM) return;
          const nomes = await base.nomesDoNumero(telefone);
          const perguntaLimpa = semDadosDePessoas(caso.pergunta, nomes);
          // A mesma pergunta já tem lição (ou entrou agora): não se propõe outra.
          if ([...jaHa, ...destaVez].some((p) => mesmaPergunta(p, perguntaLimpa, 0.6))) {
            r.repetidas += 1;
            return;
          }
          const doModelo = await pedirALicao(perguntaLimpa, caso.respostaDaEquipa ? semDadosDePessoas(caso.respostaDaEquipa, nomes) : null);
          if (!doModelo) r.semModelo += 1;
          const l = licaoDoCaso(caso, nomes, doModelo);
          if (motivoParaBloquear(l.respostaProposta)) r.bloqueadas += 1;
          destaVez.push(l.pergunta);
          if (await base.guardarLicao({ origem: caso.origem, mensagemId: caso.mensagemId, ...l })) r.propostas += 1;
        } catch (e) {
          r.falhas += 1;
          console.error("[propor-licoes]", e instanceof Error ? e.message : e);
        }
      }),
    );
  }
  return r;
}
