/**
 * AS CONVERSAS DE TESTE DA VITÓRIA AGENTE — d92 (23-11-2026). INVENTADAS.
 *
 * O repositório é público: nenhum nome, telefone, morada ou parceiro real. Os
 * números do primeiro caso são os do pedido que motivou a d92 (duas propostas,
 * uma de um parceiro isento de IVA, «85,00 € + IVA = 86,96 €», e uma com IVA,
 * «108,00 € + IVA = 132,84 €»), com nomes inventados.
 *
 * Servem duas vezes:
 *  - nos testes (`d92-vitoria-agente-fases-4-e-5.test.ts`), com o SDK simulado
 *    a seguir o `roteiro` de cada uma — prova o código (identificar, reler,
 *    os limites, a guarda, a frase do SIM, o IVA pelo cálculo real);
 *  - no script `scripts/avaliar-vitoria-agente.ts`, contra a API real (só o
 *    CEO o corre, com tecto), para ver o que o modelo faz de facto com cada
 *    uma, em «low» e em «medium».
 */

import type { DependenciasDasFerramentas, PedidoParaOAgente } from "./ferramentas";
import { propostasParaOAgente, type NegociacaoParaOAgente, type PedidoParaOFecho, type PropostaComOValorDoParceiro } from "./propostas-do-agente";

/** O «agora» dos casos: segunda-feira, 23-11-2026, 15h de Lisboa (Inverno: Lisboa = UTC). */
export const AGORA_DOS_CASOS = new Date("2026-11-23T15:00:00Z");
const HA_UMA_HORA = new Date(AGORA_DOS_CASOS.getTime() - 3600_000).toISOString();
const ONTEM = new Date(AGORA_DOS_CASOS.getTime() - 26 * 3600_000).toISOString();

export type AccaoEsperada = "responder" | "fecho" | "parceiro" | "cancelar" | "equipa";

export type CasoDeTeste = {
  nome: string;
  pedidoId: number;
  conversa: Array<{ direccao: "in" | "out"; texto: string }>;
  pedido: PedidoParaOAgente;
  negociacoes: NegociacaoParaOAgente[];
  fecho?: PedidoParaOFecho;
  espera: {
    accao: AccaoEsperada;
    /** O que a mensagem ao cliente tem de ter (em português: a tradução é à saída). */
    contem?: string[];
    naoContem?: string[];
  };
  /** O roteiro do modelo simulado (só nos testes): as ferramentas, por ordem, e a resposta a partir dos resultados. */
  roteiro: {
    ferramentas: Array<{ nome: string; entrada: Record<string, unknown> }>;
    resposta: (r: Record<string, Record<string, unknown>>) => { ferramenta: "propor_resposta" | "passar_a_equipa"; entrada: Record<string, unknown> };
  };
};

/** Uma negociação inventada, no modelo de 15-11 (IVA incluído), com uma proposta do parceiro pendente. */
function negociacao(id: number, parceiro: string, valor: number, regime: "isento" | "normal", extra: Partial<NegociacaoParaOAgente> = {}): NegociacaoParaOAgente {
  return {
    id,
    estado: "aberta",
    profissionalNome: parceiro,
    propostasJson: JSON.stringify([{ por: "profissional", valor, criadaEm: HA_UMA_HORA, estado: "pendente" }]),
    createdAt: ONTEM,
    updatedAt: HA_UMA_HORA,
    taxaCliente: 0,
    taxaProfissional: 0.1,
    regimeDoProfissional: regime,
    ...extra,
  } as NegociacaoParaOAgente;
}

const pedido = (id: number, extra: Partial<PedidoParaOAgente> = {}): PedidoParaOAgente => ({
  id,
  serviceType: "recolha_monos",
  status: "pendente",
  contactName: "Cliente Teste",
  address: "Rua Inventada 1",
  city: "Almada",
  postalCode: "2800-000",
  floor: "2",
  hasElevator: "sim",
  parkingDistance: "perto",
  description: "Um sofá de três lugares e um colchão.",
  filesJson: "[]",
  ...extra,
});

