import { contaDoCliente, type RegimeIva, type Taxas } from "./taxas-plataforma";

/**
 * O euPago — como se lhe pede dinheiro, e como se lê o que ele responde.
 *
 * Fase 2 do `docs/plano-pagamentos-eupago.md`. Este ficheiro é PURO: não faz
 * uma única chamada de rede, não sabe o que é uma base de dados, e é por isso
 * que se pode interrogar com cem respostas diferentes sem nada estar ligado.
 *
 * ⚠️ MB WAY E MULTIBANCO SÃO DUAS APIs DIFERENTES, E ISSO NÃO É UM DETALHE.
 *
 * Confirmado na documentação a 17-09-2026, e é a primeira coisa que parte uma
 * integração feita à pressa:
 *
 *   MB WAY      POST /api/v1.02/mbway/create
 *               autenticação NO CABEÇALHO: `Authorization: ApiKey …`
 *               corpo em inglês e ANINHADO: { payment: { amount: { value } } }
 *               responde 201 com { transactionStatus, transactionID, reference }
 *
 *   Multibanco  POST /clientes/rest_api/multibanco/create
 *               a chave vai NO CORPO, no campo `chave`
 *               corpo em português e PLANO: { chave, valor, id, per_dup }
 *               responde 200 — SEMPRE 200, mesmo a falhar — com
 *               { sucesso, estado, referencia, entidade }
 *
 * A última linha é a que morde: **o Multibanco devolve HTTP 200 quando
 * recusa.** Quem olhar para o código de estado da resposta vai jurar que
 * correu bem, gravar uma referência vazia, e mostrar ao cliente uma referência
 * que o banco dele não conhece. O estado verdadeiro está no campo `estado` do
 * corpo, e é ele que se lê — ver `lerRespostaDoMultibanco`.
 */

export type MetodoDePagamento = "mbway" | "multibanco";

export const METODOS: MetodoDePagamento[] = ["mbway", "multibanco"];

/** Como se lhe chama num ecrã. */
export const NOME_DO_METODO: Record<MetodoDePagamento, string> = {
  mbway: "MB WAY",
  multibanco: "Multibanco",
};

export type Ambiente = "sandbox" | "producao";

/**
 * As duas casas do euPago.
 *
 * *«replace the word 'sandbox' with 'clientes'»* — a documentação deles. É
 * literalmente o mesmo caminho noutro domínio, o que quer dizer que uma chave
 * de sandbox apontada a produção falha por autenticação e não por 404. Boa
 * notícia: engana-se com barulho, não em silêncio.
 */
export const BASE_DO_EUPAGO: Record<Ambiente, string> = {
  sandbox: "https://sandbox.eupago.pt",
  producao: "https://clientes.eupago.pt",
};

/** Documentado nas duas páginas: «Maximum amount: 99 999€». */
export const MAXIMO_POR_PAGAMENTO = 99_999;

/** Só o Multibanco tem mínimo documentado: «Minimum Amount: 1€». */
export const MINIMO_MULTIBANCO = 1;

/**
 * O MB WAY tem cinco minutos, e não é uma escolha nossa.
 *
 * *«The customer have 5 minutes to execute the payment after receiving the
 * payment notification via MBWAY app.»* É por isto que o ecrã do MB WAY tem de
 * ter uma contagem e o do Multibanco não: cinco minutos é tempo a menos para
 * alguém ir buscar o telemóvel a outra divisão sem saber que está a correr.
 */
export const MINUTOS_DO_MBWAY = 5;

/**
 * Quantos dias a referência Multibanco fica de pé.
 *
 * Sem prazo, uma referência vive para sempre — e um cliente que a pague três
 * meses depois paga um trabalho que já foi feito e fechado por fora. Com
 * prazo, o pior que acontece é ter de se pedir outra, que é um clique.
 *
 * Três dias porque é o que cobre um fim-de-semana inteiro. Mudar isto muda só
 * referências NOVAS: as que já foram emitidas levam a data lá dentro.
 */
export const DIAS_DE_PRAZO_DA_REFERENCIA = 3;

/** O que a documentação manda pôr em `countryCode`: «+351 for portuguese number». */
export const INDICATIVO_DE_PORTUGAL = "+351";

export type ConfiguracaoDoEupago = {
  chave: string;
  ambiente: Ambiente;
  /** Já com o domínio certo para o ambiente. */
  base: string;
  /** O segredo do HMAC dos webhooks. Gerado por nós no backoffice do euPago. */
  segredoDoWebhook: string | null;
};

