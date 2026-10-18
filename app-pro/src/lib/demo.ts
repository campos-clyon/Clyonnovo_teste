import type { MeusPedidos, Trabalho } from "./trabalhos";
import { diaEmLisboa, instanteEmLisboa } from "../../../src/lib/hora-de-lisboa";

/**
 * MODO DE DEMONSTRAÇÃO — só para ver os ecrãs no navegador durante o
 * desenvolvimento (`EXPO_PUBLIC_DEMO=1`). O navegador não pode chamar o
 * clyon.pt a partir de outro endereço, e os ecrãs não devem ser testados com
 * pedidos verdadeiros. Os trabalhos daqui são EXEMPLOS inventados.
 */
export const EM_DEMO = process.env.EXPO_PUBLIC_DEMO === "1";

const agora = Date.now();
const haHoras = (h: number) => new Date(agora - h * 3_600_000).toISOString();
const daquiADias = (d: number) => new Date(agora + d * 86_400_000).toISOString().slice(0, 10);

const BASE: Omit<Trabalho, "negociacaoId" | "pedidoId" | "estado" | "fase" | "serviceType" | "city"> = {
  propostas: "[]",
  valorAcordado: null,
  querPagar: null,
  recebeSeAceitar: null,
  recebeSeFechado: null,
  valorDaClyon: null,
  sugestao: null,
  taxas: { cliente: 0.05, profissional: 0.06 },
  formaDePagamento: "na_plataforma",
  ofertaClyon: null,
  valorFixo: null,
  concorrentes: 3,
  pedidoCancelado: false,
  description: null,
  filesJson: null,
  urgency: "this_week",
  dataAgendada: null,
  dataCombinada: null,
  criadoEm: haHoras(2),
  criadaEm: haHoras(2),
  floor: null,
  hasElevator: null,
  parkingDistance: null,
  localidadeDestino: null,
  andarDestino: null,
  percursoKm: null,
  entulhoEstado: null,
  entulhoQuantidade: null,
  baseDoPreco: "total",
  distanciaKm: null,
  minutosDeCarro: null,
  distanciaMedidaPor: "estrada",
  precisaFatura: false,
  precisaGuiaTransporte: false,
  morada: null,
  moradaDestino: null,
  contactoNome: null,
  contactoTelefone: null,
  abertoEm: null,
  arquivadoEm: null,
  actualizadoEm: haHoras(1),
  confirmadoEm: null,
  pagoEm: null,
  aCaminhoEm: null,
  chegouEm: null,
  ajuste: null,
  execucaoEnviadaEm: null,
  provaJson: null,
  diasAteLibertar: null,
};

const AJUSTE_LIVRE = { pendente: null, ultimo: null, restantes: 2, porqueNao: null };
const JA_PEDIU_DOIS = "Já pediu 2 ajustes neste trabalho. A partir daqui é outro orçamento: fale com a CLYON.";

/** As 23:59 de hoje em Lisboa — a mesma conta do site (`expiraEm`). */
function fimDoDiaEmLisboa(): string {
  const fim = instanteEmLisboa(`${diaEmLisboa(new Date())}T23:59`);
  return new Date((fim ?? new Date()).getTime() + 59_999).toISOString();
}

