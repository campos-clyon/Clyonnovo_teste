/**
 * UMA MENSAGEM AUTOMÁTICA POR DIA, POR TELEFONE — comum a todas as rotinas
 * (d85, fase 0, 22-11-2026).
 *
 * Até aqui cada rotina contava à sua maneira: a validade dos orçamentos (d62)
 * via os seus ciclos e os do seguimento; os lembretes do que falta (d71) só os
 * do seguimento; o seguimento do cliente (d83) os três. Agora há UMA lista das
 * mensagens automáticas (`FONTES_DAS_MENSAGENS_AUTOMATICAS`) e UMA função que
 * todas consultam antes de reservar o passo do dia
 * (`jaSaiuHojeUmaMensagemAutomatica`). Uma rotina nova acrescenta aqui a sua
 * tabela e as colunas das mensagens que saíram — e passa a contar para todas.
 *
 * A regra é a de sempre: o dia é o de Lisboa; o telefone pelo número inteiro
 * (`mesmoTelefoneEstrito`); o email tal e qual. Uma tabela que ainda não
 * existe não tem nada; outra falha lança (quem chama decide: não envia).
 */

import type { Pool } from "mysql2/promise";
import { getPool } from "./db";
import { diaEmLisboa, instanteDaBase } from "./hora-de-lisboa";
import { emailValido } from "./lembrete-do-que-falta";
import { mesmoTelefoneEstrito } from "./validade-do-orcamento";

/** Uma rotina que manda mensagens automáticas a clientes: a tabela e as colunas das que saíram. */
export type FonteDasMensagensAutomaticas = {
  rotina: string;
  tabela: string;
  colunas: readonly string[];
  /**
   * d93 (23-11-2026): a tabela não tem pedido (uma conversa parada antes de o
   * pedido nascer) — lê-se pela coluna `telefone`, sem a junção ao pedido.
   */
  porTelefone?: boolean;
};

/** TODAS as mensagens automáticas a clientes. Uma rotina nova entra aqui. */
export const FONTES_DAS_MENSAGENS_AUTOMATICAS: readonly FonteDasMensagensAutomaticas[] = Object.freeze([
  { rotina: "validade dos orçamentos (d62)", tabela: "validadeDosOrcamentos", colunas: ["lembrete1Em", "ultimoAvisoEm", "fechadoEm"] },
  { rotina: "lembretes do que falta (d71)", tabela: "lembretesDoQueFalta", colunas: ["lembrete1Em", "lembrete2Em", "lembrete3Em", "arquivadoEm"] },
  { rotina: "seguimento do cliente (d83)", tabela: "seguimentoDoCliente", colunas: ["mensagem1Em", "mensagem2Em", "mensagem3Em", "arquivadoEm"] },
  // d88 (23-11-2026): o orçamento que a Vitória envia sozinha ao cliente.
  { rotina: "propostas ao cliente (d88)", tabela: "envioDasPropostasAoCliente", colunas: ["enviadoEm"] },
  // d102 (24-11-2026): o aviso do pedido sem propostas (ou sem parceiros na zona). O «recebemos o seu pedido» NÃO conta:
  // é a resposta ao pedido que ele acabou de fazer, e contá-lo atrasava para o dia seguinte as propostas desse mesmo dia.
  { rotina: "pedido sem propostas (d102)", tabela: "semPropostasAoCliente", colunas: ["enviadoEm"] },
  // d93 (23-11-2026): os lembretes da conversa parada a meio, antes do pedido (os 10 minutos da d25 não contam).
  {
    rotina: "conversa parada a meio (d93)",
    tabela: "conversasParadas",
    colunas: ["lembrete1Em", "lembrete2Em", "lembrete3Em", "fechadoEm"],
    porTelefone: true,
  },
]);

/** Pura: alguma destas datas é de hoje, em Lisboa? */
export function algumaDeHoje(datas: ReadonlyArray<Date | null | undefined>, agora: Date): boolean {
  const hoje = diaEmLisboa(agora);
  return datas.some((d) => d instanceof Date && !Number.isNaN(d.getTime()) && diaEmLisboa(d) === hoje);
}

const noveDigitos = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
};

const naoHaTabela = (err: unknown) => {
  const code = (err as { code?: string })?.code;
  return code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR";
};

/** O contacto: o telefone (WhatsApp) e, só quando a rotina fala por email, o email. */
export type ContactoDaMensagem = { telefone: string | null | undefined; email?: string | null | undefined };

