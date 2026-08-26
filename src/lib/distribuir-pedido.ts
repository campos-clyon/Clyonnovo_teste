import { profissionaisActivos, criarNegociacao, type ProfissionalNaBase } from "./db";
import { avaliarElegibilidade, motivosAgregados } from "./profissional-elegivel";
import { distanciaParaElegibilidade } from "./distancia-entre-pontos";
import { avisarProfissional } from "./email-profissional";
import { TAXA_PROFISSIONAL } from "./taxas-plataforma";
import { gerarTokenDeAcesso } from "./pedido-acesso";
import { negociacaoNova } from "./negociacao";

/**
 * Levar um pedido a quem o pode fazer.
 *
 * Junta três peças que existiam separadas e não se falavam: a regra de
 * elegibilidade, o cálculo de distância à base de cada profissional, e o
 * email. Nenhuma delas decide sozinha — a regra decide, isto executa.
 *
 * O que sai daqui para o profissional é montado campo a campo, e não a partir
 * da linha da base. É a mesma razão de `vistaDoProfissional` existir: o valor
 * máximo e a morada exacta não podem sair, e uma lista explícita de campos é
 * a única forma de isso continuar verdade quando a tabela crescer.
 */

export type PedidoParaDistribuicao = {
  id: number;
  serviceType: string | null;
  description: string | null;
  city: string | null;
  urgency: string | null;
  quantidadeDeFotos: number;
  valorDesejadoCliente: number | null;
  precisaFatura: boolean;
  precisaGuiaTransporte: boolean;
  /** Coordenadas do trabalho, quando o cliente escolheu a morada na pesquisa. */
  lat: number | null;
  lng: number | null;
  /** O endereço deste deployment, para os links do email. */
  baseUrl?: string;
};

export type ResultadoDaDistribuicao = {
  /** Emails que sairam. */
  avisados: number;
  /**
   * Negociacoes criadas — ou seja, a quantos profissionais o trabalho chegou
   * de facto, esteja o email de pe ou nao.
   *
   * Isto existia como um numero so, `avisados`, que contava emails. Se a
   * negociacao era criada e o email falhava, o historico dizia "0
   * profissional(is) avisado(s)" — e quem lesse concluia que o pedido nao
   * tinha chegado a ninguem. Foi o que aconteceu ao #205: a negociacao #9 foi
   * criada, o Fred tinha o trabalho no painel, e as tres linhas do historico
   * diziam zero.
   *
   * Sao duas coisas diferentes e falham por razoes diferentes: uma negociacao
   * falha por regra de elegibilidade, um email falha por Resend. Contadas
   * juntas, a segunda esconde a primeira.
   */
  receberam: number;
  falhados: number;
  candidatos: number;
  /** Porque é que os restantes ficaram de fora. */
  motivos: Record<string, number>;
};

/**
 * O que aconteceu na distribuicao, em portugues, para o historico do pedido.
 *
 * Estava escrita a mao em tres sitios — promover, redistribuir e o simulador —
 * e os tres diziam a mesma coisa errada: "N profissional(is) avisado(s)",
 * contando emails e chamando-lhes chegadas. Um email falhado passava a ler-se
 * como "nao chegou a ninguem", que e a conclusao oposta da verdadeira.
 *
 * O historico do pedido e o que responde no dia em que alguem pergunta porque
 * e que o trabalho nao andou. Tem de distinguir as duas avarias, porque se
 * corrigem em sitios diferentes: nao chegar e a regra de elegibilidade, nao
 * avisar e o email.
 */
export function resumoDaDistribuicao(r: ResultadoDaDistribuicao): string {
  if (r.receberam === 0) {
    return (
      `NAO chegou a nenhum profissional (${r.candidatos} activos). ` +
      `Motivos: ${JSON.stringify(r.motivos)}`
    );
  }
  const base = `Chegou a ${r.receberam} profissional(is) de ${r.candidatos} activos`;
  if (r.avisados >= r.receberam) return `${base} — todos avisados por email.`;
  return (
    `${base}, mas so ${r.avisados} recebeu(ram) o email. ` +
    `${r.receberam - r.avisados} tem o trabalho no painel e NAO foi avisado.`
  );
}

