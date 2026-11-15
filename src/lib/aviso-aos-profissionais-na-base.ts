import crypto from "node:crypto";
import { Resend } from "resend";
import { ensureProvidersSchema, ensureRegistoTable, getPool, registarSemFalhar, whatsappLigado } from "./db";
import {
  CANAIS,
  CHAVE_DO_AVISO,
  NOME_DO_INTERRUPTOR_DO_AVISO,
  comONome,
  contarDestinatarios,
  corpoEmTexto,
  dentroDaJanelaDoWhatsApp,
  eDestinatarioDoAviso,
  emailValido,
  htmlDoEmailDoAviso,
  ligaAoSaberMais,
  rascunhoDoAviso,
  telemovelDoAviso,
  type Canal,
  type ContagemDosDestinatarios,
  type ConteudoDoAviso,
  type EstadoDoDestinatario,
  type ProfissionalParaOAviso,
} from "./aviso-aos-profissionais";
import {
  avancarOAviso,
  type PortasDoAviso,
  type RepositorioDoAviso,
  type ResultadoDaPassagem,
  type ResultadoDoEmail,
} from "./aviso-aos-profissionais-motor";
import { legivelNoResumo } from "./email-legivel-no-resumo";
import { BUSINESS_EMAIL } from "./seo-data";
import { urlDeAccao } from "./url-do-site";
import { comChave } from "./acesso-mvp";

/**
 * O AVISO A TODOS OS PROFISSIONAIS, NA BASE — d11 (15-11-2026).
 *
 * As regras estão em `aviso-aos-profissionais.ts` e o motor em
 * `aviso-aos-profissionais-motor.ts`; aqui vivem as três tabelas, o
 * interruptor das Configs e as duas portas de saída (Resend e a fila da
 * ponte). As tabelas NÃO guardam o email nem o telefone: só o id do
 * profissional. O contacto lê-se no momento de enviar.
 */

const CHAVE_DO_INTERRUPTOR = "aviso_novo_modelo_d11";

type Pool = NonNullable<Awaited<ReturnType<typeof getPool>>>;