/**
 * A configuração, ou a razão pela qual não há nenhuma.
 *
 * Devolve o PORQUÊ e não `null` porque a diferença entre «falta a chave» e «a
 * chave está lá mas o ambiente está escrito à mão errado» é a diferença entre
 * cinco segundos e uma tarde. Ninguém lê isto num ecrã de cliente: vai para o
 * registo e para o painel da CLYON.
 */
export function configuracaoDoEupago(
  env: Record<string, string | undefined>,
): { ok: true; config: ConfiguracaoDoEupago } | { ok: false; falta: string } {
  const chave = env.EUPAGO_API_KEY?.trim();
  if (!chave) return { ok: false, falta: "Falta a variável EUPAGO_API_KEY." };

  const bruto = env.EUPAGO_AMBIENTE?.trim().toLowerCase();
  if (bruto && bruto !== "sandbox" && bruto !== "producao") {
    return {
      ok: false,
      falta: `EUPAGO_AMBIENTE diz "${bruto}" — só pode dizer "sandbox" ou "producao".`,
    };
  }
  /*
   * SEM AMBIENTE ESCRITO, SANDBOX — e nunca ao contrário.
   *
   * O valor por omissão de uma variável que mexe em dinheiro tem de ser o que
   * não cobra a ninguém. Se um dia alguém esquecer a variável num deploy, o
   * pior que acontece é as chamadas irem para a sandbox e falharem por chave
   * errada. Ao contrário, o esquecimento cobrava a sério.
   */
  const ambiente: Ambiente = bruto === "producao" ? "producao" : "sandbox";

  return {
    ok: true,
    config: {
      chave,
      ambiente,
      base: BASE_DO_EUPAGO[ambiente],
      segredoDoWebhook: env.EUPAGO_WEBHOOK_SEGREDO?.trim() || null,
    },
  };
}

/**
 * A PORTA. Em produção, ninguém é cobrado antes de a plataforma o assumir.
 *
 * `A_PLATAFORMA_COBRA` é o interruptor do produto inteiro: enquanto for falso,
 * todos os ecrãs dizem ao cliente que paga ao profissional no fim. Cobrá-lo
 * nesse estado seria ficar-lhe com o dinheiro depois de lhe termos escrito que
 * não ficávamos.
 *
 * Na sandbox não há dinheiro nenhum, e por isso a porta está sempre aberta —
 * é o que permite provar a integração toda antes de o interruptor mexer.
 */
export function podeCobrar(
  config: ConfiguracaoDoEupago,
  aPlataformaCobra: boolean,
): { pode: true } | { pode: false; porque: string } {
  if (config.ambiente === "sandbox") return { pode: true };
  if (!aPlataformaCobra) {
    return {
      pode: false,
      porque:
        "Em produção e com A_PLATAFORMA_COBRA a falso: os ecrãs dizem ao cliente " +
        "que paga ao profissional no fim, e cobrá-lo agora seria contrariá-los.",
    };
  }
  return { pode: true };
}

/**
 * O QUE CORREU MAL — em duas versões, porque são duas audiências.
 *
 * O cliente não pode ver «Invalid API Key»: não é problema dele, não há nada
 * que possa fazer com essa frase, e diz a um estranho que a nossa configuração
 * está partida. Vê uma frase que o deixa seguir em frente.
 *
 * Nós vemos o que se passa mesmo, no registo e no painel.
 */
export type Recusa = {
  /** O código do euPago, quando há. Serve para procurar no registo. */
  codigo: string | null;
  /** O que fica escrito para nós. */
  paraNos: string;
  /** O que o cliente lê. */
  paraOCliente: string;
  /** Vale a pena oferecer-lhe o outro meio de pagamento? */
  sugereOutroMetodo: boolean;
};

/**
 * Os códigos documentados em «API Response Codes», traduzidos.
 *
 * `-12` merece nota: é «Alias is not valid», e em MB WAY quer dizer que aquele
 * telemóvel NÃO TEM MB WAY. É o erro mais provável de todos — e o único desta
 * lista em que a culpa não é nossa nem do banco, mas de um número mal escrito.
 */
