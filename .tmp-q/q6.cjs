require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection(process.env.DATABASE_URL);
  const [s] = await c.execute(
    `SELECT source, COUNT(*) AS n, SUM(colaboradorId IS NOT NULL) AS comColab,
            SUM(contactEmail IS NULL OR contactEmail='') AS semEmail
       FROM simulatorOrders GROUP BY source ORDER BY n DESC`);
  console.log('POR ORIGEM:'); console.table(s);
  const [r] = await c.execute(
    `SELECT id, source, colaboradorId, (contactEmail IS NULL OR contactEmail='') AS semEmail
       FROM simulatorOrders WHERE id >= 190 ORDER BY id DESC`);
  console.log('RECENTES:'); console.table(r);
  await c.end();
})().catch(e => { console.error(String(e).slice(0,400)); process.exit(1); });
