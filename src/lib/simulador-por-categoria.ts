import { SERVICOS_PUBLICOS } from "./service-categories";
import { ESPACOS_DA_EMPRESA, PEDIDOS_DA_EMPRESA } from "./esvaziamento-de-empresa";
import { HORAS_DA_DESMONTAGEM, TIPOLOGIAS, TIPOLOGIA_POR_EXTENSO, horasEscritas, type Tipologia } from "./tabela-das-mudancas";
import { PERGUNTAS_DO_ESPACO, RESPOSTAS_DA_QUANTIDADE, TITULO_DA_QUANTIDADE, TITULO_DAS_COISAS } from "./perguntas-do-espaco";
import { esvaziamentoComOIvaAoLado, precoDoItem } from "./preco-de-referencia";
import {
  COZINHA_SO_POR_ORCAMENTO,
  FIXAR_A_PAREDE_POR_MOVEL,
  OPERACOES_DA_MONTAGEM,
  RETIRAR_AS_EMBALAGENS,
  TABELA_DA_MONTAGEM,
  comOIvaAoLado,
  precoNaOperacao,
  rotuloDoExtraDaDesmontagem,
  type OperacaoDaMontagem,
} from "./tabela-da-montagem";
import {
  ANDARES,
  ELEVADORES,
  ESTACIONAMENTOS,
  ESTADOS_DO_ENTULHO,
  MATERIAIS,
  QUANTO_TRABALHO,
  RECHEIOS,
  REPETICOES,
  TIPOS_DE_SACO,
  TIPOS_DE_TRABALHO,
  VOLUMES_DO_ENTULHO,
  tipologiasDoEsvaziamento,
  type OpcaoDaResposta,
  PECAS_NO_ELEVADOR,
} from "./respostas-do-simulador";

/**
 * O SIMULADOR DE CADA CATEGORIA — 03-11-2026 (decisão d1, ordem do CEO com o
 * sim do dono).
 *
 * *«Cada categoria tem o seu simulador, todo preparado para ela.»* — o dono.
 * A app de cliente perguntava «É preciso desmontar móveis?» em todos os
 * serviços menos garagem, sótão e cave — também no entulho e na manutenção —,
 * e no entulho perguntava duas vezes se estava em sacos sem perguntar que
 * sacos eram.
 *
 * Aqui está, para cada serviço que o simulador oferece (`SERVICOS_PUBLICOS`),
 * a lista das perguntas DESSA categoria, pela ordem: o id do campo, o título,
 * o tipo (escolha, número ou texto), as opções, quando aparece e se é
 * obrigatória. A R7 (`GET /api/cliente/catalogo`) serve-a em cada serviço
 * (`perguntas`), e a app desenha o ecrã por cima dela. A R12 e o pedido lêem as
 * respostas pelos mesmos ids (`respostas-do-simulador.ts`).
 *
 * Regras da casa:
 *   · a desmontagem só na recolha de móveis e de monos, no esvaziamento de casa
 *     e de apartamento e na mudança;
 *   · o entulho: como está → que sacos são → quantos (sem outra pergunta «em
 *     sacos»); no chão, quanto ocupa pela grelha; parte e parte, quantos de
 *     cada. O big bag é só a MEDIDA do que o cliente já tem — a CLYON não
 *     fornece nem aluga big bags nem contentores;
 *   · o esvaziamento de casa e de apartamento pela tipologia da grelha
 *     publicada, e quão cheia está (posiciona dentro da faixa, sem números);
 *   · a manutenção (reparações e remodelações): o tipo de trabalho, quanto, e
 *     os materiais; a repetição, que já existia;
 *   · o andar, o elevador e o estacionamento em todos (na garagem e na cave
 *     sem o andar; na mudança em cada ponta).
 *
 * A descrição, as fotografias, a morada, o «quando» e os contactos são de
 * todos os serviços: a app pergunta-os à parte, como já faz.
 *
 * Puro: sem base, para se poder testar carácter a carácter.
 */

