import { eEntulhoEmSacos, modoDoEntulho } from "./modo-do-entulho";

export { eEntulhoEmSacos, modoDoEntulho };

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
 * há big bags: **a recolha de entulho é feita em sacos de obra de 25 a 30 kg,
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
 *
 * A GRANEL, SIM — 17-10-2026. *«Nós fazemos recolha a granel!»* — o dono, ao
 * ler na página «e não faz recolha a granel». O entulho solto, em monte ou
 * no chão, também se recolhe: o profissional carrega-o no local. Os
 * contentores e os big bags continuam a não existir.
 */

/*
 * O PESO DE CADA SACO — 25 A 30 KG desde 17-10-2026; antes dizia-se só o tecto, 25. O dono
 * escreveu «sacos até 25 a 30 kg» na grelha nova, e escolheu dizê-lo assim em
 * todo o lado. É o que uma pessoa carrega escada abaixo sem se magoar.
 */
export const PESO_DO_SACO_KG = { minimo: 25, maximo: 30 } as const;

/** «25 a 30 kg» — vai a seguir a «sacos de obra de». */
export const PESO_DO_SACO = `${PESO_DO_SACO_KG.minimo} a ${PESO_DO_SACO_KG.maximo} kg`;

/** Quantos sacos de obra fazem, mais ou menos, um metro cúbico de entulho. */
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

/*
 * QUE SACOS SÃO — 03-11-2026.
 *
 * *«Pergunta 2 vezes se o entulho está em sacos e não especifica qual saco,
 * ex: sacos de 25 a 30 kg, de 50, 20 ou big bags… e mesmo tendo indicado 50
 * sacos ele não calcula.»* — o dono, a testar a app de cliente.
 *
 * A grelha conta-se em SACOS DE OBRA (25 a 30 kg; 40 fazem um m³). Os outros
 * sacos contam pelo peso, a 25 kg o saco de obra (o de baixo da faixa), e
 * arredonda-se para cima — quem avalia no local prefere encontrar menos do
 * que lhe disseram do que mais: 20 kg são 0,8 de um saco de obra, 50 kg são 2.
 * O big bag continua a ser só a medida (38 sacos, regra de 06-10-2026): o que
 * se recolhe são sacos de obra, e o parceiro passa o entulho para eles no
 * local. Os sacos acima de 30 kg também: não se carregam à mão.
 *
 * O catálogo da app serve os nomes (sem números); a conta é esta, a mesma na
 * R12 e no `POST /api/simulador/pedido` (`camposDoEntulhoEmSacosDeObra`): a
 * app manda o que a pessoa disse, e o servidor passa-o a sacos de obra.
 */
export type TipoDeSaco = {
  id: "obra" | "pequeno" | "grande" | "bigbag" | "nao_sei";
  /** O botão de «Que sacos são?». */
  nome: string;
  /** Na pergunta da quantidade: «Quantos sacos?», «Quantos big bags?». */
  unidade: string;
  /** Um e vários, para as frases: «1 big bag», «50 sacos de obra». */
  um: string;
  varios: string;
  /** Quantos sacos de obra conta cada um. */
  sacosDeObra: number;
  /** O que acontece no local, quando não é um saco de obra que se carrega à mão. */
  aviso: string | null;
};

export const TIPOS_DE_SACO: readonly TipoDeSaco[] = [
  { id: "obra", nome: `Sacos de obra (${PESO_DO_SACO})`, unidade: "sacos", um: "saco de obra", varios: "sacos de obra", sacosDeObra: 1, aviso: null },
  { id: "pequeno", nome: "Sacos de 20 kg", unidade: "sacos", um: "saco de 20 kg", varios: "sacos de 20 kg", sacosDeObra: 0.8, aviso: null },
  {
    id: "grande",
    nome: "Sacos de 50 kg",
    unidade: "sacos",
    um: "saco de 50 kg",
    varios: "sacos de 50 kg",
    sacosDeObra: 2,
    aviso: "Um saco de 50 kg não se carrega à mão: o parceiro passa o entulho para sacos de obra no local, e cada um conta como 2 sacos de obra.",
  },
  {
    id: "bigbag",
    nome: "Big bags",
    unidade: "big bags",
    um: "big bag",
    varios: "big bags",
    sacosDeObra: SACOS_POR_BIG_BAG,
    aviso: `O big bag não se carrega inteiro: o parceiro passa o entulho para sacos de obra no local, e cada big bag conta como ${SACOS_POR_BIG_BAG} sacos de obra.`,
  },
  { id: "nao_sei", nome: "Não sei", unidade: "sacos", um: "saco", varios: "sacos", sacosDeObra: 1, aviso: null },
];

