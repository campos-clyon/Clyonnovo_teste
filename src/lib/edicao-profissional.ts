import {
  CATEGORIAS_VALIDAS,
  regimeDeIvaValido,
  type RegimeDeIva,
  RAIO_MAXIMO_KM,
  RAIO_MINIMO_KM,
  type ErroDeInscricao,
  nifValido,
  telefoneValido,
  emailValido,
  codigoPostalValido,
  normalizarCodigoPostal,
  pareceMorada,
  temSinaisDeHtml,
  MENSAGEM_SEM_SINAIS,
} from "./inscricao-profissional";
import { ibanValido, normalizarIban } from "./iban";
import { tipoDeVeiculoValido, TIPOS_DE_VEICULO } from "./convite-profissional";
import { lerMbway } from "./mbway";

/**
 * O que o administrador pode alterar num profissional já inscrito.
 *
 * Existe separado de `validarInscricao` porque as perguntas são diferentes. Na
 * inscrição valida-se um formulário inteiro e exige-se tudo; aqui alteram-se
 * campos à peça, e o que não vem no pedido fica como está — um painel que
 * obrigasse a reenviar o perfil completo para mudar o raio apagava o resto à
 * primeira distracção.
 *
 * O que NÃO se altera por aqui, de propósito:
 *
 *   · a **verificação da guia**, que tem a sua própria acção e o seu registo
 *     de quem a deu por boa;
 *   · o **estado**, pela mesma razão — é uma decisão, não um campo.
 *
 * O EMAIL ESTEVE NESTA LISTA até 01-10-2026. É a identidade do profissional e
 * a chave por onde os pedidos lhe chegam, e trocá-lo num painel é entregar a
 * conta a outra pessoa sem que ninguém dê por isso. O dono pediu para poder
 * corrigir «tudo» no backoffice — um profissional que perdeu o acesso ao email
 * antigo ficava fora da conta para sempre — e por isso passou a mudar-se, mas
 * com três guardas: só o administrador o muda (ver `CAMPOS_SO_DO_ADMINISTRADOR`),
 * não pode ser o de outra conta, e mudá-lo queima o link de palavra-passe que
 * estivesse por usar, que foi para o endereço antigo.
 */

export const ESTADOS_DO_PROFISSIONAL = [
  "pendente",
  "aprovado",
  "rejeitado",
  "suspenso",
] as const;

export type EstadoDoProfissional = (typeof ESTADOS_DO_PROFISSIONAL)[number];

export function estadoValido(valor: unknown): valor is EstadoDoProfissional {
  return typeof valor === "string" && (ESTADOS_DO_PROFISSIONAL as readonly string[]).includes(valor);
}

export type CamposEditaveis = {
  categorias?: string[];
  zonas?: string[];
  raioKm?: number;
  emiteFatura?: boolean;
  regimeIva?: RegimeDeIva;
  emiteGuiaTransporte?: boolean;
  numeroTransportador?: string | null;
};

export type ResultadoDeEdicao =
  | { ok: true; alteracoes: CamposEditaveis }
  | { ok: false; erros: ErroDeInscricao[] };