/**
 * Quanto o profissional recebe se fechar pelo valor que o cliente pediu.
 *
 * Mostra-se sempre o líquido, nunca o bruto. Ver a decisão de 16-08-2026: um
 * número só, como na Vinted — mostrar 200 retidos e 190 disponíveis levantava
 * a pergunta "onde foram os 10 €".
 */
export function quantoRecebe(valor: number | null): number | null {
  if (valor == null || !Number.isFinite(valor)) return null;
  return Math.round(valor * (1 - TAXA_PROFISSIONAL) * 100) / 100;
}

/**
 * A quem é que este pedido chegaria — sem mandar nada a ninguém.
 *
 * Existe para o backoffice poder mostrar o alcance ANTES de enviar. Um pedido
 * registado ao telefone é escrito à mão, e a morada, a categoria ou a zona
 * podem estar erradas de maneiras que só se descobrem quando não chega a
 * ninguém. Descobri-lo depois de carregar em enviar é tarde: as negociações
 * ficam criadas e os emails já saíram.
 *
 * É a MESMA avaliação que a distribuição faz — chama as mesmas funções, na
 * mesma ordem. Uma pré-visualização calculada à parte seria uma segunda
 * opinião, e no dia em que discordasse da primeira ninguém saberia qual valia.
 */
export async function avaliarAlcance(pedido: {
  serviceType: string | null;
  precisaFatura: boolean;
  precisaGuiaTransporte: boolean;
  city: string | null;
  lat: number | null;
  lng: number | null;
}): Promise<{
  elegiveis: Array<{ id: number; nome: string; distanciaKm: number | null }>;
  candidatos: number;
  motivos: Record<string, number>;
}> {
  const candidatos = await profissionaisActivos();
  const trabalho =
    pedido.lat != null && pedido.lng != null ? { lat: pedido.lat, lng: pedido.lng } : null;

  const comDistancia = candidatos.map((p) => ({
    profissional: p,
    distanciaKm: distanciaParaElegibilidade(
      p.baseLat != null && p.baseLng != null ? { lat: p.baseLat, lng: p.baseLng } : null,
      trabalho,
    ),
  }));

  const elegiveis: Array<{ id: number; nome: string; distanciaKm: number | null }> = [];
  const foraDeAlcance: Array<{ profissional: ProfissionalNaBase; distanciaKm: number | null }> =
    [];
  for (const c of comDistancia) {
    const r = avaliarElegibilidade(
      {
        serviceType: pedido.serviceType,
        precisaFatura: pedido.precisaFatura,
        precisaGuiaTransporte: pedido.precisaGuiaTransporte,
        distanciaKm: c.distanciaKm,
        city: pedido.city,
      },
      c.profissional,
    );
    if (r.elegivel) {
      elegiveis.push({
        id: c.profissional.id,
        nome: c.profissional.name,
        distanciaKm: c.distanciaKm,
      });
    } else {
      foraDeAlcance.push(c);
    }
  }

  const motivos = motivosAgregados(
    {
      serviceType: pedido.serviceType,
      precisaFatura: pedido.precisaFatura,
      precisaGuiaTransporte: pedido.precisaGuiaTransporte,
      city: pedido.city,
    },
    foraDeAlcance,
  );

  return { elegiveis, candidatos: candidatos.length, motivos: motivos as unknown as Record<string, number> };
}

