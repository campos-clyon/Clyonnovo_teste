import { SERVICE_CATEGORIES } from "./service-categories";

/**
 * O que se pede a quem se quer inscrever como profissional.
 *
 * A inscrição é a porta por onde entra quem vai a casa dos clientes. Vale a
 * pena ser exigente aqui e não depois: um registo incompleto transforma-se
 * numa conversa por telefone que alguém tem de ter, e num pedido que não é
 * mostrado a ninguém porque o perfil não tem categorias.
 *
 * O que NÃO se decide aqui: se ele é aprovado, e se a guia de transporte dele
 * é verdadeira. As duas coisas são de uma pessoa, não deste ficheiro.
 */

export const CATEGORIAS_VALIDAS = SERVICE_CATEGORIES.map((c) => c.id);

/** Ninguém se desloca 500 km para levar um sofá. Acima disto é engano. */
export const RAIO_MAXIMO_KM = 200;
export const RAIO_MINIMO_KM = 1;

export type ErroDeInscricao = { campo: string; mensagem: string };

/**
 * O regime de IVA do profissional.
 *
 * Quem presta o serviço é ele, e o IVA é do regime DELE — não nosso. Um
 * profissional em isenção pelo art. 53.º do CIVA não liquida IVA nenhum; um
 * coletado liquida 23 %.
 *
 * Perguntar é a única forma honesta de o saber. A alternativa que esteve em
 * cima da mesa — assumir 23 % para todos — mostrava a quem contrata um isento
 * um imposto que não é devido e que ninguém pode entregar ao Estado.
 *
 * Por omissão, `isento`: entre mostrar imposto a mais e imposto a menos, o
 * primeiro é o que cria um problema a alguém.
 */
export const REGIMES_DE_IVA = ["isento", "normal"] as const;
export type RegimeDeIva = (typeof REGIMES_DE_IVA)[number];

export function regimeDeIvaValido(valor: unknown): valor is RegimeDeIva {
  return typeof valor === "string" && (REGIMES_DE_IVA as readonly string[]).includes(valor);
}

export type DadosDeInscricao = {
  nome: string;
  email: string;
  telefone: string;
  nif: string | null;
  cidade: string;
  categorias: string[];
  zonas: string[];
  raioKm: number;
  emiteFatura: boolean;
  regimeIva: RegimeDeIva;
  emiteGuiaTransporte: boolean;
  numeroTransportador: string | null;
};

export type ResultadoDeInscricao =
  | { ok: true; dados: DadosDeInscricao }
  | { ok: false; erros: ErroDeInscricao[] };

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function listaDeTextos(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
}

/**
 * O NIF português tem 9 dígitos e um dígito de controlo.
 *
 * Verificar o dígito apanha o engano de digitação no momento em que ele
 * acontece, que é quando é barato de corrigir — em vez de ficar na base a
 * estragar uma fatura meses depois.
 */
export function nifValido(nif: string): boolean {
  const limpo = nif.replace(/\s/g, "");
  if (!/^\d{9}$/.test(limpo)) return false;
  let soma = 0;
  for (let i = 0; i < 8; i++) soma += Number(limpo[i]) * (9 - i);
  const resto = soma % 11;
  const controlo = resto < 2 ? 0 : 11 - resto;
  return controlo === Number(limpo[8]);
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Telemóvel ou fixo português, com ou sem indicativo e com ou sem espaços. */
export function telefoneValido(telefone: string): boolean {
  const limpo = telefone.replace(/[\s.-]/g, "").replace(/^\+351/, "").replace(/^00351/, "");
  return /^[239]\d{8}$/.test(limpo);
}

export function validarInscricao(corpo: unknown): ResultadoDeInscricao {
  const erros: ErroDeInscricao[] = [];
  const c = (corpo ?? {}) as Record<string, unknown>;

  const nome = texto(c.nome);
  if (nome.length < 3) {
    erros.push({ campo: "nome", mensagem: "Indique o nome ou a designação da empresa." });
  }

  const email = texto(c.email).toLowerCase();
  if (!emailValido(email)) {
    erros.push({ campo: "email", mensagem: "Email inválido." });
  }

  const telefone = texto(c.telefone);
  if (!telefoneValido(telefone)) {
    erros.push({ campo: "telefone", mensagem: "Número de telefone português inválido." });
  }

  const cidade = texto(c.cidade);
  if (cidade.length < 2) {
    erros.push({ campo: "cidade", mensagem: "Indique a cidade onde tem base." });
  }

  const categorias = listaDeTextos(c.categorias).filter((id) => CATEGORIAS_VALIDAS.includes(id));
  if (categorias.length === 0) {
    erros.push({ campo: "categorias", mensagem: "Escolha pelo menos um serviço que faça." });
  }

  const raioBruto = typeof c.raioKm === "string" ? Number(c.raioKm) : c.raioKm;
  const raioKm = typeof raioBruto === "number" && Number.isFinite(raioBruto) ? Math.round(raioBruto) : NaN;
  if (!Number.isFinite(raioKm) || raioKm < RAIO_MINIMO_KM || raioKm > RAIO_MAXIMO_KM) {
    erros.push({
      campo: "raioKm",
      mensagem: `Indique até quantos quilómetros se desloca (${RAIO_MINIMO_KM} a ${RAIO_MAXIMO_KM}).`,
    });
  }

  // O NIF é opcional para quem não emite fatura, e obrigatório para quem
  // emite — sem ele não há fatura nenhuma, e a declaração ficava vazia.
  const emiteFatura = c.emiteFatura === true;
  const nifBruto = texto(c.nif);
  let nif: string | null = null;
  if (nifBruto) {
    if (!nifValido(nifBruto)) {
      erros.push({ campo: "nif", mensagem: "NIF inválido." });
    } else {
      nif = nifBruto.replace(/\s/g, "");
    }
  } else if (emiteFatura) {
    erros.push({ campo: "nif", mensagem: "Para emitir fatura é preciso o NIF." });
  }

  // Só se pergunta a quem emite fatura: para quem não emite, a pergunta não
  // tem sentido nem consequência.
  let regimeIva: RegimeDeIva = "isento";
  if (emiteFatura) {
    if (!regimeDeIvaValido(c.regimeIva)) {
      erros.push({
        campo: "regimeIva",
        mensagem: "Indique se está isento de IVA ou no regime normal.",
      });
    } else {
      regimeIva = c.regimeIva;
    }
  }

  // Quem declara emitir guia tem de dizer qual é o registo. Sem número não há
  // nada para verificar, e sem verificação a declaração não vale — não vamos
  // ligar um cliente a quem talvez não possa transportar resíduos.
  const emiteGuiaTransporte = c.emiteGuiaTransporte === true;
  const numeroBruto = texto(c.numeroTransportador);
  let numeroTransportador: string | null = null;
  if (emiteGuiaTransporte) {
    if (numeroBruto.length < 4) {
      erros.push({
        campo: "numeroTransportador",
        mensagem: "Indique o número de registo de transportador de resíduos.",
      });
    } else {
      numeroTransportador = numeroBruto;
    }
  }

  if (erros.length > 0) return { ok: false, erros };

  return {
    ok: true,
    dados: {
      nome,
      email,
      telefone,
      nif,
      cidade,
      categorias,
      // A cidade de base conta sempre como zona coberta: é o mínimo, e sem
      // isto quem não escrevesse zonas nenhumas não recebia nada.
      zonas: Array.from(new Set([cidade, ...listaDeTextos(c.zonas)])),
      raioKm,
      emiteFatura,
      regimeIva,
      emiteGuiaTransporte,
      numeroTransportador,
    },
  };
}
