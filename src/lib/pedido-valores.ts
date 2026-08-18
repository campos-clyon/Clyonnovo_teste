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
