import { Resend } from "resend";
import { e } from "./escapar-html";
import { urlDeAccao } from "./url-do-site";
import { BUSINESS_EMAIL } from "./seo-data";

/**
 * O AVISO DE QUE CHEGOU UMA CANDIDATURA — para nós, não para ele.
 *
 * PORQUE É QUE ISTO PRECISA DE EXISTIR
 *
 * Porque o que ele substitui fazia barulho. O botão «Tornar-me parceiro» abria
 * uma conversa de WhatsApp, e o telemóvel de quem atende tocava: a candidatura
 * chegava a uma pessoa no segundo em que era feita.
 *
 * Depois da mudança, uma candidatura é uma linha na tabela `providers` e mais
 * nada. Não toca em lado nenhum. Quem se candidatou fica à espera de uma
 * resposta que só chega se alguém, por iniciativa própria, se lembrar de abrir
 * o painel — e a metade do pedido que diz «nós entramos em contacto» depende
 * inteiramente disso. Sem este email, o caminho novo seria pior do que o
 * antigo, apesar de mais bem arrumado.
 *
 * O QUE VAI LÁ DENTRO é só o que decide se vale a pena abrir já o painel: quem
 * é, onde está, como se lhe fala, o que diz que faz. Os dados fiscais não vão
 * — estão no painel, e um email não é sítio para eles andarem.
 *
 * E UMA HONESTIDADE: isto não é o toque do WhatsApp. É um email, e um email
 * espera que alguém o abra. Mandar mesmo uma mensagem para o telemóvel exigia
 * um template aprovado pela Meta (fora da janela de 24 horas a Cloud API não
 * deixa iniciar conversa de outra forma), e isso é uma decisão de negócio, não
 * uma linha de código.
 */

export type CandidaturaParaAvisar = {
  nome: string;
  cidade: string;
  email: string;
  telefone: string;
  categorias: string[];
  /**
   * Ele DECLAROU que emite guia. A rota grava sempre «por verificar», e a
   * palavra tem de ser esta — «declarou», nunca «tem» — porque quem lê o email
   * é quem vai ter de o confirmar.
   */
  declarouGuia: boolean;
  /** Veio pelo link de um convite nosso, ou apareceu pelo site. */
  porConvite: boolean;
};

/**
 * Um assunto de email não pode ter mudanças de linha.
 *
 * O nome e a cidade vêm de um formulário público: um `\n` no meio deles
 * fecha o cabeçalho `Subject:` e abre outro à escolha de quem escreveu. É
 * injecção de cabeçalhos, e o remédio é uma linha.
 */
function assuntoSeguro(texto: string): string {
  return texto.replace(/[\r\n]+/g, " ").trim().slice(0, 160);
}

export async function avisarCandidaturaNova(c: CandidaturaParaAvisar): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn("[email-candidatura] RESEND_API_KEY_clyonsite em falta — aviso não enviado.");
    return false;
  }

  /*
   * O assunto distingue a origem, e é o que se lê sem abrir.
   *
   * «Já falei com esta pessoa» e «esta apareceu do nada» pedem trabalho
   * diferente: a primeira é confirmar, a segunda é verificar. Saber qual é
   * antes de abrir poupa a abertura.
   */
  const assunto = assuntoSeguro(
    c.porConvite
      ? `Inscrição por convite: ${c.nome} (${c.cidade})`
      : `Candidatura nova: ${c.nome} (${c.cidade})`,
  );

  /*
   * O link vai SEM a chave do MVP.
   *
   * `/admin` é protegido por sessão de administrador, não pela chave — pô-la
   * aqui era espalhar um segredo por caixas de correio sem ele sequer servir
   * para abrir a porta que este link abre.
   */
  const linkDoPainel = `${urlDeAccao()}/admin?section=profissionais`;

  const servicos = c.categorias.length > 0 ? c.categorias.join(", ") : "não indicou";

  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0B1929">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0891b2">
        ${c.porConvite ? "Inscrição por convite" : "Candidatura espontânea"}
      </p>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:700">${e(c.nome)}</h1>

      <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.6">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Onde</td><td>${e(c.cidade)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Telefone</td><td><a href="tel:${e(c.telefone)}" style="color:#0891b2">${e(c.telefone)}</a></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Email</td><td><a href="mailto:${e(c.email)}" style="color:#0891b2">${e(c.email)}</a></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top">Serviços</td><td>${e(servicos)}</td></tr>
      </table>

      ${
        c.declarouGuia
          ? `<p style="margin:16px 0 0;padding:12px;border-radius:10px;background:#fef3c7;font-size:13px;line-height:1.6;color:#78350f">
               <strong>Declarou</strong> que emite guia de transporte. O número entra sempre por
               verificar — confirmar o registo é trabalho de uma pessoa.
             </p>`
          : ""
      }

      <p style="margin:24px 0 0">
        <a href="${linkDoPainel}" style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px">
          Abrir no painel
        </a>
      </p>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#64748b">
        Enquanto não for aprovado, ele não entra na conta nem recebe pedidos.
      </p>
    </div>
  `;

  try {
    const resend = new Resend(chave);
    await resend.emails.send({
      from: "CLYON <noreply@clyon.pt>",
      to: BUSINESS_EMAIL,
      replyTo: c.email,
      subject: assunto,
      html,
    });
    return true;
  } catch (err) {
    console.error("[email-candidatura] falhou:", err);
    return false;
  }
}
