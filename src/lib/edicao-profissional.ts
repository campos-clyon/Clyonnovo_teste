import {
  CATEGORIAS_VALIDAS,
  regimeDeIvaValido,
  type RegimeDeIva,
  RAIO_MAXIMO_KM,
  RAIO_MINIMO_KM,
  type ErroDeInscricao,
} from "./inscricao-profissional";

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
 *   · o **email**, que é a identidade do profissional e a chave por onde os
 *     pedidos lhe chegam. Trocá-lo num painel é entregar a conta a outra
 *     pessoa sem que ninguém dê por isso;
 *   · a **verificação da guia**, que tem a sua própria acção e o seu registo
 *     de quem a deu por boa;
 *   · o **estado**, pela mesma razão — é uma decisão, não um campo.
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
