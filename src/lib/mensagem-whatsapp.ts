/**
 * A mensagem que abre o WhatsApp a partir do painel.
 *
 * Era esta, para toda a gente:
 *
 *   "Olá Lucilia reis, a CLYON está a contactar relativamente ao seu pedido
 *    #186 de recolha_moveis."
 *
 * Três problemas num só sítio. O nome vem como foi escrito no formulário,
 * com apelido e tudo — ninguém fala assim. O serviço aparece com o nome
 * interno da base de dados, `recolha_moveis`, que é a CLYON a mostrar ao
 * cliente as suas tripas. E não diz nada do que já sabemos: a morada está no
 * pedido, a urgência está no pedido, as fotos que faltam estão no pedido.
 *
 * O resultado é que a pessoa tinha de escrever tudo à mão a seguir — foi o
 * que aconteceu com a Lucília: à mensagem automática seguiram-se logo duas
 * escritas à pressa a pedir imagens.
 *
 * Esta versão parte do que foi recolhido. Cada frase só aparece se houver
 * informação para ela; nada é inventado nem preenchido com "não indicado".
 */

const SERVICOS: Record<string, string> = {
  recolha_moveis:           "recolha de móveis",
  recolha_monos:            "recolha de monos",
  recolha_entulho:          "recolha de entulho",
  esvaziamento_casa:        "esvaziamento de casa",
  esvaziamento_apartamento: "esvaziamento de apartamento",
  mudanca:                  "mudança",
  jardinagem:               "jardinagem",
  manutencao_casa:          "manutenção",
  outro:                    "serviço",
};

const QUANDO: Record<string, string> = {
  today:     "para hoje",
  tomorrow:  "para amanhã",
  this_week: "para esta semana",
  flexible:  "sem data marcada",
};

/**
 * Só o primeiro nome, com a primeira letra em maiúscula.
 *
 * "Lucilia reis" → "Lucilia". Tratar alguém pelo nome completo numa mensagem
 * de WhatsApp soa a cobrança, não a atendimento. Os acentos que faltam não os
 * inventamos — escrever "Lucília" quando ela escreveu "Lucilia" é corrigir a
 * pessoa, e não é isso que aqui se faz.
 */
export function primeiroNome(nome: string | null | undefined): string {
  const limpo = (nome ?? "").trim();
  if (!limpo) return "";
  const primeiro = limpo.split(/\s+/)[0];
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1);
}

export function rotuloServico(tipo: string | null | undefined): string {
  if (!tipo) return "serviço";
  return SERVICOS[tipo] ?? tipo.replace(/_/g, " ");
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
  precoFinalIva?: string | number | null;
};

/**
 * Monta a mensagem. Devolve texto simples — quem chama trata de o codificar
 * para o URL.
 */
export function mensagemWhatsApp(d: DadosMensagem): string {
  const nome = primeiroNome(d.contactName);
  const servico = rotuloServico(d.serviceType);
  const linhas: string[] = [];

  linhas.push(nome ? `Olá ${nome}, é da CLYON.` : "Olá, é da CLYON.");

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
      `Pode enviá-las por aqui? É com elas que acertamos no volume e no preço.`,
    );
  } else if (recebidas === 0) {
    linhas.push(
      "Para lhe dar um valor certo, pode enviar-nos aqui algumas fotos do que é para retirar? " +
      "É o que nos permite acertar no volume e evitar surpresas no dia.",
    );
  }

  // Valor, só quando já está fechado
  const preco = Number(d.precoFinalIva ?? 0);
  if (preco > 0) {
    linhas.push(`O orçamento é de ${preco.toFixed(2).replace(".", ",")} € com IVA.`);
  }

  return linhas.join("\n\n");
}
