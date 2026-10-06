/**
 * COMO É QUE A CLYON RECOLHE ENTULHO — E O QUE NUNCA FEZ.
 *
 * O site prometia contentores. Prometia-os em Lisboa («fornecemos contentores
 * de vários tamanhos»), no Seixal («podem deixar contentor em Corroios?
 * Sim»), em Almada, em Monte Abraão, e em Setúbal com medidas e prazos:
 * «contentores de 3 m³, 5 m³ e 8 m³, entregamos no local, fica 3 a 7 dias, o
 * preço inclui entrega, aluguer e recolha». Também prometia recolha «a
 * granel» e sacos big bag.
 *
 * Nada disso existe. Não há contentores, não há aluguer de contentores, e não
 * há big bags: **a recolha de entulho é feita em sacos de obra até 25 kg,
 * carregados à mão para a carrinha do profissional**.
 *
 * PORQUE É QUE ISTO É UM FICHEIRO E NÃO FORAM TRINTA EDIÇÕES DE TEXTO
 *
 * Porque foram escritas trinta vezes e voltariam a sê-lo. As páginas de
 * cidade são conteúdo que cresce — cada cidade nova copia a anterior — e o
 * contentor entrou exactamente assim: alguém escreveu-o uma vez para Lisboa e
 * ele multiplicou-se por cinco cidades sem ninguém decidir nada. Com as
 * frases num sítio só, uma cidade nova nasce a dizer a verdade.
 *
 * E HÁ UM TESTE A GUARDAR ISTO. `sem-contentores.test.ts` procura as
 * promessas antigas em todo o código de produção e falha se alguma voltar.
 * Não é zelo a mais: a frase que se apagou hoje é a que alguém reescreve daqui
 * a três meses, de boa-fé, por lhe parecer que descreve o serviço.
 *
 * SE UM DIA HOUVER CONTENTORES, isto não se apaga — ganha um interruptor,
 * como o `A_PLATAFORMA_COBRA` do pagamento. Até lá, o que aqui está é o que
 * acontece mesmo.
 */

/** O limite de cada saco. É o que uma pessoa carrega escada abaixo sem se magoar. */
export const PESO_MAXIMO_DO_SACO_KG = 25;

/** Quantos sacos de 25 kg fazem, mais ou menos, um metro cúbico de entulho. */
export const SACOS_POR_METRO_CUBICO = 40;

/**
 * UM BIG BAG SÃO 38 SACOS — 06-10-2026, regra do dono.
 *
 * «Um big bag equivale a 38 sacos, ou seja 22 deveria ser 836.» O pedido #414
 * chegou pelo WhatsApp com «22 bigbags» e ficou com 22 SACOS: a leitura não
 * conhecia a palavra e ficava só com o número. Havia ainda três ecrãs com a
 * conta feita à mão a 42. Fica uma regra, aqui, e todos a usam.
 *
 * Não muda o que se recolhe: continua a ser em sacos, e o profissional ensaca
 * no local. O big bag é só a medida que o cliente usa.
 */
export const SACOS_POR_BIG_BAG = 38;

/** Quantos sacos são estes big bags. */
export function sacosDeBigBags(bigBags: number): number {
  const n = Math.round(bigBags * SACOS_POR_BIG_BAG);
  return n > 0 ? n : 0;
}

/**
 * A frase que descreve o serviço. Uma linha, para caber num parágrafo de
 * qualquer página sem se dar por ela.
 */
export const COMO_SE_RECOLHE_ENTULHO =
  `A recolha é feita em sacos de obra até ${PESO_MAXIMO_DO_SACO_KG} kg, ` +
  "carregados à mão para a carrinha do profissional.";

/**
 * O que a CLYON NÃO faz, dito sem rodeios.
 *
 * Aparece nas páginas de entulho e nas respostas às perguntas sobre
 * contentores. Dizer «não» a quem procura contentor é melhor do que calar: a
 * pessoa que só quer um contentor descobre-o em dez segundos em vez de
 * descobrir na véspera da obra, e a que não se importa com o meio fica.
 */
