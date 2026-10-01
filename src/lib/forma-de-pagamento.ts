import type { Taxas } from "./taxas-plataforma";
import type { ModeloDoPreco } from "./iva-incluido";

/**
 * COMO É QUE O CLIENTE PAGA — a escolha dele, gravada e congelada.
 *
 * "Temos aceitar pagamento pós recolha com um acréscimo de 5 euros, caso o
 *  cliente opte por ele. E também a opção de pagamento em dinheiro no local."
 *  — 21-09-2026.
 *
 * Três formas, e nenhuma delas é «a de sempre» por acaso:
 *
 *   · NA_PLATAFORMA — o que existe desde 17-09-2026: referência MB WAY ou
 *     Multibanco, gerada pelo backoffice. Coluna nula lê-se como isto, porque
 *     é o que todos os pedidos anteriores a esta escolha existir já eram.
 *
 *   · DINHEIRO — o cliente entrega o valor do serviço ao profissional, em mão,
 *     no local. NÃO É UM MODELO NOVO: com `A_PLATAFORMA_COBRA` a falso é o que
 *     já acontece, e a página de serviços já o promete. O que muda é deixar de
 *     ser acidente e passar a ser uma escolha registada — com uma consequência
 *     que só a escolha permite: a CLYON cobra a sua parte ao cliente por
 *     referência, em vez de não cobrar nada.
 *
 *   · POS_RECOLHA — paga depois de o trabalho estar feito, com 5 € de
 *     acréscimo. ESCRITO E DESLIGADO (`PAGAR_DEPOIS_LIGADO`), por decisão do
 *     dono no mesmo dia, e por uma conta simples: num trabalho de 120 € os 5 €
 *     cobrem uma falha em 26; a 400 €, uma em 85. Sem caução nem cartão
 *     guardado, quem financia o cliente é o profissional. Liga-se quando houver
 *     uma garantia — e 30 dias depois de mudar os Termos, que hoje prometem
 *     pagamento após o serviço de graça (cláusula 16).
 *
 * ── AS DUAS DECISÕES DE DINHEIRO, escritas onde se aplicam ─────────────────
 *
 * ⚠️ O PARÁGRAFO SEGUINTE SÓ VALE ANTES DO IVA INCLUÍDO (01-10-2026). Desde
 * `IVA_INCLUIDO_DESDE`, em dinheiro o cliente paga ao profissional o preço
 * inteiro com IVA, e é o PROFISSIONAL que deve à CLYON o IVA e a comissão —
 * ver `taxasParaAForma` e `divida-do-profissional.ts`.
 *
 * NO DINHEIRO, A CLYON LEVA OS 11 % AO CLIENTE. «Sim, os 11 % cobrados ao
 * cliente» — 21-09-2026. O profissional recebe o valor acordado inteiro em
 * mão, e não lhe é facturada comissão nenhuma; a CLYON factura ao cliente a
 * taxa de 5 % mais os 6 % que noutra forma descontaria ao profissional. Isto
 * exprime-se com as peças que já existem — `taxasParaAForma` grava na
 * negociação `cliente: 0.11, profissional: 0` — e tudo o resto (a conta, a
 * carteira, as facturas) segue as taxas gravadas sem saber que houve dinheiro.
 *
 * O QUE ISTO CUSTA, dito às claras: o profissional fica com 7,20 € a mais num
 * trabalho de 120 € do que ficaria pelo electrónico, e o cliente paga 7,20 € a
 * mais. Um puxa para o dinheiro, o outro puxa para o electrónico. Quem escolhe
 * é o cliente, antes de existir profissional nenhum — e é esse o travão.
 *
 * OS 5 € DO PÓS-RECOLHA SÃO DA CLYON, E FICAM COM ELA. «Da CLYON, e fica com
 * eles» — 21-09-2026. Entram na base da CLYON, com o IVA da CLYON por cima;
 * nunca no valor acordado, onde o profissional receberia 4,70 € de 5 € sem
 * ninguém ter decidido isso.
 */

export type FormaDePagamento = "na_plataforma" | "dinheiro" | "pos_recolha";

export const FORMAS: FormaDePagamento[] = ["na_plataforma", "dinheiro", "pos_recolha"];

/** Coluna nula = «anterior a isto existir» = a forma de sempre. */
export const FORMA_POR_OMISSAO: FormaDePagamento = "na_plataforma";

