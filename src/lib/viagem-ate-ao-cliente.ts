/**
 * A VIAGEM DO PROFISSIONAL ATÉ AO CLIENTE — ordem do CEO com o sim do dono,
 * 30-10-2026 (parte C).
 *
 * Depois de contratado, o trabalho mostra na app Pro um botão grande com o
 * passo seguinte da viagem: «Estou a caminho» → «Estou próximo» → «Cheguei».
 * Cada toque grava a hora no site (só o profissional daquele trabalho) e avisa
 * o cliente. Quando ele diz «Cheguei», o cliente vê «O parceiro diz que
 * chegou» e o botão «Confirmo que chegou». Só com AS DUAS confirmações aparece,
 * nas duas apps, o passo para concluir o trabalho.
 *
 * Fica de fora o Trabalho CLYON (o cliente desses não fala com o profissional
 * pela plataforma) e quem nunca começou a viagem pela app (o painel no
 * navegador não tem estes botões): nesses, o concluir fica como estava.
 *
 * As horas guardam-se em UTC (NOW() da base) e mostram-se sempre em Lisboa.
 * Puro de propósito: a app Pro, a app de cliente e os testes importam-no.
 */

export type EtapaDaViagem = "a_caminho" | "proximo" | "chegou";

/** A ordem dos passos — não se salta nenhum, nem se volta atrás. */
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

/** O passo que o botão grande oferece agora, ou null quando ele já chegou. */
export function proximaEtapa(v: Viagem): EtapaDaViagem | null {
  if (!tem(v.aCaminhoEm)) return "a_caminho";
  if (!tem(v.proximoEm) && !tem(v.chegouEm)) return "proximo";
  if (!tem(v.chegouEm)) return "chegou";
  return null;
}

/** Se esta etapa se pode marcar agora — só a seguinte, nunca uma saltada nem uma repetida. */
export function podeMarcar(v: Viagem, etapa: EtapaDaViagem): boolean {
  return proximaEtapa(v) === etapa;
}

/** O texto do botão grande da app Pro. */
export const BOTAO_DA_ETAPA: Record<EtapaDaViagem, string> = {
  a_caminho: "Estou a caminho",
  proximo: "Estou próximo",
  chegou: "Cheguei",
};

/** A mensagem quando a app pede uma etapa fora da ordem. */
export const FORA_DA_ORDEM: Record<EtapaDaViagem, string> = {
  a_caminho: "Já marcou que vai a caminho.",
  proximo: "Marque primeiro «Estou a caminho».",
  chegou: "Marque primeiro «Estou próximo».",
};

/** Se a viagem segue a regra nova (começou pela app, depois do corte, e não é Trabalho CLYON). */
export function viagemComConfirmacao(v: Viagem, trabalhoClyon: boolean): boolean {
  if (trabalhoClyon || !tem(v.aCaminhoEm)) return false;
  return new Date(v.aCaminhoEm as Date | string).getTime() >= VIAGEM_CONFIRMADA_DESDE.getTime();
}

/** O cliente pode confirmar a chegada: o profissional disse «Cheguei» e ele ainda não confirmou. */
export function clientePodeConfirmarChegada(v: Viagem): boolean {
  return tem(v.chegouEm) && !tem(v.chegadaConfirmadaEm);
}

/** As duas confirmações estão dadas: ele disse «Cheguei» e o cliente confirmou. */
export function chegadaConfirmadaPelosDois(v: Viagem): boolean {
  return tem(v.chegouEm) && tem(v.chegadaConfirmadaEm);
}

/**
 * O CONCLUIR SÓ APARECE DEPOIS DAS DUAS CONFIRMAÇÕES — nas duas apps e no
 * servidor. Numa viagem sem a regra nova (ver `viagemComConfirmacao`), fica
 * como estava.
 */
export function podeMostrarConcluir(v: Viagem, trabalhoClyon: boolean): boolean {
  if (!viagemComConfirmacao(v, trabalhoClyon)) return true;
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

/** O estado da viagem como o profissional o lê na app Pro. */
export function estadoDaViagemParaOProfissional(v: Viagem): string | null {
  if (chegadaConfirmadaPelosDois(v)) return "O cliente confirmou que chegou. Pode concluir o trabalho quando terminar.";
  if (tem(v.chegouEm)) return "À espera que o cliente confirme que chegou.";
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
