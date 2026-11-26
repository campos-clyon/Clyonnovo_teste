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

import { jaRecebeuACandidatura, zonaDoCandidato } from "../candidato-a-parceiro";
import { conversaAnonimizada } from "./anonimizar";
import { clienteDoClaude, type ClienteDoClaude } from "./cliente";
import { dentroDoTecto } from "./custo";
import { decidirPelaIntencao, lerAIntencao, precisaDeLerAIntencao, type DecisaoDaIntencao } from "./intencao";

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

    const r = await lerAIntencao({ agora, conversa, ultima, perguntaFeita: perguntaPendente }, p.cliente);
    const zona = zonaDoCandidato(fio.filter((m) => m.direccao === "in").map((m) => m.texto).concat(texto));
    const decisao = decidirPelaIntencao(r.leitura, { perguntaPendente, zona });
    await p
      .registar({
        resultado: { leitura: r.leitura, decisao: decisao.tipo, passo: emCurso?.passo ?? null },
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
