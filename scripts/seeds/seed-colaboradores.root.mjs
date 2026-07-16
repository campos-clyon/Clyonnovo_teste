import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'clyon',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function seedData() {
  const connection = await pool.getConnection();

  try {
    // Dados dos colaboradores
    const colaboradores = [
      {
        nome: 'Vinícius',
        email: 'vinicius@clyon.pt',
        telefone: '+351 912 345 678',
        especialidade: 'Mudanças',
        experiencia: 5,
      },
      {
        nome: 'Eduardo',
        email: 'eduardo@clyon.pt',
        telefone: '+351 913 345 678',
        especialidade: 'Limpeza',
        experiencia: 3,
      },
      {
        nome: 'Yannick',
        email: 'yannick@clyon.pt',
        telefone: '+351 914 345 678',
        especialidade: 'Jardinagem',
        experiencia: 4,
      },
      {
        nome: 'Matheus',
        email: 'matheus@clyon.pt',
        telefone: '+351 915 345 678',
        especialidade: 'Demolição',
        experiencia: 6,
      },
    ];

    // Inserir colaboradores
    for (const colab of colaboradores) {
      await connection.query(
        'INSERT INTO colaboradores (nome, email, telefone, especialidade, experiencia) VALUES (?, ?, ?, ?, ?)',
        [colab.nome, colab.email, colab.telefone, colab.especialidade, colab.experiencia]
      );
      console.log(`✅ Colaborador ${colab.nome} inserido`);
    }

    // Buscar IDs dos colaboradores inseridos
    const [colaboradoresInseridos] = await connection.query(
      'SELECT id, nome FROM colaboradores WHERE nome IN (?, ?, ?, ?)',
      ['Vinícius', 'Eduardo', 'Yannick', 'Matheus']
    );

    // Dados de exemplo para registros de horas
    const registrosExemplo = [
      // Vinícius
      {
        colaboradorId: colaboradoresInseridos[0]?.id,
        data: '2026-01-31',
        horaEntrada: '08:00',
        horaSaida: '17:30',
        numTrabalhos: 5,
      },
      {
        colaboradorId: colaboradoresInseridos[0]?.id,
        data: '2026-01-30',
        horaEntrada: '07:45',
        horaSaida: '18:00',
        numTrabalhos: 6,
      },
      // Eduardo
      {
        colaboradorId: colaboradoresInseridos[1]?.id,
        data: '2026-01-31',
        horaEntrada: '09:00',
        horaSaida: '17:00',
        numTrabalhos: 4,
      },
      {
        colaboradorId: colaboradoresInseridos[1]?.id,
        data: '2026-01-30',
        horaEntrada: '08:30',
        horaSaida: '17:30',
        numTrabalhos: 5,
      },
      // Yannick
      {
        colaboradorId: colaboradoresInseridos[2]?.id,
        data: '2026-01-31',
        horaEntrada: '08:15',
        horaSaida: '17:45',
        numTrabalhos: 3,
      },
      {
        colaboradorId: colaboradoresInseridos[2]?.id,
        data: '2026-01-30',
        horaEntrada: '08:00',
        horaSaida: '17:00',
        numTrabalhos: 4,
      },
      // Matheus
      {
        colaboradorId: colaboradoresInseridos[3]?.id,
        data: '2026-01-31',
        horaEntrada: '07:30',
        horaSaida: '18:30',
        numTrabalhos: 7,
      },
      {
        colaboradorId: colaboradoresInseridos[3]?.id,
        data: '2026-01-30',
        horaEntrada: '07:45',
        horaSaida: '18:15',
        numTrabalhos: 6,
      },
    ];

    // Inserir registros de horas
    for (const registro of registrosExemplo) {
      if (registro.colaboradorId) {
        await connection.query(
          'INSERT INTO registrosHoras (colaboradorId, data, horaEntrada, horaSaida, numTrabalhos) VALUES (?, ?, ?, ?, ?)',
          [
            registro.colaboradorId,
            registro.data,
            registro.horaEntrada,
            registro.horaSaida,
            registro.numTrabalhos,
          ]
        );
      }
    }

    console.log('✅ Todos os dados de exemplo foram inseridos com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inserir dados:', error);
  } finally {
    await connection.release();
    await pool.end();
  }
}

seedData();
