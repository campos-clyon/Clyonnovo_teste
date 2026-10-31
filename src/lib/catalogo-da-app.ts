import { SERVICOS_PUBLICOS, nomeDoServico } from "./service-categories";
import { HORAS_POR_TIPOLOGIA, TIPOLOGIA_POR_EXTENSO, type Tipologia } from "./tabela-das-mudancas";
import { FRASE_UNICA, SUBTITULO_INICIAL } from "./frase-unica";
import { TELEFONE_DA_CLYON } from "./telefone-da-clyon";
import { NOTA_DOS_PRECOS, precoDeReferencia } from "./preco-de-referencia";
import { PASSOS_DE_COMO_FUNCIONA } from "./como-funciona";
import { PERGUNTAS_FREQUENTES } from "./perguntas-frequentes";
import { REGIONS, getRegionCities } from "./seo-data";
import { AVALIACOES_NO_GOOGLE, NOTAS_EM_FRASE } from "./avaliacoes-publicas";
import { reviews } from "./reviews-data";
import { DESMONTAGEM_A_PEDIDO, PEDIDO_URGENTE, PROMESSA_DO_PRAZO } from "./promessas-publicas";
import { QUEM_FACTURA_EM_PALAVRAS } from "./identificacao-legal";
import { AUTORIZA_FOTOS, QUEM_FAZ_O_TRABALHO, TRES_PASSOS_DEPOIS_DE_ENVIAR } from "./textos-do-pedido";
import { perguntasDoEspacoParaAApp } from "./perguntas-do-espaco";

/**
 * O CATÁLOGO DA APP DE CLIENTE — R7 (d8 fase 2, S4, 28-10-2026).
 *
 * O que a app precisa para pedir um orçamento, tirado das mesmas fontes do
 * simulador: os serviços que o simulador oferece (com os nomes de
 * `NOMES_DOS_SERVICOS`), o estado do entulho sem big bags, as tipologias da
 * tabela das mudanças, o «quando» sem «hoje», os textos e o WhatsApp.
 *
 * v2 — 29-10-2026 (S12, a app abre sem conta): os preços de referência JÁ
 * ESCRITOS, sempre com o IVA ao lado (`preco-de-referencia.ts`, os mesmos do
 * simulador do site), como funciona, as zonas, as avaliações do Google, as
 * perguntas frequentes e os textos do pedido — todos das mesmas constantes que
 * as páginas do site leem. A app continua sem números, taxas nem IVA no código.
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
  esvaziamento_garagem: "esvaziamento",
  esvaziamento_sotao: "esvaziamento",
  esvaziamento_cave: "esvaziamento",
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
      // O que inclui (a mesma linha da inicial do site) e o preço de referência, com o IVA ao lado.
      inclui: c.description,
      precoReferencia: precoDeReferencia(c.id),
      // Garagem, sótão e cave (d5, 31-10-2026): as perguntas do simulador do site, já escritas.
      ...(perguntasDoEspacoParaAApp(c.id) ? { espaco: perguntasDoEspacoParaAApp(c.id) } : {}),
    })),
    precos: {
      linhas: SERVICOS_PUBLICOS.flatMap((c) => {
        const texto = precoDeReferencia(c.id);
        return texto ? [{ servico: c.id, nome: nomeDoServico(c.id), texto }] : [];
      }),
      nota: NOTA_DOS_PRECOS,
    },
    comoFunciona: PASSOS_DE_COMO_FUNCIONA.map((p) => ({ titulo: p.titulo, texto: p.texto })),
    zonas: REGIONS.map((r) => ({ nome: r.name, localidades: getRegionCities(r.slug).map((c) => c.name) })),
    // Só as do Google, com o mês da contagem (regra j da orquestra).
    avaliacoes: {
      resumo: NOTAS_EM_FRASE,
      url: AVALIACOES_NO_GOOGLE.url,
      testemunhos: reviews.map((r) => ({ nome: r.name.trim().split(/\s+/)[0], mes: r.date, texto: r.text })),
    },
    perguntas: PERGUNTAS_FREQUENTES.flatMap((c) => c.questions.map((q) => ({ p: q.q, r: q.a }))),
    // Sem big bags nem contentores: a recolha é em sacos ou a granel, à mão.
    entulho: [
      { id: "ensacado", nome: "Já está em sacos" },
      { id: "chao", nome: "Está no chão" },
      { id: "misto", nome: "Uma parte em sacos e outra no chão" },
      { id: "unknown", nome: "Não sei" },
    ],
    entulhoNota: "Se estiver no chão, o parceiro carrega-o no local.",
    tipologias: (Object.keys(HORAS_POR_TIPOLOGIA) as Tipologia[]).map((t) => ({
      id: t,
      nome: TIPOLOGIA_POR_EXTENSO[t],
    })),
    /*
     * QUANDO — com «Hoje», como no simulador (d8, 31-10-2026): vai como pedido
     * urgente (`today`) e não promete o dia (`PEDIDO_URGENTE`). A app escreve-os
     * e manda o `urgency` do simulador (today, tomorrow, this_week, flexible);
     * numa data à escolha vai `dataPreferida` («AAAA-MM-DD», de amanhã em
     * diante, em Lisboa). Nunca «no próprio dia».
     */
    quando: ["hoje", "amanha", "esta_semana", "data", "flexivel"],
    textos: {
      fraseUnica: FRASE_UNICA,
      subtituloInicial: SUBTITULO_INICIAL,
      valorDesejadoEtiqueta: ETIQUETA_DO_VALOR_DESEJADO,
      valorDesejadoAjuda: AJUDA_DO_VALOR_DESEJADO,
      semFotos: SEM_FOTOGRAFIAS,
      autorizaFotos: AUTORIZA_FOTOS,
      desmontagem: DESMONTAGEM_A_PEDIDO,
      rodape: `${QUEM_FAZ_O_TRABALHO} ${QUEM_FACTURA_EM_PALAVRAS}`,
      tresPassos: TRES_PASSOS_DEPOIS_DE_ENVIAR,
      notaDosPrecos: NOTA_DOS_PRECOS,
      promessaDoPrazo: PROMESSA_DO_PRAZO,
      pedidoUrgente: PEDIDO_URGENTE,
    },
    ficheiros: { maximo: 20, tipos: ["image/jpeg", "image/png", "image/webp", "image/heic"] },
    whatsapp: TELEFONE_DA_CLYON,
  };
}

export type CatalogoDaApp = ReturnType<typeof catalogoDaApp>;
