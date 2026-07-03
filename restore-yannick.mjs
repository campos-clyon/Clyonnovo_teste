import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';

const db = new Database('./clyon.db');

// Verificar se YANNICK existe
const existe = db.prepare('SELECT * FROM colaboradores WHERE nome = ?').get('YANNICK');
if (!existe) {
  console.log('YANNICK não existe, criando...');
  const senhaHash = bcrypt.hashSync('YANNICK26', 10);
  db.prepare('INSERT INTO colaboradores (nome, senha, funcao, valorHora, isAdmin) VALUES (?, ?, ?, ?, ?)').run('YANNICK', senhaHash, 'Motorista', '7', 0);
  console.log('YANNICK criado com sucesso');
} else {
  console.log('YANNICK já existe');
}

db.close();
