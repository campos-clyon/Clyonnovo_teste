import { gerarTokenDeAcesso } from "@/lib/pedido-acesso";
import { guardarTokenDePalavraPasse } from "@/lib/db";
import { enviarEmailDeRepor, type QuemPediu } from "@/lib/email-repor-palavra-passe";
import { HORAS_DO_LINK_DE_REPOR } from "@/lib/convite-profissional";

/**
 * REPOR A PALAVRA-PASSE DE UM PROFISSIONAL — 01-10-2026.
 *
 * «Esse profissional não consegue acessar a conta pois perdeu a senha, e no
 * login também não tem essa função.» Havia o link de uso único do convite, e
 * a página de definir dizia «Este link expirou. Peça outro na página de
 * entrada» — mas a página de entrada não tinha onde o pedir, e o backoffice
 * só o emitia ao aprovar alguém que ainda não tinha palavra-passe. Quem a
 * perdesse ficava fora da conta (e do saldo) sem caminho nenhum de volta.
 *
 * Agora sai daqui, pelos dois lados: o próprio na página de entrada, ou a
 * CLYON no «Editar perfil» do backoffice.
 *
 * SÓ POR EMAIL, e devolve só se o email saiu — nunca o token. Foi a escolha do
 * dono: o link é a chave da conta, e não fica no ecrã de ninguém para ser
 * copiado. A palavra-passe actual continua a valer até o link ser usado; quem
 * não o pediu ignora o email e não perde nada.
 *
 * 24 HORAS, e não os 7 dias do convite: o convite espera que ele abra o email
 * de aprovação quando puder; um pedido de repor faz-se quando se quer entrar,
 * e um link destes parado uma semana numa caixa de correio é uma porta aberta.
 * Um link novo substitui o anterior — o de um convite incluído. O número
 * (`HORAS_DO_LINK_DE_REPOR`) vive em convite-profissional, que o browser pode
 * carregar.
 */
export { HORAS_DO_LINK_DE_REPOR };

export async function emitirLinkDeRepor(p: {
  providerId: number;
  nome: string;
  email: string;
  baseUrl: string;
  pedidoPor: QuemPediu;
}): Promise<boolean> {
  const acesso = gerarTokenDeAcesso();
  // Sem milissegundos, como os outros prazos que vão à base e voltam.
  const expira = new Date(Math.floor((Date.now() + HORAS_DO_LINK_DE_REPOR * 3600_000) / 1000) * 1000);
  await guardarTokenDePalavraPasse(p.providerId, acesso.hash, expira);
  return enviarEmailDeRepor({
    para: p.email,
    nome: p.nome,
    token: acesso.token,
    baseUrl: p.baseUrl,
    horasDeValidade: HORAS_DO_LINK_DE_REPOR,
    pedidoPor: p.pedidoPor,
  });
}
