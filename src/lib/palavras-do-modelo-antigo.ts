/**
 * AS PALAVRAS DO MODELO ANTIGO — d10, desde 15-11-2026 (`novo-modelo.ts`).
 *
 * A partir de 15-11 o cliente paga ao parceiro e a CLYON não recebe o dinheiro
 * do trabalho. O que o cliente e o parceiro lêem deixa de falar da caução, do
 * valor «cativo», da CLYON a receber ou a guardar o pagamento, e do cliente a
 * pagar à CLYON (ou «pela plataforma»). No que o parceiro lê, o que ele deve à
 * CLYON é o «valor em atraso» — nunca «em dívida» (dono, 12-11-2026).
 *
 * As frases antigas não se apagam: continuam certas para os trabalhos já pagos à
 * CLYON antes da data e para os Trabalhos CLYON. Vivem em declarações com
 * «ANTIGO» no nome, ou dentro de `<RegrasAnteriores>` — e o teste da orquestra
 * (regra s) só as deixa aí. `textos-do-novo-modelo.test.ts` lê os textos que o
 * site escolhe a 15-11 e chumba-as.
 *
 * Puro: os testes e o código lêem a mesma lista.
 */

export type AQuemSeDiz = "todos" | "cliente";

export const DO_MODELO_ANTIGO: ReadonlyArray<{ re: RegExp; aQuem: AQuemSeDiz; nome: string }> = [
  { nome: "caução", aQuem: "todos", re: /(?<!\p{L})cau[çc][ãa]o(?!\p{L})/iu },
  { nome: "cativo", aQuem: "todos", re: /(?<!\p{L})cativ[oa]s?(?!\p{L})/iu },
  {
    nome: "a CLYON recebe o pagamento",
    aQuem: "todos",
    re: /a CLYON (recebe|recebeu|guarda|guardou|tem) o (seu )?(valor|pagamento|dinheiro)/iu,
  },
  { nome: "o valor fica com a CLYON", aQuem: "todos", re: /(valor|dinheiro|pagamento) fica (com a CLYON|connosco)/iu },
  { nome: "o cliente paga à CLYON", aQuem: "todos", re: /o cliente paga à CLYON/iu },
  // d16 (13-11-2026): o fim do simulador e as mensagens do pedido — no modelo novo o cliente não recebe referência.
  {
    nome: "recebe a referência para pagar",
    aQuem: "cliente",
    re: /recebe (a|uma) referência (MB WAY ou Multibanco |Multibanco |MB WAY )?(para (o )?pagar|para pagamento)/iu,
  },
  // d16: o que a CLYON é — organiza e guarda o acordo; o pagamento do trabalho já não passa por ela.
  { nome: "a CLYON guarda o pagamento", aQuem: "todos", re: /guarda o acordo e o pagamento/iu },
  { nome: "em dívida", aQuem: "todos", re: /(?<!\p{L})em d[íi]vida(?!\p{L})/iu },
  { nome: "pagar pela plataforma", aQuem: "todos", re: /(?<!\p{L})(pag\p{L}*|pagamento) pela plataforma/iu },
  { nome: "pela plataforma, o valor", aQuem: "todos", re: /(?<!\p{L})pela plataforma,? (o valor|por MB WAY|ele paga|o cliente paga)/iu },
  // Ao cliente: no modelo novo não paga nada à CLYON. O «A pagar à CLYON» da carteira é do parceiro.
  { nome: "pagar à CLYON", aQuem: "cliente", re: /(?<!«A )(?<!\p{L})(paga|pagar|pague|pagou|pagá-lo|pagá-la) à CLYON/iu },
];

/** A caução de um arrendamento (o blog) não é a do site. */
const OUTRA_CAUCAO = /arrendamento|inquilino|senhorio|senhoria/i;

/** A primeira palavra do modelo antigo neste texto — ou `null`. */
export function falaDoModeloAntigo(texto: string, aQuem: AQuemSeDiz): string | null {
  for (const p of DO_MODELO_ANTIGO) {
    if (p.aQuem === "cliente" && aQuem !== "cliente") continue;
    const m = p.re.exec(texto);
    if (!m) continue;
    if (p.nome === "caução" && OUTRA_CAUCAO.test(texto)) continue;
    return m[0];
  }
  return null;
}
