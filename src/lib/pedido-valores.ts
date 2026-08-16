/**
 * O mínimo e o máximo que o cliente está disposto a pagar.
 *
 * São dois números com destinos opostos, e é essa a razão deste ficheiro
 * existir em vez de a validação viver solta na rota:
 *
 *   · o **mínimo** é público para o profissional, apresentado como «o que o
 *     cliente quer pagar»;
 *   · o **máximo** nunca sai daqui. Se o profissional o visse, nenhum proporia
 *     abaixo dele — o máximo deixava de ser um tecto e passava a ser o preço,
 *     e a negociação era teatro. Serve-nos para aceitar automaticamente uma
 *     proposta que caia dentro dele e para decidir a quem vale a pena mostrar
 *     o pedido.
 *
 * Não confundir com `estimateMin` / `estimateMax`, que são o intervalo que o
 * motor de preços calcula. Esses são uma opinião nossa sobre quanto custa;
 * estes são uma decisão do cliente sobre quanto quer gastar. Por isso os
 * campos aqui chamam-se `valorMinimoCliente` e `valorMaximoCliente` — o sufixo
 * existe para que ninguém volte a trocá-los numa consulta.
 */

/** Tecto de sanidade. Acima disto é engano de digitação, não um pedido. */
export const VALOR_MAXIMO_ACEITE = 100_000;

/** Abaixo disto não paga o combustível de lá ir. */
export const VALOR_MINIMO_ACEITE = 5;

export type ValoresDoCliente = {
  valorMinimoCliente: number;
  valorMaximoCliente: number;
};

export type ErroDeValor = {
  campo: "valorMinimoCliente" | "valorMaximoCliente";
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
 * Valida o par que o cliente indicou. Aceita string com vírgula decimal porque
 * é o que um teclado português produz — rejeitar "80,50" seria rejeitar a
 * forma normal de escrever.
 */
export function validarValoresDoCliente(
  minimoBruto: unknown,
  maximoBruto: unknown,
): ResultadoDeValidacao {
  const erros: ErroDeValor[] = [];

  const minimo = comoNumero(minimoBruto);
  const maximo = comoNumero(maximoBruto);

  if (minimo === null) {
    erros.push({ campo: "valorMinimoCliente", mensagem: "Indique quanto quer pagar." });
  } else if (minimo < VALOR_MINIMO_ACEITE) {
    erros.push({
      campo: "valorMinimoCliente",
      mensagem: `O mínimo é ${VALOR_MINIMO_ACEITE} €.`,
    });
  } else if (minimo > VALOR_MAXIMO_ACEITE) {
    erros.push({
      campo: "valorMinimoCliente",
      mensagem: `O valor não pode passar de ${VALOR_MAXIMO_ACEITE} €.`,
    });
  }

  if (maximo === null) {
    erros.push({ campo: "valorMaximoCliente", mensagem: "Indique o máximo que aceita pagar." });
  } else if (maximo > VALOR_MAXIMO_ACEITE) {
    erros.push({
      campo: "valorMaximoCliente",
      mensagem: `O valor não pode passar de ${VALOR_MAXIMO_ACEITE} €.`,
    });
  }

  // Só faz sentido comparar se os dois passaram nas regras individuais —
  // senão dizíamos "o máximo é menor que o mínimo" a quem deixou um em branco.
  if (minimo !== null && maximo !== null && erros.length === 0 && maximo < minimo) {
    erros.push({
      campo: "valorMaximoCliente",
      mensagem: "O máximo não pode ser menor do que o mínimo.",
    });
  }

  if (erros.length > 0) return { ok: false, erros };

  return {
    ok: true,
    valores: {
      valorMinimoCliente: aosCentimos(minimo as number),
      valorMaximoCliente: aosCentimos(maximo as number),
    },
  };
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
  "valorMinimoCliente",
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
 * consiga ler. Esconder o máximo no ecrã não conta: quem abre as ferramentas
 * do browser vê a resposta inteira.
 */
export function vistaDoProfissional(pedido: Record<string, unknown>): VistaDoProfissional {
  const vista: VistaDoProfissional = {};
  for (const campo of CAMPOS_VISIVEIS_AO_PROFISSIONAL) {
    if (pedido[campo] !== undefined) vista[campo] = pedido[campo];
  }
  return vista;
}
