import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST || 'localhost',
  user: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'clyon_sales_page',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function insertWanderson() {
  try {
    const connection = await pool.getConnection();
    
    // Hash da senha
    const senhaHash = await bcrypt.hash('WWclyon26', 10);
    
    // Inserir Wanderson como admin
    await connection.execute(
      'INSERT INTO colaboradores (nome, senha, funcao, valorHora, isAdmin) VALUES (?, ?, ?, ?, ?)',
      ['WANDERSON', senhaHash, 'motorista', '8.00', 1]
    );
    
    console.log('✅ Wanderson criado como admin com sucesso!');
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

insertWanderson();
