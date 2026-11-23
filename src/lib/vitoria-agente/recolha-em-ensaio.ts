/**
 * A RECOLHA EM ENSAIO — d99 (23-11-2026), FASE 1. A ORQUESTRA, sem base (as
 * dependências vêm de fora; nos testes, fingidas).
 *
 * DESLIGADA POR OMISSÃO («Vitória agente — recolha (ensaio)», Configs, LIGAR).
 * Ligada, depois de a Vitória de sempre responder a um número SEM PEDIDO:
 *
 *  1. o código lê o nome, a morada, o NIF e o código postal da mensagem e
 *     guarda-os no RASCUNHO-SOMBRA (nunca no rascunho real);
 *  2. se o agente tinha mostrado o resumo, o SIM do cliente lê-o o código: o
 *     agente TERIA registado o pedido (pelo caminho de sempre) — nada nasce;
 *  3. a conversa vai ao modelo com os dados pessoais trocados por marcas; se
 *     ainda lá estiver um dado conhecido, o modelo NÃO se chama;
 *  4. o agente conduz a recolha (ler_rascunho, gravar_no_rascunho,
 *     propor_registo); o que teria respondido fica ao lado da resposta real;
 *  5. o resumo do agente compara-se com o da Vitória de sempre, campo a campo,
 *     e guardam-se as fugas, o tempo e o custo (os critérios da d99).
 *
 * NUNCA ENVIA, nunca grava no rascunho real, nunca cria pedidos: estas
 * dependências nem existem aqui. Tecto próprio (3 USD/dia) dentro do geral.
 * Nunca lança.
 */

import { eFotografiaFalhada, eMarcaDeImagem, MARCA_DE_AUDIO } from "../rajada-do-whatsapp";
import { fundirCampos, passosEmFalta, type DadosDaRecolha } from "../whatsapp-recolha";
import type { QuemEscreve } from "./anonimizar";
import { correrOAgente, type ClienteDoClaude, type LinhaDoRegistoDoAgente, type ResultadoDoAgente } from "./cliente";
import { dentroDoTecto, type EsforcoDoAgente } from "./custo";
import type { DependenciasDasFerramentas } from "./ferramentas";
import {
  AVISO_DA_RECOLHA,
  compararOsResumos,
  conhecidosDoRascunho,
  FERRAMENTAS_DA_RECOLHA,
  correrFerramentaDaRecolha,
  fugasNoTexto,
  juntarConhecidos,
  lerDadosPessoais,
  marcarDadosPessoais,
  mensagemDaRecolha,
  respostaAoResumo,
  type CampoComparado,
  type ContextoDaRecolha,
} from "./recolha-pelo-agente";

export type LinhaDoFioDaRecolha = { direccao: string; texto: string; criadoEm?: string | null };

/** O rascunho-sombra (o que o agente teria gravado). */
export type SombraDaRecolha = {
  dados: DadosDaRecolha;
  /** Quando o agente mostrou o resumo (ISO), à espera do SIM. */
  resumoPropostoEm: string | null;
  /** Quando o SIM o teria registado (ISO): a seguir, recomeça. */
  registadoEm: string | null;
};

export type RascunhoReal = { passo: string; dados: DadosDaRecolha; pedidoId: number | null };

/** A linha do ensaio (vitoriaEnsaios) — sem dados de pessoas. */
export type EnsaioDaRecolhaNovo = { mensagemDoCliente: string; respostaReal: string | null };
export type EnsaioDaRecolhaFechado = {
  estado: string;
  motivo: string | null;
  respostaDoAgente: string | null;
  teriaFeito: string[];
  resultado: ResultadoDoAgente | null;
};

/** A comparação (vitoriaRecolhaEnsaios) — sem dados de pessoas. */
export type ComparacaoDaRecolha = {
  ensaioId: number | null;
  campos: CampoComparado[];
  iguais: number;
  comparados: number;
  ambosNoResumo: boolean;
  fugasEvitadas: number;
  fugasNoModelo: number;
  chamouOModelo: boolean;
  duracaoMs: number;
  custoUsd: number;
  resumoProposto: boolean;
};

