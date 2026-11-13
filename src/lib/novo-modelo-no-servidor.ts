import { perfilDoProfissional } from "./db";
import { estadoDosDadosParaReceber } from "./dados-para-receber";
import { standByDoProfissional } from "./bloqueio-do-profissional";
import { novoModeloEmVigor } from "./novo-modelo";
import { agoraDoModelo } from "./relogio-do-modelo";
import { PAGAR_O_VALOR_EM_ATRASO } from "./valor-em-atraso";

/**
 * O QUE IMPEDE UM PARCEIRO DE ACEITAR OU ENVIAR PROPOSTA NO MODELO DE 15-11 —
 * d10. Uma pergunta só, para as duas portas (o painel e o link do email) e para
 * a app (que usa a do painel):
 *
 *   · faltam-lhe o IBAN, o titular, o MB WAY ou o regime de IVA, passado o aviso
 *     (`dados-para-receber.ts`) → 403 com `faltamDadosParaReceber`;
 *   · tem um valor em atraso há mais de 4 dias (`valor-em-atraso.ts`) → 403 com
 *     `standBy` e a acção «Pagar o valor em atraso».
 *
 * Antes de 15-11 devolve sempre `null`, sem ir à base.
 */
export type ImpedimentoDoNovoModelo = {
  status: 403;
  corpo: {
    error: string;
    faltamDadosParaReceber?: true;
    falta?: string[];
    standBy?: true;
    accao?: string;
    valorEmAtraso?: number;
    negociacoes?: number[];
  };
};

/**
 * ESTA NEGOCIAÇÃO SEGUE O MODELO DE 15-11? — para os textos de um trabalho (os
 * emails, a página do parceiro). A mesma pergunta de `acesso-ao-pagamento.ts`:
 * um pagamento à CLYON antes de 15-11, um trabalho que fechou antes, ou um
 * Trabalho CLYON ficam no antigo. Antes da data devolve `false` sem ir à base.
 */
export async function segueONovoModelo(
  n: {
    id: number | string;
    ofertaClyon?: unknown;
    estado?: unknown;
    execucaoEnviadaEm?: unknown;
    provaJson?: unknown;
    confirmadoEm?: unknown;
    pagoEm?: unknown;
  },
  agora: Date = agoraDoModelo(),
): Promise<boolean> {
  if (!novoModeloEmVigor(agora)) return false;
  const { pagamentosDaNegociacao } = await import("./pagamentos-na-base");
  const { negociacaoNoNovoModelo } = await import("./taxa-a-passar-a-clyon");
  const { quandoLiberta } = await import("./trabalho");
  const pagamentos = await pagamentosDaNegociacao(Number(n.id));
  return negociacaoNoNovoModelo(
    { ofertaClyon: n.ofertaClyon, fechadoEm: quandoLiberta(n as Parameters<typeof quandoLiberta>[0]) },
    pagamentos,
    agora,
  );
}

export async function impedimentoDoNovoModelo(
  providerId: number,
  agora: Date = agoraDoModelo(),
): Promise<ImpedimentoDoNovoModelo | null> {
  if (!novoModeloEmVigor(agora)) return null;

  const perfil = await perfilDoProfissional(providerId);
  if (perfil) {
    const dados = estadoDosDadosParaReceber(perfil, agora);
    if (dados.estado === "impede") {
      return { status: 403, corpo: { error: dados.frase, faltamDadosParaReceber: true, falta: dados.falta } };
    }
  }

  const s = await standByDoProfissional(providerId, agora);
  if (s.emStandBy) {
    return {
      status: 403,
      corpo: {
        error: s.explicacao,
        standBy: true,
        accao: PAGAR_O_VALOR_EM_ATRASO,
        valorEmAtraso: s.total,
        negociacoes: s.valores.map((v) => v.negociacaoId),
      },
    };
  }
  return null;
}