let trabalhos: Trabalho[] = [
  {
    ...BASE,
    negociacaoId: 901,
    pedidoId: 4101,
    estado: "aberta",
    fase: "a_negociar",
    serviceType: "recolha_entulho",
    city: "Almada (exemplo)",
    description: "Exemplo: 25 sacos de entulho de obra de casa de banho, já ensacados, na garagem.",
    floor: "R/C",
    hasElevator: "no",
    parkingDistance: "door",
    entulhoEstado: "ensacado",
    entulhoQuantidade: "25",
    distanciaKm: 14.2,
    dataAgendada: daquiADias(3),
    precisaGuiaTransporte: true,
    sugestao: { horas: 2, pessoas: 2, custoMinimo: 95, precoSugerido: 140, recebeSePropuser: 131.6, lucroEstimado: 36.6, porCarga: false },
  },
  {
    ...BASE,
    negociacaoId: 902,
    pedidoId: 4102,
    estado: "aberta",
    fase: "a_negociar",
    serviceType: "recolha_monos",
    city: "Seixal (exemplo)",
    description: "Exemplo: um sofá de três lugares e um colchão de casal.",
    floor: "3.º",
    hasElevator: "yes",
    parkingDistance: "under_20m",
    distanciaKm: 4.8,
    urgency: "tomorrow",
    ofertaClyon: "distribuida",
    valorFixo: 70,
    valorDaClyon: 56,
    taxas: { cliente: 0, profissional: 0.2 },
    propostas: JSON.stringify([{ por: "cliente", valor: 70, criadaEm: haHoras(1), estado: "pendente" }]),
  },
  {
    ...BASE,
    negociacaoId: 903,
    pedidoId: 4095,
    estado: "aberta",
    fase: "a_negociar",
    serviceType: "mudanca",
    city: "Lisboa (exemplo)",
    description: "Exemplo: mudança de um T2, com desmontagem de dois roupeiros.",
    floor: "2.º",
    hasElevator: "small",
    localidadeDestino: "Amadora",
    andarDestino: "1.º",
    percursoKm: 12,
    distanciaKm: 22,
    baseDoPreco: "hora",
    abertoEm: haHoras(5),
    propostas: JSON.stringify([
      { por: "profissional", valor: 260, criadaEm: haHoras(6), estado: "recusada" },
      { por: "cliente", valor: 230, criadaEm: haHoras(3), estado: "pendente" },
    ]),
    querPagar: 230,
    recebeSeAceitar: 216.2,
  },
  {
    ...BASE,
    negociacaoId: 904,
    pedidoId: 4080,
    estado: "acordada",
    fase: "a_executar",
    serviceType: "esvaziamento_casa",
    city: "Barreiro (exemplo)",
    distanciaKm: 9,
    valorAcordado: 380,
    recebeSeFechado: 357.2,
    dataCombinada: `${daquiADias(1)}T09:30:00.000Z`,
    abertoEm: haHoras(30),
    morada: "Rua de Exemplo, 10, Barreiro",
    contactoNome: "Cliente de exemplo",
    contactoTelefone: "+351 900 000 000",
    ajuste: AJUSTE_LIVRE,
  },
  {
    ...BASE,
    negociacaoId: 905,
    pedidoId: 4110,
    estado: "aberta",
    fase: "a_negociar",
    serviceType: "esvaziamento_apartamento",
    city: "Vila Franca de Xira (exemplo)",
    description: "Exemplo: esvaziamento completo de um T3 com arrecadação.",
    floor: "0",
    hasElevator: "no",
    parkingDistance: "near",
    distanciaKm: 38.6,
    baseDoPreco: "carga",
    ofertaClyon: "distribuida",
    valorFixo: 350,
    valorDaClyon: 297.5,
    taxas: { cliente: 0, profissional: 0.15 },
    propostas: JSON.stringify([{ por: "cliente", valor: 350, criadaEm: haHoras(20), estado: "pendente" }]),
  },
  {
    // Um ajuste que o cliente recusou: o ecrã mostra as três saídas.
    ...BASE,
    negociacaoId: 906,
    pedidoId: 4071,
    estado: "acordada",
    fase: "a_executar",
    serviceType: "recolha_entulho",
    city: "Amora (exemplo)",
    distanciaKm: 3.2,
    valorAcordado: 135,
    recebeSeFechado: 126.9,
    dataCombinada: `${daquiADias(0)}T08:00:00.000Z`,
    criadaEm: haHoras(50),
    abertoEm: haHoras(48),
    aCaminhoEm: haHoras(1.5),
    chegouEm: haHoras(1),
    morada: "Rua de Exemplo, 2, Amora",
    contactoNome: "Outro cliente de exemplo",
    contactoTelefone: "+351 900 000 001",
    ajuste: {
      pendente: null,
      ultimo: {
        pedidoEm: haHoras(0.8),
        valorAntigo: 135,
        valorNovo: 300,
        motivo: "Exemplo: eram 50 sacos, não 20.",
        fotos: [],
        estado: "recusado",
        respondidoEm: haHoras(0.5),
        respondidoPor: "cliente",
      },
      restantes: 1,
      porqueNao: null,
    },
  },
  {
    // Um trabalho já entregue, à espera de o cliente confirmar.
    ...BASE,
    negociacaoId: 907,
    pedidoId: 4060,
    estado: "acordada",
    fase: "a_confirmar",
    serviceType: "recolha_monos",
    city: "Corroios (exemplo)",
    distanciaKm: 6,
    valorAcordado: 90,
    recebeSeFechado: 84.6,
    criadaEm: haHoras(80),
    abertoEm: haHoras(79),
    execucaoEnviadaEm: haHoras(20),
    diasAteLibertar: 6.2,
    provaJson: JSON.stringify({ fotos: [], nota: "Exemplo: tudo levado, escada limpa.", em: haHoras(20) }),
    morada: "Rua de Exemplo, 7, Corroios",
    contactoNome: "Cliente de exemplo",
    ajuste: AJUSTE_LIVRE,
  },
];