export const NAO_HA_CONTENTORES =
  "A CLYON não fornece nem aluga contentores, e não faz recolha a granel.";

/**
 * A resposta a «fornecem contentor?», inteira.
 *
 * A pergunta é feita em todas as cidades e é procurada no Google. Continua a
 * ser respondida — com um não, e com o que existe em vez disso.
 */
export const RESPOSTA_SOBRE_CONTENTORES =
  `${NAO_HA_CONTENTORES} ${COMO_SE_RECOLHE_ENTULHO} ` +
  "Se o entulho estiver solto no chão, o profissional ensaca-o no local. " +
  "Para obras que só se resolvem com contentor, o caminho é uma empresa de aluguer de contentores.";

/** Uma referência de volume em sacos, para quem pensa em metros cúbicos. */
export function sacosDeUmMetroCubico(metrosCubicos: number): number {
  const n = Math.round(metrosCubicos * SACOS_POR_METRO_CUBICO);
  return n > 0 ? n : 0;
}

/**
 * QUANTOS SACOS, A PARTIR DO QUE A PESSOA ESCREVEU.
 *
 * *«A leitura indicou 43 sacos, será correcto?»* — a Miriam à Catarina, a
 * 29-09-2026, sobre um entulho que ela tinha descrito como «diria que 4m3».
 *
 * Lia-se tirando tudo o que não fosse dígito: «4m3» ficava «43». Um volume de
 * quatro metros cúbicos — uns 160 sacos — virava 43, e o preço de um
 * profissional saía com um quarto do trabalho lá dentro. «30 sacos» dava 30
 * por sorte, porque não havia outro número na frase.
 *
 * Agora lê-se a UNIDADE:
 *   · metros cúbicos («4m3», «4 m³», «4,5 metros cúbicos») convertem-se pela
 *     regra da casa, `SACOS_POR_METRO_CUBICO`;
 *   · «30 sacos», ou um número sozinho, são sacos;
 *   · um intervalo («20 a 30 sacos») conta pelo maior — quem avalia no local
 *     prefere encontrar menos do que lhe disseram do que mais.
 *
 * Sem número nenhum («não sei», «uma carrinha cheia») devolve `null`: não se
 * inventa uma quantidade. O que a pessoa escreveu volta sempre em `dito`, para
 * ficar à vista de quem vai fazer o trabalho.
 */
export function lerQuantidadeDeEntulho(
  texto: string | null | undefined,
): { sacos: number | null; dito: string; emMetrosCubicos: boolean } {
  const dito = (texto ?? "").trim();
  const t = dito
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const numero = (s: string) => Number(s.replace(",", "."));

  // Big bags — «22 bigbags», «2 big bags», «3 big-bag». Antes dos m³ e dos
  // sacos: «22 bigbags» não pode ler-se como 22 sacos (06-10-2026).
  const bigBag = t.match(/(\d+(?:[.,]\d+)?)\s*(?:big[\s-]?bags?|bigbags?|bags?\b)/);
  if (bigBag) {
    const n = numero(bigBag[1]);
    return {
      sacos: Number.isFinite(n) && n > 0 ? sacosDeBigBags(n) : null,
      dito,
      emMetrosCubicos: true,
    };
  }

  const cubico = t.match(/(\d+(?:[.,]\d+)?)\s*(?:m3|m³|mc\b|metros?\s*cubicos?|m\s*cubicos?)/);
  if (cubico) {
    const n = numero(cubico[1]);
    return {
      sacos: Number.isFinite(n) && n > 0 ? sacosDeUmMetroCubico(n) : null,
      dito,
      emMetrosCubicos: true,
    };
  }

  const intervalo = t.match(/(\d+)\s*(?:a|-|ou|\/)\s*(\d+)/);
  if (intervalo) {
    const maior = Math.max(Number(intervalo[1]), Number(intervalo[2]));
    return { sacos: maior > 0 ? maior : null, dito, emMetrosCubicos: false };
  }

  const um = t.match(/\d+/);
  const n = um ? Number(um[0]) : NaN;
  return { sacos: Number.isFinite(n) && n > 0 ? n : null, dito, emMetrosCubicos: false };
}