/**
 * O pós-recolha existe, testa-se, e não se oferece a ninguém.
 *
 * Enquanto for falso, `lerForma` devolve `na_plataforma` a quem pedir
 * `pos_recolha` — pela porta pública, pela do backoffice, e pela base. Assim
 * não há como uma negociação nascer com uma forma que os Termos ainda não
 * prometem. Ligar isto é UMA linha; mudar os Termos é o passo antes dela.
 */
export const PAGAR_DEPOIS_LIGADO = false;

/** Em euros, sem IVA. É da CLYON e leva o IVA da CLYON por cima. */
export const ACRESCIMO_POS_RECOLHA = 5;

/**
 * O TECTO LEGAL AO NUMERÁRIO.
 *
 * Em Portugal é proibido pagar em dinheiro a partir de 3 000 € (Lei 92/2017,
 * para residentes). Fica UMA constante, e fica com margem para o contabilista
 * a baixar: um tecto que existe em três sítios com três números é o mesmo que
 * nenhum. Verifica-se no valor ACORDADO ao contratar e outra vez quando o
 * valor é corrigido — pede-se 800, escolhe-se dinheiro, o profissional coteia
 * 1 400: um tecto verificado só no pedido é um tecto que não se verifica.
 *
 * ⚠️ Confirmar com o contabilista antes de o primeiro trabalho grande sair.
 */
export const MAXIMO_EM_NUMERARIO = 3000;

export function formaValida(v: unknown): v is FormaDePagamento {
  return typeof v === "string" && (FORMAS as string[]).includes(v);
}

/**
 * Lê o que vier — da base, de um corpo de pedido, de um ecrã — e devolve
 * sempre uma forma que se possa usar.
 *
 * `null`, vazio, lixo → a de sempre. `pos_recolha` com o interruptor em baixo
 * → a de sempre também: uma forma que não está à venda não pode entrar por
 * nenhuma porta, nem que alguém a escreva à mão no JSON.
 */
export function lerForma(v: unknown): FormaDePagamento {
  if (!formaValida(v)) return FORMA_POR_OMISSAO;
  if (v === "pos_recolha" && !PAGAR_DEPOIS_LIGADO) return FORMA_POR_OMISSAO;
  return v;
}

/** As que se mostram ao cliente para escolher. */
export function formasDisponiveis(): FormaDePagamento[] {
  return FORMAS.filter((f) => f !== "pos_recolha" || PAGAR_DEPOIS_LIGADO);
}

/**
 * AS TAXAS QUE A NEGOCIAÇÃO GRAVA, dada a forma.
 *
 * Em dinheiro, a comissão do profissional passa inteira para a taxa do
 * cliente: ele recebe o acordado em mão, e é ao cliente que a CLYON cobra os
 * dois lados. `profissional: 0` é uma taxa legítima para `taxasDaNegociacao`
 * (zero não é «em falta» — está testado), e é o que faz `quantoOProfissionalRecebe`
 * devolver o valor inteiro sem que a carteira precise de saber porquê.
 *
 * Recebe as de base como parâmetro, e não as lê das constantes: as taxas
 * mudam no backoffice, e o que se grava tem de partir das de HOJE.
 *
 * ⚠️ COM IVA INCLUÍDO, O DINHEIRO GRAVA AS TAXAS DE SEMPRE — 01-10-2026.
 *
 * "O cliente paga ao profissional, no local, o preço COM IVA (ex. 452,03 €); o
 *  profissional fica a DEVER à CLYON o IVA + a comissão (ex. 84,53 + 40,43)."
 *  — decisão do dono, 01-10-2026.
 *
 * O cliente em dinheiro paga o MESMO preço que pela plataforma, e a comissão
 * volta a sair dos dois lados como em qualquer outra forma: a CLYON recebe-a
 * do profissional, junto com o IVA, por referência (ver
 * `divida-do-profissional.ts`). Os «11 % ao cliente, 0 % ao profissional» só
 * valem para as negociações abertas antes do corte (`IVA_INCLUIDO_DESDE`), e é
 * por isso que o modelo é obrigatório aqui.
 */
export function taxasParaAForma(
  forma: FormaDePagamento,
  base: Taxas,
  modelo: ModeloDoPreco,
): Taxas {
  if (forma === "dinheiro" && modelo === "sem_iva") {
    return {
      cliente: Math.round((base.cliente + base.profissional) * 10000) / 10000,
      profissional: 0,
    };
  }
  return base;
}

/** O acréscimo em euros que esta forma põe na conta do cliente. Zero para quase tudo. */
export function acrescimoDaForma(forma: FormaDePagamento): number {
  return forma === "pos_recolha" ? ACRESCIMO_POS_RECOLHA : 0;
}

