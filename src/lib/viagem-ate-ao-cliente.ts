/**
 * A VIAGEM DO PROFISSIONAL ATÉ AO CLIENTE — ordem do CEO com o sim do dono,
 * 30-10-2026 (parte C).
 *
 * Depois de contratado, o trabalho mostra na app Pro um botão grande com o
 * passo seguinte da viagem: «Estou a caminho» → «Estou próximo» → «Cheguei».
 * Cada toque grava a hora no site (só o profissional daquele trabalho) e avisa
 * o cliente. Quando ele diz «Cheguei», o cliente vê «O parceiro diz que
 * chegou» e o botão «Confirmo que chegou». Só com AS DUAS confirmações aparece,
 * nas duas apps, o passo para concluir o trabalho. DESLIGADO DESDE 03-11-2026
 * (d2): ver `CHEGADA_CONFIRMADA_OBRIGATORIA`, logo abaixo.
 *
 * Fica de fora o Trabalho CLYON (o cliente desses não fala com o profissional
 * pela plataforma) e quem nunca começou a viagem pela app (o painel no
 * navegador não tem estes botões): nesses, o concluir fica como estava.
 *
 * As horas guardam-se em UTC (NOW() da base) e mostram-se sempre em Lisboa.
 * Puro de propósito: a app Pro, a app de cliente e os testes importam-no.
 */

/**
 * O INTERRUPTOR DA CHEGADA CONFIRMADA — d2, 03-11-2026 (ordem do CEO com o sim
 * do dono: «Vamos remover isso por enquanto e deixar o passo a passo mais
 * simples»). Parceiros ficavam sem poder dar o trabalho por feito à espera da
 * confirmação do cliente.
 *
 * DESLIGADO (false), POR ENQUANTO:
 *  - o «Está feito» aceita-se sem viagem marcada e sem a chegada confirmada
 *    (`viagemComConfirmacao` dá sempre false, `podeMostrarConcluir` sempre true)
 *    — nas duas apps, no painel do navegador e no servidor;
 *  - a viagem deixa de ter ordem obrigatória: «Cheguei» sem «Estou próximo», e
 *    «Estou próximo» sem «Estou a caminho» (nunca para trás, nem repetido);
 *  - ao cliente não se pede a confirmação: o WhatsApp do «Cheguei» sem o
 *    «responda SIM», o aviso no telemóvel sem «Confirme no pedido», sem o botão
 *    «Confirmo que chegou» (pedido, /conta, app) e sem a «Confirmar a chegada»
 *    na Mesa. O cliente continua a ler «O parceiro diz que chegou».
 *
 * LIGADO (true): a regra de 30-10-2026 e da d3 de 31-10-2026, tal e qual.
 * Voltar a ligá-la é mudar só este valor — as funções e os textos ficam.
 */
export const CHEGADA_CONFIRMADA_OBRIGATORIA: boolean = false;

export type EtapaDaViagem = "a_caminho" | "proximo" | "chegou";

/**
 * A ordem dos passos — nunca se volta atrás. Com a chegada confirmada
 * obrigatória, também não se salta nenhum; sem ela (d2, 03-11-2026), pode.
 */
export const ORDEM_DA_VIAGEM: readonly EtapaDaViagem[] = ["a_caminho", "proximo", "chegou"];

/**
 * Desde quando a regra vale. Uma viagem começada antes (a app antiga não tinha
 * o «Estou próximo» nem a confirmação do cliente) continua pela regra antiga.
 */
export const VIAGEM_CONFIRMADA_DESDE = new Date("2026-10-30T18:00:00.000Z");

export type Viagem = {
  aCaminhoEm?: Date | string | null;
  proximoEm?: Date | string | null;
  chegouEm?: Date | string | null;
  chegadaConfirmadaEm?: Date | string | null;
};

const tem = (v: Date | string | null | undefined): boolean => v != null && v !== "" && !Number.isNaN(new Date(v).getTime());

/** O que a viagem já tem marcado, pela ordem. */
export function etapasFeitas(v: Viagem): EtapaDaViagem[] {
  const feitas: EtapaDaViagem[] = [];
  if (tem(v.aCaminhoEm)) feitas.push("a_caminho");
  if (tem(v.proximoEm)) feitas.push("proximo");
  if (tem(v.chegouEm)) feitas.push("chegou");
  return feitas;
}

/**
 * O passo que o botão grande oferece agora (o que vem depois do último
 * marcado), ou null quando ele já chegou. Lê-se do fim: sem a ordem
 * obrigatória, um «Cheguei» sem «Estou a caminho» já não oferece nada.
 */
export function proximaEtapa(v: Viagem): EtapaDaViagem | null {
  if (tem(v.chegouEm)) return null;
  if (tem(v.proximoEm)) return "chegou";
  if (tem(v.aCaminhoEm)) return "proximo";
  return "a_caminho";
}

/**
 * As etapas que se podem marcar agora. Com a ordem obrigatória, só a seguinte;
 * sem ela (d2, 03-11-2026), a seguinte e as que vêm depois — nunca uma para
 * trás nem uma repetida.
 */
export function etapasQueSePodemMarcar(
  v: Viagem,
  pelaOrdem: boolean = CHEGADA_CONFIRMADA_OBRIGATORIA,
): EtapaDaViagem[] {
  const seguinte = proximaEtapa(v);
  if (!seguinte) return [];
  return pelaOrdem ? [seguinte] : ORDEM_DA_VIAGEM.slice(ORDEM_DA_VIAGEM.indexOf(seguinte));
}

