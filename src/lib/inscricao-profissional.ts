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

/**
 * Os ids dos veículos aceites.
 *
 * A lista com os rótulos está em `convite-profissional.ts`. Aqui só os ids,
 * porque esse ficheiro importa deste — importá-lo de volta fechava um ciclo.
 */
export const TIPOS_DE_VEICULO_VALIDOS: string[] = [
  "carrinha_pequena",
  "carrinha_media",
  "carrinha_grande",
  "camiao",
  "camiao_grua",
  "varios",
  "sem_veiculo",
];
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
  /** Morada fiscal — a da declaração, que pode não ser onde ele trabalha. */
  moradaFiscal: string | null;
  codigoPostalFiscal: string | null;
  localidadeFiscal: string | null;
  tipoVeiculo: string | null;
  categorias: string[];
  zonas: string[];
  raioKm: number;
  emiteFatura: boolean;
  regimeIva: RegimeDeIva;
  emiteGuiaTransporte: boolean;
  numeroTransportador: string | null;
  /**
   * A caixa «Li e aceito os Termos e a Política de Privacidade».
   *
   * Está no tipo, e não só na validação, porque é o que obriga quem gravar a
   * inscrição a decidir o que faz com ela. Enquanto viveu só no browser, era
   * um obstáculo visual — o servidor nunca soube que tinha sido marcada.
   */
  aceitaTermos: boolean;
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

/**
 * Código postal português: quatro dígitos, traço, três dígitos.
 *
 * Aceita-se sem traço porque é assim que muita gente o escreve — normaliza-se
 * na saída. Recusar "2950123" era recusar um código postal certo por causa de
 * um traço.
 */
export function codigoPostalValido(cp: string): boolean {
  return /^\d{4}-?\d{3}$/.test(cp.replace(/\s/g, ""));
}

