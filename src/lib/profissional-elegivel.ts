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

export type PedidoParaDistribuir = {
  serviceType: string | null;
  precisaFatura: boolean;
  precisaGuiaTransporte: boolean;
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

export type ResultadoDeElegibilidade =
  | { elegivel: true }
  | { elegivel: false; motivos: MotivoDeExclusao[] };

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

  // Isto é binário e sabe-se de antemão. Deixar um pedido que exige fatura
  // chegar a quem não a emite é a negociação inteira a acabar mal ao fim de
  // cinco propostas — e as duas partes a perderem tempo por nossa causa.
  if (pedido.precisaFatura && !profissional.emiteFatura) {
    motivos.push("nao_emite_fatura");
  }

  if (pedido.precisaGuiaTransporte) {
    if (!profissional.emiteGuiaTransporte || !guiaEstaVerificada(profissional)) {
      motivos.push("nao_emite_guia");
    }
  }

  return motivos.length === 0 ? { elegivel: true } : { elegivel: false, motivos };
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
