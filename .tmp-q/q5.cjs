require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection(process.env.DATABASE_URL);
  const [cols] = await c.execute(`SHOW COLUMNS FROM simulatorOrders`);
  const nomes = cols.map(x => x.Field);
  console.log('COLUNAS relevantes:', nomes.filter(n =>
    /origem|acesso|token|email|canal|fonte|source|criadoPor|colaborador/i.test(n)).join(', ') || '(nenhuma)');
  const [r] = await c.execute(
    `SELECT o.id, o.contactEmail, o.contactPhone,
            (o.acessoTokenHash IS NOT NULL) AS temToken,
            (SELECT COUNT(*) FROM negociacoes n WHERE n.pedidoId=o.id) AS negs,
            LEFT(o.historyJson, 0) AS _
       FROM simulatorOrders o
      WHERE EXISTS (SELECT 1 FROM negociacoes n WHERE n.pedidoId=o.id)
      ORDER BY o.id DESC`);
  console.table(r);
  await c.end();
})().catch(e => { console.error(String(e).slice(0,400)); process.exit(1); });
