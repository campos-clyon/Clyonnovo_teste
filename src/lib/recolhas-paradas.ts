import type { DadosDaRecolha, PassoDaRecolha } from "./whatsapp-recolha";
import { eDaEquipa } from "./rajada-do-whatsapp";
import { horaDeFalar } from "./assistente-interruptores";

/**
 * AS RECOLHAS QUE PARAM — 23-10-2026.
 *
 * *«Se o cliente demorar mais de 10 minutos a responder a uma pergunta, que
 * ela passe para a próxima — já faça o que seria a próxima pergunta. E caso o
 * cliente não responda, não confirme os dados que foram recolhidos no final
 * do pedido, que ele seja criado automaticamente após 30 minutos.»* — o dono.
 *
 * Corre na passagem do assistente, de 10 em 10 minutos: por isso o salto
 * acontece entre os 10 e os 20 minutos de silêncio, e o registo entre os 30 e
 * os 40.
 *
 * O QUE NÃO FAZ, de propósito:
 *   - não salta o serviço — sem ele não há pedido, e é ele que decide as
 *     perguntas seguintes;
 *   - não salta duas seguidas — com o cliente calado depois de um salto, não
 *     se lhe manda a pergunta seguinte, e a seguinte, até ao resumo: uma vez
 *     só, e espera-se por ele;
 *   - não mexe em conversas com mais de `HORAS_DE_LIMITE` paradas — ao ligar
 *     isto, um cliente de há uma semana não recebe de repente «Pedido
 *     registado»;
 *   - não fala onde a última mensagem foi de uma pessoa da equipa.
 */

export const MINUTOS_PARA_SALTAR = 10;
export const MINUTOS_PARA_REGISTAR = 30;
export const HORAS_DE_LIMITE = 6;

export type DecisaoDaRecolhaParada = "nada" | "seguir" | "saltar" | "registar";

/*
 * ──────────────────────────────────────────────────────────────────────────
 * A MENSAGEM GENTIL A QUEM FICOU CALADO — 14-11-2026 (o dono, d25 v2).
 *
 * *«Cliente calado mais de 10 minutos a meio da recolha → UMA mensagem
 * gentil com a mesma pergunta por outras palavras (no máximo 1 por pergunta,
 * 2 por conversa, nunca entre as 21h e as 9h de Lisboa, nunca se a conversa
 * estiver entregue a uma pessoa ou o pedido já registado), com interruptor
 * nas Configs.»*
 *
 * Vem ANTES do salto dos 10 minutos: com o interruptor ligado, a pergunta
 * repete-se uma vez com outras palavras; se ele continuar calado mais dez
 * minutos, salta-se como sempre. Desligado, é tudo como era. O texto é
 * `textoDoSeguimento` (whatsapp-recolha.ts); o interruptor,
 * `seguimento-da-vitoria-na-base.ts` — DESLIGADO por omissão.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const MINUTOS_PARA_SEGUIR = 10;
export const SEGUIMENTOS_POR_PERGUNTA = 1;
export const SEGUIMENTOS_POR_CONVERSA = 2;

export type SituacaoDoSeguimento = {
  /** O interruptor das Configs. */
  ligado: boolean;
  agora: Date;
  /** A conversa está entregue a uma pessoa da equipa (ou o número bloqueado). */
  entregueAUmaPessoa?: boolean;
  /** O pedido desta recolha já está registado. */
  pedidoRegistado?: boolean;
};

/**
 * QUANTO TEMPO PODE ESPERAR A MENSAGEM GENTIL — 13 horas. Uma pergunta feita
 * às 20h50 que fica sem resposta não leva a mensagem às 21h (silêncio da
 * noite): «fica para as 9h» — o dono. Doze horas e pouco depois; o salto e o
 * registo continuam com as 6 horas de sempre.
 */
export const HORAS_DE_LIMITE_DO_SEGUIMENTO = 13;

