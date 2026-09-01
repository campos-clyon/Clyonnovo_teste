/**
 * Que tipo é este ficheiro, e podemos aceitá-lo?
 *
 * O QUE CORREU MAL ANTES
 *
 * A verificação era `if (file.type && !PERMITIDOS.has(file.type))` — um
 * ficheiro sem tipo declarado passava ao lado da lista inteira. Fechei isso
 * numa auditoria de segurança e passei a exigir o tipo declarado.
 *
 * Só que o `type` de um File vem do BROWSER, e o browser adivinha-o pela
 * extensão. Nem sempre acerta e nem sempre o preenche: fotos escolhidas em
 * certos telemóveis, ficheiros vindos de aplicações de galeria, HEIC em
 * Android — tudo isso chega com `type` vazio. Ao exigir o tipo, passei a
 * recusar fotos legítimas de gente que estava mesmo a pedir orçamento.
 *
 * A LIÇÃO: "não confiar no que o cliente declara" não é o mesmo que "exigir
 * que o cliente declare". A lista de permitidos continua a mandar — o que
 * muda é que, se o tipo não vier, olhamos para a extensão em vez de desistir.
 * Continua a ser uma lista fechada; deixa é de castigar quem não tem culpa.
 */

/** Tipo declarado → aceite. É a lista que manda. */
/**
 * Os tipos aceites, como lista.
 *
 * A autorização de envio direto precisa deles em array, e não em Set. Uma
 * segunda lista escrita à mão nesse ficheiro acabaria por divergir desta — e a
 * divergência aparecia como "este ficheiro não é aceite" num caminho e não no
 * outro, sem nada que explicasse porquê.
 */
export const TIPOS_ACEITES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
  "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm",
  /*
   * PDF, a pedido: "no arquivo nós só aceitamos fotos, mas devemos aceitar
   * também PDFs e vídeos."
   *
   * O que faltava era mesmo o PDF — os vídeos já estavam nesta lista há muito,
   * mas o `accept="image/*"` da interface impedia-os de sequer serem
   * escolhidos. Aceitava-se no servidor o que o ecrã não deixava enviar.
   *
   * Um PDF é o formato em que chegam as reportagens fotográficas e os
   * relatórios de obra — várias fotos e notas num ficheiro só. Recusá-lo
   * obrigava a desmontá-lo em imagens à mão, e quem o faz vinte vezes por
   * semana acaba por mandar por WhatsApp, fora do pedido.
   */
  "application/pdf",
] as const;

const TIPOS_PERMITIDOS = new Set<string>(TIPOS_ACEITES);

/** Extensão → tipo, para quando o browser não declara nada. */
const POR_EXTENSAO: Record<string, string> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
  gif:  "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  mp4:  "video/mp4",
  mov:  "video/quicktime",
  webm: "video/webm",
  pdf:  "application/pdf",
};

/**
 * QUE ESPÉCIE DE ANEXO É ISTO — e portanto como se mostra.
 *
 * Uma imagem entra num `<img>`, um vídeo num `<video>`, um PDF em lado nenhum
 * dos dois: metido num `<img>` dá o ícone de imagem partida, que é pior do que
 * não mostrar nada.
 *
 * Cinco ecrãs precisam desta decisão — o cartão do profissional, o detalhe, a
 * prova do trabalho, a mesa do backoffice e o ecrã do cliente. Cinco cópias de
 * uma expressão regular divergem no dia em que se acrescenta um formato.
 *
 * DECIDE PELO NOME, e não pelo tipo declarado: o que fica guardado é uma URL, e
 * o tipo do momento do envio nem sempre viajou com ela.
 */
export type EspecieDoAnexo = "imagem" | "video" | "pdf";

export function especieDoAnexo(urlOuNome: string | null | undefined): EspecieDoAnexo {
  const limpo = (urlOuNome ?? "").split("?")[0].split("#")[0].toLowerCase();
  if (/\.(mp4|mov|m4v|webm|avi|mkv)$/.test(limpo)) return "video";
  if (/\.pdf$/.test(limpo)) return "pdf";
  /*
   * Por omissão, imagem. É o caso de longe mais comum, e uma URL sem extensão
   * — que acontece — tem muito mais probabilidade de ser uma fotografia do que
   * qualquer outra coisa. Num `<img>` que falhe, o ecrã mostra o texto
   * alternativo; um PDF tratado como imagem seria o mesmo desfecho.
   */
  return "imagem";
}

export type ResultadoTipo =
  | { ok: true; tipo: string; origem: "declarado" | "extensao" }
  | { ok: false; motivo: string };

export function tipoDoFicheiro(nome: string, tipoDeclarado: string | undefined | null): ResultadoTipo {
  const declarado = (tipoDeclarado ?? "").trim().toLowerCase();
  if (declarado && TIPOS_PERMITIDOS.has(declarado)) {
    return { ok: true, tipo: declarado, origem: "declarado" };
  }

  // Sem tipo, ou com um tipo que não conhecemos: a extensão decide.
  const ext = (nome.split(".").pop() ?? "").trim().toLowerCase();
  const porExt = POR_EXTENSAO[ext];
  if (porExt) {
    return { ok: true, tipo: porExt, origem: "extensao" };
  }

  return {
    ok: false,
    motivo: declarado
      ? `formato não suportado (${declarado})`
      : `formato não reconhecido (ficheiro "${nome}" sem tipo e sem extensão conhecida)`,
  };
}

/** Só para mostrar na lista de permitidos, quando é preciso explicar. */
export const EXTENSOES_ACEITES = Object.keys(POR_EXTENSAO);
