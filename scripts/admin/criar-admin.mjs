/**
 * Gera o SQL para criar (ou repor) uma conta de administrador.
 *
 * PORQUE ESTE FICHEIRO SUBSTITUIU CINCO
 *
 * Havia aqui cinco scripts com palavras-passe escritas em texto: a do
 * administrador e as da equipa toda, todas no mesmo padrão NOME + 26. Estavam
 * no repositório, no histórico do git, e em qualquer cópia que alguém tivesse
 * feito. Um segredo no código não é um segredo.
 *
 * Este não guarda nenhuma. A palavra-passe vem de fora, e o que sai é só o
 * hash — que é o que a base precisa e o que se pode mostrar sem risco.
 *
 * Também não se liga à base de dados de propósito. Um script que escreve
 * directamente é um script que uma distracção aponta a produção; assim o SQL
 * é lido por uma pessoa antes de correr, e vê-se em que base está a correr.
 *
 * COMO SE USA
 *
 *   node scripts/admin/criar-admin.mjs "a-palavra-passe" [NOME]
 *
 * ou, sem a deixar no histórico da shell:
 *
 *   ADMIN_SENHA="a-palavra-passe" node scripts/admin/criar-admin.mjs
 */

import * as bcrypt from "bcrypt";

const senha = process.argv[2] ?? process.env.ADMIN_SENHA ?? "";
const nome = (process.argv[3] ?? process.env.ADMIN_NOME ?? "WANDERSON").toUpperCase();

if (!senha || senha.length < 10) {
  console.error(
    "Indique uma palavra-passe com pelo menos 10 caracteres.\n\n" +
      '  node scripts/admin/criar-admin.mjs "a-palavra-passe" [NOME]\n' +
      '  ADMIN_SENHA="a-palavra-passe" node scripts/admin/criar-admin.mjs\n',
  );
  process.exit(1);
}

const hash = await bcrypt.hash(senha, 10);

// A palavra-passe NÃO é impressa. Quem a escreveu já a conhece, e o terminal
// fica em histórico e em capturas de ecrã.
console.log(`
-- Conta de administrador: ${nome}
-- Corra isto na base onde quer a conta. Confirme primeiro qual é:
--   SELECT DATABASE();

INSERT INTO colaboradores (nome, senha, funcao, valorHora, isAdmin)
VALUES ('${nome}', '${hash}', 'admin', '0.00', 1)
ON DUPLICATE KEY UPDATE senha = VALUES(senha), funcao = 'admin', isAdmin = 1;
`);
