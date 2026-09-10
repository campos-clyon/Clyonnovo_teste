/**
 * QUANTO TEMPO SE GUARDA — o número, num sítio só.
 *
 * "Esse método é para evitar acumular informação que já não serve. Temos de
 * ter o histórico completo do pedido para caso de processos judiciais, mas
 * temos que eliminar as imagens e os pedidos da base de dados para poupar
 * espaço." — 10-09-2026.
 *
 * O que fica para sempre é o registo permanente (`registoPermanente`): a metade
 * contabilística — datas, valores, taxa, serviço, zona, quem — que a lei manda
 * guardar e que responde num litígio. O que se apaga aos N dias é o pedido em
 * si e as fotografias: a morada, o texto livre, as imagens de dentro de casa.
 *
 * As mensagens de WhatsApp têm o mesmo prazo, escrito à mão no SQL delas
 * (`INTERVAL 60 DAY`, em db.ts) porque um teste o fixa assim. Se este número
 * mudar, aquele muda com ele.
 */
export const DIAS_DE_RETENCAO_DOS_PEDIDOS = 60;