/** O tipo de saco com este id; sem ele (ou desconhecido), o saco de obra. */
export function tipoDeSaco(id: string | null | undefined): TipoDeSaco {
  return TIPOS_DE_SACO.find((t) => t.id === id) ?? TIPOS_DE_SACO[0];
}

/** «1 big bag», «50 sacos de obra». */
export function quantosSacos(n: number, tipo: string | null | undefined): string {
  const t = tipoDeSaco(tipo);
  return `${n} ${n === 1 ? t.um : t.varios}`;
}

/** Quantos sacos de obra são estes sacos — pelo peso, arredondado para cima. */
export function emSacosDeObra(quantidade: number, tipo: string | null | undefined): number {
  if (!Number.isFinite(quantidade) || quantidade <= 0) return 0;
  // Aos cêntimos antes do tecto: 50 × 0,8 dá 40,000000000000004 e não pode dar 41.
  return Math.ceil(Math.round(quantidade * tipoDeSaco(tipo).sacosDeObra * 100) / 100);
}

/**
 * Os volumes do simulador em sacos de obra — a conversão que o simulador do
 * site sempre fez às escondidas («Enche uma carrinha» = 40 sacos = 1 m³).
 */
export const SACOS_POR_VOLUME_DO_ENTULHO: Readonly<Record<"carrinha" | "camiao_caixa" | "camiao_lixo", number>> = {
  carrinha: 40,
  camiao_caixa: 120,
  camiao_lixo: 240,
};


export type QuantidadeDoEntulho = {
  estado?: string | null;
  modo?: string | null;
  /** O tipo dos sacos que já estão cheios (`TIPOS_DE_SACO`). */
  tipoDeSaco?: string | null;
  /** Os sacos que disse; no chão, quantos sacos de obra daria. */
  sacos?: number | null;
  /** Uma parte em sacos e outra no chão: os já cheios (do tipo dito) e os por ensacar (de obra). */
  ensacados?: number | null;
  porEnsacar?: number | null;
  volume?: string | null;
};

const contagem = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Quantos sacos de obra é este entulho, ou `null` sem quantidade (ou «não tenho a certeza»). */
export function sacosDeObraDoEntulho(q: QuantidadeDoEntulho): number | null {
  const modo = modoDoEntulho(q.estado, q.modo);
  let n = 0;
  if (modo === "sacos") {
    const ensacados = contagem(q.ensacados);
    const porEnsacar = contagem(q.porEnsacar);
    if (q.estado === "misto" && ensacados + porEnsacar > 0) n = emSacosDeObra(ensacados, q.tipoDeSaco) + porEnsacar;
    else if (q.estado === "ensacado" || q.estado === "misto") n = emSacosDeObra(contagem(q.sacos), q.tipoDeSaco);
    else n = contagem(q.sacos);
  } else if (modo === "volume" && q.volume && q.volume in SACOS_POR_VOLUME_DO_ENTULHO) {
    n = SACOS_POR_VOLUME_DO_ENTULHO[q.volume as keyof typeof SACOS_POR_VOLUME_DO_ENTULHO];
  }
  return n > 0 ? n : null;
}

/**
 * A frase que descreve o serviço. Uma linha, para caber num parágrafo de
 * qualquer página sem se dar por ela.
 */
export const COMO_SE_RECOLHE_ENTULHO =
  `Recolhe-se em sacos de obra de ${PESO_DO_SACO} ou a granel, ` +
  "e o parceiro carrega tudo à mão para a carrinha.";

/**
 * O que a CLYON NÃO faz, dito sem rodeios.
 *
 * Aparece nas páginas de entulho e nas respostas às perguntas sobre
 * contentores. Dizer «não» a quem procura contentor é melhor do que calar: a
 * pessoa que só quer um contentor descobre-o em dez segundos em vez de
 * descobrir na véspera da obra, e a que não se importa com o meio fica.
 */
