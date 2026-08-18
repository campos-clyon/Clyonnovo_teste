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
  avisados: number;
  falhados: number;
  candidatos: number;
  /** Porque é que os restantes ficaram de fora. */
  motivos: Record<string, number>;
};

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

export async function distribuirPedido(
  pedido: PedidoParaDistribuicao,
): Promise<ResultadoDaDistribuicao> {
  const candidatos = await profissionaisActivos();

  const trabalho =
    pedido.lat != null && pedido.lng != null ? { lat: pedido.lat, lng: pedido.lng } : null;

  // A distância é por profissional: depende da base dele, não do pedido. Quem
    // não tiver coordenadas fica com `null` e a regra cai nas zonas.
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
      distanciaKm: null,
      city: pedido.city,
    },
    comDistancia.filter((c) => !elegiveis.includes(c)).map((c) => c.profissional),
  );

  const recebe = quantoRecebe(pedido.valorDesejadoCliente);

  const envios = await Promise.all(
    elegiveis.map(async (c) => {
      if (!c.profissional.email) return false;

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
        });
        token = acesso.token;
      } catch (err) {
        console.error(
          "[distribuir] não criou negociação para o profissional",
          c.profissional.id,
          err,
        );
        return false;
      }

      return avisarProfissional({
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
    }),
  );

  const avisados = envios.filter(Boolean).length;

  return {
    avisados,
    falhados: envios.length - avisados,
    candidatos: candidatos.length,
    motivos: motivos as unknown as Record<string, number>,
  };
}