export type DependenciasDaRecolhaEmEnsaio = {
  agora: Date;
  interruptor: () => Promise<boolean>;
  cliente: ClienteDoClaude | null;
  esforco?: EsforcoDoAgente;
  pedidosDoTelefone: () => Promise<number[]>;
  interrompida: () => Promise<boolean>;
  /** SÓ LEITURA: o rascunho da Vitória de sempre. */
  rascunhoReal: () => Promise<RascunhoReal | null>;
  fio: () => Promise<LinhaDoFioDaRecolha[]>;
  /** O nome e a morada dos pedidos anteriores do número (para os tapar). */
  quem: () => Promise<QuemEscreve[]>;
  lerSombra: () => Promise<SombraDaRecolha | null>;
  gravarSombra: (s: SombraDaRecolha) => Promise<void>;
  /** O gasto e o tecto de hoje: o geral e o da recolha. */
  gastos: () => Promise<{ gastoUsd: number; tectoUsd: number; gastoDaRecolhaUsd: number; tectoDaRecolhaUsd: number }>;
  /** As ferramentas de sempre (o que o site sabe, as perguntas frequentes, a revisão). */
  ferramentas: () => Promise<DependenciasDasFerramentas>;
  novoEnsaio: (e: EnsaioDaRecolhaNovo) => Promise<number>;
  fecharEnsaio: (id: number, e: EnsaioDaRecolhaFechado) => Promise<void>;
  guardarComparacao: (c: ComparacaoDaRecolha) => Promise<void>;
  registarAccao: (ensaioId: number, l: LinhaDoRegistoDoAgente) => Promise<void>;
};

export type ResultadoDaRecolhaEmEnsaio = { feito: boolean; porque: string; ensaioId?: number; resultado?: ResultadoDoAgente | null };

/** Pura: parte o fio na última rajada do cliente. */
function partir(fio: readonly LinhaDoFioDaRecolha[]) {
  let i = fio.length - 1;
  while (i >= 0 && fio[i].direccao !== "in") i -= 1;
  if (i < 0) return null;
  let inicio = i;
  while (inicio > 0 && fio[inicio - 1].direccao === "in") inicio -= 1;
  return {
    conversa: fio.slice(0, i + 1),
    doCliente: fio
      .slice(inicio, i + 1)
      .map((l) => l.texto)
      .join("\n"),
    respostaReal: fio
      .slice(i + 1)
      .filter((l) => l.direccao !== "in")
      .map((l) => l.texto)
      .join("\n"),
  };
}

/** Só o texto que o cliente escreveu (sem as marcas das fotografias e dos áudios). */
const soTexto = (t: string) =>
  String(t ?? "")
    .split(/\n/)
    .filter((l) => !eMarcaDeImagem(l) && !eFotografiaFalhada(l) && l.trim() !== MARCA_DE_AUDIO)
    .join("\n")
    .trim();

/**
 * UM ENSAIO DA RECOLHA. Corre DEPOIS da resposta real. Nunca envia, nunca
 * grava no rascunho real, nunca cria pedidos. Nunca lança.
 */