export const NAO_HA_CONTENTORES = "A CLYON não fornece nem aluga contentores.";

/** O entulho solto — 17-10-2026. Recolhe-se, e o tempo de carga entra na proposta. */
export const A_GRANEL =
  "O entulho solto — em monte, no chão ou espalhado pela obra — recolhe-se a granel: " +
  "o parceiro carrega-o no local, e o tempo de carga entra na proposta.";

/**
 * A resposta a «fornecem contentor?», inteira.
 *
 * A pergunta é feita em todas as cidades e é procurada no Google. Continua a
 * ser respondida — com um não, e com o que existe em vez disso.
 */
export const RESPOSTA_SOBRE_CONTENTORES =
  `${NAO_HA_CONTENTORES} ${COMO_SE_RECOLHE_ENTULHO} ` +
  "Se o entulho estiver solto no chão, o parceiro carrega-o no local, a granel. " +
  "Para obras que só se resolvem com contentor, o caminho é uma empresa de aluguer de contentores.";

/** Uma referência de volume em sacos, para quem pensa em metros cúbicos. */
export function sacosDeUmMetroCubico(metrosCubicos: number): number {
  const n = Math.round(metrosCubicos * SACOS_POR_METRO_CUBICO);
  return n > 0 ? n : 0;
}

/**
 * QUANTOS SACOS, A PARTIR DO QUE A PESSOA ESCREVEU.
 *
 * *«A leitura indicou 43 sacos, será correcto?»* — a Miriam à Celeste, a
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

/**
 * O ENTULHO DO PEDIDO EM SACOS DE OBRA — 03-11-2026.
 *
 * `entulhoQuantidade` são sempre sacos de obra: é o que o motor, a grelha e o
 * profissional leem. O simulador do site já converte (os big bags e o volume);
 * a app de cliente manda o que a pessoa disse — os sacos do tipo dela, em
 * `entulhoTipoDeSaco`, ou só o volume — e a conversão faz-se aqui, no servidor.
 * Devolve os campos a acrescentar ao pedido (vazio quando não há nada a mudar):
 * a quantidade em sacos de obra, a que ela disse em `entulhoQuantidadeNoTipo`, e
 * os big bags no campo que o backoffice já mostra.
 */
export function camposDoEntulhoEmSacosDeObra(order: Record<string, unknown>): Record<string, string> {
  if (order.serviceType !== "recolha_entulho") return {};
  const numero = (v: unknown) => {
    const n = typeof v === "number" ? v : typeof v === "string" && /^\s*\d{1,6}\s*$/.test(v) ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  const estado = typeof order.entulhoState === "string" ? order.entulhoState : null;
  const id = typeof order.entulhoTipoDeSaco === "string" ? order.entulhoTipoDeSaco : null;
  const dita = numero(order.entulhoQuantidade);
  if (!dita) {
    // Só o volume (a app não manda os sacos): a mesma conversão do simulador do site.
    const volume = typeof order.entulhoVolume === "string" ? order.entulhoVolume : "";
    const sacos = SACOS_POR_VOLUME_DO_ENTULHO[volume as keyof typeof SACOS_POR_VOLUME_DO_ENTULHO];
    return sacos ? { entulhoQuantidade: String(sacos) } : {};
  }
  if (!id || !eEntulhoEmSacos(estado)) return {};
  const tipo = tipoDeSaco(id);
  const ensacados = numero(order.entulhoQuantidadeEnsacados);
  const porEnsacar = numero(order.entulhoQuantidadePorEnsacar);
  const misto = estado === "misto" && ensacados + porEnsacar > 0;
  const obra = misto ? emSacosDeObra(ensacados, tipo.id) + porEnsacar : emSacosDeObra(dita, tipo.id);
  const campos: Record<string, string> = {};
  if (obra > 0 && obra !== dita) {
    campos.entulhoQuantidade = String(obra);
    // No misto, os do tipo dito já estão em `entulhoQuantidadeEnsacados`.
    if (!misto) campos.entulhoQuantidadeNoTipo = String(dita);
  }
  if (tipo.id === "bigbag") campos.entulhoQuantidadeBigBags = String(misto ? ensacados : dita);
  return campos;
}