/** Responde como o site responderia, com os exemplos daqui. */
export async function pedirEmDemo<T>(caminho: string, metodo: string, corpo: unknown): Promise<T> {
  await new Promise((r) => setTimeout(r, 300));
  const c = (corpo ?? {}) as Record<string, unknown>;
  if (caminho === "/api/profissionais/entrar" || caminho === "/api/profissionais/sessao") {
    return { ok: true, nome: "Profissional de exemplo", token: "demo" } as T;
  }
  if (caminho === "/api/profissionais/meus-pedidos") {
    return { nome: "Profissional de exemplo", pedidos: trabalhos } satisfies MeusPedidos as T;
  }
  if (caminho === "/api/profissionais/perfil") {
    return { perfil: { nome: "Profissional de exemplo", estado: "aprovado", raioKm: 100, cidade: "Seixal" } } as T;
  }
  if (caminho === "/api/profissionais/negociacao" && metodo === "POST") {
    trabalhos = trabalhos.map((t) => {
      if (t.negociacaoId !== c.negociacaoId) return t;
      if (c.accao === "desistir" || c.accao === "recusar") return { ...t, estado: "desistida" };
      if (c.accao === "aceitar") return { ...t, estado: "aguarda_contratacao", valorAcordado: t.querPagar ?? t.valorFixo };
      const propostas = [...JSON.parse(t.propostas ?? "[]"), { por: "profissional", valor: c.valor, criadaEm: new Date().toISOString(), estado: "pendente" }];
      return { ...t, propostas: JSON.stringify(propostas) };
    });
    return { ok: true } as T;
  }

  // ── O trabalho contratado (fase 3): uma imitação simples das regras do site ──
  const mudar = (fn: (t: Trabalho) => Trabalho) => {
    trabalhos = trabalhos.map((t) => (t.negociacaoId === c.negociacaoId ? fn(t) : t));
  };
  const agoraIso = new Date().toISOString();
  if (caminho === "/api/profissionais/agenda" && metodo === "POST") {
    mudar((t) => ({ ...t, dataCombinada: `${String(c.quando)}:00+01:00` }));
    return { ok: true } as T;
  }
  if (caminho === "/api/profissionais/trabalho/etapa") {
    mudar((t) =>
      c.etapa === "a_caminho"
        ? { ...t, aCaminhoEm: t.aCaminhoEm ?? agoraIso }
        : { ...t, aCaminhoEm: t.aCaminhoEm ?? agoraIso, chegouEm: t.chegouEm ?? agoraIso },
    );
    return { ok: true, primeiraVez: true } as T;
  }
  if (caminho === "/api/profissionais/trabalho/ajuste") {
    mudar((t) => {
      const v = t.ajuste ?? AJUSTE_LIVRE;
      if (metodo === "DELETE" && v.pendente) {
        // Retirar não conta para os dois.
        const ultimo = { ...v.pendente, estado: "cancelado" as const };
        const restantes = v.restantes + 1;
        return { ...t, ajuste: { pendente: null, ultimo, restantes, porqueNao: restantes > 0 ? null : JA_PEDIU_DOIS } };
      }
      const antigo = t.valorAcordado ?? 0;
      const novo = Number(c.valorNovo);
      const ajuste = { pedidoEm: agoraIso, valorAntigo: antigo, valorNovo: novo, motivo: String(c.motivo), fotos: (c.fotos as string[]) ?? [] };
      const restantes = v.restantes - 1;
      if (novo < antigo) {
        const ultimo = { ...ajuste, estado: "descida" as const };
        return {
          ...t,
          valorAcordado: novo,
          recebeSeFechado: novo * (1 - t.taxas.profissional),
          ajuste: { pendente: null, ultimo, restantes, porqueNao: restantes > 0 ? null : JA_PEDIU_DOIS },
        };
      }
      const pendente = { ...ajuste, estado: "pendente" as const, expiraEm: fimDoDiaEmLisboa() };
      return { ...t, ajuste: { pendente, ultimo: pendente, restantes, porqueNao: "Já tem um pedido de ajuste à espera do cliente." } };
    });
    return { ok: true } as T;
  }
  if (caminho === "/api/profissionais/trabalho" && metodo === "POST") {
    mudar((t) => ({
      ...t,
      fase: "a_confirmar",
      execucaoEnviadaEm: agoraIso,
      provaJson: JSON.stringify({ fotos: c.fotos, nota: c.nota, em: agoraIso }),
      diasAteLibertar: 7,
    }));
    return { ok: true } as T;
  }
  return { ok: true } as T;
}