function listaDeTextos(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Valida um pedido de alteração.
 *
 * Só devolve os campos que vieram — nunca preenche os outros com valores por
 * omissão. Um `{ raioKm: 60 }` altera o raio e mais nada.
 */
export function validarEdicao(corpo: unknown): ResultadoDeEdicao {
  const erros: ErroDeInscricao[] = [];
  const c = (corpo ?? {}) as Record<string, unknown>;
  const alteracoes: CamposEditaveis = {};

  if ("categorias" in c) {
    const validas = listaDeTextos(c.categorias).filter((id) => CATEGORIAS_VALIDAS.includes(id));
    if (validas.length === 0) {
      erros.push({
        campo: "categorias",
        mensagem: "O profissional tem de ficar com pelo menos uma categoria.",
      });
    } else {
      // Sem duplicados: a lista alimenta a regra de elegibilidade, e um id
      // repetido não muda nada mas engorda a comparação a cada pedido.
      alteracoes.categorias = Array.from(new Set(validas));
    }
  }

  if ("zonas" in c) {
    // Zonas vazias são aceitáveis: quem tem coordenadas é avaliado pelo raio, e
    // aí as zonas só servem de recurso. Não é motivo para recusar a alteração.
    alteracoes.zonas = Array.from(new Set(listaDeTextos(c.zonas)));
  }

  if ("raioKm" in c) {
    const bruto = typeof c.raioKm === "string" ? Number(c.raioKm) : c.raioKm;
    const raio = typeof bruto === "number" && Number.isFinite(bruto) ? Math.round(bruto) : NaN;
    if (!Number.isFinite(raio) || raio < RAIO_MINIMO_KM || raio > RAIO_MAXIMO_KM) {
      erros.push({
        campo: "raioKm",
        mensagem: `O raio tem de ser entre ${RAIO_MINIMO_KM} e ${RAIO_MAXIMO_KM} km.`,
      });
    } else {
      alteracoes.raioKm = raio;
    }
  }

  if ("emiteFatura" in c) {
    alteracoes.emiteFatura = c.emiteFatura === true;
  }

  if ("regimeIva" in c) {
    if (!regimeDeIvaValido(c.regimeIva)) {
      erros.push({ campo: "regimeIva", mensagem: "Regime de IVA inválido." });
    } else {
      alteracoes.regimeIva = c.regimeIva;
    }
  }

  if ("emiteGuiaTransporte" in c) {
    const emite = c.emiteGuiaTransporte === true;
    alteracoes.emiteGuiaTransporte = emite;

    // Desligar a guia limpa o número. Deixá-lo lá guardava o registo de alguém
    // que já não declara transportar resíduos — e um número órfão é o género de
    // coisa que volta a aparecer numa consulta e engana quem a lê.
    if (!emite) alteracoes.numeroTransportador = null;
  }

  if ("numeroTransportador" in c && alteracoes.numeroTransportador !== null) {
    const numero = typeof c.numeroTransportador === "string" ? c.numeroTransportador.trim() : "";
    const vaiEmitir =
      alteracoes.emiteGuiaTransporte ?? (c.emiteGuiaTransporte === true ? true : undefined);
    if (vaiEmitir && numero.length < 4) {
      erros.push({
        campo: "numeroTransportador",
        mensagem: "Indique o número de registo de transportador.",
      });
    } else {
      alteracoes.numeroTransportador = numero || null;
    }
  }

  if (erros.length > 0) return { ok: false, erros };
  if (Object.keys(alteracoes).length === 0) {
    return { ok: false, erros: [{ campo: "_", mensagem: "Nada para alterar." }] };
  }

  return { ok: true, alteracoes };
}

/**
 * Alterar o que o profissional faz ou até onde vai mexe em quem recebe cada
 * pedido. Isto diz se a alteração tem esse efeito, para o painel poder avisar.
 */
export function afectaDistribuicao(alteracoes: CamposEditaveis): boolean {
  return (
    alteracoes.categorias !== undefined ||
    alteracoes.zonas !== undefined ||
    alteracoes.raioKm !== undefined ||
    alteracoes.emiteFatura !== undefined ||
    alteracoes.emiteGuiaTransporte !== undefined
  );
}

/*
 * OS DADOS DA PESSOA — contacto, faturação, viatura e pagamento.
 *
 * «Na opção de editar perfil do profissional não dá para editar outras
 * informações mais detalhadas» — 01-10-2026, e o dono escolheu «Tudo». Até aí
 * o backoffice só mexia no que decide os pedidos (categorias, raio, zonas,
 * fatura, guia); um telefone com um dígito trocado ou um NIF por corrigir
 * obrigava o profissional a entrar no painel dele — e o que tinha perdido a
 * palavra-passe não podia.
 *
 * As regras são as do perfil que o próprio edita (`/api/profissionais/perfil`):
 * os mesmos validadores, importados, e não copiados. Um telefone que lá é
 * recusado não pode entrar por aqui.
 */
export const CAMPOS_DE_DADOS = [
  "nome",
  "telefone",
  "nif",
  "email",
  "moradaFiscal",
  "codigoPostalFiscal",
  "localidadeFiscal",
  "tipoVeiculo",
  "iban",
  "ibanTitular",
  "mbway",
] as const;

/**
 * Os que só o ADMINISTRADOR muda: por onde se entra na conta (o email, e com
 * ele o link de repor a palavra-passe) e para onde vai o dinheiro. Um
 * assistente que os pudesse mudar podia pôr o seu email e pedir o link, ou o
 * seu IBAN antes de um pagamento — é a mesma regra do link da palavra-passe,
 * que também só vai para o administrador.
 */
export const CAMPOS_SO_DO_ADMINISTRADOR = ["email", "iban", "ibanTitular", "mbway"] as const;

export type DadosValidados = {
  /** Colunas de `providers`, prontas para `actualizarPerfilDoProfissional`. */
  colunas: Record<string, string | null>;
  /** O email novo, à parte: tem guarda própria (único, e queima o link pendente). */
  email?: string;
};

export type ResultadoDosDados =
  | { ok: true; dados: DadosValidados }
  | { ok: false; erros: ErroDeInscricao[] };

function textoDe(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Valida os dados que vieram, e só esses — como `validarEdicao`. Um campo que
 * não vem fica como está; um campo que vem vazio apaga-se, onde vazio é
 * aceitável (NIF, morada fiscal, IBAN, MB WAY), e é recusado onde não é
 * (nome, telefone, email).
 */
export function validarDados(corpo: unknown): ResultadoDosDados {
  const c = (corpo ?? {}) as Record<string, unknown>;
  const erros: ErroDeInscricao[] = [];
  const colunas: Record<string, string | null> = {};
  let email: string | undefined;

  if ("nome" in c) {
    const nome = textoDe(c.nome);
    if (nome.length < 2) erros.push({ campo: "nome", mensagem: "Indique o nome." });
    else if (temSinaisDeHtml(nome)) erros.push({ campo: "nome", mensagem: MENSAGEM_SEM_SINAIS.nome });
    else if (pareceMorada(nome)) {
      // É o que o cliente vê ao escolher quem lhe entra em casa.
      erros.push({ campo: "nome", mensagem: "Isto parece uma morada. Aqui vai o nome da pessoa ou da empresa." });
    } else colunas.name = nome.slice(0, 120);
  }

  if ("telefone" in c) {
    const t = textoDe(c.telefone);
    if (!telefoneValido(t)) erros.push({ campo: "telefone", mensagem: "Telefone inválido." });
    else colunas.phone = t;
  }

  if ("nif" in c) {
    const nif = textoDe(c.nif);
    if (nif && !nifValido(nif)) erros.push({ campo: "nif", mensagem: "NIF inválido." });
    else colunas.nif = nif || null;
  }

  if ("email" in c) {
    const e = textoDe(c.email).toLowerCase();
    if (!emailValido(e)) erros.push({ campo: "email", mensagem: "Email inválido." });
    else email = e;
  }

  if ("moradaFiscal" in c) {
    const m = textoDe(c.moradaFiscal);
    if (m && m.length < 5) erros.push({ campo: "moradaFiscal", mensagem: "Indique a rua e o número." });
    else colunas.moradaFiscal = m || null;
  }

  if ("codigoPostalFiscal" in c) {
    const cp = textoDe(c.codigoPostalFiscal);
    if (cp && !codigoPostalValido(cp)) {
      erros.push({ campo: "codigoPostalFiscal", mensagem: "Código postal inválido (0000-000)." });
    } else colunas.codigoPostalFiscal = cp ? normalizarCodigoPostal(cp) : null;
  }

  if ("localidadeFiscal" in c) colunas.localidadeFiscal = textoDe(c.localidadeFiscal) || null;

  if ("tipoVeiculo" in c) {
    // O tipo decide o valor por carga que ele vê (`carga-da-carrinha.ts`): um
    // nome que a conta não conhece não é um erro, é o valor errado em silêncio.
    const v = textoDe(c.tipoVeiculo).toLowerCase();
    if (!v) colunas.tipoVeiculo = null;
    else if (tipoDeVeiculoValido(v)) colunas.tipoVeiculo = v;
    else {
      erros.push({
        campo: "tipoVeiculo",
        mensagem: `Veículo desconhecido. Escolha um de: ${TIPOS_DE_VEICULO.map((t) => t.id).join(", ")}.`,
      });
    }
  }

  if ("iban" in c) {
    const bruto = textoDe(c.iban);
    // A máscara (`PT50 ···· 1234`) é o que já está gravado, devolvido tal e
    // qual por quem não mexeu no campo — o mesmo travão do perfil dele.
    if (bruto.includes("·")) {
      /* mantém-se */
    } else if (!bruto) colunas.iban = null;
    else if (!ibanValido(bruto)) erros.push({ campo: "iban", mensagem: "IBAN inválido. Confirme os dígitos." });
    else colunas.iban = normalizarIban(bruto);
  }

  if ("ibanTitular" in c) colunas.ibanTitular = textoDe(c.ibanTitular).slice(0, 120) || null;

  if ("mbway" in c) {
    const mbway = lerMbway(textoDe(c.mbway));
    if (mbway.ok) colunas.mbway = mbway.valor;
    else erros.push({ campo: "mbway", mensagem: mbway.mensagem });
  }

  if (erros.length > 0) return { ok: false, erros };
  return { ok: true, dados: { colunas, ...(email !== undefined ? { email } : {}) } };
}
