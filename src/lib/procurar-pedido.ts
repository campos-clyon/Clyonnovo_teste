import { servicoEmPalavras } from "@/lib/servico-em-palavras";

/**
 * PROCURAR UM PEDIDO NA MESA — por número, nome, morada ou região.
 *
 * "Crie uma barra de pesquisa para que eu possa pesquisar com número, nome ou
 * pedido. Até mesmo por morada ou região." — 13-09-2026.
 *
 * Havia uma busca, mas só dentro do bloco «Por enviar», e o comentário dela
 * dizia porquê: «pô-la no topo da mesa prometia procurar em toda a mesa». A
 * objecção estava certa, e a resposta a ela não é não ter busca no topo — é
 * ter uma que procure mesmo em toda a mesa. É esta.
 *
 * O QUE SE ESCREVE É O QUE SE TEM À MÃO, e isso é raramente uma coisa só. Quem
 * atende o telefone tem um número; quem lê uma mensagem tem um primeiro nome;
 * quem está a olhar para uma morada tem uma rua. Todos esses caminhos vão dar
 * ao mesmo pedido, e nenhum deles obriga a saber em que bloco ele está.
 *
 * AS PALAVRAS SOMAM-SE. «silva lisboa» são duas condições e não duas hipóteses:
 * quem escreve mais está a apertar a rede, não a alargá-la. Sem isto, um nome
 * comum devolvia meia mesa e a busca não servia para nada.
 *
 * OS NÚMEROS NÃO SE DESFAZEM. «912 345 678», «+351 912345678» e «912345678»
 * são o mesmo telemóvel — comparam-se só os dígitos. E «311», «#311» ou
 * «Pedido #311» encontram o pedido 311, que é como ele é falado dentro de casa.
 */

export type PedidoProcuravel = {
  id: number;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  serviceType?: string | null;
  /** Os nomes dos profissionais que estão na mesa deste pedido. */
  profissionais?: Array<string | null | undefined>;
  /** O NIF da fatura (d79, 20-11-2026): procura-se pelos dígitos. */
  nif?: string | null;
};

/*
 * O TELEFONE COMO AS PESSOAS O ESCREVEM — d79 (20-11-2026).
 *
 * «+351 912 345 678», «351912345678», «00351 912 345 678», «912.345.678» e
 * «912345678» são o mesmo telemóvel. Antes, «+351 912 345 678» eram quatro
 * palavras, e «351» tinha de estar no telefone guardado — não estava, e a
 * procura não dava nada. Agora os números escritos aos bocados juntam-se numa
 * palavra só e perdem o indicativo do país.
 */

/** Os nove dígitos nacionais, sem o indicativo 351 / 00351. */
export function telefoneNacional(texto: string): string {
  const d = String(texto ?? "").replace(/\D/g, "");
  if (d.startsWith("00351") && d.length >= 14) return d.slice(5);
  if (d.startsWith("351") && d.length === 12) return d.slice(3);
  return d;
}

/**
 * Junta os números escritos aos bocados numa palavra só, quando têm nove
 * dígitos ou mais (um telefone, um NIF, uma referência Multibanco). Os mais
 * curtos ficam como estão: «Rua 5 de Outubro 12» não é um número, e «2765-321»
 * já é uma palavra. Um «#311» também não se toca.
 */
