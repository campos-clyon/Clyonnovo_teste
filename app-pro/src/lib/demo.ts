import type { MeusPedidos, Trabalho } from "./trabalhos";

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
};

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
  return { ok: true } as T;
}