/**
 * AS DATAS DE TODAS AS MENSAGENS AUTOMÁTICAS A ESTE CONTACTO, de qualquer
 * pedido dele e de qualquer rotina. Lança se a base falhar (não uma tabela
 * em falta).
 */
export async function datasDasMensagensAutomaticas(
  contacto: ContactoDaMensagem,
  opcoes: { pool?: Pool; fontes?: readonly FonteDasMensagensAutomaticas[] } = {},
): Promise<Date[]> {
  const telefone = contacto.telefone ? String(contacto.telefone) : null;
  const tel = noveDigitos(telefone);
  const mail = emailValido(contacto.email ?? null);
  if (!tel && !mail) return [];
  const pool = opcoes.pool ?? (await getPool());
  if (!pool) throw new Error("[uma-mensagem-automatica-por-dia] base de dados indisponível");
  const datas: Date[] = [];
  for (const f of opcoes.fontes ?? FONTES_DAS_MENSAGENS_AUTOMATICAS) {
    if (f.porTelefone) {
      if (!tel || !telefone) continue;
      let linhas: Array<Record<string, unknown>> = [];
      try {
        [linhas] = (await pool.execute(
          `SELECT ${f.colunas.map((c) => `v.${c}`).join(", ")}, v.telefone FROM ${f.tabela} v WHERE RIGHT(v.telefone, 9) = ? LIMIT 20`,
          [tel],
        )) as [Array<Record<string, unknown>>, unknown];
      } catch (err) {
        if (naoHaTabela(err)) continue;
        throw err;
      }
      for (const r of Array.isArray(linhas) ? linhas : []) {
        if (!mesmoTelefoneEstrito(String(r.telefone ?? ""), telefone)) continue;
        for (const c of f.colunas) {
          const d = instanteDaBase(r[c] as string | Date | null);
          if (d) datas.push(d);
        }
      }
      continue;
    }
    const onde: string[] = [];
    const params: string[] = [];
    if (tel) {
      onde.push("RIGHT(REGEXP_REPLACE(COALESCE(o.contactPhone, ''), '[^0-9]', ''), 9) = ?");
      params.push(tel);
    }
    if (mail) {
      onde.push("LOWER(TRIM(o.contactEmail)) = ?");
      params.push(mail);
    }
    let rows: Array<Record<string, unknown>> = [];
    try {
      [rows] = (await pool.execute(
        `SELECT ${f.colunas.map((c) => `v.${c}`).join(", ")}, o.contactPhone, o.contactEmail
           FROM ${f.tabela} v
           JOIN simulatorOrders o ON o.id = v.pedidoId
          WHERE ${onde.join(" OR ")}
          ORDER BY v.pedidoId DESC
          LIMIT 50`,
        params,
      )) as [Array<Record<string, unknown>>, unknown];
    } catch (err) {
      if (naoHaTabela(err)) continue;
      throw err;
    }
    for (const r of rows ?? []) {
      const doTelefone = telefone ? mesmoTelefoneEstrito(String(r.contactPhone ?? ""), telefone) : false;
      const doEmail = mail ? emailValido(r.contactEmail as string | null) === mail : false;
      if (!doTelefone && !doEmail) continue;
      for (const c of f.colunas) {
        const d = instanteDaBase(r[c] as string | Date | null);
        if (d) datas.push(d);
      }
    }
  }
  return datas;
}

/**
 * JÁ SAIU HOJE UMA MENSAGEM AUTOMÁTICA A ESTE CONTACTO? A pergunta que TODAS
 * as rotinas fazem antes de reservar o passo do dia. Lança se a base falhar.
 */
export async function jaSaiuHojeUmaMensagemAutomatica(
  contacto: ContactoDaMensagem,
  agora: Date,
  opcoes: { pool?: Pool } = {},
): Promise<boolean> {
  /*
   * NÃO CONTACTAR — d93 (23-11-2026). Quem cancelou pela conversa ouviu «Não
   * voltaremos a contactá-lo»: para todas as rotinas, é como se a mensagem do
   * dia já tivesse saído — nada sai, hoje nem nunca. Ver `nao-contactar.ts`.
   */
  if (contacto.telefone) {
    const { eParaNaoContactar } = await import("./nao-contactar");
    if (await eParaNaoContactar(String(contacto.telefone), opcoes)) return true;
  }
  return algumaDeHoje(await datasDasMensagensAutomaticas(contacto, opcoes), agora);
}
