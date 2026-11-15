/**
 * AS ESTRELAS PÚBLICAS SÓ DE TRABALHOS VERDADEIROS — 04-11-2026 (d10.3,
 * decisão do CEO e do dono: «Confiança antes de crescer»).
 *
 * Até aqui, para uma avaliação contar no perfil público e nas estrelas do
 * Google bastava um trabalho acordado e confirmado. Nada exigia que o dinheiro
 * tivesse passado pela plataforma, nem que o cliente fosse outra pessoa que não
 * o parceiro: um parceiro podia pedir um trabalho a si próprio, confirmá-lo e
 * dar-se cinco estrelas. Com zonas novas e parceiros que ninguém conhece, é a
 * forma mais barata de fabricar uma reputação.
 *
 * Uma avaliação CONTA (na média, na contagem, na lista do perfil, nos cartões
 * das cidades e no `aggregateRating`) quando:
 *
 *   1. o trabalho foi PAGO PELA PLATAFORMA — MB WAY ou Multibanco pelo euPago,
 *      ou transferência recebida pela CLYON (`pagamentos`, pago, não de teste); OU
 *   2. o cliente tem um CONTACTO VERIFICADO E DIFERENTE do do parceiro:
 *        · email verificado — uma conta de cliente com esse email em que alguém
 *          já entrou (`users.lastSignedIn`: Google, link por email ou
 *          palavra-passe com o email confirmado). Desde a d34 (15-11-2026) a
 *          conta nascida de um pedido (`loginMethod = 'pedido'`) já traz
 *          `lastSignedIn` = `createdAt`: essa só conta com uma entrada depois
 *          de nascer; ou
 *        · telefone verificado — o cliente escreveu-nos desse número no WhatsApp;
 *      e nem o telefone nem o email do pedido são os do parceiro.
 *
 * As outras FICAM GUARDADAS (a nota, o comentário, quem a deu) e o parceiro
 * continua a vê-las; só não entram no que é público.
 *
 * O CONTACTO GRAVA-SE NO MOMENTO DA AVALIAÇÃO
 * (`negociacoes.avaliacaoContactoVerificado`, em `avaliarProfissional`): o
 * pedido é arquivado e anonimizado ao fim do prazo, e com ele ia a prova. As
 * avaliações de antes desta coluna (NULL) lêem-se pelo pedido enquanto ele
 * existir. O pagamento lê-se sempre na hora: os pagamentos não se apagam, e uma
 * transferência pode ser registada depois da nota.
 *
 * Só SQL (e duas datas puras): o perfil público e o registo da avaliação usam
 * as mesmas expressões.
 *
 * A TAXA PAGA PELO PRÓPRIO PARCEIRO NÃO PROVA NADA — d28 (CEO e dono,
 * 15-11-2026). Num trabalho em dinheiro (desde o IVA incluído) e em todo o
 * trabalho do modelo de 15-11, o pagamento ligado à negociação é o do
 * PARCEIRO: a taxa da plataforma e o IVA dela. Pagá-la não diz que houve um
 * cliente verdadeiro — só que alguém pagou à CLYON. Conta só o pagamento do
 * cliente (`SQL_PAGAMENTO_DO_CLIENTE`); sem ele, a prova é a do contacto
 * verificado (o ponto 2).
 */
import { IVA_INCLUIDO_DESDE } from "./iva-incluido";
import { NOVO_MODELO_DESDE } from "./novo-modelo";

/** Os métodos que provam que o dinheiro passou pela CLYON. */
export const METODOS_PAGOS_PELA_PLATAFORMA = ["mbway", "multibanco", "transferencia"] as const;

/** Uma data como a base a guarda (UTC, `AAAA-MM-DD hh:mm:ss`). */
const naBase = (d: Date) => `'${d.toISOString().slice(0, 19).replace("T", " ")}'`;

/**
 * A LINHA `pg` DE `pagamentos` É DO CLIENTE, e não a taxa paga pelo parceiro da
 * negociação `n`? É do parceiro:
 *
 *   · a referência da dívida (`parte = 'divida'`);
 *   · combinado em dinheiro, numa negociação aberta desde o IVA incluído — o
 *     cliente pagou-lhe tudo em mão, e o que entrou na CLYON é a dívida dele;
 *   · no modelo de 15-11 — uma linha do trabalho criada desde a data, fora dos
 *     Trabalhos CLYON, numa negociação sem nada pago pelo cliente antes dela e
 *     que não fechou antes dela (o corte de `eDoNovoModelo`).
 *
 * Na dúvida, fica de fora: tirar uma avaliação do público é o lado seguro.
 */
export const SQL_PAGAMENTO_DO_CLIENTE = (pg = "pgv", n = "n") =>
  `(COALESCE(${pg}.parte, 'trabalho') <> 'divida' ` +
  `AND NOT (${n}.formaDePagamento = 'dinheiro' AND ${n}.createdAt >= ${naBase(IVA_INCLUIDO_DESDE)}) ` +
  `AND NOT (${n}.ofertaClyon IS NULL AND COALESCE(${pg}.parte, 'trabalho') = 'trabalho' ` +
  `AND ${pg}.criadoEm >= ${naBase(NOVO_MODELO_DESDE)} ` +
  `AND (${n}.confirmadoEm IS NULL OR ${n}.confirmadoEm >= ${naBase(NOVO_MODELO_DESDE)}) ` +
  `AND NOT EXISTS (SELECT 1 FROM pagamentos pga WHERE pga.negociacaoId = ${n}.id AND pga.estado = 'pago' ` +
  `AND pga.pagoEm < ${naBase(NOVO_MODELO_DESDE)} AND COALESCE(pga.parte, 'trabalho') <> 'divida')))`;

