import { FORA_DO_PLANO, SERVICE_CATEGORIES, SERVICOS_PUBLICOS, type ServiceCategory } from "./service-categories";

/**
 * OS SERVIÇOS QUE A VITÓRIA OFERECE — os mesmos do site. 25-10-2026.
 *
 * A montagem de móveis e a jardinagem e limpeza de quintais saíram do site e
 * do simulador, e a manutenção da casa (reparações e remodelações) voltou —
 * decisões do dono no mesmo dia. A Vitória ainda oferecia as duas que saíram,
 * na lista numerada e no que mandava ao Gemini como opções, porque lia a
 * lista inteira (`SERVICE_CATEGORIES`) e não a pública.
 *
 * Passa a ler a pública, daqui: a lista numerada, a conversão do número no
 * serviço, as opções do modelo e a frase com que os avisos aos modelos dizem o
 * que a CLYON faz. Quando a lista do site mudar, a dela muda com ela.
 *
 * A lista inteira continua a dar o NOME dos serviços (os pedidos e os
 * profissionais antigos com montagem ou jardinagem têm de continuar a lê-lo).
 */
export const SERVICOS_DA_VITORIA: readonly ServiceCategory[] = SERVICOS_PUBLICOS;

/** Os ids pela ordem da lista numerada — o número N é o serviço `[N - 1]`. */
export const IDS_DA_LISTA: readonly string[] = SERVICOS_DA_VITORIA.map((c) => c.id);

function minuscula(rotulo: string): string {
  return rotulo.charAt(0).toLowerCase() + rotulo.slice(1);
}

function emFrase(nomes: string[], ultima: string): string {
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} ${ultima} ${nomes[nomes.length - 1]}`;
}

/**
 * «recolha de móveis, recolha de monos, recolha de entulho, esvaziamento de
 * casa, esvaziamento de apartamento, mudança e manutenção da casa» — o que a
 * CLYON faz, para os avisos aos modelos. Sem o «Outro serviço», que não é um
 * serviço, é a porta para o que não está na lista.
 */
export function servicosPorExtenso(): string {
  return emFrase(
    SERVICOS_DA_VITORIA.filter((c) => c.id !== "outro").map((c) => minuscula(c.label)),
    "e",
  );
}

/** «montagem e desmontagem de móveis nem jardinagem e limpeza de quintais» — o que não faz, de momento. */
export function foraDoPlanoPorExtenso(): string {
  return SERVICE_CATEGORIES.filter((c) => FORA_DO_PLANO.has(c.id))
    .map((c) => minuscula(c.label))
    .join(" nem ");
}

/** A manutenção da casa está na lista? — para os avisos que falam de reparações só enquanto ela lá estiver. */
export function fazManutencaoDaCasa(): boolean {
  return IDS_DA_LISTA.includes("manutencao_casa");
}
