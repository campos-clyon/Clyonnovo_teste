import { ensureProvidersSchema, getPool } from "@/lib/db";
import {
  contaPodeEntrarNoPainel,
  verificarSessaoDoProfissional,
  type SessaoDoProfissional,
} from "@/lib/profissional-auth";

/**
 * A SESSÃO DO PROFISSIONAL, CONFIRMADA NA BASE.
 *
 * O cookie do painel vale trinta dias e renova-se enquanto ele o usa. Até aqui
 * as rotas só olhavam para a assinatura: um profissional suspenso, rejeitado
 * ou apagado continuava a ver pedidos, a propor valores e a pedir
 * levantamentos até o cookie caducar — e, com a renovação, podia nunca
 * caducar. Só a entrada (com palavra-passe) é que perguntava à base.
 *
 * Agora cada rota do painel pergunta: o token tem de ser válido E a conta tem
 * de passar no MESMO critério da entrada (`contaPodeEntrarNoPainel`). Custa
 * uma consulta pela chave primária.
 *
 * O middleware continua só com a assinatura — corre no edge, onde não há
 * base. Quem lá passa com uma conta fechada vê a moldura do painel, e a
 * primeira chamada devolve 401 e manda-o para a entrada.
 *
 * SE A BASE FALHAR, LANÇA — não devolve null. Null é 401, e 401 faz o painel
 * mandá-lo para o ecrã de entrada, por um soluço da base que não tem nada a
 * ver com a conta dele. Lançar dá o mesmo 500 que a rota daria na consulta
 * seguinte, e ele continua com a sessão.
 */
export async function sessaoActivaDoProfissional(
  token?: string | null,
): Promise<SessaoDoProfissional | null> {
  const sessao = await verificarSessaoDoProfissional(token);
  if (!sessao) return null;

  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) throw new Error("[sessao-do-profissional] base de dados indisponível");

  // `isClyon = 0`, como na entrada: a conta da própria CLYON não é um painel.
  const [linhas] = (await pool.execute(
    "SELECT estado, isActive FROM providers WHERE id = ? AND isClyon = 0 LIMIT 1",
    [sessao.providerId],
  )) as [Array<{ estado: string | null; isActive: number | null }>, unknown];

  return contaPodeEntrarNoPainel(linhas[0]) ? sessao : null;
}
