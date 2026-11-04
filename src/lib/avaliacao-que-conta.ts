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
 *          palavra-passe com o email confirmado); ou
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
 * Só SQL, sem importações: o perfil público e o registo da avaliação usam as
 * mesmas expressões.
 */

/** Os métodos que provam que o dinheiro passou pela CLYON. */
export const METODOS_PAGOS_PELA_PLATAFORMA = ["mbway", "multibanco", "transferencia"] as const;

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
  `AND COALESCE(pgv.deTeste, 0) = 0 AND pgv.metodo IN (${METODOS_PAGOS_PELA_PLATAFORMA.map((m) => `'${m}'`).join(", ")}))`;

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
    `AND uv.lastSignedIn IS NOT NULL AND uv.deletedAt IS NULL)) ` +
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