let tabelasProntas = false;
async function tabelas(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  if (tabelasProntas) return pool;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS avisoProfissionaisVersoes (
      id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      chave         VARCHAR(40) NOT NULL,
      titulo        VARCHAR(200) NOT NULL,
      textoEmail    TEXT NOT NULL,
      textoWhatsApp TEXT NOT NULL,
      criadoEm      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      porQuem       VARCHAR(120) NULL,
      KEY idx_chave (chave, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  /*
   * `activoChave` é a chave do aviso enquanto o envio está a correr, e NULL
   * depois. Sendo UNIQUE, dois «Enviar» ao mesmo tempo dão um só envio: o
   * segundo INSERT falha na chave.
   */
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS avisoProfissionaisEnvios (
      id                INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      chave             VARCHAR(40) NOT NULL,
      versaoId          INT UNSIGNED NOT NULL,
      canais            VARCHAR(40) NOT NULL,
      estado            VARCHAR(16) NOT NULL DEFAULT 'a_enviar',
      activoChave       VARCHAR(40) NULL DEFAULT NULL,
      proximoWhatsAppEm DATETIME NULL DEFAULT NULL,
      criadoEm          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      porQuem           VARCHAR(120) NULL,
      paradoEm          DATETIME NULL DEFAULT NULL,
      paradoPor         VARCHAR(120) NULL,
      terminadoEm       DATETIME NULL DEFAULT NULL,
      UNIQUE KEY uq_activo (activoChave),
      KEY idx_chave (chave, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  /*
   * UMA LINHA POR PROFISSIONAL E POR CANAL, PARA SEMPRE: a chave única
   * (chave, providerId, canal) é o que faz cada um receber este aviso uma só
   * vez em cada canal, por muitas vezes que se carregue em «Enviar».
   */
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS avisoProfissionaisDestinatarios (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      chave       VARCHAR(40) NOT NULL,
      providerId  INT UNSIGNED NOT NULL,
      canal       VARCHAR(10) NOT NULL,
      envioId     INT UNSIGNED NOT NULL,
      estado      VARCHAR(12) NOT NULL DEFAULT 'pendente',
      motivo      VARCHAR(200) NULL DEFAULT NULL,
      criadoEm    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      tentadoEm   DATETIME NULL DEFAULT NULL,
      enviadoEm   DATETIME NULL DEFAULT NULL,
      UNIQUE KEY uq_uma_vez (chave, providerId, canal),
      KEY idx_envio (envioId, canal, estado, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS retencaoInterruptores (
      chave     VARCHAR(40) NOT NULL PRIMARY KEY,
      ligado    TINYINT(1) NOT NULL DEFAULT 0,
      mudadoEm  DATETIME NULL DEFAULT NULL,
      porQuem   VARCHAR(120) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tabelasProntas = true;
  return pool;
}

const iso = (v: Date | string | null | undefined) => (v ? new Date(v).toISOString() : null);

/* ── O interruptor «Mostrar o aviso do novo modelo» — DESLIGADO por omissão ─ */

export type InterruptorDoAviso = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

export async function interruptorDoAviso(): Promise<InterruptorDoAviso> {
  const desligado: InterruptorDoAviso = { ligado: false, mudadoEm: null, porQuem: null };
  try {
    const pool = await tabelas();
    const [rows] = (await pool.execute(
      "SELECT ligado, mudadoEm, porQuem FROM retencaoInterruptores WHERE chave = ? LIMIT 1",
      [CHAVE_DO_INTERRUPTOR],
    )) as [Array<{ ligado: number; mudadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = rows[0];
    if (!l) return desligado;
    return { ligado: Number(l.ligado) === 1, mudadoEm: iso(l.mudadoEm), porQuem: l.porQuem ?? null };
  } catch (e) {
    console.error("[aviso-aos-profissionais] não li o interruptor — fica desligado:", e instanceof Error ? e.message : e);
    return desligado;
  }
}

export async function mudarInterruptorDoAviso(ligar: boolean, porQuem: string): Promise<InterruptorDoAviso> {
  const pool = await tabelas();
  await ensureRegistoTable();
  const antes = await interruptorDoAviso();
  await pool.execute(
    `INSERT INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE ligado = VALUES(ligado), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
    [CHAVE_DO_INTERRUPTOR, ligar ? 1 : 0, porQuem.slice(0, 120)],
  );
  await registarSemFalhar({
    acontecimento: "aviso_profissionais",
    autorTipo: "clyon",
    autorNome: porQuem,
    estadoAntes: antes.ligado ? "ligado" : "desligado",
    estadoDepois: ligar ? "ligado" : "desligado",
    resumo: `«${NOME_DO_INTERRUPTOR_DO_AVISO}» ${ligar ? "LIGADO" : "DESLIGADO"} por ${porQuem} (d11).`,
  });
  return interruptorDoAviso();
}

/* ── As versões do texto ─────────────────────────────────────────────────── */

export type VersaoDoAviso = ConteudoDoAviso & { id: number; criadoEm: string | null; porQuem: string | null };

export async function versoesDoAviso(limite = 10): Promise<VersaoDoAviso[]> {
  const pool = await tabelas();
  const [rows] = (await pool.execute(
    `SELECT id, titulo, textoEmail, textoWhatsApp, criadoEm, porQuem FROM avisoProfissionaisVersoes
      WHERE chave = ? ORDER BY id DESC LIMIT ${Math.max(1, Math.min(50, Math.floor(limite)))}`,
    [CHAVE_DO_AVISO],
  )) as [Array<Record<string, unknown>>, unknown];
  return rows.map((r) => ({
    id: Number(r.id),
    titulo: String(r.titulo),
    textoEmail: String(r.textoEmail),
    textoWhatsApp: String(r.textoWhatsApp),
    criadoEm: iso(r.criadoEm as Date | null),
    porQuem: (r.porQuem as string | null) ?? null,
  }));
}

/** A última versão guardada, ou o rascunho da d11 quando ainda não há nenhuma. */
export async function conteudoEmVigor(): Promise<ConteudoDoAviso & { versaoId: number | null }> {
  try {
    const [v] = await versoesDoAviso(1);
    if (v) return { titulo: v.titulo, textoEmail: v.textoEmail, textoWhatsApp: v.textoWhatsApp, versaoId: v.id };
  } catch (e) {
    console.error("[aviso-aos-profissionais] não li as versões:", e instanceof Error ? e.message : e);
  }
  return { ...rascunhoDoAviso(urlDeAccao()), versaoId: null };
}

export async function guardarVersao(c: ConteudoDoAviso, porQuem: string): Promise<VersaoDoAviso> {
  const pool = await tabelas();
  const [r] = (await pool.execute(
    "INSERT INTO avisoProfissionaisVersoes (chave, titulo, textoEmail, textoWhatsApp, porQuem) VALUES (?, ?, ?, ?, ?)",
    [CHAVE_DO_AVISO, c.titulo, c.textoEmail, c.textoWhatsApp, porQuem.slice(0, 120)],
  )) as [{ insertId: number }, unknown];
  await registarSemFalhar({
    acontecimento: "aviso_profissionais",
    autorTipo: "clyon",
    autorNome: porQuem,
    resumo: `Aviso a todos os profissionais: versão ${r.insertId} do texto guardada por ${porQuem} (d11).`,
  });
  const [v] = await versoesDoAviso(1);
  return v;
}

/* ── Os destinatários ───────────────────────────────────────────────────── */

async function profissionaisParaOAviso(): Promise<ProfissionalParaOAviso[]> {
  await ensureProvidersSchema();
  const pool = await tabelas();
  const [rows] = (await pool.execute(
    `SELECT id, name, email, phone, estado, isActive, isClyon, COALESCE(contaDeTeste, 0) AS contaDeTeste
       FROM providers WHERE estado = 'aprovado' AND isActive = 1`,
  )) as [Array<Record<string, unknown>>, unknown];
  return rows.map((r) => ({
    id: Number(r.id),
    nome: (r.name as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    telefone: (r.phone as string | null) ?? null,
    estado: (r.estado as string | null) ?? null,
    isActive: Number(r.isActive),
    isClyon: Number(r.isClyon),
    contaDeTeste: Number(r.contaDeTeste),
  }));
}

export async function destinatariosAgora(): Promise<ContagemDosDestinatarios> {
  return contarDestinatarios(await profissionaisParaOAviso());
}

/* ── O estado, para o painel ─────────────────────────────────────────────── */

export type LinhaDoDestinatario = {
  providerId: number;
  canal: Canal;
  estado: EstadoDoDestinatario;
  motivo: string | null;
  enviadoEm: string | null;
};

export type EstadoDoAviso = {
  destinatarios: ContagemDosDestinatarios;
  contadores: Record<Canal, Record<EstadoDoDestinatario, number>>;
  envio: {
    id: number;
    estado: string;
    canais: Canal[];
    versaoId: number;
    criadoEm: string | null;
    porQuem: string | null;
    paradoEm: string | null;
    terminadoEm: string | null;
    proximoWhatsAppEmS: number | null;
  } | null;
  foraDaJanelaAgora: boolean;
  whatsappLigado: boolean;
  linhas: LinhaDoDestinatario[];
  interruptor: InterruptorDoAviso;
};

const zeros = (): Record<EstadoDoDestinatario, number> => ({ pendente: 0, a_enviar: 0, enviado: 0, falhou: 0, parado: 0 });

export async function estadoDoAviso(agora: Date = new Date()): Promise<EstadoDoAviso> {
  const pool = await tabelas();
  const [destinatarios, interruptor, ligado] = await Promise.all([
    destinatariosAgora(),
    interruptorDoAviso(),
    whatsappLigado().catch(() => false),
  ]);
  const [linhasCruas] = (await pool.execute(
    `SELECT providerId, canal, estado, motivo, enviadoEm FROM avisoProfissionaisDestinatarios
      WHERE chave = ? ORDER BY providerId ASC, canal ASC`,
    [CHAVE_DO_AVISO],
  )) as [Array<Record<string, unknown>>, unknown];
  const contadores: Record<Canal, Record<EstadoDoDestinatario, number>> = { email: zeros(), whatsapp: zeros() };
  const linhas: LinhaDoDestinatario[] = linhasCruas.map((r) => {
    const canal = (r.canal === "whatsapp" ? "whatsapp" : "email") as Canal;
    const estado = String(r.estado) as EstadoDoDestinatario;
    if (estado in contadores[canal]) contadores[canal][estado]++;
    return {
      providerId: Number(r.providerId),
      canal,
      estado,
      motivo: (r.motivo as string | null) ?? null,
      enviadoEm: iso(r.enviadoEm as Date | null),
    };
  });
  const [envios] = (await pool.execute(
    `SELECT id, estado, canais, versaoId, criadoEm, porQuem, paradoEm, terminadoEm,
            TIMESTAMPDIFF(SECOND, NOW(), proximoWhatsAppEm) AS faltaS
       FROM avisoProfissionaisEnvios WHERE chave = ? ORDER BY id DESC LIMIT 1`,
    [CHAVE_DO_AVISO],
  )) as [Array<Record<string, unknown>>, unknown];
  const e = envios[0];
  return {
    destinatarios,
    contadores,
    envio: e
      ? {
          id: Number(e.id),
          estado: String(e.estado),
          canais: lerCanais(String(e.canais)),
          versaoId: Number(e.versaoId),
          criadoEm: iso(e.criadoEm as Date | null),
          porQuem: (e.porQuem as string | null) ?? null,
          paradoEm: iso(e.paradoEm as Date | null),
          terminadoEm: iso(e.terminadoEm as Date | null),
          proximoWhatsAppEmS: e.faltaS == null ? null : Math.max(0, Number(e.faltaS)),
        }
      : null,
    foraDaJanelaAgora: !dentroDaJanelaDoWhatsApp(agora),
    whatsappLigado: ligado,
    linhas,
    interruptor,
  };
}

function lerCanais(s: string): Canal[] {
  return s.split(",").filter((c): c is Canal => (CANAIS as readonly string[]).includes(c));
}

/* ── Começar e parar ─────────────────────────────────────────────────────── */

export class AvisoRecusado extends Error {}

export async function comecarOEnvio(versaoId: number, canais: Canal[], porQuem: string): Promise<{ envioId: number; novos: number; retomados: number }> {
  const limpos = CANAIS.filter((c) => canais.includes(c));
  if (limpos.length === 0) throw new AvisoRecusado("Escolha pelo menos um canal.");
  const pool = await tabelas();
  const [vs] = (await pool.execute(
    "SELECT id, titulo, textoEmail, textoWhatsApp FROM avisoProfissionaisVersoes WHERE id = ? AND chave = ? LIMIT 1",
    [versaoId, CHAVE_DO_AVISO],
  )) as [Array<{ id: number; titulo: string; textoEmail: string; textoWhatsApp: string }>, unknown];
  const versao = vs[0];
  if (!versao) throw new AvisoRecusado("Guarde o texto antes de enviar (não há essa versão).");
  const [ultima] = await versoesDoAviso(1);
  if (!ultima || ultima.id !== Number(versao.id)) {
    throw new AvisoRecusado("Há uma versão mais recente do texto. Envie a última, ou guarde esta outra vez.");
  }
  if (ligaAoSaberMais(versao) && !(await interruptorDoAviso()).ligado) {
    throw new AvisoRecusado(
      `O texto liga para a página «Saber mais», que só abre com «${NOME_DO_INTERRUPTOR_DO_AVISO}» ligado nas Configs. Ligue-o antes de enviar.`,
    );
  }

  let envioId: number;
  try {
    const [r] = (await pool.execute(
      `INSERT INTO avisoProfissionaisEnvios (chave, versaoId, canais, estado, activoChave, porQuem)
       VALUES (?, ?, ?, 'a_enviar', ?, ?)`,
      [CHAVE_DO_AVISO, versao.id, limpos.join(","), CHAVE_DO_AVISO, porQuem.slice(0, 120)],
    )) as [{ insertId: number }, unknown];
    envioId = r.insertId;
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new AvisoRecusado("Já há um envio a correr. Pare-o primeiro.");
    throw e;
  }

  const lista = (await profissionaisParaOAviso()).filter(eDestinatarioDoAviso);
  let novos = 0;
  let retomados = 0;
  for (const canal of limpos) {
    const comContacto = lista.filter((p) => (canal === "email" ? emailValido(p.email) : telemovelDoAviso(p.telefone)));
    for (const p of comContacto) {
      const [ins] = (await pool.execute(
        `INSERT IGNORE INTO avisoProfissionaisDestinatarios (chave, providerId, canal, envioId, estado)
         VALUES (?, ?, ?, ?, 'pendente')`,
        [CHAVE_DO_AVISO, p.id, canal, envioId],
      )) as [{ affectedRows: number }, unknown];
      novos += Number(ins.affectedRows) || 0;
    }
    const ids = comContacto.map((p) => p.id);
    if (ids.length > 0) {
      // Os que pararam a meio, ou falharam, voltam à fila deste envio. Os enviados nunca.
      const [up] = (await pool.execute(
        `UPDATE avisoProfissionaisDestinatarios SET estado = 'pendente', envioId = ?, motivo = NULL
          WHERE chave = ? AND canal = ? AND estado IN ('parado', 'falhou')
            AND providerId IN (${ids.map(() => "?").join(",")})`,
        [envioId, CHAVE_DO_AVISO, canal, ...ids],
      )) as [{ affectedRows: number }, unknown];
      retomados += Number(up.affectedRows) || 0;
    }
  }
  await registarSemFalhar({
    acontecimento: "aviso_profissionais",
    autorTipo: "clyon",
    autorNome: porQuem,
    estadoDepois: "a_enviar",
    resumo: `Aviso a todos os profissionais: envio ${envioId} começado por ${porQuem} (versão ${versao.id}, ${limpos.join(" e ")}; ${novos} novos, ${retomados} retomados) (d11).`,
  });
  return { envioId, novos, retomados };
}

export async function pararOEnvio(porQuem: string): Promise<boolean> {
  const pool = await tabelas();
  const [envios] = (await pool.execute(
    "SELECT id FROM avisoProfissionaisEnvios WHERE activoChave = ? LIMIT 1",
    [CHAVE_DO_AVISO],
  )) as [Array<{ id: number }>, unknown];
  const e = envios[0];
  if (!e) return false;
  const [r] = (await pool.execute(
    `UPDATE avisoProfissionaisEnvios SET estado = 'parado', activoChave = NULL, paradoEm = NOW(), paradoPor = ?
      WHERE id = ? AND activoChave IS NOT NULL`,
    [porQuem.slice(0, 120), e.id],
  )) as [{ affectedRows: number }, unknown];
  await pool.execute(
    "UPDATE avisoProfissionaisDestinatarios SET estado = 'parado' WHERE envioId = ? AND estado = 'pendente'",
    [e.id],
  );
  if (Number(r.affectedRows) > 0) {
    await registarSemFalhar({
      acontecimento: "aviso_profissionais",
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: "a_enviar",
      estadoDepois: "parado",
      resumo: `Aviso a todos os profissionais: envio ${e.id} PARADO por ${porQuem} (d11).`,
    });
  }
  return Number(r.affectedRows) > 0;
}

/* ── O repositório e as portas, para o motor ─────────────────────────────── */

function repositorio(pool: Pool): RepositorioDoAviso {
  return {
    async envioActivo() {
      const [rows] = (await pool.execute(
        `SELECT e.id, e.canais, v.titulo, v.textoEmail, v.textoWhatsApp
           FROM avisoProfissionaisEnvios e JOIN avisoProfissionaisVersoes v ON v.id = e.versaoId
          WHERE e.activoChave = ? LIMIT 1`,
        [CHAVE_DO_AVISO],
      )) as [Array<Record<string, unknown>>, unknown];
      const r = rows[0];
      if (!r) return null;
      return {
        id: Number(r.id),
        canais: lerCanais(String(r.canais)),
        conteudo: { titulo: String(r.titulo), textoEmail: String(r.textoEmail), textoWhatsApp: String(r.textoWhatsApp) },
      };
    },
    async proximoPendente(envioId, canal) {
      const [rows] = (await pool.execute(
        `SELECT id, providerId FROM avisoProfissionaisDestinatarios
          WHERE envioId = ? AND canal = ? AND estado = 'pendente' ORDER BY id ASC LIMIT 1`,
        [envioId, canal],
      )) as [Array<{ id: number; providerId: number }>, unknown];
      const r = rows[0];
      return r ? { id: Number(r.id), providerId: Number(r.providerId), canal } : null;
    },
    async reservar(id) {
      const [r] = (await pool.execute(
        "UPDATE avisoProfissionaisDestinatarios SET estado = 'a_enviar', tentadoEm = NOW() WHERE id = ? AND estado = 'pendente'",
        [id],
      )) as [{ affectedRows: number }, unknown];
      return Number(r.affectedRows) === 1;
    },
    async devolver(id) {
      await pool.execute(
        "UPDATE avisoProfissionaisDestinatarios SET estado = 'pendente' WHERE id = ? AND estado = 'a_enviar'",
        [id],
      );
    },
    async marcar(d, estado, motivo) {
      await pool.execute(
        `UPDATE avisoProfissionaisDestinatarios SET estado = ?, motivo = ?, enviadoEm = ${estado === "enviado" ? "NOW()" : "NULL"}
          WHERE id = ?`,
        [estado, motivo ? motivo.slice(0, 200) : null, d.id],
      );
      await registarSemFalhar({
        acontecimento: "aviso_profissionais_destinatario",
        providerId: d.providerId,
        autorTipo: "sistema",
        autorNome: "aviso a todos os profissionais",
        estadoDepois: estado,
        resumo: `Aviso do novo modelo por ${d.canal === "email" ? "email" : "WhatsApp"}: ${estado === "enviado" ? "enviado" : `falhou (${motivo ?? "sem motivo"})`} (d11).`,
      });
    },
    async ganharAVezDoWhatsApp(envioId, segundos) {
      const [r] = (await pool.execute(
        `UPDATE avisoProfissionaisEnvios SET proximoWhatsAppEm = NOW() + INTERVAL ? SECOND
          WHERE id = ? AND activoChave IS NOT NULL AND (proximoWhatsAppEm IS NULL OR proximoWhatsAppEm <= NOW())`,
        [Math.max(1, Math.floor(segundos)), envioId],
      )) as [{ affectedRows: number }, unknown];
      return Number(r.affectedRows) === 1;
    },
    async pendentes(envioId) {
      const [rows] = (await pool.execute(
        "SELECT COUNT(*) AS n FROM avisoProfissionaisDestinatarios WHERE envioId = ? AND estado = 'pendente'",
        [envioId],
      )) as [Array<{ n: number }>, unknown];
      return Number(rows[0]?.n ?? 0);
    },
    async terminar(envioId) {
      const [r] = (await pool.execute(
        `UPDATE avisoProfissionaisEnvios SET estado = 'terminado', activoChave = NULL, terminadoEm = NOW()
          WHERE id = ? AND activoChave IS NOT NULL`,
        [envioId],
      )) as [{ affectedRows: number }, unknown];
      if (Number(r.affectedRows) > 0) {
        await registarSemFalhar({
          acontecimento: "aviso_profissionais",
          autorTipo: "sistema",
          autorNome: "aviso a todos os profissionais",
          estadoAntes: "a_enviar",
          estadoDepois: "terminado",
          resumo: `Aviso a todos os profissionais: envio ${envioId} terminado (d11).`,
        });
      }
    },
    async contacto(providerId) {
      const [rows] = (await pool.execute(
        `SELECT id, name, email, phone, estado, isActive, isClyon, COALESCE(contaDeTeste, 0) AS contaDeTeste
           FROM providers WHERE id = ? LIMIT 1`,
        [providerId],
      )) as [Array<Record<string, unknown>>, unknown];
      const r = rows[0];
      if (!r) return null;
      const p: ProfissionalParaOAviso = {
        id: Number(r.id),
        nome: (r.name as string | null) ?? null,
        email: (r.email as string | null) ?? null,
        telefone: (r.phone as string | null) ?? null,
        estado: (r.estado as string | null) ?? null,
        isActive: Number(r.isActive),
        isClyon: Number(r.isClyon),
        contaDeTeste: Number(r.contaDeTeste),
      };
      return { nome: p.nome, email: emailValido(p.email), telemovel: telemovelDoAviso(p.telefone), elegivel: eDestinatarioDoAviso(p) };
    },
  };
}

function urlDoPerfil(): string {
  return comChave(`${urlDeAccao()}/profissionais/painel?ecra=banco`);
}

/** O email do aviso. `chaveUnica` vai ao Resend, que não repete o mesmo envio em 24 h. */
export async function enviarEmailDoAviso(
  para: string,
  nome: string | null,
  c: ConteudoDoAviso,
  chaveUnica: string | null,
): Promise<ResultadoDoEmail> {
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave) return { falhou: "RESEND_API_KEY em falta" };
  const texto = comONome(c.textoEmail, nome);
  const resend = new Resend(chave);
  const { error } = await resend.emails.send(
    {
      from: "CLYON <noreply@clyon.pt>",
      to: para,
      replyTo: BUSINESS_EMAIL,
      subject: c.titulo,
      html: legivelNoResumo(htmlDoEmailDoAviso({ titulo: c.titulo, texto, urlDoPerfil: urlDoPerfil() })),
      text: `${c.titulo}\n\n${corpoEmTexto(texto)}\n\nCompletar o perfil: ${urlDoPerfil()}`,
    },
    chaveUnica ? { idempotencyKey: chaveUnica } : undefined,
  );
  if (!error) return "enviado";
  const nomeDoErro = String((error as { name?: string }).name ?? "");
  const estado = Number((error as { statusCode?: number }).statusCode ?? 0);
  if (estado === 429 || /rate_limit/i.test(nomeDoErro)) return "esperar";
  return { falhou: `Resend: ${(error as { message?: string }).message ?? nomeDoErro ?? "recusou"}`.slice(0, 180) };
}

export async function enviarWhatsAppDoAviso(para: string, nome: string | null, c: ConteudoDoAviso): Promise<boolean> {
  const { enviarAvisoWhatsApp } = await import("./whatsapp-cloud");
  return enviarAvisoWhatsApp(para, comONome(c.textoWhatsApp, nome));
}

function portas(): PortasDoAviso {
  return {
    enviarEmail: (para, nome, c, providerId) => enviarEmailDoAviso(para, nome, c, `aviso-${CHAVE_DO_AVISO}-${providerId}`),
    enviarWhatsApp: enviarWhatsAppDoAviso,
    whatsappPronto: () => whatsappLigado().catch(() => false),
    esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
    aleatorio: () => crypto.randomInt(0, 1_000_000) / 1_000_000,
  };
}

/*
 * Uma passagem de cada vez por instância, e no máximo de 4 em 4 s: a ponte
 * chama isto em cada ronda, e a página do backoffice também.
 */
let aCorrer = false;
let ultimaPassagem = 0;

export async function passagemDoAviso(origem: "ponte" | "backoffice", maxEmails = 4): Promise<ResultadoDaPassagem | null> {
  const agora = Date.now();
  if (aCorrer || agora - ultimaPassagem < 4000) return null;
  aCorrer = true;
  ultimaPassagem = agora;
  try {
    const pool = await tabelas();
    return await avancarOAviso(repositorio(pool), portas(), new Date(), { maxEmails });
  } catch (e) {
    console.error(`[aviso-aos-profissionais] passagem (${origem}) falhou:`, e instanceof Error ? e.message : e);
    return null;
  } finally {
    aCorrer = false;
  }
}

/* ── O teste para o administrador ────────────────────────────────────────── */

export async function enviarTeste(
  c: ConteudoDoAviso,
  destino: { email?: string | null; telefone?: string | null },
  porQuem: string,
): Promise<{ email: string | null; whatsapp: string | null }> {
  const email = destino.email ? emailValido(destino.email) : null;
  const tel = destino.telefone ? telemovelDoAviso(destino.telefone) : null;
  if (destino.email && !email) throw new AvisoRecusado("Esse email não parece válido.");
  if (destino.telefone && !tel) throw new AvisoRecusado("Só telemóveis portugueses (9 dígitos, a começar por 9).");
  if (!email && !tel) throw new AvisoRecusado("Escreva o seu email ou o seu telemóvel.");

  // O teste é para quem está no backoffice, nunca para um profissional da lista.
  const lista = (await profissionaisParaOAviso()).filter(eDestinatarioDoAviso);
  if (email && lista.some((p) => emailValido(p.email) === email)) {
    throw new AvisoRecusado("Esse email é de um profissional da lista. O teste é para si.");
  }
  if (tel && lista.some((p) => telemovelDoAviso(p.telefone) === tel)) {
    throw new AvisoRecusado("Esse telemóvel é de um profissional da lista. O teste é para si.");
  }

  const r = { email: null as string | null, whatsapp: null as string | null };
  if (email) {
    const res = await enviarEmailDoAviso(email, porQuem, c, null).catch((e) => ({ falhou: String(e?.message ?? e) }));
    r.email = res === "enviado" ? "enviado" : res === "esperar" ? "o Resend pediu para esperar" : res.falhou;
  }
  if (tel) {
    const saiu = await enviarWhatsAppDoAviso(tel, porQuem, c).catch(() => false);
    r.whatsapp = saiu ? "posto na fila da ponte" : "o WhatsApp não aceitou (desligado ou número bloqueado)";
  }
  await registarSemFalhar({
    acontecimento: "aviso_profissionais",
    autorTipo: "clyon",
    autorNome: porQuem,
    resumo: `Aviso a todos os profissionais: teste enviado por ${porQuem} (${[email ? `email: ${r.email}` : null, tel ? `WhatsApp: ${r.whatsapp}` : null].filter(Boolean).join("; ")}) (d11).`,
  });
  return r;
}