export async function recolhaEmEnsaio(deps: DependenciasDaRecolhaEmEnsaio): Promise<ResultadoDaRecolhaEmEnsaio> {
  try {
    if (!(await deps.interruptor())) return { feito: false, porque: "recolha em ensaio desligada" };
    if ((await deps.pedidosDoTelefone()).length > 0) return { feito: false, porque: "o número já tem pedido" };
    const real = await deps.rascunhoReal();
    if (real?.pedidoId != null) return { feito: false, porque: "o número já tem pedido" };
    if (await deps.interrompida()) return { feito: false, porque: "uma pessoa da equipa tem a conversa" };
    const fio = await deps.fio();
    const partido = partir(fio);
    const doCliente = partido ? soTexto(partido.doCliente) : "";
    if (!partido || !doCliente) return { feito: false, porque: "sem texto do cliente (as fotografias e os áudios ficam com o Gemini)" };
    if (!deps.cliente) return { feito: false, porque: "falta a chave ANTHROPIC_API_KEY" };
    const g = await deps.gastos();
    if (!dentroDoTecto(g.gastoDaRecolhaUsd, Math.min(g.tectoDaRecolhaUsd, g.tectoUsd))) {
      return { feito: false, porque: `tecto da recolha atingido (${g.gastoDaRecolhaUsd.toFixed(2)} de ${Math.min(g.tectoDaRecolhaUsd, g.tectoUsd).toFixed(2)} USD)` };
    }
    if (!dentroDoTecto(g.gastoUsd, g.tectoUsd)) return { feito: false, porque: `tecto diário atingido (${g.gastoUsd.toFixed(2)} de ${g.tectoUsd.toFixed(2)} USD)` };

    const agora = deps.agora;
    const guardada = await deps.lerSombra();
    const sombra: SombraDaRecolha =
      guardada && !guardada.registadoEm ? { ...guardada, dados: { ...guardada.dados } } : { dados: {}, resumoPropostoEm: null, registadoEm: null };
    const quem = await deps.quem().catch(() => [] as QuemEscreve[]);

    // 1. O código lê o nome, a morada, o NIF e o código postal — e guarda-os na sombra.
    const lido = lerDadosPessoais(doCliente, sombra.dados);
    if (Object.keys(lido.campos).length > 0) sombra.dados = fundirCampos(sombra.dados, lido.campos, agora);
    // O que se sabe de quem escreve: esta mensagem, as de antes, a sombra e o rascunho real.
    const conhecidos = juntarConhecidos(
      lido.conhecidos,
      conhecidosDoRascunho(sombra.dados),
      conhecidosDoRascunho(real?.dados),
      ...partido.conversa.filter((l) => l.direccao === "in").map((l) => lerDadosPessoais(soTexto(l.texto), {}).conhecidos),
    );
    const tapado = (t: string) => marcarDadosPessoais(t, conhecidos, quem);
    const teriaFeito: string[] = [];
    if (lido.lidos.length > 0) teriaFeito.push(`teria guardado (lido pelo código): ${lido.lidos.join(", ")}`);

    const comparar = (resumoProposto: boolean) => {
      const c = compararOsResumos(sombra.dados, real?.dados ?? {});
      return { ...c, ambosNoResumo: passosEmFalta(sombra.dados).length === 0 && real?.passo === "confirmar", resumoProposto };
    };
    const novo = () => deps.novoEnsaio({ mensagemDoCliente: tapado(doCliente).slice(0, 4000), respostaReal: tapado(partido.respostaReal).slice(0, 4000) || null });

    // 2. O SIM ao resumo do agente: lê-o o código. Teria registado — nada nasce no ensaio.
    if (sombra.resumoPropostoEm) {
      const r = respostaAoResumo(sombra.resumoPropostoEm, doCliente, agora);
      if (r.tipo === "confirmou") {
        sombra.registadoEm = agora.toISOString();
        sombra.resumoPropostoEm = null;
        await deps.gravarSombra(sombra);
        const ensaioId = await novo();
        teriaFeito.push("teria registado o pedido pelo SIM do cliente (o registo de sempre, pelo código)");
        await deps.fecharEnsaio(ensaioId, { estado: "recolha_codigo", motivo: "o código leu o SIM ao resumo", respostaDoAgente: null, teriaFeito, resultado: null });
        const c = comparar(false);
        await deps.guardarComparacao({ ensaioId, ...c, fugasEvitadas: 0, fugasNoModelo: 0, chamouOModelo: false, duracaoMs: 0, custoUsd: 0 });
        return { feito: true, porque: "codigo", ensaioId, resultado: null };
      }
      sombra.resumoPropostoEm = null;
    }

    // 3. A conversa com marcas. Um dado conhecido que escape: o modelo não se chama.
    const conversa = partido.conversa.map((l) => ({ direccao: l.direccao, texto: tapado(soTexto(l.texto) || l.texto) }));
    const fotos = fio.filter((l) => l.direccao === "in" && (eMarcaDeImagem(l.texto) || eFotografiaFalhada(l.texto))).length;
    const mensagem = mensagemDaRecolha(
      agora,
      conversa,
      fotos > 0 ? `O cliente mandou ${fotos} fotografia(s) nesta conversa: o sistema junta-as ao pedido.` : undefined,
    );
    const fugas = fugasNoTexto(mensagem, conhecidos, quem);
    const ensaioId = await novo();
    if (fugas > 0) {
      await deps.gravarSombra(sombra);
      await deps.fecharEnsaio(ensaioId, {
        estado: "recolha_fuga",
        motivo: "um dado pessoal ia ao modelo: não se chamou",
        respostaDoAgente: null,
        teriaFeito,
        resultado: null,
      });
      await deps.guardarComparacao({ ensaioId, ...comparar(false), fugasEvitadas: fugas, fugasNoModelo: 0, chamouOModelo: false, duracaoMs: 0, custoUsd: 0 });
      return { feito: true, porque: "fuga evitada", ensaioId, resultado: null };
    }

    // 4. O agente conduz a recolha, sobre a sombra.
    const ferramentas = await deps.ferramentas();
    const ctx: ContextoDaRecolha = {
      dados: sombra.dados,
      agora,
      ferramentas,
      conhecidos,
      quem,
      gravados: [],
      resumoProposto: false,
    };
    // O que volta das ferramentas da recolha também se confere (tem de ir sem dados de pessoas).
    let fugasNoModelo = 0;
    const comeco = Date.now();
    const resultado = await correrOAgente(
      { conversa: [], pedidos: [], agora, esforco: deps.esforco },
      {
        cliente: deps.cliente,
        ferramentas,
        gastoETecto: async () => {
          // Vale o que estiver mais perto do fim: o da recolha ou o geral.
          const t = await deps.gastos();
          const tectoRecolha = Math.min(t.tectoDaRecolhaUsd, t.tectoUsd);
          return t.tectoUsd - t.gastoUsd < tectoRecolha - t.gastoDaRecolhaUsd
            ? { gastoUsd: t.gastoUsd, tectoUsd: t.tectoUsd }
            : { gastoUsd: t.gastoDaRecolhaUsd, tectoUsd: tectoRecolha };
        },
        registar: (l) => deps.registarAccao(ensaioId, l),
        recolha: {
          aviso: AVISO_DA_RECOLHA,
          ferramentas: FERRAMENTAS_DA_RECOLHA,
          mensagem,
          correr: async (nome, entrada, estado) => {
            const r = await correrFerramentaDaRecolha(nome, entrada, ctx, estado);
            if (nome === "ler_rascunho" || nome === "gravar_no_rascunho") fugasNoModelo += fugasNoTexto(JSON.stringify(r.resultado), conhecidos, quem);
            return r;
          },
        },
      },
    );
    const duracaoMs = Date.now() - comeco;
    sombra.dados = ctx.dados;
    if (ctx.gravados.length > 0) teriaFeito.push(`teria gravado no rascunho: ${ctx.gravados.join(", ")}`);
    teriaFeito.push(...resultado.teriaFeito.filter((l) => !teriaFeito.includes(l)));
    if (resultado.estado === "ok" && ctx.resumoProposto) sombra.resumoPropostoEm = agora.toISOString();
    await deps.gravarSombra(sombra);

    // 5. O que teria dito (com a marca do resumo, sem dados de pessoas) e a comparação.
    const texto = resultado.estado === "ok" ? resultado.texto : resultado.estado === "equipa" ? resultado.mensagemDeEquipa : null;
    await deps.fecharEnsaio(ensaioId, {
      estado: `recolha_${resultado.estado}`.slice(0, 20),
      motivo: resultado.motivo,
      respostaDoAgente: texto ? tapado(texto) : null,
      teriaFeito,
      resultado,
    });
    await deps.guardarComparacao({
      ensaioId,
      ...comparar(resultado.estado === "ok" && ctx.resumoProposto),
      fugasEvitadas: 0,
      fugasNoModelo,
      chamouOModelo: resultado.idas > 0,
      duracaoMs,
      custoUsd: resultado.custoUsd,
    });
    return { feito: true, porque: resultado.estado, ensaioId, resultado };
  } catch (e) {
    console.error("[vitoria-agente] a recolha em ensaio falhou:", e instanceof Error ? e.message : e);
    return { feito: false, porque: "erro" };
  }
}