export function normalizarCodigoPostal(cp: string): string {
  const limpo = cp.replace(/[\s-]/g, "");
  return limpo.length === 7 ? `${limpo.slice(0, 4)}-${limpo.slice(4)}` : cp.trim();
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Telemóvel ou fixo português, com ou sem indicativo e com ou sem espaços. */
export function telefoneValido(telefone: string): boolean {
  const limpo = telefone.replace(/[\s.-]/g, "").replace(/^\+351/, "").replace(/^00351/, "");
  return /^[239]\d{8}$/.test(limpo);
}

/**
 * Isto parece uma morada em vez de um nome?
 *
 * PORQUE E QUE ESTA VERIFICACAO EXISTE
 *
 * O primeiro profissional a inscrever-se ficou com "Rua Capitão Salgueiro
 * Maia 23" no campo do nome. A causa foi o browser: o formulário tem morada,
 * código postal e localidade, e sem `autoComplete` no campo do nome o Chrome
 * classificou-o como parte da morada e ofereceu a rua guardada.
 *
 * Esse buraco foi tapado no formulário, que é onde se resolve de verdade. Isto
 * é a rede por baixo — porque o nome é o que o CLIENTE vê ao escolher quem lhe
 * entra em casa, e "Rua Capitão Salgueiro Maia 23" não diz a ninguém com quem
 * está a falar.
 *
 * DOIS SINAIS, E SÓ DOIS
 *
 * Reconhece-se pouco de propósito. Há empresas a sério chamadas "Quinta do
 * Anjo Transportes" ou "Largo Mudanças", e recusar uma inscrição legítima é
 * pior do que deixar passar um nome estranho — quem escreve o nome da empresa
 * ao contrário corrige-se com um telefonema; quem é recusado vai-se embora.
 *
 * Por isso exigem-se os dois sinais juntos: começar por um tipo de via E ter
 * um número de porta. Ou conter um código postal, que num nome de empresa não
 * tem explicação nenhuma.
 */
/*
 * Duas alternativas, e não uma, por causa do ponto das abreviaturas.
 *
 * A primeira tentativa juntava tudo num grupo só, com `\b` no fim:
 * `/^(rua|av\.|...)\b/i`. As palavras inteiras funcionavam e as abreviaturas
 * NÃO — "Av. da República 45" passava despercebida.
 *
 * A razão é que `\b` exige uma transição entre carácter de palavra e não-
 * palavra. Depois de "Av." vem um espaço, e tanto o ponto como o espaço são
 * não-palavra: não há transição nenhuma, e a fronteira nunca casa.
 *
 * Por isso as palavras inteiras levam `\b` e as abreviaturas levam o próprio
 * ponto, que já é o terminador delas.
 */
const TIPOS_DE_VIA =
  /^(?:(rua|avenida|travessa|largo|praceta|estrada|beco|alameda|praça|praca|rotunda|caminho|calçada|calcada|azinhaga|impasse|urbanização|urbanizacao|lote)\b|(r|av|tv|lg|estr|pct)\.)/i;

const CODIGO_POSTAL = /\b\d{4}-\d{3}\b/;

export function pareceMorada(nome: string): boolean {
  const limpo = nome.trim();
  if (CODIGO_POSTAL.test(limpo)) return true;
  // Tipo de via no início E um número de porta algures. Um só não chega.
  return TIPOS_DE_VIA.test(limpo) && /\b\d{1,4}\b/.test(limpo);
}

export function validarInscricao(corpo: unknown): ResultadoDeInscricao {
  const erros: ErroDeInscricao[] = [];
  const c = (corpo ?? {}) as Record<string, unknown>;

  const nome = texto(c.nome);
  if (nome.length < 3) {
    erros.push({ campo: "nome", mensagem: "Indique o nome ou a designação da empresa." });
  } else if (pareceMorada(nome)) {
    erros.push({
      campo: "nome",
      mensagem:
        "Isto parece uma morada. Aqui vai o seu nome ou o da empresa — é o que o cliente vê. A morada tem campo próprio mais abaixo.",
    });
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

  // A morada fiscal é a da declaração de actividade, e pode não ser onde ele
  // trabalha — daí ser um campo próprio e não a cidade de base. É obrigatória
  // para quem emite fatura: uma fatura sem morada do emitente não é uma fatura.
  const moradaBruta = texto(c.moradaFiscal);
  const cpBruto = texto(c.codigoPostalFiscal);
  const localidadeBruta = texto(c.localidadeFiscal);

  let moradaFiscal: string | null = null;
  let codigoPostalFiscal: string | null = null;
  let localidadeFiscal: string | null = null;

  const declarouAlgumaCoisa = Boolean(moradaBruta || cpBruto || localidadeBruta);

  if (emiteFatura || declarouAlgumaCoisa) {
    if (moradaBruta.length < 5) {
      erros.push({ campo: "moradaFiscal", mensagem: "Indique a morada fiscal (rua e número)." });
    } else {
      moradaFiscal = moradaBruta;
    }
    if (!codigoPostalValido(cpBruto)) {
      erros.push({ campo: "codigoPostalFiscal", mensagem: "Código postal inválido (0000-000)." });
    } else {
      codigoPostalFiscal = normalizarCodigoPostal(cpBruto);
    }
    if (localidadeBruta.length < 2) {
      erros.push({ campo: "localidadeFiscal", mensagem: "Indique a localidade." });
    } else {
      localidadeFiscal = localidadeBruta;
    }
  }

  // O veículo não é ficha técnica: um sofá de três lugares não entra numa
  // carrinha pequena, e mandar-lhe esse pedido é fazer-lhe perder a viagem.
  const veiculoBruto = texto(c.tipoVeiculo);
  let tipoVeiculo: string | null = null;
  if (veiculoBruto) {
    if (!TIPOS_DE_VEICULO_VALIDOS.includes(veiculoBruto)) {
      erros.push({ campo: "tipoVeiculo", mensagem: "Escolha o tipo de veículo." });
    } else {
      tipoVeiculo = veiculoBruto;
    }
  } else {
    erros.push({ campo: "tipoVeiculo", mensagem: "Indique com que veículo trabalha." });
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

  /*
   * OS TERMOS, VERIFICADOS NO SERVIDOR.
   *
   * O formulário já desactivava o botão sem esta caixa, mas isso é uma barreira
   * de ecrã: quem chamar a rota directamente nunca passou por ela. E desde que
   * a candidatura abriu ao público, esta aceitação é a única prova de contrato
   * que existe — antes, o convite provava que se tinha falado com a pessoa.
   */
  if (c.aceitaTermos !== true) {
    erros.push({
      campo: "aceitaTermos",
      mensagem: "Tem de aceitar os Termos e a Política de Privacidade para se candidatar.",
    });
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
      moradaFiscal,
      codigoPostalFiscal,
      localidadeFiscal,
      tipoVeiculo,
      categorias,
      // A cidade de base conta sempre como zona coberta: é o mínimo, e sem
      // isto quem não escrevesse zonas nenhumas não recebia nada.
      zonas: Array.from(new Set([cidade, ...listaDeTextos(c.zonas)])),
      raioKm,
      emiteFatura,
      regimeIva,
      emiteGuiaTransporte,
      numeroTransportador,
      aceitaTermos: true,
    },
  };
}
