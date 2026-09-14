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

/**
 * OS ABANDONADOS — os que nunca chegaram a lado nenhum.
 *
 * "Vamos apagar os pendentes após 90 dias." — 14-09-2026.
 *
 * A purga só olhava para os estados de fim: concluído, cancelado, arquivado. O
 * estado por omissão de um pedido é `pendente`, e um pedido que o cliente
 * abandona a meio fica lá para sempre — com a morada, o texto e as fotografias
 * de dentro de casa dele. São a maioria dos antigos, e eram os únicos que a
 * purga nunca tocava.
 *
 * NOVENTA E NÃO SESSENTA porque estes não têm data de fim. Um pedido concluído
 * há 60 dias está mesmo acabado; um `pendente` de há 60 dias ainda pode ser um
 * cliente que voltou de férias. Trinta dias a mais custam pouco e evitam apagar
 * uma conversa que ainda estava viva.
 */
export const DIAS_PARA_OS_ABANDONADOS = 90;

/**
 * AS RECOLHAS DO WHATSAPP A MEIO — a conversa que nunca virou pedido.
 *
 * `whatsappRecolhas` guarda, por número de telefone, o que a pessoa já
 * respondeu ao assistente: o nome, a morada, o código postal, o que tem para
 * levar. Uma linha por número, em JSON. Quando a conversa dá um pedido, fica lá
 * o `pedidoId`; quando a pessoa desiste a meio, ficava lá TUDO, para sempre —
 * nada no repositório apagava estas linhas pela idade. Verificado a 14-09-2026.
 *
 * O PRAZO É O DOS ABANDONADOS, e de propósito: é o que o dono fixou para as
 * coisas que nunca chegaram ao fim, e uma recolha a meio é exactamente isso.
 *
 * Pode ser muito mais curto sem se perder nada. O próprio assistente já ignora
 * uma recolha parada há mais de 24 horas (ver `paradaHaMuito` em
 * whatsapp-negociacao.ts): a partir daí a linha não serve para conversa
 * nenhuma, só guarda a morada de alguém. Baixar este número é seguro; é uma
 * decisão do dono, não do código, e por isso está aqui e não escrito no SQL.
 */
export const DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP = DIAS_PARA_OS_ABANDONADOS;

/**
 * A PURGA ESTÁ ARMADA? Por omissão, NÃO.
 *
 * A auditoria de 11-09-2026 apanhou o que faltava a este trabalho: um cron
 * diário que apaga pedidos e fotografias, e nenhuma prova no repositório de
 * que exista cópia de segurança de onde recuperar. A condição da purga está
 * apertada — só terminados, com mais de 60 dias, nunca com dinheiro por pagar
 * — mas "apertada" não é "reversível".
 *
 * Sem esta variável a purga corre em MODO SECO: conta o que apagaria, escreve
 * o número no registo permanente, e não toca em nada. É assim que se vê o
 * tamanho da primeira passagem ANTES de ela acontecer.
 *
 * Arma-se com `PURGA_ARMADA=sim` na Vercel, depois de confirmar que o Railway
 * tem cópias automáticas e que alguém já experimentou restaurar uma.
 */
export function purgaArmada(): boolean {
  return (process.env.PURGA_ARMADA ?? "").trim().toLowerCase() === "sim";
}