/**
 * Este valor pode ser pago em notas?
 *
 * ⚠️ O QUE SE MEDE É O QUE PASSA DE MÃO EM MÃO — 01-10-2026. Antes do IVA
 * incluído, o cliente dava em notas o valor acordado e pagava a taxa à parte;
 * desde o corte dá ao profissional o preço inteiro, com IVA. Quem chama passa
 * o valor em numerário (`valorEmNumerario` em `divida-do-profissional.ts`), e
 * não o acordado: 2 500 € acordados são 3 228,75 € em notas, e passam o tecto.
 */
export function excedeONumerario(valorEmNumerario: number | null | undefined): boolean {
  return typeof valorEmNumerario === "number" && valorEmNumerario >= MAXIMO_EM_NUMERARIO;
}

/**
 * COMO SE DIZ, a cada um dos lados.
 *
 * O profissional lê isto ANTES de propor — aceita um trabalho de 120 € em
 * notas de outra maneira do que um já pago. O cliente lê-o ao escolher e outra
 * vez ao fechar.
 */
export const FORMA_EM_PALAVRAS: Record<
  FormaDePagamento,
  { curta: string; cliente: string; profissional: string }
> = {
  na_plataforma: {
    curta: "Pagamento pela plataforma",
    cliente:
      "Recebe uma referência MB WAY ou Multibanco depois de fechar. O valor fica combinado por escrito.",
    profissional: "O cliente paga pela plataforma. Recebe o líquido, já com a taxa CLYON descontada.",
  },
  /*
   * EM DINHEIRO, DESDE O IVA INCLUÍDO — 01-10-2026.
   *
   * "O cliente paga ao profissional, no local, o preço COM IVA; o profissional
   *  fica a DEVER à CLYON o IVA + a comissão, e paga essa dívida por
   *  referência MB WAY/Multibanco, gerada quando o trabalho em dinheiro é
   *  confirmado." — decisão do dono.
   *
   * O cliente deixa de ter duas entregas: paga um número só, a uma pessoa só.
   * As frases de antes (taxa à parte, por referência, paga pelo cliente)
   * continuam a valer para as negociações abertas antes do corte — ver
   * `FORMA_EM_PALAVRAS_ANTES_DO_IVA_INCLUIDO` e `formaEmPalavras`.
   */
  dinheiro: {
    curta: "Dinheiro no local",
    cliente:
      "Paga o preço combinado, já com IVA, ao profissional, em dinheiro, no fim do trabalho. Não há mais nada a pagar à parte.",
    profissional:
      "O cliente paga-lhe em dinheiro, no local, o preço com IVA. Depois de o trabalho ser confirmado, entrega à CLYON o IVA e a comissão, por referência MB WAY ou Multibanco — o que fica consigo é o seu líquido.",
  },
  pos_recolha: {
    curta: `Pagar depois da recolha (+${ACRESCIMO_POS_RECOLHA} €)`,
    cliente: `Paga depois de o trabalho estar feito, com um acréscimo de ${ACRESCIMO_POS_RECOLHA} € da CLYON.`,
    profissional:
      "O cliente escolheu pagar depois da recolha. Só recebe quando ele pagar — pense nisso antes de aceitar.",
  },
};

/**
 * AS FRASES DO DINHEIRO ANTES DO IVA INCLUÍDO — para as negociações abertas
 * antes de `IVA_INCLUIDO_DESDE`, e só para essas. 01-10-2026.
 *
 * Nelas o cliente continua a dar em notas o valor do serviço e a pagar a taxa
 * à CLYON por referência — é o que lhe foi dito quando a negociação abriu, e
 * ninguém pode ver as regras mudarem a meio.
 */
export const FORMA_EM_PALAVRAS_ANTES_DO_IVA_INCLUIDO: typeof FORMA_EM_PALAVRAS = {
  ...FORMA_EM_PALAVRAS,
  dinheiro: {
    curta: "Dinheiro no local",
    cliente:
      "Paga o valor do serviço ao profissional, em dinheiro, no fim do trabalho. A taxa da CLYON paga-se à parte, por referência.",
    profissional:
      "O cliente paga-lhe em dinheiro, no local, o valor acordado por inteiro. A CLYON não lhe desconta nada — cobra a taxa dela ao cliente.",
  },
};

/** As frases da forma, no modelo da negociação. */
export function formaEmPalavras(forma: FormaDePagamento, modelo: ModeloDoPreco) {
  return (modelo === "iva_incluido" ? FORMA_EM_PALAVRAS : FORMA_EM_PALAVRAS_ANTES_DO_IVA_INCLUIDO)[forma];
}
