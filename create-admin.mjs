import * as bcrypt from 'bcrypt';

const senha = 'WWclyon26';
const senhaHash = await bcrypt.hash(senha, 10);

console.log('Senha original:', senha);
console.log('Hash gerado:', senhaHash);
console.log('\nSQL para inserir WANDERSON:');
console.log(`INSERT INTO colaboradores (nome, senha, funcao, valorHora, isAdmin) VALUES ('WANDERSON', '${senhaHash}', 'admin', '0.00', 1);`);