/** As propostas do caso, pelo cálculo real (o mesmo da mensagem das propostas). */
export function propostasDoCaso(c: CasoDeTeste): PropostaComOValorDoParceiro[] {
  return propostasParaOAgente(c.pedidoId, c.negociacoes, new Set(c.negociacoes.map((n) => Number(n.id))), c.pedido.baseDoPreco);
}

/** As dependências fingidas das ferramentas para um caso (o script da API real usa as mesmas). */
export function ferramentasDoCaso(c: CasoDeTeste, extra: Partial<DependenciasDasFerramentas> = {}): DependenciasDasFerramentas {
  const lista = propostasDoCaso(c);
  return {
    telefone: "351900000000",
    agora: AGORA_DOS_CASOS,
    pedidosDoTelefone: async () => [c.pedidoId],
    lerPedido: async (id) => (id === c.pedidoId ? c.pedido : null),
    lerConversa: async (n) => c.conversa.slice(-n).map((l) => ({ ...l, criadoEm: null })),
    propostasDoPedido: async () =>
      lista.length === 0
        ? `Pedido #${c.pedidoId}: ainda à espera de propostas dos parceiros.`
        : `Pedido #${c.pedidoId} — propostas:\n${lista.map((p) => `• ${p.parceiro}: ${p.comoOClienteVe}`).join("\n")}`,
    oQueOSiteSabe: () =>
      "O QUE O SITE DIZ (resumo de teste): a CLYON é uma plataforma; os parceiros da zona respondem com o preço deles. Por carga: uma carga é o que cabe numa viagem da carrinha do parceiro; os itens a mais confirmam-se no local. A limpeza depois de esvaziar também se faz: fica registada no pedido, para o parceiro a incluir.",
    propostasParaEscolher: async (id) => (id === c.pedidoId ? lista : []),
    pedidoParaOFecho: async () => c.fecho ?? { status: c.pedido.status ?? null, baseDoPreco: c.pedido.baseDoPreco },
    perguntasFrequentes: () => [
      { pergunta: "Preços — O que é uma carga?", resposta: "Uma carga é o que cabe numa viagem da carrinha do parceiro. Num pedido por carga, o valor é por cada carga." },
      { pergunta: "Limpeza depois do esvaziamento", resposta: "A limpeza depois de esvaziar também se faz: fica registada no seu pedido, para o parceiro a incluir." },
    ],
    ...extra,
  };
}

const RECOLHAS_TEJO = "Recolhas Tejo";
const SADO_SERVICOS = "Sado Serviços";
const DUAS = (id: number) => [negociacao(id * 10 + 1, RECOLHAS_TEJO, 85, "isento"), negociacao(id * 10 + 2, SADO_SERVICOS, 108, "normal")];
const PROPOSTAS_DITAS = (id: number) =>
  `Pedido #${id}: já tem 2 propostas.\n• ${RECOLHAS_TEJO}: 85,00 € + IVA = 86,96 €\n• ${SADO_SERVICOS}: 108,00 € + IVA = 132,84 €\nPara escolher, diga qual.`;

/** O texto da resposta simulada que leva a frase obrigatória (a do SIM ou do CANCELAR). */
const comAFrase = (antes: string) => (r: Record<string, Record<string, unknown>>) => {
  const frase = String(
    (r.aceitar_proposta?.fraseQueTemDeIrNaResposta as string | undefined) ?? (r.cancelar_pedido?.fraseQueTemDeIrNaResposta as string | undefined) ?? "",
  );
  return { ferramenta: "propor_resposta" as const, entrada: { texto: `${antes} ${frase}`.trim() } };
};