export type TipoDaPergunta = "escolha" | "numero" | "texto";

/** Quando aparece: TODAS as condições — o campo tem uma das respostas da lista. */
export type CondicaoDaPergunta = Readonly<Record<string, readonly string[]>>;

export type PerguntaDoSimulador = {
  /**
   * O campo do corpo da R12 e do pedido. Um ponto quer dizer dentro de um
   * objecto: `itens.pequeno` → `itens: { pequeno }`, `origem.floor` →
   * `origem: { floor }` (na R12; no pedido, `originAccess`).
   */
  id: string;
  titulo: string;
  tipo: TipoDaPergunta;
  obrigatoria: boolean;
  /** Em que ecrã do Pedir: «oque» (o que é e quanto) ou «acesso» (andar, elevador, estacionamento). */
  ecra: "oque" | "acesso";
  opcoes?: readonly OpcaoDaResposta[];
  /** Escolha de várias (as coisas da garagem e da cave). */
  varias?: boolean;
  quando?: CondicaoDaPergunta;
  ajuda?: string;
  /** Número: a unidade que se escreve ao lado. */
  unidade?: string;
  /** Número: a unidade muda com outra resposta (sacos ou big bags). */
  unidadePor?: { campo: string; unidades: Readonly<Record<string, string>> };
  minimo?: number;
  maximo?: number;
};

const SIM_NAO: readonly OpcaoDaResposta[] = [
  { id: "sim", nome: "Sim" },
  { id: "nao", nome: "Não" },
];

const ACIMA_DO_RES_DO_CHAO = ANDARES.filter((a) => a.id !== "rés-do-chão").map((a) => a.id);

/* ── O acesso ───────────────────────────────────────────────────────────── */

/** A pergunta de quem tem peças grandes e elevador (d60, 16-11-2026): a peça que não cabe desce pela escada. */
export const TITULO_DAS_PECAS_NO_ELEVADOR = "As peças grandes cabem no elevador?";

function perguntasDoAcesso(prefixo = "", onde = "", comAndar = true, comPecasGrandes = false): PerguntaDoSimulador[] {
  const id = (c: string) => (prefixo ? `${prefixo}.${c}` : c);
  const l: PerguntaDoSimulador[] = [];
  if (comAndar) {
    l.push({ id: id("floor"), titulo: `Em que andar${onde}?`, tipo: "escolha", obrigatoria: true, ecra: "acesso", opcoes: ANDARES });
    l.push({
      id: id("hasElevator"),
      titulo: `Há elevador${onde}?`,
      tipo: "escolha",
      obrigatoria: true,
      ecra: "acesso",
      opcoes: ELEVADORES,
      quando: { [id("floor")]: ACIMA_DO_RES_DO_CHAO },
    });
    if (comPecasGrandes) {
      l.push({
        id: id("pecasNoElevador"),
        titulo: TITULO_DAS_PECAS_NO_ELEVADOR,
        tipo: "escolha",
        obrigatoria: false,
        ecra: "acesso",
        opcoes: PECAS_NO_ELEVADOR,
        quando: { [id("floor")]: ACIMA_DO_RES_DO_CHAO, [id("hasElevator")]: ["yes", "small"] },
        ajuda: "Uma peça grande que não cabe no elevador desce pela escada, e conta como um andar sem elevador.",
      });
    }
  }
  l.push({
    id: id("parkingDistance"),
    titulo: `A carrinha pode parar perto${onde}?`,
    tipo: "escolha",
    obrigatoria: true,
    ecra: "acesso",
    opcoes: ESTACIONAMENTOS,
  });
  return l;
}

function desmontagem(titulo = "É preciso desmontar móveis?", ajuda?: string): PerguntaDoSimulador {
  return { id: "desmontagem", titulo, tipo: "escolha", obrigatoria: false, ecra: "oque", opcoes: SIM_NAO, ...(ajuda ? { ajuda } : {}) };
}

/* ── Por carga («quanto enche»), na recolha de móveis e de monos ─────────── */