const CODIGOS: Record<string, { nos: string; cliente: string; sugereOutro: boolean }> = {
  "-7": {
    nos: "Servico inactivo - a conta do euPago nao tem este meio de pagamento ligado.",
    cliente: "Este meio de pagamento está indisponível de momento.",
    sugereOutro: true,
  },
  "-8": {
    nos: "Referencia invalida.",
    cliente: "Não foi possível gerar a referência. Tente outra vez.",
    sugereOutro: true,
  },
  "-9": {
    nos: "Valores recusados pelo euPago.",
    cliente: "Não foi possível processar este valor.",
    sugereOutro: true,
  },
  "-10": {
    nos: "Chave de API invalida - a EUPAGO_API_KEY nao serve para este ambiente.",
    cliente: "Não foi possível iniciar o pagamento. Já estamos a ver o que se passa.",
    sugereOutro: false,
  },
  "-11": {
    nos: "Pagamento nao encontrado.",
    cliente: "Não encontrámos este pagamento.",
    sugereOutro: false,
  },
  "-12": {
    nos: "Alias invalido - o numero indicado nao tem MB WAY associado.",
    cliente:
      "Esse número não tem MB WAY associado. Confirme o número, ou pague por referência Multibanco.",
    sugereOutro: true,
  },
};

export function recusaDoEupago(
  codigo: string | number | null | undefined,
  texto: string | null | undefined,
): Recusa {
  const c = codigo == null ? null : String(codigo).trim();
  const conhecido = c ? CODIGOS[c] : undefined;
  if (conhecido) {
    return {
      codigo: c,
      paraNos: texto ? `${conhecido.nos} (${texto})` : conhecido.nos,
      paraOCliente: conhecido.cliente,
      sugereOutroMetodo: conhecido.sugereOutro,
    };
  }
  /*
   * UM CÓDIGO QUE NÃO CONHECEMOS NÃO É UM SUCESSO.
   *
   * É a única regra que não pode ter excepção aqui: perante o desconhecido,
   * recusa-se. Um caminho que deixasse passar transformava uma resposta nova
   * do euPago — que eles podem acrescentar sem nos avisar — numa referência
   * inventada mostrada a um cliente.
   */
  return {
    codigo: c,
    paraNos: `Resposta nao reconhecida do euPago${c ? ` (codigo ${c})` : ""}${
      texto ? `: ${texto}` : ""
    }.`,
    paraOCliente: "Não foi possível iniciar o pagamento. Tente outra vez dentro de momentos.",
    sugereOutroMetodo: true,
  };
}

/**
 * O telemóvel, como o MB WAY o quer.
 *
 * Aceita o que as pessoas escrevem mesmo — «+351 912 345 678», «351912345678»,
 * «912-345-678» — e devolve os dois campos separados que a API pede. Devolve
 * `null` quando não é um telemóvel português, e é de propósito: pedir um
 * pagamento a um número que não existe gasta cinco minutos do cliente à espera
 * de uma notificação que nunca chega.
 *
 * Nove dígitos a começar em 9 — é o que é um telemóvel em Portugal.
 */
export function telemovelParaMbway(
  raw: string | null | undefined,
): { countryCode: string; customerPhone: string } | null {
  if (!raw) return null;
  let so = raw.replace(/[^0-9]/g, "");
  // «00351…» e «351…» são a mesma coisa que «…», e chegam das três maneiras.
  if (so.startsWith("00351")) so = so.slice(5);
  else if (so.startsWith("351")) so = so.slice(3);
  if (!/^9[0-9]{8}$/.test(so)) return null;
  return { countryCode: INDICATIVO_DE_PORTUGAL, customerPhone: so };
}

function aosCentimos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Este valor pode ser cobrado por este meio? — `null` quando sim.
 *
 * Verificar aqui, e não deixar o euPago recusar, tem uma razão prática: a
 * recusa deles é um código genérico («Wrong values») e a nossa diz ao cliente
 * o que fazer. E poupa uma ida à rede num caso que já sabíamos.
 */
export function porqueNaoPodeCobrar(metodo: MetodoDePagamento, valor: number): string | null {
  if (!Number.isFinite(valor) || valor <= 0) return "O valor a pagar não é um número válido.";
  if (aosCentimos(valor) !== valor) return "O valor a pagar tem de estar em cêntimos certos.";
  if (valor > MAXIMO_POR_PAGAMENTO) {
    return `O máximo por pagamento é de ${MAXIMO_POR_PAGAMENTO} €.`;
  }
  if (metodo === "multibanco" && valor < MINIMO_MULTIBANCO) {
    return `Uma referência Multibanco tem de ser de pelo menos ${MINIMO_MULTIBANCO} €.`;
  }
  return null;
}

