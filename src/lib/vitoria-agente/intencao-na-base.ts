/**
 * O QUE A PESSOA QUER, LIDO NA BASE — d129 (26-11-2026). As portas de verdade
 * de `intencao.ts`: o rascunho da recolha (a pergunta que o código fez), a
 * conversa (tapada antes de ir ao modelo), a chave, o tecto do dia e o
 * registo da chamada (vitoriaAccoes, com o custo).
 *
 * Nunca lança: sem chave, passado o tecto, a base a falhar, o modelo a falhar
 * ou a demorar — as regras, como antes da d129. Desliga-se sem deploy com
 * `VITORIA_INTENCAO=desligada` na Vercel.
 */

import {
  escolhaNaDuvida,
  guardaDoCandidato,
  jaRecebeuACandidatura,
  MOTIVO_DA_DUVIDA_CLIENTE_OU_CANDIDATO,
  passosDeClienteRespondidos,
  perguntouADuvida,
  QUER_PEDIR_OU_SER_PARCEIRO,
  respostaAoCandidato,
  zonaDoCandidato,
} from "../candidato-a-parceiro";
import { conversaAnonimizada } from "./anonimizar";
import { clienteDoClaude, type ClienteDoClaude } from "./cliente";
import { dentroDoTecto } from "./custo";
import {
  decidirPelaIntencao,
  lerAIntencao,
  PASSO_A_UMA_PESSOA_DA_EQUIPA,
  precisaDeLerAIntencao,
  type DecisaoDaIntencao,
} from "./intencao";

export type PortasDaIntencao = {
  cliente: ClienteDoClaude | null;
  ligada: boolean;
  recolha: () => Promise<{ passo: string; dados: Record<string, unknown>; pedidoId: number | null } | null>;
  fio: () => Promise<Array<{ direccao: string; texto: string }>>;
  perguntaPendente: (passo: string, dados: Record<string, unknown>) => string | null;
  gastoETecto: () => Promise<{ gastoUsd: number; tectoUsd: number }>;
  registar: (l: { resultado: unknown; modelo: string | null; uso: unknown; custoUsd: number; erro: string | null; texto: string | null }) => Promise<void>;
};