const CARGAS: readonly OpcaoDaResposta[] = [
  { id: "carrinha", nome: "Enche uma carrinha", ajuda: "Poucos itens" },
  { id: "camiao_caixa", nome: "Enche a caixa de um camião", ajuda: "Volume médio" },
  { id: "camiao_lixo", nome: "Enche um camião", ajuda: "Grande volume" },
  { id: "incerto", nome: "Não tenho a certeza" },
];

function perguntasDaCarga(quando?: CondicaoDaPergunta): PerguntaDoSimulador[] {
  return [
    { id: "volume", titulo: "Quanto há para levar?", tipo: "escolha", obrigatoria: true, ecra: "oque", opcoes: CARGAS, ...(quando ? { quando } : {}) },
    { id: "quantidadeExacta", titulo: "Quantas peças são? (opcional)", tipo: "numero", obrigatoria: false, ecra: "oque", minimo: 1, maximo: 999, unidade: "peças", ...(quando ? { quando } : {}) },
  ];
}

/* ── Cada categoria ─────────────────────────────────────────────────────── */

const TAMANHOS: ReadonlyArray<{ id: "pequeno" | "medio" | "grande"; nome: string; exemplos: string; maximo: number }> = [
  { id: "pequeno", nome: "Pequenos", exemplos: "Micro-ondas, forno, mesinha de cabeceira", maximo: 20 },
  { id: "medio", nome: "Médios", exemplos: "Fogão, frigorífico bar, cadeirão", maximo: 99 },
  { id: "grande", nome: "Grandes", exemplos: "Sofá, armário, frigorífico, máquina de lavar", maximo: 99 },
];

/*
 * A MONTAGEM DE MÓVEIS — 26-11-2026 (d132). O que é para fazer (montar,
 * desmontar ou os dois), quantas peças de cada linha da tabela
 * (`tabela-da-montagem.ts`, com o preço e o IVA ao lado), os extras (fixar à
 * parede, retirar as embalagens), se há cozinha (só por orçamento) — e o
 * acesso, como os outros. As fotografias e a descrição são de todos.
 */
function pecasDaTabela(prefixo: string, operacao: OperacaoDaMontagem, quando?: CondicaoDaPergunta): PerguntaDoSimulador[] {
  return TABELA_DA_MONTAGEM.map(
    (l): PerguntaDoSimulador => ({
      id: `${prefixo}.${l.id}`,
      titulo: l.nome,
      tipo: "numero",
      obrigatoria: false,
      ecra: "oque",
      ajuda: `${l.exemplos ? `${l.exemplos} · ` : ""}${comOIvaAoLado(precoNaOperacao(l.preco, operacao))}`,
      unidade: "peças",
      minimo: 0,
      maximo: 99,
      ...(quando ? { quando } : {}),
    }),
  );
}

function montagem(): PerguntaDoSimulador[] {
  return [
    {
      id: "operacaoDaMontagem",
      titulo: "O que é para fazer?",
      tipo: "escolha",
      obrigatoria: true,
      ecra: "oque",
      opcoes: OPERACOES_DA_MONTAGEM.map((o) => ({ id: o.id, nome: o.nome })),
    },
    // Os preços da ajuda são os da montagem; ao desmontar, metade (a estimativa faz a conta).
    ...pecasDaTabela("pecasDaMontagem", "montar"),
    {
      id: "fixarAParede",
      titulo: "Quantos móveis fixar à parede (anti-queda)?",
      tipo: "numero",
      obrigatoria: false,
      ecra: "oque",
      ajuda: `${comOIvaAoLado(FIXAR_A_PAREDE_POR_MOVEL)} por móvel`,
      unidade: "móveis",
      minimo: 0,
      maximo: 99,
    },
    { id: "retirarEmbalagens", titulo: "Quer que retirem as embalagens?", tipo: "escolha", obrigatoria: false, ecra: "oque", opcoes: SIM_NAO, ajuda: comOIvaAoLado(RETIRAR_AS_EMBALAGENS) },
    { id: "cozinhaNaMontagem", titulo: "Há móveis de cozinha?", tipo: "escolha", obrigatoria: false, ecra: "oque", opcoes: SIM_NAO, ajuda: COZINHA_SO_POR_ORCAMENTO },
  ];
}

