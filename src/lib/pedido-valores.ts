/**
 * Quanto o cliente quer pagar.
 *
 * **Um número só.** Foram dois — um mínimo público e um máximo privado — e o
 * máximo saiu por decisão de 18-08-2026.
 *
 * O que se perdeu: o máximo servia para aceitar automaticamente uma proposta
 * que caísse dentro dele e para decidir a quem valia a pena mostrar o pedido.
 * Nenhuma das duas chegou a ser construída, portanto a perda é teórica; o que
 * se ganhou é concreto — uma pergunta em vez de duas, e nenhuma explicação
 * sobre por que razão pedimos um tecto que não mostramos a ninguém.
 *
 * Não confundir com `estimateMin` / `estimateMax`, que são o intervalo que o
 * motor de preços calcula. Esses são uma opinião nossa sobre quanto custa;
 * este é uma decisão do cliente sobre quanto quer gastar. Daí o sufixo no nome
 * do campo — para que ninguém os volte a trocar numa consulta.
 */

/** Tecto de sanidade. Acima disto é engano de digitação, não um pedido. */
export const VALOR_MAXIMO_ACEITE = 100_000;

/** Abaixo disto não paga o combustível de lá ir. */
export const VALOR_MINIMO_ACEITE = 5;

export type ValoresDoCliente = {
  valorDesejadoCliente: number;
};

export type ErroDeValor = {
  campo: "valorDesejadoCliente";
  mensagem: string;
};

export type ResultadoDeValidacao =
  | { ok: true; valores: ValoresDoCliente }
  | { ok: false; erros: ErroDeValor[] };

function comoNumero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string") {
    const limpo = valor.trim().replace(/\s/g, "").replace(",", ".");
    if (limpo === "") return null;
    const n = Number(limpo);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Arredonda aos cêntimos sem deixar -0 nem lixo de vírgula flutuante. */
function aosCentimos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Valida o valor que o cliente indicou.
 *
 * Aceita string com vírgula decimal porque é o que um teclado português
 * produz — rejeitar "80,50" seria rejeitar a forma normal de escrever.
 */
export function validarValorDesejado(valorBruto: unknown): ResultadoDeValidacao {
  const valor = comoNumero(valorBruto);

  if (valor === null) {
    return {
      ok: false,
      erros: [{ campo: "valorDesejadoCliente", mensagem: "Indique quanto quer pagar." }],
    };
  }
  if (valor < VALOR_MINIMO_ACEITE) {
    return {
      ok: false,
      erros: [
        { campo: "valorDesejadoCliente", mensagem: `O mínimo é ${VALOR_MINIMO_ACEITE} €.` },
      ],
    };
  }
  if (valor > VALOR_MAXIMO_ACEITE) {
    return {
      ok: false,
      erros: [
        {
          campo: "valorDesejadoCliente",
          mensagem: `O valor não pode passar de ${VALOR_MAXIMO_ACEITE} €.`,
        },
      ],
    };
  }

  return { ok: true, valores: { valorDesejadoCliente: aosCentimos(valor) } };
}

/**
 * Campos de um pedido que um profissional pode ver antes de o trabalho estar
 * fechado.
 *
 * É uma lista de permissões e não de exclusões, de propósito. Uma lista de
 * exclusões protege contra os campos que hoje conhecemos: bastava alguém
 * acrescentar uma coluna nova à tabela para ela passar a sair sem ninguém
 * reparar. Assim, o que é novo fica de fora até ser decidido que pode sair.
 *
 * A morada exacta não está aqui. Antes de o trabalho estar fechado, o
 * profissional vê a zona — no sistema antigo encontrámos exactamente esta
 * fuga, com moradas de casa a chegarem a quem ainda não tinha aceitado nada.
 */
export const CAMPOS_VISIVEIS_AO_PROFISSIONAL = [
  "id",
  "serviceType",
  "description",
  "filesJson",
  "city",
  "postalCode",
  "floor",
  "hasElevator",
  "parkingDistance",
  "urgency",
  "scheduledDate",
  "distanceKm",
  "estimateMin",
  "estimateMax",
  "estimateTotal",
  "valorDesejadoCliente",
  "precisaFatura",
  "precisaGuiaTransporte",
  "status",
  "createdAt",
  /*
   * O que é próprio do serviço, e sem o qual ele propõe às cegas.
   *
   * A LOCALIDADE do destino entra aqui; a MORADA exacta não — está na lista de
   * depois de contratado, ao lado da morada de origem, pela mesma razão. Uma
   * mudança tem duas casas e não uma, e se a segunda saísse antes do acordo,
   * bastava inscrever-se para colher moradas às pares.
   */
  "localidadeDestino",
  "andarDestino",
  "elevadorDestino",
  "estacionamentoDestino",
  "percursoKm",
  "entulhoEstado",
  "entulhoQuantidade",
] as const;

export type CampoVisivelAoProfissional = (typeof CAMPOS_VISIVEIS_AO_PROFISSIONAL)[number];

export type VistaDoProfissional = Partial<Record<CampoVisivelAoProfissional, unknown>>;

/**
 * Reduz um pedido àquilo que o profissional pode ver.
 *
 * Chamar isto é obrigatório em qualquer resposta de API que um profissional
 * consiga ler. Esconder um campo no ecrã não conta: quem abre as ferramentas
 * do browser vê a resposta inteira.
 */
export function vistaDoProfissional(pedido: Record<string, unknown>): VistaDoProfissional {
  const vista: VistaDoProfissional = {};
  for (const campo of CAMPOS_VISIVEIS_AO_PROFISSIONAL) {
    if (pedido[campo] !== undefined) vista[campo] = pedido[campo];
  }
  return vista;
}

/**
 * O que se abre DEPOIS de o cliente o contratar.
 *
 * A morada e o telefone entram aqui e em mais lado nenhum. Não é um detalhe de
 * cortesia: é a diferença entre um pedido e uma lista de contactos. Enquanto a
 * negociação está aberta, qualquer profissional da zona vê o pedido — se a
 * morada saísse aí, bastava inscrever-se para colher moradas de casa com
 * telefone ao lado.
 *
 * Depois de contratado é outra coisa: há um acordo, um valor retido, e ele tem
 * de lá chegar.
 */
export const CAMPOS_VISIVEIS_DEPOIS_DE_CONTRATADO = [
  ...CAMPOS_VISIVEIS_AO_PROFISSIONAL,
  "address",
  "moradaDestino",
  "contactName",
  "contactPhone",
] as const;

export type CampoDepoisDeContratado = (typeof CAMPOS_VISIVEIS_DEPOIS_DE_CONTRATADO)[number];

export type VistaDeContratado = Partial<Record<CampoDepoisDeContratado, unknown>>;

export function vistaDoProfissionalContratado(
  pedido: Record<string, unknown>,
): VistaDeContratado {
  const vista: VistaDeContratado = {};
  for (const campo of CAMPOS_VISIVEIS_DEPOIS_DE_CONTRATADO) {
    if (pedido[campo] !== undefined) vista[campo] = pedido[campo];
  }
  return vista;
}

/**
 * A vista certa para o estado em que a negociação está.
 *
 * Uma função só, para que a decisão "já pode ver a morada?" não seja tomada em
 * cada rota à sua maneira — que é como um dia uma delas se engana.
 */
export function vistaParaOEstado(
  pedido: Record<string, unknown>,
  estadoDaNegociacao: string,
): VistaDeContratado {
  return estadoDaNegociacao === "acordada"
    ? vistaDoProfissionalContratado(pedido)
    : vistaDoProfissional(pedido);
}