/** Tudo menos a hora: a mensagem gentil cabe nesta conversa? Pura. */
function seguimentoCabe(
  r: { passo: PassoDaRecolha; dados: DadosDaRecolha },
  ultima: { direccao: string; texto: string; haSegundos: number | null } | null,
  s: SituacaoDoSeguimento,
): boolean {
  if (!s.ligado || s.entregueAUmaPessoa || s.pedidoRegistado) return false;
  // A meio da recolha: o serviço decide as perguntas, e o resumo tem o seu registo aos 30 minutos.
  if (r.passo === "servico" || r.passo === "confirmar") return false;
  if (!ultima || ultima.direccao !== "out" || ultima.haSegundos == null) return false;
  if (ultima.haSegundos < MINUTOS_PARA_SEGUIR * 60 || ultima.haSegundos > HORAS_DE_LIMITE_DO_SEGUIMENTO * 3600) return false;
  if (eDaEquipa(ultima.texto)) return false;
  const feitos = Array.isArray(r.dados.seguimentos) ? r.dados.seguimentos : [];
  if (feitos.length >= SEGUIMENTOS_POR_CONVERSA) return false;
  if (feitos.filter((p) => p === r.passo).length >= SEGUIMENTOS_POR_PERGUNTA) return false;
  return true;
}

/** Pode sair a mensagem gentil agora? Pura — a hora é a de Lisboa (`horaDeFalar`). */
export function podeSeguir(
  r: { passo: PassoDaRecolha; dados: DadosDaRecolha },
  ultima: { direccao: string; texto: string; haSegundos: number | null } | null,
  s: SituacaoDoSeguimento,
): boolean {
  return seguimentoCabe(r, ultima, s) && horaDeFalar(s.agora);
}

/** O que fazer com uma recolha a meio, pela última mensagem da conversa. Pura. */
export function oQueFazerComARecolha(
  r: { passo: PassoDaRecolha; dados: DadosDaRecolha },
  ultima: { direccao: string; texto: string; haSegundos: number | null } | null,
  saltoDaPergunta: string,
  /** Sem isto (ou desligado), não há mensagem gentil — é o comportamento de antes. */
  seguimento?: SituacaoDoSeguimento,
): DecisaoDaRecolhaParada {
  if (!ultima || ultima.direccao !== "out" || ultima.haSegundos == null) return "nada";
  const s = ultima.haSegundos;
  if (seguimento && seguimentoCabe(r, ultima, seguimento)) {
    // De noite espera-se pelas 9h — nem a mensagem gentil, nem o salto no lugar dela.
    return horaDeFalar(seguimento.agora) ? "seguir" : "nada";
  }
  if (s > HORAS_DE_LIMITE * 3600) return "nada";
  if (eDaEquipa(ultima.texto)) return "nada";
  if (r.passo === "confirmar") return s >= MINUTOS_PARA_REGISTAR * 60 ? "registar" : "nada";
  if (r.passo === "servico") return "nada";
  if (ultima.texto.trim().startsWith(saltoDaPergunta)) return "nada";
  // Com a mensagem gentil ligada, também o salto respeita o silêncio da noite.
  if (seguimento?.ligado && !horaDeFalar(seguimento.agora)) return "nada";
  return s >= MINUTOS_PARA_SALTAR * 60 ? "saltar" : "nada";
}

export type PassagemDasRecolhas = {
  saltadas: number;
  registadas: number;
  seguidas: number;
  /** d93: os lembretes da conversa parada a meio (e os fechos). */
  lembradas?: number;
  linhas: string[];
};

/**
 * A passagem: cada recolha em curso, a decisão, e o gesto. Só com o WhatsApp
 * ligado e a recolha do assistente ligada; um número entregue a uma pessoa ou
 * bloqueado fica de fora (`podeOWhatsAppFalarCom`).
 */
