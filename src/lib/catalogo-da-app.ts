import { SERVICOS_PUBLICOS, nomeDoServico } from "./service-categories";
import { HORAS_POR_TIPOLOGIA, TIPOLOGIA_POR_EXTENSO, type Tipologia } from "./tabela-das-mudancas";
import { FRASE_UNICA, SUBTITULO_INICIAL } from "./frase-unica";
import { TELEFONE_DA_CLYON } from "./telefone-da-clyon";

/**
 * O CATÁLOGO DA APP DE CLIENTE — R7 (d8 fase 2, S4, 28-10-2026).
 *
 * O que a app precisa para pedir um orçamento, tirado das mesmas fontes do
 * simulador: os serviços que o simulador oferece (com os nomes de
 * `NOMES_DOS_SERVICOS`), o estado do entulho sem big bags, as tipologias da
 * tabela das mudanças, o «quando» sem «hoje», os textos e o WhatsApp. NENHUM
 * PREÇO: a app não tem tabelas nem taxas — os valores chegam das propostas.
 *
 * Puro: sem base, para se poder testar carácter a carácter.
 */

/** Que detalhes pede cada serviço (o mesmo desenho do simulador). */
const DETALHES: Readonly<Record<string, string>> = {
  recolha_moveis: "moveis",
  recolha_monos: "monos",
  recolha_entulho: "entulho",
  esvaziamento_casa: "esvaziamento",
  esvaziamento_apartamento: "esvaziamento",
  mudanca: "mudanca",
  manutencao_casa: "manutencao",
  outro: "outro",
};

/** O «Não entra no cálculo» do simulador, dito da mesma maneira na app. */
export const ETIQUETA_DO_VALOR_DESEJADO = "Quanto conta gastar, com IVA?";
export const AJUDA_DO_VALOR_DESEJADO =
  "Não entra no cálculo. O valor do orçamento é calculado a partir do que nos disse e não muda por causa do que escrever aqui.";
export const SEM_FOTOGRAFIAS = "Sem fotografias, o preço pode mudar no local. Quer continuar sem elas?";

export function catalogoDaApp() {
  return {
    ok: true as const,
    servicos: SERVICOS_PUBLICOS.map((c) => ({
      id: c.id,
      nome: nomeDoServico(c.id),
      detalhes: DETALHES[c.id] ?? "outro",
    })),
    // Sem big bags nem contentores: a recolha é em sacos ou a granel, à mão.
    entulho: [
      { id: "ensacado", nome: "Já está em sacos" },
      { id: "chao", nome: "Está no chão" },
      { id: "misto", nome: "Uma parte em sacos e outra no chão" },
      { id: "unknown", nome: "Não sei" },
    ],
    entulhoNota: "Se estiver no chão, o profissional carrega-o no local.",
    tipologias: (Object.keys(HORAS_POR_TIPOLOGIA) as Tipologia[]).map((t) => ({
      id: t,
      nome: TIPOLOGIA_POR_EXTENSO[t],
    })),
    /*
     * QUANDO — sem «hoje» (nem «no próprio dia»). A app escreve-os e manda o
     * `urgency` do simulador (tomorrow, this_week, flexible); numa data à
     * escolha vai `dataPreferida` («AAAA-MM-DD», de amanhã em diante, em Lisboa).
     */
    quando: ["amanha", "esta_semana", "data", "flexivel"],
    textos: {
      fraseUnica: FRASE_UNICA,
      subtituloInicial: SUBTITULO_INICIAL,
      valorDesejadoEtiqueta: ETIQUETA_DO_VALOR_DESEJADO,
      valorDesejadoAjuda: AJUDA_DO_VALOR_DESEJADO,
      semFotos: SEM_FOTOGRAFIAS,
    },
    ficheiros: { maximo: 20, tipos: ["image/jpeg", "image/png", "image/webp", "image/heic"] },
    whatsapp: TELEFONE_DA_CLYON,
  };
}

export type CatalogoDaApp = ReturnType<typeof catalogoDaApp>;
