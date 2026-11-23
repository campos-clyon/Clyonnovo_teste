/**
 * A mensagem que abre o WhatsApp a partir do painel.
 *
 * Era esta, para toda a gente:
 *
 *   "Olá Amelia vaz, a CLYON está a contactar relativamente ao seu pedido
 *    #186 de recolha_moveis."
 *
 * Três problemas num só sítio. O nome vem como foi escrito no formulário,
 * com apelido e tudo — ninguém fala assim. O serviço aparece com o nome
 * interno da base de dados, `recolha_moveis`, que é a CLYON a mostrar ao
 * cliente as suas tripas. E não diz nada do que já sabemos: a morada está no
 * pedido, a urgência está no pedido, as fotos que faltam estão no pedido.
 *
 * O resultado é que a pessoa tinha de escrever tudo à mão a seguir — foi o
 * que aconteceu com a Amélia: à mensagem automática seguiram-se logo duas
 * escritas à pressa a pedir imagens.
 *
 * Esta versão parte do que foi recolhido. Cada frase só aparece se houver
 * informação para ela; nada é inventado nem preenchido com "não indicado".
 *
 * d91 (23-11-2026, 3.20): «Para lhe dar um valor certo» e «É com elas que
 * acertamos no volume e no preço» punham a CLYON a orçar, e a linha do preço
 * era do modelo antigo. Quem dá o preço são os parceiros; a linha do preço
 * saiu (para mandar um valor, o orçamento curto da Mesa). E não começa por
 * «Aqui é a equipa da CLYON.»: é a marca do «Pedir o que falta» (d86).
 */

import { servicoEmPalavras } from "@/lib/servico-em-palavras";

const QUANDO: Record<string, string> = {
  today:     "para hoje",
  tomorrow:  "para amanhã",
  this_week: "para esta semana",
  next_week: "para a próxima semana",
  flexible:  "sem data marcada",
};

/**
 * Só o primeiro nome, com a primeira letra em maiúscula.
 *
 * "Amelia vaz" → "Amelia". Tratar alguém pelo nome completo numa mensagem
 * de WhatsApp soa a cobrança, não a atendimento. Os acentos que faltam não os
 * inventamos — escrever "Amélia" quando ela escreveu "Amelia" é corrigir a
 * pessoa, e não é isso que aqui se faz.
 */
export function primeiroNome(nome: string | null | undefined): string {
  const limpo = (nome ?? "").trim();
  if (!limpo) return "";
  const primeiro = limpo.split(/\s+/)[0];
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1);
}

/**
 * A lista vive em `servico-em-palavras.ts`, e não aqui.
 *
 * Esta era uma segunda lista escrita à mão, já dessincronizada da do produto:
 * faltava-lhe `montagem_moveis`, e por isso quem pedia montagem via o
 * identificador da base a sair pela frente — «montagem moveis», sem acento e
 * com o traço baixo trocado por um espaço. Uma lista escrita duas vezes acaba
 * sempre assim; a primeira a ficar para trás é aquela para onde ninguém olha.
 */
export function rotuloServico(tipo: string | null | undefined): string {
  return servicoEmPalavras(tipo);
}

export type DadosMensagem = {
  id: number | string;
  contactName?: string | null;
  serviceType?: string | null;
  address?: string | null;
  city?: string | null;
  urgency?: string | null;
  /** Quantas fotos o cliente escolheu e não chegaram — pedimo-las de volta. */
  fotosNaoEnviadas?: number;
  /** Quantas fotos temos mesmo. Sem nenhuma, vale a pena pedir. */
  fotosRecebidas?: number;
  /**
   * O preço aprovado (o `precoFinal` da base). Desde a d91 (23-11-2026) a
   * mensagem já não o diz — quem dá o preço são os parceiros, e um valor
   * manda-se pelo orçamento curto da Mesa. Fica no tipo para os ecrãs que o passam.
   */
  precoFinal?: string | number | null;
  /** Quando o pedido nasceu. Sem uso desde a d91 (era para o modelo do preço). */
  pedidoCriadoEm?: Date | string | null;
};

/**
 * Monta a mensagem. Devolve texto simples — quem chama trata de o codificar
 * para o URL.
 */
export function mensagemWhatsApp(d: DadosMensagem): string {
  const nome = primeiroNome(d.contactName);
  const servico = rotuloServico(d.serviceType);
  const linhas: string[] = [];

  linhas.push(nome ? `Olá ${nome}, é da equipa da CLYON.` : "Olá, é da equipa da CLYON.");

  // O que recebemos, com o que sabemos dele
  const onde = [d.address?.trim(), d.city?.trim()]
    .filter((v): v is string => Boolean(v))
    // A morada já costuma trazer a localidade lá dentro; repeti-la fica mal.
    .filter((v, i, arr) => i === 0 || !arr[0].toLowerCase().includes(v.toLowerCase()));
  const quando = d.urgency ? QUANDO[d.urgency] : undefined;

  let recebemos = `Recebemos o seu pedido de ${servico} (#${d.id})`;
  if (onde.length > 0) recebemos += `, em ${onde.join(", ")}`;
  if (quando) recebemos += `, ${quando}`;
  linhas.push(`${recebemos}.`);

  // Fotos: o que faz a diferença entre um orçamento certo e uma surpresa no dia
  const perdidas = d.fotosNaoEnviadas ?? 0;
  const recebidas = d.fotosRecebidas ?? 0;
  if (perdidas > 0) {
    linhas.push(
      `Reparámos que tentou enviar ${perdidas} foto${perdidas === 1 ? "" : "s"} que não chegaram até nós. ` +
      `Pode enviá-las por aqui? É com elas que os parceiros lhe dão um preço certo e sem surpresas no dia.`,
    );
  } else if (recebidas === 0) {
    linhas.push(
      "Para os parceiros lhe darem um preço certo e sem surpresas no dia, pode enviar-nos por aqui 2 ou 3 fotografias do que é para levar?",
    );
  }

  return linhas.join("\n\n");
}