/** Se esta etapa se pode marcar agora (ver `etapasQueSePodemMarcar`). */
export function podeMarcar(
  v: Viagem,
  etapa: EtapaDaViagem,
  pelaOrdem: boolean = CHEGADA_CONFIRMADA_OBRIGATORIA,
): boolean {
  return etapasQueSePodemMarcar(v, pelaOrdem).includes(etapa);
}

/** O texto do botão grande da app Pro. */
export const BOTAO_DA_ETAPA: Record<EtapaDaViagem, string> = {
  a_caminho: "Estou a caminho",
  proximo: "Estou próximo",
  chegou: "Cheguei",
};

/** A mensagem quando a app pede uma etapa fora da ordem (só com a ordem obrigatória). */
export const FORA_DA_ORDEM: Record<EtapaDaViagem, string> = {
  a_caminho: "Já marcou que vai a caminho.",
  proximo: "Marque primeiro «Estou a caminho».",
  chegou: "Marque primeiro «Estou próximo».",
};

/**
 * Se a viagem segue a regra nova (começou pela app, depois do corte, e não é
 * Trabalho CLYON). Com o interruptor desligado, nenhuma segue (d2, 03-11-2026).
 */
export function viagemComConfirmacao(
  v: Viagem,
  trabalhoClyon: boolean,
  obrigatoria: boolean = CHEGADA_CONFIRMADA_OBRIGATORIA,
): boolean {
  if (!obrigatoria) return false;
  if (trabalhoClyon || !tem(v.aCaminhoEm)) return false;
  return new Date(v.aCaminhoEm as Date | string).getTime() >= VIAGEM_CONFIRMADA_DESDE.getTime();
}

/**
 * O cliente pode confirmar a chegada: o profissional disse «Cheguei» e ele
 * ainda não confirmou. Com o interruptor desligado não se lhe pede (o botão
 * «Confirmo que chegou» e a «Confirmar a chegada» da Mesa saem).
 */
export function clientePodeConfirmarChegada(
  v: Viagem,
  obrigatoria: boolean = CHEGADA_CONFIRMADA_OBRIGATORIA,
): boolean {
  if (!obrigatoria) return false;
  return tem(v.chegouEm) && !tem(v.chegadaConfirmadaEm);
}

/** As duas confirmações estão dadas: ele disse «Cheguei» e o cliente confirmou. */
export function chegadaConfirmadaPelosDois(v: Viagem): boolean {
  return tem(v.chegouEm) && tem(v.chegadaConfirmadaEm);
}

/**
 * O CONCLUIR SÓ APARECE DEPOIS DAS DUAS CONFIRMAÇÕES — nas duas apps e no
 * servidor. Numa viagem sem a regra nova (ver `viagemComConfirmacao`), fica
 * como estava. Com o interruptor desligado (d2, 03-11-2026), sempre true.
 */
export function podeMostrarConcluir(
  v: Viagem,
  trabalhoClyon: boolean,
  obrigatoria: boolean = CHEGADA_CONFIRMADA_OBRIGATORIA,
): boolean {
  if (!viagemComConfirmacao(v, trabalhoClyon, obrigatoria)) return true;
  return chegadaConfirmadaPelosDois(v);
}

/** O estado da viagem como o cliente o lê (app de cliente e /conta) — «parceiro», nunca «profissional». */
export function estadoDaViagemParaOCliente(v: Viagem): string | null {
  if (chegadaConfirmadaPelosDois(v)) return "Confirmou que o parceiro chegou.";
  if (tem(v.chegouEm)) return "O parceiro diz que chegou.";
  if (tem(v.proximoEm)) return "O parceiro está próximo.";
  if (tem(v.aCaminhoEm)) return "O parceiro está a caminho.";
  return null;
}

/**
 * O estado da viagem como o profissional o lê na app Pro. Com o interruptor
 * desligado, ninguém fica «à espera que o cliente confirme».
 */
export function estadoDaViagemParaOProfissional(
  v: Viagem,
  obrigatoria: boolean = CHEGADA_CONFIRMADA_OBRIGATORIA,
): string | null {
  if (chegadaConfirmadaPelosDois(v)) return "O cliente confirmou que chegou. Pode concluir o trabalho quando terminar.";
  if (tem(v.chegouEm) && obrigatoria) return "À espera que o cliente confirme que chegou.";
  return null;
}

export const CONFIRMO_QUE_CHEGOU = "Confirmo que chegou";
export const O_PARCEIRO_DIZ_QUE_CHEGOU = "O parceiro diz que chegou";

/*
 * QUANDO O CLIENTE AINDA NÃO CONFIRMOU — d3, 31-10-2026. O que a app Pro diz
 * ao profissional à porta: o cliente confirma com um «SIM» ao WhatsApp da
 * CLYON (ou no pedido); se não conseguir, a CLYON confirma por ele no
 * backoffice depois de falar com ele.
 */
export const COMO_O_CLIENTE_CONFIRMA =
  "Peça ao cliente para responder SIM à mensagem da CLYON no WhatsApp (ou confirmar no pedido). Se ele não conseguir, fale com a CLYON: confirmamos com ele e o trabalho segue.";

export const FALAR_COM_A_CLYON = "WhatsApp da CLYON";

/** O texto já escrito no WhatsApp da CLYON. */
export function mensagemDaChegadaPorConfirmar(pedidoId: number): string {
  return `Pedido #${pedidoId}: cheguei e o cliente ainda não confirmou a chegada.`;
}