/*
 * A COLAÇÃO DITA SEMPRE. As tabelas nasceram em alturas diferentes (algumas
 * pela app antiga) e comparar colunas de duas delas pode dar «Illegal mix of
 * collations» numa base e não noutra. A expressão leva a colação explícita, e
 * a coluna do outro lado (com índice) fica como está.
 */
const comColacao = (expr: string) => `(CONVERT(${expr} USING utf8mb4) COLLATE utf8mb4_unicode_ci)`;
/** Os nove dígitos de um telefone português, numa expressão SQL. */
const noveDigitos = (expr: string) => comColacao(`RIGHT(REGEXP_REPLACE(COALESCE(${expr}, ''), '[^0-9]', ''), 9)`);
const emailLimpo = (expr: string) => comColacao(`LOWER(TRIM(COALESCE(${expr}, '')))`);

/** O trabalho da negociação `n` foi pago pela plataforma? */
export const SQL_PAGO_PELA_PLATAFORMA = (n = "n") =>
  // Só `pago`: um reembolsado guarda a data do pagamento, mas o dinheiro voltou ao cliente.
  `EXISTS (SELECT 1 FROM pagamentos pgv WHERE pgv.negociacaoId = ${n}.id AND pgv.estado = 'pago' AND pgv.pagoEm IS NOT NULL ` +
  `AND COALESCE(pgv.deTeste, 0) = 0 AND pgv.metodo IN (${METODOS_PAGOS_PELA_PLATAFORMA.map((m) => `'${m}'`).join(", ")}) ` +
  // Só o pagamento do cliente — a taxa paga pelo próprio parceiro não conta (d28).
  `AND ${SQL_PAGAMENTO_DO_CLIENTE("pgv", n)})`;

/**
 * O cliente do pedido `o` tem um contacto verificado, e nenhum dos contactos
 * do pedido é o do parceiro `p`? Com o pedido em falta (LEFT JOIN), é falso.
 */
export const SQL_CONTACTO_VERIFICADO_E_DIFERENTE = (o = "o", p = "p") => {
  const email = emailLimpo(`${o}.contactEmail`);
  const tel = noveDigitos(`${o}.contactPhone`);
  return (
    `(${o}.id IS NOT NULL AND (` +
    // Email verificado: uma conta onde já se entrou com ele.
    `(${email} <> '' AND EXISTS (SELECT 1 FROM users uv WHERE uv.email = ${email} ` +
    `AND uv.lastSignedIn IS NOT NULL AND uv.deletedAt IS NULL ` +
    // A conta do pedido nasce com lastSignedIn = createdAt (d34): ninguém entrou ainda.
    `AND (COALESCE(uv.loginMethod, '') <> 'pedido' OR uv.lastSignedIn > uv.createdAt))) ` +
    // Telefone verificado: o cliente escreveu-nos desse número.
    `OR (LENGTH(${tel}) = 9 AND EXISTS (SELECT 1 FROM whatsappMensagens wv WHERE wv.direccao = 'in' ` +
    `AND wv.telefone IN (CONCAT('351', ${tel}), ${tel})))` +
    `) ` +
    // E diferente do do parceiro.
    `AND NOT (${email} <> '' AND ${email} = ${emailLimpo(`${p}.email`)}) ` +
    `AND NOT (LENGTH(${tel}) = 9 AND ${tel} = ${noveDigitos(`${p}.phone`)}))`
  );
};

/**
 * A avaliação da negociação `n` conta no que é público? Quem chama junta
 * `LEFT JOIN simulatorOrders o ON o.id = n.pedidoId` e
 * `JOIN providers p ON p.id = n.providerId` (os nomes podem mudar).
 */
export const SQL_AVALIACAO_QUE_CONTA = (n = "n", o = "o", p = "p") =>
  `(${SQL_PAGO_PELA_PLATAFORMA(n)} OR ${n}.avaliacaoContactoVerificado = 1 ` +
  `OR (${n}.avaliacaoContactoVerificado IS NULL AND ${SQL_CONTACTO_VERIFICADO_E_DIFERENTE(o, p)}))`;

/**
 * O valor a gravar em `avaliacaoContactoVerificado` no momento da avaliação,
 * para a linha de `negociacoes` que se está a actualizar (`UPDATE negociacoes`
 * sem alias): 1 ou 0, ou NULL sem o pedido.
 */
export const SQL_CONTACTO_NO_MOMENTO =
  `(SELECT CASE WHEN ${SQL_CONTACTO_VERIFICADO_E_DIFERENTE("ov", "pv")} THEN 1 ELSE 0 END ` +
  `FROM simulatorOrders ov, providers pv ` +
  `WHERE ov.id = negociacoes.pedidoId AND pv.id = negociacoes.providerId LIMIT 1)`;
