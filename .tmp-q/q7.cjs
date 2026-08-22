require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection(process.env.DATABASE_URL);
  const [s] = await c.execute(
    `SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(rawOrderJson,'$.origemPedido')),
                     JSON_UNQUOTE(JSON_EXTRACT(rawOrderJson,'$._source')),
                     '(nenhuma)') AS origem,
            COUNT(*) AS n
       FROM simulatorOrders GROUP BY origem ORDER BY n DESC`);
  console.log('ORIGEM REAL (do rawOrderJson):'); console.table(s);
  const [r] = await c.execute(
    `SELECT o.id,
            COALESCE(JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson,'$.origemPedido')),
                     JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson,'$._source')),'(nenhuma)') AS origem,
            (o.contactEmail IS NULL OR o.contactEmail='') AS semEmail,
            (SELECT COUNT(*) FROM negociacoes n WHERE n.pedidoId=o.id) AS negs,
            (SELECT GROUP_CONCAT(n.estado) FROM negociacoes n WHERE n.pedidoId=o.id) AS estados
       FROM simulatorOrders o WHERE o.id>=190 ORDER BY o.id DESC`);
  console.log('RECENTES:'); console.table(r);
  await c.end();
})().catch(e => { console.error(String(e).slice(0,400)); process.exit(1); });
