/**
 * A quem se mostra cada pedido.
 *
 * «Que lhe serve» tem de ser uma regra e não um envio a todos. Ao terceiro
 * email irrelevante o profissional cancela a subscrição — e deixa de ver os
 * que interessavam. Um profissional que se despede por ruído não volta, e a
 * plataforma perde-o para sempre por causa de emails que nem devia ter
 * mandado.
 *
 * As razões de exclusão são devolvidas em vez de um simples `false` porque
 * são úteis dos dois lados: ao profissional, para lhe explicar porque não vê
 * um pedido; a nós, para percebermos que um pedido não chegou a ninguém e
 * porquê — um pedido sem destinatários morre em silêncio, e é preciso saber
 * se foi por não haver ninguém perto ou por ninguém emitir fatura.
 */

export type MotivoDeExclusao =
  | "inactivo"
  | "nao_aprovado"
  | "categoria_diferente"
  | "fora_de_alcance"
  | "sem_morada"
  | "nao_emite_fatura"
  | "nao_emite_guia";

/**
 * O QUE JÁ NÃO ESCONDE O PEDIDO, E PASSOU A AVISAR ANTES DE PROPOR.
 *
 * "Muitos pedidos não estão a aparecer para todos por causa da fatura e da
 * guia. Que tal usarmos apenas o raio de acção e as categorias como
 * referência para o pedido aparecer, e, caso ele não emita fatura e o pedido
 * tenha essa opção, antes de enviar aparece a mensagem em amarelo." —
 * 14-09-2026.
 *
 * A regra antiga era um filtro cego: quem não tinha a caixa da fatura marcada
 * nunca via um pedido que a pedisse, e nem ficava a saber que ele existiu.
 * Custava dos dois lados — o profissional perdia trabalho que podia fazer (a
 * maioria emite fatura e nunca marcou a caixa) e o cliente ficava com menos
 * propostas, às vezes com nenhuma.
 *
 * Agora QUEM ESCOLHE É QUEM PROPÕE, com o aviso à frente dos olhos. Só o raio
 * e as categorias escondem um pedido — as duas coisas que são mesmo sobre se
 * o trabalho lhe serve.
 */
import type { FormaDePagamento } from "./forma-de-pagamento";

export type AvisoAntesDeCotar =
  | "cliente_quer_fatura"
  | "trabalho_exige_guia"
  /** O cliente escolheu pagar em dinheiro, no local — ele recebe o acordado inteiro, em mão. */
  | "cliente_paga_em_dinheiro";

export type PedidoParaDistribuir = {
  serviceType: string | null;
  precisaFatura: boolean;
  precisaGuiaTransporte: boolean;
  /** Como o cliente paga. Em falta, na plataforma. Ver `forma-de-pagamento.ts`. */
  formaDePagamento?: FormaDePagamento;
  /** Distância em km entre a base do profissional e o local do trabalho. */
  distanciaKm: number | null;
  /** Usado quando não há distância medida. */
  city: string | null;
};

export type ProfissionalParaAvaliar = {
  id: number;
  isActive: boolean;
  /** Só profissionais aprovados recebem pedidos. */
  estado: string | null;
  /** Categorias que faz. Vazio significa nenhuma, nunca "todas". */
  categorias: string[];
  /** Até onde se desloca, em km. */
  raioKm: number | null;
  /** Zonas que cobre, em minúsculas, para quando não há distância medida. */
  zonas: string[];
  emiteFatura: boolean;
  emiteGuiaTransporte: boolean;
  /**
   * Quando alguém confirmou o número de transportador.
   *
   * Existe separado de `emiteGuiaTransporte` porque a declaração sozinha não
   * vale nada — e é pior do que não existir, porque o cliente confia nela.
   * Transportar resíduos exige transportador registado, e uma plataforma que
   * ligue um cliente a quem não o é cria um problema aos dois.
   */
  guiaVerificadaEm: Date | string | null;
};

