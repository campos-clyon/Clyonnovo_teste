import { geocodificarMoradaDetalhado } from "./geocodificar";
import {
  distanciaEmLinhaRecta,
  pontoValido,
  FACTOR_DE_ESTRADA,
} from "./distancia-entre-pontos";

/**
 * Os campos que só um serviço tem, e sem os quais o preço sai errado.
 *
 * "Quando eu escolho mudanças o pedido deveria ser adaptado a isso, assim como
 * entulhos etc — cada material tem sua peculiaridade. Mudanças precisam de 2
 * endereços, o valor é por hora e km, sendo o mínimo de 3h."
 *
 * O motor de preços sabia disto desde sempre. Uma mudança são sete horas de
 * base, mais uma hora por cada ponta sem elevador acima do 2.º andar, mais meia
 * hora por acesso difícil em cada ponta, mais meia hora se o percurso passar
 * dos 30 km — e depois cobra-se por hora: três colaboradores a 70 €/h, com um
 * mínimo de três horas, ou seja 210 € s/IVA. Um entulho conta-se por sacos, e
 * um saco no chão dá mais 30% de trabalho do que um já ensacado.
 *
 * O que faltava era alguém lhe dar os números. O formulário do backoffice
 * mandava sempre os mesmos cinco campos, e uma mudança para o prédio ao lado
 * custava exactamente o mesmo que uma para o Porto.
 *
 * A FORMA É A DO SIMULADOR, de propósito: `destinationAddress`, `originAccess`,
 * `destinationAccess`, `movingDistance`, `entulhoState`. Um pedido registado ao
 * telefone e um pedido vindo do site têm de ser o mesmo pedido para quem os
 * lê a seguir — o motor, o painel antigo, o profissional.
 */

export type CorpoComCamposDoServico = {
  serviceType?: unknown;
  floor?: unknown;
  hasElevator?: unknown;
  parkingDistance?: unknown;
  moradaDestino?: unknown;
  localidadeDestino?: unknown;
  codigoPostalDestino?: unknown;
  andarDestino?: unknown;
  elevadorDestino?: unknown;
  estacionamentoDestino?: unknown;
  acessoDificilOrigem?: unknown;
  acessoDificilDestino?: unknown;
  entulhoEstado?: unknown;
  entulhoQuantidade?: unknown;
};

export type CamposDoServico = {
  /** Para juntar ao rawOrderJson — a forma que o simulador já usa. */
  paraOJson: Record<string, unknown>;
  /** Para juntar ao input do motor de preços. */
  paraOMotor: Record<string, unknown>;
  /** Km de origem a destino, quando é uma mudança e as duas foram localizadas. */
  percursoKm: number | null;
  /** O que falta para o preço não ser um palpite — para o ecrã dizer. */
  emFalta: string[];
};

const texto = (v: unknown, max = 200): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t.length > 0 ? t : null;
};

/**
 * Lê os campos próprios do serviço, localiza o destino quando é preciso, e
 * devolve tudo na forma que o resto do sistema já entende.
 *
 * Nada disto é obrigatório: um pedido apanhado ao telefone às pressas vale
 * mais registado com metade da informação do que perdido. O que fica é a lista
 * do que falta, para quem regista saber que o preço é um piso e não um preço.
 */
export async function camposDoServico(
  corpo: CorpoComCamposDoServico,
  origem: { lat: number; lng: number } | null,
): Promise<CamposDoServico> {
  const servico = texto(corpo.serviceType, 80);
  const paraOJson: Record<string, unknown> = {};
  const paraOMotor: Record<string, unknown> = {};
  const emFalta: string[] = [];
  let percursoKm: number | null = null;

  if (servico === "mudanca") {
    const moradaDestino = texto(corpo.moradaDestino, 300);
    const localidadeDestino = texto(corpo.localidadeDestino, 120);
    const codigoPostalDestino = texto(corpo.codigoPostalDestino, 20);

    // O acesso das duas pontas — cada uma vale uma hora, e a diferença entre
    // um segundo andar com elevador e um quinto sem ele são duas horas de
    // trabalho que ninguém estava a contar.
    const originAccess = {
      floor: texto(corpo.floor, 40) ?? undefined,
      hasElevator: texto(corpo.hasElevator, 40) ?? undefined,
      parkingDistance: texto(corpo.parkingDistance, 40) ?? undefined,
      difficultAccess: corpo.acessoDificilOrigem === true,
    };
    const destinationAccess = {
      floor: texto(corpo.andarDestino, 40) ?? undefined,
      hasElevator: texto(corpo.elevadorDestino, 40) ?? undefined,
      parkingDistance: texto(corpo.estacionamentoDestino, 40) ?? undefined,
      difficultAccess: corpo.acessoDificilDestino === true,
    };

    paraOJson.originAccess = originAccess;
    paraOJson.destinationAccess = destinationAccess;
    paraOMotor.originAccess = originAccess;
    paraOMotor.destinationAccess = destinationAccess;

    if (!moradaDestino) {
      emFalta.push("a morada de destino");
    } else {
      const geo = await geocodificarMoradaDetalhado(
        moradaDestino,
        codigoPostalDestino ?? "",
        localidadeDestino ?? "",
      );
      const destino = geo.coords;
      paraOJson.destinationAddress = {
        formattedAddress: geo.coords?.moradaNormalizada ?? moradaDestino,
        lat: destino?.lat ?? null,
        lng: destino?.lng ?? null,
        city: localidadeDestino,
        postalCode: codigoPostalDestino,
      };

      /*
       * O percurso em linha recta, com a folga de estrada de sempre.
       *
       * Não é o percurso real do Google. É de propósito: a plataforma inteira
       * mede assim — é assim que se decide quem alcança o trabalho — e um
       * segundo modo de medir daria dois números diferentes para a mesma
       * mudança, conforme quem perguntasse. Para o que o motor faz com isto
       * (meia hora acima de 30 km, e o combustível a 0,50 €/km) a folga chega.
       */
      if (pontoValido(origem) && pontoValido(destino)) {
        percursoKm =
          Math.round(distanciaEmLinhaRecta(origem, destino) * FACTOR_DE_ESTRADA * 10) / 10;
        const movingDistance = { distanceKm: percursoKm, isEstimate: true };
        paraOJson.movingDistance = movingDistance;
        paraOMotor.movingDistance = movingDistance;
      } else {
        emFalta.push(
          destino ? "as coordenadas da origem" : "as coordenadas do destino",
        );
      }
    }
  }

  if (servico === "recolha_entulho") {
    const estado = texto(corpo.entulhoEstado, 40);
    // Só os dígitos: quem escreve "30 sacos" quer dizer 30.
    const quantidade = texto(corpo.entulhoQuantidade, 20)?.replace(/[^\d]/g, "") || null;

    if (estado) {
      paraOJson.entulhoState = estado;
      paraOMotor.entulhoState = estado;
    } else {
      emFalta.push("o estado do entulho");
    }
    if (quantidade) {
      paraOJson.entulhoQuantidade = quantidade;
      paraOMotor.entulhoQuantidade = quantidade;
    } else {
      emFalta.push("o número de sacos");
    }
  }

  return { paraOJson, paraOMotor, percursoKm, emFalta };
}