export function juntarNumeros(termo: string): string {
  return String(termo ?? "").replace(/(?<![#\d])\+?\(?\d[\d\s().-]*\d/g, (m) => {
    const d = m.replace(/\D/g, "");
    return d.length >= 9 ? telefoneNacional(d) : m;
  });
}

/**
 * O termo parece um telefone, um NIF ou uma referência (só algarismos e a
 * pontuação de os escrever, nove dígitos ou mais)? Devolve os dígitos — sem o
 * indicativo —, ou null.
 */
export function digitosDoTermo(termo: string): string | null {
  const t = String(termo ?? "").trim();
  if (!/^[+\d\s().-]+$/.test(t)) return null;
  const d = t.replace(/\D/g, "");
  return d.length >= 9 ? telefoneNacional(d) : null;
}

/** Sem acentos e em minúsculas: «Évora» e «evora» são a mesma cidade. */
function planificar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function soDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

/** Tudo o que este pedido tem escrito, numa linha só, já planificado. */
function textoDe(p: PedidoProcuravel): string {
  const pedacos = [
    /*
     * «pedido #311», e não só «#311».
     *
     * É assim que eles são falados cá dentro, e é assim que são colados de uma
     * conversa. A palavra «pedido» está em todos, portanto não filtra nada —
     * mas a sua ausência filtrava tudo: «pedido #311» pedia duas condições e a
     * primeira não existia em lado nenhum.
     */
    `pedido #${p.id}`,
    p.contactName,
    p.contactEmail,
    p.address,
    p.city,
    p.postalCode,
    p.serviceType ? servicoEmPalavras(p.serviceType) : null,
    ...(p.profissionais ?? []),
  ];
  return planificar(pedacos.filter(Boolean).join(" "));
}

/**
 * Os dígitos por onde se pode chamar este pedido: o telemóvel e o código
 * postal. O número do pedido é comparado à parte, por igualdade — «31» não
 * pode trazer o #310, o #311 e o #312 a reboque.
 */
function digitosDe(p: PedidoProcuravel): string {
  return [p.contactPhone, p.postalCode, p.nif].filter(Boolean).map((v) => soDigitos(String(v))).join(" ");
}

function palavraCombina(palavra: string, p: { id?: number | null; ids?: number[] }, texto: string, digitos: string): boolean {
  const ids = [p.id, ...(p.ids ?? [])].filter((n): n is number => n != null && Number(n) > 0).map(String);
  // «#311» é sempre o número do pedido, e nada mais.
  if (palavra.startsWith("#")) {
    const n = palavra.slice(1);
    return n.length > 0 && ids.includes(n);
  }

  /*
   * UM NÚMERO É O QUE SOBRA DEPOIS DE LHE TIRAR A PONTUAÇÃO.
   *
   * «+351912345678», «912-345-678» e «2765-321» são números escritos como as
   * pessoas os escrevem. Exigir só algarismos deixava de fora precisamente a
   * forma em que um telemóvel é copiado de um ecrã de chamada.
   */
  const digitosDaPalavra = soDigitos(palavra);
  const eNumero = digitosDaPalavra.length > 0 && !/[a-z]/.test(palavra);

  /*
   * E pode ser três coisas, por isso tentam-se as três: o pedido (por
   * igualdade), um telemóvel ou código postal (pelos dígitos), ou parte da
   * morada — «25» em «Rua 25 de Abril» é morada e não é número de nada.
   */
  if (eNumero) {
    if (ids.includes(digitosDaPalavra)) return true;
    if (digitos.includes(digitosDaPalavra)) return true;
    return texto.includes(palavra);
  }

  return texto.includes(palavra);
}

/**
 * Este pedido responde ao que foi escrito na caixa?
 *
 * Um termo vazio deixa passar tudo: a busca só filtra quando há o que
 * procurar.
 */
export function combinaComABusca(p: PedidoProcuravel, termo: string): boolean {
  const palavras = palavrasDoTermo(termo);
  if (palavras.length === 0) return true;

  const texto = textoDe(p);
  const digitos = digitosDe(p);
  return palavras.every((w) => palavraCombina(w, { id: p.id }, texto, digitos));
}

/** As palavras de um termo, com os números escritos aos bocados já juntos (d79). */
function palavrasDoTermo(termo: string): string[] {
  return planificar(juntarNumeros(termo))
    .split(/\s+/)
    .map((w) => (w.startsWith("#") ? "#" + soDigitos(w) : w))
    .filter((w) => w.length > 0 && w !== "#");
}

/**
 * A MESMA PROCURA PARA QUALQUER LINHA — d79 (20-11-2026), a barra única do
 * backoffice. Cada secção diz o que a sua linha tem escrito (`textos`), por
 * onde se pode chamar (`digitos`: telefones, NIF, IBAN, referências) e a que
 * pedidos pertence (`ids`); a regra é a dos pedidos: as palavras somam-se,
 * «#311» é o pedido 311 e só esse, um telefone vale com ou sem +351.
 */
export function combinaComOsCampos(
  linha: {
    ids?: Array<number | null | undefined>;
    textos: Array<string | number | null | undefined>;
    digitos?: Array<string | number | null | undefined>;
  },
  termo: string,
): boolean {
  const palavras = palavrasDoTermo(termo);
  if (palavras.length === 0) return true;
  const ids = (linha.ids ?? []).filter((n): n is number => n != null && Number(n) > 0).map(Number);
  const texto = planificar(linha.textos.filter((v) => v != null && v !== "").join(" "));
  const digitos = (linha.digitos ?? [])
    .filter((v) => v != null && v !== "")
    .map((v) => soDigitos(String(v)))
    .join(" ");
  return palavras.every((w) => palavraCombina(w, { ids }, texto, digitos));
}

/** A lista filtrada, na mesma ordem. */
export function procurarPedidos<T extends PedidoProcuravel>(lista: T[], termo: string): T[] {
  if (planificar(termo).trim().length === 0) return lista;
  return lista.filter((p) => combinaComABusca(p, termo));
}
