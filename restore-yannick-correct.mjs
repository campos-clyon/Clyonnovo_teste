import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';

const db = new Database('./clyon.db');

try {
  // Verificar se YANNICK existe
  const existe = db.prepare('SELECT * FROM colaboradores WHERE nome = ?').get('YANNICK');
  
  if (existe) {
    console.log('YANNICK já existe, atualizando...');
    const senhaHash = bcrypt.hashSync('YANNICK26', 10);
    db.prepare('UPDATE colaboradores SET senha = ?, funcao = ?, valorHora = ? WHERE nome = ?')
      .run(senhaHash, 'Ajudante', '7', 'YANNICK');
    console.log('YANNICK atualizado com sucesso');
  } else {
    console.log('YANNICK não existe, criando...');
    const senhaHash = bcrypt.hashSync('YANNICK26', 10);
    db.prepare('INSERT INTO colaboradores (nome, senha, funcao, valorHora, isAdmin) VALUES (?, ?, ?, ?, ?)')
      .run('YANNICK', senhaHash, 'Ajudante', '7', 0);
    console.log('YANNICK criado com sucesso');
  }
  
  // Verificar se foi criado/atualizado
  const verificar = db.prepare('SELECT id, nome, funcao, valorHora FROM colaboradores WHERE nome = ?').get('YANNICK');
  console.log('Dados de YANNICK:', verificar);
  
} catch (err) {
  console.error('Erro:', err.message);
} finally {
  db.close();
}
