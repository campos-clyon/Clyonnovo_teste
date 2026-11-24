/**
 * A VITÓRIA AGENTE A SÉRIO, LIGADA À BASE E AO WHATSAPP — d92 (23-11-2026).
 *
 * É a ponte que chama isto, dentro da tranca da rajada, NO LUGAR das regras:
 * `responderAoClienteAoVivo(telefone, conteudo, regras)`. Com «Vitória agente
 * — conversa livre» desligado (por omissão), chama logo as regras e mais nada
 * — o comportamento de hoje. A orquestra (o que fica com o código, com as
 * regras e com o agente) está em `ao-vivo.ts`; aqui só as portas de verdade.
 */

import { conversaAnonimizada } from "./anonimizar";
import { correrOAgente, clienteDoClaude, type ResultadoDoAgente } from "./cliente";
import { responderAoVivo, type ConteudoDaRajada, type QuemRespondeu } from "./ao-vivo";
import {
  ferramentasDeVerdade,
  gastoDeHojeUsd,
  garantirTabelas,
  lerInterruptor,
  partirNaUltimaDoCliente,
  quemEscreveNoNumero,
  registarAccao,
  tectoDiarioUsd,
} from "./na-base";

const digitos = (t: string) => String(t ?? "").replace(/\D/g, "").slice(-20);
const json = (v: unknown, max: number) => {
  try {
    return JSON.stringify(v).slice(0, max);
  } catch {
    return null;
  }
};

/** A pergunta de dados do código (a morada, o andar…) que ainda espera resposta: a última saída antes da rajada do cliente, há menos de 72 h. */
function perguntaDeDadosAEspera(
  fio: ReadonlyArray<{ direccao: string; texto: string; haSegundos?: number | null }>,
  passoDaPergunta: (t: string) => unknown,
): boolean {
  let i = fio.length - 1;
  while (i >= 0 && fio[i].direccao === "in") i -= 1;
  if (i < 0) return false;
  const ultima = fio[i];
  if (ultima.haSegundos != null && ultima.haSegundos > 72 * 3600) return false;
  return passoDaPergunta(ultima.texto) != null;
}

/**
 * RESPONDE A ESTA RAJADA: o agente (com a «conversa livre» ligada e quando é
 * a vez dele), o código (o SIM / o CANCELAR ao que o agente propôs), ou as
 * regras. Devolve quem respondeu. Nunca lança (na dúvida, as regras).
 */