export async function correrAsRecolhasParadas(): Promise<PassagemDasRecolhas> {
  const r: PassagemDasRecolhas = { saltadas: 0, registadas: 0, seguidas: 0, linhas: [] };
  const db = await import("./db");
  if (!(await db.whatsappLigado().catch(() => false))) return r;
  if (!(await db.assistentePode("recolher").catch(() => false))) return r;
  const { saltarAPergunta, SALTO_DA_PERGUNTA, textoDoSeguimento } = await import("./whatsapp-recolha");
  // O interruptor da mensagem gentil (Configs) — desligado na dúvida.
  const { seguimentoDaVitoriaLigado } = await import("./seguimento-da-vitoria-na-base");
  const seguimentoLigado = await seguimentoDaVitoriaLigado().catch(() => false);
  const { registarARecolha } = await import("./whatsapp-negociacao");
  const { enviarTextoWhatsApp } = await import("./whatsapp-cloud");

  const emCurso = await db.listarRecolhasWhatsAppEmCurso().catch(() => []);
  for (const { telefone } of emCurso) {
    try {
      if (!(await db.podeOWhatsAppFalarCom(telefone))) continue;
      const guardada = await db.recolhaWhatsApp(telefone);
      if (!guardada || guardada.pedidoId != null) continue;
      const fio = await db.mensagensDoNumeroWhatsApp(telefone, 20);
      // Não pisar a equipa (d73): com uma pessoa a escrever há menos de 12 horas, nem a mensagem gentil, nem o salto, nem o registo sozinho.
      const { aEquipaFalouHaPouco } = await import("./pedido-em-curso");
      const { aEquipaNaConversa } = await import("./pedido-em-curso-na-base");
      if (aEquipaFalouHaPouco(fio, await aEquipaNaConversa(telefone).catch(() => ({})))) continue;
      const ultima = fio.length > 0 ? fio[fio.length - 1] : null;
      const estado = {
        passo: guardada.passo as PassoDaRecolha,
        dados: (guardada.dados ?? {}) as DadosDaRecolha,
      };
      // Entregue a uma pessoa e pedido registado já ficaram de fora acima (`podeOWhatsAppFalarCom`, `pedidoId`).
      const decisao = oQueFazerComARecolha(estado, ultima, SALTO_DA_PERGUNTA, {
        ligado: seguimentoLigado,
        agora: new Date(),
        entregueAUmaPessoa: false,
        pedidoRegistado: false,
      });
      if (decisao === "seguir") {
        const dados: DadosDaRecolha = { ...estado.dados, seguimentos: [...(estado.dados.seguimentos ?? []), estado.passo] };
        // A marca grava-se antes de enviar: se o envio falhar, não se tenta outra vez (uma por pergunta).
        await db.guardarRecolhaWhatsApp(telefone, estado.passo, dados);
        await enviarTextoWhatsApp(telefone, textoDoSeguimento(estado.passo, dados));
        r.seguidas += 1;
        r.linhas.push(`${telefone}: mensagem gentil na pergunta «${estado.passo}»`);
      } else if (decisao === "saltar") {
        // A seguinte, se já foi perguntada (também à mão) e respondida, não se repete (d69).
        const { semRepetirAPergunta } = await import("./nao-insistir");
        const salto = semRepetirAPergunta(saltarAPergunta(estado), fio);
        await db.guardarRecolhaWhatsApp(telefone, salto.estado.passo, salto.estado.dados);
        await enviarTextoWhatsApp(telefone, salto.resposta);
        r.saltadas += 1;
        r.linhas.push(`${telefone}: «${estado.passo}» ficou para depois → ${salto.estado.passo}`);
      } else if (decisao === "registar") {
        const id = await registarARecolha(telefone, estado.dados, { sozinho: true });
        if (id != null) {
          r.registadas += 1;
          r.linhas.push(`${telefone}: pedido #${id} registado sozinho (sem resposta ao resumo)`);
        }
      } else {
        /*
         * A CONVERSA PARADA A MEIO — d93 (23-11-2026). Sem a mensagem gentil nem
         * o salto a fazer: o lembrete das 2 horas, o da manhã seguinte, o último
         * e o fecho, cada um a retomar de onde ficou. Ver `conversa-parada-a-meio.ts`.
         */
        const { lembrarAConversaParada } = await import("./conversa-parada-a-meio-na-base");
        const feito = await lembrarAConversaParada(telefone, estado, fio).catch((e) => {
          console.error("[recolhas-paradas] lembrete da conversa parada:", e instanceof Error ? e.message : e);
          return null;
        });
        if (feito) {
          r.lembradas = (r.lembradas ?? 0) + 1;
          r.linhas.push(feito);
        }
      }
    } catch (e) {
      console.error("[recolhas-paradas]", telefone, e instanceof Error ? e.message : e);
    }
  }
  return r;
}
