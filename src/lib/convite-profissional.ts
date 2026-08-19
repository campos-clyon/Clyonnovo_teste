import { emailValido, telefoneValido } from "./inscricao-profissional";

/**
 * O convite — a única porta de entrada de um profissional.
 *
 * A inscrição deixou de ser aberta em 19-08-2026. O caminho passa a ser: o
 * profissional fala connosco, tomamos nota do nome e do email, e o sistema
 * envia-lhe o link do formulário. Só quem tem o link se inscreve.
 *
 * A diferença não é de conveniência, é de qualidade da rede. Numa inscrição
 * aberta entra quem passa pela página, e a maior parte não volta; por convite,
 * cada profissional na base é alguém com quem já se falou. É também o que
 * elimina a fila de inscrições falsas para triar antes de aprovar seja quem
 * for.
 *
 * Nome e email chegam para convidar. O telefone e o veículo pedem-se porque
 * quem atende já os tem à frente, e poupam-lhe campos no formulário — mas não
 * travam o convite se não vierem.
 */

export const TIPOS_DE_VEICULO = [
  { id: "carrinha_pequena", label: "Carrinha pequena (até 3 m³)" },
  { id: "carrinha_media", label: "Carrinha média (3 a 8 m³)" },
  { id: "carrinha_grande", label: "Carrinha grande (8 a 15 m³)" },
  { id: "camiao", label: "Camião (mais de 15 m³)" },
  { id: "camiao_grua", label: "Camião com grua ou plataforma" },
  { id: "varios", label: "Vários veículos" },
  { id: "sem_veiculo", label: "Sem veículo próprio" },
] as const;

export type TipoDeVeiculo = (typeof TIPOS_DE_VEICULO)[number]["id"];

export function tipoDeVeiculoValido(valor: unknown): valor is TipoDeVeiculo {
  return typeof valor === "string" && TIPOS_DE_VEICULO.some((v) => v.id === valor);
}

export function etiquetaDoVeiculo(id: string | null | undefined): string {
  if (!id) return "—";
  return TIPOS_DE_VEICULO.find((v) => v.id === id)?.label ?? id;
}

/** Quantos dias o link do convite dura. */
export const DIAS_DE_VALIDADE_DO_CONVITE = 14;

export type ErroDeConvite = { campo: string; mensagem: string };

export type DadosDoConvite = {
  nome: string;
  email: string;
  telefone: string | null;
  tipoVeiculo: TipoDeVeiculo | null;
  nota: string | null;
};

export type ResultadoDoConvite =
  | { ok: true; dados: DadosDoConvite }
  | { ok: false; erros: ErroDeConvite[] };

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function validarConvite(corpo: unknown): ResultadoDoConvite {
  const erros: ErroDeConvite[] = [];
  const c = (corpo ?? {}) as Record<string, unknown>;

  const nome = texto(c.nome);
  if (nome.length < 2) {
    erros.push({ campo: "nome", mensagem: "Indique o nome de quem vai receber o convite." });
  }

  // Minúsculas: o email é a identidade do profissional em todo o sistema, e
  // "Joao@" e "joao@" são a mesma pessoa em qualquer servidor de correio. Sem
  // normalizar, convidávamos duas vezes o mesmo homem e ele ficava com duas
  // contas — e depois com dois saldos.
  const email = texto(c.email).toLowerCase();
  if (!emailValido(email)) {
    erros.push({ campo: "email", mensagem: "Email inválido — é para lá que vai o link." });
  }

  const telefoneBruto = texto(c.telefone);
  let telefone: string | null = null;
  if (telefoneBruto) {
    if (!telefoneValido(telefoneBruto)) {
      erros.push({ campo: "telefone", mensagem: "Número de telefone português inválido." });
    } else {
      telefone = telefoneBruto;
    }
  }

  const veiculoBruto = texto(c.tipoVeiculo);
  let tipoVeiculo: TipoDeVeiculo | null = null;
  if (veiculoBruto) {
    if (!tipoDeVeiculoValido(veiculoBruto)) {
      erros.push({ campo: "tipoVeiculo", mensagem: "Tipo de veículo desconhecido." });
    } else {
      tipoVeiculo = veiculoBruto;
    }
  }

  if (erros.length > 0) return { ok: false, erros };

  return {
    ok: true,
    dados: {
      nome,
      email,
      telefone,
      tipoVeiculo,
      // O que quem atendeu quiser deixar escrito: "conheci na obra da Rua X",
      // "só faz mudanças". Não vai no email — é para nós.
      nota: texto(c.nota).slice(0, 500) || null,
    },
  };
}