/**
 * Deixou de ser união de propósito.
 *
 * Um pedido pode ser elegível E trazer um aviso — é justamente o caso novo:
 * cabe no raio, é da categoria dele, e o cliente pediu fatura que ele não
 * marcou. Com `{elegivel:true}` sozinho não havia onde pôr esse aviso, e ele
 * teria de ser recalculado noutro sítio a partir dos mesmos dados. `motivos`
 * vem sempre, vazio quando é elegível.
 */
export type ResultadoDeElegibilidade = {
  elegivel: boolean;
  motivos: MotivoDeExclusao[];
  avisos: AvisoAntesDeCotar[];
};

/** Normaliza para comparar zonas sem tropeçar em acentos ou maiúsculas. */
function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function guiaEstaVerificada(p: ProfissionalParaAvaliar): boolean {
  if (!p.guiaVerificadaEm) return false;
  const d = p.guiaVerificadaEm instanceof Date ? p.guiaVerificadaEm : new Date(p.guiaVerificadaEm);
  return !Number.isNaN(d.getTime());
}

export function avaliarElegibilidade(
  pedido: PedidoParaDistribuir,
  profissional: ProfissionalParaAvaliar,
): ResultadoDeElegibilidade {
  const motivos: MotivoDeExclusao[] = [];

  if (!profissional.isActive) motivos.push("inactivo");
  if (profissional.estado !== "aprovado") motivos.push("nao_aprovado");

  // Sem categoria no pedido não se adivinha: não se manda a ninguém. Um envio
  // a todos "porque não sabemos" é exactamente o ruído que queremos evitar.
  if (!pedido.serviceType || !profissional.categorias.includes(pedido.serviceType)) {
    motivos.push("categoria_diferente");
  }

  /*
   * O RAIO MANDA, E É O ÚNICO A MANDAR.
   *
   * Havia dois critérios: a distância medida e, quando ela faltava, a lista
   * de ZONAS que o profissional escrevia à mão. Decisão dele: "vamos remover
   * a opção zona e colocar apenas o raio e os serviços como filtros".
   *
   * As zonas eram uma aproximação escrita por pessoas — cinco ou seis nomes,
   * com acentos trocados e concelhos a fingir de freguesias — e já tinham
   * custado envios a sério (ver a nota do #205 em coordenadas-do-pedido.ts).
   * Hoje não fazem falta: as coordenadas são buscadas e GRAVADAS no momento
   * do envio, morada primeiro e localidade depois, por isso um pedido sem
   * coordenadas é raro e deixou de ser normal.
   *
   * Quando mesmo assim não há ponto nenhum, ninguém é excluído por "fora de
   * alcance" — seria mentira, porque ninguém mediu nada. Diz-se o que é:
   * SEM MORADA. É um problema para resolver no pedido, não no profissional,
   * e o painel da distribuição passa a dizê-lo com essas palavras.
   */
  if (pedido.distanciaKm != null && Number.isFinite(pedido.distanciaKm)) {
    const raio = profissional.raioKm;
    if (raio == null || !Number.isFinite(raio) || pedido.distanciaKm > raio) {
      motivos.push("fora_de_alcance");
    }
  } else {
    motivos.push("sem_morada");
  }

  /*
   * A FATURA E A GUIA DEIXARAM DE ESCONDER O PEDIDO — 14-09-2026.
   *
   * Eram filtros cegos. Quem não tinha a caixa marcada nunca via o pedido, e
   * nem sabia que ele existira; a maioria emite fatura e simplesmente nunca
   * passou por aquele campo do perfil. O cliente ficava com menos propostas
   * por causa de uma caixa por marcar.
   *
   * Passam a ser AVISOS, mostrados a quem vai cotar, antes de cotar. Quem
   * decide é quem assume o trabalho — mas decide a ver, e não sem saber.
   */
  return { elegivel: motivos.length === 0, motivos, avisos: avisosDoTrabalho(pedido, profissional) };
}

