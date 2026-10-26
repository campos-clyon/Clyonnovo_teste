/**
 * QUEM EMITE A FACTURA AO CLIENTE — e não é a CLYON.
 *
 * SÓ PARA O BACKOFFICE E PARA QUEM EMITE AS FACTURAS — 26-10-2026.
 *
 * O dono: a empresa parceira que emite as facturas não é a CLYON e não se
 * expõe ao público. O nome dela aparece nas facturas impressas, que só o
 * cliente recebe — e em mais lado nenhum que o público veja. O site, as
 * páginas em inglês, os dados estruturados, os emails, as mensagens, o
 * comprovativo em PDF, o painel do profissional e a app Pro dizem
 * `QUEM_FACTURA_EM_PALAVRAS` (`identificacao-legal.ts`), sem nome nem NIF.
 *
 * Por isso isto saiu de `identificacao-legal.ts`, que as páginas públicas e a
 * app Pro importam: um objecto que viaja num módulo importado por um ecrã
 * público acaba no JavaScript que o browser descarrega, mesmo sem aparecer no
 * ecrã. Aqui, só o importa o backoffice (a conta em degraus diz para onde vai
 * o IVA). O teste `empresa-parceira-fora-do-publico.test.ts` chumba quem o
 * importar de fora do backoffice, e qualquer ficheiro público com o nome ou o
 * NIF dela.
 *
 * DE ONDE VEM — 22-09-2026: «quem vai facturar será uma empresa parceira».
 * O site anuncia o IVA a 23 %, e a CLYON está na isenção do artigo 53.º: não
 * pode liquidar imposto nenhum. Quem o liquida é esta entidade. São duas
 * entidades com dois NIF e dois regimes: quem presta o serviço e responde pelo
 * site é a CLYON; quem emite a factura e liquida o imposto é esta. Por isso
 * vive numa constante SEPARADA da `IDENTIFICACAO`.
 *
 * O NIF fecha no dígito de controlo e começa por 5, que é o que distingue uma
 * pessoa colectiva de uma singular — coerente com a forma jurídica.
 */
export const ENTIDADE_QUE_FACTURA = {
  /** A denominação social, como tem de constar da factura. */
  nomeLegal: "Miragem Dourada, Unipessoal Lda",
  /** Como lhe chama a equipa no backoffice. */
  nomeCurto: "Miragem Dourada",
  nif: "518301192",
  morada: "Rua José Henriques Coelho, n.º 1, 4.º C, 2770-103 Paço de Arcos",
  /**
   * Regime normal — é o que lhe permite liquidar os 23 % que o site anuncia.
   *
   * ⚠️ POR CONFIRMAR COM O DONO. Uma sociedade unipessoal também pode estar
   * na isenção do artigo 53.º, e nesse caso a conta do cliente está errada
   * outra vez. O que se sabe é a instrução — «tudo deve ser a 23 % caso
   * deseje factura» — e ela só faz sentido com o regime normal.
   */
  regimeIva: "Regime normal — liquida IVA à taxa de 23 %",
} as const;