/**
 * O EXTRA DA DESMONTAGEM NAS RECOLHAS E NA MUDANÇA — 26-11-2026 (d132). Que
 * peças, pela tabela da montagem: numa recolha desmonta-se antes de levar
 * (metade da montagem), numa mudança desmonta-se e monta-se no destino (75 % da
 * soma dos dois). Nas recolhas aparece com o «É preciso desmontar?» a sim; na
 * mudança é opcional e à parte das horas da desmontagem.
 */
function extraDaDesmontagemPelaTabela(servico: string, quando?: CondicaoDaPergunta): PerguntaDoSimulador[] {
  const operacao: OperacaoDaMontagem = servico === "mudanca" ? "os_dois" : "desmontar";
  return pecasDaTabela("desmontarPecas", operacao, quando).map((p, i) =>
    i === 0 ? { ...p, titulo: `${rotuloDoExtraDaDesmontagem(servico)} — ${p.titulo}` } : p,
  );
}

function moveis(): PerguntaDoSimulador[] {
  return [
    {
      id: "movelModo",
      titulo: "Como prefere indicar?",
      tipo: "escolha",
      obrigatoria: true,
      ecra: "oque",
      opcoes: [
        { id: "item", nome: "Por item", ajuda: "Sei exatamente o que tenho" },
        { id: "carga", nome: "Por volume", ajuda: "Não tenho a certeza da quantidade" },
      ],
    },
    ...TAMANHOS.map(
      (t): PerguntaDoSimulador => ({
        id: `itens.${t.id}`,
        titulo: t.nome,
        tipo: "numero",
        obrigatoria: false,
        ecra: "oque",
        quando: { movelModo: ["item"] },
        ajuda: `${t.exemplos} · ${precoDoItem(t.id)}`,
        unidade: "peças",
        minimo: 0,
        maximo: t.maximo,
      }),
    ),
    ...perguntasDaCarga({ movelModo: ["carga"] }),
    desmontagem(),
    ...extraDaDesmontagemPelaTabela("recolha_moveis", { desmontagem: ["sim"] }),
  ];
}

function monos(): PerguntaDoSimulador[] {
  return [...perguntasDaCarga(), desmontagem(), ...extraDaDesmontagemPelaTabela("recolha_monos", { desmontagem: ["sim"] })];
}

function entulho(): PerguntaDoSimulador[] {
  return [
    { id: "entulho", titulo: "Como está o entulho?", tipo: "escolha", obrigatoria: true, ecra: "oque", opcoes: ESTADOS_DO_ENTULHO },
    {
      id: "tipoDeSaco",
      titulo: "Que sacos são?",
      tipo: "escolha",
      obrigatoria: true,
      ecra: "oque",
      opcoes: TIPOS_DE_SACO,
      quando: { entulho: ["ensacado"] },
    },
    {
      id: "quantidade",
      titulo: "Quantos?",
      tipo: "numero",
      obrigatoria: true,
      ecra: "oque",
      quando: { entulho: ["ensacado"], tipoDeSaco: TIPOS_DE_SACO.map((t) => t.id) },
      unidadePor: { campo: "tipoDeSaco", unidades: { pequeno: "sacos", bigbag: "big bags" } },
      minimo: 1,
      maximo: 2000,
    },
    {
      id: "ensacados",
      titulo: "Quantos sacos já estão cheios?",
      tipo: "numero",
      obrigatoria: true,
      ecra: "oque",
      quando: { entulho: ["misto"] },
      unidade: "sacos",
      minimo: 0,
      maximo: 2000,
    },
    {
      id: "porEnsacar",
      titulo: "E quantos sacos há por ensacar, mais ou menos?",
      tipo: "numero",
      obrigatoria: true,
      ecra: "oque",
      quando: { entulho: ["misto"] },
      unidade: "sacos",
      minimo: 0,
      maximo: 2000,
    },
    {
      id: "entulhoVolume",
      titulo: "Quanto ocupa?",
      tipo: "escolha",
      obrigatoria: true,
      ecra: "oque",
      opcoes: VOLUMES_DO_ENTULHO.map(({ id, nome, ajuda }) => ({ id, nome, ...(ajuda ? { ajuda } : {}) })),
      quando: { entulho: ["chao"] },
    },
  ];
}