/**
 * Os avisos deste trabalho para ESTE profissional.
 *
 * Função à parte porque tem DOIS chamadores que não podem discordar: a
 * distribuição, que os mostra no painel ao lado de quem recebeu, e a rota da
 * proposta, que pára o envio para os confirmar. Se um deles calculasse por sua
 * conta, o ecrã do profissional avisava de uma coisa e o do administrador de
 * outra — e a que ninguém está a ver é a que fica errada.
 */
export function avisosDoTrabalho(
  pedido: Pick<PedidoParaDistribuir, "precisaFatura" | "precisaGuiaTransporte" | "formaDePagamento">,
  profissional: Pick<
    ProfissionalParaAvaliar,
    "emiteFatura" | "emiteGuiaTransporte" | "guiaVerificadaEm"
  >,
): AvisoAntesDeCotar[] {
  const avisos: AvisoAntesDeCotar[] = [];

  if (pedido.precisaFatura && !profissional.emiteFatura) {
    avisos.push("cliente_quer_fatura");
  }

  /*
   * O DINHEIRO É UM AVISO, NUNCA UM FILTRO — 21-09-2026.
   *
   * Ele aceita um trabalho de 120 € em notas de outra maneira do que um já
   * pago, e tem de o saber ANTES de propor. Mas filtrar seria deixar um cliente
   * que escolheu dinheiro sem proposta nenhuma e sem perceber porquê.
   */
  if (pedido.formaDePagamento === "dinheiro") {
    avisos.push("cliente_paga_em_dinheiro");
  }

  /*
   * A guia conta como em falta também quando está DECLARADA E POR VERIFICAR.
   * A declaração sozinha não vale nada — e é pior do que não existir, porque
   * o cliente confia nela.
   */
  if (pedido.precisaGuiaTransporte) {
    if (
      !profissional.emiteGuiaTransporte ||
      !guiaEstaVerificada(profissional as ProfissionalParaAvaliar)
    ) {
      avisos.push("trabalho_exige_guia");
    }
  }

  return avisos;
}

/** Os que devem receber o pedido. */
export function profissionaisParaNotificar(
  pedido: PedidoParaDistribuir,
  profissionais: ProfissionalParaAvaliar[],
): ProfissionalParaAvaliar[] {
  return profissionais.filter((p) => avaliarElegibilidade(pedido, p).elegivel);
}

/**
 * Porque é que um pedido não chegou a ninguém.
 *
 * Um pedido sem destinatários fica publicado e sem propostas, sem erro
 * nenhum — igualzinho a um pedido que ninguém quis. Isto dá a diferença.
 */
export function motivosAgregados(
  /**
   * O pedido SEM distância: ela não é uma propriedade do pedido, é a linha
   * entre ele e a base de cada profissional. Pedi-la aqui era o convite ao
   * erro que aconteceu — os dois sítios que chamavam isto passavam
   * `distanciaKm: null`, e a contagem respondia "sem morada" a respeito de
   * um pedido cuja morada estava perfeitamente localizada. O ecrã do #228
   * dizia, na mesma caixa, "Morada: Localizada" e "2 a morada do pedido não
   * foi localizada".
   */
  pedido: Omit<PedidoParaDistribuir, "distanciaKm">,
  /** Cada profissional com a SUA distância ao trabalho. */
  profissionais: Array<{
    profissional: ProfissionalParaAvaliar;
    distanciaKm: number | null;
  }>,
): Record<MotivoDeExclusao, number> {
  const contagem = {
    inactivo: 0,
    nao_aprovado: 0,
    categoria_diferente: 0,
    fora_de_alcance: 0,
    sem_morada: 0,
    nao_emite_fatura: 0,
    nao_emite_guia: 0,
  } as Record<MotivoDeExclusao, number>;

  for (const { profissional, distanciaKm } of profissionais) {
    const r = avaliarElegibilidade({ ...pedido, distanciaKm }, profissional);
    if (r.elegivel) continue;
    for (const m of r.motivos) contagem[m] += 1;
  }
  return contagem;
}