export async function responderAoClienteAoVivo(
  telefone: string,
  conteudo: ConteudoDaRajada,
  regras: () => Promise<void>,
): Promise<QuemRespondeu> {
  const agora = new Date();
  let ensaioId: number | null = null;
  try {
    return await responderAoVivo(conteudo, {
      agora,
      regras,
      interruptores: async () => {
        const [conversa, aceitar] = await Promise.all([lerInterruptor("conversa"), lerInterruptor("aceitar")]);
        return { conversa: conversa.ligado, aceitar: aceitar.ligado };
      },
      situacao: async () => {
        const db = await import("../db");
        const neg = await import("../whatsapp-negociacao");
        const { passoDaPergunta } = await import("../reler-a-conversa");
        const [pedidos, interrompida, g, fio] = await Promise.all([
          neg.pedidosDoTelefone(telefone).catch(() => [] as number[]),
          db.numeroInterrompidoWhatsApp(telefone).catch(() => true),
          db.recolhaWhatsApp(telefone).catch(() => null),
          db.mensagensDoNumeroWhatsApp(telefone, 40).catch(() => []),
        ]);
        // A recolha a meio (a mesma leitura de `conversaPresaARecolha`): a escolher o pedido, a completá-lo, ou a fazer um novo.
        let recolhaEmCurso = false;
        if (g && Date.now() - new Date(g.actualizadoEm).getTime() <= 24 * 3600_000) {
          const d = (g.dados ?? {}) as { pedidosAEscolher?: unknown; pedidoAberto?: unknown };
          recolhaEmCurso =
            g.pedidoId == null
              ? (Array.isArray(d.pedidosAEscolher) && d.pedidosAEscolher.length > 0) || g.passo !== "servico"
              : d.pedidoAberto === g.pedidoId && g.passo !== "confirmar";
        }
        // d111: a desistência às propostas, a resposta à lista e a escolha ao seguimento ficam com o código.
        const { oCodigoLeEstaResposta } = await import("../a-escolha-e-a-desistencia-no-whatsapp");
        return {
          temPedidos: pedidos.length > 0,
          interrompida,
          recolhaEmCurso,
          perguntaDeDadosAEspera: perguntaDeDadosAEspera(fio, passoDaPergunta),
          oCodigoLe: pedidos.length > 0 && !interrompida ? await oCodigoLeEstaResposta(String(conteudo.texto ?? ""), fio) : false,
        };
      },
      pendente: async () => (await import("./accoes-na-base")).pendenteDoTelefone(telefone, false),
      acabarPendente: async (p, como) => (await import("./accoes-na-base")).acabarPendente(telefone, p, como, false, ensaioId),
      gravarPendente: async (p) => (await import("./accoes-na-base")).gravarPendente(telefone, p, false, ensaioId),
      propostasParaEscolher: async (id) => (await import("./accoes-na-base")).propostasParaEscolherDeVerdade(id),
      fecharPeloBotao: async (pedidoId, negociacaoId) => {
        // O caminho do botão «Contratar» do WhatsApp: fecharPeloCliente, com o interruptor «fechar», a guia e o retrato.
        const { tratarMensagemDoCliente } = await import("../whatsapp-negociacao");
        await tratarMensagemDoCliente(telefone, { tipo: "botao", id: `ct:${pedidoId}:${negociacaoId}` });
      },
      cancelarPeloCancelar: async (pedidoId) => (await import("./accoes-na-base")).cancelarPeloCancelarDoAgente(pedidoId, telefone),
      marcarPerguntaDoCancelar: async (pedidoId) => (await import("./accoes-na-base")).marcarPerguntaDoCancelar(pedidoId, telefone),
      // d97: a pergunta ao parceiro sai sozinha (o WhatsApp dos avisos e a app Pro), e regista-se.
      perguntarAoParceiro: async (p) => (await import("./pergunta-ao-parceiro-na-base")).perguntarAoParceiroDeVerdade(telefone, p, agora),
      correrOAgente: async (prazoMs, nota): Promise<ResultadoDoAgente> => {
        const db = await import("../db");
        const fio = await db.mensagensDoNumeroWhatsApp(telefone, 40);
        const partido = partirNaUltimaDoCliente(fio);
        const { pedidos, quem } = await quemEscreveNoNumero(telefone);
        const pool = await garantirTabelas();
        const [novo] = (await pool.execute(
          "INSERT INTO vitoriaEnsaios (telefone, pedidoId, mensagemDoCliente, estado) VALUES (?, ?, ?, 'vivo_a_correr')",
          [digitos(telefone), pedidos[0] ?? null, partido ? conversaAnonimizada([{ direccao: "in", texto: partido.doCliente }], quem)[0].texto.slice(0, 4000) : null],
        )) as [{ insertId: number }, unknown];
        ensaioId = Number(novo.insertId);
        const aceitar = (await lerInterruptor("aceitar")).ligado;
        return correrOAgente(
          { conversa: conversaAnonimizada(partido?.conversa ?? fio, quem), pedidos, agora, prazoMs, nota },
          {
            cliente: clienteDoClaude(),
            ferramentas: await ferramentasDeVerdade(telefone, agora, quem, { aoVivo: true, aceitarLigado: aceitar }),
            gastoETecto: async () => ({ gastoUsd: await gastoDeHojeUsd(agora), tectoUsd: await tectoDiarioUsd() }),
            registar: (l) => registarAccao({ ...l, ensaioId, telefone, pedidoId: pedidos[0] ?? null, ensaio: false }),
          },
        );
      },
      enviar: async (texto) => (await import("../whatsapp-cloud")).enviarTextoWhatsApp(telefone, texto),
      passarAEquipa: async (motivo, mensagem) => {
        const { enviarTextoWhatsApp } = await import("../whatsapp-cloud");
        const { interromperNumeroWhatsApp } = await import("../db");
        if (mensagem) await enviarTextoWhatsApp(telefone, mensagem);
        await interromperNumeroWhatsApp(telefone, motivo.slice(0, 480)).catch(() => {});
      },
      registar: async (l) => {
        try {
          const pool = await garantirTabelas();
          const r = l.resultado;
          const valores = [
            l.texto ? l.texto.slice(0, 4000) : null,
            json(l.teriaFeito, 4000),
            l.estado,
            l.motivo ? l.motivo.slice(0, 255) : null,
            r?.modelo ?? null,
            r?.uso.entrada ?? 0,
            r?.uso.saida ?? 0,
            r?.uso.cacheLidos ?? 0,
            r?.uso.cacheEscritos ?? 0,
            r?.custoUsd ?? 0,
          ];
          const sql = `respostaDoAgente = ?, teriaFeitoJson = ?, estado = ?, motivo = ?, modelo = ?,
             tokensEntrada = ?, tokensSaida = ?, tokensCacheLidos = ?, tokensCacheEscritos = ?, custoUsd = ?`;
          if (ensaioId != null) await pool.execute(`UPDATE vitoriaEnsaios SET ${sql} WHERE id = ?`, [...valores, ensaioId]);
          else
            await pool.execute(
              `INSERT INTO vitoriaEnsaios (telefone, respostaDoAgente, teriaFeitoJson, estado, motivo, modelo,
                 tokensEntrada, tokensSaida, tokensCacheLidos, tokensCacheEscritos, custoUsd) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [digitos(telefone), ...valores],
            );
        } catch (e) {
          console.error("[vitoria-agente] não registei a resposta a sério:", e instanceof Error ? e.message : e);
        }
      },
    });
  } catch {
    await regras();
    return "regras";
  }
}