export const CONVERSAS_DE_TESTE: CasoDeTeste[] = [
  {
    nome: "1. O IVA do parceiro isento e o dia (o caso que motivou a d92)",
    pedidoId: 663,
    conversa: [
      { direccao: "out", texto: PROPOSTAS_DITAS(663) },
      { direccao: "in", texto: `O valor do IVA da ${RECOLHAS_TEJO} está correto? E em que dia podem vir?` },
    ],
    pedido: pedido(663),
    negociacoes: DUAS(663),
    espera: { accao: "responder", contem: ["86,96", "isento"], naoContem: ["profissional"] },
    roteiro: {
      ferramentas: [
        { nome: "propostas_vivas", entrada: { pedido: 663 } },
        { nome: "ler_pedido", entrada: { pedido: 663 } },
      ],
      resposta: (r) => {
        const p = (r.propostas_vivas.propostas as Array<{ parceiro: string; explicacaoDoIva: string }>).find((x) => x.parceiro === RECOLHAS_TEJO)!;
        return {
          ferramenta: "propor_resposta",
          entrada: { texto: `Está, sim. ${p.explicacaoDoIva} Quanto ao dia, ainda não há data combinada: confirmo com o parceiro escolhido.` },
        };
      },
    },
  },
  {
    nome: "2. Escolhe com uma condição («até quinta-feira»)",
    pedidoId: 664,
    conversa: [
      { direccao: "out", texto: PROPOSTAS_DITAS(664) },
      { direccao: "in", texto: `Escolho a proposta da ${RECOLHAS_TEJO} com a condição da recolha ser feita até quinta-feira` },
    ],
    pedido: pedido(664),
    negociacoes: DUAS(664),
    espera: { accao: "parceiro", contem: ["confirm"], naoContem: ["Responda SIM"] },
    roteiro: {
      ferramentas: [{ nome: "perguntar_ao_parceiro", entrada: { pedido: 664, escolha: RECOLHAS_TEJO, condicao: "até quinta-feira" } }],
      resposta: () => ({
        ferramenta: "propor_resposta",
        entrada: { texto: `Boa escolha! Vou confirmar com a ${RECOLHAS_TEJO} se consegue fazer a recolha até quinta-feira e digo-lhe logo que me respondam.` },
      }),
    },
  },
  {
    nome: "3. Escolha simples pelo nome",
    pedidoId: 665,
    conversa: [
      { direccao: "out", texto: PROPOSTAS_DITAS(665) },
      { direccao: "in", texto: `Fico com a da ${SADO_SERVICOS}, prefiro com fatura com IVA.` },
    ],
    pedido: pedido(665),
    negociacoes: DUAS(665),
    espera: { accao: "fecho", contem: ["132,84", "Responda SIM"] },
    roteiro: { ferramentas: [{ nome: "aceitar_proposta", entrada: { pedido: 665, escolha: SADO_SERVICOS } }], resposta: comAFrase("Combinado.") },
  },
  {
    nome: "4. Escolha pela ordem («a primeira»)",
    pedidoId: 666,
    conversa: [
      { direccao: "out", texto: PROPOSTAS_DITAS(666) },
      { direccao: "in", texto: "Pode ser a primeira" },
    ],
    pedido: pedido(666),
    negociacoes: DUAS(666),
    espera: { accao: "fecho", contem: ["86,96", "Responda SIM"] },
    roteiro: { ferramentas: [{ nome: "aceitar_proposta", entrada: { pedido: 666, escolha: "a primeira" } }], resposta: comAFrase("Perfeito.") },
  },
  {
    nome: "5. O que é uma carga",
    pedidoId: 667,
    conversa: [
      { direccao: "out", texto: `Pedido #667: já tem 1 proposta.\n• ${SADO_SERVICOS}: 108,00 € + IVA = 132,84 € por carga` },
      { direccao: "in", texto: "Por carga quer dizer o quê? Se for mais do que uma carga pago o dobro?" },
    ],
    pedido: pedido(667, { baseDoPreco: "carga" }),
    negociacoes: [negociacao(6671, SADO_SERVICOS, 108, "normal")],
    espera: { accao: "responder", contem: ["carga"] },
    roteiro: {
      ferramentas: [{ nome: "perguntas_frequentes", entrada: { procura: "carga" } }],
      resposta: () => ({
        ferramenta: "propor_resposta",
        entrada: { texto: "Uma carga é o que cabe numa viagem da carrinha do parceiro, e o valor é por cada carga: se o parceiro precisar de duas, são duas. Ele confirma no local." },
      }),
    },
  },
  {
    nome: "6. A limpeza depois do esvaziamento",
    pedidoId: 668,
    conversa: [
      { direccao: "out", texto: "Pedido #668: ainda à espera de propostas dos parceiros." },
      { direccao: "in", texto: "Depois de esvaziarem a casa também fazem a limpeza?" },
    ],
    pedido: pedido(668, { serviceType: "esvaziamento_casa" }),
    negociacoes: [],
    espera: { accao: "responder", contem: ["limpeza"], naoContem: ["não fazemos"] },
    roteiro: {
      ferramentas: [{ nome: "perguntas_frequentes", entrada: { procura: "limpeza esvaziamento" } }],
      resposta: () => ({ ferramenta: "propor_resposta", entrada: { texto: "Fazem, sim! A limpeza depois de esvaziar fica registada no seu pedido, para o parceiro a incluir na proposta." } }),
    },
  },
  {
    nome: "7. Quer cancelar",
    pedidoId: 669,
    conversa: [
      { direccao: "out", texto: "Pedido #669: ainda à espera de propostas dos parceiros." },
      { direccao: "in", texto: "Já não preciso, consegui resolver de outra forma. Podem cancelar?" },
    ],
    pedido: pedido(669),
    negociacoes: [],
    espera: { accao: "cancelar", contem: ["Responda CANCELAR"] },
    roteiro: { ferramentas: [{ nome: "cancelar_pedido", entrada: { pedido: 669, motivo: "já não precisa" } }], resposta: comAFrase("Claro, sem problema.") },
  },
  {
    nome: "8. Uma queixa",
    pedidoId: 670,
    conversa: [
      { direccao: "out", texto: `Pedido #670: fechado com ${SADO_SERVICOS}.` },
      { direccao: "in", texto: "O parceiro deixou metade das coisas no patamar e não atende o telefone. Isto é inaceitável." },
    ],
    pedido: pedido(670, { status: "contratado" }),
    negociacoes: [],
    fecho: { temAcordada: true, queixa: true },
    espera: { accao: "equipa" },
    roteiro: {
      ferramentas: [],
      resposta: () => ({
        ferramenta: "passar_a_equipa",
        entrada: {
          motivo: "queixa: o parceiro deixou parte do trabalho por fazer",
          mensagem: "Lamento muito, isso não pode ficar assim. Passei já a conversa a uma pessoa da equipa, que fala com o parceiro e lhe responde por aqui.",
        },
      }),
    },
  },
  {
    nome: "9. Escolhe uma proposta acima de 500 €",
    pedidoId: 671,
    conversa: [
      { direccao: "out", texto: `Pedido #671: já tem 1 proposta.\n• ${SADO_SERVICOS}: 600,00 € + IVA = 738,00 €` },
      { direccao: "in", texto: "Aceito a proposta." },
    ],
    pedido: pedido(671, { serviceType: "esvaziamento_casa" }),
    negociacoes: [negociacao(6711, SADO_SERVICOS, 600, "normal")],
    espera: { accao: "equipa" },
    roteiro: {
      ferramentas: [{ nome: "aceitar_proposta", entrada: { pedido: 671, escolha: "aceito essa" } }],
      resposta: (r) => ({
        ferramenta: "passar_a_equipa",
        entrada: { motivo: String(r.aceitar_proposta.motivo ?? "acima de 500 €"), mensagem: "Ótimo! Para este valor, uma pessoa da equipa confirma consigo os pormenores e reserva — já a seguir." },
      }),
    },
  },
  {
    nome: "10. Em inglês: as propostas de uma recolha em Lisboa (a saída traduz)",
    pedidoId: 672,
    conversa: [
      { direccao: "out", texto: PROPOSTAS_DITAS(672) },
      { direccao: "in", texto: `Hi! Which one includes VAT? I think I'll take the ${SADO_SERVICOS} one, it's for my flat in Lisbon.` },
    ],
    pedido: pedido(672, { city: "Lisboa" }),
    negociacoes: DUAS(672),
    espera: { accao: "fecho", contem: ["132,84", "Responda SIM"], naoContem: ["Which", "VAT", "Lisbon"] },
    roteiro: {
      ferramentas: [
        { nome: "propostas_vivas", entrada: { pedido: 672 } },
        { nome: "aceitar_proposta", entrada: { pedido: 672, escolha: SADO_SERVICOS } },
      ],
      resposta: comAFrase("As duas têm o IVA incluído no total; a da Sado Serviços passa fatura com IVA."),
    },
  },
  {
    nome: "11. O código postal já foi dado (chega tapado) e há perguntas directas",
    pedidoId: 673,
    conversa: [
      { direccao: "out", texto: "Pedido #673: ainda à espera de propostas dos parceiros." },
      { direccao: "in", texto: "O código postal é [código postal recebido] Lisboa. Qual é o preço total? Podem fazer só a descida do mono e eu trato com a Câmara?" },
    ],
    pedido: pedido(673, { city: "Lisboa" }),
    negociacoes: [],
    espera: { accao: "responder", naoContem: ["código postal outra vez", "sem os números", "escrever outra vez"] },
    roteiro: {
      ferramentas: [
        { nome: "ler_pedido", entrada: { pedido: 673 } },
        { nome: "propostas_vivas", entrada: { pedido: 673 } },
      ],
      resposta: () => ({
        ferramenta: "propor_resposta",
        entrada: {
          texto: "Obrigada, ficou tudo anotado. O preço total vem nas propostas dos parceiros, que ainda estão a chegar. Quanto a fazerem só a descida do mono, deixo isso escrito no pedido e o parceiro diz-lhe na proposta se pode ser assim.",
        },
      }),
    },
  },
  {
    nome: "12. «Inclui o transporte?» depois do fecho proposto (o caso que motivou a d97)",
    pedidoId: 674,
    conversa: [
      { direccao: "out", texto: PROPOSTAS_DITAS(674) },
      { direccao: "in", texto: `Fico com a da ${RECOLHAS_TEJO}.` },
      {
        direccao: "out",
        texto: `Ótima escolha! O parceiro desce, carrega e leva tudo. Reservo ${RECOLHAS_TEJO} por 86,96 € (parceiro isento de IVA — só a taxa da plataforma leva IVA) no pedido #674? Responda SIM.`,
      },
      { direccao: "in", texto: "Antes queria validar que o serviço inclui o transporte" },
    ],
    pedido: pedido(674),
    negociacoes: DUAS(674),
    // Responde-se logo, sem perguntar ao parceiro, e a pergunta do SIM vai outra vez.
    espera: { accao: "fecho", contem: ["transporte", "Responda SIM."], naoContem: ["vou confirmar", "confirmar com o parceiro"] },
    roteiro: {
      ferramentas: [
        { nome: "o_que_o_servico_inclui", entrada: { pedido: 674 } },
        { nome: "aceitar_proposta", entrada: { pedido: 674, escolha: RECOLHAS_TEJO } },
      ],
      resposta: comAFrase("Inclui, sim: a recolha inclui a descida, a carga e o transporte, e o parceiro trata do destino."),
    },
  },
];
