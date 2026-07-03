import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as bcrypt from 'bcrypt';
import { colaboradores } from '../drizzle/schema';

async function seed() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection);

  // Colaboradores iniciais
  const colaboradoresIniciais = [
    { nome: 'YANNICK', senha: 'YANNICK26', funcao: 'motorista' as const, valorHora: '8.00', isAdmin: 0 },
    { nome: 'VINICIUS', senha: 'VINICIUS26', funcao: 'motorista' as const, valorHora: '8.00', isAdmin: 0 },
    { nome: 'MATHEUS', senha: 'MATHEUS26', funcao: 'ajudante' as const, valorHora: '7.00', isAdmin: 0 },
    { nome: 'RODRIGO', senha: 'RODRIGO26', funcao: 'ajudante' as const, valorHora: '7.00', isAdmin: 0 },
    { nome: 'EDUARDO', senha: 'EDUARDO26', funcao: 'motorista' as const, valorHora: '8.00', isAdmin: 0 },
    { nome: 'ADMIN', senha: 'ADMIN2026', funcao: 'motorista' as const, valorHora: '0.00', isAdmin: 1 },
  ];

  console.log('🔄 Populando banco de dados com colaboradores iniciais...\n');

  for (const colab of colaboradoresIniciais) {
    try {
      // Hash da senha
      const senhaHash = await bcrypt.hash(colab.senha, 10);
      
      // Inserir no banco
      await db.insert(colaboradores).values({
        nome: colab.nome,
        senha: senhaHash,
        funcao: colab.funcao,
        valorHora: colab.valorHora,
        isAdmin: colab.isAdmin
      });
      
      console.log(`✅ ${colab.nome} - ${colab.isAdmin ? 'ADMIN' : colab.funcao} (senha: ${colab.senha})`);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.log(`⚠️  ${colab.nome} já existe no banco`);
      } else {
        console.error(`❌ Erro ao criar ${colab.nome}:`, error.message);
      }
    }
  }

  console.log('\n✅ Banco de dados populado com sucesso!');
  await connection.end();
  process.exit(0);
}

seed();