function esvaziamento(servico: string): PerguntaDoSimulador[] {
  return [
    {
      id: "tipologia",
      titulo: servico === "esvaziamento_casa" ? "Que casa é?" : "Que apartamento é?",
      tipo: "escolha",
      obrigatoria: true,
      ecra: "oque",
      // Cada tipologia com a linha da grelha publicada, com o IVA ao lado.
      opcoes: tipologiasDoEsvaziamento(servico).map((t) => ({ ...t, ajuda: esvaziamentoComOIvaAoLado(t.id) })),
    },
    { id: "recheio", titulo: "Quão cheia está?", tipo: "escolha", obrigatoria: false, ecra: "oque", opcoes: RECHEIOS },
    desmontagem(),
  ];
}

function espaco(servico: string): PerguntaDoSimulador[] {
  const p = PERGUNTAS_DO_ESPACO[servico];
  const l: PerguntaDoSimulador[] = [
    {
      id: "volume",
      titulo: TITULO_DA_QUANTIDADE,
      tipo: "escolha",
      obrigatoria: true,
      ecra: "oque",
      opcoes: RESPOSTAS_DA_QUANTIDADE.map((r) => ({ id: r.valor, nome: r.texto })),
    },
    {
      id: "acessoDoEspaco",
      titulo: p.acesso.titulo,
      tipo: "escolha",
      obrigatoria: true,
      ecra: "oque",
      opcoes: p.acesso.opcoes.map((o) => ({ id: o.valor, nome: o.texto })),
    },
  ];
  if (p.coisas) {
    l.push({
      id: "coisasDoEspaco",
      titulo: TITULO_DAS_COISAS,
      tipo: "escolha",
      varias: true,
      obrigatoria: false,
      ecra: "oque",
      opcoes: p.coisas.map((o) => ({ id: o.valor, nome: o.texto, ...(o.aviso ? { ajuda: o.aviso } : {}) })),
    });
  }
  return [...l, ...perguntasDoAcesso("", "", p.perguntaOAndar)];
}

function mudanca(): PerguntaDoSimulador[] {
  const tipologias = ([...TIPOLOGIAS] as Tipologia[]).map((t) => ({ id: t, nome: TIPOLOGIA_POR_EXTENSO[t] }));
  const ponta = (prefixo: "origem" | "destino", onde: string): PerguntaDoSimulador[] => [
    ...perguntasDoAcesso(prefixo, onde),
    { id: `${prefixo}.difficultAccess`, titulo: `Há alguma dificuldade no acesso${onde}?`, tipo: "escolha", obrigatoria: false, ecra: "acesso", opcoes: SIM_NAO },
    {
      id: `${prefixo}.accessNotes`,
      titulo: "Qual é a dificuldade?",
      tipo: "texto",
      obrigatoria: false,
      ecra: "acesso",
      quando: { [`${prefixo}.difficultAccess`]: ["sim"] },
      maximo: 300,
    },
  ];
  return [
    { id: "tipologia", titulo: "O tamanho da casa", tipo: "escolha", obrigatoria: true, ecra: "oque", opcoes: tipologias },
    desmontagem("É preciso desmontar e montar móveis?", `Acrescenta de ${horasEscritas(HORAS_DA_DESMONTAGEM.itens)} h a ${horasEscritas(HORAS_DA_DESMONTAGEM["T4+"])} h, conforme o tamanho da casa.`),
    // Ou peça a peça, pela tabela da montagem (d132): opcional, à parte das horas.
    ...extraDaDesmontagemPelaTabela("mudanca"),
    ...ponta("origem", " na casa de onde sai"),
    ...ponta("destino", " na casa para onde vai"),
  ];
}