export async function distribuirPedido(
  pedido: PedidoParaDistribuicao,
  /**
   * `reabrir` faz o pedido voltar do zero: quem já tinha negociação recebe-a
   * REPOSTA — propostas antigas fora, valor de partida novo, link novo — em
   * vez de a manter como estava. É o caminho de quem registou o pedido com o
   * valor errado e precisa que ele volte a circular como se fosse de hoje.
   */
  { reabrir = false }: { reabrir?: boolean } = {},
): Promise<ResultadoDaDistribuicao> {
  const candidatos = await profissionaisActivos();

  const trabalho =
    pedido.lat != null && pedido.lng != null ? { lat: pedido.lat, lng: pedido.lng } : null;

  // A distância é por profissional: depende da base dele, não do pedido. Sem
  // coordenadas fica `null`, e aí ninguém é elegível: não se pode dizer que
  // alguém está dentro de um raio que nunca foi medido.
  const comDistancia = candidatos.map((p) => ({
    profissional: p,
    distanciaKm: distanciaParaElegibilidade(
      p.baseLat != null && p.baseLng != null ? { lat: p.baseLat, lng: p.baseLng } : null,
      trabalho,
    ),
  }));

  const elegiveis: Array<{ profissional: ProfissionalNaBase; distanciaKm: number | null }> = [];
  for (const c of comDistancia) {
    const r = avaliarElegibilidade(
      {
        serviceType: pedido.serviceType,
        precisaFatura: pedido.precisaFatura,
        precisaGuiaTransporte: pedido.precisaGuiaTransporte,
        distanciaKm: c.distanciaKm,
        city: pedido.city,
      },
      c.profissional,
    );
    if (r.elegivel) elegiveis.push(c);
  }

  // Contado com a distância de cada um, não com uma distância única — senão o
  // diagnóstico dizia "fora de alcance" a quem estava perto.
  const motivos = motivosAgregados(
    {
      serviceType: pedido.serviceType,
      precisaFatura: pedido.precisaFatura,
      precisaGuiaTransporte: pedido.precisaGuiaTransporte,
      city: pedido.city,
    },
    // Todos: a contagem salta os elegíveis sozinha. O filtro que aqui estava
    // comparava objectos de formas diferentes e nunca excluía ninguém — dava
    // o número certo por acaso, e escondia a intenção.
    comDistancia,
  );

  const recebe = quantoRecebe(pedido.valorDesejadoCliente);

  const envios = await Promise.all(
    elegiveis.map(async (c) => {
      // Sem email nao ha como avisar — e sem aviso nao vale a pena criar a
      // negociacao, porque ele nunca saberia que ela existe.
      if (!c.profissional.email) return { recebeu: false, avisado: false };

      // Uma negociação por profissional, cada uma com o seu link. O primeiro
      // lance já está na mesa: é o valor que o cliente pediu. Sem isto, a
      // negociação começava vazia e alguém tinha de dar o primeiro passo sem
      // saber sobre o quê.
      let token: string;
      try {
        const acesso = gerarTokenDeAcesso();
        await criarNegociacao({
          pedidoId: pedido.id,
          providerId: c.profissional.id,
          acessoTokenHash: acesso.hash,
          acessoTokenExpiraEm: acesso.expiraEm,
          propostasJson: JSON.stringify(
            negociacaoNova(pedido.valorDesejadoCliente ?? 0, new Date()).propostas,
          ),
        }, { reabrir });
        token = acesso.token;
      } catch (err) {
        console.error(
          "[distribuir] não criou negociação para o profissional",
          c.profissional.id,
          err,
        );
        return { recebeu: false, avisado: false };
      }

      // A negociacao ja esta criada a este ponto: o trabalho CHEGOU. O email e
      // o aviso, e falha por razoes suas.
      const avisado = await avisarProfissional({
        paraEmail: c.profissional.email,
        paraNome: c.profissional.name,
        pedidoId: pedido.id,
        token,
        baseUrl: pedido.baseUrl,
        serviceType: pedido.serviceType,
        zona: pedido.city,
        urgencia: pedido.urgency,
        descricao: pedido.description,
        quantidadeDeFotos: pedido.quantidadeDeFotos,
        valorDesejadoCliente: pedido.valorDesejadoCliente,
        recebeLiquido: recebe,
        distanciaKm: c.distanciaKm,
        precisaFatura: pedido.precisaFatura,
        precisaGuiaTransporte: pedido.precisaGuiaTransporte,
      });

      return { recebeu: true, avisado };
    }),
  );

  const receberam = envios.filter((e) => e.recebeu).length;
  const avisados = envios.filter((e) => e.avisado).length;

  return {
    avisados,
    receberam,
    falhados: envios.length - avisados,
    candidatos: candidatos.length,
    motivos: motivos as unknown as Record<string, number>,
  };
}