/**
 * O NOSSO IDENTIFICADOR, e porque é que ele é o fio que liga tudo.
 *
 * Vai no pedido e volta em TODOS os webhooks daquela transacção. É por ele que
 * se sabe a que pagamento pertence um aviso — e é a única ligação que existe
 * para o Multibanco, cuja API antiga nem sequer devolve um `trid` na criação.
 *
 * Leva prefixo porque o mesmo backoffice do euPago serve a App CLYON: sem ele,
 * um identificador «312» podia ser de qualquer um dos dois produtos.
 */
export const PREFIXO_DO_IDENTIFICADOR = "clyon-site-";

export function identificadorDoPagamento(id: number): string {
  return `${PREFIXO_DO_IDENTIFICADOR}${id}`;
}

/** O caminho de volta. `null` para tudo o que não seja nosso. */
export function idDoIdentificador(identifier: string | null | undefined): number | null {
  if (!identifier?.startsWith(PREFIXO_DO_IDENTIFICADOR)) return null;
  const n = Number(identifier.slice(PREFIXO_DO_IDENTIFICADOR.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** A data como o Multibanco a quer: YYYY-MM-DD, sem hora. */
export function dataParaOEupago(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * O identificador de uma chamada que não é de ninguém — só para ver se a
 * chave serve.
 *
 * NÃO é parseável por `idDoIdentificador`, e é de propósito: se alguém pagar
 * por engano uma referência de teste, o aviso chega e é arrumado como
 * «identificador alheio» em vez de creditar um pagamento que não existe.
 */
export const IDENTIFICADOR_DE_TESTE = "clyon-site-teste";

export type DadosDoPagamento = {
  /** O id da nossa linha em `pagamentos`. Vira o `identifier`. */
  pagamentoId: number;
  /**
   * Um identificador à mão, em vez do que sai do `pagamentoId`.
   *
   * Existe só para a prova de ligação do backoffice — ver
   * `IDENTIFICADOR_DE_TESTE`. Em tudo o resto fica por preencher, porque o
   * identificador TEM de ser o fio que liga o aviso ao pagamento.
   */
  identificador?: string;
  /** O que o cliente paga, já com taxa e IVA. Ver `quantoOClientePaga`. */
  valor: number;
  /** Só MB WAY. */
  telemovel?: string | null;
  /** Quando a referência Multibanco deixa de valer. */
  prazo?: Date | null;
};

/**
 * O corpo do pedido de MB WAY — aninhado, em inglês, com a chave no cabeçalho.
 *
 * Note-se o que NÃO vai aqui: nenhum URL de retorno. O webhook não se indica
 * por transacção, configura-se uma vez no backoffice (Gestão → Canais →
 * Editar → Webhooks 2.0). Procurar um campo de callback nesta API é perder uma
 * tarde — ele existe no Split Payments e só lá.
 *
 * E também não vai o `customer`: pô-lo faz o euPago notificar o cliente por
 * conta própria, e mandar mensagens aos nossos clientes em nome de outra
 * empresa é uma decisão de produto, não uma opção técnica.
 */
export function corpoDoMbway(d: DadosDoPagamento): {
  payment: {
    identifier: string;
    amount: { value: number; currency: "EUR" };
    customerPhone: string;
    countryCode: string;
  };
} | null {
  const tel = telemovelParaMbway(d.telemovel);
  if (!tel) return null;
  return {
    payment: {
      identifier: d.identificador ?? identificadorDoPagamento(d.pagamentoId),
      amount: { value: aosCentimos(d.valor), currency: "EUR" },
      customerPhone: tel.customerPhone,
      countryCode: tel.countryCode,
    },
  };
}

/**
 * O corpo da referência Multibanco — plano, em português, com a chave dentro.
 *
 * `per_dup: 0` NÃO É UM DETALHE DE CONFIGURAÇÃO. É «esta referência aceita um
 * pagamento só». A um, o cliente que a pague duas vezes por engano paga duas
 * vezes o mesmo trabalho, e o dinheiro entra na nossa conta sem ter a quem
 * pertencer. Fica a zero e o banco dele recusa a segunda.
 */
export function corpoDoMultibanco(
  d: DadosDoPagamento,
  chave: string,
): {
  chave: string;
  valor: number;
  id: string;
  per_dup: 0;
  data_fim?: string;
} {
  const corpo = {
    chave,
    valor: aosCentimos(d.valor),
    id: d.identificador ?? identificadorDoPagamento(d.pagamentoId),
    per_dup: 0 as const,
  };
  return d.prazo ? { ...corpo, data_fim: dataParaOEupago(d.prazo) } : corpo;
}

export type RespostaDoEupago =
  | {
      ok: true;
      referencia: string;
      /** Só o Multibanco tem entidade. */
      entidade: string | null;
      /** O `trid`, quando a resposta já o traz. O Multibanco só o dá no webhook. */
      trid: string | null;
    }
  | { ok: false; recusa: Recusa };

function texto(v: unknown): string | null {
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/**
 * A resposta do MB WAY.
 *
 * Aqui o código HTTP conta — 201 é criado, 401 é chave errada. Mas não basta:
 * exige-se também a `reference`, porque um 201 sem referência não é um
 * pagamento, é uma resposta que não percebemos.
 */
export function lerRespostaDoMbway(estadoHttp: number, json: unknown): RespostaDoEupago {
  const c = (json ?? {}) as Record<string, unknown>;
  if (estadoHttp === 201 || estadoHttp === 200) {
    const referencia = texto(c.reference);
    if (referencia) {
      return { ok: true, referencia, entidade: null, trid: texto(c.transactionID) };
    }
    return {
      ok: false,
      recusa: recusaDoEupago(
        texto(c.code),
        texto(c.text) ?? `O euPago respondeu ${estadoHttp} sem referencia.`,
      ),
    };
  }
  return {
    ok: false,
    recusa: recusaDoEupago(texto(c.code), texto(c.text) ?? `HTTP ${estadoHttp}`),
  };
}

/**
 * A resposta do Multibanco — e é aqui que se paga o preço da API antiga.
 *
 * ⚠️ ELA RESPONDE HTTP 200 QUANDO RECUSA. O estado verdadeiro está no campo
 * `estado` do corpo: `0` é sucesso e os negativos são a tabela de códigos.
 * Quem confiar no código HTTP grava uma referência vazia e mostra-a ao
 * cliente.
 *
 * E exige-se `referencia` E `entidade`: no Multibanco, uma sem a outra não se
 * pode pagar. Metade de uma referência não é meia referência — é nenhuma.
 */
export function lerRespostaDoMultibanco(estadoHttp: number, json: unknown): RespostaDoEupago {
  const c = (json ?? {}) as Record<string, unknown>;
  const estado = texto(c.estado);

  if (estado == null) {
    return {
      ok: false,
      recusa: recusaDoEupago(
        null,
        estadoHttp >= 400 ? `HTTP ${estadoHttp}` : "O euPago respondeu sem campo estado.",
      ),
    };
  }
  if (estado !== "0") {
    return { ok: false, recusa: recusaDoEupago(estado, texto(c.resposta)) };
  }

  const referencia = texto(c.referencia);
  const entidade = texto(c.entidade);
  if (!referencia || !entidade) {
    return {
      ok: false,
      recusa: recusaDoEupago(null, "O euPago devolveu sucesso sem referencia ou sem entidade."),
    };
  }
  return { ok: true, referencia, entidade, trid: texto(c.trid) };
}

/**
 * O QUE SE PEDE AO BANCO DELE — e há um só sítio a decidi-lo.
 *
 * ⚠️ HÁ DOIS NÚMEROS, E NÃO É UMA DÚVIDA MINHA: É O QUE O PRODUTO DIZ.
 *
 * Desde 17-09-2026 — *«vamos apresentar os valores sempre sem IVA, caso o
 * cliente deseje factura são mais 23 %»* — o ecrã do cliente mostra DOIS
 * valores sobre o mesmo trabalho:
 *
 *     100 € acordados        →   105,00 €   «a pagar»          (`semIva`)
 *                                106,15 €   «se quiser factura» (`total`)
 *
 * Só há uma regra que não se pode quebrar aqui: **pede-se ao banco o número
 * que ele leu.** Um cliente que viu 105 e recebe no telemóvel um pedido de
 * 106,15 recusa-o — e tem razão em recusá-lo. É a forma mais rápida de perder
 * alguém no último passo.
 *
 * Por isso a factura é uma ESCOLHA do cliente, feita no ecrã de pagamento,
 * antes de o valor sair daqui — e fica gravada na linha do pagamento, porque é
 * ela que decide o documento que se emite a seguir.
 *
 * (O IVA da taxa é devido à mesma, haja factura ou não. Isso é uma questão
 * fiscal da CLYON e não uma questão de software: ver a nota em
 * `taxas-plataforma.ts`, que já a levanta.)
 */
export function quantoOClientePaga(
  acordado: number,
  regime: RegimeIva,
  taxas?: Taxas,
  comFactura = false,
): number {
  const c = contaDoCliente(acordado, regime, taxas);
  return comFactura ? c.total : c.semIva;
}