/** A decisão, com as portas dadas (os testes dão-nas fingidas). Nunca lança. */
export async function decidirAIntencaoComPortas(texto: string, agora: Date, p: PortasDaIntencao): Promise<DecisaoDaIntencao> {
  try {
    if (!p.ligada) return { tipo: "regras", porque: "leitura da intenção desligada" };
    if (!p.cliente) return { tipo: "regras", porque: "sem a chave do Claude" };
    if (!precisaDeLerAIntencao(texto)) return { tipo: "regras", porque: "um dado curto, que o código lê" };
    const fio = await p.fio().catch(() => []);
    // A quem já recebeu a candidatura, responde `aoCandidato` (passa a uma pessoa).
    if (jaRecebeuACandidatura(fio)) return { tipo: "regras", porque: "já recebeu a candidatura" };
    const tecto = await p.gastoETecto();
    if (!dentroDoTecto(tecto.gastoUsd, tecto.tectoUsd)) return { tipo: "regras", porque: "tecto diário atingido" };

    const guardada = await p.recolha().catch(() => null);
    const emCurso = guardada && guardada.pedidoId == null ? guardada : null;
    const perguntaPendente = emCurso ? p.perguntaPendente(emCurso.passo, emCurso.dados) : null;
    const dados = (emCurso?.dados ?? {}) as { contactName?: string | null; address?: string | null };
    const quem = [{ contactName: dados.contactName ?? null, address: dados.address ?? null }];
    const conversa = conversaAnonimizada(fio, quem);
    const ultima = conversaAnonimizada([{ direccao: "in", texto }], quem)[0].texto;

    const zona = zonaDoCandidato(fio.filter((m) => m.direccao === "in").map((m) => m.texto).concat(texto));
    /*
     * d129c (26-11-2026): A RESPOSTA À PERGUNTA DA DÚVIDA («Quer pedir um
     * serviço ou trabalhar connosco como parceiro?») lê-se aqui, sem o modelo.
     */
    const duvida = perguntouADuvida(fio);
    if (duvida) {
      const e = escolhaNaDuvida(texto);
      if (e === "parceiro") return { tipo: "candidato", texto: respostaAoCandidato(zona), doModelo: false };
      if (e === "cliente") return perguntaPendente ? { tipo: "responder", texto: `Com certeza. ${perguntaPendente}` } : { tipo: "regras", porque: "escolheu pedir um serviço" };
    }

    const r = await lerAIntencao({ agora, conversa, ultima, perguntaFeita: perguntaPendente }, p.cliente);
    let decisao = decidirPelaIntencao(r.leitura, { perguntaPendente, zona });
    /*
     * d129c: O CANDIDATO SÓ COM A INTENÇÃO EXPLÍCITA, e nunca a meio de uma
     * recolha de um cliente que está a responder (`guardaDoCandidato`).
     */
    let guarda: string | null = null;
    if (decisao.tipo === "candidato") {
      guarda = guardaDoCandidato({
        texto,
        anteriores: fio.filter((m) => m.direccao === "in").map((m) => m.texto),
        passosRespondidos: passosDeClienteRespondidos(emCurso?.dados ?? null),
        perguntouADuvida: duvida,
      });
      if (guarda === "cliente") decisao = { tipo: "regras", porque: "o modelo disse candidato, mas é um cliente a responder à recolha (d129c)" };
      else if (guarda === "perguntar") decisao = { tipo: "responder", texto: QUER_PEDIR_OU_SER_PARCEIRO };
      else if (guarda === "equipa") decisao = { tipo: "equipa", texto: PASSO_A_UMA_PESSOA_DA_EQUIPA, motivo: MOTIVO_DA_DUVIDA_CLIENTE_OU_CANDIDATO };
    }
    await p
      .registar({
        resultado: { leitura: r.leitura, decisao: decisao.tipo, guarda, passo: emCurso?.passo ?? null },
        modelo: r.modelo,
        uso: r.uso,
        custoUsd: r.custoUsd,
        erro: r.erro,
        texto: "texto" in decisao ? decisao.texto : null,
      })
      .catch(() => {});
    return decisao;
  } catch (e) {
    console.error("[vitoria-intencao] a leitura falhou — seguem as regras:", e instanceof Error ? e.message : e);
    return { tipo: "regras", porque: "erro na leitura" };
  }
}

/** ANTES DO FLUXO FIXO, num número sem pedido aberto: o que a pessoa quer. */
export async function decidirAIntencao(telefone: string, texto: string, agora: Date = new Date()): Promise<DecisaoDaIntencao> {
  const recolha = await import("../whatsapp-recolha");
  return decidirAIntencaoComPortas(texto, agora, {
    cliente: clienteDoClaude(),
    ligada: String(process.env.VITORIA_INTENCAO ?? "").trim().toLowerCase() !== "desligada",
    recolha: async () => {
      const g = await (await import("../db")).recolhaWhatsApp(telefone);
      if (!g) return null;
      const { rascunhoAindaVale } = await import("../conversa-parada-a-meio");
      if (!rascunhoAindaVale(g.actualizadoEm)) return null;
      return { passo: String(g.passo), dados: (g.dados ?? {}) as Record<string, unknown>, pedidoId: g.pedidoId ?? null };
    },
    fio: async () => (await import("../db")).mensagensDoNumeroWhatsApp(telefone, 20),
    perguntaPendente: (passo, dados) => {
      try {
        return recolha.perguntaPendente(passo as never, dados as never) || null;
      } catch {
        return null;
      }
    },
    gastoETecto: async () => {
      const { gastoDeHojeUsd, tectoDiarioUsd } = await import("./na-base");
      return { gastoUsd: await gastoDeHojeUsd(agora), tectoUsd: await tectoDiarioUsd() };
    },
    registar: async (l) => {
      const { registarAccao } = await import("./na-base");
      await registarAccao({
        ferramenta: "intencao",
        telefone,
        ensaio: false,
        resultado: l.resultado,
        modelo: l.modelo,
        uso: l.uso as never,
        custoUsd: l.custoUsd,
        erro: l.erro,
        texto: l.texto,
      });
    },
  });
}
