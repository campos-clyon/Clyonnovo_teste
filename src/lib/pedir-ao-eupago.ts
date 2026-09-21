import {
  corpoDoMbway,
  corpoDoMultibanco,
  lerRespostaDoMbway,
  lerRespostaDoMultibanco,
  recusaDoEupago,
  type ConfiguracaoDoEupago,
  type DadosDoPagamento,
  type MetodoDePagamento,
  type RespostaDoEupago,
} from "./eupago";

/**
 * A ida à rede. É a única coisa que este ficheiro faz.
 *
 * O que se pede e como se lê a resposta está em `eupago.ts`, que é puro e tem
 * testes a sério. Aqui só há `fetch`, relógio e o que fazer quando a rede não
 * responde — precisamente as três coisas que não se conseguem testar bem.
 */

/**
 * Quanto tempo se espera pelo euPago.
 *
 * Quinze segundos é muito para uma API e pouco para um cliente parado à frente
 * de um ecrã. O número existe porque a alternativa — esperar o que o Node
 * quiser — deixa um pedido de pagamento pendurado até a função da Vercel
 * morrer, e aí não se escreve sequer o que correu mal.
 */
export const SEGUNDOS_DE_ESPERA = 15;

async function chamar(
  url: string,
  corpo: unknown,
  cabecalhos: Record<string, string>,
): Promise<{ estadoHttp: number; json: unknown } | { erro: string }> {
  const parar = new AbortController();
  const relogio = setTimeout(() => parar.abort(), SEGUNDOS_DE_ESPERA * 1000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...cabecalhos },
      body: JSON.stringify(corpo),
      signal: parar.signal,
      cache: "no-store",
    });
    const texto = await r.text();
    /*
     * O CORPO LÊ-SE COMO TEXTO E SÓ DEPOIS SE TENTA O JSON.
     *
     * Um `r.json()` directo rebenta quando o euPago devolve uma página de erro
     * em HTML — e devolve, quando está em manutenção ou quando um proxy pelo
     * meio se intromete. A excepção que daí vinha não dizia nada; assim,
     * o que veio fica no erro e aparece no registo.
     */
    try {
      return { estadoHttp: r.status, json: texto ? JSON.parse(texto) : {} };
    } catch {
      return { erro: `O euPago respondeu ${r.status} com algo que não é JSON: ${texto.slice(0, 200)}` };
    }
  } catch (e) {
    const abortou = (e as { name?: string })?.name === "AbortError";
    return {
      erro: abortou
        ? `O euPago não respondeu em ${SEGUNDOS_DE_ESPERA} segundos.`
        : `Não foi possível falar com o euPago: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Pede o pagamento — e as duas APIs são tão diferentes que nem o sítio da
 * chave é o mesmo. Ver o cabeçalho de `eupago.ts`.
 */
/**
 * Para onde é que a chamada foi — o que a recusa `-10` precisa de dizer.
 *
 * "Chave de API inválida – a EUPAGO_API_KEY não serve para este ambiente."
 * — o ecrã disse isto a 21-09-2026, a meio de uma cobrança, e a pergunta
 * seguinte era «qual ambiente?». O diagnóstico já o dizia; quem está a tentar
 * cobrar um cliente não vai ao diagnóstico.
 */
function ondeFoi(config: ConfiguracaoDoEupago): { nome: string; base: string } {
  return { nome: config.ambiente, base: config.base };
}

export async function pedirPagamento(
  config: ConfiguracaoDoEupago,
  metodo: MetodoDePagamento,
  dados: DadosDoPagamento,
): Promise<RespostaDoEupago> {
  if (metodo === "mbway") {
    const corpo = corpoDoMbway(dados);
    if (!corpo) {
      return {
        ok: false,
        recusa: {
          codigo: null,
          paraNos: "Telemovel invalido para MB WAY.",
          paraOCliente: "Indique um telemóvel português com MB WAY (9 dígitos).",
          sugereOutroMetodo: true,
        },
      };
    }
    const r = await chamar(`${config.base}/api/v1.02/mbway/create`, corpo, {
      Authorization: `ApiKey ${config.chave}`,
    });
    if ("erro" in r) return { ok: false, recusa: recusaDoEupago(null, r.erro) };
    return lerRespostaDoMbway(r.estadoHttp, r.json, ondeFoi(config));
  }

  /*
   * A API antiga leva a chave DENTRO do corpo. O cabeçalho vai na mesma —
   * a página deles diz as duas coisas em sítios diferentes (a secção chama-se
   * «BODY AUTH» e o aviso lá dentro fala do cabeçalho), e mandar os dois custa
   * nada e cobre as duas leituras.
   */
  const r = await chamar(
    `${config.base}/clientes/rest_api/multibanco/create`,
    corpoDoMultibanco(dados, config.chave),
    { Authorization: `ApiKey ${config.chave}` },
  );
  if ("erro" in r) return { ok: false, recusa: recusaDoEupago(null, r.erro) };
  return lerRespostaDoMultibanco(r.estadoHttp, r.json, ondeFoi(config));
}

export type EstadoNoEupago =
  | { ok: true; pago: boolean; valor: number | null; bruto: unknown }
  | { ok: false; porque: string };

/**
 * PERGUNTAR AO euPAGO O QUE ACONTECEU A UMA REFERÊNCIA — a sondagem de recurso.
 *
 * O webhook é a fonte da verdade e não é de confiar (ponto 2.3 do plano). Eles
 * insistem 24 horas; se o nosso servidor estiver em baixo mais do que isso,
 * desistem — e fica um cliente que pagou com um ecrã a dizer que não pagou.
 * Esta é a pergunta que se faz nesse caso, e é preciso fazê-la: não há aviso
 * nenhum a dizer que um aviso não chegou.
 *
 * Só serve para Multibanco: `multibanco/info` pergunta por referência, e uma
 * operação MB WAY não tem referência que se consulte assim.
 */
export async function estadoDaReferencia(
  config: ConfiguracaoDoEupago,
  referencia: string,
  entidade: string | null,
): Promise<EstadoNoEupago> {
  const r = await chamar(
    `${config.base}/clientes/rest_api/multibanco/info`,
    { chave: config.chave, referencia, ...(entidade ? { entidade } : {}) },
    { Authorization: `ApiKey ${config.chave}` },
  );
  if ("erro" in r) return { ok: false, porque: r.erro };

  const c = (r.json ?? {}) as Record<string, unknown>;
  const estado = c.estado == null ? null : String(c.estado);
  if (estado !== "0") {
    return { ok: false, porque: recusaDoEupago(estado, String(c.resposta ?? "")).paraNos };
  }

  /*
   * O QUE «PAGO» QUER DIZER AQUI, e é a parte frágil desta função.
   *
   * A documentação de `multibanco/info` tem mais de dois anos e não diz o nome
   * do campo que traz o estado do pagamento. Aceitam-se os três nomes
   * plausíveis, e na dúvida diz-se que NÃO ESTÁ PAGO — que é o lado seguro:
   * um pagamento por confirmar fica pendente e alguém olha para ele; um
   * pagamento dado por pago à toa manda um profissional trabalhar de graça.
   *
   * Confirmar contra a sandbox antes de isto ser a única defesa de alguém.
   */
  const dito = String(c.estado_pagamento ?? c.pago ?? c.status ?? "").toLowerCase();
  const pago = dito === "pago" || dito === "paid" || dito === "1" || dito === "true";
  const valor = Number(String(c.valor_pago ?? c.valor ?? "").replace(",", "."));

  return { ok: true, pago, valor: Number.isFinite(valor) ? valor : null, bruto: r.json };
}