/*
 * ARMAZÉM, ESCRITÓRIO OU LOJA — 15-11-2026 (d43). Que espaço é, quanto há
 * para levar e se é fora de horas; a fatura com NIF e a guia de transporte
 * são as perguntas de sempre do pedido. Sem tipologia nem preço publicado.
 */
function empresa(): PerguntaDoSimulador[] {
  return [
    {
      id: "espacoDaEmpresa",
      titulo: "Que espaço é?",
      tipo: "escolha",
      obrigatoria: true,
      ecra: "oque",
      opcoes: ESPACOS_DA_EMPRESA.map((e) => ({ id: e.id, nome: e.nome })),
    },
    ...perguntasDaCarga(),
    { id: "foraDeHoras", titulo: `${PEDIDOS_DA_EMPRESA.foraDeHoras}?`, tipo: "escolha", obrigatoria: false, ecra: "oque", opcoes: SIM_NAO },
  ];
}

function manutencao(): PerguntaDoSimulador[] {
  return [
    { id: "tipoDeTrabalho", titulo: "Que trabalho é?", tipo: "escolha", obrigatoria: true, ecra: "oque", opcoes: TIPOS_DE_TRABALHO },
    { id: "quantoTrabalho", titulo: "Quanto trabalho é?", tipo: "escolha", obrigatoria: true, ecra: "oque", opcoes: QUANTO_TRABALHO },
    { id: "materiais", titulo: "E os materiais?", tipo: "escolha", obrigatoria: true, ecra: "oque", opcoes: MATERIAIS },
    { id: "repeticao", titulo: "É para repetir?", tipo: "escolha", obrigatoria: false, ecra: "oque", opcoes: REPETICOES },
  ];
}

/** As perguntas de um serviço, pela ordem — `[]` para um serviço que o simulador não oferece. */
export function perguntasDoServico(servico: string): PerguntaDoSimulador[] {
  if (!SERVICOS_PUBLICOS.some((s) => s.id === servico)) return [];
  switch (servico) {
    case "recolha_moveis":
      return [...moveis(), ...perguntasDoAcesso("", "", true, true)];
    case "recolha_monos":
      return [...monos(), ...perguntasDoAcesso("", "", true, true)];
    case "recolha_entulho":
      return [...entulho(), ...perguntasDoAcesso()];
    case "esvaziamento_casa":
    case "esvaziamento_apartamento":
      return [...esvaziamento(servico), ...perguntasDoAcesso()];
    case "esvaziamento_garagem":
    case "esvaziamento_sotao":
    case "esvaziamento_cave":
      return espaco(servico);
    case "esvaziamento_empresa":
      return [...empresa(), ...perguntasDoAcesso()];
    case "mudanca":
      return mudanca();
    case "manutencao_casa":
      return [...manutencao(), ...perguntasDoAcesso()];
    case "montagem_moveis":
      return [...montagem(), ...perguntasDoAcesso()];
    default:
      // «Outro serviço»: a descrição diz tudo; só o acesso.
      return perguntasDoAcesso();
  }
}

/** Onde se pergunta a desmontagem (e só aí). */
export const SERVICOS_COM_DESMONTAGEM: readonly string[] = SERVICOS_PUBLICOS.map((s) => s.id).filter((id) =>
  perguntasDoServico(id).some((p) => p.id === "desmontagem"),
);

/** A pergunta aparece com estas respostas? (as condições de `quando`, todas) */
export function perguntaAparece(p: PerguntaDoSimulador, respostas: Readonly<Record<string, unknown>>): boolean {
  if (!p.quando) return true;
  return Object.entries(p.quando).every(([campo, aceites]) => {
    const v = respostas[campo];
    const t = v === true ? "sim" : v === false ? "nao" : typeof v === "string" ? v : null;
    return t != null && aceites.includes(t);
  });
}
