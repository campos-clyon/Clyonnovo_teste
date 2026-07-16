// Dados de YANNICK para login
const loginData = {
  nome: 'YANNICK',
  senha: 'YANNICK26'
};

// Registros de horas a restaurar
const registros = [
  {
    data: '2026-01-18',
    horaEntrada: '08:30',
    horaSaida: '15:10',
    horaPausa: '00:00',
    numeroTrabalhos: 0
  },
  {
    data: '2026-01-17',
    horaEntrada: '08:30',
    horaSaida: '18:40',
    horaPausa: '00:00',
    numeroTrabalhos: 0
  },
  {
    data: '2026-01-16',
    horaEntrada: '10:10',
    horaSaida: '19:45',
    horaPausa: '01:00',
    numeroTrabalhos: 0
  },
  {
    data: '2026-01-15',
    horaEntrada: '12:30',
    horaSaida: '14:15',
    horaPausa: '00:00',
    numeroTrabalhos: 0
  }
];

const API_URL = 'http://localhost:3000/api';

async function restaurarRegistros() {
  try {
    console.log('1. Fazendo login com YANNICK...');
    const loginResponse = await fetch(`${API_URL}/colaboradores/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    });

    if (!loginResponse.ok) {
      throw new Error(`Erro ao fazer login: ${loginResponse.status}`);
    }

    const { token, colaborador } = await loginResponse.json();
    console.log(`✓ Login bem-sucedido. Token: ${token.substring(0, 20)}...`);
    console.log(`✓ ID do colaborador: ${colaborador.id}`);

    console.log('\n2. Restaurando registros de horas...');
    
    for (const registro of registros) {
      console.log(`\nCriando registro: ${registro.data} (${registro.horaEntrada} - ${registro.horaSaida})`);
      
      const response = await fetch(`${API_URL}/colaboradores/registrar-horas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          data: registro.data,
          horaEntrada: registro.horaEntrada,
          horaSaida: registro.horaSaida,
          horaPausa: registro.horaPausa,
          numeroTrabalhos: registro.numeroTrabalhos
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`✗ Erro ao criar registro: ${error.error}`);
      } else {
        const result = await response.json();
        console.log(`✓ Registro criado com sucesso (ID: ${result.registro.id})`);
      }
    }

    console.log('\n✓ Todos os registros foram restaurados!');
  } catch (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
}

restaurarRegistros();
